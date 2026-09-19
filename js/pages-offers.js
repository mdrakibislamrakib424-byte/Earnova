// ── OFFERWALL PAGE — 4 ads unlock (পুরো পেজ একসাথে, কার্ড আলাদা না) + HTML page link ──────
async function checkOfferwallUnlock(){
  return checkWallUnlock('offerwall');
}

function buildOfferwallPage(){
  // ── শুধু যেসব wall-এ কোডে iframe link বসানো আছে, সেগুলোই দেখাবে — কোনো DB call ছাড়া ──
  const activeWalls = CFG.walls.filter(w => (CFG.wallLinks[w.id]||'').trim() !== '');

  if(!activeWalls.length){
    return `<div class="ph">
      <div class="pt">${T('offerWallTitle')}</div>
      <div class="ps">${T('offerWallSub')}</div>
    </div>
    <div class="empty" style="padding:50px 20px">
      <div class="ein">🔗</div>
      <div class="etx">${T('offerwallNotSet')}</div>
    </div>`;
  }

  return `<div class="ph">
    <div class="pt">${T('offerWallTitle')}</div>
    <div class="ps">${T('offerWallSub')}</div>
  </div>
  <div id="wallCardsGrid">${buildQsCardsAll(activeWalls)}</div>`;
}

async function initOfferwallPage(){
  const grid = document.getElementById('wallCardsGrid');
  if(!grid) return; // কোনো wall configured না থাকলে grid থাকবে না

  // ── পুরো Wall ট্যাবের জন্য একবারই unlock check — DB call মোটে ১টা ──
  const unlockSt = await checkWallUnlock('offerwall');

  // সব কার্ডের status একইসাথে আপডেট করো (per-card আলাদা DB call নেই)
  $$('.ofc').forEach(card=>{
    const wid = card.dataset.gotoWall;
    const statusEl = document.getElementById('wc-status-'+wid);
    if(!statusEl) return;
    if(unlockSt.locked){
      statusEl.innerHTML = '🔒 '+T('lockedWord');
    }else{
      statusEl.innerHTML = '✅ '+T('unlockedWord');
      statusEl.style.background = 'rgba(16,185,129,.35)';
    }
  });
  // কার্ডে ক্লিক হ্যান্ডলিং global [data-goto-wall] হ্যান্ডলার (openWall()) নিজেই করে —
  // এখানে আলাদা করে বসানোর দরকার নেই (double-click bug এড়াতে)
}

