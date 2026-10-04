function buildReferralPage(){
  const ud=S.userData||{};
  const refLink=`${location.origin}${location.pathname}?ref=${ud.refCode||''}`;
  const daysSince = ud.createdAt ? Math.max(0,Math.floor((Date.now()-new Date(ud.createdAt).getTime())/(86400000))) : 0;
  return `<div class="ph"><div class="pt">👥 ${T('refCode')||'Referral'}</div>
  <div class="ps">${T('referralPageSub')}</div></div>

  <div class="hx-plate">
    <div class="hx-plate-lb">${T('yourRefCodeLabel')}</div>
    <div class="hx-plate-code">${ud.refCode||'——'}</div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="hx-mbtn" onclick="copyText('${ud.refCode||''}')">${T('copyCodeBtn')}</button>
      <button class="hx-mbtn" onclick="copyText('${refLink}')">${T('copyLinkBtn')}</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div class="hx-stat">
      <small>${T('referralEarnedLabel')}</small>
      <b>${fmt$(ud.referralEarned||0)}</b>
    </div>
    <div class="hx-stat g">
      <small>${T('totalReferredLabel')}</small>
      <b>${ud.referralCount||0}</b>
    </div>
  </div>

  <div class="card mb12">
    <div class="card-hd">${T('howItWorksCard')}</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
      <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#374151">
        <span style="width:28px;height:28px;border-radius:50%;background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">1</span>
        ${T('refStep1')}
      </div>
      <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#374151">
        <span style="width:28px;height:28px;border-radius:50%;background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">2</span>
        ${T('refStep2')}
      </div>
      <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#374151">
        <span style="width:28px;height:28px;border-radius:50%;background:#d1fae5;color:#059669;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">3</span>
        ${T('refStep3')}
      </div>
    </div>
  </div>

  <div id="myReferralsList"><div style="text-align:center;padding:16px;color:#94a3b8;font-size:13px">${T('loadingReferrals')}</div></div>`;
}

// ── PROFILE PAGE — শুধু ব্যক্তিগত তথ্য ──────────────────
function buildProfile(){
  const ud=S.userData||{};
  const daysSince = ud.createdAt ? Math.max(0,Math.floor((Date.now()-new Date(ud.createdAt).getTime())/(86400000))) : 0;
  return `<div class="profile-top-glow">
  <div class="ph"><div class="pt">👤 ${T('pr')}</div><div class="ps">${T('ms')} ${fmtD(ud.createdAt)}</div></div>
  </div>

  <!-- Avatar & Basic Info -->
  <div class="card profile-avatar-card hx-steel mb12" style="text-align:center">
    <div class="hx-av">${escapeHtml((ud.name||ud.email||'?')[0].toUpperCase())}</div>
    <div style="font-weight:800;font-size:16px;color:#0f172a">${escapeHtml(ud.name)||'—'}</div>
    <div style="font-size:13px;color:#3b4650;margin-bottom:4px">${escapeHtml(ud.email)||'—'}</div>
    ${ud.isAdmin?`<span class="bdg bdp">⚙️ ${T('profAdminBadge')}</span>`:''}
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div class="hx-stat">
      <small>💰 ${T('profTotalEarned')}</small>
      <b id="liveStatTotalEarned">${fmt$(ud.usdEarned||0)}</b>
    </div>
    <div class="hx-stat b">
      <small>🎯 ${T('profOffersDone')}</small>
      <b>${ud.offersCompleted||0}</b>
    </div>
    <div class="hx-stat g">
      <small>📅 ${T('profDaysActive')}</small>
      <b>${daysSince}</b>
    </div>
    <div class="hx-stat s">
      <small>🌍 ${T('profCountry')}</small>
      <b>${ud.country||S.country||'—'}</b>
    </div>
  </div>

  <!-- Level & Streak -->
  <div class="card mb12">
    <div class="card-hd">${getUserLevel(ud.usdEarned).icon} ${T('profLevelPrefix')} <span class="${getUserLevel(ud.usdEarned).cls}">${getUserLevel(ud.usdEarned).name}</span></div>
    ${getUserLevel(ud.usdEarned).next?`
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:6px">
      <span>${T('profProgressNext')}</span><span>${getUserLevel(ud.usdEarned).progress}%</span>
    </div>
    <div class="lvl-bar-wrap"><div class="lvl-bar" style="width:${Math.min(getUserLevel(ud.usdEarned).progress,100)}%"></div></div>`
    :`<div style="text-align:center;font-size:13px;color:#7c3aed;font-weight:700">${T('profMaxLevel')}</div>`}
    <div class="div mt12 mb12"></div>
    <div class="card-hd mt12">🔥 ${T('profLoginStreak')}</div>
    ${buildStreakUI(ud)}
  </div>

  <!-- Settings -->
  <div class="card mb12">
    <div class="card-hd">⚙️ ${T('sett')}</div>
    <label class="lbl">${T('nm')}</label>
    <input class="inp" id="prfNm" value="${escapeHtml(ud.name||'')}">
    <button class="btn bp" id="prfSv">${T('sv')}</button>
  </div>

  <div class="card mb12">
    <div class="card-hd">🌐 ${T('ln')}</div>
    <button class="btn bh" onclick="EZ.openLM()">${T('profChangeLang')} ${LANGS[S.lang]?.f||'🇺🇸'} ${LANGS[S.lang]?.n||'English'}</button>
  </div>

  <!-- 🪪 Identity Verification (KYC) -->
  <div class="card mb12">
    <div class="card-hd">🪪 Identity Verification</div>
    ${ud.kycStatus==='approved' ? `
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px;text-align:center;color:#059669;font-weight:700;font-size:13px">✅ Verified — you can withdraw any amount</div>
    ` : ud.kycStatus==='pending' ? `
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:12px;text-align:center;color:#b45309;font-weight:700;font-size:13px">⏳ Under review — usually takes 1-2 business days</div>
    ` : `
      <div style="font-size:12px;color:#64748b;margin-bottom:10px">
        ${ud.kycStatus==='rejected' ? '❌ Your last submission was rejected — please try again with a clearer photo. ' : ''}
        Required for withdrawals of $${CFG.kycThreshold}+. Upload a clear photo of your government ID (NID/Passport/Driving License).
      </div>
      <label class="lbl">Full Name (as on ID)</label>
      <input class="inp" id="kycName" placeholder="John Doe">
      <label class="lbl">ID Number</label>
      <input class="inp" id="kycIdNum" placeholder="e.g. NID number">
      <label class="lbl">ID Photo</label>
      <input type="file" accept="image/*" id="kycPhoto" class="inp" style="padding:8px">
      <button class="btn bp mt12" id="kycSubmitBtn">📤 Submit for Verification</button>
    `}
  </div>

  <!-- Notification Preferences -->
  <div class="card mb12">
    <div class="card-hd">🔔 Notification Preferences</div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eef2f7">
      <div>
        <div style="font-size:13px;font-weight:700;color:#0f172a">💰 Balance &amp; Withdrawal</div>
        <div style="font-size:11px;color:#64748b">উইথড্র স্ট্যাটাস ও ব্যালেন্স আপডেট</div>
      </div>
      <label class="switch"><input type="checkbox" id="notifBalance" ${(ud.notifPrefs?.balance!==false)?'checked':''}><span class="slider"></span></label>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eef2f7">
      <div>
        <div style="font-size:13px;font-weight:700;color:#0f172a">🎁 New Offers &amp; Tasks</div>
        <div style="font-size:11px;color:#64748b">নতুন অফার ও টাস্কের নোটিফিকেশন</div>
      </div>
      <label class="switch"><input type="checkbox" id="notifOffers" ${(ud.notifPrefs?.offers!==false)?'checked':''}><span class="slider"></span></label>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0">
      <div>
        <div style="font-size:13px;font-weight:700;color:#0f172a">📢 General Announcements</div>
        <div style="font-size:11px;color:#64748b">সাধারণ ঘোষণা ও আপডেট</div>
      </div>
      <label class="switch"><input type="checkbox" id="notifGeneral" ${(ud.notifPrefs?.general!==false)?'checked':''}><span class="slider"></span></label>
    </div>
    <button class="btn bp mt12" id="notifPrefSave">${T('sv')}</button>
  </div>

  <div class="div mt16"></div>
  <button class="btn br" id="prfLo">🚪 ${T('lo')}</button>`;
}

