/* ═══════════════════════════════════════════════════════
   EARNZONE PRO — COMPLETE SYSTEM
   Supabase + 7 Languages + 6 Offerwalls + Full Admin
═══════════════════════════════════════════════════════ */

// ─── SUPABASE INIT ──────────────────────────────────────
// ⚠️ SECURITY: anon key is safe to expose in frontend (it's the public key)
// But ALWAYS enable RLS (Row Level Security) in Supabase Dashboard!
// ── SUPABASE CONFIG ── বসাও তোমার Project URL ও anon key ──
const SUPA_URL = 'https://oazyvgjixljdnjhorasa.supabase.co';   // ← তোমার Supabase URL
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9henl2Z2ppeGxqZG5qaG9yYXNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTU2MTAsImV4cCI6MjA5NTUzMTYxMH0.n0iFz71OI0MeFc-ZWgliBDzuhxO-LE0qBIviO4ZhZsU';                       // ← তোমার anon/public key
const sb = supabase.createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'ez_session',
  },
  global: { headers: { 'x-app-version': 'earnzone-v3' } }
});

// ── Supabase Storage ─────────────────────────────────────
const fbStorage = sb.storage;

// (PWA manifest.json inject কোডটা সরানো হয়েছে — এটা শুধু ব্রাউজারে "Add to
// Home Screen" এর জন্য দরকার ছিল। এখন এটা নেটিভ Android App, তাই এই কোড
// অপ্রয়োজনীয় ছিল।)

