// ⚠️ ফিক্স: App-এর প্রায় ২২টা জায়গায় সরাসরি `S.page='x';render();` লেখা
// আছে, navTo() ব্যবহার না করেই (যেমন leaderboard/offers/home-এর অনেক
// শর্টকাট বাটন) — সেই পথগুলোতে navTo()-এর ভেতরের page-entry-ad চেক
// একদমই ট্রিগার হতো না। এখানে render()-এ একটা fallback হুক যোগ করা
// হলো, যাতে S.page যেভাবেই বদলাক না কেন (navTo() দিয়ে হোক বা সরাসরি),
// page-entry ad ঠিকভাবে ট্রিগার হয়। maybeShowPageEntryAd() নিজেই
// cooldown/skip-list চেক করে, তাই navTo() থেকে ইতিমধ্যে কল হয়ে থাকলে
// এখানে আবার কল হলেও কোনো সমস্যা নেই (দ্বিতীয়বার চুপচাপ স্কিপ হয়ে যাবে)।
let _lastRenderedPageForAd = null;
function render(){
  if(S.page !== _lastRenderedPageForAd){
    _lastRenderedPageForAd = S.page;
    maybeShowPageEntryAd(S.page); // fire-and-forget — render() ব্লক করবে না
  }
  try{
    // auth পেজে ইন্ডিগো স্ট্যাটাস বার, অ্যাপের ভেতরে আগের নীল
    const _authPg = ['login','register','verify','forgot','resetOtp'].includes(S.page);
    setStatusBarColor((!S.user || S.page==='verify' || S.page==='resetOtp') && _authPg ? '#303f9f' : '#2563eb');
  }catch(e){}
  try{
    if(!S.user || S.page==='verify' || S.page==='resetOtp'){
      renderAuth();
    } else {
      renderApp();
    }
  }catch(err){
    // কোনো পেজ বানাতে গিয়ে error হলে সাদা স্ক্রিনের বদলে Retry/Logout বাটন দেখাবে
    console.error('Render error:', err);
    showRenderFallback(err);
  }
}

function setStatusBarColor(color){
  try{
    const SB = window.Capacitor?.Plugins?.StatusBar;
    if(SB) SB.setBackgroundColor({ color });
  }catch(e){}
}

function showRenderFallback(err){
  const ldr=document.getElementById('ldr');
  const app=document.getElementById('app');
  if(ldr) ldr.style.display='none';
  if(!app) return;
  app.style.display='block';
  app.innerHTML=`<div style="padding:40px 24px;text-align:center;font-family:sans-serif">
    <div style="font-size:42px;margin-bottom:10px">⚠️</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:8px">Something went wrong</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:20px;word-break:break-word">${String(err&&err.message||err).replace(/</g,'&lt;')}</div>
    <button class="btn bp" style="margin-bottom:10px" onclick="location.reload()">Retry</button>
    <button class="btn bh" onclick="doLogout()">Logout</button>
  </div>`;
}

function renderAuth(){
  const app=$('#app');
  const dir=LANGS[S.lang]?.d||'ltr';
  if(S.page==='welcome') {
    if(!hasSelectedLang()){
      app.innerHTML = buildLangSelect();
      return;
    }
    app.innerHTML=buildWelcome(); loadWelcomeStats();
  }
  else if(S.page==='login') app.innerHTML=buildLogin();
  else if(S.page==='register') app.innerHTML=buildRegister();
  else if(S.page==='verify') app.innerHTML=buildVerify();
  else if(S.page==='forgot') app.innerHTML=buildForgot();
  else if(S.page==='resetOtp') app.innerHTML=buildResetOtp();
  else { S.page='welcome'; app.innerHTML=buildWelcome(); }
  attachAuthEvents();
}

// ─── WELCOME / INTRO SCREEN ───────────────────────────
async function loadWelcomeStats(){
  try{
    // Direct Supabase call — stats table থেকে data নেয়
    const {data, error} = await sb.from('stats').select('total_users,total_earned').eq('id','stats').maybeSingle();
    const userCount = data?.total_users || 0;
    const totalEarned = data?.total_earned || 0;
    // Update DOM
    const el1 = document.getElementById('wlUserCount');
    const el2 = document.getElementById('wlEarned');
    const el3 = document.getElementById('wlOnline');
    if(el1) el1.textContent = userCount.toLocaleString();
    if(el2) el2.textContent = '$'+parseFloat(totalEarned).toFixed(2);
    if(el3) el3.textContent = '🟢 LIVE — '+userCount.toLocaleString()+' Members';
  } catch(e){ /* stats load error — silent */ }
}

// ── LANGUAGE SELECTION SCREEN (first-time, unregistered only) ──
const LANG_SELECT_KEY = 'ez_lang_selected';

function hasSelectedLang(){
  return !!localStorage.getItem(LANG_SELECT_KEY);
}

function buildLangSelect(){
  const langs = Object.entries(LANGS).map(([code,cfg])=>`
    <button onclick="selectLangFirst('${code}')"
      style="display:flex;align-items:center;gap:14px;width:100%;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);border-radius:16px;padding:14px 16px;cursor:pointer;transition:background .18s;text-align:left;margin-bottom:10px"
      onmouseover="this.style.background='rgba(255,255,255,.14)'"
      onmouseout="this.style.background='rgba(255,255,255,.07)'">
      <span style="font-size:28px;flex-shrink:0">${cfg.f||'🌐'}</span>
      <div>
        <div style="font-weight:700;font-size:15px;color:#fff">${cfg.n||code}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">${cfg.t?.langName||cfg.n||''}</div>
      </div>
      <span style="margin-left:auto;font-size:18px;color:rgba(255,255,255,.4)">›</span>
    </button>`).join('');

  return `<div style="min-height:100vh;background:linear-gradient(145deg,#0f172a,#1e3a5f);padding:40px 20px 30px;display:flex;flex-direction:column">
    <div style="text-align:center;margin-bottom:30px">
      <div style="font-size:42px;margin-bottom:12px">🌐</div>
      <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff;margin-bottom:8px">Choose Your Language</div>
      <div style="font-size:13px;color:rgba(255,255,255,.5)">আপনার ভাষা বেছে নিন • Select your language</div>
    </div>
    <div style="flex:1">${langs}</div>
  </div>`;
}

function selectLangFirst(code){
  applyLang(code);
  localStorage.setItem(LANG_SELECT_KEY, '1');
  S.page = 'welcome';
  render();
}

