function userRef(uid=null){ return fDB.ref(`users/${uid||S.user.uid}`); }

async function loadUserData(uid){
  const snap=await fDB.ref(`users/${uid}`).once('value');
  const raw=snap.val();
  return raw ? _userFromDB(raw) : null;
}

// DB → JS camelCase mapper
function _userFromDB(row){
  if(!row) return null;
  return {
    ...row,
    // id is the Supabase primary key — also expose as uid for app compatibility
    uid: row.id ?? row.uid ?? null,
    id: row.id ?? row.uid ?? null,
    usdEarned: parseFloat(row.usd_earned ?? row.usdEarned ?? 0),
    todayEarned: parseFloat(row.today_earned ?? row.todayEarned ?? 0),
    todayDate: row.today_date ?? row.todayDate ?? '',
    adsWatched: parseInt(row.ads_watched ?? row.adsWatched ?? 0),
    offersCompleted: parseInt(row.offers_completed ?? row.offersCompleted ?? 0),
    activeReferrals: parseInt(row.active_referrals ?? row.activeReferrals ?? 0),
    isAdmin: row.is_admin ?? row.isAdmin ?? false,
    emailVerified: row.email_verified ?? row.emailVerified ?? false,
    refCode: row.ref_code ?? row.refCode ?? '',
    referredBy: row.referred_by ?? row.referredBy ?? null,
    forgotUsed: row.forgot_used ?? row.forgotUsed ?? false,
    countryEarn: parseFloat(row.country_earn ?? row.countryEarn ?? 0.30),
    deviceId: row.device_id ?? row.deviceId ?? '',
    loginStreak: parseInt(row.login_streak ?? row.loginStreak ?? 0),
    lastLoginDate: row.last_login_date ?? row.lastLoginDate ?? '',
    dailyBonusDate: row.daily_bonus_date ?? row.dailyBonusDate ?? '',
    lastSpinDate: row.last_spin_date ?? row.lastSpinDate ?? '',
    kycStatus: row.kyc_status ?? row.kycStatus ?? 'none',
    socialUnlockAt: parseInt(row.social_unlock_at ?? row.socialUnlockAt ?? 0),
    wallProgress: row.wall_progress ?? row.wallProgress ?? {},
    readNotices: row.read_notices ?? row.readNotices ?? {},
    completedTasks: row.completed_tasks ?? row.completedTasks ?? {},
    createdAt: row.created_at ?? row.createdAt ?? 0,
    fcmToken: row.fcm_token ?? row.fcmToken ?? '',
    notifPrefs: row.notif_prefs ?? row.notifPrefs ?? null,
  };
}

// JS camelCase → DB snake_case mapper (for writes)
function _userToDB(data){
  const m = {
    usdEarned:'usd_earned', todayEarned:'today_earned',
    todayDate:'today_date', adsWatched:'ads_watched',
    offersCompleted:'offers_completed', activeReferrals:'active_referrals',
    isAdmin:'is_admin', emailVerified:'email_verified',
    refCode:'ref_code', referredBy:'referred_by',
    forgotUsed:'forgot_used', countryEarn:'country_earn',
    deviceId:'device_id', loginStreak:'login_streak',
    lastLoginDate:'last_login_date', dailyBonusDate:'daily_bonus_date', lastSpinDate:'last_spin_date',
    kycStatus:'kyc_status',
    socialUnlockAt:'social_unlock_at', wallProgress:'wall_progress',
    readNotices:'read_notices', completedTasks:'completed_tasks',
    createdAt:'created_at',
    fcmToken:'fcm_token',
    notifPrefs:'notif_prefs',
    // uid → id (Supabase primary key)
    uid:'id',
  };
  const result = {};
  for(const [k,v] of Object.entries(data)){
    const mapped = m[k]||k;
    result[mapped] = v;
  }
  // Ensure id is always set — uid and id must be same
  if(result.uid && !result.id) result.id = result.uid;
  if(result.id && !result.uid) result.uid = result.id;
  return result;
}

async function getWallData(){
  // CFG.walls থেকে সাধারণ wall status তৈরি করা হয়
  const walls={};
  CFG.walls.forEach((w,i)=>{
    walls[w.id]={ id:w.id, active:true };
  });
  S.wallData=walls;
  return walls;
}

async function checkWallUnlock(wallId){
  if(!S.user) return {locked:true, count:0};
  // wallProgress stored as JSON field in users table
  const snap=await fDB.ref(`users/${S.user.uid}`).once('value');
  const ud=snap.val()||{};
  const wallProgress=ud.wallProgress||{};
  const prog=wallProgress[wallId]||{count:0,unlockedAt:0};
  const unlocked=prog.unlockedAt && (Date.now()-prog.unlockedAt)<CFG.unlock24h;
  const remaining=unlocked?Math.max(0,CFG.unlock24h-(Date.now()-prog.unlockedAt)):0;
  return {locked:!unlocked, count:prog.count||0, unlockedAt:prog.unlockedAt, remaining};
}

function msToHM(ms){
  const h=Math.floor(ms/3600000);
  const m=Math.floor((ms%3600000)/60000);
  return `${h}h ${m}m`;
}

