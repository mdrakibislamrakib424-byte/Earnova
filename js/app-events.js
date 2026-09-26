// ─── ATTACH APP EVENTS ────────────────────────────────
async function attachAppEvents(){
  // Bottom nav
  $$('.bni[data-page]').forEach(b=>b.onclick=()=>navTo(b.dataset.page));
  // Sidebar toggle
  const mn=$('#navMenu'); if(mn) mn.onclick=openSidebar;
  // Avatar
  const av=$('#navAv'); if(av) av.onclick=()=>navTo('profile');
  // 🆕 Home-page হেডার (profile pic / bell) — নতুন ডিজাইনে
  const hhAv=$('#hhAv'); if(hhAv) hhAv.onclick=()=>navTo('profile');
  const hhBell=$('#hhBell'); if(hhBell) hhBell.onclick=()=>navTo('notices');
  // 🆕 Quick Actions-এর Daily Bonus — এটা manual claim না, স্বয়ংক্রিয়ভাবেই লগইনে যোগ হয়ে যায়
  const qaDb=$('#qaDailyBonus'); if(qaDb) qaDb.onclick=()=>{
    const ud=S.userData||{};
    const today=new Date().toDateString();
    if(ud.dailyBonusDate===today){
      toast(T('dailyBonusClaimedTodayMsg'),'s',3500);
    } else {
      toast(T('dailyBonusAutoInfoMsg'),'i',4000);
    }
  };
  // Brand
  const br=$('.nav-bnd'); if(br) br.onclick=()=>navTo('home');
  // Wall cards
  $$('[data-goto-wall]').forEach(el=>{
    el.onclick=()=>openWall(el.dataset.gotoWall);
  });
  // qs-card social tasks shortcut
  $$('.qs-card[data-page]').forEach(el=>{
    el.onclick=()=>{ S.page=el.dataset.page; render(); };
  });
  // Back buttons
  $$('[data-page]').forEach(btn=>{
    if(!btn.classList.contains('bni')) btn.onclick=()=>navTo(btn.dataset.page);
  });
  // Home notice
  const hn=$('#homeNotice');
  if(hn) hn.querySelector('button').onclick=()=>{
    if(S.noticeQueue.length) viewNotice(S.noticeQueue[0]);
  };
  // Wall view — Version-based cache (0 Supabase call if no admin change)
  if(S.page==='wallview'){
    const wallId=S.unlockWallId;
    CACHE.smartGet(wallId).then(freshData=>{
      // Merge fresh data into S.wallData
      if(S.wallData[wallId]){
        Object.assign(S.wallData[wallId], freshData);
      } else {
        S.wallData[wallId]=freshData;
      }
      const w=S.wallData[wallId]||{};
      const embedMode=w.embedMode||'iframe';
      // Script Tag injection
      if(embedMode==='script' && w.scriptCode){
        const zone=document.getElementById('scriptInjectZone');
        if(zone){
          const uid=S.user?.uid||'';
          document.querySelectorAll('script[data-cpx-injected]').forEach(s=>s.remove());
          document.querySelectorAll('div[data-cpx-injected]').forEach(d=>d.remove());
          if(window.config) delete window.config;
          if(window.cpx_research) delete window.cpx_research;
          const injected=w.scriptCode.replace(/\{uid\}/g,uid);
          const wrapper=document.createElement('div');
          wrapper.innerHTML=injected;
          wrapper.querySelectorAll(':not(script)').forEach(node=>{
            const clone=node.cloneNode(true);
            clone.setAttribute('data-cpx-injected','1');
            zone.appendChild(clone);
          });
          const scripts=[...wrapper.querySelectorAll('script')];
          const execNext=(i)=>{
            if(i>=scripts.length) return;
            const oldS=scripts[i];
            const newS=document.createElement('script');
            newS.setAttribute('data-cpx-injected','1');
            if(oldS.src){
              newS.src=oldS.src+'?t='+Date.now(); // cache bust
              newS.onload=()=>execNext(i+1);
              newS.onerror=()=>execNext(i+1);
            } else {
              newS.textContent=oldS.textContent;
            }
            document.body.appendChild(newS);
            if(!oldS.src) execNext(i+1);
          };
          execNext(0);
        }
      }
      // RSS
      if(w.useRSS || embedMode==='rss'){
        fetchRSSOffers(wallId).then(()=>renderRSSOffers(wallId));
      }
      // Refresh button
      const rfBtn=document.getElementById('rssRefresh');
      if(rfBtn) rfBtn.onclick=async()=>{
        rfBtn.disabled=true; rfBtn.textContent='⏳ Loading…';
        await fetchRSSOffers(wallId);
        renderRSSOffers(wallId);
        rfBtn.disabled=false; rfBtn.textContent='🔄 Refresh';
      };
    });
  }
  // Offerwall page — unlock check + load
  if(S.page==='offerwall') initOfferwallPage();

  // Unified Offers feed — সব platform এর offer একসাথে
  if(S.page==='offers'){
    loadAllOffers(false);
    const searchEl = $('#offersSearchInput');
    if(searchEl){
      searchEl.value = S.allOffersSearch||'';
      let dT=null;
      searchEl.oninput = (e)=>{
        S.allOffersSearch = e.target.value;
        clearTimeout(dT);
        dT = setTimeout(renderAllOffers, 150);
      };
    }
    const rfBtn = $('#offersRefreshBtn');
    if(rfBtn) rfBtn.onclick = async ()=>{
      rfBtn.disabled = true; rfBtn.style.animation='spin 0.6s linear infinite';
      clearOffersCache(); // localStorage cache মুছে নতুন করে fetch
      await loadAllOffers(true);
      rfBtn.disabled = false; rfBtn.style.animation='';
    };
  }
  // Wallet
  if(S.page==='wallet'){
    const countryMethods=getMethodsForCountry();
    let selMethod=countryMethods[0]||'visa';
    $$('[data-mth]').forEach(b=>{ b.classList.toggle('sel',b.dataset.mth===selMethod); b.onclick=()=>{
      selMethod=b.dataset.mth; $$('[data-mth]').forEach(x=>x.classList.remove('sel')); b.classList.add('sel');
    };});
    const wdBtn=$('#wdBtn');
    if(wdBtn) wdBtn.onclick=async()=>{
      if(wdBtn.disabled) return;
      wdBtn.disabled=true; wdBtn.textContent=T('sging');
      try{
        await submitWithdraw(selMethod,$('#wdAcc').value.trim(),$('#wdAmt').value);
      }catch(e){
        toast('Error: '+e.message,'e');
      }
      wdBtn.disabled=false; wdBtn.textContent='💸 '+T('sw');
    };
    loadWithdrawHistory();
  }
  // Unlock page
  if(S.page==='unlock'){
    const watchBtn=$('#watchAdBtn');
    if(watchBtn) watchBtn.onclick=()=>{
      if(!S.adActive) startAd(S.unlockWallId,'unlock');
    };
    updateUnlockUI(S.unlockWallId);
  }
  // Profile
  if(S.page==='profile'){
    const sv=$('#prfSv'); if(sv) sv.onclick=async()=>{
      const nm=$('#prfNm').value.trim();
      if(nm) await fDB.ref(`users/${S.user.uid}/name`).set(nm);
      toast(T('sv'),'s');
    };
    const lo=$('#prfLo'); if(lo) lo.onclick=doLogout;
    const npSv=$('#notifPrefSave'); if(npSv) npSv.onclick=saveNotifPrefs;
    const kycBtn=$('#kycSubmitBtn'); if(kycBtn) kycBtn.onclick=submitKYC;
  // Load user awards on profile
  if(S.user) loadUserAwards(S.user.uid);
  }
  // Notices
  if(S.page==='notices') loadNotices();
  // Admin tabs
  if(S.page==='admin'){
    $$('[data-atab]').forEach(b=>b.onclick=()=>{ S.adminTab=b.dataset.atab; render(); });
    loadAdminContent();
  }
  // Admin tab content buttons re-loaded in loadAdminContent
  // Leaderboard page
  if(S.page==='leaderboard'){
    const lbEl = document.getElementById('lbContent');
    if(lbEl) lbEl.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b">⏳ Loading real earners...</div>';
    loadLeaderboard().then(()=>{
      const el=document.getElementById('lbContent');
      if(el) el.innerHTML=buildLeaderboardSection();
    }).catch(()=>{
      const el=document.getElementById('lbContent');
      if(el) el.innerHTML='<div class="empty"><div class="ein">⚠️</div><div class="etx">Could not load. Please try again.</div></div>';
    });
  }
  // Home page — leaderboard preview update
  if(S.page==='home'){
    // ── Trust Stats: Total Paid Out + Live Payout Ticker ──
    loadTrustStats().then(stats=>{
      const totalEl = document.getElementById('totalPaidOutAmt');
      if(totalEl) totalEl.textContent = stats ? fmt$(stats.total) : '—';

      const tickerEl = document.getElementById('payoutTicker');
      if(tickerEl && stats?.recent?.length){
        const items = stats.recent.map(r=>`💸 ${escapeHtml(r.name)} withdrew ${fmt$(r.amount)} via ${escapeHtml(r.method)}`).join('&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;');
        tickerEl.innerHTML = `<span style="display:inline-block;animation:tickerMove 25s linear infinite">${items}</span>`;
        tickerEl.style.display = 'block';
      }
    });

    // ── ফিক্স: এখানে আগে leaderboard preview-এর জন্য আলাদা, escapeHtml() ছাড়া,
    //    আর হার্ডকোড করা ইংরেজি টেক্সট ("YOU"/"earned") দিয়ে লজিক ছিল — যেটা
    //    pages-core.js এর buildHome()-এ থাকা (ঠিকঠাক অনুবাদ করা) ভার্সনকে
    //    ডেটা লোড হওয়ার পরপরই বদলে ফেলত, ফলে বাংলা/অন্য ভাষার ইউজার সাথে
    //    সাথেই ইংরেজি দেখতে পেত। এখন features.js এর একটাই শেয়ার্ড, escaped,
    //    অনুবাদ করা ফাংশন (buildHomeLeaderboardPreview) ব্যবহার হচ্ছে।
    loadLeaderboard().then(()=>{
      const el=document.getElementById('lbPreview');
      if(!el) return;
      el.innerHTML = buildHomeLeaderboardPreview();
    });
  }
}

