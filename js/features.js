

// ── SKELETON LOADER ────────────────────────────────────
function buildSkeleton(count=3){
  return Array(count).fill(0).map(()=>`
    <div style="display:flex;align-items:center;gap:12px;padding:14px;background:#fff;border:1.5px solid #dbeafe;border-radius:14px;margin-bottom:10px">
      <div class="skel skel-avatar"></div>
      <div style="flex:1">
        <div class="skel skel-text" style="margin-bottom:8px"></div>
        <div class="skel skel-text sm"></div>
      </div>
    </div>`).join('');
}

// ── LEVEL SYSTEM ───────────────────────────────────────
function getUserLevel(totalEarned){
  const e=parseFloat(totalEarned)||0;
  if(e>=500) return {name:'Diamond',icon:'💎',color:'#7c3aed',next:null,progress:100,cls:'lv-diamond'};
  if(e>=100) return {name:'Platinum',icon:'🏆',color:'#2563eb',next:500,progress:Math.round((e-100)/4),cls:'lv-platinum'};
  if(e>=50)  return {name:'Gold',icon:'🥇',color:'#d97706',next:100,progress:Math.round((e-50)/0.5),cls:'lv-gold'};
  if(e>=10)  return {name:'Silver',icon:'🥈',color:'#64748b',next:50,progress:Math.round((e-10)/0.4),cls:'lv-silver'};
  return      {name:'Bronze',icon:'🥉',color:'#b45309',next:10,progress:Math.round(e*10),cls:'lv-bronze'};
}

// ── BADGES ─────────────────────────────────────────────
function getUserBadges(ud){
  const earned=parseFloat(ud.usdEarned||0);
  const ads=parseInt(ud.adsWatched||0);
  const refs=parseInt(ud.activeReferrals||0);
  const offers=parseInt(ud.offersCompleted||0);
  return [
    {icon:'🌟',name:'First Earn',earned:earned>=0.01,color:'#f59e0b'},
    {icon:'📺',name:'Ad Watcher',earned:ads>=10,color:'#2563eb'},
    {icon:'👥',name:'Connector',earned:refs>=1,color:'#8b5cf6'},
    {icon:'🎯',name:'Offer Pro',earned:offers>=5,color:'#ef4444'},
    {icon:'💰',name:'$1 Club',earned:earned>=1,color:'#10b981'},
    {icon:'🔥',name:'$10 Club',earned:earned>=10,color:'#ec4899'},
    {icon:'👑',name:'$50 Club',earned:earned>=50,color:'#f59e0b'},
    {icon:'💎',name:'Diamond',earned:earned>=100,color:'#2563eb'},
  ];
}

// ── STREAK SYSTEM ──────────────────────────────────────
function getStreakData(ud){
  const today=new Date().toDateString();
  const lastLogin=ud.lastLoginDate||'';
  const yesterday=new Date(Date.now()-86400000).toDateString();
  let streak=parseInt(ud.loginStreak||0);
  // If logged in yesterday → streak continues; if today already counted → same
  // Streak update happens on login
  return {streak, today, lastLogin};
}

async function updateLoginStreak(uid, ud){
  const today=new Date().toDateString();
  if(ud.lastLoginDate===today) return; // already counted today
  const yesterday=new Date(Date.now()-86400000).toDateString();
  let streak=parseInt(ud.loginStreak||0);
  if(ud.lastLoginDate===yesterday){
    streak+=1;
  } else if(ud.lastLoginDate!==today){
    streak=1; // reset
  }
  await fDB.ref(`users/${uid}`).update({loginStreak:streak, lastLoginDate:today});
  // Streak bonus
  if(streak>0 && streak%7===0){
    const bonus=0.05;
    await atomicIncrement(uid,'usdEarned',bonus);
    toast(`🔥 7-day streak! +$${bonus.toFixed(2)} bonus!`,'s',4000);
    sendLocalNotif('🔥 Streak Bonus!',`7-day streak! You earned +$${bonus.toFixed(2)}`);
  } else if(streak>1){
    toast(`🔥 ${streak}-day streak! Keep it up!`,'s',3000);
  }
}