// ─── AUTH FUNCTIONS ───────────────────────────────────
async function doRegister(name,email,pw,refCode,captchaToken){
  // Device check
  const devId=getDeviceId();
  const usersSnap=await fDB.ref('users').orderByChild('device_id').equalTo(devId).once('value');
  const devUsers=usersSnap.val()||{};
  if(Object.keys(devUsers).length>=CFG.maxDevAcc){
    toast(T('mx'),'e'); return;
  }
  // Email duplicate check — Supabase এ আগে থেকে আছে কিনা
  try{
    const {data:existCheck} = await sb.from('users')
      .select('id').eq('email', email.toLowerCase().trim()).maybeSingle();
    if(existCheck){
      toast(T('emailAlreadyRegistered'),'e',5000); return;
    }
  }catch(e){ /* continue — Supabase Auth নিজেই ধরবে */ }
  // Ref code validation
  let refByUid=null;
  if(refCode){
    const snap=await fDB.ref('users').orderByChild('ref_code').equalTo(refCode.toUpperCase()).once('value');
    const found=snap.val();
    if(!found){ toast(T('rnf'),'e'); return; }
    refByUid=Object.keys(found)[0];
    if(refByUid===S.user?.uid){ toast(T('rs2'),'e'); return; }
  }
  try{
    const cred=await fAuth.createUserWithEmailAndPassword(email,pw,captchaToken);
    const uid=cred.user.id || cred.user.uid;
    await cred.user.sendEmailVerification();
    // ⚠️ ফিক্স: আগে genRef() একবার কল করে সরাসরি ব্যবহার হতো, uniqueness
    // চেক ছাড়াই। ৬-ক্যারেক্টার random code-এ কোল্লিশনের সম্ভাবনা কম হলেও
    // শূন্য না — App বড় হলে (কয়েক হাজার+ ইউজার) দুইজনের একই ref_code হয়ে
    // যেতে পারত, যার ফলে referral বোনাস ভুল মানুষকে যেতে পারত। এখন কোড
    // জেনারেট করে আগে Supabase-এ চেক করা হয় সেটা আগে থেকে কারো আছে কিনা,
    // থাকলে নতুন করে জেনারেট করে আবার চেষ্টা করা হয় (সর্বোচ্চ ৫ বার)।
    let code = genRef();
    for(let attempt=0; attempt<5; attempt++){
      const {data:codeExists} = await sb.from('users').select('id').eq('ref_code', code).maybeSingle();
      if(!codeExists) break; // ইউনিক পাওয়া গেছে
      code = genRef();
    }
    // ── id field MUST be the Supabase Auth UID ──
    // সব field snake_case এ — Supabase users table এর সাথে exact match
    const userData={
      id: uid,          // ← PRIMARY KEY — এটাই সবচেয়ে গুরুত্বপূর্ণ ছিল
      uid: uid,         // backward compat
      name: name||email.split('@')[0],
      email: email,
      ref_code: code,
      referred_by: refByUid||null,
      lang: S.lang,
      country: S.country||'',
      country_earn: S.countryEarn||0.30,
      usd_earned: 0,
      today_earned: 0,
      today_date: new Date().toDateString(),
      ads_watched: 0,
      offers_completed: 0,
      active_referrals: 0,
      is_admin: false,
      banned: false,
      forgot_used: false,
      device_id: devId,
      email_verified: false,
      login_streak: 0,
      last_login_date: '',
      daily_bonus_date: '',
      last_spin_date: '',
      kyc_status: 'none',
      wall_progress: {},
      read_notices: {},
      completed_tasks: {},
      social_unlock_at: 0,
      created_at: new Date().toISOString(),
    };
    // Direct Supabase insert — fDB wrapper bypass করে সরাসরি
    const {error: insertErr} = await sb.from('users').upsert(userData, {onConflict:'id'});
    if(insertErr){
      console.error('User insert error:', insertErr);
      toast(insertErr.message,'e'); return;
    }
    // ⚠️ ফিক্স: এখানে কমেন্টে "Atomic counter" লেখা থাকলেও আসল কোড ছিল
    // "read করে তারপর write" — এটা প্রকৃতপক্ষে atomic ছিলই না। অনেকজন
    // ইউজার একসাথে/কাছাকাছি সময়ে register করলে (যেমন কোনো campaign চলাকালীন)
    // একাধিক increment হারিয়ে যেতে পারত (classic race condition) — মানে
    // ৫০ জন register করলেও counter হয়তো ৩৫/৪০ দেখাতো। এখন সেই একই
    // atomic_increment RPC ব্যবহার করা হচ্ছে যেটা balance/total_paid_out-এও
    // ব্যবহার হয় — সত্যিকারের database-level atomic অপারেশন, একসাথে হাজার
    // জন register করলেও একটাও হারাবে না।
    try{
      const {error:rpcErr} = await sb.rpc('atomic_increment', {
        p_table:'stats', p_id:'stats', p_field:'total_users', p_delta:1
      });
      if(rpcErr){
        // RPC না থাকলে ফলব্যাক (কম নিরাপদ, কিন্তু কাজ চালানোর জন্য যথেষ্ট)
        const {data:stData} = await sb.from('stats').select('total_users').eq('id','stats').maybeSingle();
        const curTotal = stData?.total_users||0;
        await sb.from('stats').upsert({id:'stats', total_users: curTotal+1}, {onConflict:'id'});
      }
    }catch(e){ /* counter fail হলেও registration আটকাবে না */ }
    // Referral bonus
    if(refByUid){
      const refSnap = await sb.from('users').select('usd_earned').eq('id',refByUid).maybeSingle();
      await atomicIncrement(refByUid,'usdEarned',CFG.refBonus);
      await atomicIncrement(refByUid,'referralEarned',CFG.refBonus); // ← referral tracking
      await atomicIncrement(refByUid,'activeReferrals',1);
      trackEvent('referral_success', { referrer_uid: refByUid });
    }
    EZCache.invalidateAll();
    trackEvent('sign_up', { method:'email', country: S.country||'' });
toast(T('rs'),'s');
// ✅ রেজিস্ট্রেশন সফল হলে — success message দেখানোর পর ইন্টারস্টিশিয়াল অ্যাড,
//    তারপর verify পেজে নিয়ে যাওয়া হচ্ছে (ব্যর্থ হলে উপরের catch ব্লকে শুধু
//    error toast দেখানো হয়, কোনো অ্যাড দেখানো হয় না)
await showInterstitialAd();
await sb.auth.signOut();
S.user = null;
// ⚠️ ফিক্স: sign-out এর পর fAuth.currentUser/S.user দুটোই null হয়ে যায়,
// তাই verify পেজের OTP সাবমিট/রিসেন্ড বাটন কার email ব্যবহার করবে জানত
// না (এতদিন এটা লুকানো bug ছিল)। এখন আলাদাভাবে S.verifyEmail-এ email
// সংরক্ষণ করে রাখা হচ্ছে, যেটা sign-out এ মুছে যায় না।
S.verifyEmail = email;
S.page='verify';
render();
  }catch(e){
    console.error('Register error:', e);
    const msg = e.message||'';
    if(msg.includes('already registered')||msg.includes('already exists')||msg.includes('duplicate')||msg.includes('unique')){
      toast(T('emailAlreadyRegistered'),'e',5000);
    } else if(msg.includes('password')){
      toast(T('pwMin6Toast'),'e');
    } else {
      toast(msg||'Registration failed. Try again.','e');
    }
  }
}

// ⚠️ নতুন — doLogin() এর ভেতরে থাকা "সফলভাবে লগইন হওয়ার পরের সব ধাপ"
// (userData লোড, wall data, payout settings, listeners চালু করা, ইত্যাদি)
// এখানে একটা আলাদা, পুনঃব্যবহারযোগ্য ফাংশনে বের করে আনা হলো। এখন এটা
// একাধিক জায়গা থেকে কল হয়: (১) সাধারণ পাসওয়ার্ড দিয়ে লগইন করলে,
// (২) OTP কোড দিয়ে ইমেইল ভেরিফাই করলে (verifySignupOtp), (৩) Google/
// Facebook দিয়ে লগইন করলে (signInWithGoogle/completeSocialLogin)। এতে
// এই ৪ জায়গাতেই হুবহু একই, সম্পূর্ণ setup হয় — কোনো ধাপ আলাদাভাবে লিখে
// কোথাও বাদ পড়ে যাওয়ার ঝুঁকি থাকে না।
async function completeUserLogin(u){
  fAuth.currentUser = _mapUser(u);
  S.user = fAuth.currentUser;
  let ud = await loadUserData(u.id);
  if(!ud){ await new Promise(r=>setTimeout(r,1500)); ud = await loadUserData(u.id); }
  S.userData = ud;
  if(S.userData?.banned){ toast(T('banned'),'e'); doLogout(); return; }
  if(S.userData?.lang && LANGS[S.userData.lang]) applyLang(S.userData.lang);
  await getWallData();
  await loadPayoutSettings();
  setupListeners(u.id);
  _authInitDone = true;
  // ✅ লগইন সফল হলে — হোমপেজে যাওয়ার আগে ইন্টারস্টিশিয়াল অ্যাড দেখানো হচ্ছে
  await showInterstitialAd();
  S.page='home';
  render();
  trackEvent('login', { method:'email' });
  // non-blocking
  detectCountry();
  if(S.userData){ checkDailyBonus(u.id, S.userData); updateLoginStreak(u.id, S.userData); }
  loadLeaderboard();
}