function openSidebar(){
  S.sidebarOpen=true;
  const div=document.createElement('div');
  div.innerHTML=buildSidebar();
  document.body.appendChild(div.firstChild);
  const sov=$('.sov'); if(!sov) return;
  sov.onclick=closeSidebar;
  // Sidebar links
  $$('.si[data-page]').forEach(b=>b.onclick=()=>{ closeSidebar(); navTo(b.dataset.page); });
  $('#sbLang').onclick=()=>{ closeSidebar(); EZ.openLM(); };
  $('#sbLo').onclick=()=>{ closeSidebar(); doLogout(); };
}
function closeSidebar(){
  const sov=$('.sov'); if(sov) sov.remove(); S.sidebarOpen=false;
}

async function navTo(page){
  // ── প্রতিটা পেজে ঢোকার সময় (৪৫ মিনিটে একবার) ইন্টারস্টিশিয়াল অ্যাড দেখানো হয়,
  //    অ্যাড শেষ হওয়ার পরই পেজ পরিবর্তন হয় — বিস্তারিত ads.js এ দেখুন
  await maybeShowPageEntryAd(page);
  S.page=page; render(); window.scrollTo(0,0);
}

async function openWall(wallId){
  // ⚠️ ads-দেখে unlock করার সিস্টেম ডেভেলপারের অনুরোধে বন্ধ করা হলো — এখন সবসময়
  // সরাসরি wallframe খুলবে, unlock পেজে পাঠানো হবে না। unlock পেজের কোড এখনো
  // প্রজেক্টে আছে (মুছে ফেলা হয়নি), শুধু এই পথ থেকে আর ব্যবহার হচ্ছে না।
  S.activeWallId=wallId;
  S.page='wallframe';
  render();
}

// ─── SUPABASE AUTH STATE ─────────────────────────────
// ── Handle email verification redirect (URL hash token) ──
async function handleEmailVerification(){
  try{
    const hash = window.location.hash;
    if(!hash || !hash.includes('access_token')) return false;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token') || '';
    const type = params.get('type');
    if(!accessToken) return false;
    // Session set করো — এটাই permanently browser এ save হয়
    const {data, error} = await sb.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    // URL পরিষ্কার করো
    window.history.replaceState({}, document.title, window.location.pathname);
    if(!error && data?.session){
      // DB তে email verified mark করো
      const uid = data.session.user?.id;
      if(uid){
        try{
          await sb.from('users').update({
            email_verified: true,
            emailVerified: true
          }).eq('id', uid);
        }catch(e2){}
      }
      return true;
    }
    return false;
  }catch(e){ return false; }
}

// ── Loader সবসময় বন্ধ করার function ──
function hideLdr(){
  const ldr=document.getElementById('ldr');
  const app=document.getElementById('app');
  if(ldr) ldr.style.display='none';
  if(app) app.style.display='block';
}

// ── Safety timer: ১০ সেকেন্ডেও loader না গেলে জোর করে বন্ধ ──
let _safetyFired = false;
setTimeout(()=>{
  if(_safetyFired) return;
  _safetyFired = true;
  const ldr=document.getElementById('ldr');
  if(ldr && ldr.style.display!=='none'){
    hideLdr();
    if(!S.user){ S.page='welcome'; render(); }
  }
}, 10000);

// ── Track যে onAuthStateChanged already fire হয়েছে কিনা ──
let _authInitDone = false;

fAuth.onAuthStateChanged(async user=>{
  // Duplicate call রোধ করো
  if(_authInitDone && !user && !S.user) return;
  _authInitDone = true;
  _safetyFired = true;

  try{
    if(user){
      S.user = user;

      // STEP 1: Email verify link থেকে এলে handle করো
      await handleEmailVerification();

      // STEP 2: Fresh session নাও — verified status check
      let isVerified = false;
      try{
        const {data:{session}} = await sb.auth.getSession();
        const fu = session?.user || user;
        isVerified = !!(fu?.email_confirmed_at || fu?.confirmed_at || fu?.user_metadata?.email_verified);
        if(session?.user) fAuth.currentUser = _mapUser(session.user);
      }catch(e){ isVerified = !!(user.emailVerified); }

      // STEP 3: Verified না হলে verify screen
      if(!isVerified){
        S.page='verify';
        hideLdr();
        render();
        return;
      }

      // STEP 4: User data load
      let ud = await loadUserData(user.uid);
      if(!ud){
        await new Promise(r=>setTimeout(r,2000));
        ud = await loadUserData(user.uid);
      }
      S.userData = ud;

      // STEP 5: Banned check
      if(S.userData?.banned){
        toast(T('banned'),'e');
        await fAuth.signOut();
        S.user=null; S.userData=null;
        S.page='login';
        hideLdr(); render(); return;
      }

      // STEP 6: Setup
      if(S.userData?.lang && LANGS[S.userData.lang]) applyLang(S.userData.lang);
      detectCountry();
      await getWallData();
      await loadPayoutSettings();
      setupListeners(user.uid);

      // STEP 7: Page
      if(['login','register','verify','welcome',''].includes(S.page)) S.page='home';

      // STEP 8: Loader বন্ধ — সবার আগে
      hideLdr();
      render();

      // STEP 9: Non-blocking extras
      initDarkMode();
      initPWA();
      // 🆕 প্রথমবার App ব্যবহার করলে ৪-স্লাইড টিউটোরিয়াল দেখাও (একবারই, localStorage flag দিয়ে)
      if(!localStorage.getItem('ez_onboarding_done')) setTimeout(showOnboardingTutorial, 600);
      // pushEnabled — FCM init থেকে পরে set হবে (initFCM() এ), এখানে আপাতত false
      S.pushEnabled = false;
      if(S.userData){
        checkDailyBonus(user.uid, S.userData);
        updateLoginStreak(user.uid, S.userData);
        // Balance notification — app খুললে balance দেখে push পাঠায় (3s delay)
        setTimeout(()=> checkBalanceNotification(), 3000);
        // Review popup — 24h পরপর
        setTimeout(()=> checkReviewPopup(), 5000);
      }
      loadLeaderboard();
      startLiveTicker();
      startActivityToasts();
      // Supabase v2 — .catch() chain নেই, try/catch ব্যবহার করো
      try{
        const {data:stData} = await sb.from('stats').select('total_users').eq('id','stats').maybeSingle();
        S.realUserCount = stData?.total_users||0;
        const el = document.getElementById('navOnlineCount');
        if(el) el.textContent = S.realUserCount;
      }catch(e){ /* stats load fail — non-critical */ }

    } else {
      // User নেই
      S.user=null; S.userData=null;
      if(!['login','register','forgot','verify'].includes(S.page)){
        S.page='welcome';
      }
      hideLdr();
      render();
    }
  }catch(err){
    // যেকোনো error হলেও loader বন্ধ হবে
    console.error('Auth error:', err);
    hideLdr();
    if(S.user && S.userData){ S.page='home'; }
    else { S.user=null; S.userData=null; S.page='welcome'; }
    render();
  }
});

