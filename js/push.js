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
const FCM_SEND_ENDPOINT = 'PASTE_YOUR_SUPABASE_EDGE_FUNCTION_URL_HERE'; // যেমন: https://xxxxxxxx.supabase.co/functions/v1/send-push
const FCM_ADMIN_SECRET  = 'PASTE_A_LONG_RANDOM_SECRET_HERE';    // supabase/functions/send-push/index.ts এর ADMIN_SECRET Secret-এর সাথে মিলতে হবে

let fcmApp = null, fcmMessaging = null;
const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ── FCM init — app load হলেই চলে ──
(async function initFCM(){
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

      const perm = await PushNotifications.checkPermissions();
      S.pushEnabled = perm.receive === 'granted';
      if(S.pushEnabled) await PushNotifications.register();

      PushNotifications.addListener('registration', async (token)=>{
        S.fcmToken = token.value;
        if(S.user?.uid) await fDB.ref(`users/${S.user.uid}`).update({ fcmToken: token.value });
      });
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
      if(S.pushEnabled){ await PushNotifications.register(); toast(T('pushEnabledMsg'),'s'); render(); }
    } else if('Notification' in window){
      const perm = await Notification.requestPermission();
      S.pushEnabled = perm === 'granted';
      if(S.pushEnabled){
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
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ secret: FCM_ADMIN_SECRET, target:'user', uid:userId, title, body, url: url||location.origin, category })
    });
  }catch(e){}
}

// ── সব subscriber কে notification পাঠানো (Admin panel থেকে, Edge Function target:'all' এ পাঠায়) ──
async function sendPushToAll(title, body, url='', category='general'){
  if(!FCM_SEND_ENDPOINT || FCM_SEND_ENDPOINT.includes('PASTE')){ toast('FCM_SEND_ENDPOINT সেট করুন (README.md দেখুন)','w'); return; }
  try{
    const res = await fetch(FCM_SEND_ENDPOINT,{
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ secret: FCM_ADMIN_SECRET, target:'all', title, body, url: url||location.origin, category })
    });
    const d = await res.json();
    if(d.ok) return { ok:true, recipients: d.recipients||0 };
    return { ok:false, error: d.error||'Unknown error' };
  }catch(e){ return { ok:false, error: e.message }; }
}

// ── App ভেতরেও notification দেখানো (in-app notice + phone push একসাথে) ──
async function sendLocalNotif(title, body){
  if(S.pushEnabled && Notification.permission==='granted'){
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
  const minW = parseFloat(S.siteSettings?.minWithdraw)||10.00;
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