function buildWelcome(){
  return `
  <div style="min-height:100vh;background:linear-gradient(160deg,#0f172a 0%,#1e3a5f 50%,#064e3b 100%);display:flex;flex-direction:column;align-items:center;padding:0 0 40px">

    <!-- Header -->
    <div style="width:100%;padding:18px 20px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:#fff">◆ EARNOVA</div>
      <button onclick="S.page='login';renderAuth()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:7px 16px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">${T('loginBtn')}</button>
    </div>

    <!-- Hero -->
    <div style="text-align:center;padding:20px 24px 0;max-width:480px;width:100%">
      <div id="wlOnline" style="display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);border-radius:20px;padding:5px 14px;font-size:11px;font-weight:700;color:#4ade80;margin-bottom:16px;letter-spacing:.04em">🟢 Loading…</div>
      <h1 style="font-family:'Syne',sans-serif;font-size:30px;font-weight:800;color:#fff;line-height:1.25;margin-bottom:12px">${T('heroTitle1')}<br><span style="background:linear-gradient(90deg,#2563eb,#22c55e);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${T('heroTitle2')}</span></h1>
      <p style="font-size:13px;color:rgba(255,255,255,.65);line-height:1.7;margin-bottom:24px">${T('heroSub')}</p>

      <!-- Stats — Real Supabase data -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:24px">
        <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 8px;text-align:center">
          <div id="wlUserCount" style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#22c55e">…</div>
          <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:3px">${T('statMembers')}</div>
        </div>
        <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 8px;text-align:center">
          <div id="wlEarned" style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#2563eb">…</div>
          <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:3px">${T('statPaid')}</div>
        </div>
        <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 8px;text-align:center">
          <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#f59e0b">150+</div>
          <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:3px">${T('statCountries')}</div>
        </div>
      </div>

      <!-- YouTube Tutorial -->
      <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px;margin-bottom:22px;text-align:left">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">${T('tutorialTitle')}</div>
        <div style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000">
          <iframe
            style="position:absolute;top:0;left:0;width:100%;height:100%;border:none"
            src="https://www.youtube.com/embed/VIDEO_ID_HERE"
            title="How to earn on EARNOVA"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:8px;text-align:center">${T('tutorialNote')}</div>
      </div>

      <!-- How it works -->
      <div style="text-align:left;margin-bottom:22px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">${T('howWorksTitle')}</div>
        ${[['1️⃣',T('step1Title'),T('step1Desc')],['2️⃣',T('step2Title'),T('step2Desc')],['3️⃣',T('step3Title'),T('step3Desc')],['4️⃣',T('step4Title'),T('step4Desc')]].map(([n,t,d])=>`
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div style="font-size:22px;flex-shrink:0">${n}</div>
          <div><div style="font-size:13px;font-weight:700;color:#fff">${t}</div><div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">${d}</div></div>
        </div>`).join('')}
      </div>

      <!-- Buttons -->
      <!-- ── User Reviews ── -->
      <div style="margin-bottom:20px;text-align:left">
        <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:#fff;margin-bottom:4px;text-align:center">${T('reviewsTitle')}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);text-align:center;margin-bottom:12px">${T('reviewsSub')}</div>
        <!-- ══ Trustpilot Widget — account খুলে script পেলে নিচে বসান ══ -->
        <!-- TRUSTPILOT_WIDGET_START -->
        <!-- TRUSTPILOT_WIDGET_END -->

        ${[
          {n:'Rahim Uddin',    av:'R', gr:'#2563eb,#059669', tx:'"মাত্র ৩ দিনে $5 আয় করলাম। bKash-এ Withdraw ১ ঘণ্টায়। অসাধারণ প্ল্যাটফর্ম!"', dt:'2 days ago'},
          {n:'Sumaiya Khatun', av:'S', gr:'#7c3aed,#ec4899', tx:'"Real money দেয়! Survey করি আর ঘরে বসে আয় করি। সেরা earning app!"', dt:'3 days ago'},
          {n:'Arif Hossain',   av:'A', gr:'#f59e0b,#ef4444', tx:'"Referral করে extra income হচ্ছে। প্রতিদিন login bonus পাই। Highly recommended!"', dt:'5 days ago'},
          {n:'Nusrat Jahan',   av:'N', gr:'#06b6d4,#2563eb', tx:'"Binance-এ Withdraw করলাম, খুব সহজ। Offers গুলো real আর পেমেন্ট সময়মতো আসে।"', dt:'1 week ago'},
          {n:'Karim Sheikh',   av:'K', gr:'#10b981,#2563eb', tx:'"বন্ধুদের refer করে মাসে extra $10+ আয় হচ্ছে। সবাইকে recommend করব।"', dt:'1 week ago'},
          {n:'Fatema Begum',   av:'F', gr:'#e11d48,#f59e0b', tx:'"Social task গুলো অনেক সহজ। YouTube subscribe করে $0.50 পেলাম। ভরসার জায়গা।"', dt:'2 weeks ago'},
          {n:'Jamal Uddin',    av:'J', gr:'#8b5cf6,#06b6d4', tx:'"প্রতিদিন Daily Bonus আসে। Offers complete করলে সাথে সাথে balance যোগ হয়। Great!"', dt:'2 weeks ago'},
          {n:'Roksana Akter',  av:'R', gr:'#059669,#2563eb', tx:'"USDT-তে withdraw করলাম, ২৪ ঘণ্টার মধ্যে পেলাম। সবচেয়ে reliable earning site!"', dt:'3 weeks ago'},
          {n:'Milon Haque',    av:'M', gr:'#dc2626,#7c3aed', tx:'"Survey করে আর offer complete করে মাসে $20+ আয় হচ্ছে। Withdraw এ কোনো সমস্যা নেই।"', dt:'3 weeks ago'},
          {n:'Sharmin Akter',  av:'S', gr:'#0284c7,#10b981', tx:'"App টা use করা অনেক সহজ। Nagad-এ withdraw পেলাম ১ ঘণ্টায়। Excellent service!"', dt:'1 month ago'},
        ].map(r=>`
          <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:13px 14px;margin-bottom:9px">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,${r.gr});display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;font-weight:800;flex-shrink:0">${r.av}</div>
              <div><div style="font-size:12px;font-weight:700;color:#fff">${r.n}</div><div style="font-size:10px;color:#f59e0b">⭐⭐⭐⭐⭐</div></div>
              <div style="margin-left:auto;font-size:10px;color:rgba(255,255,255,.35)">${r.dt}</div>
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,.65);line-height:1.6">${r.tx}</div>
          </div>`).join('')}
      </div>

      <button onclick="S.page='register';renderAuth()" style="width:100%;background:linear-gradient(135deg,#2563eb,#059669);border:none;border-radius:14px;padding:15px;font-size:15px;font-weight:800;color:#fff;cursor:pointer;font-family:'Syne',sans-serif;box-shadow:0 6px 24px rgba(37,99,235,.4);margin-bottom:10px">${T('startEarningBtn')}</button>
      <button onclick="S.page='login';renderAuth()" style="width:100%;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.2);border-radius:14px;padding:13px;font-size:14px;font-weight:600;color:#fff;cursor:pointer;font-family:'DM Sans',sans-serif">${T('alreadyLoginBtn')}</button>
      <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:16px;line-height:1.6">${T('legalAgree')} <a href="terms.html" onclick="openLink('terms.html');return false;" style="color:#2563eb">${T('termsWord')}</a> ${T('andWord')} <a href="privacy.html" onclick="openLink('privacy.html');return false;" style="color:#2563eb">${T('privacyWord')}</a></div>
    </div>
  </div>`;
}

// ─── LOGIN PAGE ───────────────────────────────────────
// ⚠️ নতুন — Google/Facebook বাটন (Login ও Register দুই ফর্মেই ব্যবহার হয়)
function buildSocialButtons(){
  return `
  <div style="display:flex;align-items:center;gap:10px;margin:18px 0 14px">
    <div style="flex:1;height:1px;background:#e2e8f0"></div>
    <span style="font-size:12px;color:#94a3b8;font-weight:600">${T('orDivider')}</span>
    <div style="flex:1;height:1px;background:#e2e8f0"></div>
  </div>
  <button type="button" class="btn bh mb12 soc-btn" id="socGoogleBtn" style="display:flex;align-items:center;justify-content:center;gap:10px">
    <span style="width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #dbeafe;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#ea4335;flex-shrink:0">G</span>
    <span>${T('googleBtn')}</span>
  </button>
  <button type="button" class="btn bh mb12 soc-btn" id="socFacebookBtn" style="display:flex;align-items:center;justify-content:center;gap:10px">
    <span style="width:20px;height:20px;border-radius:50%;background:#1877f2;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0">f</span>
    <span>${T('facebookBtn')}</span>
  </button>`;
}

// ⚠️ নতুন — Cloudflare Turnstile CAPTCHA বক্স (Supabase Attack Protection
// চালু থাকলে দরকার হয়; না থাকলেও বক্সটা দেখাতে সমস্যা নেই, শুধু টোকেন
// আনভেরিফায়েড থাকবে)। প্রতিটা ফর্মের জন্য আলাদা container id লাগে।
function buildCaptchaBox(containerId){
  return `<div id="${containerId}" class="cf-turnstile" style="margin-bottom:14px;display:flex;justify-content:center"></div>`;
}