// ── DAILY LOGIN BONUS ──────────────────────────────────
async function checkDailyBonus(uid, ud){
  const today=new Date().toDateString();
  if(ud.dailyBonusDate===today) return; // already claimed (দ্রুত ক্লায়েন্ট-সাইড চেক, প্রথম ফিল্টার)
  const bonus=0.01; // $0.01 daily login bonus
  // ⚠️ ফিক্স: আগে সরাসরি ক্রেডিট করে দেওয়া হতো, শুধু উপরের ক্লায়েন্ট-সাইড
  // চেকের ওপর ভরসা করে — একই ইউজার ২টা ডিভাইস থেকে প্রায় একসাথে App
  // খুললে দুইবার bonus পেয়ে যেতে পারত। এখন আগে atomically claim করা
  // হচ্ছে, সফল হলেই শুধু balance ক্রেডিট হবে।
  try{
    const { data: claimed, error: claimErr } = await sb.rpc('atomic_claim_daily', {
      p_table: 'users', p_id: uid, p_field: 'daily_bonus_date', p_today: today,
    });
    if(claimErr){
      // RPC না থাকলে পুরনো (কম-নিরাপদ) পদ্ধতিতেই এগোনো — অন্তত ফিচারটা কাজ করুক
      await atomicIncrement(uid,'usdEarned',bonus);
      await fDB.ref(`users/${uid}/dailyBonusDate`).set(today);
    } else if(!claimed){
      return; // অন্য ডিভাইস থেকে আজ ইতিমধ্যে claim হয়ে গেছে
    } else {
      await atomicIncrement(uid,'usdEarned',bonus);
    }
  }catch(e){ return; }
  if(S.userData) S.userData.dailyBonusDate = today;
  toast(`🎁 Daily Login Bonus: +$${bonus.toFixed(2)}!`,'s',3500);
  sendLocalNotif('🎁 Daily Bonus!',`You earned $${bonus.toFixed(2)} for logging in today!`);
}

// ══════════════════════════════════════════════════════════
// 🎡 DAILY SPIN WHEEL — প্রতিদিন একবার ঘুরিয়ে র‍্যান্ডম বোনাস
// ══════════════════════════════════════════════════════════
function canSpinToday(ud){
  const today=new Date().toDateString();
  return (ud?.lastSpinDate||'') !== today;
}

// ── Home পেজের ছোট কার্ড — স্পিন করা যাবে কিনা দেখায় ──
function buildSpinWheelCard(){
  const ud=S.userData||{};
  const canSpin=canSpinToday(ud);
  return `<div class="card mb12" style="text-align:center;background:linear-gradient(135deg,rgba(124,58,237,.06),rgba(236,72,153,.06));border:1.5px solid #e9d5ff;cursor:pointer" onclick="openSpinWheel()">
    <div style="font-size:32px;margin-bottom:6px">🎡</div>
    <div class="sf" style="font-size:15px;font-weight:800;color:#7c3aed;margin-bottom:2px">Daily Spin Wheel</div>
    <div style="font-size:12px;color:#64748b">${canSpin ? 'Spin now for a free bonus! 🎁' : '✅ Already spun today — come back tomorrow!'}</div>
  </div>`;
}

// ── weighted random prize বাছাই — CFG.spinPrizes এর weight অনুযায়ী ──
function pickWeightedPrize(){
  const prizes = CFG.spinPrizes;
  const totalWeight = prizes.reduce((s,p)=>s+p.weight,0);
  let r = Math.random()*totalWeight;
  for(let i=0;i<prizes.length;i++){
    r -= prizes[i].weight;
    if(r<=0) return i;
  }
  return 0;
}

// ── চাকা তৈরি (CSS conic-gradient — সমান ৮ ভাগ, রঙ CFG থেকে) ──
function buildSpinWheelSVG(){
  const prizes = CFG.spinPrizes;
  const seg = 360/prizes.length;
  const gradParts = prizes.map((p,i)=>`${p.color} ${i*seg}deg ${(i+1)*seg}deg`).join(',');
  const labels = prizes.map((p,i)=>{
    const angle = i*seg + seg/2; // segment-এর মাঝ বরাবর label বসানো
    return `<div style="position:absolute;top:50%;left:50%;width:0;height:0;transform:rotate(${angle}deg)">
      <span style="position:absolute;left:-18px;top:-92px;width:36px;text-align:center;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.4);transform:rotate(${-angle}deg) translateY(0)">$${p.amount.toFixed(2)}</span>
    </div>`;
  }).join('');
  return `
  <div style="position:relative;width:220px;height:220px;margin:0 auto">
    <!-- পয়েন্টার -->
    <div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);z-index:3;width:0;height:0;border-left:12px solid transparent;border-right:12px solid transparent;border-top:20px solid #dc2626;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))"></div>
    <div id="spinWheelDisc" style="width:220px;height:220px;border-radius:50%;background:conic-gradient(${gradParts});border:6px solid #fff;box-shadow:0 8px 30px rgba(0,0,0,.25);position:relative;transition:transform 4s cubic-bezier(.17,.67,.12,.99)">
      ${labels}
    </div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);z-index:2;display:flex;align-items:center;justify-content:center;font-size:20px">🎯</div>
  </div>`;
}

