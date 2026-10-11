const ADMOB_APP_ID              = 'ca-app-pub-1093580583332518~8050365428';               // ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
const ADMOB_BANNER_UNIT_ID      = 'ca-app-pub-1093580583332518/6049878887';     // ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY
const ADMOB_INTERSTITIAL_UNIT_ID= 'ca-app-pub-1093580583332518/3122217233';
const ADMOB_REWARDED_UNIT_ID    = 'ca-app-pub-1093580583332518/3890619409';
// টেস্টের জন্য Google-এর অফিসিয়াল টেস্ট ID ব্যবহার করতে পারেন যতক্ষণ না নিজের ID বসান:
// banner: ca-app-pub-3940256099942544/6300978111
// interstitial: ca-app-pub-3940256099942544/1033173712
// rewarded: ca-app-pub-3940256099942544/5224354917

// Rewarded interstitial unit ID — AdMob-এ "Rewarded interstitial" ইউনিট বানিয়ে ID এখানে বসাও।
// ফাঁকা থাকলে সফল-কাজের পরে সাধারণ interstitial দেখাবে (কিছু ভাঙবে না)।
const ADMOB_REWARD_INTERSTITIAL_UNIT_ID = '';

const _hxIsNative = ()=> !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ── ব্যানার — নিচের মেনুর ঠিক উপরে, লগইন করা অবস্থায় ──
// banner একটা নেটিভ ওভারলে, তাই নিচের nav-এর উচ্চতা মেপে margin দেওয়া হয়, আর
// ব্যানারের উচ্চতা CSS ভ্যারিয়েবল --hxb-এ রাখা হয় যাতে পেজের কনটেন্ট ঢাকা না পড়ে।
let _hxBannerState = 'none'; // none | shown | hidden
async function hxSyncBanner(){
  const AdMob = window.Capacitor?.Plugins?.AdMob;
  if(!_hxIsNative() || !AdMob) return;
  const want = !!S.user;
  try{
    if(want && _hxBannerState==='none'){
      _hxBannerState = 'shown'; // আগে সেট — একাধিক কলে ডাবল শো এড়াতে
      await AdMob.initialize({ requestTrackingAuthorization: true, testingDevices: [], initializeForTesting: false });
      try{
        await AdMob.addListener('bannerAdSizeChanged', (sz)=>{
          const h = Math.max(0, Math.round(sz && sz.height || 0));
          document.documentElement.style.setProperty('--hxb', h+'px');
          document.body.classList.toggle('hx-has-banner', h>0);
        });
        await AdMob.addListener('bannerAdFailedToLoad', ()=>{
          document.documentElement.style.setProperty('--hxb','0px');
          document.body.classList.remove('hx-has-banner');
        });
      }catch(e){}
      const nav = document.querySelector('.bnav');
      const navH = nav ? Math.round(nav.getBoundingClientRect().height) : 62;
      document.documentElement.style.setProperty('--hxnav', navH+'px');
      await AdMob.showBanner({ adId: ADMOB_BANNER_UNIT_ID, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: navH });
    } else if(!want && _hxBannerState==='shown'){
      _hxBannerState = 'hidden';
      await AdMob.hideBanner();
      document.documentElement.style.setProperty('--hxb','0px');
      document.body.classList.remove('hx-has-banner');
    } else if(want && _hxBannerState==='hidden'){
      _hxBannerState = 'shown';
      await AdMob.resumeBanner();
    }
  }catch(e){ console.warn('AdMob banner failed', e); }
}