// ── একটা নির্দিষ্ট wall-এর iframe দেখানোর পেজ — সম্পূর্ণ কোড-ভিত্তিক, DB call নেই ──
function buildWallFramePage(){
  const wid = S.activeWallId;
  const w = CFG.walls.find(x=>x.id===wid) || {};
  const rawLink = CFG.wallLinks[wid] || '';
  // ── ইউজারের নিজের ID subid হিসেবে link-এর সাথে যোগ করা হয় ──
  // (এটা ছাড়া CPAGrip/CPAlead/OGAds ইত্যাদি নেটওয়ার্ক জানতে পারবে না
  //  কে অফার সম্পন্ন করেছে, তাই কাউকে টাকা credit করা যাবে না)
  const uid = S.user?.uid || 'guest';
  const subidParam = CFG.wallSubidParam[wid] || 'subid';
  const link = rawLink ? (rawLink + (rawLink.includes('?') ? '&' : '?') + subidParam + '=' + encodeURIComponent(uid)) : '';
  const gm = WALL_GRADIENTS[w.color] || WALL_GRADIENTS['#2563eb'];
  return `<div class="ph">
    <button class="btn bh bau bsm mb12" data-page="offerwall">← ${T('back')}</button>
    <div class="pt">${w.icon||'🌐'} ${w.name||'Offerwall'}</div>
    <div class="ps">${T('offerWallSub')}</div>
  </div>
  ${link?`
  <div style="margin:0 16px 16px;background:${gm.grad};border-radius:20px;padding:28px 20px;text-align:center;box-shadow:0 8px 24px ${gm.shadow}">
    <div style="font-size:46px;margin-bottom:12px">${w.icon||'🌐'}</div>
    <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:6px">${w.name||'Offerwall'}</div>
    <div style="font-size:12px;color:rgba(255,255,255,.8);margin-bottom:20px">${T('earnUpToLabel')} <strong>$${(S.countryEarn||0.30).toFixed(2)}</strong> ${T('perCompletedOfferLabel')}</div>
    <a href="${link}" onclick="openLink('${link}');return false;"
      style="display:inline-flex;align-items:center;gap:8px;background:#fff;color:#0f172a;border-radius:14px;padding:14px 28px;font-size:14px;font-weight:800;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.15)">
      ${T('openFullBtn')}
    </a>
  </div>
  <div style="margin:0 16px 16px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:14px 16px">
    <div style="font-size:12px;color:#1e40af;line-height:1.7">ℹ️ ${T('openWallInfoNote')}</div>
  </div>`:`<div class="empty" style="padding:50px 20px"><div class="ein">🔗</div><div class="etx">${T('offerwallNotSet')}</div></div>`}`;
}
function buildOffers(){
  return `<div class="ph"><div class="pt">${T('of')}</div>
  <div class="ps">${T('freshOffersLabel')} · ${S.country||'Detecting…'}</div></div>

  <div class="uof-hero">
    <div class="uof-hero-glow"></div>
    <div class="uof-hero-row">
      <div>
        <div class="uof-hero-lbl">${T('liveOffersLabel')}</div>
        <div class="uof-hero-val" id="offersStatTotal">…</div>
      </div>
      <button class="uof-refresh" id="offersRefreshBtn" title="${T('refreshTitle')}">🔄</button>
    </div>
    <div class="uof-hero-sub">${T('earnUpToLabel')} <b>${fmt$((S.payoutRates&&S.payoutRates.hi)||0.50)}</b> ${T('perCompletedOfferLabel')}</div>
  </div>

  <div class="uof-search-wrap">
    <span class="uof-search-ic">🔍</span>
    <input class="uof-search" id="offersSearchInput" type="text" placeholder="${T('searchOffersPlaceholder')}" autocomplete="off">
  </div>

  <div id="offersFeed" class="uof-list">
    <div class="uof-skel"></div>
    <div class="uof-skel"></div>
    <div class="uof-skel"></div>
  </div>`;
}


async function updateWallStatuses(){
  for(const w of CFG.walls){
    const el=document.getElementById(`wstatus-${w.id}`);
    if(!el) continue;
    const st=await checkWallUnlock(w.id);
    if(!st.locked){
      el.className='bdg bdg2';
      el.textContent=T('ulk');
    } else {
      el.className='bdg bdy';
      el.textContent=T('lk');
    }
  }
}

