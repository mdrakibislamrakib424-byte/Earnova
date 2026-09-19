function buildReferralPage(){
  const ud=S.userData||{};
  const refLink=`${location.origin}${location.pathname}?ref=${ud.refCode||''}`;
  const daysSince = ud.createdAt ? Math.max(0,Math.floor((Date.now()-new Date(ud.createdAt).getTime())/(86400000))) : 0;
  return `<div class="ph"><div class="pt">👥 ${T('refCode')||'Referral'}</div>
  <div class="ps">${T('referralPageSub')}</div></div>

  <div style="background:linear-gradient(135deg,#1e40af,#065f46);border-radius:20px;padding:22px 18px;margin-bottom:14px;text-align:center;box-shadow:0 8px 24px rgba(37,99,235,.2)">
    <div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">${T('yourRefCodeLabel')}</div>
    <div style="font-family:'Syne',sans-serif;font-size:34px;font-weight:800;color:#fff;letter-spacing:.2em;margin-bottom:12px">${ud.refCode||'——'}</div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button onclick="copyText('${ud.refCode||''}')" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:9px 16px;cursor:pointer;color:#fff;font-size:12px;font-weight:700">${T('copyCodeBtn')}</button>
      <button onclick="copyText('${refLink}')" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:9px 16px;cursor:pointer;color:#fff;font-size:12px;font-weight:700">${T('copyLinkBtn')}</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div style="background:linear-gradient(135deg,#10b981 0%,#065f46 100%);box-shadow:0 4px 14px rgba(16,185,129,.35);border-radius:14px;padding:14px;text-align:center">
      <div style="font-size:10px;color:rgba(255,255,255,.8);font-weight:700;text-transform:uppercase;margin-bottom:5px">${T('referralEarnedLabel')}</div>
      <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff">${fmt$(ud.referralEarned||0)}</div>
    </div>
    <div style="background:linear-gradient(135deg,#ec4899 0%,#9d174d 100%);box-shadow:0 4px 14px rgba(236,72,153,.35);border-radius:14px;padding:14px;text-align:center">
      <div style="font-size:10px;color:rgba(255,255,255,.8);font-weight:700;text-transform:uppercase;margin-bottom:5px">${T('totalReferredLabel')}</div>
      <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff">${ud.referralCount||0}</div>
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
  return `<div class="ph"><div class="pt">👤 ${T('pr')}</div><div class="ps">${T('ms')} ${fmtD(ud.createdAt)}</div></div>

  <!-- Avatar & Basic Info -->
  <div class="card mb12" style="text-align:center">
    <div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#2563eb);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;margin:0 auto 12px;box-shadow:0 0 30px rgba(124,58,237,.3)">${escapeHtml((ud.name||ud.email||'?')[0].toUpperCase())}</div>
    <div style="font-weight:700;font-size:16px;color:#0f172a">${escapeHtml(ud.name)||'—'}</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:4px">${escapeHtml(ud.email)||'—'}</div>
    ${ud.isAdmin?`<span class="bdg bdp">⚙️ ${T('profAdminBadge')}</span>`:''}
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div style="background:linear-gradient(135deg,#10b981 0%,#065f46 100%);box-shadow:0 4px 14px rgba(16,185,129,.35);border-radius:14px;padding:14px;text-align:center">
      <div style="font-size:10px;color:rgba(255,255,255,.8);font-weight:700;text-transform:uppercase;margin-bottom:4px">💰 ${T('profTotalEarned')}</div>
      <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#fff">${fmt$(ud.usdEarned||0)}</div>
    </div>
    <div style="background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);box-shadow:0 4px 14px rgba(37,99,235,.35);border-radius:14px;padding:14px;text-align:center">
      <div style="font-size:10px;color:rgba(255,255,255,.8);font-weight:700;text-transform:uppercase;margin-bottom:4px">🎯 ${T('profOffersDone')}</div>
      <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#fff">${ud.offersCompleted||0}</div>
    </div>
    <div style="background:linear-gradient(135deg,#f59e0b 0%,#b45309 100%);box-shadow:0 4px 14px rgba(245,158,11,.35);border-radius:14px;padding:14px;text-align:center">
      <div style="font-size:10px;color:rgba(255,255,255,.8);font-weight:700;text-transform:uppercase;margin-bottom:4px">📅 ${T('profDaysActive')}</div>
      <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#fff">${daysSince}</div>
    </div>
    <div style="background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%);box-shadow:0 4px 14px rgba(139,92,246,.35);border-radius:14px;padding:14px;text-align:center">
      <div style="font-size:10px;color:rgba(255,255,255,.8);font-weight:700;text-transform:uppercase;margin-bottom:4px">🌍 ${T('profCountry')}</div>
      <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#fff">${ud.country||S.country||'—'}</div>
    </div>
  </div>

  <!-- Level & Badges -->
  <div class="card mb12">
    <div class="card-hd">${getUserLevel(ud.usdEarned).icon} ${T('profLevelPrefix')} <span class="${getUserLevel(ud.usdEarned).cls}">${getUserLevel(ud.usdEarned).name}</span></div>
    ${getUserLevel(ud.usdEarned).next?`
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:6px">
      <span>${T('profProgressNext')}</span><span>${getUserLevel(ud.usdEarned).progress}%</span>
    </div>
    <div class="lvl-bar-wrap"><div class="lvl-bar" style="width:${Math.min(getUserLevel(ud.usdEarned).progress,100)}%"></div></div>`
    :`<div style="text-align:center;font-size:13px;color:#7c3aed;font-weight:700">${T('profMaxLevel')}</div>`}
    <div class="div mt12 mb12"></div>
    <div class="card-hd">🎖️ ${T('profBadges')}</div>
    ${buildBadgesSection(ud)}
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
function buildSocialTasks(){
  const ud=S.userData||{};
  const uid=S.user?.uid||'';
  const adsWatched=parseInt(localStorage.getItem(`ez_ads_social_${uid}`)||'0');
  const unlockAt=ud.socialUnlockAt||0;
  const now=Date.now();
  const isUnlocked=unlockAt>now;

  // Locked state — need to watch ads
  if(!isUnlocked){
    return `
    <div class="ph">
      <div class="pt">${T('socialTitle')}</div>
      <div class="ps">${T('socialSub')}</div>
    </div>
    <div class="card" style="text-align:center;padding:30px 20px">
      <div style="font-size:48px;margin-bottom:14px">🔒</div>
      <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:#0f172a;margin-bottom:8px">${T('socialLockedTitle')}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:20px;line-height:1.7">${T('socialLockedDesc')}</div>
      <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:12px;margin-bottom:20px">
        <div style="font-size:12px;color:#1e40af;font-weight:600">${T('adsWatchedCount')} ${Math.min(adsWatched,5)}/5</div>
        <div style="background:#dbeafe;border-radius:6px;height:6px;margin-top:8px;overflow:hidden">
          <div style="background:linear-gradient(90deg,#2563eb,#059669);height:100%;width:${Math.min(adsWatched/5*100,100)}%;border-radius:6px"></div>
        </div>
      </div>
      <button onclick="startAd(null,'socialUnlock',()=>{})" class="btn bp bau" style="width:100%">${T('watchAdUnlockBtn')}</button>
    </div>`;
  }

  // Unlocked state
  const remaining = Math.ceil((unlockAt-now)/3600000);
  return `
  <div class="ph">
    <div class="pt">${T('socialTitle')}</div>
    <div class="ps">${T('socialSub')}</div>
  </div>
  <div style="background:rgba(5,150,105,.1);border:1.5px solid rgba(5,150,105,.3);border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
    <div style="font-size:20px">✅</div>
    <div style="font-size:12px;color:#065f46;font-weight:600">${T('unlockedForPrefix')} ${remaining} ${remaining!==1?T('moreHoursWord'):T('moreHourWord')}</div>
  </div>

  <!-- Available Tasks -->
  <div id="socialTasksList"><div class="card" style="text-align:center;padding:30px"><div style="font-size:32px;margin-bottom:10px">⏳</div><div style="font-size:13px;color:#64748b">${T('loadingTasksMsg')}</div></div></div>

  <!-- My Submissions -->
  <div class="card mt12">
    <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#1e40af;margin-bottom:12px">${T('mySubmissionsTitle')}</div>
    <div id="mySubmissions"><div style="font-size:12px;color:#64748b;text-align:center;padding:16px">${T('loadingGenericMsg')}</div></div>
  </div>`;
}

// Load social tasks from Supabase
async function loadSocialTasks(){
  const el = document.getElementById('socialTasksList');
  if(!el) return;
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
    const filteredTasks = Object.fromEntries(filteredEntries);
    tasks = filteredTasks;

    const list = Object.entries(tasks);
    if(!list.length){
      el.innerHTML=`<div class="card" style="text-align:center;padding:30px"><div style="font-size:32px;margin-bottom:10px">😔</div><div style="font-size:13px;color:#64748b">${T('noTasksCountryMsg')}</div></div>`;
      return;
    }

    // ── submissions টেবিল থেকে status নাও (সরাসরি) ──
    const uid = S.user?.uid;
    let submissionMap = {}; // taskId → {status, subId}
    if(uid){
      const {data:mySubData} = await sb.from('submissions')
        .select('id,task_id,status')
        .eq('uid', uid)
        .order('created_at', {ascending:false});
      (mySubData||[]).forEach(s=>{
        // প্রতিটা task_id এর latest submission রাখো
        if(!submissionMap[s.task_id]){
          submissionMap[s.task_id] = {status: s.status, subId: s.id};
        }
      });
    }

    el.innerHTML = list.map(([id,t])=>{
      // submissions table থেকে status দেখো
      const sub = submissionMap[id];
      const subStatus = sub?.status || null; // 'pending' | 'approved' | 'rejected' | null

      const isDone = subStatus === 'approved';
      const isPending = subStatus === 'pending';
      const isRejected = subStatus === 'rejected';
      // rejected হলে আবার submit করা যাবে
      const canSubmit = !subStatus || subStatus === 'rejected';

      const taskTypeLabel = t.task_type==='follow'?T('taskTypeFollow'):t.task_type==='subscribe'?T('taskTypeSubscribe'):t.task_type==='watch'?T('taskTypeWatch'):t.task_type==='like'?T('taskTypeLike'):t.task_type==='comment'?T('taskTypeComment'):t.task_type==='share'?T('taskTypeShare'):T('taskTypeDefault');
      const taskTypeColor = t.task_type==='follow'?'#7c3aed':t.task_type==='subscribe'?'#4f46e5':t.task_type==='watch'?'#2563eb':t.task_type==='like'?'#0891b2':t.task_type==='comment'?'#0d9488':t.task_type==='share'?'#6366f1':'#475569';
      const isFull = (t.maxWorkers||0)>0 && (t.currentWorkers||0)>=(t.maxWorkers||0);

      // ── টাস্ক টাইপ অনুযায়ী ভিন্ন gradient (নতুন/এখনো-শুরু-না-হওয়া টাস্কের জন্য) ──
      const typeGrad = t.task_type==='follow'?'linear-gradient(135deg,#7c3aed,#5b21b6)'
        : t.task_type==='subscribe'?'linear-gradient(135deg,#4f46e5,#3730a3)'
        : t.task_type==='watch'?'linear-gradient(135deg,#2563eb,#1e40af)'
        : t.task_type==='like'?'linear-gradient(135deg,#0891b2,#0e7490)'
        : t.task_type==='comment'?'linear-gradient(135deg,#0d9488,#0f766e)'
        : t.task_type==='share'?'linear-gradient(135deg,#6366f1,#4338ca)'
        : 'linear-gradient(135deg,#475569,#334155)';

      // ── Professional Status Block ──
      const headGrad = isDone
        ? 'linear-gradient(135deg,#ec4899,#be185d)'
        : isPending ? 'linear-gradient(135deg,#d97706,#b45309)'
        : isRejected ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
        : isFull ? 'linear-gradient(135deg,#64748b,#475569)'
        : typeGrad;
      const borderColor = isDone?'#f9a8d4':isPending?'#fde68a':isRejected?'#fca5a5':isFull?'#cbd5e1':'#c7d2fe';

      let statusBlock = '';
      if(isDone){
        statusBlock = `<div class="stc-status stc-status-approved">${T('taskApprovedMsg')}</div>`;
      } else if(isPending){
        statusBlock = `<div class="stc-status stc-status-pending">${T('waitingApprovalMsg')}</div>`;
      } else if(isRejected){
        statusBlock = `
        <div class="stc-status stc-status-rejected" style="margin-bottom:10px;width:100%">${T('rejectedResubmitMsg')}</div>
        <div style="font-size:11px;color:#d97706;background:rgba(217,119,6,.07);border:1px solid rgba(217,119,6,.18);border-radius:9px;padding:9px 12px;margin-bottom:10px;display:flex;align-items:center;gap:7px">
          <span style="font-size:15px">⚠️</span><span>${T('completeAgainMsg')}</span>
        </div>
        <div class="stc-upload" id="uploadArea_${id}" onclick="document.getElementById('photoInput_${id}').click()">
          <div id="uploadPreview_${id}" style="font-size:12px;color:#94a3b8">
            <div style="font-size:30px;margin-bottom:5px">📸</div>
            <div style="font-weight:600">${T('tapSelectScreenshot')}</div>
          </div>
          <input type="file" id="photoInput_${id}" accept="image/*" style="display:none" onchange="previewPhoto('${id}',this)">
        </div>
        <button id="submitBtn_${id}" data-task-title="${escapeHtml(t.title||'')}" data-task-reward="${escapeHtml(String(t.reward||0))}" onclick="submitTaskProof('${id}', this.dataset.taskTitle, this.dataset.taskReward)" disabled class="stc-submit-btn stc-submit-off">${T('selectPhotoFirstBtn')}</button>`;
      } else if(isFull){
        statusBlock = `<div class="stc-status stc-status-full">${T('allSlotsFilledMsg')}</div>`;
      } else {
        statusBlock = `
        <div style="font-size:11px;color:#d97706;background:rgba(217,119,6,.07);border:1px solid rgba(217,119,6,.18);border-radius:9px;padding:9px 12px;margin-bottom:10px;display:flex;align-items:center;gap:7px">
          <span style="font-size:15px">⚠️</span><span>${T('completeFirstMsg')}</span>
        </div>
        <div class="stc-upload" id="uploadArea_${id}" onclick="document.getElementById('photoInput_${id}').click()">
          <div id="uploadPreview_${id}" style="font-size:12px;color:#94a3b8">
            <div style="font-size:30px;margin-bottom:5px">📸</div>
            <div style="font-weight:600">${T('tapSelectScreenshot')}</div>
          </div>
          <input type="file" id="photoInput_${id}" accept="image/*" style="display:none" onchange="previewPhoto('${id}',this)">
        </div>
        <button id="submitBtn_${id}" data-task-title="${escapeHtml(t.title||'')}" data-task-reward="${escapeHtml(String(t.reward||0))}" onclick="submitTaskProof('${id}', this.dataset.taskTitle, this.dataset.taskReward)" disabled class="stc-submit-btn stc-submit-off">${T('selectPhotoFirstBtn')}</button>`;
      }

      return `
      <div class="stc" style="border-color:${borderColor};${isDone?'opacity:.82':''}">
        <div class="stc-head" style="background:${headGrad}">
          <div class="stc-icon">${CFG.socialLogo[t.platform]?`<img src="${CFG.socialLogo[t.platform]}" style="width:40px;height:40px;object-fit:contain;border-radius:10px" onerror="this.parentNode.textContent='📱'">`:(t.icon||'📱')}</div>
          <div class="stc-meta">
            <div class="stc-title" style="color:#fff">${escapeHtml(t.title)}</div>
            <div class="stc-tags">
              <span class="stc-tag" style="background:rgba(255,255,255,.22);color:#fff">${taskTypeLabel}</span>
              <span class="stc-tag" style="background:rgba(0,0,0,.18);color:rgba(255,255,255,.9)">${escapeHtml(t.platform||'Platform')}</span>
            </div>
          </div>
          <div class="stc-reward" style="background:rgba(255,255,255,.18);backdrop-filter:blur(8px)">
            <div class="stc-reward-label" style="color:rgba(255,255,255,.8)">${isDone?T('statusDone'):isPending?T('statusWait'):isRejected?T('statusFail'):isFull?T('statusFull'):T('statusEarn')}</div>
            <div class="stc-reward-val" style="color:#fff">${isDone?'✅':isPending?'⏳':isRejected?'❌':isFull?'🔴':'$'+parseFloat(t.reward||0).toFixed(2)}</div>
          </div>
        </div>
        <div class="stc-body">
          <div class="stc-desc">${escapeHtml(t.description)}</div>
          <div class="stc-slots">
            <div style="font-size:11px;color:${isFull?'#dc2626':'#64748b'};font-weight:${isFull?'700':'500'}">
              ${isFull?'🔴 '+T('fullWord'):'👥 '+(t.currentWorkers||0)+'/'+(t.maxWorkers||'∞')+' '+T('slotsWord')}
            </div>
            ${(isDone||isPending)
              ? `<span style="font-size:11px;color:#059669;font-weight:700">${T('submittedLabel')}</span>`
              : `<a href="${t.link}" onclick="openLink('${t.link}');return false;" style="background:rgba(37,99,235,.08);border:1px solid #bfdbfe;border-radius:9px;padding:5px 13px;font-size:11px;font-weight:700;color:#2563eb;text-decoration:none">${T('openTaskBtn')}</a>`
            }
          </div>
          ${statusBlock}
        </div>
      </div>`;
    }).join('');

    loadMySubmissions();
    setupSubmissionsRealtime();
  } catch(e){ el.innerHTML=`<div class="card" style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">${T('errorLoadingTasksMsg')}</div>`; }
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

// ── Photo preview function ─────────────────────────────
function previewPhoto(taskId, input){
  const file = input.files[0];
  if(!file) return;
  // File size check — 5MB max
  if(file.size > 5*1024*1024){
    toast(T('fileTooLargeMsg'),'e'); 
    input.value=''; 
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('uploadPreview_'+taskId);
    const area = document.getElementById('uploadArea_'+taskId);
    if(preview){
      preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:150px;border-radius:8px;object-fit:cover">
        <div style="font-size:11px;color:#059669;font-weight:600;margin-top:6px">✅ ${file.name}</div>`;
    }
    if(area) area.style.border = '2px solid #059669';
    // ✅ Photo select করলে Submit button enable হবে
    const submitBtn = document.getElementById('submitBtn_'+taskId);
    if(submitBtn){
      submitBtn.disabled = false;
      submitBtn.style.background = 'linear-gradient(135deg,#2563eb,#1d4ed8)';
      submitBtn.style.color = '#fff';
      submitBtn.style.cursor = 'pointer';
      submitBtn.textContent = T('submitProofBtn');
    }
  };
  reader.readAsDataURL(file);
}

async function submitTaskProof(taskId, taskTitle, reward){
  const uid = S.user?.uid||'unknown';
  const email = S.user?.email||'unknown';

  // ── Photo check ──────────────────────────────────────
  const photoInput = document.getElementById('photoInput_'+taskId);
  let file = photoInput?.files[0];
if(!file){
  toast(T('selectScreenshotFirstMsg'),'e'); return;
}
file = await compressImage(file, 100);

  // ── Submit button disable ──────────────────────────
  const submitBtn = document.getElementById('submitBtn_'+taskId);
  if(submitBtn){ submitBtn.disabled=true; submitBtn.textContent='⏳ Uploading...'; }

  try{
    // ── Task data check ──────────────────────────────
    const {data:taskData} = await sb.from('social_tasks').select('*').eq('id',taskId).single();
    if(!taskData){ toast(T('taskNotFoundMsg'),'e'); return; }

    // ── Duplicate check with max_per_user ────────────
    const {data:dupChecks} = await sb.from('submissions')
      .select('id,status').eq('uid',uid).eq('task_id',taskId);
    const maxAllowed = taskData.max_per_user || 1;
    const approvedCount = (dupChecks||[]).filter(s=>s.status==='approved').length;
    const pendingCount = (dupChecks||[]).filter(s=>s.status==='pending').length;
    if(approvedCount >= maxAllowed){
      toast(T('alreadyCompletedTaskMsg'),'w'); 
      if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent=T('submitProofBtn'); }
      return;
    }
    if(pendingCount > 0){
      toast(T('alreadySubmittedWaitingMsg'),'w'); 
      if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent=T('submitProofBtn'); }
      return;
    }

    // ══════════════════════════════════════════════════════════
    // ⚠️ ফিক্স — Task Slot Overselling Race Condition
    // ══════════════════════════════════════════════════════════
    // আগে এখানে শুধু taskData (কিছুক্ষণ আগে fetch করা, তাই সামান্য
    // পুরনো হতে পারে) থেকে current_workers/max_workers পড়ে চেক করা হতো।
    // ধরুন ১০ সিটের টাস্কে ৯টা ভরা (১টা বাকি) — যদি অনেক ইউজার প্রায়
    // একই মুহূর্তে Submit চাপে, প্রত্যেকেই "৯/১০, সিট আছে" দেখতে পেত
    // (কারো ইনক্রিমেন্টই তখনো একে অপরের কাছে পৌঁছায়নি) — ফলে ১টা মাত্র
    // সিটের জন্য শত শত submission ঢুকে যেতে পারত, যাদের প্রায় সবাইকেই
    // পরে Admin reject করতে বাধ্য হতো — ইউজারদের ছবি তোলা/আপলোড করার
    // সময়/ডেটা সব বৃথা যেত।
    //
    // এখন Database-এই একটাই atomic অপারেশনে "সিট খালি আছে কিনা চেক করা"
    // আর "সিট বুক করা" একসাথে হয় (atomic_claim_slot RPC, ছবি আপলোডের
    // *আগেই* কল করা হচ্ছে) — ঠিক যতগুলো সিট খালি ততজনই সফল হবে, বাকিরা
    // সাথে সাথেই "Full" মেসেজ পাবে, ছবি আপলোডের ঝামেলাতেই যেতে হবে না।
    const maxW = parseInt(taskData.max_workers||0);
    let newCur = null;      // এই সাবমিশনের পর টাস্কের নতুন current_workers সংখ্যা
    let slotClaimedAtomically = false; // নিচে আপলোড/সেভ ব্যর্থ হলে slot ফেরত দিতে লাগবে

    if(maxW > 0){
      const { data: claimResult, error: slotErr } = await sb.rpc('atomic_claim_slot', {
        p_table:'social_tasks', p_id:taskId, p_cur_field:'current_workers', p_max_field:'max_workers'
      });
      if(slotErr){
        // RPC না থাকলে (Supabase-এ SQL এখনো বসানো হয়নি) — কম নিরাপদ
        // fallback, অন্তত ফিচারটা যেন সম্পূর্ণ বন্ধ না হয়ে যায় তার জন্য
        // (এই ফলব্যাক পথে race window থেকেই যায়)
        const curW = parseInt(taskData.current_workers||0);
        if(curW >= maxW){
          toast(T('taskFullMsg'),'w');
          if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent=T('submitProofBtn'); }
          return;
        }
        newCur = curW + 1;
      } else if(claimResult === null){
        // সিট claim ব্যর্থ — টাস্ক ইতিমধ্যে পুরো ভর্তি
        toast(T('taskFullMsg'),'w');
        if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent=T('submitProofBtn'); }
        return;
      } else {
        newCur = claimResult; // সিট সফলভাবে বুক — Database-এ current_workers ইতিমধ্যেই +1 হয়ে গেছে
        slotClaimedAtomically = true;
      }
    }
    // slotClaimedAtomically হলে, নিচে আপলোড/সেভ কোনো কারণে ব্যর্থ হলে
    // এই ফাংশনটা দিয়ে বুক করা সিটটা ফেরত দেওয়া হবে — নাহলে সিট
    // "লিক" হয়ে যাবে (বুক আছে কিন্তু কোনো আসল submission নেই)
    const releaseSlotIfClaimed = async ()=>{
      if(slotClaimedAtomically){
        try{ await sb.rpc('atomic_increment', { p_table:'social_tasks', p_id:taskId, p_field:'current_workers', p_delta:-1 }); }catch(e){}
      }
    };

// ── Supabase Storage এ photo upload ──────────────
if(submitBtn) submitBtn.textContent='⏳ Uploading photo...';
const subId = 'SUB-'+Date.now();
const storagePath = `${uid}/${subId}.jpg`;

let photoUrl = '';
try{
  const {error: upErr} = await sb.storage
    .from('proofs')
    .upload(storagePath, file, {upsert: true});
  if(upErr){
    await releaseSlotIfClaimed(); // ছবি আপলোড ব্যর্থ হলে বুক করা সিট ফেরত দাও
    toast(T('photoUploadFailedMsg')+' '+upErr.message,'e');
    if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent=T('submitProofBtn'); }
    return;
  }
  const {data: urlData} = sb.storage
    .from('proofs')
    .getPublicUrl(storagePath);
  photoUrl = urlData.publicUrl;
}catch(upErrCatch){
  await releaseSlotIfClaimed(); // এখানেও একই কারণে সিট ফেরত দাও
  toast(T('photoUploadFailedMsg')+' '+upErrCatch.message,'e');
  if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent=T('submitProofBtn'); }
  return;
}

    // ── Supabase এ submission save ───────────────────
    if(submitBtn) submitBtn.textContent='⏳ Saving...';
    const { error: subErr } = await sb.from('submissions').upsert({
      id: subId,
      uid: uid,
      task_id: taskId,
      task_title: taskTitle,
      reward: parseFloat(reward),
      user_email: email,
      photo_url: photoUrl,   // Firebase Storage URL
      status: 'pending',
      created_at: Date.now()
    }, {onConflict:'id'});
    if(subErr){
      await releaseSlotIfClaimed(); // সাবমিশন সেভই না হলে বুক করা সিট ফেরত দাও
      toast(T('photoUploadFailedMsg')+' '+subErr.message,'e');
      if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent=T('submitProofBtn'); }
      return;
    }

    // ── current_workers আপডেট ────────────────────────
    if(maxW > 0){
      // সীমিত-সিট টাস্ক — উপরের atomic_claim_slot RPC (বা তার fallback)
      // ইতিমধ্যেই current_workers +1 করে দিয়েছে, এখানে আলাদা করে আবার
      // বসানোর দরকার নেই। শুধু এখন পুরো ভর্তি হয়ে গেলে টাস্ক disable করো।
      if(newCur >= maxW){
        await sb.from('social_tasks').update({status:'disabled'}).eq('id',taskId);
        EZCache.invalidate('socialTasks');
      }
    } else {
      // Unlimited-সিট টাস্ক — কোনো সীমা protect করার দরকার নেই, তাই
      // এখানে শুধু গণনার জন্য একটা simple increment যথেষ্ট
      const curWUnlimited = parseInt(taskData.current_workers||0);
      await sb.from('social_tasks').update({current_workers: curWUnlimited + 1}).eq('id',taskId);
    }

    // ── Success ──────────────────────────────────────
    showToast(T('proofSubmittedMsg'),'green',4000);
    // Fix: Cache update + DB save so task disables immediately
    const ct2 = EZCache.get(`completedTasks_${uid}`) || {};
    ct2[taskId] = 'pending';
    EZCache.set(`completedTasks_${uid}`, ct2);
    // Also persist to Supabase so it survives refresh
    // ⚠️ ফিক্স: আগে read-modify-write ছিল — ইউজার একের পর এক দ্রুত ২টা
    // ভিন্ন social task submit করলে একটা 'pending' marker হারিয়ে যেতে
    // পারত। এখন jsonb_merge_key RPC (একটাই atomic SQL statement) ব্যবহার হচ্ছে।
    try{
      const {error:jsonRpcErr} = await sb.rpc('jsonb_merge_key', {
        p_table:'users', p_id:uid, p_field:'completed_tasks', p_key:String(taskId), p_value:'pending'
      });
      if(jsonRpcErr){
        // ফলব্যাক (RPC না থাকলে)
        const {data:ctRow2} = await sb.from('users').select('completed_tasks').eq('id',uid).maybeSingle();
        const ctDB = ctRow2?.completed_tasks || {};
        ctDB[taskId] = 'pending';
        await sb.from('users').update({completed_tasks: ctDB}).eq('id', uid);
      }
    }catch(e2){}
    loadSocialTasks();
    // showInterstitialAd() আগে বানানো ছিল কিন্তু কোথাও কল হচ্ছিল না —
    // এখানে social task submit সফল হওয়ার পর natural transition point হিসেবে দেখানো হচ্ছে
    showInterstitialAd();

  }catch(e){
    toast(T('genericErrorMsg')+' '+e.message,'e');
    if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent=T('submitProofBtn'); }
  }
}

// ─── FAQ PAGE ─────────────────────────────────────────
function buildFAQ(){
  const faqs=[
    {q:'How do I earn money on EARNOVA?',a:'You can earn by completing CPA offers, watching ads, completing surveys, installing apps, and referring friends. Each completed task credits your account balance.'},
    {q:'What is the minimum withdrawal amount?',a:'The minimum withdrawal amount is $5.00 USD. You also need at least 5 active referrals to unlock withdrawals.'},
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