// ── ইন্টারস্টিশিয়াল অ্যাড দেখানোর হেল্পার — অফার/উইথড্র/লগইন/রেজিস্টার/পেজ-এন্ট্রি সব জায়গা থেকে কল হয় ──
// ⚠️ এই ফাংশন S বা DOM-এর কোনো ইনপুট/ফর্ম ভ্যালু টাচ করে না এবং render() করে না।
// AdMob interstitial নেটিভ ওভারলে — ওয়েবভিউ রিলোড হয় না, তাই ইউজার যেখানে ছিল
// (যেমন ফর্ম/প্রমাণ লেখার মাঝে), অ্যাড বন্ধ হলে ঠিক সেখান থেকেই কাজ চালিয়ে যায়।
// shared guard: দুই অ্যাডের মাঝে কমপক্ষে ৯০ সেকেন্ড গ্যাপ।
let _lastInterstitialAt = 0;
const INTERSTITIAL_MIN_GAP_MS = 90*1000;
async function showInterstitialAd(){
  if(!window.Capacitor?.Plugins?.AdMob) return; // ব্রাউজার/PWA প্রিভিউতে AdMob নেই, চুপচাপ স্কিপ
  if(Date.now() - _lastInterstitialAt < INTERSTITIAL_MIN_GAP_MS) return;
  _lastInterstitialAt = Date.now();
  try{
    const { AdMob } = window.Capacitor.Plugins;
    await AdMob.prepareInterstitial({ adId: ADMOB_INTERSTITIAL_UNIT_ID });
    await AdMob.showInterstitial();
  }catch(e){ console.warn('AdMob interstitial failed', e); }
}

// ── সফল কাজের পরের অ্যাড (Rewarded interstitial) ──
// social task জমা / CPA offer সম্পন্ন / withdraw সফল / referral সফল — এই ঘটনাগুলোর পর।
// AdMob নিয়ম: rewarded interstitial শুরুর আগে ইউজারকে জানাতে হয় ও এড়ানোর সুযোগ দিতে হয়,
// তাই ৩ সেকেন্ডের ছোট কাউন্টডাউন + "এড়িয়ে যান" বাটন দেখানো হয়।
// ID না থাকলে বা লোড না হলে সাধারণ interstitial দেখায়।
function _hxAdIntro(){
  return new Promise(res=>{
    const old = document.getElementById('hxAdIntro'); if(old) old.remove();
    const el = document.createElement('div');
    el.id='hxAdIntro'; el.className='hx-adintro';
    let n = 3, done = false;
    el.innerHTML = `<div class="hx-adintro-card">
      <div class="hx-adintro-t">${T('hxAdIntroT')}</div>
      <div class="hx-adintro-s">${T('hxAdIntroS')} <b id="hxAdCnt">3</b></div>
      <button class="hx-adintro-b" id="hxAdSkip">${T('hxAdSkip')}</button></div>`;
    document.body.appendChild(el);
    const finish = (v)=>{ if(done) return; done = true; clearInterval(iv); el.remove(); res(v); };
    const iv = setInterval(()=>{ n--; const c=document.getElementById('hxAdCnt'); if(c) c.textContent=n; if(n<=0) finish(true); }, 1000);
    document.getElementById('hxAdSkip').onclick = ()=>finish(false);
  });
}
async function showSuccessAd(){
  const AdMob = window.Capacitor?.Plugins?.AdMob;
  if(!AdMob) return;
  if(Date.now() - _lastInterstitialAt < INTERSTITIAL_MIN_GAP_MS) return;
  if(!ADMOB_REWARD_INTERSTITIAL_UNIT_ID) return showInterstitialAd();
  const go = await _hxAdIntro();
  if(!go) return;
  _lastInterstitialAt = Date.now();
  try{
    await AdMob.prepareRewardInterstitialAd({ adId: ADMOB_REWARD_INTERSTITIAL_UNIT_ID });
    await AdMob.showRewardInterstitialAd();
  }catch(e){
    console.warn('AdMob rewarded interstitial failed, fallback', e);
    _lastInterstitialAt = 0;
    await showInterstitialAd();
  }
}