// ─── UNLOCK PAGE ──────────────────────────────────────
function buildUnlock(wallId){
  const isAllOffers = wallId==='alloffers';
  const isOfferwall = wallId==='offerwall';
  const w = (isAllOffers||isOfferwall)
    ? { icon:'🌐', name: isOfferwall ? T('offerWallTitle').replace('🌐 ','') : 'All Offers' }
    : (S.wallData[wallId]||CFG.walls.find(x=>x.id===wallId)||{});
  return `<div class="ph">
    <button class="btn bh bau bsm mb12" data-page="${isOfferwall?'offerwall':'offers'}">← ${T('back')}</button>
    <div class="pt">${w.icon||'🎯'} ${isAllOffers?T('unlockAllTitle'):isOfferwall?T('unlockWallTitle'):(w.name||wallId)}</div>
    <div class="ps">${(isAllOffers||isOfferwall)?T('watch5AdsDesc'):T('unlockDesc')}</div>
  </div>
  <div class="card" id="unlockCard">
    <div class="tc mu sm">${T('adProgress')}</div>
    <div class="udc" id="udots">${Array(CFG.adsPerWall).fill(0).map((_,i)=>`<div class="ud pn" id="ud${i}">${i+1}</div>`).join('')}</div>
    <div style="margin-bottom:16px">
      <div class="dfb sm mu mb8"><span id="ulkProgLb">0 / ${CFG.adsPerWall} ${T('of5')}</span><span id="ulkExpire"></span></div>
      <div class="prb"><div class="prf" id="ulkBar" style="width:0%"></div></div>
    </div>
    <button class="btn big-ad" id="watchAdBtn">${T('wa')}</button>
    <div style="margin-top:12px;font-size:12px;color:#475569;text-align:center">${T('warnIframe')}</div>
  </div>
  <div class="card mt12">
    <div class="card-hd">${T('unlockHowWorks')}</div>
    <div style="font-size:13px;color:#64748b;line-height:1.8">
      1. ${T('unlockStep1')}<br>
      2. ${T('unlockStep2')}<br>
      3. ${T('unlockStep3')}<br>
      4. ${T('unlockStep4')}<br>
      5. ${T('unlockStep5')}
    </div>
  </div>`;
}

// ── ফিক্স: Ad শেষে DB write করার পরপরই fresh read করলে মাঝেমধ্যে write
//    পুরোপুরি sync হওয়ার আগেই read হয়ে যায়, ফলে box পূরণ দেখায় না।
//    এখানে re-fetch এর অপেক্ষা না করে, যে count/state এইমাত্র সেভ করা হলো
//    সেটা দিয়েই সরাসরি DOM আপডেট করা হচ্ছে — তাই box সবসময় নির্ভরযোগ্যভাবে
//    সাথে সাথে পূরণ হয়ে দেখাবে।
function applyUnlockUI(wallId, count, locked, remaining){
  if(S.page!=='unlock' || S.unlockWallId!==wallId) return;
  for(let i=0;i<CFG.adsPerWall;i++){
    const d=$(`#ud${i}`);
    if(d){ if(!locked || i<count){ d.className='ud dn'; d.textContent='✓'; } else { d.className='ud pn'; d.textContent=i+1; } }
  }
  const bar=$('#ulkBar'); if(bar){ bar.style.width=(locked?(count/CFG.adsPerWall)*100:100)+'%'; }
  const lb=$('#ulkProgLb');
  if(locked && lb) lb.textContent=`${count} / ${CFG.adsPerWall} ${T('of5')}`;
  if(!locked && lb) lb.textContent=`✅ ${T('ulk')}`;
  const exp=$('#ulkExpire');
  if(!locked && exp && remaining) exp.textContent=`${T('exp')}: ${msToHM(remaining)}`;
  const btn=$('#watchAdBtn');
  if(!locked && btn){
    const isAllOffers = wallId==='alloffers';
    const isOfferwall = wallId==='offerwall';
    btn.textContent=T('ofl');
    btn.className='btn bg';
    btn.onclick=()=>{
      if(isAllOffers){ S.page='offers'; render(); }
      else if(isOfferwall){ S.page='offerwall'; render(); }
      else { S.page='wallview'; render(); }
    };
  }
}

