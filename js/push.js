// ── FIREBASE CLOUD MESSAGING (FCM) PUSH NOTIFICATION SYSTEM ──────────────
// ⚠️ Firebase Console → Project settings → General → "Your apps" → Web app থেকে config নিন
// এবং Cloud Messaging ট্যাব থেকে VAPID key (Web Push certificate) নিন
const FCM_CONFIG = {
  apiKey: 'AIzaSyAd4bVUjuvIC7P30og4UckLbCcCNB0VuR8',
  authDomain: 'earnova-9cf91.firebaseapp.com',
  projectId: 'earnova-9cf91',
  storageBucket: 'earnova-9cf91.firebasestorage.app',
  messagingSenderId: '1040669106457',
  appId: '1:1040669106457:web:7c8553740da017c0b2e588',
};
const FCM_VAPID_KEY = 'BCBwqJ4IXFjy3BzgP_dhjDnTvgIYLthf4CrQBHvf0omGj7EkoSTTQROjo8ELYGc_8JQyko61ejwVZhtqYxEvCAo';

// Admin push পাঠানো হয় নিজের FCM REST key দিয়ে সরাসরি ব্রাউজার থেকে সম্ভব না
// (FCM v1 API-তে OAuth লাগে), তাই একটা ছোট Edge Function endpoint ব্যবহার করা হয়েছে।
// এই ফাংশনটা supabase/functions/send-push/index.ts এ আছে, deploy করে এখানে URL বসান
// (বিস্তারিত ধাপ: supabase/PUSH_SETUP.md)।
const FCM_SEND_ENDPOINT = 'https://oazyvgjixljdnjhorasa.supabase.co/functions/v1/send-push'; // যেমন: https://xxxxxxxx.supabase.co/functions/v1/send-push
// ⚠️ আগে এখানে একটা গোপন পাসওয়ার্ড (FCM_ADMIN_SECRET) ছিল — সেটা অ্যাপে রাখা নিরাপদ না।
// এখন সার্ভার লগইন-করা ইউজারের টোকেন দেখে চেনে: admin হলে সবাইকে, সাধারণ ইউজার হলে শুধু নিজেকে push পাঠাতে পারে।
async function _fcmHeaders(){
  const {data} = await sb.auth.getSession();
  const tok = data?.session?.access_token || '';
  return { 'Content-Type':'application/json', 'Authorization':'Bearer '+tok };
}

let fcmApp = null, fcmMessaging = null;
const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ── FCM init — app load হলেই চলে ──
const _pushInitDone = (async function initFCM(){
  try{
    if(isNativeApp && window.Capacitor?.Plugins?.PushNotifications){
      // নেটিভ Android APK — Capacitor PushNotifications প্লাগিন (আসল native FCM)
      const { PushNotifications } = window.Capacitor.Plugins;

      // ── Notification Channels (Android 8+) ──
      // এটা তৈরি না করলে সব push একটাই ডিফল্ট চ্যানেলে যায় — ইউজার তখন
      // চাইলেও নির্দিষ্ট ধরনের notification (যেমন শুধু balance আপডেট)
      // বন্ধ/চালু করতে পারে না, ফোনের Settings-এ গিয়ে হয় সব বন্ধ নয়তো
      // সব চালু রাখতে হয়। এখন প্রতিটা ক্যাটাগরির জন্য আলাদা চ্যানেল থাকায়
      // ইউজার ফোনের Settings → Apps → EARNOVA → Notifications থেকেই
      // নির্দিষ্ট ক্যাটাগরি বন্ধ করতে পারবে।
      try{
        await PushNotifications.createChannel({ id:'balance', name:'Balance & Withdrawal Updates', description:'উইথড্র স্ট্যাটাস ও ব্যালেন্স আপডেট', importance:4, visibility:1 });
        await PushNotifications.createChannel({ id:'offers',  name:'New Offers & Tasks',            description:'নতুন অফার ও টাস্কের নোটিফিকেশন',    importance:3, visibility:1 });
        await PushNotifications.createChannel({ id:'general', name:'General Announcements',          description:'সাধারণ ঘোষণা ও আপডেট',              importance:3, visibility:1 });
      }catch(e){ console.warn('Channel creation failed (Android 8+ এ কাজ করে)', e); }

      // listener আগে বসানো হয় — লগইনের আগে টোকেন এলেও S.fcmToken এ জমা থাকে,
      // লগইনের পর ezSaveFcmToken() সেটা ডাটাবেসে সেভ করে (আগে এখানে টোকেন হারিয়ে যেত)
      PushNotifications.addListener('registration', async (token)=>{
        S.fcmToken = token.value;
        await ezSaveFcmToken();
      });
      PushNotifications.addListener('registrationError', (e)=>{ console.warn('FCM registrationError', e); });

      const perm = await PushNotifications.checkPermissions();
      S.pushEnabled = perm.receive === 'granted';
      if(S.pushEnabled) await PushNotifications.register();
      PushNotifications.addListener('pushNotificationReceived', (n)=>{
        toast(`🔔 ${n.title||''}`, 's', 4000);
      });
      render();
    } else if('Notification' in window && window.firebase){
      // ব্রাউজার/PWA — Firebase Web Messaging SDK
      // ⚠️ analytics.js আগেই app initialize করে থাকতে পারে, তাই আগে চেক করা হচ্ছে
      fcmApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(FCM_CONFIG);
      fcmMessaging = firebase.messaging();
      S.pushEnabled = Notification.permission === 'granted';
      if(S.pushEnabled) await registerFcmWebToken();
      fcmMessaging.onMessage((payload)=>{
        const title = payload.notification?.title || 'EARNOVA';
        const body  = payload.notification?.body  || '';
        toast(`🔔 ${title}`, 's', 4000);
        if(Notification.permission==='granted') new Notification(title, { body, icon:'/icon.png' });
      });
      render();
    }
  }catch(e){ console.warn('FCM init failed', e); }
})();

