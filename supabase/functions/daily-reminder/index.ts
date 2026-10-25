// ══════════════════════════════════════════════════════════
// EARNOVA — daily-reminder  (v2: every user gets it at HIS OWN local time)
// ══════════════════════════════════════════════════════════
// pg_cron calls this function ONCE EVERY HOUR (minute 0) with header  x-cron-secret: <CRON_SECRET>.
// On every call the function works out, for each country, what the local hour is right now,
// and sends the reminder only to users for whom it is one of the SLOTS below.
//   → every user gets at most 6 reminders per day (3 before noon, 3 afternoon/evening),
//     always at a sensible time for HIS country, whichever country that is.
// Deploy with "Verify JWT" OFF (pg_cron sends no login token); the secret is the protection.
// Secrets needed: CRON_SECRET, FIREBASE_SERVICE_ACCOUNT
// Optional secrets (no redeploy needed to change them):
//   REMINDER_SLOTS = "8,10,12,15,18,20"   local hours (0-23) at which a reminder is sent
//   DEFAULT_TZ     = "Asia/Dhaka"         timezone for users whose country is unknown
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

// <<TESTABLE-START
// ── local hours (0–23, in the USER's own timezone) at which a reminder may go out ──
// 3 in the morning-to-noon window, 3 from afternoon until 9 pm. Change with the REMINDER_SLOTS secret.
const DEFAULT_SLOTS = [8, 10, 12, 15, 18, 20];
function parseSlots(raw: string | undefined | null): number[] {
  const out = String(raw ?? '').split(',').map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 23);
  const uniq = [...new Set(out)].sort((a, b) => a - b);
  return uniq.length ? uniq : DEFAULT_SLOTS;
}

// country code → main timezone (big countries use the timezone where most people live)
const COUNTRY_TZ: Record<string, string> = {
  BD: 'Asia/Dhaka', IN: 'Asia/Kolkata', PK: 'Asia/Karachi', NP: 'Asia/Kathmandu', LK: 'Asia/Colombo',
  BT: 'Asia/Thimphu', MV: 'Indian/Maldives', AF: 'Asia/Kabul', MM: 'Asia/Yangon', TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh', KH: 'Asia/Phnom_Penh', LA: 'Asia/Vientiane', MY: 'Asia/Kuala_Lumpur',
  SG: 'Asia/Singapore', ID: 'Asia/Jakarta', PH: 'Asia/Manila', CN: 'Asia/Shanghai', HK: 'Asia/Hong_Kong',
  TW: 'Asia/Taipei', JP: 'Asia/Tokyo', KR: 'Asia/Seoul', MN: 'Asia/Ulaanbaatar', KZ: 'Asia/Almaty',
  UZ: 'Asia/Tashkent', AE: 'Asia/Dubai', SA: 'Asia/Riyadh', QA: 'Asia/Qatar', KW: 'Asia/Kuwait',
  BH: 'Asia/Bahrain', OM: 'Asia/Muscat', YE: 'Asia/Aden', IQ: 'Asia/Baghdad', IR: 'Asia/Tehran',
  JO: 'Asia/Amman', LB: 'Asia/Beirut', SY: 'Asia/Damascus', IL: 'Asia/Jerusalem', TR: 'Europe/Istanbul',
  EG: 'Africa/Cairo', LY: 'Africa/Tripoli', TN: 'Africa/Tunis', DZ: 'Africa/Algiers', MA: 'Africa/Casablanca',
  SD: 'Africa/Khartoum', ET: 'Africa/Addis_Ababa', KE: 'Africa/Nairobi', TZ: 'Africa/Dar_es_Salaam',
  UG: 'Africa/Kampala', NG: 'Africa/Lagos', GH: 'Africa/Accra', ZA: 'Africa/Johannesburg',
  GB: 'Europe/London', IE: 'Europe/Dublin', PT: 'Europe/Lisbon', ES: 'Europe/Madrid', FR: 'Europe/Paris',
  DE: 'Europe/Berlin', IT: 'Europe/Rome', NL: 'Europe/Amsterdam', BE: 'Europe/Brussels', CH: 'Europe/Zurich',
  AT: 'Europe/Vienna', SE: 'Europe/Stockholm', NO: 'Europe/Oslo', DK: 'Europe/Copenhagen', FI: 'Europe/Helsinki',
  PL: 'Europe/Warsaw', CZ: 'Europe/Prague', RO: 'Europe/Bucharest', GR: 'Europe/Athens', UA: 'Europe/Kyiv',
  RU: 'Europe/Moscow', US: 'America/New_York', CA: 'America/Toronto', MX: 'America/Mexico_City',
  BR: 'America/Sao_Paulo', AR: 'America/Argentina/Buenos_Aires', CL: 'America/Santiago', CO: 'America/Bogota',
  PE: 'America/Lima', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland',
};