// ─── HANDLE REFERRAL IN URL ───────────────────────────
const urlParams=new URLSearchParams(location.search);
const refFromUrl=urlParams.get('ref');
if(refFromUrl) localStorage.setItem('ez_ref',refFromUrl);

// ─── LANGUAGE INIT ────────────────────────────────────
const savedLang=localStorage.getItem('ez_lang')||navigator.language?.slice(0,2)||'en';
applyLang(LANGS[savedLang]?savedLang:'en');

// ─── নেটিভ App বুট — Back button/Status bar/Offline detection ──────────
// login করা থাকুক বা না থাকুক, App খোলার সাথে সাথেই একবার চালু হবে
// (welcome/login screen থেকেই Back button ঠিকভাবে কাজ করবে)
initBackButton();
initStatusBar();
initOfflineDetection();
initSocialLogin();
initSocialLoginCallback();

// ─── HANDLE POPUPS ────────────────────────────────────
window.addEventListener('popstate',()=>{
  if(S.adActive) history.pushState(null,null,location.href);
});

async function loadAdminSettings(c){
  // Load current settings
  const snap=await fDB.ref('settings').once('value');
  const cfg=snap.val()||{};
  const cpa=cfg.cpa||{};
  const payout=cfg.payout||{};
  const rates=payout.rates||{BD:.10,IN:.10,PK:.10,default:.30,hi:.50};
  const mode=payout.mode||'custom';

  c.innerHTML=`
  <!-- ════ PUSH NOTIFICATION (Firebase Cloud Messaging — FCM) ════ -->
  <div class="card mb12" style="border:2px solid #bfdbfe">
    <div class="card-hd">🔔 Push Notification — সব User এর ফোনে পাঠান</div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;padding:10px 13px;font-size:12px;color:#1e40af;margin-bottom:14px">
      ℹ️ Firebase Console → Project Settings → Cloud Messaging থেকে config নিন এবং নিচের FCM_CONFIG ভ্যারিয়েবলে বসান। Push পাঠানো হয় functions/index.js এর Cloud Function দিয়ে (README.md দেখুন)।
    </div>
    <div style="margin-bottom:10px">
      <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:5px">📌 Notification Title</label>
      <input id="pushTitle" type="text" placeholder="e.g. 🎉 নতুন অফার এসেছে!" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f8fafc;color:#0f172a">
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:5px">💬 Message</label>
      <textarea id="pushBody" rows="3" placeholder="e.g. আজকের নতুন অফারগুলো দেখুন এবং এখনই আয় শুরু করুন!" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f8fafc;color:#0f172a;resize:vertical"></textarea>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn bp bau" style="flex:1" onclick="adminSendPush()">🚀 সবাইকে পাঠাও</button>
    </div>
    <div id="pushResult" style="margin-top:10px;font-size:12px"></div>
  </div>

  <!-- ════ OFFERWALL LINK ════ -->
  <div class="card mb12" style="border:2px solid #d1fae5">
    <div class="card-hd">🌐 Offerwall Page Link</div>
    <div style="font-size:12px;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:9px;padding:9px 12px;margin-bottom:12px">
      ℹ️ এই link টা "Wall" ট্যাবে iframe হিসেবে দেখাবে। যেকোনো offerwall-এর embed link এখানে দিন।
    </div>
    <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:5px">Offerwall URL / Embed Link</label>
    <input id="offerwallLinkInp" type="url" placeholder="https://..." style="width:100%;padding:10px 13px;border:1.5px solid #a7f3d0;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f8fafc;margin-bottom:10px">
    <button class="btn bg bau" onclick="saveOfferwallLink()">💾 Save Link</button>
  </div>

  <!-- ════ CUSTOM MANUAL OFFERS ════ -->
  <div class="card mb12" style="border:2px solid #fde68a">
    <div class="card-hd">➕ Add Manual Offer</div>
    <div style="font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:9px 12px;margin-bottom:12px">
      ℹ️ এখানে manually offer add করুন — এগুলো সব ইউজারের Offers ফিডে দেখাবে।
    </div>
    <div style="display:flex;flex-direction:column;gap:9px;margin-bottom:12px">
      <input id="coTitle" type="text" placeholder="Offer Title *" style="width:100%;padding:10px 13px;border:1.5px solid #fde68a;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f8fafc">
      <input id="coDesc" type="text" placeholder="Short Description" style="width:100%;padding:10px 13px;border:1.5px solid #fde68a;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f8fafc">
      <input id="coLink" type="url" placeholder="Offer Link (tracking URL) *" style="width:100%;padding:10px 13px;border:1.5px solid #fde68a;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f8fafc">
      <div style="display:flex;gap:8px">
        <input id="coPayout" type="number" placeholder="Payout ($) *" step="0.01" min="0" style="flex:1;padding:10px 13px;border:1.5px solid #fde68a;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f8fafc">
        <input id="coCategory" type="text" placeholder="Category" style="flex:1;padding:10px 13px;border:1.5px solid #fde68a;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f8fafc">
      </div>
      <input id="coImage" type="url" placeholder="Image URL (optional)" style="width:100%;padding:10px 13px;border:1.5px solid #fde68a;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#f8fafc">
      <div style="font-size:12px;font-weight:700;color:#92400e;margin-top:4px">🌍 কোন কোন দেশে এই অফার দেখাবে?</div>
      <div id="coCountryBox" style="display:flex;flex-wrap:wrap;gap:6px;background:#f8fafc;border:1.5px solid #fde68a;border-radius:10px;padding:10px">
        <label style="display:flex;align-items:center;gap:5px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer">
          <input type="checkbox" id="coCountryAll" checked onchange="$$('.coCountryChk').forEach(c=>c.disabled=this.checked); if($('#coCountryCustom'))$('#coCountryCustom').disabled=this.checked;" style="accent-color:#d97706"> সব দেশ (ALL)
        </label>
        ${CFG.countryList.map(c=>`<label style="display:flex;align-items:center;gap:5px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer">
          <input type="checkbox" class="coCountryChk" value="${c.code}" style="accent-color:#2563eb"> ${c.flag} ${c.name}
        </label>`).join('')}
      </div>
      <input id="coCountryCustom" type="text" placeholder="আরও দেশ যোগ করতে চাইলে country code লিখুন, কমা দিয়ে আলাদা করে (যেমন: SA,AE,KW)" style="width:100%;padding:9px 13px;border:1.5px solid #fde68a;border-radius:10px;font-size:12px;font-family:inherit;outline:none;background:#f8fafc">
    </div>
    <button class="btn" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;margin-bottom:12px" onclick="adminAddCustomOffer()">➕ Add Offer</button>
    <div id="coResult" style="font-size:12px;margin-bottom:12px"></div>
    <div id="coList"></div>
  </div>

  <!-- Announcement Banner -->
  <div class="card mb12">
    <div class="card-hd">📢 Announcement Banner</div>
    <div style="font-size:12px;color:#475569;margin-bottom:10px">এই message টা সব user এর app এর উপরে দেখাবে। খালি রাখলে banner দেখাবে না।</div>
    <input type="text" id="announcementInput" placeholder="e.g. 🎉 New offers added! Complete now to earn more." value="${cfg.announcement||''}" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit;margin-bottom:10px">
    <div style="display:flex;gap:8px">
      <button class="btn bp bau" style="flex:1" onclick="saveAnnouncement()">💾 Save Banner</button>
      <button class="btn br bau" onclick="clearAnnouncement()">🗑️ Clear</button>
    </div>
  </div>

  <!-- 🆕 Community News Video (Home page-এ দেখানো হয়) -->
  <div class="card mb12">
    <div class="card-hd">📺 Community News Video</div>
    <div style="font-size:12px;color:#475569;margin-bottom:10px">YouTube, Facebook বা TikTok ভিডিও-র লিংক দিন — Home page-এ সবার জন্য embed হয়ে দেখাবে। খালি রাখলে ভিডিও দেখাবে না।</div>
    <input type="text" id="communityVideoInput" placeholder="e.g. https://youtube.com/watch?v=..." value="${(()=>{ const v=cfg.communityVideo; const raw=(v&&typeof v==='object')?v.data:v; if(!raw) return ''; try{ const p=JSON.parse(raw); return p?.url||''; }catch(e){ return typeof raw==='string'?raw:''; } })()}" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit;margin-bottom:10px">
    <div style="display:flex;gap:8px">
      <button class="btn bp bau" style="flex:1" onclick="saveCommunityVideo()">💾 Save Video</button>
      <button class="btn br bau" onclick="clearCommunityVideo()">🗑️ Remove</button>
    </div>
  </div>

  <!-- 6-Platform RSS Credentials -->
  <!-- Payout Mode -->
  <div class="card mb12">
    <div class="card-hd">💰 Payout Mode</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px">
      <button class="mb2${mode==='custom'?' sel':''}" id="modeCustom">
        ✏️ Custom (আপনি যা সেট করবেন)
      </button>
      <button class="mb2${mode==='cpa'?' sel':''}" id="modeCPA">
        📡 CPA Real Amount
      </button>
    </div>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:9px;padding:10px 13px;font-size:12px;color:#15803d;margin-bottom:12px" id="modeNote">
      ${mode==='custom'?'✅ Custom mode: User দেশ অনুযায়ী নিচের rate পাবে':'✅ CPA mode: CPA network যা পাঠাবে user তাই পাবে'}
    </div>
    <button class="btn bg" id="saveMode">💾 Save Payout Mode</button>
  </div>

  <!-- Custom Payout Rates -->
  <div class="card mb12" id="ratesCard" style="${mode==='cpa'?'opacity:.6;pointer-events:none':''}">
    <div class="card-hd">🌍 Country Payout Rates (USD per offer)</div>
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:9px;padding:10px 13px;font-size:12px;color:#b45309;margin-bottom:12px">
      ⚠️ এই rate গুলো "Custom" mode এ কাজ করে। CPA থেকে যা আসুক আপনার set rate যাবে user এ।
    </div>
    ${['BD','IN','PK','NG','GH','PH','EG','KE'].map(cc=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
      <div style="font-size:20px;width:30px">${{BD:'🇧🇩',IN:'🇮🇳',PK:'🇵🇰',NG:'🇳🇬',GH:'🇬🇭',PH:'🇵🇭',EG:'🇪🇬',KE:'🇰🇪'}[cc]||'🌍'}</div>
      <div style="font-weight:600;font-size:13px;width:40px">${cc}</div>
      <div style="position:relative;flex:1">
        <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b;font-weight:700">$</span>
        <input class="inp rate-inp" data-cc="${cc}" value="${(rates[cc]||0.10).toFixed(2)}" type="number" step="0.01" min="0.01" style="padding-left:28px;margin-bottom:0">
      </div>
    </div>`).join('')}
    <div style="border-top:1px solid #dbeafe;margin:12px 0"></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
      <div style="font-size:20px;width:30px">🌍</div>
      <div style="font-weight:600;font-size:13px;width:40px">Other</div>
      <div style="position:relative;flex:1">
        <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b;font-weight:700">$</span>
        <input class="inp rate-inp" data-cc="default" value="${(rates.default||0.30).toFixed(2)}" type="number" step="0.01" min="0.01" style="padding-left:28px;margin-bottom:0">
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="font-size:20px;width:30px">🏆</div>
      <div style="font-weight:600;font-size:13px;width:40px">US/UK/AU</div>
      <div style="position:relative;flex:1">
        <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b;font-weight:700">$</span>
        <input class="inp rate-inp" data-cc="hi" value="${(rates.hi||0.50).toFixed(2)}" type="number" step="0.01" min="0.01" style="padding-left:28px;margin-bottom:0">
      </div>
    </div>
    <button class="btn bg" id="saveRates">💾 Save Payout Rates</button>
  </div>`;

  // Mode toggle
  let selMode=mode;
  $('#modeCustom').onclick=()=>{
    selMode='custom';
    $('#modeCustom').classList.add('sel'); $('#modeCPA').classList.remove('sel');
    $('#modeNote').textContent='✅ Custom mode: User দেশ অনুযায়ী নিচের rate পাবে';
    $('#ratesCard').style.opacity='1'; $('#ratesCard').style.pointerEvents='auto';
  };
  $('#modeCPA').onclick=()=>{
    selMode='cpa';
    $('#modeCPA').classList.add('sel'); $('#modeCustom').classList.remove('sel');
    $('#modeNote').textContent='✅ CPA mode: CPA network যা পাঠাবে user তাই পাবে';
    $('#ratesCard').style.opacity='.6'; $('#ratesCard').style.pointerEvents='none';
  };
  $('#saveMode').onclick=async()=>{
    // minUSD এবং minRefs save করো
    const newMinUSD = parseInt(document.getElementById('adminMinUSD')?.value||'5');
    const newMinRefs = parseInt(document.getElementById('adminMinRefs')?.value||'5');
    if(newMinUSD>0) localStorage.setItem('ez_minUSD', newMinUSD);
    if(newMinRefs>=0) localStorage.setItem('ez_minRefs', newMinRefs);
    await fDB.ref('settings/payout/mode').set(selMode);
    S.payoutMode=selMode;
    toast('Payout mode saved!','s');
  };
  // Load custom offers list + offerwall link
  loadAdminCustomOffers();
  try{
    const owSnap = await fDB.ref('settings/offerwallLink').once('value');
    const owLink = owSnap.val()||'';
    const owInp = document.getElementById('offerwallLinkInp');
    if(owInp) owInp.value = owLink;
  }catch(e){}

  // Save rates
  $('#saveRates').onclick=async()=>{
    const r={};
    $$('.rate-inp').forEach(inp=>{ r[inp.dataset.cc]=parseFloat(inp.value)||0.10; });
    await fDB.ref('settings/payout/rates').set(r);
    S.payoutRates=r;
    toast('Payout rates saved!','s');
  };
}

// ─── TOAST NOTIFICATIONS ──────────────────────────────
// ── Toast Queue System — একসাথে ১টার বেশি দেখাবে না ──
const _toastQ = [];
let _toastRunning = false;

function showToast(msg, type='blue', duration=3500){
  _toastQ.push({msg, type, duration});
  if(!_toastRunning) _runToastQ();
}

function _runToastQ(){
  if(!_toastQ.length){ _toastRunning=false; return; }
  _toastRunning = true;
  const {msg, type, duration} = _toastQ.shift();
  const box = document.getElementById('toastBox');
  if(!box){ _toastRunning=false; return; }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = msg;
  box.appendChild(t);
  // duration শেষে সরাও, তারপর পরেরটা দেখাও
  setTimeout(()=>{
    t.style.animation='toastOut .4s ease forwards';
    setTimeout(()=>{
      t.remove();
      _runToastQ(); // পরেরটা
    }, 400);
  }, duration);
}

// ─── LIVE TICKER ──────────────────────────────────────
function startLiveTicker(){
  const ticker=document.getElementById('liveTicker');
  const tickerText=document.getElementById('tickerText');
  if(!ticker||!tickerText) return;
  ticker.style.display='block';
  const msgs=[
    '🌍 Welcome to EARNOVA — Earn Real Money Online!',
    '💰 Complete offers & earn real cash — Withdraw via bKash, PayPal, USDT',
    '👥 Refer friends and unlock withdrawals faster!',
    '🎯 New offers available — Complete tasks and earn today!',
    '🔒 Secure & trusted platform — 150+ countries supported',
    '💸 Minimum withdrawal just $5 — Fast payments guaranteed!',
  ];
  let i=0;
  setInterval(()=>{
    i=(i+1)%msgs.length;
    tickerText.style.animation='none';
    tickerText.textContent=msgs[i];
    setTimeout(()=>{ tickerText.style.animation='tickerMove 18s linear infinite'; },50);
  },18000);
}

// ─── LIVE ACTIVITY TOASTS — শুধু একবার দেখাবে ──────────
async function startActivityToasts(){
  try{
    // আগে কোন toast দেখা হয়েছে সেটা check করো
    const seenKey = 'ez_seen_toasts';
    const seenRaw = localStorage.getItem(seenKey)||'{}';
    const seen = JSON.parse(seenRaw);

    // Real approved withdrawals
    const {data:wds} = await sb
      .from('withdrawals')
      .select('id, user_name, user_email, amount, method')
      .eq('status','approved')
      .order('created_at',{ascending:false})
      .limit(10);

    // Real recent signups (last 7 days)
    const week = new Date(Date.now()-7*24*60*60*1000).toISOString();
    const {data:newUsers} = await sb
      .from('users')
      .select('id, name, email, created_at')
      .gte('created_at', week)
      .order('created_at',{ascending:false})
      .limit(10);

    const toasts = [];

    // Withdraw toasts — আগে দেখা হয়নি এমন
    (wds||[]).forEach(w=>{
      const toastId = 'wd_'+(w.id||w.user_email||'');
      if(seen[toastId]) return; // আগে দেখানো হয়েছে — skip
      const raw = w.user_name || (w.user_email||'').split('@')[0] || '';
      if(!raw) return;
      const masked = raw.length>4 ? raw.slice(0,2)+'***' : raw[0]+'**';
      const method = (w.method||'payment').replace('_',' ');
      toasts.push({
        id: toastId,
        msg: `💸 <strong>${masked}</strong> withdrew <strong>$${parseFloat(w.amount||0).toFixed(2)}</strong> via ${method}`,
        color: 'green'
      });
    });

    // New user toasts — আগে দেখা হয়নি এমন
    (newUsers||[]).forEach(u=>{
      const toastId = 'usr_'+(u.id||u.email||'');
      if(seen[toastId]) return; // আগে দেখানো হয়েছে — skip
      const raw = u.name || (u.email||'').split('@')[0] || '';
      if(!raw) return;
      const masked = raw.length>4 ? raw.slice(0,2)+'***' : raw[0]+'**';
      toasts.push({
        id: toastId,
        msg: `👥 <strong>${masked}</strong> just joined EARNOVA!`,
        color: 'blue'
      });
    });

    if(!toasts.length) return; // নতুন কিছু নেই

    // Shuffle
    toasts.sort(()=>Math.random()-0.5);

    let idx = 0;
    function showNext(){
      if(idx >= toasts.length) return; // সব দেখানো হয়েছে
      const t = toasts[idx];
      showToast(t.msg, t.color, 4000);
      // দেখানো হয়েছে mark করো
      seen[t.id] = 1;
      localStorage.setItem(seenKey, JSON.stringify(seen));
      idx++;
      setTimeout(showNext, 25000 + Math.random()*15000);
    }
    setTimeout(showNext, 15000);

  }catch(e){
    console.log('Toast skipped:', e.message);
  }
}

// ─── ANNOUNCEMENT FUNCTIONS ───────────────────────────
// ── Admin → Offerwall Link save ──
async function saveOfferwallLink(){
  const link = ($('#offerwallLinkInp')?.value||'').trim();
  await fDB.ref('settings/offerwallLink').set(link);
  CFG.offerwallLink = link; S.offerwallLink = link;
  toast('✅ Offerwall link saved!','s');
}

// ── Admin → Custom Offer add ──
async function adminAddCustomOffer(){
  const title=$('#coTitle')?.value.trim()||'';
  const desc=$('#coDesc')?.value.trim()||'';
  const link=$('#coLink')?.value.trim()||'';
  const payout=parseFloat($('#coPayout')?.value||'0');
  const category=$('#coCategory')?.value.trim()||'Custom';
  const img=$('#coImage')?.value.trim()||'';
  const res=document.getElementById('coResult');
  if(!title||!link||!payout){ if(res) res.innerHTML='<span style="color:#ef4444">⚠️ Title, Link ও Payout দেওয়া আবশ্যক</span>'; return; }

  // ── country selection collect করো ──
  const allChecked = $('#coCountryAll')?.checked;
  let countries = [];
  if(!allChecked){
    $$('.coCountryChk').forEach(chk=>{ if(chk.checked) countries.push(chk.value); });
    const customTxt = $('#coCountryCustom')?.value.trim()||'';
    if(customTxt){
      customTxt.split(',').forEach(c=>{ const cc=c.trim().toUpperCase(); if(cc) countries.push(cc); });
    }
    countries = [...new Set(countries)]; // duplicate সরাও
    if(!countries.length){ if(res) res.innerHTML='<span style="color:#ef4444">⚠️ কমপক্ষে একটা দেশ সিলেক্ট করুন, অথবা "সব দেশ" টিক দিন</span>'; return; }
  }
  // allChecked হলে countries=[] থাকবে, যার মানে সব দেশে দেখাবে

  if(res) res.innerHTML='<span style="color:#2563eb">⏳ Saving…</span>';
  try{
    await sb.from('custom_offers').insert({ title, description:desc, link, payout, category, image_url:img, countries, active:true, created_at:new Date().toISOString() });
    if(res) res.innerHTML='<span style="color:#059669">✅ Offer added!</span>';
    ['coTitle','coDesc','coLink','coPayout','coCategory','coImage','coCountryCustom'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
    $$('.coCountryChk').forEach(chk=>chk.checked=false);
    if($('#coCountryAll')) $('#coCountryAll').checked=true;
    loadAdminCustomOffers();
  }catch(e){ if(res) res.innerHTML=`<span style="color:#ef4444">❌ ${e.message}</span>`; }
}

async function deleteCustomOffer(id){
  if(!confirm('এই offer delete করবেন?')) return;
  await sb.from('custom_offers').delete().eq('id',id);
  toast('Offer deleted','s'); loadAdminCustomOffers();
}

async function loadAdminCustomOffers(){
  const wrap=document.getElementById('coList');
  if(!wrap) return;
  try{
    const {data}=await sb.from('custom_offers').select('*').order('created_at',{ascending:false});
    if(!data?.length){ wrap.innerHTML='<div style="font-size:12px;color:#94a3b8;text-align:center;padding:10px">কোনো offer নেই</div>'; return; }
    wrap.innerHTML=`<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px">Existing Offers (${data.length})</div>`
      +data.map(o=>{
        const cs = (o.countries&&Array.isArray(o.countries)&&o.countries.length) ? o.countries.join(', ') : '🌍 সব দেশ';
        return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:7px;display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:12px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.title)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">$${parseFloat(o.payout||0).toFixed(2)} · ${escapeHtml(o.category||'Custom')}</div>
        <div style="font-size:10px;color:#2563eb;margin-top:2px;font-weight:600">📍 ${escapeHtml(cs)}</div></div>
        <button onclick="deleteCustomOffer('${o.id}')" style="background:#fee2e2;border:1px solid #fecaca;color:#ef4444;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">🗑</button>
      </div>`;}).join('');
  }catch(e){ wrap.innerHTML='<div style="font-size:12px;color:#ef4444">Load error</div>'; }
}

// ── Admin → Push Notification sender ────────────────────
async function adminSendPush(){
  const title = ($('#pushTitle')?.value||'').trim();
  const body  = ($('#pushBody')?.value||'').trim();
  const res   = document.getElementById('pushResult');
  if(!title || !body){ if(res) res.innerHTML='<span style="color:#ef4444">⚠️ Title ও Message দুটোই লিখুন</span>'; return; }
  if(res) res.innerHTML='<span style="color:#2563eb">⏳ পাঠানো হচ্ছে…</span>';
  const result = await sendPushToAll(title, body);
  if(result?.ok){
    if(res) res.innerHTML=`<span style="color:#059669">✅ ${result.recipients||'সব'} জনের কাছে পাঠানো হয়েছে!</span>`;
    // In-app notice হিসেবেও সেভ করো যাতে যারা push পায়নি তারাও দেখে
    const nid = 'push_'+Date.now();
    await fDB.ref(`notices/${nid}`).set({ title, body, createdAt: Date.now(), type:'push' });
    toast('✅ Notification পাঠানো হয়েছে!','s');
  } else {
    if(res) res.innerHTML=`<span style="color:#ef4444">❌ ${result?.error||'কিছু একটা সমস্যা হয়েছে। REST API Key চেক করুন।'}</span>`;
  }
}

async function saveAnnouncement(){
  const val=document.getElementById('announcementInput')?.value?.trim()||'';
  // ✅ settings table এ data column এ save করো
  await sb.from('settings').upsert({id:'announcement', data:val},{onConflict:'id'}).catch(()=>{});
  S.siteSettings={...(S.siteSettings||{}), announcement:val};
  EZCache.invalidate('settings_announcement');
  showToast('✅ Announcement saved!','green');
}
async function clearAnnouncement(){
  await sb.from('settings').upsert({id:'announcement', data:''},{onConflict:'id'}).catch(()=>{});
  S.siteSettings={...(S.siteSettings||{}), announcement:''};
  EZCache.invalidate('settings_announcement');
  const inp=document.getElementById('announcementInput');
  if(inp) inp.value='';
  showToast('🗑️ Announcement cleared','blue');
}

// 🆕 Community News Video — admin panel থেকে YouTube/Facebook/TikTok লিংক সেট/মুছে ফেলা
async function saveCommunityVideo(){
  const val=document.getElementById('communityVideoInput')?.value?.trim()||'';
  if(val && !communityVideoEmbedUrl(val)){
    showToast('⚠️ এই লিংকটা চেনা যায়নি — YouTube/Facebook/TikTok লিংক দিন','red');
    return;
  }
  const payload = val ? JSON.stringify({url:val}) : '';
  await sb.from('settings').upsert({id:'communityVideo', data:payload},{onConflict:'id'}).catch(()=>{});
  S.siteSettings={...(S.siteSettings||{}), communityVideo: val ? {url:val} : null};
  EZCache.invalidate('settings_communityVideo');
  showToast(val ? '✅ Video saved!' : '🗑️ Video removed', val ? 'green' : 'blue');
  if(S.page==='home') render();
}
async function clearCommunityVideo(){
  await sb.from('settings').upsert({id:'communityVideo', data:''},{onConflict:'id'}).catch(()=>{});
  S.siteSettings={...(S.siteSettings||{}), communityVideo: null};
  EZCache.invalidate('settings_communityVideo');
  const inp=document.getElementById('communityVideoInput');
  if(inp) inp.value='';
  showToast('🗑️ Video removed','blue');
  if(S.page==='home') render();
}


// ═══════════════════════════════════════════════════════
//  NEW FEATURES — Dark Mode, PWA, Push, Skeleton,
//  Leaderboard, Badges, Level, Streak, Daily Bonus
// ═══════════════════════════════════════════════════════

// ── DARK MODE ──────────────────────────────────────────
function initDarkMode(){
  if(S.darkMode) document.body.classList.add('dark');
}
function toggleDarkMode(){
  S.darkMode=!S.darkMode;
  document.body.classList.toggle('dark', S.darkMode);
  localStorage.setItem('ez_dark', S.darkMode?'1':'0');
  toast(S.darkMode?'🌙 Dark mode on':'☀️ Light mode on','s',2000);
  render();
}

// ── PWA INSTALL ────────────────────────────────────────
// ── Review Popup — 24 ঘণ্টা পরপর দেখায়, একবার review দিলে আর আসে না ──
const REVIEW_GOOGLE    = 'PASTE_YOUR_GOOGLE_REVIEW_LINK_HERE';
const REVIEW_TRUSTPILOT = 'PASTE_YOUR_TRUSTPILOT_REVIEW_LINK_HERE';
const REVIEW_LS_KEY    = 'ez_review_done';
const REVIEW_SHOWN_KEY = 'ez_review_last_shown';
const REVIEW_INTERVAL  = 24*60*60*1000; // ২৪ ঘণ্টা

function checkReviewPopup(){
  // একবার review দিলে আর কখনো দেখাবে না
  if(localStorage.getItem(REVIEW_LS_KEY)) return;
  const lastShown = parseInt(localStorage.getItem(REVIEW_SHOWN_KEY)||'0');
  if(Date.now() - lastShown < REVIEW_INTERVAL) return;
  // ২৪ ঘণ্টা পর দেখাও
  setTimeout(showReviewPopup, 8000); // app open-এর ৮ সেকেন্ড পর
}

function showReviewPopup(){
  if(localStorage.getItem(REVIEW_LS_KEY)) return;
  localStorage.setItem(REVIEW_SHOWN_KEY, Date.now().toString());
  const pop = document.createElement('div');
  pop.id = 'reviewPop';
  pop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:9998;display:flex;align-items:flex-end;justify-content:center;padding:20px;backdrop-filter:blur(4px)';
  pop.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:24px 20px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:slideUp .3s ease">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:36px;margin-bottom:8px">⭐</div>
        <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:#0f172a;margin-bottom:6px">আপনার মতামত দিন!</div>
        <div style="font-size:13px;color:#64748b;line-height:1.6">আপনার একটা review আমাদের অনেক সাহায্য করে। মাত্র ১ মিনিট লাগবে।</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
        <a href="${REVIEW_GOOGLE}"
          onclick="markReviewDone();openLink('${REVIEW_GOOGLE}');return false;"
          style="display:flex;align-items:center;gap:12px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:13px 15px;text-decoration:none">
          <img src="https://www.gstatic.com/images/branding/product/2x/maps_96dp.png" style="width:32px;height:32px;object-fit:contain;border-radius:8px" onerror="this.style.display='none'">
          <div>
            <div style="font-weight:700;font-size:13px;color:#1e3a8a">Google Review দিন</div>
            <div style="font-size:11px;color:#64748b">⭐⭐⭐⭐⭐ Google-এ</div>
          </div>
          <span style="margin-left:auto;color:#2563eb;font-weight:700">→</span>
        </a>
        <a href="${REVIEW_TRUSTPILOT}"
          onclick="markReviewDone();openLink('${REVIEW_TRUSTPILOT}');return false;"
          style="display:flex;align-items:center;gap:12px;background:#f0fdf4;border:1.5px solid #a7f3d0;border-radius:14px;padding:13px 15px;text-decoration:none">
          <img src="https://cdn.trustpilot.net/brand-assets/4.1.0/logo-white.svg" style="width:32px;height:32px;object-fit:contain;border-radius:8px;background:#00b67a;padding:4px" onerror="this.style.display='none'">
          <div>
            <div style="font-weight:700;font-size:13px;color:#065f46">Trustpilot Review দিন</div>
            <div style="font-size:11px;color:#64748b">⭐⭐⭐⭐⭐ Trustpilot-এ</div>
          </div>
          <span style="margin-left:auto;color:#059669;font-weight:700">→</span>
        </a>
      </div>
      <button onclick="dismissReviewPopup()"
        style="width:100%;background:#f1f5f9;border:none;border-radius:12px;padding:12px;font-size:13px;color:#64748b;font-weight:600;cursor:pointer">
        পরে করব
      </button>
    </div>`;
  document.body.appendChild(pop);
}