// ── টোকেন ডাটাবেসে সেভ (শুধু বদলালে) ──
async function ezSaveFcmToken(){
  try{
    const uid = S.user?.uid, tok = S.fcmToken;
    if(!uid || !tok) return;
    if(S.userData && S.userData.fcmToken === tok) return;
    const { error } = await sb.from('users').update({ fcm_token: tok }).eq('id', uid);
    if(!error && S.userData) S.userData.fcmToken = tok;
  }catch(e){ console.warn('FCM token save failed', e); }
}

// ── লগইনের পর একবার চলে: আগে নোটিফিকেশন পারমিশন নেয় (একবারই), তারপর টোকেন সেভ করে ──
// অ্যাপ খোলার সময় (লগইন করা থাকলেও) চলে → পারমিশন দেওয়া থাকলে টোকেন চুপচাপ নতুন হয়।
let _pushSetupUid = null;
async function ezSetupPush(){
  try{
    const uid = S.user?.uid;
    if(!uid || _pushSetupUid === uid) return;
    _pushSetupUid = uid;
    try{ await _pushInitDone; }catch(e){}

    if(isNativeApp && window.Capacitor?.Plugins?.PushNotifications){
      const { PushNotifications } = window.Capacitor.Plugins;
      let perm = await PushNotifications.checkPermissions();
      let st = perm.receive;
      const askKey = 'ez_push_asked_' + uid;
      let asked = false; try{ asked = !!localStorage.getItem(askKey); }catch(e){}

      // কখনো জিজ্ঞেস করা হয়নি → এখনই একবার পারমিশন চাই (টিউটোরিয়ালের আগে)
      if(st !== 'granted' && st !== 'denied' && !asked){
        try{ localStorage.setItem(askKey, '1'); }catch(e){}
        try{ perm = await PushNotifications.requestPermissions(); st = perm.receive; }catch(e){}
      }
      S.pushEnabled = st === 'granted';
      S.pushNeedsHelp = !S.pushEnabled;   // ব্যানার শুধু তাদের জন্য যারা Allow দেয়নি
      if(S.pushEnabled){
        await PushNotifications.register();   // 'registration' event → টোকেন সেভ
        await ezSaveFcmToken();
      }
    } else if('Notification' in window){
      // ব্রাউজার/PWA: ব্রাউজার user-click ছাড়া পারমিশন চাইতে দেয় না → ব্যানার থাকবে
      S.pushEnabled = Notification.permission === 'granted';
      S.pushNeedsHelp = !S.pushEnabled;
      if(S.pushEnabled && fcmMessaging) await registerFcmWebToken();
    }
    render();
  }catch(e){ console.warn('ezSetupPush failed', e); }
}

// ── লগআউটের সময়: এই ডিভাইসের টোকেন ইউজারের রো থেকে সরানো (অন্য অ্যাকাউন্টে লগইন করলে পুরোনো অ্যাকাউন্ট রিমাইন্ডার পাবে না) ──
async function ezOnLogoutPush(uid){
  _pushSetupUid = null;
  S.pushNeedsHelp = false;
  try{
    if(uid) await sb.from('users').update({ fcm_token: '' }).eq('id', uid);
    S.fcmToken = '';
  }catch(e){}
}

async function registerFcmWebToken(){
  try{
    const token = await fcmMessaging.getToken({ vapidKey: FCM_VAPID_KEY });
    if(token){
      S.fcmToken = token;
      if(S.user?.uid) await fDB.ref(`users/${S.user.uid}`).update({ fcmToken: token });
    }
  }catch(e){ console.warn('FCM token error', e); }
}