// captchaToken — hCaptcha/Turnstile থেকে পাওয়া টোকেন (Supabase Attack
// Protection চালু থাকলে বাধ্যতামূলক, না থাকলে undefined পাঠালেও সমস্যা নেই)
async function doLogin(email,pw,captchaToken){
  try{
    const {data, error} = await sb.auth.signInWithPassword({
      email, password:pw,
      options: captchaToken ? { captchaToken } : undefined
    });
    if(error) throw error;
    const u = data.user;
    if(!u) throw new Error('No user');
    // Verified check
    const isVerified = !!(u.email_confirmed_at || u.confirmed_at);
    if(!isVerified){
      S.user = _mapUser(u);
      fAuth.currentUser = S.user;
      S.verifyEmail = email; // ⚠️ OTP verify/resend বাটনের জন্য দরকার
      S.page='verify';
      render(); return;
    }
    await completeUserLogin(u);
  }catch(e){
    console.error('Login error:', e);
    toast(T('wp'),'e');
  }
}

// ══════════════════════════════════════════════════════════
// ⚠️ নতুন — Google / Facebook দিয়ে লগইন-রেজিস্টার (একই সাথে দুটোই)
// ══════════════════════════════════════════════════════════
// Google: নেটিভ Credential Manager (@capgo/capacitor-social-login) দিয়ে
//   সরাসরি ID Token পাওয়া যায়, তারপর Supabase-কে sb.auth.signInWithIdToken()
//   দিয়ে সরাসরি লগইন করানো হয় — কোনো ব্রাউজার/রিডাইরেক্ট লাগে না।
//
// Facebook: ⚠️ গুরুত্বপূর্ণ — Supabase-এর signInWithIdToken() অফিসিয়ালি
//   Facebook সাপোর্ট করে না (শুধু google/apple/azure/keycloak), তাই
//   Facebook-এর জন্য Supabase-এর standard OAuth ব্যবহার করা হচ্ছে:
//   সিস্টেম ব্রাউজারে Facebook লগইন পেজ খোলে (@capacitor/browser দিয়ে),
//   ইউজার Facebook-এ লগইন/অনুমতি দেওয়ার পর "earnova://oauth-callback"
//   এই কাস্টম লিংকে ফিরে আসে, অ্যাপ সেটা ধরে সেশন বানায়। এটা ইমেইল
//   ভেরিফিকেশন লিংকের মতো "ব্লকড" হয় না, কারণ এটা ইউজারের নিজের সরাসরি
//   ট্যাপ থেকে শুরু হওয়া একটা চলমান ব্রাউজার সেশন (ইমেইলে আসা লিংকের
//   মতো আলাদা করে একটা পুরনো/ঠান্ডা রিডাইরেক্ট না)।

/**
 * users টেবিলে (Realtime DB wrapper fDB) রেকর্ড না থাকলে বানায় — নতুন
 * Google/Facebook ইউজারের জন্য প্রথমবার লগইনে কল হয়। doRegister()-এর
 * সাথে সামঞ্জস্যপূর্ণ রাখা হয়েছে (ref code, device id, stats counter সহ)।
 */
async function ensureUserRecord(u, extraName){
  const existing = await loadUserData(u.id);
  if(existing) return existing;

  const devId = getDeviceId();
  let code = genRef();
  for(let attempt=0; attempt<5; attempt++){
    const {data:codeExists} = await sb.from('users').select('id').eq('ref_code', code).maybeSingle();
    if(!codeExists) break;
    code = genRef();
  }
  const savedRef = localStorage.getItem('ez_ref') || '';
  let refByUid = null;
  if(savedRef){
    const snap = await fDB.ref('users').orderByChild('ref_code').equalTo(savedRef.toUpperCase()).once('value');
    const found = snap.val();
    if(found) refByUid = Object.keys(found)[0];
  }

  const userData = {
    id: u.id, uid: u.id,
    name: extraName || u.email?.split('@')[0] || 'User',
    email: u.email,
    ref_code: code,
    referred_by: refByUid || null,
    lang: S.lang, country: S.country||'', country_earn: S.countryEarn||0.30,
    usd_earned:0, today_earned:0, today_date:new Date().toDateString(),
    ads_watched:0, offers_completed:0, active_referrals:0,
    is_admin:false, banned:false, forgot_used:false, device_id:devId,
    // Google/Facebook নিজেরাই ইমেইল ভেরিফাই করে রাখে, তাই সরাসরি true
    email_verified:true,
    login_streak:0, last_login_date:'', daily_bonus_date:'', last_spin_date:'',
    kyc_status:'none', wall_progress:{}, read_notices:{}, completed_tasks:{},
    social_unlock_at:0, created_at:new Date().toISOString(),
  };
  const {error:insertErr} = await sb.from('users').upsert(userData, {onConflict:'id'});
  if(insertErr){ console.error('Social user insert error:', insertErr); throw insertErr; }

  try{
    const {error:rpcErr} = await sb.rpc('atomic_increment', { p_table:'stats', p_id:'stats', p_field:'total_users', p_delta:1 });
    if(rpcErr){
      const {data:stData} = await sb.from('stats').select('total_users').eq('id','stats').maybeSingle();
      await sb.from('stats').upsert({id:'stats', total_users:(stData?.total_users||0)+1}, {onConflict:'id'});
    }
  }catch(e){ /* counter fail হলেও লগইন আটকাবে না */ }

  if(refByUid){
    await atomicIncrement(refByUid,'usdEarned',CFG.refBonus);
    await atomicIncrement(refByUid,'referralEarned',CFG.refBonus);
    await atomicIncrement(refByUid,'activeReferrals',1);
    trackEvent('referral_success', { referrer_uid: refByUid });
  }
  EZCache.invalidateAll();
  return await loadUserData(u.id);
}

async function signInWithGoogle(){
  if(!window.Capacitor?.Plugins?.SocialLogin){
    toast(T('socialLoginFailedMsg'),'e'); return;
  }
  try{
    const { SocialLogin } = window.Capacitor.Plugins;
    const res = await SocialLogin.login({ provider:'google', options:{ scopes:['email','profile'] } });
    const idToken = res?.result?.idToken;
    if(!idToken) throw new Error('No Google idToken returned');
    const { data, error } = await sb.auth.signInWithIdToken({ provider:'google', token: idToken });
    if(error) throw error;
    const u = data.user;
    await ensureUserRecord(u, res.result?.profile?.name);
    trackEvent('sign_up_or_login', { method:'google' });
    await completeUserLogin(u);
  }catch(e){
    console.error('Google login error:', e);
    toast(T('socialLoginFailedMsg'),'e');
  }
}

/**
 * Facebook — সিস্টেম ব্রাউজারে Supabase-এর OAuth authorize URL খোলে।
 * ইউজার ফিরে এলে (earnova://oauth-callback?code=...) app-events.js এর
 * initSocialLoginCallback() এটা ধরে exchangeCodeForSession() কল করে এবং
 * completeFacebookLogin() কে ডাকে (নিচে)।
 */
async function signInWithFacebook(){
  if(!window.Capacitor?.Plugins?.Browser){
    toast(T('socialLoginFailedMsg'),'e'); return;
  }
  try{
    const { Browser } = window.Capacitor.Plugins;
    const authUrl = `${SUPA_URL}/auth/v1/authorize?provider=facebook&redirect_to=earnova://oauth-callback`;
    await Browser.open({ url: authUrl });
    // বাকিটা app-events.js এর appUrlOpen listener হ্যান্ডেল করবে
  }catch(e){
    console.error('Facebook login open error:', e);
    toast(T('socialLoginFailedMsg'),'e');
  }
}