let _spinning = false;
function openSpinWheel(){
  const ud=S.userData||{};
  if(!canSpinToday(ud)){ toast('✅ আজকের স্পিন হয়ে গেছে — কাল আবার আসুন!','i'); return; }
  if(document.getElementById('spinWheelOverlay')) return;
  const ov=document.createElement('div');
  ov.id='spinWheelOverlay';
  ov.style.cssText='position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px';
  ov.innerHTML=`
  <div style="background:#fff;border-radius:22px;padding:26px 20px;max-width:320px;width:100%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35)">
    <div class="sf" style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:4px">🎡 Daily Spin Wheel</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:18px">Spin once a day for a free bonus!</div>
    ${buildSpinWheelSVG()}
    <div id="spinResultMsg" style="min-height:24px;margin:14px 0 4px;font-size:14px;font-weight:800;color:#059669"></div>
    <button id="spinNowBtn" class="btn bp" style="width:100%;margin-top:8px">🎯 Spin Now</button>
    <button id="spinCloseBtn" class="btn bh" style="width:100%;margin-top:8px">Close</button>
  </div>`;
  document.body.appendChild(ov);
  document.getElementById('spinNowBtn').onclick = doSpin;
  document.getElementById('spinCloseBtn').onclick = ()=>{ ov.remove(); };
}

async function doSpin(){
  if(_spinning || !S.user?.uid) return;
  const ud=S.userData||{};
  if(!canSpinToday(ud)){ toast('✅ আজকের স্পিন হয়ে গেছে','i'); return; }
  _spinning = true;

  // ⚠️ ফিক্স: আগে শুধু S.userData (ক্লায়েন্ট-সাইড ক্যাশ) দেখে "আজ স্পিন
  // করেছি কিনা" ধরে নেওয়া হতো — একই ইউজার ২টা ডিভাইস/ট্যাব থেকে প্রায়
  // একসাথে স্পিন করলে দুটোই সফল হয়ে যেত (দুই জায়গার balance ২ বার
  // ক্রেডিট)। এখন spin শুরু করার আগেই Postgres-এ atomically claim করা
  // হচ্ছে — এটা ব্যর্থ হলে বুঝব অন্য কোনো ডিভাইস/ট্যাব থেকে ইতিমধ্যে
  // আজকের স্পিন হয়ে গেছে, তাই এখানে থেমে যাওয়া হচ্ছে (কোনো animation/reward ছাড়াই)।
  const today = new Date().toDateString();
  try{
    const { data: claimed, error: claimErr } = await sb.rpc('atomic_claim_daily', {
      p_table: 'users', p_id: S.user.uid, p_field: 'last_spin_date', p_today: today,
    });
    if(claimErr){
      // RPC না থাকলে (পুরনো Supabase সেটআপ) — অন্তত fresh read করে চেষ্টা
      const {data:freshUd} = await sb.from('users').select('last_spin_date').eq('id',S.user.uid).single();
      if(freshUd?.last_spin_date === today){
        toast('✅ আজকের স্পিন হয়ে গেছে','i'); _spinning=false; return;
      }
    } else if(!claimed){
      toast('✅ আজকের স্পিন হয়ে গেছে (অন্য ডিভাইস থেকে করা হয়েছে)','i');
      if(S.userData) S.userData.lastSpinDate = today;
      _spinning = false;
      return;
    }
  }catch(e){
    toast('⚠️ Spin এ সমস্যা হয়েছে, আবার চেষ্টা করুন','w'); _spinning=false; return;
  }

  const btn=document.getElementById('spinNowBtn'); if(btn) btn.disabled=true;
  const prizeIdx = pickWeightedPrize();
  const prize = CFG.spinPrizes[prizeIdx];
  const seg = 360/CFG.spinPrizes.length;

  // যে সেগমেন্টে পয়েন্টার (উপরে, 0deg) গিয়ে থামবে সেটা যেন prizeIdx হয় —
  // তাই চাকাকে এমনভাবে ঘোরানো হচ্ছে যাতে সেই সেগমেন্টের মাঝামাঝি অংশ ঠিক
  // পয়েন্টারের নিচে আসে। কয়েক পাক (৫-৮ বার) ঘুরিয়ে বাস্তবসম্মত দেখানো হচ্ছে।
  const targetAngle = 360*6 + (360 - (prizeIdx*seg + seg/2));
  const disc = document.getElementById('spinWheelDisc');
  if(disc) disc.style.transform = `rotate(${targetAngle}deg)`;

  setTimeout(async ()=>{
    try{
      await atomicIncrement(S.user.uid, 'usdEarned', prize.amount);
      // lastSpinDate ইতিমধ্যে atomic_claim_spin দিয়ে সেট হয়ে গেছে উপরেই —
      // এখানে শুধু লোকাল S.userData ক্যাশ আপডেট করা হচ্ছে
      if(S.userData) S.userData.lastSpinDate = today;
      const msgEl=document.getElementById('spinResultMsg');
      if(msgEl) msgEl.textContent = `🎉 You won $${prize.amount.toFixed(2)}!`;
      toast(`🎉 Spin Wheel: +$${prize.amount.toFixed(2)}!`,'s',4000);
      trackEvent('spin_wheel_used', { amount: prize.amount });
      const closeBtn=document.getElementById('spinCloseBtn');
      if(closeBtn) closeBtn.textContent='🎉 Awesome!';
      render(); // home page balance/card আপডেট করতে
    }catch(e){
      toast('⚠️ Spin এ সমস্যা হয়েছে, আবার চেষ্টা করুন','w');
    }
    _spinning = false;
  }, 4200); // চাকার animation (4s) শেষ হওয়ার একটু পরে reward দেওয়া হচ্ছে
}

