// ══════════════════════════════════════════════════════════
// EARNOVA — daily-reminder  (Phase 4: header-only secret, constant-time compare)
// ══════════════════════════════════════════════════════════
// Called ONLY by pg_cron with header  x-cron-secret: <CRON_SECRET>.
// Deploy this one with "Verify JWT" switched OFF (pg_cron sends no login token);
// the secret is the protection. A secret in the URL (?secret=) is no longer accepted.
// Secrets needed: CRON_SECRET, FIREBASE_SERVICE_ACCOUNT
// supabase client — version pinned
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPA_URL              = Deno.env.get('SUPA_URL') ?? Deno.env.get('SUPABASE_URL')!;
const SUPA_SERVICE_ROLE_KEY = Deno.env.get('SUPA_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(SUPA_URL, SUPA_SERVICE_ROLE_KEY);

// compare two secrets without leaking where they differ
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const FIREBASE_SERVICE_ACCOUNT: ServiceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);

// ─── FCM helpers (inlined so this function is a single file) ───
interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function base64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Service Account প্রাইভেট কী (PEM) দিয়ে সাইন করা JWT বানিয়ে,
//    সেটা Google-এর কাছে পাঠিয়ে একটা সাময়িক Access Token নেওয়া ──
// (এই টোকেন ~১ ঘণ্টা কার্যকর থাকে, প্রতিটা push-ব্যাচের শুরুতে নতুন করে নেওয়া হয়)
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const claimB64  = base64url(encoder.encode(JSON.stringify(claimSet)));
  const signInput = `${headerB64}.${claimB64}`;

  // PEM ফরম্যাট থেকে raw DER বের করে ইম্পোর্ট করা
  const pem = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\r?\n|\r/g, '')
    .trim();
  const binaryDer = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signInput),
  );

  const jwt = `${signInput}.${base64url(signature)}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) {
    throw new Error('Google OAuth token fetch failed: ' + JSON.stringify(data));
  }
  return data.access_token as string;
}

interface PushResult {
  ok: boolean;
  status?: string;
}

// ── একটা single FCM token-এ push পাঠানো (FCM HTTP v1 API) ──
async function sendToToken(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  url: string,
  channelId: string,
): Promise<PushResult> {
  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          webpush: {
            fcm_options: { link: url || '/' },
            notification: { icon: '/icon.png' },
          },
          android: {
            priority: 'high',
            notification: { channel_id: channelId, color: '#2563eb' },
          },
          data: { url: url || '/', title, body },
        },
      }),
    },
  );
  if (resp.ok) return { ok: true };
  const data = await resp.json().catch(() => ({}));
  return { ok: false, status: data?.error?.status || String(resp.status) };
}

// ── একগাদা টোকেনে ব্যাচে পাঠানো, বাজে টোকেন চিহ্নিত করে ফেরত দেওয়া ──
async function sendToManyTokens(
  accessToken: string,
  projectId: string,
  tokens: string[],
  title: string,
  body: string,
  url: string,
  channelId: string,
): Promise<{ sent: number; failed: number; badTokens: string[] }> {
  let sent = 0, failed = 0;
  const badTokens: string[] = [];
  // FCM HTTP v1-তে একবারে একটাই টোকেনে পাঠানো যায় (legacy multicast নেই),
  // তাই loop করে পাঠানো হচ্ছে — কিন্তু একসাথে অনেকগুলো parallel call করলে
  // rate-limit এ পড়ার ঝুঁকি থাকে, তাই ছোট ব্যাচে (২৫টা করে) পাঠানো হচ্ছে
  const BATCH = 25;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(t => sendToToken(accessToken, projectId, t, title, body, url, channelId)),
    );
    results.forEach((r, idx) => {
      if (r.ok) sent++;
      else {
        failed++;
        if (r.status === 'UNREGISTERED' || r.status === 'NOT_FOUND' || r.status === 'INVALID_ARGUMENT') {
          badTokens.push(batch[idx]);
        }
      }
    });
  }
  return { sent, failed, badTokens };
}

Deno.serve(async (req: Request) => {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!CRON_SECRET || !safeEqual(provided, CRON_SECRET)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });
  }

  try {
    // minimum withdrawal = same rule the server uses (settings 'rules' → minUSD, default 12)
    let minWithdraw = 12;
    try {
      const { data: r } = await supabaseAdmin.from('settings').select('data').eq('id', 'rules').maybeSingle();
      const v = Number((r as any)?.data?.minUSD);
      if (v > 0) minWithdraw = v;
    } catch { /* keep default */ }

    const { data: users } = await supabaseAdmin
      .from('users').select('id,fcm_token,usd_earned,notif_prefs').not('fcm_token', 'is', null);
    if (!users?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    const eligible = users.filter((u) => !u.notif_prefs || u.notif_prefs.balance !== false);
    const groups: Record<string, string[]> = { ready: [], partial: [], zero: [] };
    for (const u of eligible) {
      const bal = parseFloat(String(u.usd_earned || 0));
      if (bal >= minWithdraw) groups.ready.push(u.fcm_token);
      else if (bal > 0) groups.partial.push(u.fcm_token);
      else groups.zero.push(u.fcm_token);
    }

    const accessToken = await getAccessToken(FIREBASE_SERVICE_ACCOUNT);
    const projectId = FIREBASE_SERVICE_ACCOUNT.project_id;
    let totalSent = 0, totalFailed = 0;
    const allBadTokens: string[] = [];
    const messages: [string, string, string[]][] = [
      ['💸 Withdrawal Ready!', 'আপনার balance withdraw করার মতো জমা হয়ে গেছে — এখনই withdraw করুন!', groups.ready],
      ['💰 Balance Update', 'আপনার balance বাড়ছে! আরও offer সম্পন্ন করে withdraw limit-এ পৌঁছান।', groups.partial],
      ['🎯 নতুন Offers অপেক্ষা করছে!', 'আজকের নতুন offers দেখুন এবং আয় শুরু করুন!', groups.zero],
    ];
    for (const [title, body, tokens] of messages) {
      if (!tokens.length) continue;
      const result = await sendToManyTokens(accessToken, projectId, tokens, title, body, '/', 'balance');
      totalSent += result.sent; totalFailed += result.failed; allBadTokens.push(...result.badTokens);
    }
    if (allBadTokens.length) {
      await supabaseAdmin.from('users').update({ fcm_token: null }).in('fcm_token', allBadTokens);
    }
    console.log(`[daily-reminder] sent=${totalSent} failed=${totalFailed} eligible=${eligible.length}`);
    return new Response(JSON.stringify({ ok: true, sent: totalSent, failed: totalFailed }), { status: 200 });
  } catch (e) {
    console.error('daily-reminder error:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Server error' }), { status: 500 });
  }
});