// ════════════════════════════════════════════════════════
// SUPABASE SETUP — Dashboard → SQL Editor → এই SQL চালাও
// ⚠️ IMPORTANT: atomic_increment function MUST be created
//    for balance operations to be safe (see step 12 below)
// ════════════════════════════════════════════════════════
//
// -- 1. USERS TABLE
// -- IMPORTANT: id = Supabase Auth user UUID (PRIMARY KEY)
// CREATE TABLE IF NOT EXISTS users (
//   id TEXT PRIMARY KEY,        -- ← Supabase Auth UID এটাই
//   uid TEXT,                   -- backward compat (id এর সমান)
//   email TEXT,
//   name TEXT,
//   ref_code TEXT UNIQUE,        -- ⚠️ ফিক্স: UNIQUE যোগ করা হলো — js/db.js
//                                -- এ registration-এর সময় কোড ইউনিক কিনা
//                                -- আগে থেকেই চেক করা হয় (৫ বার চেষ্টা), কিন্তু
//                                -- সেটা শুধু app-লেভেলে, দুইজন ইউজার ঠিক একই
//                                -- মুহূর্তে register করলে তাত্ত্বিকভাবে দুজনেই
//                                -- একই কোড পেয়ে যেতে পারত (referral বোনাস
//                                -- ভুল মানুষকে চলে যাওয়ার ঝুঁকি)। এই UNIQUE
//                                -- constraint Database-লেভেলে সেই শেষ ফাঁকটাও
//                                -- বন্ধ করে দেয় — কোনোভাবে দুটো একই কোড insert
//                                -- হতে গেলে Postgres নিজেই দ্বিতীয়টা আটকে দেবে।
//   referred_by TEXT,
//   lang TEXT DEFAULT 'en',
//   country TEXT DEFAULT '',
//   country_earn NUMERIC DEFAULT 0.30,
//   usd_earned NUMERIC DEFAULT 0,
//   today_earned NUMERIC DEFAULT 0,
//   today_date TEXT DEFAULT '',
//   ads_watched INT DEFAULT 0,
//   offers_completed INT DEFAULT 0,
//   active_referrals INT DEFAULT 0,
//   is_admin BOOLEAN DEFAULT false,
//   banned BOOLEAN DEFAULT false,
//   forgot_used BOOLEAN DEFAULT false,
//   device_id TEXT DEFAULT '',
//   email_verified BOOLEAN DEFAULT false,
//   login_streak INT DEFAULT 0,
//   last_login_date TEXT DEFAULT '',
//   daily_bonus_date TEXT DEFAULT '',
//   wall_progress JSONB DEFAULT '{}',
//   read_notices JSONB DEFAULT '{}',
//   completed_tasks JSONB DEFAULT '{}',
//   social_unlock_at BIGINT DEFAULT 0,
//   created_at TIMESTAMPTZ DEFAULT now()
// );
//
// -- 2. WITHDRAWALS TABLE
// CREATE TABLE IF NOT EXISTS withdrawals (
//   id TEXT PRIMARY KEY,
//   uid TEXT, user_email TEXT, user_name TEXT,
//   method TEXT, account TEXT,
//   amount NUMERIC, status TEXT DEFAULT 'pending',
//   created_at BIGINT
// );
//
// -- 3. SOCIAL_TASKS TABLE
// CREATE TABLE IF NOT EXISTS social_tasks (
//   id TEXT PRIMARY KEY,
//   title TEXT, description TEXT, platform TEXT,
//   link TEXT, reward NUMERIC, whatsapp TEXT,
//   status TEXT DEFAULT 'active',
//   created_at BIGINT
// );
//
// -- 4. SUBMISSIONS TABLE
// CREATE TABLE IF NOT EXISTS submissions (
//   id TEXT PRIMARY KEY,
//   uid TEXT, task_id TEXT, task_title TEXT,
//   reward NUMERIC, status TEXT DEFAULT 'pending',
//   created_at BIGINT
// );
//
// -- 5. NOTICES TABLE
// CREATE TABLE IF NOT EXISTS notices (
//   id TEXT PRIMARY KEY,
//   text TEXT, created_at BIGINT, posted_by TEXT
// );
//
// -- 6. OFFERS TABLE
// CREATE TABLE IF NOT EXISTS offers (
//   id TEXT PRIMARY KEY,
//   uid TEXT, wall_id TEXT,
//   amount NUMERIC, completed_at BIGINT,
//   offer_id TEXT, verified BOOLEAN DEFAULT true
// );
//
// -- 7. SETTINGS TABLE
// CREATE TABLE IF NOT EXISTS settings (
//   id TEXT PRIMARY KEY,
//   data JSONB
// );
//
// -- 8. STATS TABLE
// CREATE TABLE IF NOT EXISTS stats (
//   id TEXT PRIMARY KEY DEFAULT 'stats',
//   total_users INT DEFAULT 0,
//   total_earned NUMERIC DEFAULT 0
// );
// INSERT INTO stats (id) VALUES ('stats') ON CONFLICT DO NOTHING;
//
// -- 9. KYC_SUBMISSIONS TABLE
// ⚠️ ফিক্স: এই টেবিলটা js/admin.js ও js/pages-other.js (submitKYC) এ
// আগে থেকেই ব্যবহার হচ্ছিল, এবং নিচের "admin_full_kyc" policy-ও এটা
// রেফার করছিল — কিন্তু এই টেবিলের schema-ই এখানে লেখা ছিল না। কলাম
// নামগুলো কোডে যা ব্যবহার হয় তার সাথে মিলিয়ে বসানো হলো।
// CREATE TABLE IF NOT EXISTS kyc_submissions (
//   id TEXT PRIMARY KEY,
//   uid TEXT, full_name TEXT, id_number TEXT, user_email TEXT,
//   photo_url TEXT,
//   status TEXT DEFAULT 'pending',
//   created_at BIGINT
// );
// ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "kyc_own_select" ON kyc_submissions FOR SELECT USING (auth.uid()::text = uid);
// CREATE POLICY "kyc_own_insert" ON kyc_submissions FOR INSERT WITH CHECK (auth.uid()::text = uid);
//
// -- 10. ORDERS TABLE
// CREATE TABLE IF NOT EXISTS orders (
//   id TEXT PRIMARY KEY,
//   uid TEXT, status TEXT DEFAULT 'pending',
//   data JSONB, created_at BIGINT
// );
//
// -- ROW LEVEL SECURITY (সব table এ)
// ALTER TABLE users ENABLE ROW LEVEL SECURITY;
// ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
// ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
// ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
// ALTER TABLE social_tasks ENABLE ROW LEVEL SECURITY;
// ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
// ALTER TABLE monthly_awards ENABLE ROW LEVEL SECURITY;
// -- Users can read/write own row:
// CREATE POLICY "users_own" ON users FOR ALL USING (auth.uid()::text = id);
// -- Withdrawals: users can read own, insert own:
// CREATE POLICY "wd_own" ON withdrawals FOR SELECT USING (auth.uid()::text = uid);
// CREATE POLICY "wd_insert" ON withdrawals FOR INSERT WITH CHECK (auth.uid()::text = uid);
// -- Offers: own only
// CREATE POLICY "offers_own" ON offers FOR ALL USING (auth.uid()::text = uid);
// -- Notices, social_tasks: all authenticated can read
// CREATE POLICY "notices_read" ON notices FOR SELECT USING (auth.role()='authenticated');
// CREATE POLICY "tasks_read" ON social_tasks FOR SELECT USING (auth.role()='authenticated');
// -- Submissions: own only
// CREATE POLICY "subs_own" ON submissions FOR ALL USING (auth.uid()::text = uid);
// -- service_role bypasses RLS (admin panel uses this via server-side)
//
// -- 11. MONTHLY_AWARDS TABLE
// CREATE TABLE IF NOT EXISTS monthly_awards (
//   id TEXT PRIMARY KEY,
//   month TEXT,           -- e.g. "2025-01"
//   uid TEXT,
//   user_name TEXT,
//   user_email TEXT,
//   rank INT,             -- 1, 2, or 3
//   earned NUMERIC,       -- total earned that month
//   bonus NUMERIC,        -- award amount
//   status TEXT DEFAULT 'pending',  -- pending/approved/rejected
//   created_at BIGINT,
//   approved_at BIGINT
// );
//
// -- 12. ATOMIC INCREMENT FUNCTION (REQUIRED — run this in SQL Editor)
// CREATE OR REPLACE FUNCTION atomic_increment(
//   p_table TEXT, p_id TEXT, p_field TEXT, p_delta NUMERIC
// ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
// BEGIN
//   EXECUTE format(
//     'UPDATE %I SET %I = GREATEST(0, COALESCE(%I,0) + $1) WHERE id = $2',
//     p_table, p_field, p_field
//   ) USING p_delta, p_id;
// END; $$;
//
// -- GRANT EXECUTE ON FUNCTION atomic_increment TO authenticated;
//
// -- 13. ATOMIC WITHDRAW DEDUCT FUNCTION (⚠️ REQUIRED — db.js এর
//    submitWithdraw() এই ফাংশনটা কল করে ডাবল-স্পেন্ড/রেস-কন্ডিশন ঠেকাতে।
//    এটা না বানালে কোড চুপচাপ কম-নিরাপদ fallback-এ চলে যাবে —
//    দুইটা ডিভাইস/ট্যাব থেকে প্রায় একসাথে withdraw করলে balance ঠিকভাবে
//    না কাটার ঝুঁকি থাকবে। তাই এটা অবশ্যই রান করুন।)
// CREATE OR REPLACE FUNCTION atomic_withdraw_deduct(p_uid TEXT, p_amount NUMERIC)
// RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
// DECLARE
//   new_balance NUMERIC;
// BEGIN
//   -- একটাই UPDATE স্টেটমেন্টে balance চেক ও বিয়োগ একসাথে — Postgres
//   -- নিজেই row-লক করে নিশ্চিত করে দুইটা concurrent রিকোয়েস্ট একসাথে
//   -- সফল হতে পারবে না
//   UPDATE users
//   SET usd_earned = usd_earned - p_amount
//   WHERE id = p_uid AND usd_earned >= p_amount
//   RETURNING usd_earned INTO new_balance;
//
//   RETURN new_balance; -- balance অপর্যাপ্ত হলে NULL রিটার্ন হবে (WHERE না মিললে)
// END; $$;
//
// -- GRANT EXECUTE ON FUNCTION atomic_withdraw_deduct TO authenticated;
//
// -- 14. ATOMIC CLAIM DAILY FUNCTION (⚠️ REQUIRED — "দিনে একবারই" ধরনের
//    ফিচার যেমন Spin Wheel (js/features.js doSpin()) আর Daily Login Bonus
//    (checkDailyBonus()) এটা ব্যবহার করে। আগে এই চেকগুলো শুধু
//    ক্লায়েন্ট-সাইডে (S.userData থেকে) হতো, যেটা একই ইউজার ২টা ডিভাইস/
//    ট্যাব থেকে প্রায় একসাথে করলে দুইবার reward পেয়ে যেতে পারত। এই
//    ফাংশন (atomic_increment এর মতোই generic — যেকোনো টেবিল/ফিল্ডে
//    reuse করা যায়) Postgres-এর row-lock ব্যবহার করে নিশ্চিত করে দিনে
//    একবারই সফল হবে।)
// CREATE OR REPLACE FUNCTION atomic_claim_daily(
//   p_table TEXT, p_id TEXT, p_field TEXT, p_today TEXT
// ) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
// DECLARE
//   claimed BOOLEAN;
// BEGIN
//   EXECUTE format(
//     'UPDATE %I SET %I = $1 WHERE id = $2 AND (%I IS NULL OR %I != $1) RETURNING true',
//     p_table, p_field, p_field, p_field
//   ) INTO claimed USING p_today, p_id;
//   RETURN COALESCE(claimed, false);
// END; $$;
//
// -- GRANT EXECUTE ON FUNCTION atomic_claim_daily TO authenticated;
//
// -- 15. JSONB MERGE KEY FUNCTION (⚠️ REQUIRED — js/admin.js (approveSubmission)
//    আর js/pages-other.js (submitTaskProof) দুটোই এই ফাংশনটা কল করে
//    completed_tasks (JSONB কলাম) এর ভেতরে একটা key নিরাপদে বসাতে।
//    ⚠️⚠️ এই ফাংশনটা আগের ভার্সনে কোডে কল করা হচ্ছিল কিন্তু এখানে SQL
//    definition-টাই লেখা ছিল না — মানে Supabase-এ এই ফাংশন তৈরিই হতো
//    না, ফলে কোড চুপচাপ কম-নিরাপদ fallback (read-modify-write, যেটাতে
//    race condition থেকেই যায়) এ চলে যেত। এখন এটা যোগ করা হলো — এটাও
//    বানাতে ভুলবেন না, নাহলে "একই ইউজার ২টা ভিন্ন টাস্ক প্রায় একসাথে
//    জমা/approve করলে একটা মার্কার হারিয়ে যাওয়া" বাগটা রয়েই যাবে।
//
//    কাজ করে কীভাবে: p_table/p_id/p_field দিয়ে ঠিক কোন row-এর কোন JSONB
//    কলাম বদলাতে হবে সেটা ঠিক করে, তারপর Postgres-এর নিজস্ব jsonb_set()
//    ফাংশন দিয়ে একটাই UPDATE স্টেটমেন্টে (কোনো আলাদা "আগে read করো"
//    ধাপ ছাড়াই) key/value বসিয়ে দেয় — তাই race করার কোনো ফাঁকই থাকে না।
//    ⚠️ p_value ইচ্ছাকৃতভাবে JSONB টাইপ (TEXT না) — কারণ কোডের ২টা
//    জায়গায় ২ রকম টাইপ পাঠানো হয় (admin.js বুলিয়ান `true`, আর
//    pages-other.js স্ট্রিং `'pending'`)। প্যারামিটার TEXT রাখলে
//    Postgres বুলিয়ান true-কে টেক্সট string "true"-তে বদলে ফেলত (ভুল
//    টাইপ), JSONB রাখায় JS থেকে যে টাইপ পাঠানো হয় ঠিক সেই টাইপই
//    (boolean/string/number) অক্ষত থাকে।
// CREATE OR REPLACE FUNCTION jsonb_merge_key(
//   p_table TEXT, p_id TEXT, p_field TEXT, p_key TEXT, p_value JSONB
// ) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
// BEGIN
//   EXECUTE format(
//     'UPDATE %I SET %I = COALESCE(%I, ''{}''::jsonb) || jsonb_build_object($1, $2) WHERE id = $3',
//     p_table, p_field, p_field
//   ) USING p_key, p_value, p_id;
// END; $$;
//
// -- GRANT EXECUTE ON FUNCTION jsonb_merge_key TO authenticated;
//
// -- 16. ATOMIC SLOT CLAIM (⚠️ REQUIRED — js/pages-other.js এর
//    submitTaskProof() এটা কল করে, সীমিত-সিট Social Task-এ "সিট আছে
//    কিনা চেক করা" আর "সিট বুক করা" — এই দুইটা কাজ একটাই atomic ধাপে
//    করার জন্য। ⚠️⚠️ এটা না বানালে: অনেক ইউজার একটা সীমিত-সিটের টাস্কে
//    প্রায় একসাথে Submit করলে, সিট ফাঁকা না থাকা সত্ত্বেও সবাই-ই সফলভাবে
//    submission জমা দিতে পারবে (কারণ কোড fallback পথে পুরনো
//    read-then-write পদ্ধতিতে চলে যাবে, যেখানে race condition থেকেই যায়)
//    — ফলে বেশিরভাগ ইউজারকে পরে reject করতে হবে, তাদের সময়/চেষ্টা বৃথা
//    যাবে। তাই এটা বানাতে ভুলবেন না।
//
//    রিটার্ন করে: সিট সফলভাবে বুক হলে নতুন current_workers সংখ্যা,
//    সিট আগে থেকেই ভর্তি থাকলে NULL (ব্যর্থ) — একটাই UPDATE স্টেটমেন্টে
//    "current_workers < max_workers" শর্ত আর "+1" একসাথে হয় বলে দুইজন
//    ইউজার একসাথে শেষ সিটটা দুইবার claim করতে পারবে না।
// CREATE OR REPLACE FUNCTION atomic_claim_slot(
//   p_table TEXT, p_id TEXT, p_cur_field TEXT, p_max_field TEXT
// ) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
// DECLARE
//   new_val INTEGER;
// BEGIN
//   EXECUTE format(
//     'UPDATE %I SET %I = %I + 1 WHERE id = $1 AND (%I = 0 OR %I < %I) RETURNING %I',
//     p_table, p_cur_field, p_cur_field, p_max_field, p_cur_field, p_max_field, p_cur_field
//   ) INTO new_val USING p_id;
//   RETURN new_val; -- NULL মানে সিট claim ব্যর্থ (টাস্ক আগে থেকেই পূর্ণ)
// END; $$;
//
// -- GRANT EXECUTE ON FUNCTION atomic_claim_slot TO authenticated;
//
// -- REALTIME চালু করো (Dashboard → Database → Replication → সব table ON)
// ════════════════════════════════════════════════════════

