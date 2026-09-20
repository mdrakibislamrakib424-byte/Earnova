const ADMOB_APP_ID              = 'ca-app-pub-1093580583332518~8050365428';               // ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
const ADMOB_BANNER_UNIT_ID      = 'ca-app-pub-1093580583332518/6049878887';     // ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY
const ADMOB_INTERSTITIAL_UNIT_ID= 'ca-app-pub-1093580583332518/3122217233';
const ADMOB_REWARDED_UNIT_ID    = 'ca-app-pub-1093580583332518/2769109424';
// টেস্টের জন্য Google-এর অফিসিয়াল টেস্ট ID ব্যবহার করতে পারেন যতক্ষণ না নিজের ID বসান:
// banner: ca-app-pub-3940256099942544/6300978111
// interstitial: ca-app-pub-3940256099942544/1033173712
// rewarded: ca-app-pub-3940256099942544/5224354917

(async function initAdMob(){
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if(!isNative || !window.Capacitor?.Plugins?.AdMob) return; // ব্রাউজারে AdMob লোড হয় না, স্বাভাবিক
  try{
    const { AdMob } = window.Capacitor.Plugins;
    await AdMob.initialize({ requestTrackingAuthorization: true, testingDevices: [], initializeForTesting: false });
    // ⚠️ ফিক্স: BOTTOM_CENTER-এ রাখলে App-এর নিজের bottom navigation bar
    // (Home/Wallet/Offers ইত্যাদি বাটন) ব্যানারের নিচে ঢাকা পড়ে যেত,
    // ইউজার নেভিগেট করতে পারত না। তাই TOP_CENTER-এ সরানো হলো।
    await AdMob.showBanner({
      adId: ADMOB_BANNER_UNIT_ID,
      adSize: 'ADAPTIVE_BANNER',
      position: 'TOP_CENTER',
      margin: 0,
    });
  }catch(e){ console.warn('AdMob banner failed', e); }
})();

// ── ইন্টারস্টিশিয়াল অ্যাড দেখানোর হেল্পার — অফার/উইথড্র/লগইন/রেজিস্টার/পেজ-এন্ট্রি সব জায়গা থেকে কল হয় ──
// ⚠️ গুরুত্বপূর্ণ: এই ফাংশন S (অ্যাপের state) বা DOM-এর কোনো ইনপুট/ফর্ম ভ্যালু
// টাচ করে না। AdMob interstitial নেটিভ ওয়েবভিউয়ের উপরে একটা ওভারলে হিসেবে
// দেখায় — ওয়েবভিউ রিলোড হয় না, তাই ইউজার যেই স্ক্রিনে/ফর্মে ছিল, অ্যাড বন্ধ
// হওয়ার পর সে ঠিক সেখান থেকেই আবার কাজ চালিয়ে যেতে পারে, কিছু হারায় না।
// এই ফাংশন await করলে ad বন্ধ হওয়া পর্যন্ত অপেক্ষা করে, তারপর caller পরের
// ধাপে (যেমন পরের পেজে navigate) যায়।
// ⚠️ ফিক্স: একাধিক সিস্টেম (page-entry / প্রতি ২.৫ মিনিটে auto / login-register-
// withdraw সফল হওয়ার পর) একই সময়ে কল করলে ২টা Ad একসাথে/কাছাকাছি সময়ে
// দেখানোর চেষ্টা হতে পারত (যেমন কেউ ঠিক যে মুহূর্তে auto-timer ফায়ার হলো
// সেই মুহূর্তেই নতুন পেজে গেল)। এখন একটা shared cooldown guard আছে — একবার
// Ad দেখানোর ৯০ সেকেন্ডের মধ্যে আবার কল হলে সেটা চুপচাপ স্কিপ হয়ে যাবে।
let _lastInterstitialAt = 0;
const INTERSTITIAL_MIN_GAP_MS = 90*1000;
async function showInterstitialAd(){
  if(!window.Capacitor?.Plugins?.AdMob) return; // ব্রাউজার/PWA প্রিভিউতে AdMob নেই, চুপচাপ স্কিপ
  if(Date.now() - _lastInterstitialAt < INTERSTITIAL_MIN_GAP_MS) return; // খুব কাছাকাছি সময়ে আবার Ad চাওয়া হয়েছে, স্কিপ
  _lastInterstitialAt = Date.now();
  try{
    const { AdMob } = window.Capacitor.Plugins;
    await AdMob.prepareInterstitial({ adId: ADMOB_INTERSTITIAL_UNIT_ID });
    await AdMob.showInterstitial();
  }catch(e){ console.warn('AdMob interstitial failed', e); }
}