// ── LEADERBOARD ────────────────────────────────────────
async function loadLeaderboard(){
  try{
    const cacheKey='leaderboard';
    const lbCached=EZCache._store[cacheKey];
    if(lbCached && (Date.now()-lbCached.ts)<10*60*1000){
      S.leaderboard=lbCached.value;
      return;
    }
    // Supabase — শুধু snake_case columns select করো
    const {data, error} = await sb
      .from('users')
      .select('id, name, email, usd_earned, active_referrals, is_admin, banned')
      .eq('banned', false)
      .limit(100);
    if(error){ console.log('Leaderboard skipped:', error.message); S.leaderboard=[]; return; }
    S.leaderboard = (data||[])
      .map(u=>({
        uid: u.id,
        name: u.name||'',
        email: u.email||'',
        usdEarned: parseFloat(u.usd_earned||0),
        activeReferrals: parseInt(u.active_referrals||0),
        banned: u.banned===true,
        isAdmin: u.is_admin===true,
      }))
      .filter(u => u.usdEarned > 0 && !u.banned && !u.isAdmin)
      .sort((a,b) => b.usdEarned - a.usdEarned) // JS এ sort
      .slice(0,10);
    EZCache.set(cacheKey, S.leaderboard);
  }catch(e){
    console.error('Leaderboard error:', e);
    S.leaderboard=[];
  }
}

// ══════════════════════════════════════════════════════════
// TRUST STATS — Total Paid Out + Live Payout Ticker
// ══════════════════════════════════════════════════════════
// কেন দরকার: earning app-এ নতুন ইউজার প্রথমেই সন্দেহ করে "এটা কি আসল
// টাকা দেয়?" — approved withdrawal-এর real সংখ্যা দেখালে বিশ্বাস বাড়ে।
// শুধু status='approved' withdrawal গণনা হয়, pending/rejected বাদ।
async function loadTrustStats(){
  try{
    const cacheKey='trustStats';
    const cached=EZCache._store[cacheKey];
    if(cached && (Date.now()-cached.ts)<15*60*1000){
      return cached.value;
    }
    // ── Total: stats.total_paid_out থেকে (exact, সব সময়ের হিসাব — admin
    //    approve করার সাথে সাথে বাড়ে, দেখুন js/admin.js) ──
    const { data: statRow } = await sb.from('stats').select('total_paid_out').eq('id','stats').maybeSingle();
    const total = parseFloat(statRow?.total_paid_out||0);

    // ── Ticker: শুধু সাম্প্রতিক ১০টা approved withdrawal (মাস্কড নাম) ──
    const { data, error } = await sb
      .from('withdrawals')
      .select('amount, user_name, method, created_at')
      .eq('status','approved')
      .order('created_at', { ascending:false })
      .limit(10);
    if(error){ console.log('Trust stats ticker skipped:', error.message); return { total, recent:[] }; }
    const recent = (data||[]).map(r=>({
      name: maskName(r.user_name||'User'),
      amount: parseFloat(r.amount)||0,
      method: r.method||'',
    }));
    const result = { total, recent };
    EZCache.set(cacheKey, result);
    return result;
  }catch(e){
    console.error('Trust stats error:', e);
    return null;
  }
}

function maskName(name){
  if(!name||name.length<2) return 'User';
  if(name.length<=4) return name[0]+'***';
  return name.slice(0,2) + '*'.repeat(Math.min(name.length-2,4));
}