// ─── CONFIG ───────────────────────────────────────────
const CFG = {
  adSec:8, adsPerWall:4, unlock24h:86400000, adGapMs:1000, refBonus:0.05,
  // ── Daily Spin Wheel — প্রতিটা prize-এর সাথে একটা "weight" আছে, যেটা
  //    দিয়ে বোঝা যায় কতটা সহজে সেই prize আসবে (weight যত বেশি, তত বেশি
  //    সম্ভাবনা)। মোট ৮টা স্লট (চাকায় ৮ ভাগ দেখাবে)। চাইলে amount/weight
  //    বদলে নিজের মতো prize বসাতে পারেন — যোগফল ১০০ হওয়ার দরকার নেই,
  //    আপেক্ষিক অনুপাত হিসেবে কাজ করে।
  spinPrizes: [
    { amount:0.01, weight:30, color:'#94a3b8' },
    { amount:0.02, weight:25, color:'#60a5fa' },
    { amount:0.05, weight:20, color:'#34d399' },
    { amount:0.03, weight:12, color:'#fbbf24' },
    { amount:0.10, weight:7,  color:'#f472b6' },
    { amount:0.01, weight:3,  color:'#94a3b8' },
    { amount:0.20, weight:2,  color:'#a78bfa' },
    { amount:0.50, weight:1,  color:'#fb923c' },
  ],
  get minUSD(){ return parseInt(localStorage.getItem('ez_minUSD')||'5'); },
  get minRefs(){ return parseInt(localStorage.getItem('ez_minRefs')||'5'); },
  maxDevAcc:2,
  // 🪪 এই পরিমাণের বেশি withdraw করতে গেলে KYC (identity verification)
  // approved থাকা লাগবে — জালিয়াতি/মানি-লন্ডারিং রোধে ছোট withdraw-এ
  // বাধ্যতামূলক না রেখে শুধু বড় অঙ্কে verification চাওয়া হচ্ছে
  kycThreshold: 20,
  // ⚠️ Adsterra smartLink সরিয়ে ফেলা হয়েছে — "ভিডিও দেখে আয়" এখন নেটিভ APK-তে
  // AdMob Rewarded Video দিয়ে চলে (নিচে startAd() ফাংশন দেখুন, showRewardedAd() কল করে)।
  // ব্রাউজারে প্রিভিউ/টেস্টের সময় fallback হিসেবে এই লিংকটা ব্যবহার হয় (চাইলে বদলে দিন):
  smartLink:'about:blank',
  offerwallLink:'',   // ← Admin এখানে offerwall iframe/link URL বসাবেন অথবা Admin Panel থেকে set করবেন
  rssProxy:'https://api.allorigins.win/raw?url=',
  earnCountry:{BD:.10,IN:.10,PK:.10,NG:.10,GH:.12,PH:.12,EG:.12,KE:.12},
  earnHi:.50, earnDef:.30,
  hiCC:['US','GB','CA','AU','DE','FR','NL','SE','NO','DK','CH','AT','SG','JP','NZ','IE'],
  // BD = bKash + Nagad only | others = PayPal, Bank, USDT, Payoneer
  methodsByCountry:{
    BD:['bkash','nagad','binance','wise'],
    default:['visa','payoneer','binance','usdt','wise']
  },
  methods:['bkash','nagad','visa','payoneer','binance','usdt','wise'],
  methodEmoji:{
    bkash:'bKash',
    nagad:'Nagad',
    paypal:'PayPal',
    bank:'Bank Transfer',
    visa:'Visa Card',
    usdt:'USDT (TRC20)',
    payoneer:'Payoneer',
    opay:'OPay',
    binance:'Binance Pay',
    wise:'Wise',
  },
  methodLogo:{
    bkash:`<span class="pml-wrap"><img src="bkash.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">bKash</span></span>`,
    nagad:`<span class="pml-wrap"><img src="nagad.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">Nagad</span></span>`,
    paypal:`<span class="pml-wrap"><img src="paypal.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">PayPal</span></span>`,
    bank:`<span class="pml-wrap"><img src="bank.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">Bank</span></span>`,
    visa:`<span class="pml-wrap"><img src="visa.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">Visa</span></span>`,
    usdt:`<span class="pml-wrap"><img src="usdt.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">USDT</span></span>`,
    payoneer:`<span class="pml-wrap"><img src="payoneer.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">Payoneer</span></span>`,
    opay:`<span class="pml-wrap"><img src="opay.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">OPay</span></span>`,
    binance:`<span class="pml-wrap"><img src="binance.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">Binance</span></span>`,
    wise:`<span class="pml-wrap"><img src="wise.png" class="pml-img" onerror="this.style.display='none'"><span class="pml-name">Wise</span></span>`,
  },
  
  // Admin Panel-এ Manual Offer add করার সময় country checkbox দেখানোর জন্য —
  // চাইলে এই লিস্টে আরও দেশ যোগ/বাদ দেওয়া যাবে
  countryList:[
    {code:'BD',name:'Bangladesh',flag:'🇧🇩'},
    {code:'IN',name:'India',flag:'🇮🇳'},
    {code:'PK',name:'Pakistan',flag:'🇵🇰'},
    {code:'US',name:'USA',flag:'🇺🇸'},
    {code:'UK',name:'UK',flag:'🇬🇧'},
    {code:'CA',name:'Canada',flag:'🇨🇦'},
    {code:'AU',name:'Australia',flag:'🇦🇺'},
    {code:'NG',name:'Nigeria',flag:'🇳🇬'},
    {code:'PH',name:'Philippines',flag:'🇵🇭'},
    {code:'ID',name:'Indonesia',flag:'🇮🇩'},
    {code:'BR',name:'Brazil',flag:'🇧🇷'},
    {code:'DE',name:'Germany',flag:'🇩🇪'},
    {code:'FR',name:'France',flag:'🇫🇷'},
    {code:'ES',name:'Spain',flag:'🇪🇸'},
    {code:'MX',name:'Mexico',flag:'🇲🇽'},
    {code:'TR',name:'Turkey',flag:'🇹🇷'},
    {code:'EG',name:'Egypt',flag:'🇪🇬'},
    {code:'VN',name:'Vietnam',flag:'🇻🇳'},
  ],
  // ── প্রতিটা wall/network subid এর জন্য ভিন্ন parameter নাম চাইতে পারে ──
  // ডিফল্ট 'subid' থাকবে, কিন্তু কোনো network অন্য নাম (যেমন aff_sub, s1,
  // clickid) চাইলে সেই wall-এর সামনে বদলে দিন — CPA network-এর
  // নিজস্ব ডকুমেন্টেশন/গাইড পেজে এই parameter নামটা লেখা থাকে
  wallSubidParam:{
    w1:'subid',  w2:'subid',  w3:'subid',  w4:'subid',  w5:'subid',
    w6:'subid',  w7:'subid',  w8:'subid',  w9:'subid',  w10:'subid',
    w11:'subid', w12:'subid', w13:'subid', w14:'subid', w15:'subid',
    w16:'subid', w17:'subid', w18:'subid', w19:'subid', w20:'subid',
  },
  socialLogo:{
    facebook:'facebook.png',
    youtube:'youtube.png',
    instagram:'instagram.png',
    twitter:'twitter.png',
    telegram:'telegram.png',
    tiktok:'tiktok.png',
  },
  
  // ══════════════════════════════════════════════════════════════
  // WALL TAB — প্রতিটা wall card এর নাম/আইকন/রং এখানে ঠিক করা,
  // আর iframe link `wallLinks` অবজেক্টে বসান (নিচে) — সম্পূর্ণ কোড থেকে,
  // কোনো ডাটাবেজ কল ছাড়াই। যে wall-এর link খালি ('') থাকবে,
  // সেই কার্ড Wall ট্যাবে দেখাবে না — link বসালেই সাথে সাথে দেখাবে।
  // ══════════════════════════════════════════════════════════════
  walls:[
    {id:'w1',  name:'CPAGrip Offers',   icon:'🔥', color:'#ef4444'},
    {id:'w2',  name:'OGAds Offers',     icon:'📱', color:'#8b5cf6'},
    {id:'w3',  name:'AdGate Offers',    icon:'🎯', color:'#2563eb'},
    {id:'w4',  name:'MyLead Offers',    icon:'⭐', color:'#f59e0b'},
    {id:'w5',  name:'Adscend Offers',   icon:'💚', color:'#10b981'},
    {id:'w6',  name:'Premium Offers',   icon:'👑', color:'#ec4899'},
    {id:'w7',  name:'CPAlead Offers',   icon:'🚀', color:'#2563eb'},
    {id:'w8',  name:'OfferToro Offers', icon:'💎', color:'#8b5cf6'},
    {id:'w9',  name:'Lootably Offers',  icon:'🎁', color:'#f59e0b'},
    {id:'w10', name:'RevUniv Offers',   icon:'💰', color:'#10b981'},
    {id:'w11', name:'AyetStudios Offers',icon:'🎮', color:'#ef4444'},
    {id:'w12', name:'Wannads Offers',   icon:'📢', color:'#ec4899'},
    {id:'w13', name:'TimeWall Offers',  icon:'⏱️', color:'#2563eb'},
    {id:'w14', name:'KiwiWall Offers',  icon:'🥝', color:'#10b981'},
    {id:'w15', name:'Monlix Offers',    icon:'💵', color:'#f59e0b'},
    {id:'w16', name:'TapRain Offers',   icon:'☔', color:'#8b5cf6'},
    {id:'w17', name:'OfferWall Offers', icon:'🌐', color:'#2563eb'},
    {id:'w18', name:'Info Wall Offers', icon:'📋', color:'#ec4899'},
    {id:'w19', name:'AdWeb Offers',     icon:'🖥️', color:'#ef4444'},
    {id:'w20', name:'Wall.com Offers',  icon:'🏆', color:'#f59e0b'},
  ],
  // ── এখানে প্রতিটা wall এর iframe লিংক বসান — খালি রাখলে সেই কার্ড দেখাবে না ──
  wallLinks:{
    w1:'https://www.cdnflyer.com/wall/ve9REAQP',  w2:'',  w3:'',  w4:'',  w5:'',
    w6:'',  w7:'',  w8:'',  w9:'',  w10:'',
    w11:'', w12:'', w13:'', w14:'', w15:'',
    w16:'', w17:'', w18:'', w19:'', w20:'',
  },
};