// ── KYC জমা দেওয়া — ID ছবি আপলোড + kyc_submissions টেবিলে রেকর্ড ──
async function submitKYC(){
  const uid = S.user?.uid;
  if(!uid){ toast(T('notLoggedInMsg')||'⚠️ আগে লগইন করুন','e'); return; }
  const name = $('#kycName')?.value.trim();
  const idNum = $('#kycIdNum')?.value.trim();
  const fileInput = $('#kycPhoto');
  const file = fileInput?.files?.[0];

  if(!name || !idNum){ toast('⚠️ নাম ও ID নম্বর দুটোই দিন','w'); return; }
  if(!file){ toast('⚠️ ID এর ছবি বেছে নিন','w'); return; }
  if(file.size > 5*1024*1024){ toast('⚠️ ছবির সাইজ 5MB এর কম হতে হবে','w'); return; }

  const btn = $('#kycSubmitBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Uploading...'; }

  try{
    // ── একই 'proofs' storage bucket ব্যবহার হচ্ছে (social task proof-এর
    //    জন্য যেটা আগে থেকেই আছে), শুধু 'kyc/' প্রিফিক্স দিয়ে আলাদা রাখা হচ্ছে ──
    const storagePath = `kyc/${uid}_${Date.now()}.jpg`;
    const {error: upErr} = await sb.storage.from('proofs').upload(storagePath, file, {upsert:true});
    if(upErr){ toast('⚠️ Upload failed: '+upErr.message,'e'); if(btn){btn.disabled=false;btn.textContent='📤 Submit for Verification';} return; }
    const {data:urlData} = sb.storage.from('proofs').getPublicUrl(storagePath);

    if(btn) btn.textContent='⏳ Saving...';
    await sb.from('kyc_submissions').insert({
      id: 'KYC-'+Date.now(),
      uid, full_name:name, id_number:idNum, user_email: S.user?.email||S.userData?.email||'',
      photo_url: urlData.publicUrl,
      status:'pending', created_at: Date.now(),
    });
    await sb.from('users').update({ kyc_status:'pending' }).eq('id', uid);
    if(S.userData) S.userData.kycStatus = 'pending';
    toast('✅ জমা হয়েছে! ১-২ কার্যদিবসের মধ্যে যাচাই করা হবে।','s',5000);
    trackEvent('kyc_submitted', {});
    render();
  }catch(e){
    toast('⚠️ সমস্যা হয়েছে: '+e.message,'e');
    if(btn){ btn.disabled=false; btn.textContent='📤 Submit for Verification'; }
  }
}
async function saveNotifPrefs(){
  if(!S.user?.uid) return;
  const prefs = {
    balance: $('#notifBalance')?.checked !== false,
    offers:  $('#notifOffers')?.checked  !== false,
    general: $('#notifGeneral')?.checked !== false,
  };
  try{
    await sb.from('users').update({ notif_prefs: prefs }).eq('id', S.user.uid);
    if(S.userData) S.userData.notifPrefs = prefs;
    toast('✅ Notification preferences saved','s');
  }catch(e){ toast('⚠️ সেভ করতে সমস্যা হয়েছে','w'); }
}

// ─── NOTICES PAGE ─────────────────────────────────────
function buildNotices(){
  return `<div class="ph"><div class="pt">📢 ${T('ns')}</div><div class="ps">${T('nt')}</div></div>
  <div id="noticesList"><div class="empty"><div class="ein">⏳</div><div class="etx">${T('loadingGenericMsg')}</div></div></div>`;
}