// ── HOME পেজের "Top Earners" প্রিভিউ (টপ ৩) — একটা জায়গায় বানানো ──
// ⚠️ ফিক্স: আগে এই একই লজিকের দুইটা প্রায়-হুবহু কপি ছিল — একটা
// pages-core.js এর buildHome() এ (প্রথমবার পেজ আঁকার সময়, T() দিয়ে
// অনুবাদ করা), আরেকটা app-events.js এ (loadLeaderboard() ডেটা আসার
// পর #lbPreview রি-রেন্ডার করত, কিন্তু hardcoded English "YOU"/"earned"
// ব্যবহার করত — অনুবাদ ছাড়া, আর নামও escapeHtml() ছাড়া সরাসরি বসানো
// হতো)। ফলাফল: বাংলা/অন্য ভাষায় থাকা ইউজার প্রথমে সঠিক ভাষায় প্রিভিউ
// দেখত, তারপর কয়েক মুহূর্ত পরেই সেটা ইংরেজি ভার্সন দিয়ে বদলে যেত —
// আর দুই জায়গাতেই ইউজারের নাম escape ছাড়া innerHTML এ যেত (Stored XSS)।
// এখন থেকে দুই জায়গাই এই একটা ফাংশন কল করে — সবসময় সঠিক ভাষা, আর নাম
// সবসময় escapeHtml() দিয়ে নিরাপদ।
function buildHomeLeaderboardPreview(){
  const top3 = S.leaderboard.slice(0,3);
  if(!top3.length) return `<div style="text-align:center;padding:20px 0;color:#94a3b8;font-size:13px">${T('noEarnersYet')}</div>`;
  const ri=['🥇','🥈','🥉'];
  const rc=['#f59e0b','#94a3b8','#b45309'];
  return top3.map((u,i)=>{
    const isMe = u.uid===S.user?.uid;
    const rawName = u.name||u.email?.split('@')[0]||'User';
    const dn = escapeHtml(isMe ? rawName : maskName(rawName));
    const initial = dn ? dn[0].toUpperCase() : 'U';
    return '<div class="lb-row'+(i===0?' top1':i===1?' top2':i===2?' top3':'')+'" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:13px;margin-bottom:8px;border:1.5px solid '+(rc[i]||'#dbeafe')+'40">'
      +'<div style="font-size:20px;width:28px;text-align:center">'+ri[i]+'</div>'
      +'<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#059669);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;flex-shrink:0">'+initial+'</div>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-weight:700;font-size:13px">'+dn+(isMe?' <span style="background:#dbeafe;color:#2563eb;font-size:9px;padding:1px 5px;border-radius:6px">'+T('youBadge')+'</span>':'')+'</div>'
        +'<div style="font-size:11px;color:#059669;font-weight:700">'+fmt$(u.usdEarned||0)+' '+T('earnedWord')+' · 👥 '+(u.activeReferrals||0)+'</div>'
      +'</div>'
      +'<div style="font-size:18px">'+getUserLevel(u.usdEarned).icon+'</div>'
    +'</div>';
  }).join('');
}