function markReviewDone(){
  localStorage.setItem(REVIEW_LS_KEY,'1');
  const pop = document.getElementById('reviewPop');
  if(pop) pop.remove();
}

function dismissReviewPopup(){
  const pop = document.getElementById('reviewPop');
  if(pop) pop.remove();
  // dismiss করলেও ২৪ ঘণ্টা পর আবার দেখাবে (review না দেওয়া পর্যন্ত)
}

// ── Service Worker (শুধু ব্রাউজার/PWA ফলব্যাকের জন্য, নেটিভ APK-তে দরকার নেই) ──
function initPWA(){
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if(isNative) return; // নেটিভ APK-তে push native FCM দিয়ে হয়, browser SW লাগে না
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then(reg=>{ console.log('✅ FCM SW registered'); })
      .catch(err=>{ console.log('FCM SW failed:', err); });
  }
}

// ══════════════════════════════════════════════════════════
// নেটিভ Android — Back বাটন হ্যান্ডলিং
// ══════════════════════════════════════════════════════════
// কেন দরকার: এটা ছাড়া ফোনের Back বাটন চাপলে App যেকোনো পেজ থেকে
// হঠাৎ বন্ধ হয়ে যেতে পারে, কোনো নিশ্চিতকরণ ছাড়াই — খারাপ অভিজ্ঞতা।
// এখন এভাবে কাজ করবে:
//   • কোনো মডাল/পপআপ খোলা থাকলে → শুধু সেটা বন্ধ হবে
//   • Home ছাড়া অন্য পেজে থাকলে → Home পেজে ফিরিয়ে নেবে
//   • Home পেজে থাকলে → "আরেকবার Back চাপুন Exit করতে" টোস্ট দেখাবে,
//     ২ সেকেন্ডের মধ্যে আবার চাপলে App বন্ধ হবে
let _lastBackPress = 0;
function initBackButton(){
  if(!window.Capacitor?.Plugins?.App) return; // ব্রাউজারে এই প্লাগিন নেই, স্বাভাবিক
  const { App: CapApp } = window.Capacitor.Plugins;

  CapApp.addListener('backButton', ()=>{
    // ১) কোনো মডাল/ওভারলে খোলা থাকলে সেটাই আগে বন্ধ করো
    const openModal = document.querySelector('.modal-ov.show, .sheet-ov.show, .lightbox.show');
    if(openModal){ openModal.classList.remove('show'); return; }
    if(typeof S!=='undefined' && S.adActive){ return; } // rewarded ad চলাকালীন back বন্ধ

    // ২) Home ট্যাব ছাড়া অন্য কোথাও থাকলে → Home এ ফিরাও
    if(typeof S!=='undefined' && S.tab && S.tab!=='home'){
      navTo('home');
      return;
    }

    // ৩) Home এ থাকলে → double-back-to-exit
    const now = Date.now();
    if(now - _lastBackPress < 2000){
      CapApp.exitApp();
    } else {
      _lastBackPress = now;
      toast(T('pressBackAgainExit')||'আরেকবার Back চাপুন App বন্ধ করতে','w',2000);
    }
  });
}