/**
 * DOM-এ বসানোর পরে Turnstile widget রেন্ডার করে এবং টোকেন পেলে callback
 * চালায়। Turnstile স্ক্রিপ্ট (index.html এ যোগ করা) লোড না হলে চুপচাপ
 * স্কিপ করে — অ্যাপ ভেঙে পড়বে না, শুধু captchaToken খালি থাকবে।
 * @param {string} containerId
 * @param {(token:string)=>void} onToken
 */
function renderCaptcha(containerId, onToken){
  const el = document.getElementById(containerId);
  if(!el) return;
  // ⚠️ capacitor.config.json/README এর নির্দেশ অনুযায়ী নিজের Turnstile
  // site key এখানে বসাতে হবে — placeholder থাকলে widget দেখাবে না।
  const TURNSTILE_SITE_KEY = '0x4AAAAAAAFBcA3dirF11ug29';
  if(!TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY.includes('PASTE_YOUR')){
    console.warn('⚠️ Turnstile site key সেট করা হয়নি — captcha বক্স স্কিপ করা হলো।');
    return;
  }
  if(typeof turnstile === 'undefined'){
    console.warn('⚠️ Turnstile script লোড হয়নি — index.html চেক করুন।');
    return;
  }
  try{
    turnstile.render(`#${containerId}`, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token)=>{ onToken(token); },
      'expired-callback': ()=>{ onToken(''); },
      'error-callback': ()=>{ onToken(''); }
    });
  }catch(e){ console.warn('Turnstile render failed', e); }
}

// ══════════════════════════════════════════════════════════
//  AUTH PAGES — নতুন ডিজাইন (Indigo app bar + হালকা নীল ব্যাকগ্রাউন্ড + নীল কার্ড)
//  সব ID (lgEm, lgPw, rgBtn, veOtp ...) আগের মতোই — শুধু চেহারা বদলেছে
// ══════════════════════════════════════════════════════════
function axShell(title, inner, footer){
  return `<div class="ax">
    <div class="ax-bar"><div class="ax-bar-t">${title}</div></div>
    <div class="ax-body">
      <img class="ax-logo" src="icon.png" alt="" onerror="this.style.display='none'">
      <div class="ax-brand">${T('appName')}</div>
      <div class="ax-tag">${T('appTag')}</div>
      <div class="ax-card">${inner}</div>
      ${footer||''}
    </div>
  </div>`;
}
// সাদা pill ইনপুট + নিচে গোলাপি underline; chkId থাকলে ডানে "পাসওয়ার্ড দেখান" চেকবক্স
function axField(label, id, type, ph, extra, chkId){
  const chk = chkId ? `<input type="checkbox" class="ax-chk" id="${chkId}" onclick="axTogglePw('${id}',this)" aria-label="show password">` : '';
  return `<label class="ax-lbl" for="${id}">${label}</label>
  <div class="ax-f${chkId?' has-chk':''}"><input class="ax-inp" id="${id}" type="${type}" placeholder="${ph||''}" ${extra||''}>${chk}</div>`;
}
function axTogglePw(id, cb){
  const p=document.getElementById(id);
  if(p) p.type = cb.checked ? 'text' : 'password';
}
function buildSocialButtons(){
  return `<div class="ax-or"><span>${T('orDivider')}</span></div>
  <button type="button" class="ax-soc" id="socGoogleBtn">
    <span class="ax-soc-i" style="background:#fff;color:#ea4335;border:1px solid #dbeafe">G</span><span>${T('googleBtn')}</span>
  </button>
  <button type="button" class="ax-soc" id="socFacebookBtn">
    <span class="ax-soc-i" style="background:#1877f2;color:#fff">f</span><span>${T('facebookBtn')}</span>
  </button>`;
}

function buildLogin(){
  return axShell(T('li'), `
  <div class="ax-h1">${T('li')}</div>
  ${axField(T('em'),'lgEm','email','you@email.com','autocomplete="email"')}
  ${axField(T('pw'),'lgPw','password','','autocomplete="current-password"','lgEye')}
  <div style="text-align:right;margin:2px 6px 8px"><button type="button" class="ax-link ax-link-w" id="lgFP">${T('fp')}</button></div>
  ${buildCaptchaBox('lgCaptcha')}
  <div class="ax-actions"><button type="button" class="ax-btn" id="lgBtn">${T('li')}</button></div>
  ${buildSocialButtons()}
  <div style="text-align:center;margin-top:14px"><button type="button" class="ax-link ax-link-w" id="lgLang">${T('languageBtn')}</button></div>
  `, `<div class="ax-foot">${T('na')} <button type="button" class="ax-link" id="lgToReg">${T('reg')}</button>
  <div class="ax-legal"><a href="privacy.html" onclick="openLink('privacy.html');return false;">${T('privacyPolicyLink')}</a> &nbsp;•&nbsp; <a href="terms.html" onclick="openLink('terms.html');return false;">${T('termsOfServiceLink')}</a></div></div>`);
}

function buildRegister(){
  // URL থেকে referral code auto-fill
  const urlRef = new URLSearchParams(window.location.search).get('ref')||
                 new URLSearchParams(window.location.search).get('r')||'';
  if(urlRef && !S.regRefCode) S.regRefCode = urlRef.toUpperCase();
  return axShell(T('reg'), `
  <div class="ax-h1">${T('reg')}</div>
  ${axField(T('nm'),'rgNm','text',T('namePlaceholder'),'autocomplete="name"')}
  ${axField(T('em'),'rgEm','email','you@email.com','autocomplete="email"')}
  ${axField(T('pw'),'rgPw','password',T('pwMinPlaceholder'),'autocomplete="new-password"','rgEye')}
  ${axField(T('cpw'),'rgCpw','password',T('repeatPwPlaceholder'),'autocomplete="new-password"','rgEye2')}
  ${axField(T('rc'),'rgRef','text','XXXXXX',`value="${S.regRefCode||''}"`)}
  <div class="ax-promo">${T('regPromo')}</div>
  ${buildCaptchaBox('rgCaptcha')}
  <div class="ax-actions"><button type="button" class="ax-btn" id="rgBtn">${T('reg')}</button></div>
  ${buildSocialButtons()}
  `, `<div class="ax-foot">${T('ha')} <button type="button" class="ax-link" id="rgToLi">${T('li')}</button>
  <div class="ax-legal">${T('legalAgree')}
    <a href="terms.html" onclick="openLink('terms.html');return false;">${T('termsWord')}</a> ${T('andWord')}
    <a href="privacy.html" onclick="openLink('privacy.html');return false;">${T('privacyWord')}</a></div>
  <div class="ax-legal"><a href="services.html" onclick="openLink('services.html');return false;">${T('choiceServiceTitle')}</a></div></div>`);
}

function selectChoice(type){
  const wCard = document.getElementById('choiceWorker');
  const eCard = document.getElementById('choiceEmployer');
  if(type==='worker'){
    wCard.style.borderColor='#2563eb'; wCard.style.background='#eff6ff';
    wCard.querySelector('div:nth-child(2)').style.color='#2563eb';
    eCard.style.borderColor='#dbeafe'; eCard.style.background='#fff';
    eCard.querySelector('div:nth-child(2)').style.color='#475569';
    document.getElementById('workerForm').style.display='block';
  } else {
    // Employer — go to services page directly
    openLink('services.html');
  }
}