function buildLeaderboardSection(){
  if(!S.leaderboard.length) return `<div class="empty"><div class="ein">🏆</div><div class="etx">No earners yet — be the first!</div></div>`;
  const rankIcons=['🥇','🥈','🥉'];
  const rankColors=['#f59e0b','#94a3b8','#b45309'];
  const rankBg=['rgba(245,158,11,.12)','rgba(148,163,184,.1)','rgba(180,83,9,.1)'];
  return S.leaderboard.map((u,i)=>{
    const isMe = u.uid===S.user?.uid;
    const displayName = isMe ? (u.name||'You') : maskName(u.name||u.email?.split('@')[0]||'User');
    const initial = displayName[0].toUpperCase();
    const level = getUserLevel(u.usdEarned);
    return `
    <div class="lb-row${i===0?' top1':i===1?' top2':i===2?' top3':''}" style="${i<3?'background:'+rankBg[i]+';border:1.5px solid '+rankColors[i]+'40':''}">
      <div class="lb-rank" style="${i<3?'color:'+rankColors[i]+';font-size:22px':''}">${rankIcons[i]||`<span style="font-size:13px;color:#64748b">#${i+1}</span>`}</div>
      <div class="lb-av" style="${i===0?'background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:18px':i===1?'background:linear-gradient(135deg,#94a3b8,#64748b);color:#fff':i===2?'background:linear-gradient(135deg,#b45309,#92400e);color:#fff':''}">${escapeHtml(initial)}</div>
      <div class="lb-inf">
        <div class="lb-nm">
          ${escapeHtml(displayName)}
          ${isMe?'<span style="background:#dbeafe;color:#2563eb;font-size:9px;padding:2px 6px;border-radius:8px;margin-left:4px">YOU</span>':''}
        </div>
        <div class="lb-am">
          <span style="color:#059669;font-weight:700">${fmt$(u.usdEarned||0)}</span> earned
          ${u.activeReferrals>0?`· 👥 ${u.activeReferrals} refs`:''}
        </div>
      </div>
      <div style="text-align:center">
        <div style="font-size:20px">${level.icon}</div>
        <div style="font-size:9px;color:#64748b">${level.name}</div>
      </div>
    </div>`}).join('');
}

// ── LEADERBOARD PAGE ───────────────────────────────────
function buildLeaderboardPage(){
  const myRank = S.leaderboard.findIndex(u=>u.uid===S.user?.uid);
  return `<div class="ph">
    <button class="btn bh bau bsm mb12" onclick="S.page='home';render()">← ${T('back')}</button>
    <div class="pt">${T('lbPageTitle')}</div>
    <div class="ps">${T('lbPageSub')}</div>
  </div>

  ${myRank>=0?`
  <div style="background:linear-gradient(135deg,#2563eb,#059669);border-radius:14px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">
    <div>
      <div style="font-size:11px;color:rgba(255,255,255,.7);font-weight:600">${T('lbYourRank')}</div>
      <div style="font-size:28px;font-weight:800;color:#fbbf24">#${myRank+1}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:rgba(255,255,255,.7)">${T('lbYourEarningsSmall')}</div>
      <div style="font-size:20px;font-weight:700;color:#fff">${fmt$(S.leaderboard[myRank]?.usdEarned||0)}</div>
    </div>
  </div>`:''}

  <div class="card mb12">
    <div class="card-hd" style="display:flex;justify-content:space-between;align-items:center">
      <span>${T('lbTop10')}</span>
      <span style="font-size:11px;color:#94a3b8;font-weight:400">${T('lbPrivacyMasked')}</span>
    </div>
    <div id="lbContent">${buildLeaderboardSection()}</div>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;font-size:12px;color:#64748b;text-align:center;margin-bottom:14px">
    ${T('lbPrivacyNote')}
  </div>`;
}

// ── BADGES PAGE ────────────────────────────────────────
function buildBadgesSection(ud){
  const badges=getUserBadges(ud);
  return `<div class="badge-grid">${badges.map(b=>{
    const gm = WALL_GRADIENTS[b.color] || WALL_GRADIENTS['#2563eb'];
    const style = b.earned
      ? `background:${gm.grad};border-color:transparent;box-shadow:0 4px 14px ${gm.shadow}`
      : `background:${gm.grad};border-color:transparent;opacity:.42;filter:grayscale(35%)`;
    return `
    <div class="badge-item${b.earned?' earned':''}" style="${style}">
      <div class="bi">${b.icon}</div>
      <div class="bn" style="color:#fff">${b.name}</div>
      ${b.earned?'<div style="font-size:8px;color:rgba(255,255,255,.9);margin-top:2px;font-weight:700">✓</div>':'<div style="font-size:8px;color:rgba(255,255,255,.9);margin-top:2px">🔒</div>'}
    </div>`;
  }).join('')}</div>`;
}

// ── STREAK UI ──────────────────────────────────────────
function buildStreakUI(ud){
  const {streak}=getStreakData(ud);
  const days=Math.min(streak,7);
  return `<div class="streak-wrap">
    ${Array(7).fill(0).map((_,i)=>`
      <div class="streak-day${i<days?' done':i===days?' today':''}">
        ${i<days?'✓':i+1}
      </div>`).join('')}
  </div>
  <div style="text-align:center;font-size:12px;color:#64748b">
    ${streak>=7?'🔥 Max streak! Bonus earned!':streak>0?`🔥 ${streak} day streak — ${7-streak} more for bonus!`:'Start your streak today!'}
  </div>`;
}

// ── UPDATE HOME PAGE with new features ─────────────────
// Dark mode toggle in navbar — handled via buildNav update


// ════════════════════════════════════════════════════════
//  COUNTRY-WISE TASKS + MONTHLY AWARD SYSTEM
// ════════════════════════════════════════════════════════

// ── COUNTRY-WISE TASK FILTER ─────────────────────────
// task.country = 'ALL' → সবাই দেখবে
// task.country = 'BD'  → শুধু BD user দেখবে
// task.country = 'BD,IN,PK' → এই দেশগুলো দেখবে
function taskVisibleForUser(task){
  const tc = (task.country||'ALL').toUpperCase().trim();
  if(tc === 'ALL' || tc === '') return true;
  const userCC = (S.country||'').toUpperCase();
  if(!userCC) return true; // country detect না হলে দেখাবে
  const allowed = tc.split(',').map(x=>x.trim());
  return allowed.includes(userCC);
}

// ── MONTHLY AWARD SYSTEM ─────────────────────────────

// Current month string: "2025-01"
function currentMonth(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}

// Get month display name: "January 2025"
function monthDisplayName(m){
  if(!m) m = currentMonth();
  const [y,mo] = m.split('-');
  const names=['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return (names[parseInt(mo)-1]||mo)+' '+y;
}

// Award amounts for rank 1, 2, 3
const AWARD_BONUS = {1: 2.00, 2: 1.00, 3: 0.50};

// ── Calculate top 3 earners for a month ──
// Uses monthly_earnings JSONB field in users table — {"2026-07": 12.50, ...}
async function calcMonthlyTop3(month){
  month = month || currentMonth();
  try{
    const snap = await fDB.ref('users').once('value');
    const data = snap.val()||{};

    const earners = Object.values(data)
      .filter(u => !u.banned)
      .map(u => {
        const me = u.monthly_earnings || u.monthlyEarnings || {};
        return {
          uid: u.uid||u.id,
          name: u.name||u.email?.split('@')[0]||'User',
          email: u.email||'',
          earned: parseFloat(me[month]||0),
        };
      })
      .filter(u => u.earned >= 10) // min $10
      .sort((a,b) => b.earned - a.earned)
      .slice(0,3);

    return earners;
  }catch(e){
    /* calcMonthlyTop3 error — silent */
    return [];
  }
}

// ── Save monthly awards to DB (admin triggers this) ──
async function generateMonthlyAwards(month){
  month = month || currentMonth();
  const top3 = await calcMonthlyTop3(month);
  if(!top3.length){
    toast('No eligible users (min $10 earned)','w');
    return;
  }
  for(let i=0; i<top3.length; i++){
    const u = top3[i];
    const rank = i+1;
    const awardId = `award_${month}_rank${rank}`;
    // Check if already exists
    const existing = await fDB.ref(`monthlyAwards/${awardId}`).once('value');
    if(existing.exists()) continue; // already generated
    await fDB.ref(`monthlyAwards/${awardId}`).set({
      id: awardId,
      month, uid: u.uid,
      user_name: u.name,
      user_email: u.email,
      rank, earned: u.earned,
      bonus: AWARD_BONUS[rank]||0,
      status: 'pending',
      created_at: Date.now(),
    });
  }
  toast(`✅ ${top3.length} award(s) generated for ${monthDisplayName(month)}`,'s');
  EZCache.invalidate('monthlyAwards');
  loadAdminAwards(document.getElementById('adminContent'));
}

// ── Admin approve award ──
async function approveAward(awardId){
  const snap = await fDB.ref(`monthlyAwards/${awardId}`).once('value');
  const award = snap.val();
  if(!award || award.status !== 'pending'){
    toast('Award not found or already processed','w'); return;
  }
  // Give bonus to user
  await atomicIncrement(award.uid,'usdEarned',award.bonus);
  // Mark approved
  await fDB.ref(`monthlyAwards/${awardId}`).update({
    status:'approved', approvedAt: Date.now()
  });
  // Notify user (add to notices)
  const noticeId = 'notice_award_'+awardId;
  await fDB.ref(`notices/${noticeId}`).set({
    id: noticeId,
    text: `🏆 Congratulations! You won Rank #${award.rank} in ${monthDisplayName(award.month)}! +$${award.bonus.toFixed(2)} has been added to your account.`,
    created_at: Date.now(),
    posted_by: S.user?.uid||'admin',
    target_uid: award.uid,
  });
  toast(`✅ Award approved! $${award.bonus} sent to ${award.userName}`,'s');
  EZCache.invalidate('monthlyAwards');
  loadAdminAwards(document.getElementById('adminContent'));
}