// local hour (0–23) of a timezone right now; null if the timezone name is not known
const _fmt: Record<string, Intl.DateTimeFormat> = {};
function localHour(tz: string, now: Date): number | null {
  try {
    const f = _fmt[tz] ?? (_fmt[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }));
    const h = parseInt(f.format(now), 10);
    return Number.isInteger(h) ? h % 24 : null;
  } catch { return null; }
}
function tzOf(country: unknown, defaultTz: string): string {
  const c = String(country ?? '').trim().toUpperCase();
  return COUNTRY_TZ[c] ?? defaultTz;
}

// Texts: 3 variants per balance group, in Bangla and English. Variant = position of the slot in the day.
type Txt = [string, string];
const MSG: Record<string, Record<'ready' | 'partial' | 'zero', Txt[]>> = {
  bn: {
    ready: [
      ['💸 Withdrawal প্রস্তুত!', 'আপনার balance withdraw করার মতো জমা হয়ে গেছে — এখনই withdraw করুন!'],
      ['✅ এখন টাকা তুলতে পারবেন', 'আপনার আয় তোলার জন্য প্রস্তুত। EARNOVA খুলে withdraw করুন।'],
      ['🏦 আপনার টাকা অপেক্ষা করছে', 'ব্যালেন্স withdraw করার মতো হয়েছে। দেরি না করে আজই তুলে নিন!'],
    ],
    partial: [
      ['💰 Balance Update', 'আপনার balance বাড়ছে! আরও offer সম্পন্ন করে withdraw limit-এ পৌঁছান।'],
      ['📈 আর একটু বাকি', 'আর কয়েকটা offer করলেই withdraw করতে পারবেন। চালিয়ে যান!'],
      ['🎯 এগিয়ে চলুন!', 'আজকের Spin, Quiz আর offer আপনার ব্যালেন্স বাড়াতে অপেক্ষা করছে।'],
    ],
    zero: [
      ['🎯 নতুন Offers অপেক্ষা করছে!', 'আজকের নতুন offers দেখুন এবং আয় শুরু করুন!'],
      ['🎡 ফ্রি Spin ও Daily Bonus', 'আজকের Daily Bonus নিন আর Spin ঘুরান — একদম ফ্রি!'],
      ['🧠 আজকের Quiz প্রস্তুত', 'আজকের Quiz এর উত্তর দিন আর আসল টাকা আয় করুন।'],
    ],
  },
  en: {
    ready: [
      ['💸 Withdrawal Ready!', 'Your balance has reached the withdrawal limit — withdraw now!'],
      ['✅ You can cash out now', 'Your earnings are ready. Open EARNOVA and request your withdrawal.'],
      ['🏦 Your money is waiting', 'Your balance is ready to withdraw. Don\'t wait — cash out today!'],
    ],
    partial: [
      ['💰 Balance Update', 'Your balance is growing! Complete more offers to reach the withdrawal limit.'],
      ['📈 You\'re getting closer', 'A few more offers and you can withdraw. Keep earning!'],
      ['🎯 Keep going!', 'Today\'s Spin, Quiz and offers are waiting to grow your balance.'],
    ],
    zero: [
      ['🎯 New offers are waiting!', 'Check today\'s new offers and start earning!'],
      ['🎡 Free Spin & Daily Bonus', 'Claim your Daily Bonus and spin the wheel — it\'s free!'],
      ['🧠 Today\'s Quiz is ready', 'Answer today\'s quiz questions and earn real money.'],
    ],
  },
};
function pickText(lang: unknown, group: 'ready' | 'partial' | 'zero', slotIndex: number): Txt {
  const l = String(lang ?? '').toLowerCase() === 'bn' ? 'bn' : 'en';
  const list = MSG[l][group];
  return list[((slotIndex % list.length) + list.length) % list.length];
}

