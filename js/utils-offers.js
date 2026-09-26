// ─── UTILS ────────────────────────────────────────────
function $(sel){ return document.querySelector(sel); }
function $$(sel){ return document.querySelectorAll(sel); }
function el(tag,cls,html='',attrs={}){
  const e=document.createElement(tag);
  if(cls) e.className=cls;
  if(html) e.innerHTML=html;
  Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));
  return e;
}

// ══════════════════════════════════════════════════════════
// 🔒 SECURITY — HTML escaping helper (Stored XSS প্রতিরোধ)
// ══════════════════════════════════════════════════════════
// ⚠️ ফিক্স: এই ফাংশনের একটা কপি আগে এখানেও ছিল, আর একটা js/config.js-এ —
// দুটোই একই কাজ করত (কোনো bug ছিল না, যেহেতু config.js আগে load হয়
// index.html-এ), কিন্তু duplicate কোড রাখা ঠিক না — future-এ কেউ একটা
// আপডেট করলে আরেকটা বাদ পড়ে যাওয়ার ঝুঁকি থাকে। এখন শুধু js/config.js-এ
// একটাই definition আছে (পুরো ব্যাখ্যাসহ), এটা মুছে দেওয়া হলো।

// ══════════════════════════════════════════════════════════
// External/Internal Link খোলার নিরাপদ helper (নেটিভ APK-friendly)
// ══════════════════════════════════════════════════════════
// কেন দরকার: সাধারণ Android WebView (যেটার ভেতরে APK চলে) target="_blank"
// বা window.open() সাপোর্ট করে না — আলাদা multi-window সাপোর্ট ছাড়া
// ক্লিক করলে কিছুই খোলে না। এই ফাংশন সেই সমস্যা এড়িয়ে যায়:
//   • নেটিভ APK-তে → location.href দিয়ে navigate করে। এটা যদি অন্য
//     ডোমেইনের (external) লিংক হয়, Capacitor নিজে থেকেই ধরে ফেলে ও
//     সিস্টেম ব্রাউজারে পাঠিয়ে দেয় — App-এর নিজের অবস্থা (state/history)
//     অক্ষত থাকে, কিছু হারায় না। যদি একই App-এর ভেতরের পেজ (যেমন
//     terms.html) হয়, স্বাভাবিকভাবে সেই পেজে চলে যাবে।
//   • ব্রাউজারে টেস্ট করার সময় → normal window.open() ব্যবহার হয়, যাতে
//     নতুন ট্যাবে খোলে এবং App-এর ট্যাব হারিয়ে না যায়।
function openLink(url){
  if(!url) return;
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if(isNative){
    window.location.href = url;
  }else{
    window.open(url, '_blank', 'noopener');
  }
}

// Toast
// ⚠️ ফিক্স (Stored XSS): আগে `msg` সরাসরি innerHTML-এ বসত — মানে যেকোনো
// জায়গা থেকে toast()-এ কোনো user/admin-controlled টেক্সট (যেমন push
// notification-এর title, যেটা admin panel থেকে পাঠানো যায়) HTML/JS হিসেবে
// রান হয়ে যেতে পারত। পুরো অ্যাপে toast() বহু জায়গা থেকে কল হয়, তাই
// প্রতিটা কল-সাইট আলাদা করে ঠিক না করে toast() ফাংশনটাকেই নিরাপদ করা
// হলো — আইকনটুকু (fixed, নিরাপদ ক্যারেক্টার) innerHTML দিয়ে, আর আসল
// মেসেজ textContent দিয়ে বসানো হচ্ছে (textContent কখনো HTML/JS হিসেবে
// রান করে না, শুধু টেক্সট হিসেবে দেখায়)। কোডবেসে কোনো toast() কলই
// ইচ্ছাকৃতভাবে HTML ট্যাগ ব্যবহার করছিল না, তাই এই পরিবর্তনে কোনো
// ফিচার ভাঙেনি।
function toast(msg,type='s',dur=3200){
  const t=el('div',`tst t${type}`,`<span>${{s:'✓',e:'✕',w:'⚠',i:'ℹ'}[type]||'✓'}</span>`);
  t.appendChild(document.createTextNode(' '+msg));
  const c=$('#tc'); c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(-5px)';setTimeout(()=>t.remove(),300)},dur);
}

// Format dollar
function fmt$(v){ return '$'+(parseFloat(v)||0).toFixed(2); }
// Format date
function fmtD(ts){ return ts?new Date(ts).toLocaleDateString():'—'; }
// Time ago
function timeAgo(ts){
  const s=(Date.now()-ts)/1000;
  if(s<60) return Math.floor(s)+'s ago';
  if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}