async function updateUnlockUI(wallId){
  const st=await checkWallUnlock(wallId);
  const count=st.count||0;
  const locked=st.locked;
  // Dots
  for(let i=0;i<CFG.adsPerWall;i++){
    const d=$(`#ud${i}`);
    if(d){ if(!locked || i<count){ d.className='ud dn'; d.textContent='✓'; } else { d.className='ud pn'; d.textContent=i+1; } }
  }
  // Bar
  const bar=$('#ulkBar'); if(bar){ bar.style.width=(locked?(count/CFG.adsPerWall)*100:100)+'%'; }
  const lb=$('#ulkProgLb');
  if(locked && lb) lb.textContent=`${count} / ${CFG.adsPerWall} ${T('of5')}`;
  if(!locked && lb) lb.textContent=`✅ ${T('ulk')}`;
  const exp=$('#ulkExpire');
  if(!locked && exp && st.remaining) exp.textContent=`${T('exp')}: ${msToHM(st.remaining)}`;
  // Button
  const btn=$('#watchAdBtn');
  if(!locked){
    const isAllOffers = wallId==='alloffers';
    const isOfferwall = wallId==='offerwall';
    if(btn){
      btn.textContent=T('ofl');
      btn.className='btn bg';
      btn.onclick=()=>{
        if(isAllOffers){ S.page='offers'; render(); }
        else if(isOfferwall){ S.page='offerwall'; render(); }
        else { S.page='wallview'; render(); }
      };
    }
  }
}

// ─── WALL VIEW PAGE ───────────────────────────────────
function buildWallView(wallId){
  const w=S.wallData[wallId]||{};
  const uid=S.user?.uid||'';
  const link=w.link||'';
  const useRSS=w.useRSS===true; // Admin RSS toggle করতে পারবে
  return `<div class="ph">
    <button class="btn bh bau bsm mb12" data-page="offers">← ${T('back')}</button>
    <div class="pt">${w.icon||'🎯'} ${w.name||wallId}</div>
    <div class="ps">${T('ulk')} ✅ · ${S.country||''} · $${getUserPayout(0).toFixed(2)}/offer</div>
    ${(()=>{const m=w.embedMode||'iframe';const pid=w.rssPlatform||'cpagrip';const p=RSS_PLATFORMS[pid];if(m==='rss'&&p)return`<div style="display:inline-flex;align-items:center;gap:5px;background:${p.color}15;border:1px solid ${p.color}30;border-radius:8px;padding:3px 10px;font-size:11px;font-weight:600;color:${p.color};margin-top:4px">${p.icon} ${p.name} RSS</div>`;if(m==='script')return`<div style="display:inline-flex;align-items:center;gap:5px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:3px 10px;font-size:11px;font-weight:600;color:#15803d;margin-top:4px">${T('scriptTagActive')}</div>`;return'';})()}
  </div>

  ${(()=>{
    // Script tag mode — inject script with uid replaced
    const embedMode=w.embedMode||'iframe';
    if(embedMode==='script' && w.scriptCode){
      const injected=w.scriptCode.replace(/\{uid\}/g, uid);
      return `<div class="card mb12">
        <div class="card-hd">${T('scriptTagActive')}</div>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:9px;padding:10px 13px;font-size:12px;color:#15803d;margin-bottom:12px">
          ${T('scriptRunningMsg')}
        </div>
        <div id="scriptInjectZone"></div>
      </div>`;
    }
    return '';
  })()}

  ${w.embedMode==='script'?'':(useRSS?`
  <!-- RSS FEED OFFERS -->
  <div class="card mb12">
    <div class="card-hd" style="justify-content:space-between">
      <span>${T('availableOffersLabel')}</span>
      <button class="btn bp bau bsm" id="rssRefresh">${T('refreshBtnFull')}</button>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 13px;font-size:12px;color:#1e40af;margin-bottom:12px">
      ${T('youEarnPrefix')} <strong>$${getUserPayout(0).toFixed(2)}</strong> ${T('perCompletedOfferLabel')}
    </div>
    <div id="rssContainer">
      <div class="empty"><div style="animation:spin 1s linear infinite;display:inline-block;font-size:28px">⏳</div><div class="etx mt8">${T('loadingOffersMsg')}</div></div>
    </div>
  </div>`:`
  <!-- IFRAME / LINK MODE -->
  ${link?`
  <div class="card mb12">
    <button class="btn bp mb8" onclick="openLink('${link}')">${T('ofl')} ↗</button>
    <div style="font-size:12px;color:#64748b;text-align:center;margin-top:4px">${T('warnIframe')}</div>
  </div>
  <div style="border:1.5px solid #dbeafe;border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 12px rgba(37,99,235,.07)">
    <div style="background:#eff6ff;padding:9px 13px;font-size:11px;color:#2563eb;display:flex;align-items:center;gap:7px;border-bottom:1px solid #dbeafe">
      <div style="display:flex;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:#ef4444"></div><div style="width:8px;height:8px;border-radius:50%;background:#f59e0b"></div><div style="width:8px;height:8px;border-radius:50%;background:#22c55e"></div></div>
      <span style="font-weight:600">${w.name||wallId}</span>
    </div>
    <iframe src="${link}" style="width:100%;height:520px;display:block;border:none" scrolling="yes" loading="lazy"></iframe>
  </div>`:`<div class="card mb12"><div class="empty"><div class="ein">🔗</div><div class="etx">${T('nln')}</div></div></div>`}
  `)}
`}