// ══════════════════════════════════════════════════════════
// ⚠️ নতুন — Google/Facebook Social Login সেটআপ
// ══════════════════════════════════════════════════════════
// Google Sign-In প্লাগিন (@capgo/capacitor-social-login) একবার শুরুতেই
// initialize করতে হয় — capacitor.config.json এর webClientId ব্যবহার করে।
// এটা না করলে SocialLogin.login() কল করলে এরর দেবে।
function initSocialLogin(){
  if(!window.Capacitor?.Plugins?.SocialLogin) return; // ব্রাউজারে/প্লাগিন ছাড়া স্বাভাবিক
  try{
    const { SocialLogin } = window.Capacitor.Plugins;
    // ⚠️ capacitor.config.json এর plugins.SocialLogin এ webClientId বসাতে হবে —
    // এখানে placeholder থাকলে Google Login কাজ করবে না (নিচে সতর্কতা দেখাবে)
    const webClientId = '1040669106457-618hjrn9cb9mobtr642damtomb0b4dkr.apps.googleusercontent.com';
    if(!webClientId || webClientId.includes('PASTE_YOUR')){
      console.warn('⚠️ Google Sign-In webClientId সেট করা হয়নি — Google Login কাজ করবে না।');
      return;
    }
    SocialLogin.initialize({ google:{ webClientId } });
  }catch(e){ console.warn('SocialLogin init failed', e); }
}