// ── Admin reject award ──
async function rejectAward(awardId){
  await fDB.ref(`monthlyAwards/${awardId}`).update({status:'rejected'});
  toast('Award rejected','s');
  EZCache.invalidate('monthlyAwards');
  loadAdminAwards(document.getElementById('adminContent'));
}

// ── Load awards for admin ──
async function loadAdminAwards(c){
  if(!c) return;
  c.innerHTML = '<div class="empty"><div class="ein">⏳</div></div>';
  const month = currentMonth();

  // Load all awards
  const snap = await fDB.ref('monthlyAwards').once('value');
  const data = snap.val()||{};
  const awards = Object.values(data).sort((a,b)=>b.createdAt-a.createdAt);

  // Load current month top 3 preview
  const top3 = await calcMonthlyTop3(month);

  const rankMedal = ['🥇','🥈','🥉'];

  c.innerHTML = `
    <div class="card mb12">
      <div class="card-hd">📊 ${monthDisplayName(month)} — Current Top 3</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:10px">Min $10 earned this month to qualify</div>
      ${top3.length ? top3.map((u,i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#f8fafc;border-radius:10px;margin-bottom:6px">
          <div style="font-size:20px">${rankMedal[i]}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px">${escapeHtml(u.name)}</div>
            <div style="font-size:11px;color:#64748b">${escapeHtml(u.email)} · Earned: $${u.earned.toFixed(2)}</div>
          </div>
          <div style="font-size:12px;font-weight:700;color:#059669">+$${(AWARD_BONUS[i+1]||0).toFixed(2)}</div>
        </div>`).join('')
      : '<div style="text-align:center;padding:20px;color:#94a3b8">No users with $10+ earned this month</div>'}
      <button class="btn bp mt12" style="width:100%" onclick="generateMonthlyAwards('${month}')">
        🏆 Generate ${monthDisplayName(month)} Awards
      </button>
    </div>

    <div class="card mb12">
      <div class="card-hd">📋 All Awards</div>
      ${awards.length ? awards.map(a=>`
        <div class="award-card rank${a.rank} mb8">
          <div class="award-badge">${rankMedal[a.rank-1]||'🏆'}</div>
          <div style="font-weight:700;font-size:14px">${escapeHtml(a.user_name||a.userName)}</div>
          <div style="font-size:12px;color:#64748b;margin:2px 0">${escapeHtml(a.user_email||a.userEmail)}</div>
          <div style="font-size:12px;margin:4px 0">
            📅 ${monthDisplayName(a.month)} · 
            Rank #${a.rank} · 
            Earned: <b>$${parseFloat(a.earned).toFixed(2)}</b> · 
            Bonus: <b style="color:#059669">+$${parseFloat(a.bonus).toFixed(2)}</b>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
            <span class="award-status-${a.status}">${
              a.status==='approved'?'✅ Approved':
              a.status==='rejected'?'❌ Rejected':
              '⏳ Pending'
            }</span>
            ${a.status==='pending'?`
              <div style="display:flex;gap:6px">
                <button class="btn bp bsm" onclick="approveAward('${a.id}')">✅ Approve</button>
                <button class="btn bsm" style="background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5" onclick="rejectAward('${a.id}')">❌ Reject</button>
              </div>`:''}
          </div>
        </div>`).join('')
      : '<div style="text-align:center;padding:20px;color:#94a3b8">No awards yet</div>'}
    </div>`;
}

// ── Track monthly earnings ──
// Call this whenever user earns money
async function trackMonthlyEarning(uid, amount){
  const month = currentMonth();
  const snap = await fDB.ref(`users/${uid}`).once('value');
  const ud = snap.val()||{};
  const me = ud.monthly_earnings || ud.monthlyEarnings || {};
  const current = parseFloat(me[month]||0);
  me[month] = current + amount;
  await fDB.ref(`users/${uid}`).update({monthly_earnings: me});
}

// ── User Awards page ──
async function loadUserAwards(uid){
  const el = document.getElementById('userAwardsList');
  if(!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px">⏳ Loading…</div>';
  const snap = await fDB.ref('monthlyAwards').once('value');
  const data = snap.val()||{};
  const myAwards = Object.values(data)
    .filter(a => a.uid===uid)
    .sort((a,b)=>b.createdAt-a.createdAt);
  const rankMedal = ['🥇','🥈','🥉'];
  if(!myAwards.length){
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">No awards yet. Earn $10+ in a month to qualify!</div>';
    return;
  }
  el.innerHTML = myAwards.map(a=>`
    <div class="award-card rank${a.rank}">
      <div class="award-badge">${rankMedal[a.rank-1]||'🏆'}</div>
      <div style="font-weight:700;font-size:15px">${rankMedal[a.rank-1]} Rank #${a.rank}</div>
      <div style="font-size:12px;color:#64748b;margin:4px 0">${monthDisplayName(a.month)}</div>
      <div style="font-size:13px">Earned: <b>$${parseFloat(a.earned).toFixed(2)}</b></div>
      <div style="font-size:13px;color:#059669;font-weight:700">Bonus: +$${parseFloat(a.bonus).toFixed(2)}</div>
      <div class="award-status-${a.status}" style="margin-top:6px">${
        a.status==='approved'?'✅ Paid':
        a.status==='rejected'?'❌ Rejected':
        '⏳ Pending approval'
      }</div>
    </div>`).join('');
}

// EARNOVA v3 — Production Build
