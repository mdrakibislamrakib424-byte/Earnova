# EARNOVA — Push Notification (Supabase Edge Functions দিয়ে, কার্ড ছাড়াই)

এই গাইডটা তখনই লাগবে যখন Firebase Blaze প্ল্যান (যেটার জন্য কার্ড লাগে) ব্যবহার
করতে চান না। এখানে push পাঠানোর কাজ **Supabase Edge Function**-এ বসানো
হয়েছে — এটা **সম্পূর্ণ ফ্রি, কোনো কার্ড লাগে না**।

⚠️ **এখনও Firebase প্রজেক্ট লাগবে** — কিন্তু শুধু একটা "চাবি" (Service
Account Key) নেওয়ার জন্য, কোনো কোড deploy করার জন্য না। এটা নেওয়া সম্পূর্ণ
ফ্রি, Blaze প্ল্যানের সাথে এর কোনো সম্পর্ক নেই।

---

## ধাপ ১ — Firebase Service Account Key নিন (ফ্রি, কার্ড লাগবে না)

1. [console.firebase.google.com](https://console.firebase.google.com) → আপনার প্রজেক্ট খুলুন
2. ⚙️ (Settings আইকন) → **Project settings**
3. ওপরে **"Service accounts"** ট্যাবে ক্লিক করুন
4. নিচের দিকে **"Generate new private key"** বাটনে ক্লিক করুন
5. একটা `.json` ফাইল ডাউনলোড হবে — এটাই আপনার **Service Account Key**, সেভ করে রাখুন

এই ফাইলের ভেতরে `project_id`, `client_email`, `private_key` — এই ৩টা জিনিস
থাকবে, যেগুলো এখনই লাগবে Supabase-এ Secret হিসেবে বসাতে।

---

## ধাপ ২ — Supabase CLI ইনস্টল করুন

### 💻 কম্পিউটার থাকলে:
```bash
npm install -g supabase
```

### 📱 শুধু ফোন থাকলে (Termux দিয়ে):
Play Store বা F-Droid থেকে **Termux** অ্যাপ ইনস্টল করুন, তারপর:
```bash
pkg update && pkg upgrade
pkg install nodejs-lts
npm install -g supabase
```
⚠️ যদি `supabase` কমান্ড ইনস্টল করতে গিয়ে error দেয় (কিছু Android ডিভাইসে
হতে পারে), বিকল্প হিসেবে Supabase-এর standalone binary ব্যবহার করুন:
```bash
pkg install wget
wget https://github.com/supabase/cli/releases/latest/download/supabase_linux_arm64.tar.gz
tar -xzf supabase_linux_arm64.tar.gz
chmod +x supabase
./supabase --version   # কাজ করছে কিনা টেস্ট করুন
```

---

## ধাপ ৩ — Supabase-এ লগইন ও প্রজেক্ট লিংক করুন

```bash
supabase login
```
এটা একটা লিংক দেখাবে — ব্রাউজারে খুলে Supabase account দিয়ে অনুমতি দিন।

তারপর এই প্রজেক্ট ফোল্ডারের ভেতরে গিয়ে (যেখানে `supabase/` ফোল্ডার আছে):
```bash
supabase link --project-ref oazyvgjixljdnjhorasa
```
(⚠️ `oazyvgjixljdnjhorasa` — এটা আপনার আসল Supabase URL থেকে নেওয়া,
`supabase/config.toml` ফাইলে আগে থেকেই বসানো আছে। যদি Supabase URL বদলে
থাকে, নতুন project-ref বসান।)

---

## ধাপ ৪ — Secrets সেট করুন

```bash
supabase secrets set SUPA_URL=https://oazyvgjixljdnjhorasa.supabase.co
supabase secrets set SUPA_SERVICE_ROLE_KEY=আপনার_service_role_key
supabase secrets set ADMIN_SECRET=নিজের_বানানো_লম্বা_র‍্যান্ডম_স্ট্রিং
supabase secrets set CRON_SECRET=আরেকটা_আলাদা_লম্বা_র‍্যান্ডম_স্ট্রিং
supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat path/to/serviceAccountKey.json)"
```

**কোথা থেকে এই মানগুলো পাবেন:**
- `SUPA_SERVICE_ROLE_KEY` → Supabase Dashboard → Settings → API → **"service_role"** key (⚠️ anon key না)
- `ADMIN_SECRET` → নিজে যেকোনো লম্বা কঠিন র‍্যান্ডম স্ট্রিং লিখুন (এটাই `js/push.js`-এর `FCM_ADMIN_SECRET`-এও বসবে, দুটো জায়গায় **হুবহু এক**)
- `CRON_SECRET` → আরেকটা আলাদা র‍্যান্ডম স্ট্রিং (ADMIN_SECRET থেকে আলাদা রাখুন)
- `FIREBASE_SERVICE_ACCOUNT` → ধাপ ১-এ ডাউনলোড করা `.json` ফাইলের **পুরো কনটেন্ট**

---

## ধাপ ৫ — Functions Deploy করুন

```bash
supabase functions deploy send-push
supabase functions deploy daily-reminder
```

Deploy শেষে URL পাবেন এরকম:
```
https://oazyvgjixljdnjhorasa.supabase.co/functions/v1/send-push
```
এটা কপি করে বসান `js/push.js`-এর `FCM_SEND_ENDPOINT`-এ, আর `ADMIN_SECRET`
(ধাপ ৪-এ যা বসিয়েছিলেন) বসান `FCM_ADMIN_SECRET`-এ।

---

## ধাপ ৬ — প্রতিদিন Auto-Reminder চালু করুন (pg_cron)

Supabase Dashboard → SQL Editor → এই SQL রান করুন (একবারই):

```sql
-- pg_cron ও pg_net এক্সটেনশন চালু করা (একবারই লাগবে)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- প্রতিদিন রাত ৮টায় (UTC সময়ে, বাংলাদেশ সময় থেকে ৬ ঘণ্টা কম হিসাব করুন)
-- daily-reminder ফাংশনকে কল করবে
select cron.schedule(
  'daily-balance-reminder',
  '0 14 * * *',  -- UTC 14:00 = বাংলাদেশ সময় রাত ৮টা (BST = UTC+6)
  $$
  select net.http_post(
    url := 'https://oazyvgjixljdnjhorasa.supabase.co/functions/v1/daily-reminder',
    headers := jsonb_build_object('x-cron-secret', 'আপনার_CRON_SECRET_এখানে_বসান'),
    body := '{}'::jsonb
  );
  $$
);
```

⚠️ `আপনার_CRON_SECRET_এখানে_বসান` জায়গায় ধাপ ৪-এ যে `CRON_SECRET` বসিয়েছিলেন সেটা বসান।

---

## ধাপ ৭ — টেস্ট করুন

```bash
curl -X POST https://oazyvgjixljdnjhorasa.supabase.co/functions/v1/send-push \
  -H "Content-Type: application/json" \
  -d '{"secret":"আপনার_ADMIN_SECRET","target":"user","uid":"একটা টেস্ট ইউজারের UID","title":"টেস্ট","body":"এটা একটা টেস্ট push","category":"general"}'
```
ফোনে push এলে বুঝবেন সব ঠিকমতো সেট হয়েছে।

---

## ✅ এই পদ্ধতিতে যা যা সুবিধা
- **কোনো কার্ড লাগে না** — সম্পূর্ণ Supabase-এর ফ্রি প্ল্যানে চলে
- App-এ পৌঁছানো push এর মান/গতি **আগের মতোই** — একই Google FCM ব্যবহার হয়
- Termux দিয়েই পুরো সেটআপ সম্ভব, আলাদা কম্পিউটার লাগে না

## ⚠️ সীমাবদ্ধতা যা জানা দরকার
- `daily-reminder`-এর মধ্যে minimum withdrawal amount ($5) হার্ডকোড করা —
  App-এ admin panel থেকে এই amount বদলালে, এই ফাইলেও (`supabase/functions/daily-reminder/index.ts`) হাতে করে বদলাতে হবে
- FCM HTTP v1 API-তে একসাথে multicast নেই (Firebase Admin SDK-তে যেমন ছিল),
  তাই বড় সংখ্যক ইউজার (কয়েক হাজার+) থাকলে ব্যাচ-ভিত্তিক পাঠানোয় কিছুটা বেশি
  সময় লাগতে পারে — কয়েকশ ইউজার পর্যন্ত এটা কোনো সমস্যা না