//  OTP ভেরিফিকেশন পেজ (রেজিস্টারের পর ইমেইলে আসা কোড)
function buildVerify(){
  return axShell(T('otpTitle'), `
  <div class="ax-h1">${T('otpTitle')}</div>
  <p class="ax-p">${T('otpDesc')}</p>
  <div class="ax-f"><input class="ax-inp ax-otp" id="veOtp" type="text" inputmode="numeric" maxlength="10" placeholder="${T('otpPlaceholder')}" autocomplete="one-time-code"></div>
  <div class="ax-actions"><button type="button" class="ax-btn" id="veChk">${T('otpSubmit')}</button></div>
  <div class="ax-actions"><button type="button" class="ax-btn ax-btn-w" id="veRe">${T('re')}</button></div>
  <div class="ax-actions"><button type="button" class="ax-btn ax-btn-r" id="veLo">${T('lo')}</button></div>
  `);
}

//  পাসওয়ার্ড ভুলে গেলে: ইমেইল দিয়ে OTP পাঠানো
function buildForgot(){
  return axShell(T('rp'), `
  <div class="ax-h1">${T('rp')}</div>
  <p class="ax-p ax-p-note">${T('fpn')}</p>
  ${axField(T('em'),'fpEm','email',T('registeredEmailPlaceholder'))}
  ${buildCaptchaBox('fpCaptcha')}
  <div class="ax-actions"><button type="button" class="ax-btn" id="fpBtn">${T('rp')}</button></div>
  <div class="ax-actions"><button type="button" class="ax-btn ax-btn-w" id="fpBack">${T('back')}</button></div>
  `);
}

//  পাসওয়ার্ড রিসেট: OTP + নতুন পাসওয়ার্ড
function buildResetOtp(){
  return axShell(T('resetOtpTitle'), `
  <div class="ax-h1">${T('resetOtpTitle')}</div>
  <p class="ax-p">${T('resetOtpDesc')}</p>
  <div class="ax-f"><input class="ax-inp ax-otp" id="roOtp" type="text" inputmode="numeric" maxlength="10" placeholder="${T('otpPlaceholder')}" autocomplete="one-time-code"></div>
  ${axField(T('newPasswordPlaceholder'),'roPw','password',T('pwMinPlaceholder'),'autocomplete="new-password"','roEye')}
  <div class="ax-actions"><button type="button" class="ax-btn" id="roBtn">${T('resetOtpSubmit')}</button></div>
  <div class="ax-actions"><button type="button" class="ax-btn ax-btn-w" id="roBack">${T('back')}</button></div>
  `);
}

async function attachAuthEvents(){
  // ⚠️ নতুন — প্রতিটা captcha widget-এর সর্বশেষ টোকেন এখানে জমা থাকে।
  // attachAuthEvents() প্রতিবার render()-এর পর নতুন করে কল হয়, তাই এই
  // ভ্যারিয়েবলগুলো প্রতি রেন্ডারে ফ্রেশ হয়ে যায় — পুরনো টোকেন কখনো
  // পরের ফর্মে "লিক" করে না।
  let lgCaptchaToken='', rgCaptchaToken='', fpCaptchaToken='';

  // Login
  const lgBtn=$('#lgBtn');
  if(lgBtn){
    renderCaptcha('lgCaptcha', (tok)=>{ lgCaptchaToken=tok; });
    lgBtn.onclick=async()=>{
      const email=$('#lgEm').value.trim();
      const pw=$('#lgPw').value;
      if(!email||!pw){ toast(T('fillAllFieldsMsg'),'e'); return; }
      lgBtn.disabled=true;
      lgBtn.innerHTML='<span style="display:inline-flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .7s linear infinite"><path d="M12 2a10 10 0 0 1 10 10"/></svg> Logging in…</span>';
      await doLogin(email,pw,lgCaptchaToken);
      lgBtn.disabled=false;
      lgBtn.textContent=T('li');
    };
    $('#lgEye').onclick=()=>{ const p=$('#lgPw'); p.type=p.type==='password'?'text':'password'; };
    $('#lgFP').onclick=()=>{ S.page='forgot'; render(); };
    $('#lgToReg').onclick=()=>{ S.page='register'; render(); };
    $('#lgLang').onclick=()=>EZ.openLM();
    $('#socGoogleBtn').onclick=()=>signInWithGoogle();
    $('#socFacebookBtn').onclick=()=>signInWithFacebook();
  }
  // Register
  const rgBtn=$('#rgBtn');
  if(rgBtn){
    renderCaptcha('rgCaptcha', (tok)=>{ rgCaptchaToken=tok; });
    // ── Auto-fill referral code from URL param or localStorage ──
    const rgRefEl=$('#rgRef');
    if(rgRefEl && !rgRefEl.value){
      const savedRef=localStorage.getItem('ez_ref')||'';
      if(savedRef){
        rgRefEl.value=savedRef;
        // Helpful hint (ইনপুটের pill-এর বাইরে বসবে)
        const hint=document.createElement('div');
        hint.style.cssText='font-size:12px;font-weight:700;color:#fff;text-align:center;margin:6px 0 8px';
        hint.textContent='✅ Referral code applied automatically!';
        const anchor = rgRefEl.closest('.ax-f') || rgRefEl;
        anchor.parentNode.insertBefore(hint, anchor.nextSibling);
      }
    }
    rgBtn.onclick=async()=>{
      const nm=$('#rgNm').value.trim(),em=$('#rgEm').value.trim(),
            pw=$('#rgPw').value,cpw=$('#rgCpw').value,ref=$('#rgRef').value.trim();
      if(!nm||!em||!pw){ toast(T('fillAllFieldsMsg'),'e'); return; }
      if(pw.length<6){ toast(T('pwMin6CharsMsg'),'e'); return; }
      if(pw!==cpw){ toast(T('pwMismatchMsg'),'e'); return; }
      rgBtn.disabled=true;
      rgBtn.innerHTML='<span style="display:inline-flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .7s linear infinite"><path d="M12 2a10 10 0 0 1 10 10"/></svg> Creating account…</span>';
      await doRegister(nm,em,pw,ref,rgCaptchaToken);
      rgBtn.disabled=false; rgBtn.textContent=T('reg');
    };
    $('#rgEye').onclick=()=>{ const p=$('#rgPw'); p.type=p.type==='password'?'text':'password'; };
    $('#rgToLi').onclick=()=>{ S.page='login'; render(); };
    $('#socGoogleBtn').onclick=()=>signInWithGoogle();
    $('#socFacebookBtn').onclick=()=>signInWithFacebook();
  }
  // ⚠️ ফিক্স: Verify — এখন OTP কোড দিয়ে, sb.auth.getUser() এর বদলে
  // verifySignupOtp()/resendSignupOtp() ব্যবহার করে, আর fAuth.currentUser
  // এর বদলে S.verifyEmail থেকে email নেয় (sign-out এর পরেও টিকে থাকে)
  const veChk=$('#veChk');
  if(veChk){
    const email = S.verifyEmail || fAuth.currentUser?.email || '';
    veChk.onclick=async()=>{
      const otp=$('#veOtp').value.trim();
      if(!email){ toast(T('otpInvalid'),'e'); return; }
      veChk.disabled=true; veChk.textContent='...';
      await verifySignupOtp(email, otp);
      veChk.disabled=false; veChk.textContent=T('otpSubmit');
    };
    $('#veRe').onclick=async()=>{
      if(!email){ toast(T('otpInvalid'),'e'); return; }
      await resendSignupOtp(email);
    };
    $('#veLo').onclick=()=>doLogout();
  }
  // Forgot — ধাপ ১: কোড চাওয়া
  const fpBtn=$('#fpBtn');
  if(fpBtn){
    renderCaptcha('fpCaptcha', (tok)=>{ fpCaptchaToken=tok; });
    fpBtn.onclick=async()=>{
      fpBtn.disabled=true; fpBtn.textContent='Sending…';
      await doForgotPw($('#fpEm').value.trim(), fpCaptchaToken);
      fpBtn.disabled=false; fpBtn.textContent=T('rp');
    };
    $('#fpBack').onclick=()=>{ S.page='login'; render(); };
  }
  // ⚠️ নতুন — Forgot ধাপ ২: কোড + নতুন পাসওয়ার্ড
  const roBtn=$('#roBtn');
  if(roBtn){
    roBtn.onclick=async()=>{
      const otp=$('#roOtp').value.trim();
      const newPw=$('#roPw').value;
      const email = S.resetEmail || '';
      if(!email){ toast(T('otpInvalid'),'e'); S.page='forgot'; render(); return; }
      roBtn.disabled=true; roBtn.textContent='...';
      await confirmPasswordResetOtp(email, otp, newPw);
      roBtn.disabled=false; roBtn.textContent=T('resetOtpSubmit');
    };
    $('#roEye').onclick=()=>{ const p=$('#roPw'); p.type=p.type==='password'?'text':'password'; };
    $('#roBack').onclick=()=>{ S.page='forgot'; render(); };
  }
}