async function loadNotices(){
  const el=$('#noticesList'); if(!el) return;
  const snap=await fDB.ref('notices').orderByChild('created_at').limitToLast(20).once('value');
  const data=snap.val()||{};
  const items=Object.entries(data).map(([id,v])=>({...v,id}))
    .sort((a,b)=>(b.created_at||b.createdAt||0)-(a.created_at||a.createdAt||0));
  if(!items.length){ el.innerHTML=`<div class="empty"><div class="ein">📭</div><div class="etx">${T('nun2')}</div></div>`; return; }
  const readMap=S.userData?.readNotices||{};
  el.innerHTML=items.map(n=>`<div class="nc-item" data-notice-id="${n.id}">
    <div class="${readMap[n.id]?'':'nc-dot'}"></div>
    <div style="flex:1">
      <div class="fw6 sm">${escapeHtml(n.text.slice(0,60))}…</div>
      <div class="xs mu mt8">${timeAgo(n.created_at||n.createdAt||Date.now())}</div>
    </div>
    <button class="btn bp bau bsm">${readMap[n.id]?T('close'):T('vn')}</button>
  </div>`).join('');
  // Attach click events
  $$('[data-notice-id]').forEach(el=>{
    el.querySelector('button').onclick=()=>{
      const id=el.dataset.noticeId;
      const notice=items.find(n=>n.id===id);
      if(notice){
        const readMap2=S.userData?.readNotices||{};
        if(readMap2[id]){
          // Already read, just show
          showNoticeFinal(notice);
        } else {
          // Must watch ad first
          viewNotice(notice);
        }
      }
    };
  });
}

// ─── SOCIAL TASKS PAGE ────────────────────────────────
// ══════════════════════════════════════════════════════════════
// 📱 SOCIAL TASKS — compact list + আলাদা detail page + multi-step proof
// ══════════════════════════════════════════════════════════════
// • List: ছোট row (icon, title, reward, x/y progress, Do button) + search + category chip
// • Do চাপলে → detail page (নিয়ম, Open Task, proof steps)
// • Admin task বানানোর সময় proof_steps (JSONB) ঠিক করে: কোন step এ photo, কোনটায় text/link
// • proof_steps না থাকলে (পুরনো task) → আগের মতো ১টা screenshot
// • Approved / Pending / Full row তে click করলে কিছুই হয় না; শুধু Do ও Redo খোলে
let _stTasks = {};          // taskId → task (country filter এর পর)
let _stSubs = {};           // taskId → {approved, pending, latest}
let _stQuery = '';
let _stCat = 'all';
let _stActiveSteps = [];    // detail page এ এই মুহূর্তে দেখানো steps

// task এর proof steps — না থাকলে ১টা screenshot (legacy)
function stSteps(t){
  let st = t && t.proof_steps;
  if(typeof st === 'string'){ try{ st = JSON.parse(st); }catch(e){ st = null; } }
  if(!Array.isArray(st) || !st.length){
    return [{label:'', type:'photo', required:true, legacy:true}];
  }
  return st.slice(0,8).map(s=>({
    label: String((s&&s.label)||'').slice(0,120),
    type: (s&&s.type)==='text' ? 'text' : 'photo',
    required: !(s&&s.required===false)
  }));
}

function stState(id, t){
  const sub = _stSubs[id] || {approved:0, pending:0, latest:null};
  const maxPer = parseInt(t.max_per_user)||1;
  const isFull = (t.maxWorkers||0)>0 && (t.currentWorkers||0)>=(t.maxWorkers||0);
  if(sub.pending>0) return 'pending';
  if(sub.approved>=maxPer) return 'done';
  if(isFull) return 'full';
  if(sub.latest==='rejected') return 'redo';
  return 'do';
}

function stTypeLabel(tp){
  return tp==='follow'?T('taskTypeFollow'):tp==='subscribe'?T('taskTypeSubscribe'):tp==='watch'?T('taskTypeWatch')
    :tp==='like'?T('taskTypeLike'):tp==='comment'?T('taskTypeComment'):tp==='share'?T('taskTypeShare'):T('taskTypeDefault');
}

function stIconHtml(t, size){
  const logo = CFG.socialLogo && CFG.socialLogo[t.platform];
  const fb = escapeHtml(t.icon||'📱');
  return logo
    ? `<img src="${logo}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:10px" onerror="this.parentNode.textContent='📱'">`
    : fb;
}

function buildSocialTasks(){
  // ── Detail mode ──
  if(S.socialView){
    return `
    <div class="ph">
      <button class="btn bh bau bsm mb12" onclick="closeSocialTask()">← ${T('back')}</button>
      <div class="pt">${T('tkDetailTitle')}</div>
    </div>
    <div id="socialTasksList"><div class="card" style="text-align:center;padding:30px"><div style="font-size:32px;margin-bottom:10px">⏳</div><div style="font-size:13px;color:#64748b">${T('loadingTasksMsg')}</div></div></div>`;
  }
  // ── List mode ──
  return `
  <div class="ph">
    <div class="pt">${T('socialTitle')}</div>
    <div class="ps">${T('socialSub')}</div>
  </div>
  <div class="tk-searchbox">
    <span class="tk-searchic">🔍</span>
    <input id="tkSearch" class="tk-search" type="search" value="${escapeHtml(_stQuery)}" placeholder="${escapeHtml(T('tkSearchPh'))}" oninput="stSetQuery(this.value)">
  </div>
  <div id="tkChips" class="tk-chips"></div>
  <div id="socialTasksList"><div class="card" style="text-align:center;padding:30px"><div style="font-size:32px;margin-bottom:10px">⏳</div><div style="font-size:13px;color:#64748b">${T('loadingTasksMsg')}</div></div></div>

  <!-- My Submissions -->
  <div class="card mt12">
    <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#1e40af;margin-bottom:12px">${T('mySubmissionsTitle')}</div>
    <div id="mySubmissions"><div style="font-size:12px;color:#64748b;text-align:center;padding:16px">${T('loadingGenericMsg')}</div></div>
  </div>`;
}

function openSocialTask(id){
  S.socialView = id;
  render();
  window.scrollTo(0,0);
}
function closeSocialTask(){
  S.socialView = null;
  render();
  window.scrollTo(0,0);
}