// RSS Container render
function renderRSSOffers(wallId){
  const c=$('#rssContainer'); if(!c) return;
  const offers=S.rssOffers;
  if(!offers.length||S.rssLoading){
    c.innerHTML=`<div class="empty"><div style="animation:spin 1s linear infinite;display:inline-block;font-size:28px">⏳</div><div class="etx mt8">${T('loadingOffersMsg')}</div></div>`;
    return;
  }
  if(offers[0]?.error){
    c.innerHTML=`<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:13px;font-size:13px;color:#dc2626">⚠️ ${offers[0].msg}</div>`;
    return;
  }
  if(offers[0]?.empty){
    const pn=offers[0].platform||'Platform';
    c.innerHTML=`<div class="empty"><div class="ein">📭</div><div class="etx">${T('noOffersFromPlatformMsg').replace('{platform}',pn)}</div></div>`;
    return;
  }
  c.innerHTML=offers.map((o,i)=>`
  <div style="background:#fff;border:1.5px solid #dbeafe;border-radius:13px;padding:13px;margin-bottom:9px;display:flex;gap:12px;align-items:flex-start;cursor:pointer;transition:all .18s" 
    onmouseover="this.style.borderColor='#93c5fd';this.style.transform='translateY(-1px)'"
    onmouseout="this.style.borderColor='#dbeafe';this.style.transform='translateY(0)'"
    onclick="openRSSOffer('${encodeURIComponent(o.link)}','${wallId}')">
    <div style="width:46px;height:46px;border-radius:11px;background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:1px solid #dbeafe;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">
      ${o.img?`<img src="${escapeHtml(o.img)}" style="width:36px;height:36px;border-radius:8px;object-fit:cover" onerror="this.parentNode.textContent='🎯'">`:'🎯'}
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.title)}</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(o.desc.replace(/<[^>]*>/g,''))}</div>
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:13px;color:#059669">+$${getUserPayout(o.payout).toFixed(2)}</span>
        ${o.payout>0?`<span style="font-size:10px;color:#94a3b8">CPA: $${o.payout.toFixed(2)}</span>`:''}
        ${o.category?`<span style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:5px;padding:1px 7px;font-size:10px;font-weight:600">${escapeHtml(o.category)}</span>`:''}
      </div>
    </div>
    <div style="font-size:18px;color:#2563eb;flex-shrink:0">›</div>
  </div>`).join('');
}

function openRSSOffer(encodedLink, wallId){
  const link=decodeURIComponent(encodedLink);
  if(!link) return;
  openLink(link);
  trackEvent('offer_open', { wall_id: wallId||'' });
  // After opening show a note
  toast(T('completeOfferComeBack'),'i',4000);
}

// ─── PROFILE PAGE ─────────────────────────────────────
// ── REFERRAL PAGE — আলাদা ট্যাব ──────────────────────────