// which users get a reminder right now, and which text — pure function (no network), easy to test
interface UserRow { fcm_token: string; usd_earned: unknown; notif_prefs: any; country: unknown; lang: unknown }
function plan(users: UserRow[], now: Date, slots: number[], defaultTz: string, minWithdraw: number) {
  const buckets: Record<string, { title: string; body: string; tokens: string[] }> = {};
  let due = 0;
  for (const u of users) {
    if (!u.fcm_token) continue;
    if (u.notif_prefs && u.notif_prefs.balance === false) continue;       // user switched balance reminders off
    const h = localHour(tzOf(u.country, defaultTz), now);
    if (h === null) continue;
    const si = slots.indexOf(h);
    if (si < 0) continue;                                                  // not a reminder hour for this user
    const bal = parseFloat(String(u.usd_earned || 0)) || 0;
    const group = bal >= minWithdraw ? 'ready' : bal > 0 ? 'partial' : 'zero';
    const [title, body] = pickText(u.lang, group, si);
    const key = title + '|' + body;
    (buckets[key] ??= { title, body, tokens: [] }).tokens.push(u.fcm_token);
    due++;
  }
  return { buckets, due };
}
// TESTABLE-END>>

Deno.serve(async (req: Request) => {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!CRON_SECRET || !safeEqual(provided, CRON_SECRET)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const slots = parseSlots(Deno.env.get('REMINDER_SLOTS'));
    const defaultTz = Deno.env.get('DEFAULT_TZ') && localHour(Deno.env.get('DEFAULT_TZ')!, new Date()) !== null
      ? Deno.env.get('DEFAULT_TZ')! : 'Asia/Dhaka';
    const now = new Date();

    // quick exit: is it a reminder hour ANYWHERE right now? (costs almost nothing most hours)
    const zones = new Set<string>([...Object.values(COUNTRY_TZ), defaultTz]);
    let anywhere = false;
    for (const z of zones) { const h = localHour(z, now); if (h !== null && slots.includes(h)) { anywhere = true; break; } }
    if (!anywhere) return new Response(JSON.stringify({ ok: true, sent: 0, note: 'no reminder hour' }), { status: 200 });

    // minimum withdrawal = same rule the server uses (settings 'rules' → minUSD, default 12)
    let minWithdraw = 12;
    try {
      const { data: r } = await supabaseAdmin.from('settings').select('data').eq('id', 'rules').maybeSingle();
      const v = Number((r as any)?.data?.minUSD);
      if (v > 0) minWithdraw = v;
    } catch { /* keep default */ }

    // read users page by page (the database returns max 1000 rows per request)
    const users: UserRow[] = [];
    for (let from = 0; from < 200000; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from('users').select('fcm_token,usd_earned,notif_prefs,country,lang')
        .not('fcm_token', 'is', null).order('id').range(from, from + 999);
      if (error) throw error;
      users.push(...((data ?? []) as UserRow[]));
      if (!data || data.length < 1000) break;
    }

    const { buckets, due } = plan(users, now, slots, defaultTz, minWithdraw);
    if (!due) return new Response(JSON.stringify({ ok: true, sent: 0, note: 'nobody due' }), { status: 200 });

    const accessToken = await getAccessToken(FIREBASE_SERVICE_ACCOUNT);
    const projectId = FIREBASE_SERVICE_ACCOUNT.project_id;
    let totalSent = 0, totalFailed = 0;
    const allBadTokens: string[] = [];
    for (const b of Object.values(buckets)) {
      const result = await sendToManyTokens(accessToken, projectId, b.tokens, b.title, b.body, '/', 'balance');
      totalSent += result.sent; totalFailed += result.failed; allBadTokens.push(...result.badTokens);
    }
    if (allBadTokens.length) {
      await supabaseAdmin.from('users').update({ fcm_token: null }).in('fcm_token', allBadTokens);
    }
    console.log(`[daily-reminder] due=${due} sent=${totalSent} failed=${totalFailed}`);
    return new Response(JSON.stringify({ ok: true, due, sent: totalSent, failed: totalFailed }), { status: 200 });
  } catch (e) {
    console.error('daily-reminder error:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Server error' }), { status: 500 });
  }
});
