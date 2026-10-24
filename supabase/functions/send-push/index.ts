// ══════════════════════════════════════════════════════════
// EARNOVA — send-push  (Phase 4: login-token based, no shared secret)
// ══════════════════════════════════════════════════════════
// Who may call:
//   • admin (users.is_admin = true)  → anyone: target 'user' | 'country' | 'all'
//   • normal logged-in user          → ONLY a push to himself (balance reminder)
// Everybody else (no token / anon key / banned) → 401/403.
// Secrets needed: FIREBASE_SERVICE_ACCOUNT  (SUPA_URL / SUPA_SERVICE_ROLE_KEY are optional —
// Supabase provides them automatically).   ADMIN_SECRET is NOT used any more.
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

const FIREBASE_SERVICE_ACCOUNT: ServiceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);

// only these app origins may call from a browser/webview (comma list in secret ALLOWED_ORIGINS to override)
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://localhost,capacitor://localhost,http://localhost')
  .split(',').map((s) => s.trim()).filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Vary': 'Origin',
  };
  const o = req.headers.get('Origin') ?? '';
  if (ALLOWED_ORIGINS.includes(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
}

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

const CATEGORIES = ['balance', 'offers', 'general'];
const safeUrl = (u: unknown): string => {
  const s = typeof u === 'string' ? u.trim() : '';
  return (s.startsWith('/') && !s.startsWith('//')) || /^https:\/\//i.test(s) ? s.slice(0, 300) : '/';
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { ok: false, error: 'POST only' }, 405);

  // 1) who is calling?  (a real logged-in user's token — the public anon key is rejected here)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(req, { ok: false, error: 'Unauthorized' }, 401);
  const { data: auth, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !auth?.user) return json(req, { ok: false, error: 'Unauthorized' }, 401);
  const callerId = auth.user.id;
  const { data: me } = await supabaseAdmin.from('users').select('is_admin,banned').eq('id', callerId).maybeSingle();
  if (!me || me.banned === true) return json(req, { ok: false, error: 'Forbidden' }, 403);
  const isAdmin = me.is_admin === true;

  let payload: any;
  try { payload = await req.json(); } catch { return json(req, { ok: false, error: 'Invalid JSON body' }, 400); }

  const title = String(payload?.title ?? '').trim().slice(0, 100);
  const body  = String(payload?.body ?? '').trim().slice(0, 300);
  if (!title || !body) return json(req, { ok: false, error: 'title ও body আবশ্যক' }, 400);
  const cat = CATEGORIES.includes(payload?.category) ? payload.category : 'general';

  // 2) what may this caller do?
  let target = String(payload?.target ?? 'user');
  let uid: string | undefined = typeof payload?.uid === 'string' ? payload.uid : undefined;
  let url = safeUrl(payload?.url);
  const country = typeof payload?.country === 'string' && /^[A-Za-z]{2}$/.test(payload.country) ? payload.country.toUpperCase() : '';
  if (!isAdmin) {
    target = 'user'; uid = callerId; url = '/';          // a normal user can only push to himself
  } else if (target === 'user' && !uid) {
    return json(req, { ok: false, error: 'uid আবশ্যক' }, 400);
  } else if (target === 'country' && !country) {
    return json(req, { ok: false, error: 'country আবশ্যক' }, 400);
  }

  try {
    let rows: { fcm_token: string; notif_prefs: any }[] = [];
    if (target === 'user') {
      const { data } = await supabaseAdmin.from('users').select('fcm_token,notif_prefs').eq('id', uid!).maybeSingle();
      if (data) rows = [data];
    } else if (target === 'country') {
      const { data } = await supabaseAdmin.from('users').select('fcm_token,notif_prefs').eq('country', country).not('fcm_token', 'is', null);
      rows = data || [];
    } else {
      const { data } = await supabaseAdmin.from('users').select('fcm_token,notif_prefs').not('fcm_token', 'is', null);
      rows = data || [];
    }

    const tokens = rows
      .filter((r) => r.fcm_token && (!r.notif_prefs || r.notif_prefs[cat] !== false))
      .map((r) => r.fcm_token);
    if (!tokens.length) return json(req, { ok: true, recipients: 0 });

    const accessToken = await getAccessToken(FIREBASE_SERVICE_ACCOUNT);
    const { sent, failed, badTokens } = await sendToManyTokens(
      accessToken, FIREBASE_SERVICE_ACCOUNT.project_id, tokens, title, body, url, cat,
    );
    if (badTokens.length) {
      await supabaseAdmin.from('users').update({ fcm_token: null }).in('fcm_token', badTokens);
    }
    return json(req, { ok: true, recipients: sent, failed, total: tokens.length });
  } catch (e) {
    console.error('send-push error:', e);
    return json(req, { ok: false, error: 'Server error' }, 500);
  }
});
