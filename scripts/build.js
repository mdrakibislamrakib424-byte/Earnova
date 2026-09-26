/**
 * EARNOVA Build Script
 * index.html + style.css + js/ + assets → www/ folder
 *
 * ⚠️ index.html আগে একটাই মনোলিথিক ফাইল ছিল, এখন style.css ও js/*.js
 * ফোল্ডারে ভাগ করা হয়েছে (style, offers, admin ইত্যাদি আলাদা ফাইলে) —
 * তাই এখন সেগুলোও www/ এ কপি করা লাগে, না হলে অ্যাপ ভাঙা দেখাবে।
 *
 * 🆕 JS Minification: production বিল্ডে সব .js ফাইল minify (comment/
 * whitespace বাদ, ভ্যারিয়েবল নাম ছোট) করে www/js/ এ রাখা হয় — App-এর
 * সাইজ কমে, লোড দ্রুত হয়। terser না থাকলে (যেমন লোকাল টেস্টে) build
 * কখনো ভাঙবে না — শুধু raw ফাইল কপি হবে, warning দেখাবে।
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW  = path.join(ROOT, 'www');

// www/ ও www/js/ ফোল্ডার বানাও
if (!fs.existsSync(WWW)) fs.mkdirSync(WWW, { recursive: true });
if (!fs.existsSync(path.join(WWW, 'js'))) fs.mkdirSync(path.join(WWW, 'js'), { recursive: true });

const copies = [
  ['index.html',               'index.html'],
  ['style.css',                'style.css'],
  ['info-pages.css',           'info-pages.css'],
  ['firebase-messaging-sw.js', 'firebase-messaging-sw.js'],
  ['icon.png',                 'icon.png'],
  ['splash.png',               'splash.png'],
  // ── স্ট্যাটিক তথ্য পেজ (Terms/Privacy/About/Contact/Services/Support) ──
  ['terms.html',               'terms.html'],
  ['privacy.html',             'privacy.html'],
  ['about.html',               'about.html'],
  ['contact.html',             'contact.html'],
  ['services.html',            'services.html'],
  ['support.html',             'support.html'],
];

async function main(){
  let built = 0;
  for (const [src, dest] of copies) {
    const srcPath  = path.join(ROOT, src);
    const destPath = path.join(WWW, dest);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✅ ${src} → www/${dest}`);
      built++;
    }
  }


  // ---- Images: root-এর সব ছবি (bkash/nagad/paypal/visa/... ) www/-তে কপি ----
  // আগে শুধু icon.png ও splash.png কপি হতো, তাই পেমেন্ট/সোশ্যাল লোগো APK-তে ছিল না।
  const IMG_EXT = /\.(png|jpe?g|webp|svg|gif)$/i;
  for (const f of fs.readdirSync(ROOT)) {
    if (!IMG_EXT.test(f)) continue;
    fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
    console.log(`   ${f}  www/${f} (image)`);
    built++;
  }
  // ফাইলের নামে বানান ভুল থাকলে (fecbook / instragram) সঠিক নামেও কপি করা হবে
  const IMG_ALIASES = [['fecbook.png','facebook.png'], ['instragram.png','instagram.png']];
  for (const [from, to] of IMG_ALIASES) {
    const fp = path.join(ROOT, from);
    if (fs.existsSync(fp) && !fs.existsSync(path.join(ROOT, to))) {
      fs.copyFileSync(fp, path.join(WWW, to));
      console.log(`   ${from}  www/${to} (alias)`);
    }
  }

  // ── icons/ ফোল্ডার (bottom nav + quick actions কাস্টম আইকন) পুরোপুরি কপি ──
  // আগে এই ফোল্ডারটা মিস হয়ে যেত কারণ উপরের কপি-তালিকা আর ছবি-লুপ দুটোই শুধু
  // ROOT-এ সরাসরি থাকা ফাইল দেখত, সাবফোল্ডারের ভেতরে ঢুকত না।
  const iconsSrc = path.join(ROOT, 'icons');
  const iconsDest = path.join(WWW, 'icons');
  if (fs.existsSync(iconsSrc)) {
    if (!fs.existsSync(iconsDest)) fs.mkdirSync(iconsDest, { recursive: true });
    for (const f of fs.readdirSync(iconsSrc)) {
      const srcPath = path.join(iconsSrc, f);
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, path.join(iconsDest, f));
        console.log(`   icons/${f}  www/icons/${f}`);
        built++;
      }
    }
  } else {
    console.log('  ℹ️ icons/ ফোল্ডার পাওয়া যায়নি — কাস্টম nav/quick-action আইকন থাকলে সেগুলো এখনো emoji fallback দেখাবে।');
  }

  // ── js/ ফোল্ডারের সব .js ফাইল minify করে কপি করা (terser থাকলে) ──
  let terser = null;
  try { terser = require('terser'); }
  catch(e) { console.log('  ⚠️ terser পাওয়া যায়নি — raw (unminified) JS কপি হচ্ছে (build ভাঙবে না)'); }

  const jsDir = path.join(ROOT, 'js');
  if (fs.existsSync(jsDir)) {
    const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
      const srcPath  = path.join(jsDir, file);
      const destPath = path.join(WWW, 'js', file);
      const code = fs.readFileSync(srcPath, 'utf8');

      if (terser) {
        try {
          const result = await terser.minify(code, {
            compress: { drop_console: false }, // console.log রাখা হয়েছে, debug এর সুবিধার জন্য
            mangle: true,
          });
          if (result.error) throw result.error;
          fs.writeFileSync(destPath, result.code, 'utf8');
          const before = (code.length/1024).toFixed(1), after = (result.code.length/1024).toFixed(1);
          console.log(`  ✅ js/${file} → www/js/${file} (minified: ${before}KB → ${after}KB)`);
        } catch(e) {
          // minify করতে গিয়ে কোনো কারণে fail করলেও raw ফাইল কপি করে দাও —
          // App যেন কখনো ভাঙা অবস্থায় বিল্ড না হয়
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ⚠️ js/${file} minify failed (raw কপি হলো): ${e.message||e}`);
        }
      } else {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✅ js/${file} → www/js/${file} (raw)`);
      }
      built++;
    }
  } else {
    console.log('  ⚠️ js/ ফোল্ডার পাওয়া যায়নি!');
  }

  console.log(`\n🚀 Build complete — ${built} files in www/`);
}

main();