function stSetQuery(v){ _stQuery = String(v||'').trim().toLowerCase(); stRenderRows(); }
function stSetCat(c){ _stCat = c; stRenderChips(); stRenderRows(); }

// Load social tasks from Supabase
async function loadSocialTasks(){
  const el = document.getElementById('socialTasksList');
  if(!el) return;
  // detail form খোলা থাকলে (ইউজার লিখছে/ছবি বেছেছে) background refresh এ মুছে ফেলা যাবে না
  if(S.socialView && el.dataset.detailFor===S.socialView && el.querySelector('#tkForm')) return;
  try{
    // Use cache — only call Supabase if cache expired
    let tasks = EZCache.get('socialTasks');
    if(!tasks){
      const {data:tData} = await sb.from('social_tasks').select('*').eq('status','active').order('created_at',{ascending:false});
      // Object format এ convert করো যাতে বাকি code কাজ করে
      tasks = {};
      (tData||[]).forEach(t=>{
        tasks[t.id] = {
          ...t,
          maxWorkers: t.max_workers ?? 100,
          currentWorkers: t.current_workers ?? 0
        };
      });
      EZCache.set('socialTasks', tasks);
    }
    // ── Country filter ──
    const filteredEntries = Object.entries(tasks).filter(([,t])=>taskVisibleForUser(t));
    _stTasks = Object.fromEntries(filteredEntries);

    // ── submissions টেবিল থেকে status নাও (সরাসরি) ──
    const uid = S.user?.uid;
    _stSubs = {};
    if(uid){
      const {data:mySubData} = await sb.from('submissions')
        .select('id,task_id,status')
        .eq('uid', uid)
        .order('created_at', {ascending:false});
      (mySubData||[]).forEach(s=>{
        const o = _stSubs[s.task_id] || (_stSubs[s.task_id] = {approved:0, pending:0, latest:null});
        if(o.latest===null) o.latest = s.status;      // প্রথমটাই latest (created_at desc)
        if(s.status==='approved') o.approved++;
        else if(s.status==='pending') o.pending++;
      });
    }

    if(S.socialView){ stRenderDetail(el); setupSubmissionsRealtime(); return; }

    stRenderChips();
    stRenderRows();
    loadMySubmissions();
    setupSubmissionsRealtime();
  } catch(e){ el.innerHTML=`<div class="card" style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">${T('errorLoadingTasksMsg')}</div>`; }
}

function stRenderChips(){
  const box = document.getElementById('tkChips');
  if(!box) return;
  const types = [];
  Object.values(_stTasks).forEach(t=>{ const k=t.task_type||'follow'; if(!types.includes(k)) types.push(k); });
  if(types.length<2){ box.innerHTML=''; if(_stCat!=='all') _stCat='all'; return; }
  if(_stCat!=='all' && !types.includes(_stCat)) _stCat='all';
  box.innerHTML = [`<button class="tk-chip ${_stCat==='all'?'on':''}" onclick="stSetCat('all')">${T('tkAll')}</button>`]
    .concat(types.map(k=>`<button class="tk-chip ${_stCat===k?'on':''}" onclick="stSetCat('${k}')">${stTypeLabel(k)}</button>`)).join('');
}

function stRenderRows(){
  const el = document.getElementById('socialTasksList');
  if(!el || S.socialView) return;
  const all = Object.entries(_stTasks);
  if(!all.length){
    el.innerHTML=`<div class="card" style="text-align:center;padding:30px"><div style="font-size:32px;margin-bottom:10px">😔</div><div style="font-size:13px;color:#64748b">${T('noTasksCountryMsg')}</div></div>`;
    return;
  }
  const rank = {do:0, redo:0, pending:1, done:2, full:3};
  let list = all.filter(([,t])=>{
    if(_stCat!=='all' && (t.task_type||'follow')!==_stCat) return false;
    if(_stQuery){
      const hay = ((t.title||'')+' '+(t.platform||'')+' '+stTypeLabel(t.task_type||'follow')).toLowerCase();
      if(!hay.includes(_stQuery)) return false;
    }
    return true;
  }).map(([id,t],i)=>({id,t,i,st:stState(id,t)}));
  list.sort((a,b)=> (rank[a.st]-rank[b.st]) || (a.i-b.i));
  if(!list.length){
    el.innerHTML=`<div class="card" style="text-align:center;padding:24px"><div style="font-size:28px;margin-bottom:8px">🔎</div><div style="font-size:13px;color:#64748b">${T('tkNoMatch')}</div></div>`;
    return;
  }
  el.innerHTML = list.map(x=>stRowHtml(x.id,x.t,x.st)).join('');
}

function stRowHtml(id, t, st){
  const steps = stSteps(t);
  const nPhoto = steps.filter(s=>s.type==='photo').length;
  const nText = steps.length - nPhoto;
  const cur = t.currentWorkers||0, max = t.maxWorkers||0;
  const pct = max>0 ? Math.min(100, Math.round(cur/max*100)) : 0;
  const safeId = String(id).replace(/[^\w\-]/g,'');
  let action = '', cls = 'tk-row', click = '';
  if(st==='do' || st==='redo'){
    click = ` onclick="openSocialTask('${safeId}')"`;
    action = st==='redo'
      ? `<span class="tk-btn tk-redo">↻ ${T('tkRedo')}</span>`
      : `<span class="tk-btn tk-do">${T('tkDo')}</span>`;
  } else {
    cls += ' tk-locked';
    action = st==='pending' ? `<span class="tk-pill tk-pill-wait">⏳ ${T('tkPending')}</span>`
      : st==='done' ? `<span class="tk-pill tk-pill-ok">✅ ${T('tkApproved')}</span>`
      : `<span class="tk-pill tk-pill-full">${T('tkFull')}</span>`;
  }
  const need = `${nPhoto?`📷 ${nPhoto}`:''}${nPhoto&&nText?'  ':''}${nText?`📝 ${nText}`:''}`;
  return `
  <div class="${cls}"${click}>
    <div class="tk-ic">${stIconHtml(t,30)}</div>
    <div class="tk-mid">
      <div class="tk-title">${escapeHtml(t.title)}</div>
      <div class="tk-meta"><span class="tk-tag">${stTypeLabel(t.task_type||'follow')}</span><span class="tk-need">${need}</span></div>
      <div class="tk-prog"><div class="tk-bar"><i style="width:${pct}%"></i></div><span>${cur}/${max>0?max:'∞'}</span></div>
    </div>
    <div class="tk-side">
      <div class="tk-reward">$${parseFloat(t.reward||0).toFixed(3)}</div>
      ${action}
    </div>
  </div>`;
}

