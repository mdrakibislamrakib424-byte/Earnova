// ══════════════════════════════════════════════════════════
// EARNOVA — FCM Push Sender (Supabase Edge Function)
// ══════════════════════════════════════════════════════════
// এটা আগের functions/index.js (Firebase Cloud Function) এর বদলে —
// Blaze প্ল্যান/কার্ড ছাড়াই কাজ করার জন্য Supabase Edge Function হিসেবে
// আবার লেখা হয়েছে। কাজ একদম একই: Supabase থেকে ইউজারের push token
// পড়ে, notification preference চেক করে, Google FCM দিয়ে push পাঠায়।

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAccessToken, sendToManyTokens, type ServiceAccount } from '../_shared/fcm.ts';

// ── এই মানগুলো কোডে বসাবেন না — Supabase Dashboard-এ "Secrets" হিসেবে
//    সেট করবেন (নিচে README-তে ধাপ দেওয়া আছে), Deno.env দিয়ে পড়া হচ্ছে ──
const SUPA_URL              = Deno.env.get('SUPA_URL')!;
const SUPA_SERVICE_ROLE_KEY = Deno.env.get('SUPA_SERVICE_ROLE_KEY')!;
const ADMIN_SECRET          = Deno.env.get('ADMIN_SECRET')!;
const FIREBASE_SERVICE_ACCOUNT: ServiceAccount = JSON.parse(
  Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!,
);

const supabaseAdmin = createClient(SUPA_URL, SUPA_SERVICE_ROLE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ⚠️ catch(e) এ e-এর টাইপ 'unknown' (Deno-র strict TypeScript ডিফল্ট
// আচরণ) — তাই সরাসরি e.message লিখলে টাইপ-চেক এরর দিতে পারে। এই ছোট
// helper দিয়ে নিরাপদে error message বের করা হচ্ছে।
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const { secret, target, uid, country, title, body, url, category } = payload || {};

  if (secret !== ADMIN_SECRET) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }
  if (!title || !body) {
    return json({ ok: false, error: 'title ও body আবশ্যক' }, 400);
  }

  // category: 'balance' | 'offers' | 'general' — Android Notification
  // Channel ঠিক করে (js/push.js এ createChannel করা আছে), আর ইউজার সেই
  // category বন্ধ রাখলে (notif_prefs) তাকে বাদ দেওয়া হয়
  const cat = ['balance', 'offers', 'general'].includes(category) ? category : 'general';

  try {
    let rows: { fcm_token: string; notif_prefs: any }[] = [];

    if (target === 'user' && uid) {
      const { data } = await supabaseAdmin
        .from('users').select('fcm_token,notif_prefs').eq('id', uid).maybeSingle();
      if (data) rows = [data];
    } else if (target === 'country' && country) {
      const { data } = await supabaseAdmin
        .from('users').select('fcm_token,notif_prefs').eq('country', country).not('fcm_token', 'is', null);
      rows = data || [];
    } else {
      const { data } = await supabaseAdmin
        .from('users').select('fcm_token,notif_prefs').not('fcm_token', 'is', null);
      rows = data || [];
    }

    // notif_prefs না থাকলে (পুরনো ইউজার, কলাম খালি) ধরে নেওয়া হচ্ছে সব
    // category-ই চালু আছে — ডিফল্ট আচরণ: সব push পাবে যতক্ষণ না নিজে বন্ধ করে
    const tokens = rows
      .filter(r => r.fcm_token && (!r.notif_prefs || r.notif_prefs[cat] !== false))
      .map(r => r.fcm_token);

    if (!tokens.length) {
      return json({ ok: true, recipients: 0 });
    }

    const accessToken = await getAccessToken(FIREBASE_SERVICE_ACCOUNT);
    const { sent, failed, badTokens } = await sendToManyTokens(
      accessToken,
      FIREBASE_SERVICE_ACCOUNT.project_id,
      tokens,
      title,
      body,
      url || '/',
      cat,
    );

    // বাজে/মৃত টোকেন Supabase থেকে মুছে ফেলা (uninstall করা ফোন ইত্যাদি)
    if (badTokens.length) {
      await supabaseAdmin
        .from('users')
        .update({ fcm_token: null })
        .in('fcm_token', badTokens);
    }

    return json({ ok: true, recipients: sent, failed, total: tokens.length });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});