// Safe encode for keys
function encKey(k){ return k.replace(/[.#$[\]/]/g,'_'); }
// Generate ref code
function genRef(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
// Device fingerprint (basic)
function getDeviceId(){
  let id=localStorage.getItem('ez_dev');
  if(!id){
    id=[navigator.platform,screen.width,screen.height,navigator.language,new Date().getTimezoneOffset()].join('-');
    id=btoa(id).replace(/=/g,'').slice(0,20);
    localStorage.setItem('ez_dev',id);
  }
  return id;
}
// Clipboard
function copyText(txt){
  navigator.clipboard.writeText(txt).then(()=>toast(T('cpd'),'s')).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
    toast(T('cpd'),'s');
  });
}
// Deep clone
function clone(o){ return JSON.parse(JSON.stringify(o)); }

// ─── APPLY LANGUAGE ───────────────────────────────────
function applyLang(lang='en'){
  S.lang=lang;
  const cfg=LANGS[lang]||LANGS.en;
  const root=$('#HR');
  if(root){ root.setAttribute('lang',lang); root.setAttribute('dir',cfg.d); }
  document.title=T('appName');
  // Update ad modal texts
  const adTtl=$('#adTtl'),adSub=$('#adSub'),adWrn=$('#adWarn'),adPLb=$('#adPLb');
  if(adTtl) adTtl.textContent=T('adTtl');
  if(adSub) adSub.textContent=T('adSub');
  if(adWrn) adWrn.textContent=T('adWrn');
  if(adPLb) adPLb.textContent=T('adPLb');
  if($('#nmOk')) $('#nmOk').textContent=T('confirm');
  if($('#lmTtl')) $('#lmTtl').textContent=T('langT');
  localStorage.setItem('ez_lang',lang);
}

// ─── AD SYSTEM ────────────────────────────────────────
let adTimer_=null, adSec_=0;

function startAd(wallId, type='unlock', cb=null){
  if(S.adActive){ toast(T('adAlreadyRunning'),'w'); return; }
  const now=Date.now();
  if(now-S.adLastMs < CFG.adGapMs){
    toast(T('waitBeforeNextAd'),'w');
    return;
  }
  S.adActive=true; S.adWallId=wallId; S.adType=type; S.adCallback=cb;
  adSec_=CFG.adSec;

  // ── নেটিভ Android APK-তে থাকলে AdMob Rewarded Video দেখাও, শেষ হলে finishAd() কল হবে ──
  const isNativeAd = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if(isNativeAd && window.Capacitor?.Plugins?.AdMob){
    showRewardedAd(()=>{ finishAd(); }, ()=>{
      //  ad লোড/শো না হলে বা reward ছাড়া বন্ধ হলে — state রিসেট, না হলে বাটন আটকে থাকত
      S.adActive=false; S.adWallId=null; S.adType=null; S.adCallback=null;
      toast(S.lang==='bn' ? 'এই মুহূর্তে বিজ্ঞাপন পাওয়া যাচ্ছে না, একটু পরে আবার চেষ্টা করুন' : 'Ad is not available right now, please try again in a moment','w',5000);
    });
    // Rewarded ad চলাকালীন নিজস্ব UI counter/modal দেখানোর দরকার নেই (AdMob নিজেই ফুলস্ক্রিন দেখায়)
    return;
  }

  // ── ব্রাউজার/PWA প্রিভিউ ফলব্যাক — পুরনো timer + tab পদ্ধতি (শুধু টেস্টিং এর জন্য) ──
  // ── Ad ট্যাব খোলা — 'noopener' বাদ দেওয়া হয়েছে ইচ্ছাকৃতভাবে,
  //    যাতে window.closed চেক করে সত্যিই ট্যাব খোলা আছে কিনা যাচাই করা যায়
  const adWin = window.open(CFG.smartLink,'_blank');
  S.adWinRef = adWin;
  S.adWinValid = !!adWin; // popup blocked হলে false — তখন পুরনো blind-timer পদ্ধতিতে চলবে
  // Show ad modal
  const adm=$('#adm'); adm.style.display='flex';
  // Block back button during ad
  history.pushState(null,null,location.href);
  window.onpopstate=()=>{ history.pushState(null,null,location.href); };
  // Show corner counter
  const cc=$('#cc'); cc.style.display='flex'; cc.textContent=adSec_;
  const ring=$('#adRing'); ring.style.strokeDashoffset='345';
  $('#adNum').textContent=adSec_;
  $('#adPBar').style.width='0%';
  $('#adPCt').textContent=`0 / ${CFG.adSec}${T('sec')}`;
  // Prevent closing with beforeunload
  window.onbeforeunload=()=>'Ad in progress. Do not close!';
  // Tick
  adTimer_=setInterval(()=>{
    // ── আসল যাচাই: Ad ট্যাব সত্যিই এখনো খোলা আছে কিনা ──
    if(S.adWinValid && S.adWinRef && S.adWinRef.closed){
      clearInterval(adTimer_);
      cancelAd();
      return;
    }
    adSec_--;
    const elapsed=CFG.adSec-adSec_;
    const pct=(elapsed/CFG.adSec)*100;
    const offset=345-(345*(elapsed/CFG.adSec));
    $('#adNum').textContent=Math.max(0,adSec_);
    $('#cc').textContent=Math.max(0,adSec_);
    if(ring) ring.style.strokeDashoffset=offset.toString();
    $('#adPBar').style.width=pct+'%';
    $('#adPCt').textContent=`${elapsed} / ${CFG.adSec}${T('sec')}`;
    if(adSec_<=0){
      clearInterval(adTimer_);
      // ── শেষ মুহূর্তেও আরেকবার নিশ্চিত হওয়া যে Ad ট্যাব বন্ধ হয়ে যায়নি ──
      if(S.adWinValid && S.adWinRef && S.adWinRef.closed){
        cancelAd();
      } else {
        finishAd();
      }
    }
  },1000);
}

// ── Ad ট্যাব সময়ের আগে বন্ধ হয়ে গেলে — কোনো ক্রেডিট ছাড়াই বাতিল ──
function cancelAd(){
  S.adActive=false;
  window.onbeforeunload=null;
  window.onpopstate=null;
  S.adWinRef=null; S.adWinValid=false;
  const adm=$('#adm'); adm.style.display='none';
  const cc=$('#cc'); cc.style.display='none';
  S.adType=null; S.adWallId=null; S.adCallback=null;
  toast(T('adClosedEarlyMsg'),'e',5000);
}

function finishAd(){
  S.adActive=false;
  S.adLastMs=Date.now();
  window.onbeforeunload=null;
  window.onpopstate=null;
  S.adWinRef=null; S.adWinValid=false;
  const adm=$('#adm'); adm.style.display='none';
  const cc=$('#cc'); cc.style.display='none';
  const type=S.adType, wallId=S.adWallId, cb=S.adCallback;
  S.adType=null; S.adWallId=null; S.adCallback=null;
  trackEvent('ad_watched', { type: type||'', wall_id: wallId||'' });
  if(type==='unlock' && wallId){
    onAdCompleteForWall(wallId);
  } else if(type==='notice' && cb){
    cb();
  } else if(type==='withdraw' && cb){
    cb();
  } else if(type==='socialUnlock'){
    onAdCompleteForSocial();
  }
}

async function onAdCompleteForSocial(){
  if(!S.user) return;
  const uid=S.user.uid;
  // localStorage এ save — Supabase call নেই
  const key=`ez_ads_social_${uid}`;
  const totalAds=(parseInt(localStorage.getItem(key)||'0'))+1;
  localStorage.setItem(key, totalAds);
  // ⚠️ ফিক্স: এখানে হার্ডকোড করা "5" ছিল, যেটা মূল Offerwall-এর
  // CFG.adsPerWall (এখন 4) থেকে আলাদা হয়ে গিয়েছিল — একটাতে 4টা লাগত,
  // আরেকটাতে 5টা, অসামঞ্জস্যপূর্ণ ছিল। এখন দুটোই একই CFG.adsPerWall মান ব্যবহার করে।
  if(totalAds>=CFG.adsPerWall){
    const unlockAt=Date.now()+CFG.unlock24h;
    await fDB.ref(`users/${uid}/socialUnlockAt`).set(unlockAt);
    const uSnap=await fDB.ref(`users/${uid}`).once('value');
    S.userData=uSnap.val();
    localStorage.setItem(key,'0'); // reset
    toast('✅ Social Tasks unlocked for 24 hours!','s');
  } else {
    toast(`📺 ${totalAds}/${CFG.adsPerWall} ads watched. ${CFG.adsPerWall-totalAds} more to unlock!`,'s');
  }
  render();
}

async function onAdCompleteForWall(wallId){
  if(!S.user) return;
  const uid=S.user.uid;
  // wallProgress stored as JSON object in users row
  const uSnap=await fDB.ref(`users/${uid}`).once('value');
  const ud2=uSnap.val()||{};
  const wallProgressObj=ud2.wallProgress||{};
  let prog=wallProgressObj[wallId]||{count:0,unlockedAt:0};
  const ref={
    set: async(val)=>{
      const uSnap2=await fDB.ref(`users/${uid}`).once('value');
      const ud3=uSnap2.val()||{};
      const wp=ud3.wallProgress||{};
      wp[wallId]=val;
      await fDB.ref(`users/${uid}`).update({wallProgress:wp});
    }
  };
  // Check if already unlocked and within 24h
  if(prog.unlockedAt && (Date.now()-prog.unlockedAt)<CFG.unlock24h){
    toast(T('adNote'),'s');
    render();
    return;
  }
  prog.count=(prog.count||0)+1;
  // localStorage এ ads count — UI এর জন্য
  const adsKey=`ez_ads_wall_${uid}`;
  const newCount=(parseInt(localStorage.getItem(adsKey)||'0')+1);
  localStorage.setItem(adsKey, newCount.toString());
  // Supabase এ শুধু ১ম ad এর সময় save করি — referral check এর জন্য
  if(newCount===1){
    await fDB.ref(`users/${uid}/adsWatched`).set(1);
  }
  let finalCount, finalLocked, finalRemaining;
  if(prog.count>=CFG.adsPerWall){
    // এইমাত্র ৫টা পূর্ণ হলো — এই মুহূর্তেই সব dot ✓ দেখাব, তারপর unlocked অবস্থায় সরাসরি চলে যাব
    finalCount=CFG.adsPerWall; finalLocked=false; finalRemaining=CFG.unlock24h;
    prog.count=0;
    prog.unlockedAt=Date.now();
    await ref.set(prog);
    toast(T('wdone'),'s');
  } else {
    finalCount=prog.count; finalLocked=true; finalRemaining=0;
    await ref.set(prog);
    toast(`${T('adNote')} (${prog.count}/${CFG.adsPerWall})`,'i');
  }
  render();
  // ── locally জানা সঠিক state দিয়ে সাথে সাথে box আপডেট — re-fetch এর জন্য
  //    অপেক্ষা করতে হয় না, তাই কখনো "count হলো কিন্তু box পূরণ হলো না" এমন হবে না
  applyUnlockUI(wallId, finalCount, finalLocked, finalRemaining);
}

// ─── RSS FEED SYSTEM ──────────────────────────────────
async function loadPayoutSettings(){
  // Use cache
  let cached = EZCache.get('settings_payout');
  if(!cached){
    const snap = await fDB.ref('settings/payout').once('value');
    cached = snap.val()||{};
    EZCache.set('settings_payout', cached);
  }
  if(cached){
    S.payoutMode = cached.mode||'custom';
    S.payoutRates = cached.rates||S.payoutRates;
  }
  // Load announcement — cached
  let ann = EZCache.get('settings_announcement');
  if(ann===null || ann===undefined){
    const aSnap = await fDB.ref('settings/announcement').once('value');
    const aVal = aSnap.val();
    // settings row returns {id:'announcement', data:'text'} — .data extract করো
    let rawAnn = (aVal && typeof aVal==='object') ? (aVal.data||'') : (aVal||'');
    // ⚠️ FIX: DB-তে পুরনো/ভুল shape-এ (object হিসেবে) সেভ হয়ে থাকলেও যাতে
    // "[object Object]" কখনো ব্যানারে না যায় — string না হলে খালি করে দাও
    ann = (typeof rawAnn==='string') ? rawAnn : '';
    EZCache.set('settings_announcement', ann);
  }
  if(ann) S.siteSettings={...(S.siteSettings||{}), announcement:ann};

  // 🆕 Community News video (admin এডমিন প্যানেল থেকে বসায়/মুছে) — cached
  let cv = EZCache.get('settings_communityVideo');
  if(cv===null || cv===undefined){
    const cvSnap = await fDB.ref('settings/communityVideo').once('value');
    const cvVal = cvSnap.val();
    let raw = (cvVal && typeof cvVal==='object') ? (cvVal.data||'') : (cvVal||'');
    if(typeof raw==='string' && raw){ try{ raw=JSON.parse(raw); }catch(e){ raw={url:raw}; } }
    cv = (raw && raw.url) ? raw : null;
    EZCache.set('settings_communityVideo', cv||'');
  }
  if(cv) S.siteSettings={...(S.siteSettings||{}), communityVideo: cv};
}

// ══════════════════════════════════════════════════════════
//  RECENT ACTIVITIES — home page-এ দেখানোর জন্য, ফোনেই (localStorage) রাখা হয়
// ══════════════════════════════════════════════════════════
const ACTIVITY_LOG_KEY = 'ez_activity_log';
const ACTIVITY_LOG_MAX = 12;
function logActivity(amount){
  try{
    const list = getActivityLog();
    list.unshift({ amount, t: Date.now() });
    localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(list.slice(0, ACTIVITY_LOG_MAX)));
  }catch(e){}
}
function getActivityLog(){
  try{ return JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY)||'[]'); }catch(e){ return []; }
}
function timeAgoLabel(ts){
  const s = Math.max(1, Math.floor((Date.now()-ts)/1000));
  if(s<60) return `${s}s`;
  const m=Math.floor(s/60); if(m<60) return `${m}m`;
  const h=Math.floor(m/60); if(h<24) return `${h}h`;
  return `${Math.floor(h/24)}d`;
}