// ─── MAIN APP RENDER ──────────────────────────────────
function renderApp(){
  if(!S.userData){ $('#app').innerHTML='<div class="ldr"><div class="sp"></div></div>'; return; }
  let html='';
  html+=buildNav();
  html+=`<div class="scr fu" id="scr">`;
  html+=`<div class="ctr" id="pgContent">`;
  // Pages
  if(S.page==='home') html+=buildHome();
  else if(S.page==='wallet') html+=buildWallet();
  else if(S.page==='offers') html+=buildOffers();
  else if(S.page==='referral') html+=buildReferralPage();
  else if(S.page==='offerwall') html+=buildOfferwallPage();
  else if(S.page==='profile') html+=buildProfile();
  else if(S.page==='admin' && S.userData?.isAdmin===true) html+=buildAdmin();
  else if(S.page==='notices') html+=buildNotices();
  else if(S.page==='faq') html+=buildFAQ();
  else if(S.page==='social') html+=buildSocialTasks();
  else if(S.page==='unlock') html+=buildUnlock(S.unlockWallId);
  else if(S.page==='wallview') html+=buildWallView(S.unlockWallId);
  else if(S.page==='wallframe') html+=buildWallFramePage();
  else if(S.page==='leaderboard') html+=buildLeaderboardPage();
  else html+=buildHome();
  // Universal review bar — সব logged-in page-এর নিচে
  if(S.user && !localStorage.getItem(REVIEW_LS_KEY)){
    html+=`<div style="margin:8px 16px 16px;background:linear-gradient(135deg,#fffbeb,#f0fdf4);border:1.5px solid #fde68a;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">⭐</span>
      <div style="flex:1;font-size:12px;color:#92400e;font-weight:600">${T('reviewBarText')}</div>
      <button onclick="showReviewPopup()" style="background:#f59e0b;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;color:#fff;cursor:pointer;flex-shrink:0">${T('reviewBarBtn')}</button>
    </div>`;
  }
  html+=`</div></div>`;
  html+=buildBottomNav();
  $('#app').innerHTML=html;
  attachAppEvents();
  // Auto-load page data
  if(S.page==='social') loadSocialTasks();
  if(S.page==='offers') updateWallCardStatuses();
}

function buildNav(){
  const ud=S.userData||{};
  const hasNotice=S.noticeQueue.length>0;
  const announcement = S.siteSettings?.announcement||'';
  const onlineCount = S.realUserCount || '…';
  const icoSun='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  const icoMoon='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  return `
  ${announcement?`<div style="background:linear-gradient(90deg,#1e40af,#065f46);color:#fff;font-size:11px;font-weight:600;padding:7px 16px;text-align:center;display:flex;align-items:center;justify-content:center;gap:8px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a2 2 0 1 1-3.2 2.4"/></svg> ${announcement} <button onclick="this.parentElement.style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:14px;margin-left:8px">✕</button></div>`:''}
  <nav class="nav">
  <button class="nav-mn" id="navMenu"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
  <div class="nav-bnd" id="navBrand">◆ ${T('appName')}</div>
  <div style="display:flex;align-items:center;gap:8px">
    <div style="display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#059669"><div style="width:6px;height:6px;border-radius:50%;background:#22c55e;animation:blink 1.5s infinite"></div><span id="navOnlineCount">${onlineCount}</span></div>
    <div class="nav-bal" id="navBal">${fmt$(ud.usdEarned||0)}</div>
  </div>
  <button onclick="toggleDarkMode()" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;padding:4px 6px" title="${T('darkModeTitle')}">${S.darkMode?icoSun:icoMoon}</button>
  <button class="nav-av${hasNotice?' nb-dot':''}" id="navAv">
    ${escapeHtml((ud.name||ud.email||'?')[0].toUpperCase())}
    ${hasNotice?'<div class="nav-nd"></div>':''}
  </button>
  </nav>`;
}

