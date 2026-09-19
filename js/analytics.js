// ══════════════════════════════════════════════════════════
// FIREBASE ANALYTICS — ইউজার আচরণ ট্র্যাক করার জন্য
// ══════════════════════════════════════════════════════════
// ⚠️ push.js এর FCM_CONFIG-এর সাথে হুবহু একই মান বসান (একই Firebase প্রজেক্ট)।
// measurementId আলাদাভাবে লাগবে — Firebase Console → Project settings →
// General → "Your apps" → Web app → measurementId (analytics enable করা থাকলে)
const ANALYTICS_CONFIG = {
  apiKey: 'PASTE_YOUR_FIREBASE_API_KEY_HERE',
  authDomain: 'PASTE_YOUR_PROJECT.firebaseapp.com',
  projectId: 'PASTE_YOUR_PROJECT_ID',
  storageBucket: 'PASTE_YOUR_PROJECT.appspot.com',
  messagingSenderId: 'PASTE_YOUR_SENDER_ID',
  appId: 'PASTE_YOUR_FIREBASE_APP_ID',
  measurementId: 'PASTE_YOUR_MEASUREMENT_ID_HERE',
};

let _analytics = null;
(function initAnalytics(){
  try{
    if(typeof firebase === 'undefined') return;
    // ⚠️ push.js-ও আলাদাভাবে firebase.initializeApp() কল করে (FCM এর জন্য) —
    // একই default app দু'বার initialize করলে Firebase error দেয়, তাই
    // এখানে ও push.js দুই জায়গাতেই আগে চেক করা হয় app আগে থেকে আছে কিনা
    if(!firebase.apps.length){ firebase.initializeApp(ANALYTICS_CONFIG); }
    if(firebase.analytics){ _analytics = firebase.analytics(); }
  }catch(e){ console.warn('Analytics init failed', e); }
})();

// ── কেন্দ্রীয় ইভেন্ট ট্র্যাকিং — App-এর যেকোনো জায়গা থেকে কল করা যাবে ──
// ব্যবহার: trackEvent('offer_open', {wall_id:'offerwall'})
function trackEvent(name, params={}){
  try{
    if(_analytics) _analytics.logEvent(name, params);
  }catch(e){ /* Analytics fail করলেও App-এর মূল কাজে যেন কোনো প্রভাব না পড়ে */ }
}


// ══════════════════════════════════════════════════════════
// ERROR LOGGING (Crashlytics-এর বিকল্প — Supabase-ভিত্তিক)
// ══════════════════════════════════════════════════════════
// কেন native Firebase Crashlytics না করে এভাবে: Crashlytics বসাতে
// android/ ফোল্ডারের build.gradle-এ native পরিবর্তন লাগে, যেটা প্রতিবার
// `cap add android` চালানোর পর আবার হারিয়ে যায় (android/ ফোল্ডার
// প্রতি বিল্ডে নতুন করে জেনারেট হয়)। তার বদলে এই সহজ ও নির্ভরযোগ্য
// পদ্ধতি — যেকোনো unhandled error/crash সরাসরি আপনার Supabase-এ
// (error_logs টেবিলে) জমা হয়, Admin panel থেকে দেখা যাবে।
//
// ⚠️ Supabase-এ এই টেবিলটা বানাতে হবে (SQL Editor-এ রান করুন):
//   create table error_logs (
//     id bigint generated always as identity primary key,
//     message text, source text, line int, stack text,
//     user_id text, platform text, app_version text,
//     created_at timestamptz default now()
//   );
//   alter table error_logs enable row level security;
//   -- যে কেউ (এমনকি লগইন না করা ইউজারও) নিজের এরর জমা দিতে পারবে —
//   -- SELECT/DELETE শুধু Admin-এর জন্য (js/config.js এর
//   -- "admin_read_error_logs" / "admin_delete_error_logs" policy দেখুন)
//   create policy "anyone_insert_error_logs" on error_logs for insert with check (true);
//
// Admin panel-এ দেখতে/মুছতে: Admin panel → 🐞 Error Logs ট্যাব (js/admin.js
// এর loadAdminErrorLogs ফাংশন)

async function logClientError(message, source, line, stack){
  try{
    await sb.from('error_logs').insert({
      message: String(message||'').slice(0,500),
      source: String(source||'').slice(0,300),
      line: line||0,
      stack: String(stack||'').slice(0,2000),
      user_id: (typeof S!=='undefined' && S.user?.uid) || null,
      platform: (window.Capacitor?.getPlatform?.() || 'web'),
      app_version: 'v3',
    });
  }catch(e){ /* লগিং নিজেই fail করলে silent থাকা — infinite error loop রোধ করতে */ }
}

// সব ধরা-না-পড়া JS error স্বয়ংক্রিয়ভাবে ধরে ফেলবে
window.addEventListener('error', (e)=>{
  logClientError(e.message, e.filename, e.lineno, e.error?.stack);
});
// Promise reject হয়ে .catch() না থাকলে সেটাও ধরবে
window.addEventListener('unhandledrejection', (e)=>{
  logClientError('UnhandledPromiseRejection: '+(e.reason?.message||e.reason), '', 0, e.reason?.stack);
});