// ══════════════════════════════════════════════════════════
//  COMMUNITY VIDEO — YouTube/Facebook/TikTok লিংক থেকে embed URL বানানো
// ══════════════════════════════════════════════════════════
function communityVideoEmbedUrl(url){
  if(!url) return null;
  try{
    if(/youtu\.?be/i.test(url)){
      const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
      if(m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    if(/tiktok\.com/i.test(url)){
      const m = url.match(/video\/(\d+)/);
      if(m) return `https://www.tiktok.com/embed/v2/${m[1]}`;
    }
    if(/facebook\.com|fb\.watch/i.test(url)){
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0`;
    }
  }catch(e){}
  return null;
}

// User cut % — platform যা real payout দেয়, তার এই % টাই user কে দেখানো/দেওয়া হয় (বাকিটা platform fee হিসেবে রাখা হয়)
const USER_PAYOUT_SHARE = 0.30;

function getUserPayout(cpaAmount){
  const amt = parseFloat(cpaAmount)||0;
  // Real CPA payout পাওয়া গেলে (RSS feed থেকে) → সবসময় তার নির্দিষ্ট % দেখানো হয়
  if(amt>0) return amt*USER_PAYOUT_SHARE;
  // Real amount না থাকলে (placeholder/static rate দরকার এমন জায়গায়) → আগের country-based fallback
  if(S.payoutMode==='cpa') return amt;
  const cc=S.country||'';
  if(S.payoutRates[cc]!=null) return S.payoutRates[cc];
  const hiCC=CFG.hiCC||[];
  if(hiCC.includes(cc)) return S.payoutRates.hi||0.50;
  return S.payoutRates.default||0.30;
}

// ── ALL CPA PLATFORMS — RSS/JSON Feed সিস্টেম ──────────
// ⚠️ credentials শুধু নিচের PLATFORM_CREDS object এ বসান — database call নেই
const PLATFORM_CREDS = {
  // ── আপনার credentials এখানে বসান ──
  cpagrip: { userId:'2441114', key:'7f0b09da3b2d682f1189d1d6abbf24fc' },
  ogads:   { userId:'', key:'' },
  adgate:  { userId:'', key:'' },
  adscend: { userId:'', key:'' },
  mylead:  { userId:'', key:'' },
  adworkm: { userId:'', key:'' },
  cpalead: { userId:'', key:'' },
  offertoro:{ userId:'', key:'' },
  lootably:{ userId:'', key:'' },
  revuniv: { userId:'', key:'' },
  ayetstud:{ userId:'', key:'' },
  wannads: { userId:'', key:'' },
  timewall:{ userId:'', key:'' },
  kiwiwall:{ userId:'', key:'' },
  monlix:  { userId:'', key:'' },
  taprain: { userId:'', key:'' },
  ofwallme:{ userId:'', key:'' },
  ofwallinfo:{ userId:'', key:'' },
  adwebm:  { userId:'', key:'' },
  ofwallcom:{ userId:'', key:'' },
};

// RSS_PLATFORMS — প্রতিটা platform এর feed URL + XML/JSON parse logic
const RSS_PLATFORMS = {
  cpagrip:{
    buildUrl:(c,cc,uid)=>`https://www.cpagrip.com/common/offer_feed_rss.php?user_id=${c.userId}&key=${c.key}&country=${cc}&tracking_id=${uid}`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:it.querySelector('category')?.textContent||'CPA',
      img:it.querySelector('image_url')?.textContent||'',
    })),
  },
  ogads:{
    buildUrl:(c,cc,uid)=>`https://ogads.com/wall/api?pub_id=${c.userId}&key=${c.key}&country=${cc}&subid=${uid}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'Mobile', img:'',
    })),
  },
  adgate:{
    buildUrl:(c,cc,uid)=>`https://wall.adgaterewards.com/api/v1/offers?key=${c.key}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'AdGate',
      img:it.querySelector('enclosure')?.getAttribute('url')||'',
    })),
  },
  adscend:{
    buildUrl:(c,cc,uid)=>`https://adscendmedia.com/api/v1/wall?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&user_id=${uid}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'Adscend', img:'',
    })),
  },
  mylead:{
    buildUrl:(c,cc,uid)=>`https://mylead.global/api/offers?token=${c.key}&country=${cc}&user=${uid}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'MyLead', img:'',
    })),
  },
  adworkm:{
    buildUrl:(c,cc,uid)=>`https://www.adworkmedia.com/api/offers?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&subid=${uid}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'Premium', img:'',
    })),
  },
  cpalead:{
    buildUrl:(c,cc,uid)=>`https://cpalead.com/dashboard/reports/camp_rss.php?id=${c.userId}&country=${cc}&subid=${uid}`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'CPALead', img:'',
    })),
  },
  offertoro:{
    buildUrl:(c,cc,uid)=>`https://www.offertoro.com/api/serve/json/${c.userId}/${c.key}/${uid}?country=${cc}`,
    parse:(json)=>{
      const items=json?.offers||json?.data||[];
      return items.map(o=>({
        title:o.name||o.title||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.offer_url||o.link||'',
        payout:parseFloat(o.payout||o.points||'0'),
        category:o.category||'OfferToro',
        img:o.picture||o.image||'',
      }));
    },
    isJson:true,
  },
  lootably:{
    buildUrl:(c,cc,uid)=>`https://lootably.com/api/offers?placementID=${c.key}&userID=${uid}&country=${cc}&format=json`,
    parse:(json)=>{
      const items=json?.data||json?.offers||[];
      return items.map(o=>({
        title:o.name||o.title||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.tracking_url||o.link||'',
        payout:parseFloat(o.payout||'0'),
        category:o.category||'Lootably',
        img:o.image_url||'',
      }));
    },
    isJson:true,
  },
  revuniv:{
    buildUrl:(c,cc,uid)=>`https://www.revenueuniverse.com/api/wall?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&user_id=${uid}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'RevUniverse', img:'',
    })),
  },
  ayetstud:{
    buildUrl:(c,cc,uid)=>`https://www.ayetstudios.com/api/feed?api_key=${c.key}&pub_id=${c.userId}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'Ayet', img:it.querySelector('image_url')?.textContent||'',
    })),
  },
  wannads:{
    buildUrl:(c,cc,uid)=>`https://wannads.com/api/offers?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&subid=${uid}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'WannAds', img:'',
    })),
  },
  timewall:{
    buildUrl:(c,cc,uid)=>`https://api.timewall.io/v1/offers?api_key=${c.key}&publisher_id=${c.userId}&country=${cc}&user_id=${uid}&format=json`,
    parse:(json)=>{
      const items=json?.offers||json?.data||[];
      return items.map(o=>({
        title:o.title||o.name||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.offer_url||o.click_url||'',
        payout:parseFloat(o.payout||'0'),
        category:o.category||'TimeWall',
        img:o.image||'',
      }));
    },
    isJson:true,
  },
  kiwiwall:{
    buildUrl:(c,cc,uid)=>`https://www.kiwiwall.com/wall/api/?api_secret=${c.key}&user_id=${uid}&country=${cc}`,
    parse:(json)=>{
      const items=json?.offers||json?.data||[];
      return items.map(o=>({
        title:o.name||o.title||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.click_url||o.link||'',
        payout:parseFloat(o.payout||'0'),
        category:o.type||'KiwiWall',
        img:o.image||'',
      }));
    },
    isJson:true,
  },
  monlix:{
    buildUrl:(c,cc,uid)=>`https://monlix.com/api/v3/offers?app_id=${c.userId}&api_key=${c.key}&uid=${uid}&country=${cc}`,
    parse:(json)=>{
      const items=json?.data?.offers||json?.offers||[];
      return items.map(o=>({
        title:o.name||o.title||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.link||o.click_url||'',
        payout:parseFloat(o.payout||'0'),
        category:o.category||'Monlix',
        img:o.image||'',
      }));
    },
    isJson:true,
  },
  taprain:{
    buildUrl:(c,cc,uid)=>`https://taprain.com/api/offers?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&user_id=${uid}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'TapRain', img:'',
    })),
  },
  ofwallme:{
    buildUrl:(c,cc,uid)=>`https://offerwall.me/api/offers?api_key=${c.key}&pub_id=${c.userId}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'OfferWall', img:'',
    })),
  },
  ofwallinfo:{
    buildUrl:(c,cc,uid)=>`https://offerwall.info/api/offers?api_key=${c.key}&publisher_id=${c.userId}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'OfferWall', img:'',
    })),
  },
  adwebm:{
    buildUrl:(c,cc,uid)=>`https://adswebmedia.com/api/offers?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&user_id=${uid}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'AdsWebMedia', img:'',
    })),
  },
  ofwallcom:{
    buildUrl:(c,cc,uid)=>`https://offerwall.com/api/offers?api_key=${c.key}&pub_id=${c.userId}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml)=>[...xml.querySelectorAll('item')].map(it=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'OfferWall', img:'',
    })),
  },
};

// ALL_WALLS_MAP — platform id → wall id mapping
const ALL_WALLS_MAP = {
  w1: { platform:'cpagrip'  },
  w2: { platform:'ogads'    },
  w3: { platform:'adgate'   },
  w4: { platform:'adscend'  },
  w5: { platform:'mylead'   },
  w6: { platform:'adworkm'  },
  w7: { platform:'cpalead'  },
  w8: { platform:'offertoro'},
  w9: { platform:'lootably' },
  w10:{ platform:'revuniv'  },
  w11:{ platform:'ayetstud' },
  w12:{ platform:'wannads'  },
  w13:{ platform:'timewall' },
  w14:{ platform:'kiwiwall' },
  w15:{ platform:'monlix'   },
  w16:{ platform:'taprain'  },
  w17:{ platform:'ofwallme' },
  w18:{ platform:'ofwallinfo'},
  w19:{ platform:'adwebm'   },
  w20:{ platform:'ofwallcom'},
};

// একটা platform এর feed fetch করো (RSS বা JSON)
async function fetchOnePlatform(wallId, platformId, uid, cc){
  const creds = PLATFORM_CREDS[platformId]||{};
  if(!creds.userId && !creds.key) return []; // credentials নেই → skip
  if(!creds.key) return [];
  const plat = RSS_PLATFORMS[platformId];
  if(!plat) return [];
  try{
    const feedUrl  = plat.buildUrl(creds, cc, uid);
    const proxyUrl = CFG.rssProxy + encodeURIComponent(feedUrl);
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if(!res.ok) return [];
    if(plat.isJson){
      const json = await res.json();
      return (plat.parse(json)||[]).filter(o=>o.title && o.link).map(o=>({...o, _w:wallId}));
    } else {
      const txt = await res.text();
      const xml  = new DOMParser().parseFromString(txt,'text/xml');
      return (plat.parse(xml)||[]).filter(o=>o.title && o.link).map(o=>({...o, _w:wallId}));
    }
  }catch(e){ return []; }
}

function shuffleArr(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

// ── একটা নির্দিষ্ট wall-এর RSS/JSON অফার লোড করে S.rssOffers এ রাখে ──
// renderRSSOffers() এটা পড়ে UI-তে দেখায় (pages-offers.js এ দেখুন)।
// ⚠️ এই ফাংশনটা app-events.js থেকে কল হচ্ছিল কিন্তু আগে কোথাও ডিফাইন করা
// ছিল না — অডিটের সময় ধরা পড়েছে। এখন যোগ করা হলো, উপরের
// fetchOnePlatform()/ALL_WALLS_MAP/shuffleArr() infrastructure পুনরায়
// ব্যবহার করে (loadAllOffers() একইভাবে এগুলো ব্যবহার করে, তাই এটা
// প্রমাণিত/সামঞ্জস্যপূর্ণ প্যাটার্ন)।
async function fetchRSSOffers(wallId){
  S.rssLoading = true;
  S.rssWallId = wallId;
  try{
    const wallInfo = ALL_WALLS_MAP[wallId];
    if(!wallInfo){
      S.rssOffers = [{ error:true, msg:'এই ওয়ালের জন্য কোনো platform কনফিগার করা নেই।' }];
      return;
    }
    const uid = S.user?.uid || 'guest';
    const cc  = S.country || 'US';
    const offers = await fetchOnePlatform(wallId, wallInfo.platform, uid, cc);
    if(!offers.length){
      S.rssOffers = [{ empty:true, platform: wallInfo.platform }];
    } else {
      S.rssOffers = shuffleArr(offers);
    }
  }catch(e){
    S.rssOffers = [{ error:true, msg:'Offer লোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।' }];
  }finally{
    S.rssLoading = false;
  }
}

// ── Offers localStorage cache key (per user, 48h) ──
function offersLSKey(){ return `ez_offers_cache_${S.user?.uid||'guest'}`; }
const OFFERS_CACHE_TTL = 48*60*60*1000; // 48 ঘণ্টা

function saveOffersCache(offers){
  try{ localStorage.setItem(offersLSKey(), JSON.stringify({ts:Date.now(), offers})); }catch(e){}
}
function loadOffersCache(){
  try{
    const raw = localStorage.getItem(offersLSKey());
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj||!obj.ts||!obj.offers) return null;
    if(Date.now()-obj.ts > OFFERS_CACHE_TTL) return null;
    return obj.offers;
  }catch(e){ return null; }
}
function clearOffersCache(){
  try{ localStorage.removeItem(offersLSKey()); }catch(e){}
}

// ── Custom Manual Offers (Admin থেকে add করা, DB তে save) ──
const CUSTOM_OFFERS_LS_KEY = ()=>`ez_custom_offers_${S.user?.uid||'guest'}`;
const CUSTOM_OFFERS_TTL = 48*60*60*1000; // 48 ঘণ্টা

function saveCustomOffersCache(offers){
  try{ localStorage.setItem(CUSTOM_OFFERS_LS_KEY(), JSON.stringify({ts:Date.now(), offers})); }catch(e){}
}
function loadCustomOffersCache(){
  try{
    const raw = localStorage.getItem(CUSTOM_OFFERS_LS_KEY());
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj||!obj.ts||!obj.offers) return null;
    if(Date.now()-obj.ts > CUSTOM_OFFERS_TTL) return null;
    return obj.offers;
  }catch(e){ return null; }
}

async function fetchCustomOffers(force){
  if(!force){
    const cached = loadCustomOffersCache();
    if(cached){ S.customOffers=cached; S.customOffersLoaded=true; return cached; }
  }
  try{
    const {data} = await sb.from('custom_offers')
      .select('*').eq('active',true).order('created_at',{ascending:false});
    const myCountry = (S.country||'').toUpperCase();
    const offers = (data||[])
      .filter(o=>{
        const cs = o.countries; // null/[] মানে সব দেশ, নাহলে array এ থাকা দেশগুলোই শুধু
        if(!cs || !Array.isArray(cs) || cs.length===0) return true;
        return cs.map(c=>String(c).toUpperCase()).includes(myCountry);
      })
      .map(o=>({
        title:o.title||'',
        desc:o.description||'',
        link:o.link||o.url||'',
        payout:parseFloat(o.payout||'0'),
        category:o.category||'Custom',
        img:o.image_url||'',
        _w:'custom',
      }));
    S.customOffers=offers; S.customOffersLoaded=true;
    saveCustomOffersCache(offers);
    return offers;
  }catch(e){ S.customOffers=[]; S.customOffersLoaded=true; return []; }
}

async function loadAllOffers(force){
  if(S.allOffersLoading) return;

  // Unlock check
  const unlockSt = await checkWallUnlock('alloffers');
  if(unlockSt.locked){
    S.unlockWallId='alloffers'; S.page='unlock'; render(); return;
  }

  // 48h cache
  if(!force){
    const cached = loadOffersCache();
    if(cached && cached.length){ S.allOffers=cached; S.allOffersLoaded=true; renderAllOffers(); return; }
  }

  S.allOffersLoading=true; S.allOffers=[]; renderAllOffers();
  const uid=S.user?.uid||'', cc=S.country||'';

  // সব platform parallel fetch
  const settled = await Promise.all(
    Object.entries(ALL_WALLS_MAP).map(([wid,cfg])=>fetchOnePlatform(wid,cfg.platform,uid,cc))
  );

  // Custom offers (Admin থেকে add করা) also merge করো
  const customOffs = await fetchCustomOffers(false);

  let merged = [...settled.flat(), ...customOffs];

  // Duplicate বাদ
  const seen=new Set();
  merged=merged.filter(o=>{
    const k=(o.title||'').trim().toLowerCase();
    if(!k||seen.has(k)) return false;
    seen.add(k); return true;
  });

  shuffleArr(merged);
  S.allOffers=merged; S.allOffersLoading=false; S.allOffersLoaded=true;
  saveOffersCache(merged);
  renderAllOffers();
}

function renderAllOffers(){
  const wrap = document.getElementById('offersFeed');
  const statTotal = document.getElementById('offersStatTotal');
  if(!wrap) return;

  if(S.allOffersLoading){
    wrap.innerHTML = Array(4).fill('<div class="uof-skel"></div>').join('');
    if(statTotal) statTotal.textContent = '…';
    return;
  }

  const q = (S.allOffersSearch||'').trim().toLowerCase();
  let list = S.allOffers;
  if(q) list = list.filter(o=>(o.title||'').toLowerCase().includes(q) || (o.category||'').toLowerCase().includes(q));

  if(statTotal) statTotal.textContent = S.allOffers.length;

  if(!list.length){
    wrap.innerHTML = `<div class="empty">
      <div class="ein">${q?'🔍':'📭'}</div>
      <div class="etx">${q?'No offers match your search.':'No offers available right now — check back in a few minutes.'}</div>
    </div>`;
    return;
  }

  wrap.innerHTML = list.map(o=>{
    const pay = getUserPayout(o.payout);
    const desc = escapeHtml((o.desc||'').replace(/<[^>]*>/g,'').trim());
    return `<div class="uof-card" onclick="openRSSOffer('${encodeURIComponent(o.link)}','${o._w}')">
      <div class="uof-ic">${o.img?`<img src="${escapeHtml(o.img)}" alt="" onerror="this.parentNode.textContent='🎯'">`:'🎯'}</div>
      <div class="uof-mid">
        <div class="uof-title">${escapeHtml(o.title)}</div>
        ${desc?`<div class="uof-desc">${desc}</div>`:''}
        ${o.category?`<span class="uof-tag">${escapeHtml(o.category)}</span>`:''}
      </div>
      <div class="uof-r">
        <div class="uof-pay">+$${pay.toFixed(2)}</div>
        <div class="uof-go">Start →</div>
      </div>
    </div>`;
  }).join('');
}

// ─── NOTICE AD GATE ───────────────────────────────────
function viewNotice(notice){
  S.currentNotice=notice;
  // Must watch ad first
  startAd(null,'notice',()=>showNoticeFinal(notice));
}

async function showNoticeFinal(notice){
  $('#nmTtl').textContent='📢 '+T('ns');
  $('#nmTxt').textContent=notice.text;
  $('#nmDt').textContent=timeAgo(notice.createdAt);
  $('#nm').style.display='flex';
  // Mark as read in Supabase
  if(S.user){
    // Store readNotices as JSON in users row
    const uSnap=await fDB.ref(`users/${S.user.uid}`).once('value');
    const ud=uSnap.val()||{};
    const rn=ud.readNotices||{};
    rn[notice.id]=true;
    await fDB.ref(`users/${S.user.uid}`).update({readNotices:rn});
  }
}

window.EZ={
  closeNM: function() {
  $('#nm').style.display = 'none';
  S.currentNotice = null;
  render();
},
  closeLM:()=>{ $('#lm').style.display='none'; render(); },
  openLM:()=>{
    buildLangModal();
    $('#lm').style.display='flex';
  },
};

function buildLangModal(){
  const grid=$('#lgd'); if(!grid) return;
  grid.innerHTML='';
  Object.entries(LANGS).forEach(([code,cfg])=>{
    const btn=el('button',`lb3${S.lang===code?' sel':''}`,'');
    btn.innerHTML=`<span style="font-size:22px">${cfg.f}</span><div><div style="font-weight:600;font-size:13px">${cfg.n}</div></div>`;
    btn.onclick=()=>{
      applyLang(code);
      // Save to Supabase if logged in
      if(S.user) fDB.ref(`users/${S.user.uid}/lang`).set(code);
      toast(T('setLang'),'s');
      EZ.closeLM();
    };
    grid.appendChild(btn);
  });
}

// ─── COUNTRY DETECT ───────────────────────────────────
async function _fetchCountryJson(url, pick){
  const ctl = (typeof AbortController!=='undefined') ? new AbortController() : null;
  const t = ctl ? setTimeout(()=>ctl.abort(), 5000) : null;
  try{
    const r = await fetch(url, ctl ? {signal:ctl.signal} : undefined);
    const d = await r.json();
    return String(pick(d)||'').toUpperCase();
  } finally { if(t) clearTimeout(t); }
}
async function detectCountry(){
  let cc='';
  // একটার পর একটা সার্ভিস — একটা বন্ধ থাকলে পরেরটা
  const sources = [
    ['https://country-check.therockvai-textbd2025.workers.dev', d=>d.country],
    ['https://ipwho.is/',                                        d=>d.country_code],
    ['https://ipapi.co/json/',                                   d=>d.country_code],
  ];
  for(const [url,pick] of sources){
    try{ cc = await _fetchCountryJson(url,pick); if(cc && cc.length===2) break; cc=''; }catch(e){}
  }
  // সব সার্ভিস ফেল করলে ফোনের টাইমজোন দিয়ে অন্তত বাংলাদেশ চেনা
  if(!cc){
    try{
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if(tz==='Asia/Dhaka' || tz==='Asia/Dacca') cc='BD';
    }catch(e){}
  }
  const prev = S.country;
  S.country = cc;
  let earn=CFG.earnDef;
  if(CFG.earnCountry[cc]) earn=CFG.earnCountry[cc];
  else if(CFG.hiCC.includes(cc)) earn=CFG.earnHi;
  S.countryEarn=earn;
  if(cc && S.user && S.userData){
    try{
      fDB.ref(`users/${S.user.uid}/country`).set(cc);
      fDB.ref(`users/${S.user.uid}/countryEarn`).set(earn);
    }catch(e){}
  }
  // wallet খোলা থাকলে দেশ বদলালে মেথড লিস্ট (bKash/Nagad) ঠিক করতে আবার আঁকা
  if(cc && cc!==prev && S.page==='wallet' && !S.adActive){ try{ render(); }catch(e){} }
  return cc;
}

// ─── SUPABASE DB HELPERS ─────────────────────────────