// ── Push চালু করার ফাংশন (banner ক্লিক → prompt) ──
async function enablePush(){
  try{
    if(isNativeApp && window.Capacitor?.Plugins?.PushNotifications){
      const { PushNotifications } = window.Capacitor.Plugins;
      const perm = await PushNotifications.requestPermissions();
      S.pushEnabled = perm.receive === 'granted';
      if(S.pushEnabled){
        S.pushNeedsHelp = false;
        await PushNotifications.register(); await ezSaveFcmToken();
        toast(T('pushEnabledMsg'),'s'); render();
      } else {
        // আগে Deny করা থাকলে Android আর পপআপ দেখায় না — ফোনের সেটিং থেকে চালু করতে হবে
        toast(S.lang==='bn'
          ? 'ফোনের Settings → Apps → EARNOVA → Notifications থেকে চালু করুন'
          : 'Turn on from phone Settings → Apps → EARNOVA → Notifications','w',6000);
      }
    } else if('Notification' in window){
      const perm = await Notification.requestPermission();
      S.pushEnabled = perm === 'granted';
      if(S.pushEnabled){
        S.pushNeedsHelp = false;
        if(!fcmMessaging){ fcmApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(FCM_CONFIG); fcmMessaging = firebase.messaging(); }
        await registerFcmWebToken();
        toast(T('pushEnabledMsg'),'s'); render();
      }
    } else { toast(T('pushSdkNotLoaded'),'w'); }
  }catch(e){ toast(T('pushEnableErrorMsg'),'w'); }
}

// ── একজন specific user কে notification পাঠানো (Supabase Edge Function এর মাধ্যমে) ──
// category: 'balance' | 'offers' | 'general' — Notification Channel ও ইউজারের
// notification preference (chalu/bondho) দুটোই এই category অনুযায়ী চেক হয়
async function sendPushToUser(userId, title, body, url='', category='general'){
  if(!FCM_SEND_ENDPOINT || FCM_SEND_ENDPOINT.includes('PASTE')) return;
  try{
    await fetch(FCM_SEND_ENDPOINT,{
      method:'POST',
      headers: await _fcmHeaders(),
      body: JSON.stringify({ target:'user', uid:userId, title, body, url: url||location.origin, category })
    });
  }catch(e){}
}

// ── সব subscriber কে notification পাঠানো (Admin panel থেকে, Edge Function target:'all' এ পাঠায়) ──
async function sendPushToAll(title, body, url='', category='general'){
  if(!FCM_SEND_ENDPOINT || FCM_SEND_ENDPOINT.includes('PASTE')){ toast('FCM_SEND_ENDPOINT সেট করুন (README.md দেখুন)','w'); return; }
  try{
    const res = await fetch(FCM_SEND_ENDPOINT,{
      method:'POST',
      headers: await _fcmHeaders(),
      body: JSON.stringify({ target:'all', title, body, url: url||location.origin, category })
    });
    const d = await res.json();
    if(d.ok) return { ok:true, recipients: d.recipients||0 };
    return { ok:false, error: d.error||'Unknown error' };
  }catch(e){ return { ok:false, error: e.message }; }
}

// ── App ভেতরেও notification দেখানো (in-app notice + phone push একসাথে) ──
async function sendLocalNotif(title, body){
  if(S.pushEnabled && typeof Notification!=='undefined' && Notification.permission==='granted'){
    new Notification(title,{ body, icon:'/icon.png' });
  }
}

// ── Balance চেক করে automatic notification (app খুললে) ──
async function checkBalanceNotification(){
  const uid = S.user?.uid;
  if(!uid || !S.pushEnabled) return;
  const lastKey = `ez_bal_notif_${uid}`;
  const lastSent = parseInt(localStorage.getItem(lastKey)||'0');
  if(Date.now() - lastSent < 8*60*60*1000) return; // দিনে সর্বোচ্চ ৩ বার
  const bal = S.userData?.usdEarned||0;
  const minW = parseFloat(CFG.minUSD)||12;
  let title='', body='';
  if(bal >= minW){
    title = T('withdrawalReadyTitle');
    body  = T('balanceReminderBody1').replace('${bal}','$'+bal.toFixed(2));
  } else if(bal > 0){
    const need = (minW - bal).toFixed(2);
    title = T('balanceReminderTitle');
    body  = T('balanceReminderBody2').replace('${bal}','$'+bal.toFixed(2)).replace('${need}','$'+need);
  } else { return; }
  await sendPushToUser(uid, title, body, '', 'balance');
  localStorage.setItem(lastKey, Date.now().toString());
}