/** app-events.js এর OAuth deep-link listener থেকে কল হয় (code পাওয়ার পর) */
async function completeSocialOAuthLogin(code){
  try{
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if(error) throw error;
    const u = data.user;
    if(window.Capacitor?.Plugins?.Browser){
      try{ await window.Capacitor.Plugins.Browser.close(); }catch(e){}
    }
    await ensureUserRecord(u, u.user_metadata?.full_name || u.user_metadata?.name);
    trackEvent('sign_up_or_login', { method:'facebook' });
    await completeUserLogin(u);
  }catch(e){
    console.error('Facebook OAuth callback error:', e);
    toast(T('socialLoginFailedMsg'),'e');
  }
}

function doLogout(){
  fAuth.signOut();
  S.user=null; S.userData=null;
  S.page='login'; S.sidebarOpen=false;
  S.unsubscribes.forEach(u=>{ try{ if(typeof u==='function') u(); }catch(e){} });
  S.unsubscribes=[];
  stopAutoInterstitialLoop(); // অ্যাপের অটো ইন্টারস্টিশিয়াল টাইমার বন্ধ করো
  render();
}

async function doForgotPw(email,captchaToken){
  if(!email){ toast(T('enterEmailMsg'),'e'); return; }
  // Check if already used (if user is logged in)
  if(S.userData?.forgotUsed){
    toast(T('fpn'),'w'); return;
  }
  try{
    // Check user exists
    const snap=await fDB.ref('users').orderByChild('email').equalTo(email).once('value');
    const found=snap.val();
    if(found){
      const uid=Object.keys(found)[0];
      if(found[uid].forgotUsed){ toast(T('fpn'),'w'); return; }
      await fAuth.sendPasswordResetEmail(email,captchaToken);
      await fDB.ref(`users/${uid}/forgotUsed`).set(true);
    } else {
      await fAuth.sendPasswordResetEmail(email,captchaToken);
    }
    // ⚠️ নতুন: এখন এখানে থামা যাবে না — লগইন পেজে ফেরত না পাঠিয়ে
    // OTP-কোড + নতুন-পাসওয়ার্ড দেওয়ার স্ক্রিনে পাঠানো হচ্ছে
    S.resetEmail = email; // পরের ধাপে (confirmPasswordResetOtp) কাজে লাগবে
    toast(T('es'),'s');
    S.page='resetOtp'; render();
  }catch(e){ toast(e.message,'e'); }
}

// ══════════════════════════════════════════════════════════
// ⚠️ নতুন — OTP-ভিত্তিক ইমেইল ভেরিফিকেশন ও পাসওয়ার্ড রিসেট
// ══════════════════════════════════════════════════════════
// আগে ইমেইল ভেরিফিকেশন ও পাসওয়ার্ড রিসেট দুটোই লিংক-ভিত্তিক ছিল — যেটা
// Chrome/Gmail-এর কাস্টম-স্কিম ব্লকিং সমস্যায় ভুগত (সাদা স্ক্রিন, "লিংক
// কাজ করেনি")। এখন দুটোই ৬-ডিজিট কোড দিয়ে হয়, সম্পূর্ণ অ্যাপের ভেতরেই —
// কোনো ব্রাউজার/লিংক/হোস্টিং লাগে না।

/**
 * সাইনআপের সময় পাঠানো ৬-ডিজিট কোড যাচাই করে — সফল হলে সরাসরি লগইন
 * করিয়ে completeUserLogin() চালায়।
 */
async function verifySignupOtp(email, token){
  // ⚠️ ফিক্স: আগে token.length!==6 চেক ছিল, কিন্তু Supabase প্রজেক্ট
  // ভেদে OTP কোড ৬ থেকে ৮ (কখনো তার বেশিও) ডিজিটের হতে পারে (এটা
  // GoTrue-এর একটা প্রজেক্ট-লেভেল সেটিং, ৬ কোনো ফিক্সড নিয়ম না)। তাই
  // এখন শুধু "কমপক্ষে ৬ ডিজিট" চেক করা হচ্ছে, নির্দিষ্ট সংখ্যা না।
  if(!token || token.length<6){ toast(T('otpInvalid'),'e'); return; }
  try{
    const {data, error} = await sb.auth.verifyOtp({ email, token, type:'signup' });
    if(error){
      const msg=(error.message||'').toLowerCase();
      if(msg.includes('expired')) toast(T('otpExpired'),'e');
      else toast(T('otpInvalid'),'e');
      return;
    }
    const u = data?.user;
    if(!u){ toast(T('otpInvalid'),'e'); return; }
    await fDB.ref(`users/${u.id}/emailVerified`).set(true);
    trackEvent('email_verified', { method:'otp' });
    await completeUserLogin(u);
  }catch(e){
    console.error('OTP verify error:', e);
    toast(T('verifyCheckErrorMsg')||T('otpInvalid'),'e');
  }
}

/** সাইনআপ-ভেরিফিকেশন কোড আবার পাঠায় (নতুন ৬-ডিজিট কোড) */
async function resendSignupOtp(email){
  try{
    const {error} = await sb.auth.resend({ type:'signup', email });
    if(error) throw error;
    toast(T('otpResent'),'s');
  }catch(e){ toast(e.message||T('otpInvalid'),'e'); }
}

/**
 * পাসওয়ার্ড রিসেট কোড যাচাই করে ও নতুন পাসওয়ার্ড সেট করে।
 * verifyOtp(type:'recovery') সফল হলে একটা সাময়িক session তৈরি হয়,
 * সেই session দিয়েই updateUser({password}) কল করা হয়।
 */
async function confirmPasswordResetOtp(email, token, newPassword){
  if(!token || token.length<6){ toast(T('otpInvalid'),'e'); return; } // ⚠️ ফিক্স: ৬-৮+ ডিজিট সব গ্রহণ করবে
  if(!newPassword || newPassword.length<6){ toast(T('pwMin6CharsMsg'),'e'); return; }
  try{
    const {data, error} = await sb.auth.verifyOtp({ email, token, type:'recovery' });
    if(error){
      const msg=(error.message||'').toLowerCase();
      if(msg.includes('expired')) toast(T('otpExpired'),'e');
      else toast(T('otpInvalid'),'e');
      return;
    }
    const {error: updateErr} = await sb.auth.updateUser({ password: newPassword });
    if(updateErr){ toast(updateErr.message,'e'); return; }
    toast(T('resetSuccessMsg'),'s');
    // নিরাপত্তার জন্য — নতুন পাসওয়ার্ড সেট হওয়ার পর সাইন আউট করে সরাসরি
    // লগইন স্ক্রিনে পাঠানো হচ্ছে, যাতে ইউজার নতুন পাসওয়ার্ড দিয়ে
    // সচেতনভাবে আবার লগইন করে
    await sb.auth.signOut();
    S.user=null; S.userData=null; S.resetEmail='';
    S.page='login'; render();
  }catch(e){
    console.error('Password reset error:', e);
    toast(e.message||T('otpInvalid'),'e');
  }
}