// Facebook লগইন সিস্টেম ব্রাউজারে হয় (দেখুন js/db.js এর signInWithFacebook)।
// ইউজার Facebook-এ অনুমতি দেওয়ার পর "earnova://oauth-callback?code=..."
// লিংকে ফিরে আসে — এই একই appUrlOpen ইভেন্ট সেটা ধরে। আগের ইমেইল
// ভেরিফিকেশন deep-link (এখন বাদ) থেকে এটা সম্পূর্ণ আলাদা: এটা শুধু
// "earnova://oauth-callback" পাথ প্রসেস করে, অন্য কিছু না।
function initSocialLoginCallback(){
  if(!window.Capacitor?.Plugins?.App) return;
  const { App: CapApp } = window.Capacitor.Plugins;
  CapApp.addListener('appUrlOpen', async (data)=>{
    try{
      if(!data?.url) return;
      const url = new URL(data.url);
      if(url.protocol!=='earnova:' || url.host!=='oauth-callback') return; // শুধু OAuth callback-ই প্রসেস করবে
      const code = url.searchParams.get('code');
      if(!code){
        const err = url.searchParams.get('error_description') || url.searchParams.get('error');
        if(err) toast(T('socialLoginFailedMsg'),'e');
        return;
      }
      await completeSocialOAuthLogin(code);
    }catch(e){ console.error('OAuth callback handling failed:', e); }
  });
}

