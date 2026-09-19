// ══════════════════════════════════════════════════════════
// EARNOVA — FCM Helper (Supabase Edge Function shared module)
// ══════════════════════════════════════════════════════════
// কেন এই ফাইলটা আলাদা: send-push আর daily-reminder — দুটো ফাংশনেরই
// একই কাজ লাগে (Google-কে push পাঠানোর অনুমতি নেওয়া, তারপর push পাঠানো),
// তাই কোড একবার লিখে দুই জায়গায় import করে ব্যবহার করা হচ্ছে।
//
// ⚠️ কেন firebase-admin SDK ব্যবহার করা হয়নি: সেটা শুধু Node.js-এর জন্য
// বানানো, Supabase Edge Function চলে Deno-তে (যেটাতে npm প্যাকেজ সরাসরি
// কাজ করে না)। তাই এখানে Google-এর OAuth2 + FCM HTTP v1 API সরাসরি,
// হাতে-কলমে (Deno-র বিল্ট-ইন Web Crypto API দিয়ে) কল করা হয়েছে —
// এটা Google-এরই অফিসিয়াল, ডকুমেন্টেড পদ্ধতি, firebase-admin ভেতরে
// ভেতরে ঠিক এটাই করে।

export interface ServiceAccount {
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
export async function getAccessToken(sa: ServiceAccount): Promise<string> {
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

export interface PushResult {
  ok: boolean;
  status?: string;
}

// ── একটা single FCM token-এ push পাঠানো (FCM HTTP v1 API) ──
export async function sendToToken(
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
export async function sendToManyTokens(
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