function stRenderDetail(el){
  const id = S.socialView;
  const t = _stTasks[id];
  el.dataset.detailFor = '';
  if(!t){
    el.innerHTML = `<div class="card" style="text-align:center;padding:30px"><div style="font-size:32px;margin-bottom:10px">😔</div><div style="font-size:13px;color:#64748b;margin-bottom:14px">${T('taskNotFoundMsg')}</div><button class="btn bp bau" onclick="closeSocialTask()">← ${T('back')}</button></div>`;
    return;
  }
  const st = stState(id, t);
  const steps = stSteps(t);
  _stActiveSteps = steps;
  const cur = t.currentWorkers||0, max = t.maxWorkers||0;
  const pct = max>0 ? Math.min(100, Math.round(cur/max*100)) : 0;
  const link = escapeHtml(t.link||'');
  const sub = _stSubs[id] || {};

  const hero = `
  <div class="tk-hero">
    <div class="tk-hero-top">
      <div class="tk-hero-ic">${stIconHtml(t,34)}</div>
      <div style="flex:1;min-width:0">
        <div class="tk-hero-title">${escapeHtml(t.title)}</div>
        <div class="tk-hero-tags"><span>${stTypeLabel(t.task_type||'follow')}</span><span>${escapeHtml(t.platform||'')}</span></div>
      </div>
      <div class="tk-hero-rw"><small>${T('statusEarn')}</small><b>$${parseFloat(t.reward||0).toFixed(3)}</b></div>
    </div>
    <div class="tk-hero-prog"><div class="tk-bar tk-bar-dk"><i style="width:${pct}%"></i></div><span>${cur}/${max>0?max:'∞'} ${T('slotsWord')}</span></div>
  </div>`;

  const rules = `
  <div class="card">
    <div class="card-hd">📌 ${T('tkRules')}</div>
    <div class="tk-rules">${escapeHtml(t.description||'')}</div>
    <button class="btn tk-open" data-u="${link}" onclick="openLink(this.dataset.u)">🔗 ${T('openTaskBtn').replace(/^🔗\s*/,'')}</button>
  </div>`;

  let proofBlock = '';
  if(st==='pending' || st==='done' || st==='full'){
    const msg = st==='pending' ? T('waitingApprovalMsg') : st==='done' ? T('taskApprovedMsg') : T('allSlotsFilledMsg');
    const cl = st==='pending' ? 'stc-status-pending' : st==='done' ? 'stc-status-approved' : 'stc-status-full';
    proofBlock = `<div class="card"><div class="stc-status ${cl}">${msg}</div></div>`;
  } else {
    const redo = st==='redo' ? `<div class="stc-status stc-status-rejected" style="margin-bottom:12px">${T('rejectedResubmitMsg')}</div>` : '';
    proofBlock = `
    <div class="card" id="tkForm">
      <div class="card-hd">📤 ${T('tkSubmitProof')}</div>
      ${redo}
      ${steps.map((s,i)=>stStepHtml(s,i)).join('')}
      <button id="tkSubmit" class="stc-submit-btn stc-submit-off" disabled onclick="submitTaskProof('${String(id).replace(/[^\w\-]/g,'')}')">${T('tkFillAll')}</button>
    </div>`;
  }
  el.innerHTML = hero + rules + proofBlock;
  if(st==='do' || st==='redo') el.dataset.detailFor = id;
}

function stStepHtml(s, i){
  const label = s.label || (s.legacy ? T('tkScreenshot') : (s.type==='photo' ? T('tkScreenshot') : T('tkTextProof')));
  const req = s.required ? '<b class="tk-req">*</b>' : `<em class="tk-opt">${T('tkOptional')}</em>`;
  const head = `<div class="tk-step-hd"><span class="tk-num">${i+1}</span><div class="tk-step-lb">${escapeHtml(label)} ${req}</div></div>`;
  if(s.type==='text'){
    return `<div class="tk-step">${head}
      <textarea id="tkTxt_${i}" class="tk-inp" rows="2" maxlength="500" placeholder="${escapeHtml(T('tkTextPh'))}" oninput="stRefreshSubmit()"></textarea>
    </div>`;
  }
  return `<div class="tk-step">${head}
    <div class="tk-drop" id="tkDrop_${i}" onclick="document.getElementById('tkFile_${i}').click()">
      <div id="tkPrev_${i}">
        <div class="tk-drop-ic">☁️</div>
        <div class="tk-drop-t">${T('tapSelectScreenshot')}</div>
        <div class="tk-drop-s">JPG, PNG, WebP · Max 5MB</div>
      </div>
      <input type="file" id="tkFile_${i}" accept="image/*" style="display:none" onchange="stPickPhoto(${i},this)">
    </div>
  </div>`;
}