// ── Professional line-style icon set (নেভিগেশনের জন্য) ──
const NAV_ICONS = {
  home:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z"/></svg>',
  wallet:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.4"/></svg>',
  target:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
  globe:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>',
  social:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.6 8.6 0 0 1-3.3-.7L3 20l1-4.5a8.4 8.4 0 1 1 17-4z"/></svg>',
  users:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  user:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  bell:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  question:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4.9 2.4c-.8.6-1.5 1.1-1.5 2.1"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  trophy:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3a1 1 0 0 1 1 1 4 4 0 0 1-4 4M7 5H4a1 1 0 0 0-1 1 4 4 0 0 0 4 4"/></svg>',
  info:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  building:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><line x1="9" y1="8" x2="9" y2="8"/><line x1="15" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>',
  mail:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
  ticket:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9z"/><line x1="9" y1="7" x2="9" y2="17"/></svg>',
  gear:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

function buildBottomNav(){
  const pages=[
    {p:'home',ic:NAV_ICONS.home,lb:T('db')},
    {p:'wallet',ic:NAV_ICONS.wallet,lb:T('wl')},
    {p:'offers',ic:NAV_ICONS.target,lb:T('of')},
    {p:'offerwall',ic:NAV_ICONS.globe,lb:T('navWall')},
    {p:'social',ic:NAV_ICONS.social,lb:T('navSocial')},
    {p:'referral',ic:NAV_ICONS.users,lb:T('navRefer')},
    {p:'profile',ic:NAV_ICONS.user,lb:T('pr')},
  ];
  return `<nav class="bnav">${pages.map(pg=>`
  <button class="bni${S.page===pg.p?' on':''}" data-page="${pg.p}">
    <span class="ic">${pg.ic}</span><span class="lb">${pg.lb}</span>
  </button>`).join('')}</nav>`;
}

function buildSidebar(){
  const ud=S.userData||{};
  const icoLogout='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
  return `<div class="sov" id="sov"><div class="sdb">
  <div class="sdb-hd">◆ ${T('appName')}</div>
  <div class="sdb-sg">${T('sdbMain')}</div>
  <button class="si${S.page==='home'?' on':''}" data-page="home"><span class="si-ico">${NAV_ICONS.home}</span>${T('db')}</button>
  <button class="si${S.page==='wallet'?' on':''}" data-page="wallet"><span class="si-ico">${NAV_ICONS.wallet}</span>${T('wl')}</button>
  <button class="si${S.page==='offers'?' on':''}" data-page="offers"><span class="si-ico">${NAV_ICONS.target}</span>${T('of')}</button>
  <button class="si${S.page==='offerwall'?' on':''}" data-page="offerwall"><span class="si-ico">${NAV_ICONS.globe}</span>${T('sdbWallBtn')}</button>
  <button class="si${S.page==='social'?' on':''}" data-page="social"><span class="si-ico">${NAV_ICONS.social}</span>${T('sdbSocialTasks')}</button>
  <div class="sdb-sg">${T('sdbAccount')}</div>
  <button class="si${S.page==='profile'?' on':''}" data-page="profile"><span class="si-ico">${NAV_ICONS.user}</span>${T('pr')}</button>
  <button class="si${S.page==='notices'?' on':''}" data-page="notices"><span class="si-ico">${NAV_ICONS.bell}</span>${T('ns')} ${S.noticeQueue.length>0?`<span class="bdg bdr" style="margin-left:auto">${S.noticeQueue.length}</span>`:''}</button>
  <button class="si${S.page==='faq'?' on':''}" data-page="faq"><span class="si-ico">${NAV_ICONS.question}</span>${T('sdbFAQ')}</button>
  <button class="si${S.page==='leaderboard'?' on':''}" data-page="leaderboard"><span class="si-ico">${NAV_ICONS.trophy}</span>${T('sdbLeaderboard')}</button>
  <div class="sdb-sg">${T('sdbInfo')}</div>
  <a href="about.html" onclick="openLink('about.html');return false;" class="si" style="text-decoration:none;color:inherit"><span class="si-ico">${NAV_ICONS.building}</span>${T('sdbAboutUs')}</a>
  <a href="contact.html" onclick="openLink('contact.html');return false;" class="si" style="text-decoration:none;color:inherit"><span class="si-ico">${NAV_ICONS.mail}</span>${T('sdbContact')}</a>
  <a href="support.html" onclick="openLink('support.html');return false;" class="si" style="text-decoration:none;color:inherit"><span class="si-ico">${NAV_ICONS.ticket}</span>${T('sdbSupport')}</a>

  ${ud.isAdmin?`<div class="sdb-sg">${T('sdbAdmin')}</div><button class="si${S.page==='admin'?' on':''}" data-page="admin"><span class="si-ico">${NAV_ICONS.gear}</span>${T('ap')}</button>`:''}
  <div style="margin-top:auto;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)">
  <button class="si" onclick="toggleDarkMode()"><span class="si-ico">${S.darkMode?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'}</span>${S.darkMode?T('sdbLightMode'):T('sdbDarkMode')}</button>
  <button class="si" id="sbLang"><span class="si-ico">${NAV_ICONS.globe}</span>${T('ln')}: ${LANGS[S.lang]?.f||'🇺🇸'}</button>
  <button class="si" id="sbLo"><span class="si-ico">${icoLogout}</span>${T('lo')}</button>
  </div>
  </div></div>`;
}

// ─── HOME PAGE ────────────────────────────────────────

// ── QS Card helper functions (template-in-template fix) ──
const QS_COLOR_MAP = {
  '#ef4444':{bg:'#fee2e2',shadow:'rgba(239,68,68,.18)',bc:'#fca5a5'},
  '#8b5cf6':{bg:'#ede9fe',shadow:'rgba(139,92,246,.18)',bc:'#c4b5fd'},
  '#2563eb':{bg:'#dbeafe',shadow:'rgba(37,99,235,.18)',bc:'#93c5fd'},
  '#f59e0b':{bg:'#fef3c7',shadow:'rgba(245,158,11,.18)',bc:'#fde68a'},
  '#10b981':{bg:'#d1fae5',shadow:'rgba(16,185,129,.18)',bc:'#6ee7b7'},
  '#ec4899':{bg:'#fce7f3',shadow:'rgba(236,72,153,.18)',bc:'#f9a8d4'},
};

function buildQsCards(){
  return CFG.walls.slice(0,5).map((w,i)=>{
    const cm = QS_COLOR_MAP[w.color]||{bg:'#dbeafe',shadow:'rgba(37,99,235,.18)',bc:'#93c5fd'};
    const badge = i===0 ? '<div class="qs-card-badge" style="background:#ef4444;color:#fff">HOT</div>' : '';
    const name = (S.wallData[w.id]?.name||w.defaultName||'Offerwall');
    return '<div class="qs-card" data-goto-wall="'+w.id+'" style="--qs-bg:'+cm.bg+';--qs-shadow:'+cm.shadow+';--qs-bc:'+cm.bc+'">'+
      badge+
      '<div class="qs-icon-wrap">'+w.icon+'</div>'+
      '<div class="qs-name">'+name+'</div>'+
    '</div>';
  }).join('');
}

// Wall gradient map
const WALL_GRADIENTS = {
  '#ef4444':{ grad:'linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)', shadow:'rgba(239,68,68,.35)' },
  '#8b5cf6':{ grad:'linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)', shadow:'rgba(139,92,246,.35)' },
  '#2563eb':{ grad:'linear-gradient(135deg,#2563eb 0%,#1e40af 100%)', shadow:'rgba(37,99,235,.35)' },
  '#f59e0b':{ grad:'linear-gradient(135deg,#f59e0b 0%,#b45309 100%)', shadow:'rgba(245,158,11,.35)' },
  '#10b981':{ grad:'linear-gradient(135deg,#10b981 0%,#065f46 100%)', shadow:'rgba(16,185,129,.35)' },
  '#ec4899':{ grad:'linear-gradient(135deg,#ec4899 0%,#9d174d 100%)', shadow:'rgba(236,72,153,.35)' },
};
const WALL_BADGES = ['hot','hot','new','top','new','top'];

// Dashboard এ শুধু 2টা wall card — same wall-card style, click → offers tab
function buildHomeDashWalls(){
  return CFG.walls.slice(0,2).map((w,i)=>{
    const gm = WALL_GRADIENTS[w.color] || WALL_GRADIENTS['#2563eb'];
    const badge = WALL_BADGES[i]||'';
    const badgeHTML = badge==='hot'
      ? '<div class="wc-badge wc-badge-hot">🔥 HOT</div>'
      : badge==='new'
      ? '<div class="wc-badge wc-badge-new">✨ NEW</div>'
      : badge==='top'
      ? '<div class="wc-badge wc-badge-top">⭐ TOP</div>'
      : '';
    return '<div class="wall-card" data-page="offers" style="--wc-grad:'+gm.grad+';--wc-shadow:'+gm.shadow+'">'
      + badgeHTML
      + '<div class="wc-icon-wrap">'+w.icon+'</div>'
      + '<div id="wc-status-'+w.id+'" class="wc-status wc-status-locked">🔒 Locked</div>'
      + '<div class="wc-wall-name">'+(S.wallData[w.id]?.name||w.defaultName||'Offerwall')+'</div>'
      + '<div class="wc-earn-rate">Earn per offer</div>'
      + '<div class="wc-earn-amt">$'+(S.countryEarn||0.30).toFixed(2)+'</div>'
      + '<div class="wc-arrow">›</div>'
      + '</div>';
  }).join('');
}

function buildQsCardsAll(walls){
  return `<div class="ofc-grid">`+(walls||[]).map((w,i)=>{
    const gm = WALL_GRADIENTS[w.color] || WALL_GRADIENTS['#2563eb'];
    const badge = WALL_BADGES[i]||'';
    const badgeHTML = badge==='hot'
      ? '<div class="ofc-badge wc-badge-hot">🔥 HOT</div>'
      : badge==='new'
      ? '<div class="ofc-badge wc-badge-new">✨ NEW</div>'
      : badge==='top'
      ? '<div class="ofc-badge wc-badge-top">⭐ TOP</div>'
      : '';
    return '<div class="ofc" data-goto-wall="'+w.id+'" style="background:'+gm.grad+';box-shadow:0 6px 24px '+gm.shadow+'">'
      + '<div class="ofc-glow"></div>'
      + badgeHTML
      + '<div class="ofc-icon">'+w.icon+'</div>'
      + '<div style="position:relative">'
      + '<div id="wc-status-'+w.id+'" class="ofc-status" style="background:rgba(0,0,0,.25);color:rgba(255,255,255,.9)">🔒 '+T('lockedWord')+'</div>'
      + '<div class="ofc-name">'+(w.name||'Offerwall')+'</div>'
      + '<div class="ofc-earn">Per offer <span class="ofc-earn-val">$'+(S.countryEarn||0.30).toFixed(2)+'</span></div>'
      + '<div id="wc-timer-'+w.id+'" style="display:none;font-size:10px;color:rgba(255,255,255,.75);margin-top:3px;font-weight:600">⏱ --h --m left</div>'
      + '</div>'
      + '<div class="ofc-arrow">›</div>'
      + '</div>';
  }).join('')+'</div>';
}

// ── ফিক্স: আগে প্রতিটা wall কার্ডের জন্য আলাদা আলাদা checkWallUnlock(w.id) কল হতো,
//    মানে প্রতিটা কার্ড আলাদা আলাদা ভাবে আনলক করা লাগত। কিন্তু আসল আনলক progress
//    সবসময় একটাই shared key ('offerwall') এ সেভ হয় (openWall() দেখুন) — তাই
//    আলাদা w.id দিয়ে চেক করলে কার্ড সবসময় locked-ই দেখাত, ৫টা অ্যাড দেখেও।
//    এখন পুরো পেজের জন্য একবারই 'offerwall' চেক হয়, আর সব কার্ড একসাথে
//    unlock/lock হয় — একটা একটা করে আলাদা কার্ড আনলক করা লাগবে না।
async function updateWallCardStatuses(){
  let st;
  try{ st = await checkWallUnlock('offerwall'); }catch(e){ return; }
  for(const w of (CFG.walls||[])){
    const statusEl = document.getElementById('wc-status-'+w.id);
    const timerEl  = document.getElementById('wc-timer-'+w.id);
    if(!statusEl) continue;
    if(!st.locked){
      statusEl.className = 'wc-status wc-status-unlocked';
      statusEl.textContent = '✅ Unlocked';
      if(timerEl && st.remaining > 0){
        timerEl.style.display = 'flex';
        timerEl.textContent = '⏱ '+msToHM(st.remaining)+' left';
      }
    } else {
      statusEl.className = 'wc-status wc-status-locked';
      statusEl.textContent = '🔒 Locked';
      if(timerEl) timerEl.style.display = 'none';
    }
  }
}

function buildHome(){
  const ud=S.userData||{};
  const today=new Date().toDateString();
  const todayEarn=ud.todayDate===today?(ud.todayEarned||0):0;
  return `<div class="ph"><div class="pt">👋 ${escapeHtml(ud.name||ud.email?.split('@')[0]||'User')}</div><div class="ps">${T('homeWelcome')}</div></div>
  <div class="hero">
    <div class="hg1"></div><div class="hg2"></div>
    <div style="font-size:11px;color:#a78bfa;font-weight:600;margin-bottom:4px;text-transform:uppercase;letter-spacing:.09em">${T('yourEarningsLabel')}</div>
    <div class="sf" style="font-size:36px;font-weight:800;color:#fbbf24" id="liveHeroBal">${fmt$(ud.usdEarned||0)}</div>
    <div style="font-size:12px;color:#475569;margin-top:4px">${T('rateLabel')} ${fmt$(S.countryEarn)} ${T('perOfferWord')} · ${S.country||'Detecting…'}</div>
  </div>
  <div class="sgd">
    <div class="sc sc-2"><div class="sc-i">✅</div><div class="sc-v" style="color:#fff">${ud.offersCompleted||0}</div><div class="sc-l">${T('oc')}</div></div>
    <div class="sc sc-3"><div class="sc-i">👥</div><div class="sc-v" style="color:#fff">${ud.activeReferrals||0}</div><div class="sc-l">${T('refCount')}</div></div>
    <div class="sc sc-4"><div class="sc-i">💵</div><div class="sc-v" style="color:#fff">${fmt$(todayEarn)}</div><div class="sc-l">${T('todayEarn')}</div></div>
  </div>

  <!-- TOTAL PAID OUT — বিশ্বাসযোগ্যতা বাড়ানোর জন্য, App যে আসল টাকা দেয় সেটা দেখানো -->
  <div id="totalPaidOutBox" class="card mb12" style="text-align:center;background:linear-gradient(135deg,rgba(5,150,105,.06),rgba(37,99,235,.06));border:1.5px solid #bbf7d0">
    <div style="font-size:11px;color:#059669;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">💚 Total Paid to Users</div>
    <div class="sf" style="font-size:26px;font-weight:800;color:#059669" id="totalPaidOutAmt">…</div>
  </div>

  <!-- LIVE PAYOUT TICKER — সাম্প্রতিক approved withdrawal (মাস্কড নাম) স্ক্রল করে দেখায় -->
  <div id="payoutTicker" style="display:none;background:#fff;border:1.5px solid #e0eaff;border-radius:12px;padding:8px 12px;margin-bottom:12px;overflow:hidden;white-space:nowrap;font-size:12px;color:#334155"></div>

  <!-- 🎡 DAILY SPIN WHEEL -->
  ${buildSpinWheelCard()}

  <!-- LEVEL & STREAK CARD -->
  <div class="card mb12" style="padding:14px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div>
        <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.06em">${T('yourLevelLabel')}</div>
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:${getUserLevel(ud.usdEarned).color}">${getUserLevel(ud.usdEarned).icon} ${getUserLevel(ud.usdEarned).name}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#64748b;font-weight:600">${T('streakLabel')}</div>
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#ea580c">${ud.loginStreak||0} ${T('daysWord')}</div>
      </div>
    </div>
    ${getUserLevel(ud.usdEarned).next?`
    <div style="font-size:11px;color:#64748b;margin-bottom:4px">${T('progressToLabel')} ${getUserLevel(ud.usdEarned).next?T('nextLevelWord'):''}</div>
    <div class="lvl-bar-wrap"><div class="lvl-bar" style="width:${Math.min(getUserLevel(ud.usdEarned).progress,100)}%"></div></div>
    <div style="font-size:10px;color:#94a3b8;text-align:right">${getUserLevel(ud.usdEarned).progress}%</div>`:`<div style="font-size:12px;color:#7c3aed;font-weight:700;text-align:center">${T('maxLevelMsg')}</div>`}
    <div style="margin-top:10px">
      ${buildStreakUI(ud)}
    </div>
  </div>

  <!-- (PWA Install Banner সরানো হয়েছে — এটা "Add to Home Screen" প্রম্পট ছিল,
       নেটিভ App-এর ভেতরে দেখানো অর্থহীন, কারণ ইউজার তো আগে থেকেই App-এর ভেতরে) -->

  <!-- PUSH NOTIFICATION BANNER -->
  ${!S.pushEnabled && !(typeof Notification!=='undefined' && Notification.permission==='granted')?`<div class="push-banner" onclick="enablePush()">
    <span style="font-size:24px">🔔</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700;color:#fff">${T('enableNotifTitle')}</div>
      <div style="font-size:11px;color:rgba(255,255,255,.7)">${T('enableNotifDesc')}</div>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,.8);font-weight:700">${T('enableArrow')}</div>
  </div>`:''}

  <!-- LEADERBOARD PREVIEW -->
  <div class="card mb12">
    <div class="card-hd" style="display:flex;align-items:center;justify-content:space-between">
      <span>${T('topEarnersTitle')}</span>
      <button onclick="S.page='leaderboard';render()" style="background:none;border:none;cursor:pointer;font-size:12px;color:#2563eb;font-weight:700">${T('seeAllBtn')}</button>
    </div>
    <div id="lbPreview">${buildHomeLeaderboardPreview()}</div>
  </div>

  <!-- BADGES PREVIEW -->
  <div class="card mb12">
    <div class="card-hd" style="display:flex;align-items:center;justify-content:space-between">
      <span>${T('yourBadgesTitle')}</span>
      <span style="font-size:11px;color:#64748b">${getUserBadges(ud).filter(b=>b.earned).length}/${getUserBadges(ud).length} ${T('earnedWord')}</span>
    </div>
    ${buildBadgesSection(ud)}
  </div>

  <!-- OFFERS PREVIEW on Dashboard -->
  <div class="card mb12">
    <div class="card-hd" style="display:flex;align-items:center;justify-content:space-between">
      <span>${T('liveOffersTitle')}</span>
      <button onclick="S.page='offers';render()" style="background:none;border:none;cursor:pointer;font-size:12px;color:#2563eb;font-weight:700">${T('seeAllBtn')}</button>
    </div>
    <div id="homeOfferPreview">
      ${S.allOffers?.length ? S.allOffers.slice(0,4).map(o=>{
        const pay = getUserPayout(o.payout);
        return `<div onclick="S.page='offers';render()"
          style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;cursor:pointer">
          <div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:1px solid #dbeafe;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${o.img?`<img src="${o.img}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.parentNode.textContent='🎯'">`:'🎯'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:12px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.title)}</div>
          </div>
          <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:800;color:#059669;flex-shrink:0">+$${pay.toFixed(2)}</div>
        </div>`;
      }).join('') : `<div style="text-align:center;padding:16px 0;color:#94a3b8;font-size:13px">
        <div style="font-size:24px;margin-bottom:6px">🎯</div>
        <div>${T('goToOffersMsg')}</div>
      </div>`}
    </div>
    <button onclick="S.page='offers';render()" class="btn bp bau" style="width:100%;margin-top:10px;font-size:13px">${T('viewAllOffersBtn')}</button>
  </div>

  <button class="btn bh mb12" data-page="offers" style="width:100%;font-size:13px">${T('browseOffersBtn')}</button>
  ${S.noticeQueue.length>0?`<div class="nc-item mt16" id="homeNotice"><div class="nc-dot"></div><div style="flex:1"><div class="fw6 sm">📢 ${T('nt')}</div></div><button class="btn bp bau bsm">${T('vn')}</button></div>`:''}
  <div class="div mt16"></div>
  <div style="text-align:center;padding:8px 0 20px">
    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.09em;font-weight:700;margin-bottom:6px">◆ EARNOVA</div>
    <div style="font-size:10px;color:#cbd5e1">${T('copyrightText')}</div>
  </div>`;
}