// ─── WITHDRAWAL SYSTEM ───────────────────────────────
async function submitWithdraw(method,account,amount){
  // Rate limit: ২৪ ঘণ্টায় ১বারের বেশি withdraw নয়
  const lastWd = localStorage.getItem('ez_last_wd');
  if(lastWd && (Date.now()-parseInt(lastWd)) < 24*60*60*1000){
    const hoursLeft = Math.ceil((24*60*60*1000-(Date.now()-parseInt(lastWd)))/3600000);
    toast(`Please wait ${hoursLeft} more hour(s) before next withdrawal request.`,'w',5000);
    return;
  }
  const ud=S.userData;
  if(!ud){ toast(T('notLoggedInMsg'),'e'); return; }
  const usd=parseFloat(amount);
  if(isNaN(usd)||usd<CFG.minUSD){
    toast(T('wf'),'e');
    startAd(null,'withdraw',()=>{ S.page='wallet'; render(); });
    return;
  }
  if((ud.activeReferrals||0)<CFG.minRefs){
    toast(T('noWarn'),'w',5000);
    return; // শুধু message — requirement পূরণ না হলে ad দেখাবে না
  }
  if(!account||account.trim().length<4){
    toast(T('invalidAccountMsg'),'e'); return;
  }
  // 🪪 KYC গেট — বড় অঙ্কের withdraw এর জন্য identity verification লাগবে
  if(usd >= CFG.kycThreshold && ud.kycStatus !== 'approved'){
    if(ud.kycStatus === 'pending'){
      toast(`⏳ আপনার KYC যাচাই এখনও চলছে। অনুমোদন হলে $${CFG.kycThreshold}+ withdraw করতে পারবেন।`,'w',6000);
    } else {
      toast(`🪪 $${CFG.kycThreshold}+ withdraw করতে Identity Verification (KYC) লাগবে। Profile পেজ থেকে verify করুন।`,'w',6000);
    }
    return;
  }
  if((ud.usdEarned||0)<usd){
    toast(T('wf'),'e'); return;
  }
  const wid = crypto.randomUUID ? crypto.randomUUID() : ('wd_'+Date.now()+'_'+Math.random().toString(36).slice(2,8));
  // ⚠️ ফিক্স: এই primitive সংখ্যাটা এখনই (deduct হওয়ার আগেই) আলাদা করে
  // রাখা হচ্ছে — কারণ `ud` আসলে `S.userData`-এরই reference (কপি না),
  // নিচে RPC সফল হওয়ার পর `S.userData.usdEarned` বদলে গেলে `ud.usdEarned`ও
  // সাথে সাথেই বদলে যাবে (একই অবজেক্ট)। withdraw-এর *আগের* আসল balance
  // দরকার নিচের referral-ratio হিসাবের জন্য, তাই এই primitive number-এ
  // এখনই স্ন্যাপশট নেওয়া হলো।
  const preWithdrawBal = parseFloat(ud.usdEarned||0);

  // ══════════════════════════════════════════════════════════
  // ⚠️ গুরুত্বপূর্ণ ফিক্স — Double-Spend Race Condition
  // ══════════════════════════════════════════════════════════
  // আগে এখানে ২ ধাপে হতো: (১) "fresh balance" আলাদা করে পড়া, (২) তারপর
  // আলাদা .update() দিয়ে বিয়োগ করা। এই দুইয়ের মাঝের ফাঁকে যদি কেউ Withdraw
  // বাটনে দ্রুত ২ বার চাপে (বা কেউ ইচ্ছাকৃতভাবে ২টা রিকোয়েস্ট একসাথে
  // পাঠায়), দুটোই একই মুহূর্তে "balance যথেষ্ট আছে" দেখতে পেত (দ্বিতীয়টা
  // প্রথমটার বিয়োগ তখনও দেখেনি) — ফলে $50 balance থাকলেও ২টা আলাদা $50
  // withdrawal request তৈরি হয়ে যেতে পারত, টাকা বাস্তবে একবারই থাকলেও।
  //
  // এখন একটা একক atomic SQL অপারেশন (atomic_withdraw_deduct RPC) ব্যবহার
  // হচ্ছে — এটা Postgres-এর একটাই UPDATE স্টেটমেন্টে balance-চেক ও বিয়োগ
  // একসাথে করে (WHERE usd_earned >= amount)। Postgres নিজেই নিশ্চিত করে
  // এই ধরনের UPDATE একসাথে দুইজনের জন্য সফল হতে পারে না — দ্বিতীয় রিকোয়েস্ট
  // স্বয়ংক্রিয়ভাবে "insufficient balance" এরর পাবে, ম্যানুয়াল চেকের ওপর
  // নির্ভর করতে হয় না।
  const { data: newBalResult, error: deductErr } = await sb.rpc('atomic_withdraw_deduct', {
    p_uid: S.user.uid, p_amount: usd,
  });
  if(deductErr){
    // RPC না থাকলে (পুরনো Supabase সেটআপ) নিরাপদ ফলব্যাক — অন্তত ডাবল
    // রিকোয়েস্টের ঝুঁকি কিছুটা কমাতে fresh read করেই এগোনো হচ্ছে
    const {data:freshData} = await sb.from('users').select('usd_earned').eq('id',S.user.uid).single();
    const freshBal = parseFloat(freshData?.usd_earned||0);
    if(freshBal < usd){ toast(T('insufficientBalanceMsg'),'e'); return; }
    await sb.from('users').update({usd_earned: Math.max(0, freshBal-usd)}).eq('id', S.user.uid);
    S.userData.usdEarned = Math.max(0, freshBal-usd);
  } else if(newBalResult === null || newBalResult === undefined){
    // RPC নিজেই "balance যথেষ্ট নেই" বলে জানালো (WHERE ক্লজ মেলেনি)
    toast(T('insufficientBalanceMsg'),'e'); return;
  } else {
    S.userData.usdEarned = parseFloat(newBalResult);
  }
  // ⚠️ ফিক্স: আগে এখানে ভুলবশত `const freshBal = usd;` লেখা ছিল — মানে
  // freshBal সবসময় ঠিক withdraw করা পরিমাণের সমান হতো, ফলে নিচের
  // ratio = usd/freshBal সবসময় ঠিক 1 (=100%) হয়ে যেত, যত ছোট withdraw
  // করা হোক না কেন। এর ফলে প্রতিটা withdraw-এই referral_earned সম্পূর্ণ
  // শূন্য হয়ে যেত, যদিও withdraw করা হয়েছিল হয়তো মোট balance-এর সামান্য
  // একটা অংশ মাত্র। এখন উপরে স্ন্যাপশট নেওয়া withdraw-এর *আগের* আসল
  // balance (preWithdrawBal) ব্যবহার করা হচ্ছে, তাই ratio এখন সঠিকভাবে
  // "মোট balance-এর কত অংশ withdraw করা হলো" প্রতিফলিত করে।
  const freshBal = preWithdrawBal;

  // Step 1b: referral_earned (টাকা) proportionally কাটো
  // + activeReferrals count reset করো (পরের withdraw এর জন্য আবার referral আনতে হবে)
  try{
    const {data:refRow} = await sb.from('users').select('referral_earned').eq('id',S.user.uid).single();
    const curRefEarned = parseFloat(refRow?.referral_earned||0);
    if(curRefEarned > 0 && freshBal > 0){
      const ratio = Math.min(1, usd / freshBal);
      const refDeduct = parseFloat((curRefEarned * ratio).toFixed(6));
      const newRefEarned = Math.max(0, curRefEarned - refDeduct);
      await sb.from('users').update({
        referral_earned: newRefEarned,
        active_referrals: 0   // ← withdraw হলে referral count reset
      }).eq('id', S.user.uid);
      if(S.userData){
        S.userData.referralEarned = newRefEarned;
        S.userData.activeReferrals = 0;
      }
    } else {
      // referral_earned না থাকলেও শুধু count reset করো
      await sb.from('users').update({ active_referrals: 0 }).eq('id', S.user.uid);
      if(S.userData) S.userData.activeReferrals = 0;
    }
  }catch(e){ /* silent — main balance already deducted */ }
  // Step 2: Withdrawal request Supabase তে save করো
  await sb.from('withdrawals').insert({
    id:wid, uid:S.user.uid, user_email:ud.email||S.user.email, user_name:ud.name||'',
    method, account, amount:usd, status:'pending',
    created_at: Date.now(),
  });
  trackEvent('withdrawal_request', { amount: usd, method });
  // Rate limit timestamp save
  localStorage.setItem('ez_last_wd', Date.now().toString());
  // Show success message with payment timeline
  const app=document.getElementById('app');
  const uid2=S.user?.uid||'';
  document.getElementById('app').innerHTML=`
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f0f7ff">
    <div style="background:#fff;border:2px solid #86efac;border-radius:22px;padding:32px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(5,150,105,.15);animation:fadeUp .32s ease">
      <div style="font-size:64px;margin-bottom:16px">🎉</div>
      <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#0f172a;margin-bottom:8px">${T('wSuccess')||'Withdrawal Successful!'}</div>
      <div style="font-size:14px;color:#64748b;line-height:1.7;margin-bottom:20px">${T('wPending')||'Payment will be processed within 3-7 business days.'}</div>
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px;margin-bottom:20px">
        <div style="font-size:12px;color:#15803d;font-weight:600">📋 Request Details</div>
        <div style="font-size:13px;color:#475569;margin-top:6px">Method: <strong>${escapeHtml(method.toUpperCase())}</strong></div>
        <div style="font-size:13px;color:#475569">Account: <strong>${escapeHtml(account)}</strong></div>
        <div style="font-size:13px;color:#15803d;font-weight:700">Amount: <strong>$${usd.toFixed(2)}</strong></div>
      </div>
      <button onclick="S.page='wallet';render()" style="width:100%;background:linear-gradient(135deg,#2563eb,#059669);color:#fff;border:none;border-radius:11px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">← Back to Wallet</button>
    </div>
  </div>`;
  // ⚠️ ফিক্স: showInterstitialAd() ফাংশনটা আগে থেকে বানানো থাকলেও কোথাও
  // কল করা হচ্ছিল না — মানে interstitial ad কখনো দেখাতোই না। এখানে
  // withdrawal request সফল হওয়ার পর দেখানো হচ্ছে — এটা natural transition
  // point, আর rewarded video-র ঠিক পরে না বলে ads স্ট্যাক করে না।
  showInterstitialAd();
}

