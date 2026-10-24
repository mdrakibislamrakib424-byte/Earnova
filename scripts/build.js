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
const IS_CI = !!process.env.CI;          // GitHub Actions এ CI=true থাকে

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

// ── তৃতীয়-পক্ষ লাইব্রেরি রান-টাইমে CDN থেকে না এনে npm থেকে নিয়ে অ্যাপের ভেতরেই রাখা ──
// কেন: CDN হ্যাক/বদল হলে ইউজারের ফোনে কোড চলে যেত। এখন ঠিক-করা সংস্করণ (package.json) APK-তেই থাকে।
// npm এ ফাইল না পেলে index.html এর (version-pinned) CDN ট্যাগই থাকে — অ্যাপ ভাঙে না, শুধু warning।
const VENDOR = [
  { cdn: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
    candidates: ['@supabase/supabase-js/dist/umd/supabase.js'], dest: 'vendor/supabase.js' },
  { cdn: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
    candidates: ['chart.js/dist/chart.umd.min.js', 'chart.js/dist/chart.umd.js'], dest: 'vendor/chart.umd.js' },
];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function vendorLibs() {
  const htmlPath = path.join(WWW, 'index.html');
  if (!fs.existsSync(htmlPath)) return;
  let html = fs.readFileSync(htmlPath, 'utf8');
  fs.mkdirSync(path.join(WWW, 'vendor'), { recursive: true });
  for (const v of VENDOR) {
    const found = v.candidates.map(c => path.join(ROOT, 'node_modules', c)).find(p => fs.existsSync(p));
    if (!found) { console.log(`  ⚠️ ${v.dest}: node_modules এ পাওয়া যায়নি — CDN (pinned) ব্যবহার হবে`); continue; }
    const tag = new RegExp('<script[^>]*src="' + escapeRe(v.cdn) + '"[^>]*></script>');
    if (!tag.test(html)) { console.log(`  ⚠️ ${v.dest}: index.html এ মিলে যাওয়া <script> ট্যাগ নেই — স্কিপ`); continue; }
    fs.copyFileSync(found, path.join(WWW, v.dest));
    html = html.replace(tag, `<script src="${v.dest}"></script>`);
    console.log(`  ✅ ${v.dest} (npm থেকে, CDN নয়)`);
  }
  fs.writeFileSync(htmlPath, html, 'utf8');
}

// ── শেষ নিরাপত্তা জাল: গোপন কিছু যেন APK-তে না ঢোকে ──
function scanForSecrets(dir) {
  const bad = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'vendor') walk(p); continue; }
      if (/serviceaccount|\.keystore$|\.jks$|\.pem$|\.p12$|\.pfx$|google-services\.json$|^\.env/i.test(e.name)) { bad.push(p + '  (গোপন ফাইলের নাম)'); continue; }
      if (/\.(js|html|json|css|txt|md|xml)$/i.test(e.name)) {
        const t = fs.readFileSync(p, 'utf8');
        if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t) || /"private_key"\s*:/.test(t)) bad.push(p + '  (private key পাওয়া গেছে)');
      }
    }
  };
  walk(dir);
  if (bad.length) {
    console.error('\n❌ BUILD বন্ধ: www/ এর ভেতরে গোপন তথ্য পাওয়া গেছে:\n  ' + bad.join('\n  '));
    process.exit(1);
  }
  console.log('  🔒 secret scan: www/ পরিষ্কার');
}

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


  // ── CDN লাইব্রেরি → www/vendor/ (npm থেকে) ──
  vendorLibs();

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
  catch(e) {
    if (IS_CI) { console.error('❌ CI বিল্ডে terser পাওয়া যায়নি — npm install ঠিকমতো হয়নি'); process.exit(1); }
    console.log('  ⚠️ terser পাওয়া যায়নি — raw (unminified) JS কপি হচ্ছে (লোকাল টেস্টে ঠিক আছে)');
  }

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
            compress: { drop_console: ['log', 'debug', 'info'] }, // debug লগ APK থেকে বাদ (warn/error থাকে)
            mangle: true,
          });
          if (result.error) throw result.error;
          fs.writeFileSync(destPath, result.code, 'utf8');
          const before = (code.length/1024).toFixed(1), after = (result.code.length/1024).toFixed(1);
          console.log(`  ✅ js/${file} → www/js/${file} (minified: ${before}KB → ${after}KB)`);
        } catch(e) {
          // CI তে minify fail মানে JS-এ সিনট্যাক্স ভুল আছে — চুপচাপ raw কপি না করে বিল্ড বন্ধ
          if (IS_CI) { console.error(`❌ js/${file} minify failed: ${e.message||e}`); process.exit(1); }
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ⚠️ js/${file} minify failed (raw কপি হলো, শুধু লোকাল): ${e.message||e}`);
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

  scanForSecrets(WWW);
  console.log(`\n🚀 Build complete — ${built} files in www/`);
}

main();