function stPickPhoto(i, input){
  const file = input.files[0];
  if(!file) return;
  if(!/^image\//.test(file.type||'')){ toast(T('tkImageOnly'),'e'); input.value=''; return; }
  if(file.size > 5*1024*1024){ toast(T('fileTooLargeMsg'),'e'); input.value=''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('tkPrev_'+i);
    const drop = document.getElementById('tkDrop_'+i);
    if(prev){
      prev.innerHTML = `<img src="${e.target.result}" class="tk-prev-img" alt="">
        <div class="tk-prev-row"><span>✅ ${escapeHtml(file.name)}</span><button type="button" class="tk-prev-x" onclick="event.stopPropagation();stClearPhoto(${i})">✕</button></div>`;
    }
    if(drop) drop.classList.add('has');
    stRefreshSubmit();
  };
  reader.readAsDataURL(file);
}

function stClearPhoto(i){
  const inp = document.getElementById('tkFile_'+i);
  if(inp) inp.value = '';
  const prev = document.getElementById('tkPrev_'+i);
  const drop = document.getElementById('tkDrop_'+i);
  if(prev) prev.innerHTML = `<div class="tk-drop-ic">☁️</div><div class="tk-drop-t">${T('tapSelectScreenshot')}</div><div class="tk-drop-s">JPG, PNG, WebP · Max 5MB</div>`;
  if(drop) drop.classList.remove('has');
  stRefreshSubmit();
}

// সব required step ভরা হলেই Submit চালু
function stRefreshSubmit(){
  const btn = document.getElementById('tkSubmit');
  if(!btn || btn.dataset.busy==='1') return;
  let ok = true, any = false;
  _stActiveSteps.forEach((s,i)=>{
    let filled = false;
    if(s.type==='photo') filled = !!document.getElementById('tkFile_'+i)?.files[0];
    else filled = (document.getElementById('tkTxt_'+i)?.value||'').trim().length>=3;
    if(filled) any = true;
    if(s.required && !filled) ok = false;
  });
  ok = ok && any;
  btn.disabled = !ok;
  btn.className = 'stc-submit-btn ' + (ok ? 'stc-submit-on' : 'stc-submit-off');
  btn.textContent = ok ? T('submitProofBtn') : T('tkFillAll');
}

// ── Supabase Realtime for submissions ─────────────────
let _subRealtimeChannel = null;
function setupSubmissionsRealtime(){
  if(!S.user) return;
  if(_subRealtimeChannel){
    sb.removeChannel(_subRealtimeChannel);
    _subRealtimeChannel = null;
  }
  _subRealtimeChannel = sb.channel('submissions_realtime_'+S.user.uid)
    .on('postgres_changes',{
      event: 'UPDATE',
      schema: 'public',
      table: 'submissions',
      filter: `uid=eq.${S.user.uid}`
    }, payload=>{
      const newStatus = payload.new?.status;
      const reward = parseFloat(payload.new?.reward||0);
      if(S.page==='social') loadSocialTasks();
      if(newStatus === 'approved'){
        toast(`✅ Task Approved! +$${reward.toFixed(2)}`,'s');
      } else if(newStatus === 'rejected'){
        toast('❌ Submission rejected. You can resubmit.','e',5000);
      }
    })
    .subscribe();
}

async function loadMySubmissions(){
  const el = document.getElementById('mySubmissions');
  if(!el||!S.user) return;
  // Supabase directly — snake_case
  const {data:sData} = await sb.from('submissions').select('*').eq('uid',S.user.uid).order('created_at',{ascending:false}).limit(5);
  const list = sData||[];
  if(!list.length){ el.innerHTML=`<div style="font-size:12px;color:#64748b;text-align:center;padding:10px">${T('noSubmissionsMsg')}</div>`; return; }
  el.innerHTML = list.map(s=>`
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9">
    <div><div style="font-size:13px;font-weight:600;color:#0f172a">${s.task_title||s.taskTitle||''}</div><div style="font-size:11px;color:#94a3b8;margin-top:2px">${new Date(s.created_at||s.createdAt||Date.now()).toLocaleDateString()}</div></div>
    <div style="font-size:12px;font-weight:700;padding:4px 10px;border-radius:8px;${s.status==='approved'?'background:#f0fdf4;color:#059669':s.status==='rejected'?'background:#fef2f2;color:#dc2626':'background:#fefce8;color:#d97706'}">${s.status==='approved'?T('subApproved'):s.status==='rejected'?T('subRejected'):T('subPending')}</div>
  </div>`).join('');
}

// ── Image Compress function ────────────────────────────
function compressImage(file, maxKB=100){
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if(w > 800){ h = Math.round(h * 800 / w); w = 800; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while(dataUrl.length > maxKB * 1024 * 1.37 && quality > 0.2){
          quality = Math.round((quality - 0.1) * 10) / 10;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        const arr = dataUrl.split(',');
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8 = new Uint8Array(n);
        while(n--) u8[n] = bstr.charCodeAt(n);
        resolve(new File([u8], 'proof.jpg', {type:'image/jpeg'}));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// storage থেকে একসাথে কয়েকটা proof ছবি মুছে ফেলা (আপলোড ব্যর্থ হলে cleanup)
async function stRemoveUploads(paths){
  try{ if(paths && paths.length) await sb.storage.from('proofs').remove(paths); }catch(e){}
}

async function submitTaskProof(taskId){
  const uid = S.user?.uid||'unknown';
  const email = S.user?.email||'unknown';
  const submitBtn = document.getElementById('tkSubmit');
  if(submitBtn && submitBtn.dataset.busy==='1') return;   // double-tap guard

  // ── ইনপুট সংগ্রহ + required যাচাই ───────────────────────
  const steps = _stActiveSteps || [];
  const collected = [];   // {i, s, file?, text?}
  for(let i=0;i<steps.length;i++){
    const s = steps[i];
    if(s.type==='photo'){
      const f = document.getElementById('tkFile_'+i)?.files[0];
      if(!f){ if(s.required){ toast(T('selectScreenshotFirstMsg'),'e'); return; } continue; }
      collected.push({i, s, file:f});
    } else {
      const v = (document.getElementById('tkTxt_'+i)?.value||'').trim();
      if(v.length<3){ if(s.required){ toast(T('tkFillAll'),'e'); return; } continue; }
      collected.push({i, s, text:v.slice(0,500)});
    }
  }
  if(!collected.length){ toast(T('tkFillAll'),'e'); return; }

  // ── Submit button busy ──────────────────────────────────
  const setBusy = (txt)=>{ if(submitBtn){ submitBtn.dataset.busy='1'; submitBtn.disabled=true; submitBtn.textContent=txt; } };
  const clearBusy = ()=>{ if(submitBtn){ submitBtn.dataset.busy='0'; submitBtn.disabled=false; submitBtn.className='stc-submit-btn stc-submit-on'; submitBtn.textContent=T('submitProofBtn'); } };
  setBusy('⏳ Uploading...');

  let slotClaimedAtomically = false;
  const uploaded = [];
  try{
    // ── ছবি compress (প্রতিটা ~100KB) ───────────────────────
    for(const c of collected){
      if(c.file) c.file = await compressImage(c.file, 100);
    }

    // ── Task data check ──────────────────────────────
    const {data:taskData} = await sb.from('social_tasks').select('*').eq('id',taskId).single();
    if(!taskData){ toast(T('taskNotFoundMsg'),'e'); clearBusy(); return; }
    // admin steps বদলে থাকলে পুরনো ফর্মে জমা নেওয়া হবে না
    const freshSteps = stSteps(taskData);
    if(freshSteps.length !== steps.length || freshSteps.some((s,i)=>s.type!==steps[i].type)){
      toast(T('tkTaskChanged'),'w');
      EZCache.invalidate('socialTasks');
      S.socialView = null; render();
      return;
    }

    // ── Duplicate check with max_per_user ────────────
    const {data:dupChecks} = await sb.from('submissions')
      .select('id,status').eq('uid',uid).eq('task_id',taskId);
    const maxAllowed = taskData.max_per_user || 1;
    const approvedCount = (dupChecks||[]).filter(s=>s.status==='approved').length;
    const pendingCount = (dupChecks||[]).filter(s=>s.status==='pending').length;
    if(approvedCount >= maxAllowed){
      toast(T('alreadyCompletedTaskMsg'),'w');
      clearBusy();
      return;
    }
    if(pendingCount > 0){
      toast(T('alreadySubmittedWaitingMsg'),'w');
      clearBusy();
      return;
    }

    // ══════════════════════════════════════════════════════════
    // Task Slot Overselling Race Condition — atomic_claim_slot RPC
    // (ছবি আপলোডের *আগেই* সিট বুক; ঠিক যতগুলো সিট খালি ততজনই সফল হবে)
    // ══════════════════════════════════════════════════════════
    const maxW = parseInt(taskData.max_workers||0);
    let newCur = null;      // এই সাবমিশনের পর টাস্কের নতুন current_workers সংখ্যা

    if(maxW > 0){
      const { data: claimResult, error: slotErr } = await sb.rpc('atomic_claim_slot', {
        p_table:'social_tasks', p_id:taskId, p_cur_field:'current_workers', p_max_field:'max_workers'
      });
      if(slotErr){
        // RPC না থাকলে (Supabase-এ SQL এখনো বসানো হয়নি) — কম নিরাপদ fallback
        const curW = parseInt(taskData.current_workers||0);
        if(curW >= maxW){
          toast(T('taskFullMsg'),'w');
          clearBusy();
          return;
        }
        newCur = curW + 1;
      } else if(claimResult === null){
        toast(T('taskFullMsg'),'w');
        clearBusy();
        return;
      } else {
        newCur = claimResult;
        slotClaimedAtomically = true;
      }
    }
    // আপলোড/সেভ ব্যর্থ হলে বুক করা সিট ফেরত দেওয়ার ফাংশন
    const releaseSlotIfClaimed = async ()=>{
      if(slotClaimedAtomically){
        slotClaimedAtomically = false;
        try{ await sb.rpc('atomic_increment', { p_table:'social_tasks', p_id:taskId, p_field:'current_workers', p_delta:-1 }); }catch(e){}
      }
    };
    const failAndRelease = async (msg)=>{
      await stRemoveUploads(uploaded);
      await releaseSlotIfClaimed();
      toast(msg,'e');
      clearBusy();
    };

    // ── Supabase Storage এ প্রতিটা photo upload ────────
    const subId = 'SUB-'+Date.now();
    const proofs = [];
    let firstPhotoUrl = '';
    for(const c of collected){
      const label = c.s.label || (c.s.type==='photo' ? 'Screenshot' : 'Text');
      if(c.file){
        setBusy('⏳ Uploading photo '+(proofs.filter(p=>p.type==='photo').length+1)+'...');
        const storagePath = `${uid}/${subId}_${c.i}.jpg`;
        const {error: upErr} = await sb.storage.from('proofs').upload(storagePath, c.file, {upsert:true});
        if(upErr){ await failAndRelease(T('photoUploadFailedMsg')+' '+upErr.message); return; }
        uploaded.push(storagePath);
        const {data: urlData} = sb.storage.from('proofs').getPublicUrl(storagePath);
        if(!firstPhotoUrl) firstPhotoUrl = urlData.publicUrl;
        proofs.push({label, type:'photo', value:urlData.publicUrl});
      } else {
        proofs.push({label, type:'text', value:c.text});
      }
    }

    // ── Supabase এ submission save ───────────────────
    setBusy('⏳ Saving...');
    const baseRow = {
      id: subId,
      uid: uid,
      task_id: taskId,
      task_title: taskData.title,
      reward: parseFloat(taskData.reward)||0,   // reward সবসময় DB থেকে, ইউজারের পাঠানো মান নয়
      user_email: email,
      photo_url: firstPhotoUrl,
      status: 'pending',
      created_at: Date.now()
    };
    let { error: subErr } = await sb.from('submissions').upsert({...baseRow, proofs}, {onConflict:'id'});
    if(subErr && /proofs/i.test(subErr.message||'')){
      // `proofs` কলাম এখনো নেই (SQL চালানো হয়নি) — শুধু ১টা photo হলে পুরনো পদ্ধতিতে সেভ
      if(proofs.length===1 && proofs[0].type==='photo'){
        ({ error: subErr } = await sb.from('submissions').upsert(baseRow, {onConflict:'id'}));
      } else {
        await failAndRelease(T('tkNeedSql'));
        return;
      }
    }
    if(subErr){
      await failAndRelease(T('photoUploadFailedMsg')+' '+subErr.message);
      return;
    }

    // submission সেভ হয়ে গেছে — এরপর কিছু ব্যর্থ হলেও ছবি/সিট আর ফেরত নেওয়া যাবে না
    uploaded.length = 0;
    slotClaimedAtomically = false;

    // ── current_workers আপডেট ────────────────────────
    if(maxW > 0){
      if(newCur >= maxW){
        await sb.from('social_tasks').update({status:'disabled'}).eq('id',taskId);
      }
    } else {
      const curWUnlimited = parseInt(taskData.current_workers||0);
      await sb.from('social_tasks').update({current_workers: curWUnlimited + 1}).eq('id',taskId);
    }
    EZCache.invalidate('socialTasks');

    // ── Success ──────────────────────────────────────
    showToast(T('proofSubmittedMsg'),'green',4000);
    const ct2 = EZCache.get(`completedTasks_${uid}`) || {};
    ct2[taskId] = 'pending';
    EZCache.set(`completedTasks_${uid}`, ct2);
    // Supabase এও 'pending' marker — jsonb_merge_key RPC (atomic)
    try{
      const {error:jsonRpcErr} = await sb.rpc('jsonb_merge_key', {
        p_table:'users', p_id:uid, p_field:'completed_tasks', p_key:String(taskId), p_value:'pending'
      });
      if(jsonRpcErr){
        const {data:ctRow2} = await sb.from('users').select('completed_tasks').eq('id',uid).maybeSingle();
        const ctDB = ctRow2?.completed_tasks || {};
        ctDB[taskId] = 'pending';
        await sb.from('users').update({completed_tasks: ctDB}).eq('id', uid);
      }
    }catch(e2){}
    // detail থেকে list এ ফিরে যাও
    S.socialView = null;
    render();
    window.scrollTo(0,0);
    // social task submit সফল হওয়ার পর natural transition point এ interstitial
    showInterstitialAd();

  }catch(e){
    await stRemoveUploads(uploaded);
    if(slotClaimedAtomically){
      try{ await sb.rpc('atomic_increment', { p_table:'social_tasks', p_id:taskId, p_field:'current_workers', p_delta:-1 }); }catch(e3){}
    }
    toast(T('genericErrorMsg')+' '+e.message,'e');
    clearBusy();
  }
}

// ─── FAQ PAGE ─────────────────────────────────────────
function buildFAQ(){
  const faqs=[
    {q:'How do I earn money on EARNOVA?',a:'You can earn by completing CPA offers, watching ads, completing surveys, installing apps, and referring friends. Each completed task credits your account balance.'},
    {q:'What is the minimum withdrawal amount?',a:'The minimum withdrawal amount is $12.00 USD. You also need at least 5 active referrals to unlock withdrawals.'},
    {q:'How long does withdrawal take?',a:'Withdrawals are processed within 3–7 business days. Once approved by admin, payment is sent to your chosen method (bKash, Nagad, PayPal, USDT, etc.).'},
    {q:'What payment methods are supported?',a:'We support bKash, Nagad, PayPal, Visa/Mastercard, Payoneer, and USDT (TRC20). Select your preferred method during withdrawal.'},
    {q:'How does the referral system work?',a:'Share your unique referral code with friends. When they sign up and become active users (watch at least 1 ad), they count as your active referrals. You earn a bonus for each referral.'},
    {q:'Why do I need to watch ads to unlock offerwalls?',a:'Watching 4 ads unlocks the whole offerwall page for 24 hours. This helps us maintain the platform and ensures only genuine users access premium offers.'},
    {q:'Is EARNOVA available worldwide?',a:'Yes! EARNOVA is available worldwide. Earning rates vary by country — users from the US, UK, Canada, Australia earn higher rates ($0.50/offer) compared to other regions ($0.10–$0.30/offer).'},
    {q:'How do I verify my email?',a:'After registration, a verification link is sent to your email. Click the link, then come back to the app and click "I\'ve Verified". Email verification is required to use the platform.'},
    {q:'Can I create multiple accounts?',a:'No. Only 2 accounts are allowed per device. Creating multiple accounts to abuse the system will result in a permanent ban.'},
    {q:'What happens if my withdrawal is rejected?',a:'If your withdrawal is rejected, your balance is not deducted. Rejections usually happen due to unmet requirements (insufficient balance or referrals). Contact support for details.'},
    {q:'How do I contact support?',a:'Visit our Support page or email us at support@earnzonepro.com. We respond within 24–48 hours on business days.'},
    {q:'Is my personal data safe?',a:'Yes. We use Supabase Authentication and follow strict data protection practices. We never sell your data. Read our Privacy Policy for full details.'},
  ];
  return `<div class="ph">
    <button class="btn bh bau bsm mb12" onclick="S.page='home';render()">← ${T('back')}</button>
    <div class="pt">${T('faqPageTitle')}</div>
    <div class="ps">${T('faqPageSub')}</div>
  </div>
  ${faqs.map((f,i)=>`
  <div class="card" style="cursor:pointer" onclick="this.querySelector('.faq-ans').style.display=this.querySelector('.faq-ans').style.display==='none'?'block':'none'">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="font-weight:700;font-size:13px;color:#0f172a;flex:1">${f.q}</div>
      <div style="color:#2563eb;font-size:18px;flex-shrink:0">+</div>
    </div>
    <div class="faq-ans" style="display:none;font-size:13px;color:#64748b;line-height:1.7;margin-top:10px;padding-top:10px;border-top:1px solid #dbeafe">${f.a}</div>
  </div>`).join('')}
  <div style="text-align:center;margin-top:16px;padding-bottom:20px">
    <div style="font-size:13px;color:#64748b;margin-bottom:12px">${T('faqStillQuestions')}</div>
    <a href="support.html" onclick="openLink('support.html');return false;" class="btn bp bau" style="display:inline-flex;text-decoration:none;padding:10px 22px;font-size:13px">${T('faqContactBtn')}</a>
  </div>`;
}