// ─── SMART CACHE SYSTEM ───────────────────────────────
// ════════════════════════════════════════════════════════
//  SUPABASE PROPER TABLE LAYER
//  প্রতিটা data type এর জন্য আলাদা table
//  scalable, fast, professional
// ════════════════════════════════════════════════════════

// ── AUTH wrapper (fAuth — same API as before) ─────────
const fAuth = {
  currentUser: null,

  async signInWithEmailAndPassword(email, pw){
    const {data, error} = await sb.auth.signInWithPassword({email, password:pw});
    if(error) throw {code:'auth/wrong-password', message: T('wp')};
    return {user: _mapUser(data.user)};
  },

  // ⚠️ নতুন: emailRedirectTo বাদ দেওয়া হলো — এখন ভেরিফিকেশন লিংকের বদলে
  // ৬-ডিজিট OTP কোড পাঠানো হয় (Supabase Dashboard → Auth → Email
  // Templates → "Confirm signup"-এ {{ .Token }} বসাতে হবে)। captchaToken
  // পাস করা থাকলে Supabase-এর Attack Protection যাচাই করবে।
  async createUserWithEmailAndPassword(email, pw, captchaToken){
    const {data, error} = await sb.auth.signUp({
      email, password:pw,
      options: { captchaToken: captchaToken || undefined }
    });
    if(error) throw {code: error.message, message: error.message};
    return {user: _mapUser(data.user)};
  },

  async sendPasswordResetEmail(email,captchaToken){
    // ⚠️ নতুন: redirectTo বাদ দেওয়া হলো — পাসওয়ার্ড রিসেটও এখন OTP কোড
    // দিয়ে হয় (Supabase Dashboard → Auth → Email Templates →
    // "Reset Password"-এ {{ .Token }} বসাতে হবে)
    const {error} = await sb.auth.resetPasswordForEmail(email, {
      captchaToken: captchaToken || undefined
    });
    if(error) throw error;
  },

  async signOut(){
    await sb.auth.signOut();
  },

  onAuthStateChanged(callback){
    // Supabase auth state listener — একটাই, duplicate নেই
    sb.auth.onAuthStateChange(async (event, session)=>{
      if(session?.user){
        fAuth.currentUser = _mapUser(session.user);
        callback(fAuth.currentUser);
      } else {
        fAuth.currentUser = null;
        callback(null);
      }
    });
    // Existing session check — শুধু একবার, startup এ
    sb.auth.getSession().then(({data:{session}})=>{
      if(session?.user){
        fAuth.currentUser = _mapUser(session.user);
        callback(fAuth.currentUser);
      } else {
        callback(null);
      }
    }).catch(()=>{ callback(null); });
  }
};

function _mapUser(u){
  if(!u) return null;
  const isVerified = !!(u.email_confirmed_at || u.confirmed_at || 
                        u.user_metadata?.email_verified);
  return {
    ...u,
    uid: u.id,
    emailVerified: isVerified,
    sendEmailVerification: async ()=>{
      await sb.auth.resend({type:'signup', email: u.email});
    },
    reload: async ()=>{
      const {data:{user}} = await sb.auth.getUser();
      if(user) fAuth.currentUser = _mapUser(user);
    }
  };
}