// ── অটো ইন্টারস্টিশিয়াল — অ্যাপের ভিতরে প্রতি ২.৫ মিনিট পরপর অটোমেটিক অ্যাড ──
// লগইনের পর setupListeners() থেকে শুরু হয়, লগআউট হলে বন্ধ হয়ে যায়।
const AUTO_INTERSTITIAL_MS = 2.5 * 60 * 1000; // ২.৫ মিনিট
let autoInterstitialTimer_ = null;
function startAutoInterstitialLoop(){
  stopAutoInterstitialLoop();
  autoInterstitialTimer_ = setInterval(()=>{
    if(!S.user) return;               // লগআউট থাকলে অ্যাড দেখাবে না
    if(S.adActive) return;            // rewarded ad চলাকালীন ওভারল্যাপ এড়াতে
    showInterstitialAd();             // fire-and-forget — ইউজারের চলমান কাজে কোনো বাধা/রিসেট হয় না
  }, AUTO_INTERSTITIAL_MS);
}
function stopAutoInterstitialLoop(){
  if(autoInterstitialTimer_){ clearInterval(autoInterstitialTimer_); autoInterstitialTimer_ = null; }
}

// ── পেজে ঢোকার সময় ইন্টারস্টিশিয়াল — প্রতিটা পেজে প্রথমবার ঢোকার সময় একটা
//    অ্যাড দেখাবে, তারপর সেই পেজে ঢুকবে। একই পেজে ৪৫ মিনিটের মধ্যে আবার
//    ঢুকলে (বের হয়ে আবার ঢুকলেও) নতুন করে অ্যাড দেখাবে না — ৪৫ মিনিট পার
//    হওয়ার পর পরের বার ঢুকলে আবার অ্যাড দেখাবে। navTo() (js/app-events.js)
//    থেকে কল হয়।
const PAGE_ENTRY_AD_COOLDOWN_MS = 45 * 60 * 1000; // ৪৫ মিনিট
// এই পেজগুলোর নিজস্ব আলাদা অ্যাড-ফ্লো আগে থেকেই আছে (unlock/wallframe রিওয়ার্ডেড
// অ্যাড দেখায়, verify/login/register লগইনের আগের পেজ) — এখানে ডাবল অ্যাড এড়াতে বাদ
const PAGE_ENTRY_AD_SKIP_PAGES = new Set(['unlock','wallframe','verify','login','register','forgot']);
async function maybeShowPageEntryAd(page){
  if(!S.user) return;                          // লগইন করার আগে এই ফ্লো প্রযোজ্য না
  if(PAGE_ENTRY_AD_SKIP_PAGES.has(page)) return;
  const key = 'ez_page_ad_'+page;
  const lastShown = parseInt(localStorage.getItem(key)||'0');
  if(Date.now()-lastShown < PAGE_ENTRY_AD_COOLDOWN_MS) return; // ৪৫ মিনিট এখনো পার হয়নি
  localStorage.setItem(key, Date.now().toString());
  await showInterstitialAd();
}

// ── রিওয়ার্ডেড অ্যাড দেখানোর হেল্পার — "ভিডিও দেখে আয়" ফিচারের জন্য ──
// ⚠️ গুরুত্বপূর্ণ ফিক্স: আগে প্রতিবার এই ফাংশন কল হলে একটা নতুন
// addListener() যোগ হতো, কিন্তু পুরনোটা কখনো সরানো হতো না। মানে ৫টা
// rewarded ভিডিও দেখলে ৫টা listener একসাথে ফায়ার করত — একটা ভিডিও
// দেখেই একাধিকবার balance ক্রেডিট হয়ে যেতে পারত। এখন প্রতিটা ভিডিও শেষে
// reward পাওয়ার সাথে সাথেই সেই listener-টা নিজে থেকেই সরে যায় (handle.remove()),
// তাই পরের ভিডিওর জন্য শুধু একটাই fresh listener কাজ করে।
async function showRewardedAd(onReward){
  if(!window.Capacitor?.Plugins?.AdMob){ toast('Rewarded ad শুধু APK-তে কাজ করবে','w'); return; }
  try{
    const { AdMob } = window.Capacitor.Plugins;
    const handle = await AdMob.addListener('onRewardedVideoReward', (reward)=>{
      handle.remove(); // একবার reward পেলেই listener সরিয়ে ফেলা — duplicate credit বন্ধ করতে
      if(onReward) onReward(reward);
    });
    await AdMob.prepareRewardVideoAd({ adId: ADMOB_REWARDED_UNIT_ID });
    await AdMob.showRewardVideoAd();
  }catch(e){ console.warn('AdMob rewarded ad failed', e); }
}