// ─── WALLET PAGE ──────────────────────────────────────
function getMethodsForCountry(){
  const cc = (S.country||'').toUpperCase();
  if(cc==='BD') return CFG.methodsByCountry.BD;
  return CFG.methodsByCountry.default;
}

function buildWallet(){
  const ud=S.userData||{};
  const methods=getMethodsForCountry();
  const isBD=(S.country||'').toUpperCase()==='BD';
  return `<div class="ph"><div class="pt">${T('wt')}</div><div class="ps">${T('mw')}</div></div>
  <div class="card" style="text-align:center;background:linear-gradient(135deg,#1e40af,#065f46);border-color:rgba(37,99,235,.3);margin-bottom:14px">
    <div style="font-size:13px;color:rgba(255,255,255,.7);margin-bottom:6px">${T('bal')}</div>
    <div class="sf" style="font-size:40px;font-weight:800;color:#fbbf24">${fmt$(ud.usdEarned||0)}</div>
    <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:4px">${T('referralsNeededLabel')} ${ud.activeReferrals||0}/${CFG.minRefs} ${T('neededWord')} · ${S.country||'Detecting…'}</div>
    <div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <div style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:5px 12px;font-size:11px;color:rgba(255,255,255,.8)">
        ${isBD?T('bdMethodsLabel'):T('globalMethodsLabel')}
      </div>
      <div style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:5px 12px;font-size:11px;color:rgba(255,255,255,.8)">
        ${T('adsWatchedLabel')} ${ud.adsWatched||0}
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-hd">💳 ${T('withdrawMethod')}</div>
    ${isBD?`<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:9px;padding:8px 12px;font-size:12px;color:#856404;margin-bottom:12px">${T('bdPaymentNote')}</div>`:`<div style="background:#e8f4fd;border:1px solid #93c5fd;border-radius:9px;padding:8px 12px;font-size:12px;color:#1e40af;margin-bottom:12px">${T('intlPaymentNote')}</div>`}
    <div class="mg">${methods.map(m=>`<button class="mb2" data-mth="${m}">
      <span class="method-logo-wrap">${CFG.methodLogo[m]||''}</span>
      <span class="method-name-txt">${CFG.methodEmoji[m]||m}</span>
    </button>`).join('')}</div>
    <label class="lbl">${T('withdrawAmt')} (min $${CFG.minUSD})</label>
    <input class="inp" id="wdAmt" type="number" min="${CFG.minUSD}" step="0.01" placeholder="${CFG.minUSD}.00">
    <label class="lbl">${isBD?T('bkashNagadLabel'):T('accountDetailsLabel')}</label>
    <input class="inp" id="wdAcc" placeholder="${isBD?T('bkashPlaceholder'):T('accountPlaceholder')}">
    <button class="btn bo" id="wdBtn">💸 ${T('sw')}</button>
  </div>
  <div class="sl">${T('history')}</div>
  <div id="wdHist"></div>`;
}

async function loadWithdrawHistory(){
  const hist=$('#wdHist'); if(!hist||!S.user) return;
  hist.innerHTML='<div style="text-align:center;padding:20px;color:#64748b;font-size:13px">⏳ Loading history...</div>';
  try{
    // Supabase থেকে withdraw history নাও
    const {data, error} = await sb
      .from('withdrawals')
      .select('*')
      .eq('uid', S.user.uid)
      .order('created_at', {ascending: false})
      .limit(20);
    if(error) throw error;
    const items = data || [];
    if(!items.length){
      hist.innerHTML=`<div class="empty"><div class="ein">📭</div><div class="etx">${T('noHistory')}</div></div>`;
      return;
    }
    hist.innerHTML=items.map(w=>{
      const accMasked = (w.account||'').length > 6
        ? (w.account||'').slice(0,3)+'****'+(w.account||'').slice(-3)
        : (w.account||'***');
      const statusClass = w.status==='approved'?'bdg2':w.status==='rejected'?'bdr':'bdy';
      const statusText = w.status==='approved'?T('apd'):w.status==='rejected'?T('rjd'):T('pd');
      const statusIcon = w.status==='approved'?'✅':w.status==='rejected'?'❌':'⏳';
      return `<div class="arow">
        <div class="arow-l">
          <div class="fw6 sm dfc" style="gap:7px">
            ${CFG.methodLogo[w.method]||'💳'}
            <span>${escapeHtml(CFG.methodEmoji[w.method]||w.method||'Payment')}</span>
            — <span style="color:#059669;font-weight:700">${fmt$(w.amount||0)}</span>
          </div>
          <div class="xs mu mt8">
            🗓 ${fmtD(w.created_at)} ·
            <span id="wdacc_${w.id}" data-full="${escapeHtml(w.account||'')}" data-masked="${escapeHtml(accMasked)}">${escapeHtml(accMasked)}</span>
            <button onclick="
              var el=document.getElementById('wdacc_${w.id}');
              el.textContent=el.textContent.includes('*')?el.dataset.full:el.dataset.masked;
            " style="background:none;border:none;cursor:pointer;font-size:11px;color:#2563eb;margin-left:4px">👁</button>
          </div>
        </div>
        <span class="bdg ${statusClass}">${statusIcon} ${statusText}</span>
      </div>`;
    }).join('');
  }catch(e){
    console.error('History load error:', e);
    hist.innerHTML=`<div class="empty"><div class="ein">⚠️</div><div class="etx">${T('historyLoadError')}</div></div>`;
  }
}