// ── DB wrapper — proper table-based ─────────────────
// প্রতিটা path → সঠিক Supabase table এ যাবে
const fDB = {
  ref(path){ return new SBRef(path.replace(/^\//, '')); }
};

// ── ATOMIC increment/decrement via Supabase RPC ──────
// Race condition নেই — database level atomic operation
// SQL: CREATE OR REPLACE FUNCTION atomic_increment(p_table TEXT, p_id TEXT, p_field TEXT, p_delta NUMERIC)
// RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
// BEGIN EXECUTE format('UPDATE %I SET %I=GREATEST(0,COALESCE(%I,0)+$1) WHERE id=$2',p_table,p_field,p_field) USING p_delta,p_id; END; $$;
async function atomicIncrement(uid, field, delta){
  try{
    // Try Supabase RPC first (if function exists)
    const snakeField = {
      usdEarned:'usd_earned', adsWatched:'ads_watched',
      offersCompleted:'offers_completed', activeReferrals:'active_referrals',
      loginStreak:'login_streak', todayEarned:'today_earned',
      referralEarned:'referral_earned'
    }[field] || field;
    const {error} = await sb.rpc('atomic_increment', {
      p_table:'users', p_id:uid, p_field:snakeField, p_delta:delta
    });
    if(!error){
      // Update local state
      if(S.userData && S.user?.uid===uid){
        S.userData[field] = Math.max(0, (S.userData[field]||0) + delta);
      }
      EZCache.invalidate(`users/${uid}`);
      return true;
    }
    // Fallback: read-modify-write (less safe but works)
    const snap = await fDB.ref(`users/${uid}/${field}`).once('value');
    const cur = parseFloat(snap.val()||0);
    const newVal = Math.max(0, cur + delta);
    await fDB.ref(`users/${uid}/${field}`).set(newVal);
    return true;
  }catch(e){
    // Silent fallback
    const snap = await fDB.ref(`users/${uid}/${field}`).once('value');
    const cur = parseFloat(snap.val()||0);
    await fDB.ref(`users/${uid}/${field}`).set(Math.max(0, cur + delta));
    return false;
  }
}

class SBRef {
  constructor(path){ this.path = path; }

  push(){
    const key = crypto.randomUUID ? crypto.randomUUID() : ('id_'+Date.now()+'_'+Math.random().toString(36).slice(2,8));
    const child = new SBRef(this.path + '/' + key);
    child.key = key;
    // Expose set on push result
    child.parentSet = true;
    return child;
  }

  get key(){
    return this._key || this.path.split('/').pop();
  }
  set key(v){ this._key = v; }

  async set(value){
    const {table, id, field} = _parsePath(this.path);
    if(!table) return;

    if(field){
      // Field update: users/uid/fieldName
      const row = await _getRow(table, id);
      const merged = {...(row||{}), [field]: value};
      await _upsert(table, id, merged);
    } else if(id){
      // Full row set
      if(value === null || value === undefined){
        await sb.from(table).delete().eq('id', id);
      } else {
        await _upsert(table, id, {...value, id});
      }
    }
    EZCache.invalidate(this.path);
  }

  async update(updates){
    const {table, id, field} = _parsePath(this.path);
    if(!table || !id) return;
    const row = await _getRow(table, id) || {};
    const merged = {...row, ...updates, id};
    await _upsert(table, id, merged);
    EZCache.invalidate(this.path);
  }

  async remove(){
    const {table, id} = _parsePath(this.path);
    if(!table) return;
    if(id) await sb.from(table).delete().eq('id', id);
    EZCache.invalidate(this.path);
  }

  async once(event){
    const cached = EZCache.get(this.path);
    if(cached) return _snap(cached, this.path);

    const {table, id, field} = _parsePath(this.path);
    if(!table) return _snap(null, this.path);

    let value = null;

    if(field){
      const row = await _getRow(table, id);
      value = row ? row[field] ?? null : null;
    } else if(id){
      value = await _getRow(table, id);
    } else {
      // Load all rows as object
      const {data} = await sb.from(table).select('*');
      if(data && data.length){
        value = {};
        for(const row of data){
          // Map users rows to camelCase
          const mapped = table==='users' ? _userFromDB(row) : row;
          const key = mapped.id || mapped.uid || row.id;
          value[key] = mapped;
        }
      }
    }

    EZCache.set(this.path, value);
    return _snap(value, this.path);
  }

  async transaction(updateFn){
    const snap = await this.once('value');
    const current = snap.val();
    const newVal = updateFn(current);
    if(newVal !== undefined) await this.set(newVal);
    return {committed:true, snapshot:{val:()=>newVal}};
  }

  on(event, callback){
    // Initial load
    this.once('value').then(snap => callback(snap));

    const {table, id} = _parsePath(this.path);
    if(!table) return ()=>{};

    const channelName = 'rt_' + this.path.replace(/[^a-zA-Z0-9]/g,'_').slice(0,50);
    const filter = id ? `id=eq.${id}` : undefined;

    const channel = sb.channel(channelName)
      .on('postgres_changes', {
        event: '*', schema: 'public', table,
        ...(filter ? {filter} : {})
      }, async ()=>{
        EZCache.invalidate(this.path);
        const snap = await this.once('value');
        callback(snap);
      }).subscribe();

    return ()=> sb.removeChannel(channel);
  }

  off(event, unsub){ if(typeof unsub==='function') unsub(); }

  // Query methods
  orderByChild(child){ return new SBQuery(this.path, {orderBy:child}); }
  orderByValue(){ return new SBQuery(this.path, {orderBy:'__value'}); }
}

class SBQuery {
  constructor(path, opts={}){
    this.path=path; this.opts={...opts};
    this._eq=null; this._limit=null; this._limitFirst=null;
  }
  equalTo(val){ this._eq=val; return this; }
  limitToLast(n){ this._limit=n; return this; }
  limitToFirst(n){ this._limitFirst=n; return this; }
  startAt(v){ return this; }

  // Map camelCase column names to snake_case for Supabase queries
  _colMap(col){
    const m={
      deviceId:'device_id', refCode:'ref_code', referredBy:'referred_by',
      usdEarned:'usd_earned', adsWatched:'ads_watched', isAdmin:'is_admin',
      createdAt:'created_at', emailVerified:'email_verified',
      offersCompleted:'offers_completed', activeReferrals:'active_referrals',
      loginStreak:'login_streak', socialUnlockAt:'social_unlock_at',
      uid:'id',
    };
    return m[col]||col;
  }

  async once(event){
    const {table} = _parsePath(this.path);
    if(!table) return _snap(null, this.path);

    let query = sb.from(table).select('*');

    // Filter by column value — map camelCase to snake_case
    const col = this._colMap(this.opts.orderBy||'');
    if(this._eq !== null && col && col !== '__value'){
      query = query.eq(col, this._eq);
    }

    // Order
    if(col && col !== '__value'){
      const asc = !this._limit;
      query = query.order(col, {ascending: asc});
    }

    // Limit
    if(this._limit) query = query.limit(this._limit);
    if(this._limitFirst) query = query.limit(this._limitFirst);

    const {data, error} = await query;
    if(error){ return _snap(null, this.path); }

    if(!data || !data.length) return _snap(null, this.path);

    // If limitToLast, reverse to get correct order
    const rows = this._limit ? [...data].reverse() : data;

    const obj = {};
    for(const row of rows){
      // For users table, map back to camelCase
      const mapped = table==='users' ? _userFromDB(row) : row;
      obj[mapped.id||mapped.uid||row.id] = mapped;
    }

    return _snap(obj, this.path);
  }
}

// ── Path parser ────────────────────────────────────
function _parsePath(path){
  // path examples:
  // "users"                     → table:users, id:null, field:null
  // "users/uid123"              → table:users, id:uid123, field:null
  // "users/uid123/usdEarned"    → table:users, id:uid123, field:usdEarned
  // "withdrawals"               → table:withdrawals
  // "settings/payout"           → table:settings, id:payout, field:null
  // "stats"                     → table:stats, id:stats, field:null
  // "stats/totalUsers"          → table:stats, id:stats, field:totalUsers
  // "offers/uid/offerId"        → table:offers, id:offerId (store flat)

  const parts = path.split('/').filter(Boolean);
  if(!parts.length) return {table:null, id:null, field:null};

  const tableMap = {
    users:'users', withdrawals:'withdrawals',
    socialTasks:'social_tasks', submissions:'submissions',
    notices:'notices', offers:'offers',
    settings:'settings', stats:'stats',
    walls:'walls',
    orders:'orders',
    monthlyAwards:'monthly_awards',
  };

  const rawTable = parts[0];
  const table = tableMap[rawTable] || rawTable;

  if(parts.length === 1){
    // Special: stats → single row with id='stats'
    if(rawTable==='stats') return {table:'stats', id:'stats', field:null};
    return {table, id:null, field:null};
  }

  if(parts.length === 2){
    if(rawTable==='stats') return {table:'stats', id:'stats', field:parts[1]};
    if(rawTable==='settings') return {table:'settings', id:parts[1], field:null};
    return {table, id:parts[1], field:null};
  }

  if(parts.length === 3){
    if(rawTable==='settings') return {table:'settings', id:parts[1], field:parts[2]};
    if(rawTable==='users') return {table:'users', id:parts[1], field:parts[2]};
    if(rawTable==='offers') return {table:'offers', id:parts[2], field:null};
    return {table, id:parts[1], field:parts[2]};
  }

  // Deeper paths: users/uid/wallProgress/wallId → store as combined field key
  if(parts.length === 4 && rawTable==='users'){
    return {table:'users', id:parts[1], field: parts[2]+'_'+parts[3]};
  }

  return {table, id:parts[1]||null, field:parts[2]||null};
}

async function _getRow(table, id){
  const {data, error} = await sb.from(table).select('*').eq('id', id).maybeSingle();
  if(error) return null;
  if(table === 'users' && data) return _userFromDB(data);
  return data;
}

async function _upsert(table, id, value){
  let row = typeof value === 'object' ? {...value, id} : {id, value};
  // Convert camelCase to snake_case for users table
  if(table === 'users'){
    row = _userToDB(row);
    // Ensure id is always the Supabase Auth UID (not lost in conversion)
    if(id) row.id = id;
    // Remove uid duplicate — id is the primary key
    // keep uid field for backward compat but id must exist
  }
  // Remove undefined/null keys that might cause upsert issues
  Object.keys(row).forEach(k => { if(row[k] === undefined) delete row[k]; });
  const {error} = await sb.from(table).upsert(row, {onConflict:'id'});
  if(error) return;
}

function _snap(value, path){
  return {
    val: ()=> value,
    exists: ()=> value !== null && value !== undefined,
    child: (c)=> _snap(value?.[c] ?? null, path+'/'+c),
    forEach: (cb)=>{
      if(!value || typeof value !== 'object') return;
      for(const [k,v] of Object.entries(value)) cb({key:k, val:()=>v});
    }
  };
}

const CACHE_TTL_DEFAULT = 5 * 60 * 1000; // 5 minutes default
const CACHE_TTLS = {
  'settings_payout': 30 * 60 * 1000,
  'settings_announcement': 10 * 60 * 1000,
  'walls': 30 * 60 * 1000,
  'leaderboard': 30 * 60 * 1000,
  'socialTasks': 24 * 60 * 60 * 1000,  // social tasks: 24 ঘণ্টা cache
};
const EZCache = {
  _store: {},

  set(key, value, ttl){
    this._store[key] = { value, ts: Date.now(), ttl: ttl||CACHE_TTLS[key]||CACHE_TTL_DEFAULT };
  },

  get(key){
    const item = this._store[key];
    if(!item) return null;
    if(Date.now() - item.ts > item.ttl){
      delete this._store[key];
      return null;
    }
    return item.value;
  },

  invalidate(key){
    delete this._store[key];
  },

  invalidateAll(){
    this._store = {};
  }
};

// Smart read — cache first, Supabase only if expired or forced
async function smartRead(path, forceRefresh=false){
  const cached = EZCache.get(path);
  if(cached && !forceRefresh) return cached;
  const snap = await fDB.ref(path).once('value');
  const val = snap.val();
  EZCache.set(path, val);
  return val;
}

// ─── REALTIME LISTENERS ───────────────────────────────
function setupListeners(uid){
  // Clean old
  S.unsubscribes.forEach(u=>u());
  S.unsubscribes=[];
  // User data — realtime listener but throttled
  const uRef=fDB.ref(`users/${uid}`);
  const unsubUser=uRef.on('value',snap=>{
    const raw = snap.val();
    // ✅ Fix 1: snake_case → camelCase convert করতে হবে
    S.userData = raw ? _userFromDB(raw) : raw;
    EZCache.set(`users/${uid}`, S.userData);
    // ✅ Fix 2: Admin approve হলে user এর completedTasks cache update
    if(S.userData?.completedTasks){
      EZCache.set(`completedTasks_${uid}`, S.userData.completedTasks);
      // Social page খোলা থাকলে auto-reload করো
      if(S.page==='social') loadSocialTasks();
    }
    if(S.userData?.banned){ doLogout(); toast(T('banned'),'e'); return; }
    updateNavBar();
    // Referral count sync — throttled (প্রতি 5 মিনিটে একবার)
    const lastRefCheck = parseInt(localStorage.getItem('ez_ref_check')||'0');
    if(Date.now()-lastRefCheck > 5*60*1000){
      localStorage.setItem('ez_ref_check', Date.now().toString());
      checkActiveReferrals();
    }
  });
  // unsubUser is already a function from our Supabase wrapper
  S.unsubscribes.push(unsubUser);
  // Active referral count update করো
  checkActiveReferrals();
  // Notices — check once, cache for 12h
  loadNoticesCached(uid);
  // প্রতি ২.৫ মিনিট পরপর অটোমেটিক ইন্টারস্টিশিয়াল অ্যাড শুরু (লগআউটে বন্ধ হয়)
  startAutoInterstitialLoop();
}

async function loadNoticesCached(uid){
  const cacheKey = `notices_${uid}`;
  let cached = EZCache.get(cacheKey);
  if(!cached){
    try{
      const snap = await fDB.ref('notices').orderByChild('created_at').limitToLast(20).once('value');
      cached = snap.val()||{};
    }catch(e){ cached={}; }
    EZCache.set(cacheKey, cached);
  }
  const readSnap = S.userData?.readNotices||{};
  const uid2 = S.user?.uid;
  const unread = Object.entries(cached).filter(([id,v])=>{
    if(readSnap[id]) return false; // আগে পড়া হয়েছে
    if(v.target_uid && v.target_uid !== uid2) return false; // অন্য user এর notice
    return true;
  }).map(([id,v])=>({...v,id}));
  if(unread.length>0) activateNoticeDot(unread);
}

function activateNoticeDot(notices){
  const nd=$('.nav-nd'); if(nd) nd.style.display='block';
  S.noticeQueue=notices;
}

function updateNavBar(){
  // শুধু balance text update — render() call নেই (infinite loop এড়াতে)
  const balEl=$('.nav-bal');
  if(balEl && S.userData) balEl.textContent=fmt$(S.userData.usdEarned||0);
  // Notice dot update
  const nd=$('.nav-nd');
  if(nd) nd.style.display=(S.noticeQueue&&S.noticeQueue.length>0)?'block':'none';

  // ── Profile / Home stat cards — live update without full re-render ──
  // Profile page: Total Earned card
  const teEl = document.getElementById('liveStatTotalEarned');
  if(teEl && S.userData) teEl.textContent = fmt$(S.userData.usdEarned||0);
  // Profile page: Today Earned
  const tdEl = document.getElementById('liveStatTodayEarned');
  if(tdEl && S.userData){
    const today = new Date().toDateString();
    const earned = (S.userData.todayDate===today) ? (S.userData.todayEarned||0) : 0;
    tdEl.textContent = fmt$(earned);
  }
  // Home hero balance
  const heroBalEl = document.getElementById('liveHeroBal');
  if(heroBalEl && S.userData) heroBalEl.textContent = fmt$(S.userData.usdEarned||0);
}

async function checkActiveReferrals(){
  if(!S.userData) return;
  const refs=S.userData.pendingReferrals||{};
  const refUids=Object.keys(refs);
  if(!refUids.length) return;
  let active=0;
  for(const uid of refUids){
    // Cache check first — Supabase call শুধু cache miss হলে
    const cacheKey=`ref_active_${uid}`;
    let isActive=EZCache.get(cacheKey);
    if(isActive===null){
      const snap=await fDB.ref(`users/${uid}/adsWatched`).once('value');
      isActive=(snap.val()||0)>0;
      EZCache.set(cacheKey, isActive);
    }
    if(isActive) active++;
  }
  if(active!==(S.userData.activeReferrals||0)){
    await fDB.ref(`users/${S.user.uid}/activeReferrals`).set(active);
  }
}

// ─── MAIN RENDER ──────────────────────────────────────