// ══════════════════════════════════════════════════════════
// 🛡️ SECURITY — HTML escaping helper
// ══════════════════════════════════════════════════════════
// ⚠️ গুরুত্বপূর্ণ ফিক্স (Stored XSS): user-এর দেওয়া টেক্সট (name, email,
// withdrawal account, order form ইত্যাদি) আগে সরাসরি innerHTML-এ বসানো
// হতো — কেউ name হিসেবে "<img src=x onerror=...>" টাইপ কিছু দিয়ে
// রেজিস্টার করলে সেটা Leaderboard/Admin panel/নিজের প্রোফাইলে render
// হওয়ার সময় স্ক্রিপ্ট হিসেবে রান হয়ে যেতে পারত (অন্য ইউজার বা Admin-এর
// ব্রাউজারে)। এই ফাংশন দিয়ে wrap করলে < > & " ' এই character গুলো
// HTML entity তে বদলে যায়, তাই টেক্সট হিসেবেই দেখাবে, কোড হিসেবে রান হবে না।
// ব্যবহার: user-এর দেওয়া যেকোনো টেক্সট innerHTML/attribute-এ বসানোর আগে
// escapeHtml() দিয়ে wrap করুন — যেমন ${escapeHtml(u.name)}
function escapeHtml(str){
  if(str===null || str===undefined) return '';
  return String(str).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

// ════════════════════════════════════════════════════════
// 🛡️ SUPABASE — ADMIN রাইট প্রোটেকশন (Supabase Dashboard → SQL Editor এ চালান)
// ════════════════════════════════════════════════════════
// ⚠️ কেন দরকার: js/admin.js থেকে ban/unban, admin বানানো/সরানো, user
// delete, withdrawal approve/reject — এসব সরাসরি browser থেকে (anon key
// দিয়ে) হয়। S.userData.isAdmin===true চেকটা শুধু UI-তে বাটন দেখায়/লুকায়,
// এটা real security না — browser DevTools থেকে যে কেউ সরাসরি একই
// Supabase API কল করতে পারে। নিচের ধাপগুলো (RLS policy + একটা protective
// trigger) না থাকলে হয় Admin panel-ই কাজ করবে না (RLS strict থাকলে), নয়তো
// RLS আসলে বন্ধ/permissive থাকলে যে কেউ নিজেকে admin বানিয়ে ফেলতে পারবে বা
// নিজের balance বাড়িয়ে ফেলতে পারবে।
//
// ধাপ ১ — Admin চেক করার জন্য একটা SECURITY DEFINER ফাংশন বানান।
// (⚠️ সরাসরি policy-র ভেতরে "SELECT ... FROM users" লিখলে Postgres
//  "infinite recursion detected in policy for relation users" এরর
//  দেয়, কারণ users টেবিলের policy নিজেই users টেবিল query করছে। এই
//  ফাংশনটা SECURITY DEFINER হওয়ায় ভেতরের SELECT RLS-এর বাইরে চলে,
//  তাই recursion হয় না — এটাই Supabase-এর অফিসিয়াল রেকমেন্ডেড প্যাটার্ন।)
//
// CREATE OR REPLACE FUNCTION public.is_admin_user()
// RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
//   SELECT COALESCE((SELECT is_admin FROM users WHERE id = auth.uid()::text), false);
// $$;
//
// ধাপ ২ — Admin-দের জন্য প্রতিটা admin-touch করা টেবিলে ফুল অ্যাক্সেস।
// (এটা users_own/wd_own policy-র *পাশাপাশি* যোগ হবে, বাদ দেবে না —
//  Postgres-এ একাধিক permissive policy থাকলে যেকোনো একটা মিললেই চলে):
//
// CREATE POLICY "admin_full_users"        ON users            FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
// CREATE POLICY "admin_full_withdrawals"  ON withdrawals      FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
// CREATE POLICY "admin_full_kyc"          ON kyc_submissions  FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
// CREATE POLICY "admin_full_submissions"  ON submissions      FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
// CREATE POLICY "admin_full_social_tasks" ON social_tasks     FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
// CREATE POLICY "admin_full_stats"        ON stats            FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
// CREATE POLICY "admin_full_orders"       ON orders           FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
// CREATE POLICY "admin_read_error_logs"   ON error_logs FOR SELECT USING (is_admin_user());
// CREATE POLICY "admin_delete_error_logs" ON error_logs FOR DELETE USING (is_admin_user());
// -- error_logs-এর INSERT সবার জন্য খোলা থাকে (লগইন করার আগেও এরর হতে পারে,
// -- যেমন লগইন পেজেই কোনো JS crash) — এই policy js/analytics.js এর কমেন্টে আছে।
//
// ধাপ ৩ — সবচেয়ে গুরুত্বপূর্ণ অংশ: normal ইউজার যাতে নিজের is_admin/
// banned/usd_earned/today_earned/kyc_status নিজে বদলাতে না পারে (নাহলে
// কেউ নিজেকে admin বানিয়ে ফেলতে পারবে বা balance বাড়িয়ে ফেলতে পারবে)।
// এটা RLS দিয়ে করা জটিল ও ভুল হওয়ার ঝুঁকি বেশি (একই recursion সমস্যা),
// তাই এর বদলে একটা BEFORE UPDATE trigger দিয়ে column-level protect করা
// — admin/service_role ছাড়া কেউ এই column গুলো বদলাতে চাইলে চুপচাপ
// পুরনো ভ্যালুতেই ফিরিয়ে দেবে:
//
// CREATE OR REPLACE FUNCTION public.protect_sensitive_user_fields()
// RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
// BEGIN
//   IF auth.role() = 'service_role' OR public.is_admin_user() THEN
//     RETURN NEW; -- admin/service_role সব বদলাতে পারবে
//   END IF;
//   NEW.is_admin     := OLD.is_admin;
//   NEW.banned       := OLD.banned;
//   NEW.usd_earned   := OLD.usd_earned;
//   NEW.today_earned := OLD.today_earned;
//   NEW.kyc_status   := OLD.kyc_status;
//   RETURN NEW;
// END;
// $$;
//
// CREATE TRIGGER trg_protect_sensitive_user_fields
// BEFORE UPDATE ON users
// FOR EACH ROW EXECUTE FUNCTION public.protect_sensitive_user_fields();
//
// ⚠️ নোট: এই SQL একটা staging/টেস্ট Supabase প্রজেক্টে আগে চালিয়ে
// যাচাই করে নেওয়া ভালো — লাইভ ডেটাবেসে সরাসরি না চালিয়ে।
