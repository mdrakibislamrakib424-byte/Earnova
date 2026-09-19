// ══════════════════════════════════════════════════════════
// EARNOVA — Daily Balance Reminder (Supabase Edge Function)
// ══════════════════════════════════════════════════════════
// এটা প্রতিদিন একবার (Supabase pg_cron দিয়ে shedule করা) স্বয়ংক্রিয়ভাবে
// চলে, সব ইউজারকে তাদের বর্তমান balance অনুযায়ী মনে করিয়ে দেয়। আগের
// Firebase pubsub.schedule ফাংশনের বদলে এটা লেখা হয়েছে।
//
// ⚠️ এই ফাংশন Admin panel থেকে সরাসরি কল হয় না — শুধু pg_cron (Supabase
// Dashboard → Database → Cron Jobs) থেকে নির্দিষ্ট সময়ে স্বয়ংক্রিয়ভাবে
// কল হয়। তাই এটা একটা আলাদা, নিজস্ব CRON_SECRET দিয়ে সুরক্ষিত (admin
// panel-এর ADMIN_SECRET থেকে আলাদা রাখা হয়েছে, যাতে দুটো সিস্টেম
// একে-অপরের থেকে স্বাধীন থাকে)।

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAccessToken, sendToManyTokens, type ServiceAccount } from '../_shared/fcm.ts';

const SUPA_URL              = Deno.env.get('SUPA_URL')!;
const SUPA_SERVICE_ROLE_KEY = Deno.env.get('SUPA_SERVICE_ROLE_KEY')!;
const CRON_SECRET           = Deno.env.get('CRON_SECRET')!;
const FIREBASE_SERVICE_ACCOUNT: ServiceAccount = JSON.parse(
  Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!,
);

const supabaseAdmin = createClient(SUPA_URL, SUPA_SERVICE_ROLE_KEY);
// ⚠️ App-এর js/config.js এ ডিফল্ট minimum withdrawal $5 (localStorage
// 'ez_minUSD' দিয়ে admin panel থেকে বদলানো যায়) — কিন্তু সেই localStorage
// মান এই সার্ভার ফাংশন থেকে পড়া সম্ভব না (localStorage শুধু browser-এ
// থাকে)। তাই এখানে $5 হার্ডকোড করা হলো; admin যদি App-এ minimum amount
// বদলান, এই মানটাও হাতে করে মিলিয়ে বদলে দিতে হবে।
const MIN_WITHDRAW = 5.00;

serve(async (req: Request) => {
  // pg_cron যখন এটাকে কল করবে, তখন একটা secret header/param দিয়ে
  // যাচাই করা হয় যাতে বাইরের কেউ এই endpoint সরাসরি কল করে বার বার
  // সবাইকে স্প্যাম push পাঠাতে না পারে
  const url = new URL(req.url);
  const providedSecret = req.headers.get('x-cron-secret') || url.searchParams.get('secret');
  if (providedSecret !== CRON_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id,fcm_token,usd_earned,notif_prefs')
      .not('fcm_token', 'is', null);

    if (!users?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    // 'balance' ক্যাটাগরির notification বন্ধ রাখা ইউজারদের বাদ দেওয়া
    const eligible = users.filter(u => !u.notif_prefs || u.notif_prefs.balance !== false);

    // প্রতিটা ইউজারের balance অনুযায়ী আলাদা মেসেজ — তাই টোকেনগুলোকে
    // মেসেজ-অনুযায়ী দলে ভাগ করে পাঠানো হচ্ছে (একই মেসেজ যাদের জন্য প্রযোজ্য
    // তাদের একসাথে ব্যাচ করে পাঠানো, API কল কম লাগবে)
    const groups: Record<string, string[]> = { ready: [], partial: [], zero: [] };
    for (const u of eligible) {
      const bal = parseFloat(String(u.usd_earned || 0));
      if (bal >= MIN_WITHDRAW) groups.ready.push(u.fcm_token);
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
      totalSent += result.sent;
      totalFailed += result.failed;
      allBadTokens.push(...result.badTokens);
    }

    if (allBadTokens.length) {
      await supabaseAdmin.from('users').update({ fcm_token: null }).in('fcm_token', allBadTokens);
    }

    console.log(`[daily-reminder] sent=${totalSent} failed=${totalFailed} eligible=${eligible.length}`);
    return new Response(JSON.stringify({ ok: true, sent: totalSent, failed: totalFailed }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
});