// ── অটো ইন্টারস্টিশিয়াল — প্রতি ৩ মিনিটে ──
// ইউজার কিবোর্ডে লিখছে (input ফোকাসে) বা অ্যাপ ব্যাকগ্রাউন্ডে থাকলে অ্যাড আসে না,
// ১৫ সেকেন্ড পর পর আবার চেক করে — কাজ থামলেই দেখায়। অ্যাড বন্ধ হলে ইউজার
// ঠিক আগের জায়গা/ফর্মেই থাকে (কিছু রিসেট হয় না)।
const AUTO_INTERSTITIAL_MS = 3 * 60 * 1000; // ৩ মিনিট
let autoInterstitialTimer_ = null;
let _autoLastAt = 0;
function _hxUserIsTyping(){
  const a = document.activeElement;
  return !!(a && (a.tagName==='INPUT' || a.tagName==='TEXTAREA' || a.isContentEditable));
}
function startAutoInterstitialLoop(){
  stopAutoInterstitialLoop();
  _autoLastAt = Date.now();
  autoInterstitialTimer_ = setInterval(()=>{
    if(!S.user) return;
    if(S.adActive) return;
    if(document.hidden) return;
    if(Date.now() - _autoLastAt < AUTO_INTERSTITIAL_MS) return;
    if(_hxUserIsTyping()) return;           // লেখার মাঝখানে না, পরের চেকে আবার
    _autoLastAt = Date.now();
    showInterstitialAd();
  }, 15000);
}
function stopAutoInterstitialLoop(){
  if(autoInterstitialTimer_){ clearInterval(autoInterstitialTimer_); autoInterstitialTimer_ = null; }
}

// ── পেজে ঢোকার সময় ইন্টারস্টিশিয়াল ──
// এক পেজ থেকে অন্য পেজে গেলে অ্যাড আসে। একই পেজে ৪ মিনিটের মধ্যে আবার ঢুকলে
// আসে না; ৪ মিনিট পর ঢুকলে আবার আসে। navTo() (js/app-events.js) থেকে কল হয়।
const PAGE_ENTRY_AD_COOLDOWN_MS = 4 * 60 * 1000; // ৪ মিনিট
// এই পেজগুলোর নিজস্ব অ্যাড-ফ্লো আছে বা লগইনের আগের পেজ — ডাবল অ্যাড এড়াতে বাদ
const PAGE_ENTRY_AD_SKIP_PAGES = new Set(['unlock','wallframe','verify','login','register','forgot','quiz']);
async function maybeShowPageEntryAd(page){
  if(!S.user) return;
  if(PAGE_ENTRY_AD_SKIP_PAGES.has(page)) return;
  const key = 'ez_page_ad_'+page;
  const lastShown = parseInt(localStorage.getItem(key)||'0');
  if(Date.now()-lastShown < PAGE_ENTRY_AD_COOLDOWN_MS) return;
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
async function showRewardedAd(onReward, onFail){
  const AdMob = window.Capacitor?.Plugins?.AdMob;
  if(!AdMob){ toast('Rewarded ad শুধু APK-তে চলে','w'); if(onFail) onFail('no_plugin'); return; }
  let finished = false;
  const handles = [];
  const cleanup = ()=>{ handles.forEach(h=>{ try{ h && h.remove && h.remove(); }catch(e){} }); handles.length = 0; };
  const giveReward = ()=>{
    if(finished) return; finished = true; cleanup();
    if(onReward) onReward();
  };
  const fail = (why)=>{
    if(finished) return; finished = true; cleanup();
    console.warn('AdMob rewarded ad failed:', why);
    if(onFail) onFail(why);
  };
  const on = async (eventNames, fn)=>{
    for(const n of eventNames){
      try{ handles.push(await AdMob.addListener(n, fn)); }catch(e){}
    }
  };
  try{
    // ⚠️ সঠিক ইভেন্ট নাম হলো 'onRewardedVideoAdReward' (আগের কোডে 'Ad' বাদ ছিল বলে reward কখনো আসত না)
    await on(['onRewardedVideoAdReward','onRewardedVideoReward'], ()=>giveReward());
    await on(['onRewardedVideoAdFailedToLoad','onRewardedVideoAdFailedToShow'], (e)=>fail(e && (e.message||e.code) || 'load_failed'));
    // user reward পাওয়ার আগেই ad বন্ধ করলে
    await on(['onRewardedVideoAdDismissed'], ()=>{ setTimeout(()=>fail('dismissed'), 400); });
    await AdMob.prepareRewardVideoAd({ adId: ADMOB_REWARDED_UNIT_ID });
    const res = await AdMob.showRewardVideoAd();
    // কিছু plugin ভার্সনে reward এখানেই ফেরত আসে
    if(res && (res.type || res.amount)) giveReward();
  }catch(e){
    fail(e && (e.message||e.code) || e);
  }
}