// ══════════════════════════════════════════════════════════
// নেটিভ Android — Status Bar স্টাইলিং
// ══════════════════════════════════════════════════════════
// App-এর থিম কালারের (#2563eb) সাথে ফোনের ওপরের নোটিফিকেশন বার মিলিয়ে দেয়
function initStatusBar(){
  if(!window.Capacitor?.Plugins?.StatusBar) return;
  try{
    const { StatusBar } = window.Capacitor.Plugins;
    StatusBar.setBackgroundColor({ color: '#2563eb' });
    StatusBar.setStyle({ style: 'DARK' }); // status bar আইকন সাদা দেখাবে (গাঢ় ব্যাকগ্রাউন্ডের জন্য)
    StatusBar.setOverlaysWebView({ overlay: false });
  }catch(e){ console.warn('StatusBar init failed', e); }
}

// ══════════════════════════════════════════════════════════
// নেটিভ Android — Offline সনাক্তকরণ + ব্লকিং Overlay
// ══════════════════════════════════════════════════════════
// ⚠️ ফিক্স: আগে এখানে শুধু একটা পাতলা লাল বার দেখানো হতো (উপরে, সতর্কতা
// হিসেবে) — কিন্তু ইউজার তখনও অ্যাপের বাকি অংশ ব্যবহার করতে পারত, বাটনে
// চাপতে পারত, ফর্ম পূরণ করতে পারত — শুধু সেই অ্যাকশনগুলো ভেতরে ভেতরে
// network error দিয়ে ব্যর্থ হতো (confusing experience)। এখন পুরো স্ক্রিন
// জুড়ে একটা overlay দেখানো হয় যেটা পুরো অ্যাপকে block করে দেয় — যতক্ষণ
// না সংযোগ ফিরে আসে, ইউজার এর পেছনের কোনো বাটন/ইনপুটে ক্লিক করতে পারবে
// না। সংযোগ ফিরলে এটা নিজে থেকেই সরে যায়।
//
// এছাড়া `navigator.onLine` ব্রাউজার/WebView-তে নির্ভরযোগ্য না — এটা শুধু
// ডিভাইসের নেটওয়ার্ক অ্যাডাপ্টার চালু আছে কিনা দেখে, আসলেই ইন্টারনেট
// পাওয়া যাচ্ছে কিনা তা না (যেমন WiFi-তে কানেক্টেড কিন্তু internet নেই এমন
// অবস্থায়ও এটা "online" বলতে পারে)। তাই "Retry" বাটনে চাপলে শুধু
// navigator.onLine না দেখে, সত্যিকারের একটা ছোট নেটওয়ার্ক রিকোয়েস্ট
// পাঠিয়ে (Supabase-এ) আসল সংযোগ যাচাই করা হয়।
let _realConnectivityCheckInFlight = false;
async function checkRealConnectivity(){
  if(_realConnectivityCheckInFlight) return false;
  _realConnectivityCheckInFlight = true;
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), 6000);
    await fetch(SUPA_URL, { method:'HEAD', cache:'no-store', mode:'no-cors', signal: ctrl.signal });
    clearTimeout(timer);
    return true; // fetch রিজেক্ট না করলেই বোঝা যায় নেটওয়ার্ক সত্যিই আছে
  }catch(e){
    return false;
  }finally{
    _realConnectivityCheckInFlight = false;
  }
}

function initOfflineDetection(){
  const ensureOverlay = ()=>{
    let ov = document.getElementById('offlineOverlay');
    if(ov) return ov;
    ov = document.createElement('div');
    ov.id = 'offlineOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;gap:14px;';
    ov.innerHTML = `
      <div style="font-size:56px">📡</div>
      <div style="font-family:'Syne',sans-serif;font-size:19px;font-weight:800;color:#fff">${T('offlineBlockTitle')}</div>
      <div style="font-size:13px;color:#94a3b8;max-width:320px;line-height:1.7">${T('offlineBlockSub')}</div>
      <button id="offlineRetryBtn" style="margin-top:10px;background:linear-gradient(135deg,#2563eb,#059669);border:none;border-radius:10px;padding:12px 28px;font-size:14px;font-weight:700;color:#fff;cursor:pointer">${T('retryConnectionBtn')}</button>
    `;
    document.body.appendChild(ov);
    document.getElementById('offlineRetryBtn').onclick = async (e)=>{
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.disabled = true; btn.textContent = '⏳...';
      const ok = await checkRealConnectivity();
      if(ok){
        hideOverlay();
      } else {
        btn.disabled = false; btn.textContent = original;
      }
    };
    return ov;
  };
  const showOverlay = ()=>{ ensureOverlay().style.display = 'flex'; };
  const hideOverlay = ()=>{
    const ov = document.getElementById('offlineOverlay');
    if(ov) ov.style.display = 'none';
  };
  window.addEventListener('offline', showOverlay);
  window.addEventListener('online', ()=>{
    // navigator.onLine নির্ভরযোগ্য না, তাই "online" ইভেন্ট এলেও একটা real
    // চেক করে তারপরই overlay সরানো হচ্ছে — নাহলে ভুল করে "সংযোগ আছে" ভেবে
    // overlay সরে যেতে পারে যদিও আসলে internet নেই
    checkRealConnectivity().then(ok=>{ if(ok) hideOverlay(); });
  });
  if(!navigator.onLine) showOverlay();
}

// ══════════════════════════════════════════════════════════
// ONBOARDING TUTORIAL — নতুন ইউজারের প্রথম App খোলাতে ৪-স্লাইড ওয়াকথ্রু
// ══════════════════════════════════════════════════════════
// localStorage flag দিয়ে একবারই দেখানো হয় (per-device) — পরবর্তীতে
// আবার login করলেও এটা দ্বিতীয়বার দেখাবে না
const ONBOARDING_SLIDES = [
  { icon:'🎯', title:'Welcome to EARNOVA!', desc:'Complete simple offers, watch ads, and earn real money — right from your phone.' },
  { icon:'📺', title:'Watch & Earn', desc:'Tap "Watch & Earn" to watch a short video and get instant balance — no purchase needed.' },
  { icon:'👥', title:'Invite & Earn More', desc:'Share your referral code with friends — earn a bonus every time someone joins using it.' },
  { icon:'💳', title:'Withdraw Anytime', desc:'Once you reach the minimum balance, cash out via bKash, Nagad, PayPal, USDT and more.' },
];
let _obSlideIdx = 0;

function showOnboardingTutorial(){
  if(document.getElementById('onboardingOverlay')) return; // আগে থেকে খোলা থাকলে দ্বিতীয়বার না বসানো
  _obSlideIdx = 0;
  const ov = document.createElement('div');
  ov.id = 'onboardingOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeUp .25s ease';
  ov.innerHTML = _renderOnboardingSlide();
  document.body.appendChild(ov);
  _wireOnboardingButtons();
}

function _renderOnboardingSlide(){
  const s = ONBOARDING_SLIDES[_obSlideIdx];
  const isLast = _obSlideIdx === ONBOARDING_SLIDES.length - 1;
  const dots = ONBOARDING_SLIDES.map((_,i)=>`<span style="width:${i===_obSlideIdx?'20px':'7px'};height:7px;border-radius:4px;background:${i===_obSlideIdx?'#2563eb':'#cbd5e1'};transition:.25s;display:inline-block"></span>`).join('');
  return `
  <div style="background:#fff;border-radius:22px;padding:32px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35)">
    <button id="obSkip" style="position:absolute;top:0;right:0;background:none;border:none;color:#94a3b8;font-size:12px;font-weight:700;padding:14px;cursor:pointer">Skip</button>
    <div style="font-size:56px;margin-bottom:16px">${s.icon}</div>
    <div class="sf" style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:10px">${escapeHtml(s.title)}</div>
    <div style="font-size:13px;color:#64748b;line-height:1.6;margin-bottom:22px">${escapeHtml(s.desc)}</div>
    <div style="display:flex;justify-content:center;gap:6px;margin-bottom:20px">${dots}</div>
    <button id="obNext" class="btn bp" style="width:100%">${isLast?"Get Started 🚀":'Next →'}</button>
  </div>`;
}

function _wireOnboardingButtons(){
  const ov = document.getElementById('onboardingOverlay');
  if(!ov) return;
  ov.style.position = 'fixed'; // relative anchor for the Skip button's absolute position
  const inner = ov.querySelector('div');
  if(inner) inner.style.position = 'relative';
  const skipBtn = document.getElementById('obSkip');
  const nextBtn = document.getElementById('obNext');
  if(skipBtn) skipBtn.onclick = closeOnboardingTutorial;
  if(nextBtn) nextBtn.onclick = ()=>{
    if(_obSlideIdx < ONBOARDING_SLIDES.length - 1){
      _obSlideIdx++;
      ov.innerHTML = _renderOnboardingSlide();
      _wireOnboardingButtons();
    } else {
      closeOnboardingTutorial();
    }
  };
}

function closeOnboardingTutorial(){
  localStorage.setItem('ez_onboarding_done', '1');
  const ov = document.getElementById('onboardingOverlay');
  if(ov) ov.remove();
  trackEvent('onboarding_complete', { last_slide: _obSlideIdx });
}

