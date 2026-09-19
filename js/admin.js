// ══════════════════════════════════════════════════════════
// 📊 ADMIN DASHBOARD — গত ৩০ দিনের ট্রেন্ড চার্ট + সামারি কার্ড
// ══════════════════════════════════════════════════════════
let _chartSignups = null, _chartPayouts = null; // পুরনো chart instance destroy করতে রাখা হয়েছে (re-render এ memory leak/ওভারল্যাপ রোধে)

async function loadAdminDashboard(c){
  c.innerHTML='<div style="text-align:center;padding:30px;color:#64748b">⏳ Loading dashboard...</div>';
  try{
    const since = new Date(Date.now() - 29*86400000); // গত ৩০ দিন (আজসহ)
    const sinceISO = since.toISOString();

    const [{data:users}, {data:withdrawals}, {data:statRow}, {data:pendingWd}] = await Promise.all([
      sb.from('users').select('created_at'),
      sb.from('withdrawals').select('created_at,amount,status').eq('status','approved'),
      sb.from('stats').select('total_users,total_paid_out').eq('id','stats').maybeSingle(),
      sb.from('withdrawals').select('id').eq('status','pending'),
    ]);

    // ── গত ৩০ দিনের প্রতিদিনের বাকেট বানানো (YYYY-MM-DD কী দিয়ে) ──
    const days = [];
    for(let i=29;i>=0;i--){
      const d = new Date(Date.now() - i*86400000);
      days.push(d.toISOString().slice(0,10));
    }
    const signupsByDay = Object.fromEntries(days.map(d=>[d,0]));
    (users||[]).forEach(u=>{
      if(!u.created_at) return;
      const key = new Date(u.created_at).toISOString().slice(0,10);
      if(key in signupsByDay) signupsByDay[key]++;
    });
    const payoutsByDay = Object.fromEntries(days.map(d=>[d,0]));
    (withdrawals||[]).forEach(w=>{
      if(!w.created_at) return;
      const key = new Date(w.created_at).toISOString().slice(0,10);
      if(key in payoutsByDay) payoutsByDay[key] += parseFloat(w.amount)||0;
    });

    const todaySignups = signupsByDay[days[days.length-1]] || 0;
    const totalUsers = statRow?.total_users || (users?.length||0);
    const totalPaidOut = parseFloat(statRow?.total_paid_out||0);
    const pendingCount = pendingWd?.length || 0;

    c.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:linear-gradient(135deg,#2563eb,#1e40af);border-radius:14px;padding:14px;text-align:center;color:#fff">
        <div style="font-size:10px;opacity:.85;font-weight:700;text-transform:uppercase">👥 Total Users</div>
        <div class="sf" style="font-size:22px;font-weight:800">${totalUsers}</div>
      </div>
      <div style="background:linear-gradient(135deg,#059669,#047857);border-radius:14px;padding:14px;text-align:center;color:#fff">
        <div style="font-size:10px;opacity:.85;font-weight:700;text-transform:uppercase">💚 Total Paid Out</div>
        <div class="sf" style="font-size:22px;font-weight:800">${fmt$(totalPaidOut)}</div>
      </div>
      <div style="background:linear-gradient(135deg,#f59e0b,#b45309);border-radius:14px;padding:14px;text-align:center;color:#fff">
        <div style="font-size:10px;opacity:.85;font-weight:700;text-transform:uppercase">🆕 Signups Today</div>
        <div class="sf" style="font-size:22px;font-weight:800">${todaySignups}</div>
      </div>
      <div style="background:linear-gradient(135deg,#dc2626,#991b1b);border-radius:14px;padding:14px;text-align:center;color:#fff">
        <div style="font-size:10px;opacity:.85;font-weight:700;text-transform:uppercase">⏳ Pending Withdrawals</div>
        <div class="sf" style="font-size:22px;font-weight:800">${pendingCount}</div>
      </div>
    </div>

    <div class="card mb12">
      <div class="card-hd">📈 New Signups — Last 30 Days</div>
      <canvas id="chartSignups" height="160"></canvas>
    </div>

    <div class="card mb12">
      <div class="card-hd">💸 Amount Paid Out — Last 30 Days</div>
      <canvas id="chartPayouts" height="160"></canvas>
    </div>`;

    // ── Chart.js CDN থেকে না এলে (ইন্টারনেট না থাকলে) গ্রেসফুলি স্কিপ করা ──
    if(typeof Chart === 'undefined'){
      c.innerHTML += `<div style="text-align:center;padding:12px;color:#94a3b8;font-size:12px">⚠️ Chart লোড করা যায়নি (ইন্টারনেট সংযোগ চেক করুন)</div>`;
      return;
    }

    const labels = days.map(d=>d.slice(5)); // MM-DD ফরম্যাটে দেখানো, ছোট জায়গায় ভালো দেখায়

    if(_chartSignups) _chartSignups.destroy();
    _chartSignups = new Chart(document.getElementById('chartSignups'), {
      type:'line',
      data:{ labels, datasets:[{ label:'Signups', data:days.map(d=>signupsByDay[d]), borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.1)', tension:.3, fill:true, pointRadius:2 }] },
      options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } }, x:{ ticks:{ maxTicksLimit:8 } } } }
    });

    if(_chartPayouts) _chartPayouts.destroy();
    _chartPayouts = new Chart(document.getElementById('chartPayouts'), {
      type:'bar',
      data:{ labels, datasets:[{ label:'Paid Out ($)', data:days.map(d=>payoutsByDay[d]), backgroundColor:'#059669' }] },
      options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true }, x:{ ticks:{ maxTicksLimit:8 } } } }
    });
  }catch(e){
    c.innerHTML=`<div class="empty"><div class="ein">⚠️</div><div class="etx">Error: ${e.message}</div></div>`;
  }
}

// ─── ADMIN PAGE ───────────────────────────────────────
function buildAdmin(){
  const tabs=['dash','users','ws','ns','ofs','orders','tasks','awards','kyc','errors','sett'];
  const tabLabels={dash:'📊 Dashboard',users:T('us'),ws:T('ws'),ns:T('ns'),ofs:T('ofs'),orders:'🛒 Orders',tasks:'📱 Tasks',awards:'🏆 Awards',kyc:'🪪 KYC',errors:'🐞 Error Logs','sett':'⚙️ Settings'};
  return `<div class="ph"><div class="pt">⚙️ ${T('ap')}</div></div>
  <div class="ats">${tabs.map(t=>`<button class="at-btn${S.adminTab===t?' on':''}" data-atab="${t}">${tabLabels[t]||t}</button>`).join('')}</div>
  <div id="adminContent"><div class="empty"><div class="ein">⏳</div></div></div>`;
}

async function loadAdminContent(){
  const c=$('#adminContent'); if(!c) return;
  if(S.adminTab==='dash') await loadAdminDashboard(c);
  else if(S.adminTab==='users') await loadAdminUsers(c);
  else if(S.adminTab==='ws') await loadWithdrawals(c);
  else if(S.adminTab==='ns') loadAdminNotices(c);
  else if(S.adminTab==='ofs') await loadAdminOffers(c);
  else if(S.adminTab==='orders') await loadAdminOrders(c);
  else if(S.adminTab==='tasks') await loadAdminTasks(c);
  else if(S.adminTab==='awards') await loadAdminAwards(c);
  else if(S.adminTab==='kyc') await loadAdminKYC(c);
  else if(S.adminTab==='errors') await loadAdminErrorLogs(c);
  else if(S.adminTab==='sett') await loadAdminSettings(c);
}

// ─── ADMIN — ERROR LOGS ───────────────────────────────────────
// js/analytics.js এর window.onerror/unhandledrejection listener প্রতিটা
// অ্যাপ ক্র্যাশ/JS এরর স্বয়ংক্রিয়ভাবে Supabase-এর error_logs টেবিলে
// জমা রাখে। এই ট্যাব সেই লগগুলো এখানে Admin panel-এর ভেতর থেকেই
// দেখার, খুঁজার, CSV export করার, আর পুরনো এন্ট্রি মুছে ফেলার UI দেয় —
// আগে ডেটা জমা হতো ঠিকই কিন্তু দেখার কোনো জায়গা ছিল না (শুধু
// Supabase Table Editor-এ গিয়ে সরাসরি দেখতে হতো)।
async function loadAdminErrorLogs(c){
  c.innerHTML='<div style="text-align:center;padding:20px;color:#64748b">⏳ Loading error logs...</div>';
  try{
    const {data, error} = await sb.from('error_logs').select('*').order('created_at',{ascending:false}).limit(200);
    if(error) throw error;
    const logs = data||[];

    if(!logs.length){
      c.innerHTML=`<div class="empty"><div class="ein">✅</div><div class="etx">কোনো এরর লগ নেই — অ্যাপ ঠিকঠাক চলছে!</div></div>`;
      return;
    }

    c.innerHTML=`
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input id="errSearch" class="inp" placeholder="🔍 Search by message, page, or user..." style="margin-bottom:0;flex:1">
        <button id="exportErrBtn" class="btn bh" style="width:auto;padding:0 16px;white-space:nowrap">📥 CSV</button>
        <button id="clearOldErrBtn" class="btn br" style="width:auto;padding:0 16px;white-space:nowrap">🗑 Clear 30d+</button>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:10px">সর্বশেষ ${logs.length}টা এরর দেখানো হচ্ছে (সর্বোচ্চ ২০০টা)</div>
      <div id="errList"></div>`;

    document.getElementById('exportErrBtn').onclick = ()=>{
      const csvRows = logs.map(l=>({
        Time: fmtD(l.created_at)+' '+new Date(l.created_at).toLocaleTimeString(),
        Message: l.message||'', Source: l.source||'', Line: l.line||0,
        Platform: l.platform||'', 'App Version': l.app_version||'', 'User ID': l.user_id||'—',
      }));
      exportToCSV(csvRows, `earnova-error-logs-${new Date().toISOString().slice(0,10)}.csv`);
    };

    document.getElementById('clearOldErrBtn').onclick = async ()=>{
      if(!confirm('৩০ দিনের বেশি পুরনো সব এরর লগ মুছে ফেলা হবে। এগিয়ে যাবেন?')) return;
      const cutoff = new Date(Date.now() - 30*24*60*60*1000).toISOString();
      try{
        const { error:delErr } = await sb.from('error_logs').delete().lt('created_at', cutoff);
        if(delErr) throw delErr;
        toast('✅ পুরনো এরর লগ মুছে ফেলা হয়েছে','s');
        loadAdminErrorLogs(c);
      }catch(e){ toast('❌ মুছতে সমস্যা হয়েছে: '+e.message,'e'); }
    };

    function renderErrList(list){
      const wrap = document.getElementById('errList');
      if(!wrap) return;
      if(!list.length){ wrap.innerHTML=`<div class="empty"><div class="ein">🔍</div><div class="etx">কিছু পাওয়া যায়নি</div></div>`; return; }
      wrap.innerHTML = list.map(l=>{
        const platIcon = l.platform==='android' ? '🤖' : l.platform==='ios' ? '🍎' : '🌐';
        return `<div class="arow" style="flex-direction:column;align-items:stretch;gap:6px">
          <div class="arow-l" style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
            <div style="flex:1;min-width:0">
              <div class="fw6 sm" style="color:#b91c1c;word-break:break-word">⚠️ ${escapeHtml(l.message||'(no message)')}</div>
              <div class="xs mu mt8">
                ${platIcon} ${escapeHtml(l.platform||'web')} · v${escapeHtml(l.app_version||'?')}
                ${l.source?` · 📄 ${escapeHtml(l.source)}${l.line?':'+parseInt(l.line):''}`:''}
                ${l.user_id?` · 👤 ${escapeHtml(l.user_id)}`:''}
              </div>
              <div class="xs mu mt8">🗓 ${fmtD(l.created_at)} ${new Date(l.created_at).toLocaleTimeString()}</div>
            </div>
            <button class="btn br bau bsm" data-del-err="${l.id}" style="flex-shrink:0">✕</button>
          </div>
          ${l.stack?`<details style="font-size:10px">
            <summary style="cursor:pointer;color:#2563eb;font-weight:600">Stack trace দেখুন</summary>
            <pre style="white-space:pre-wrap;word-break:break-word;background:#f8fafc;border-radius:8px;padding:8px;margin-top:6px;color:#475569;max-height:200px;overflow:auto">${escapeHtml(l.stack)}</pre>
          </details>`:''}
        </div>`;
      }).join('');
      wrap.querySelectorAll('[data-del-err]').forEach(btn=>{
        btn.onclick=async()=>{
          try{
            await sb.from('error_logs').delete().eq('id', btn.dataset.delErr);
            toast('✅ Deleted','s');
            loadAdminErrorLogs(c);
          }catch(e){ toast('❌ '+e.message,'e'); }
        };
      });
    }
    renderErrList(logs);

    document.getElementById('errSearch').oninput = (e)=>{
      const q = e.target.value.toLowerCase().trim();
      if(!q){ renderErrList(logs); return; }
      renderErrList(logs.filter(l =>
        (l.message||'').toLowerCase().includes(q) ||
        (l.source||'').toLowerCase().includes(q) ||
        (l.user_id||'').toLowerCase().includes(q) ||
        (l.platform||'').toLowerCase().includes(q)
      ));
    };
  }catch(e){
    c.innerHTML=`<div class="empty"><div class="ein">⚠️</div><div class="etx">Error: ${escapeHtml(e.message)}</div></div>`;
  }
}

// ─── ADMIN ORDERS ─────────────────────────────────────
async function loadAdminOrders(c){
  const snap = await fDB.ref('orders').orderByChild('createdAt').once('value');
  const data = snap.val()||{};
  const orders = Object.entries(data).sort((a,b)=>b[1].createdAt-a[1].createdAt);
  if(!orders.length){ c.innerHTML='<div class="empty"><div class="ein">📭</div><div>No orders yet</div></div>'; return; }
  c.innerHTML = orders.map(([id,o])=>`
  <div class="card mb10">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div>
        <div style="font-size:11px;color:#94a3b8;font-weight:600">${id}</div>
        <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#0f172a;margin-top:2px">${o.platform} — ${o.service}</div>
      </div>
      <div style="font-size:13px;font-weight:700;padding:4px 10px;border-radius:8px;${o.status==='approved'?'background:#f0fdf4;color:#059669':o.status==='rejected'?'background:#fef2f2;color:#dc2626':'background:#fefce8;color:#d97706'}">${o.status==='approved'?'✅ Done':o.status==='rejected'?'❌ Rejected':'⏳ Pending'}</div>
    </div>
    <div style="font-size:12px;color:#475569;line-height:1.8">
      <div>👤 <strong>${o.name}</strong> · 📞 ${o.phone}</div>
      <div>📦 Qty: <strong>${o.qty?.toLocaleString()}</strong> · 💰 <strong>$${parseFloat(o.price||0).toFixed(2)}</strong></div>
      <div>🔗 <a href="${o.link}" onclick="openLink(this.href);return false;" style="color:#2563eb">${o.link?.substring(0,40)}…</a></div>
      ${o.notes?`<div>📝 ${o.notes}</div>`:''}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="updateOrder('${id}','approved')" style="flex:1;background:linear-gradient(135deg,#059669,#047857);border:none;border-radius:9px;padding:8px;font-size:12px;font-weight:700;color:#fff;cursor:pointer">✅ Approve</button>
      <button onclick="updateOrder('${id}','rejected')" style="flex:1;background:linear-gradient(135deg,#dc2626,#b91c1c);border:none;border-radius:9px;padding:8px;font-size:12px;font-weight:700;color:#fff;cursor:pointer">❌ Reject</button>
      <button onclick="deleteOrder('${id}')" style="background:#f1f5f9;border:none;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:700;color:#64748b;cursor:pointer">🗑️</button>
    </div>
  </div>`).join('');
}

async function updateOrder(id, status){
  await fDB.ref('orders/'+id+'/status').set(status);
  showToast(status==='approved'?'✅ Order approved!':'❌ Order rejected','green');
  loadAdminOrders($('#adminContent'));
}

async function deleteOrder(id){
  if(!confirm('Delete this order?')) return;
  await fDB.ref('orders/'+id).remove();
  showToast('🗑️ Order deleted','blue');
  loadAdminOrders($('#adminContent'));
}

// ─── ADMIN SOCIAL TASKS ───────────────────────────────
async function loadAdminTasks(c){
  const {data:tData} = await sb.from('social_tasks').select('*').order('created_at',{ascending:false});
  const tasks = (tData||[]).map(t=>[t.id, {
    id:t.id, title:t.title, platform:t.platform, link:t.link,
    description:t.description, reward:t.reward,
    maxWorkers:t.max_workers||t.maxWorkers||100,
    currentWorkers:t.current_workers||t.currentWorkers||0,
    status:t.status, country:t.country||'ALL',
    proofType:t.proof_type||t.proofType||'screenshot',
task_type: t.task_type||'follow',
max_per_user: t.max_per_user||1,
  }]);

  // Add task form
  let html = `<div class="card mb12">
    <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#1e40af;margin-bottom:14px">➕ Add New Task</div>
    <label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;font-weight:600">Task Title *</label>
    <input id="tTitle" type="text" placeholder="e.g. Subscribe to our YouTube channel" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit;margin-bottom:10px">
    <label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;font-weight:600">Platform</label>
    <select id="tPlatform" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit;margin-bottom:10px">
      <option value="facebook">Facebook</option>
      <option value="youtube">YouTube</option>
      <option value="instagram">Instagram</option>
      <option value="twitter">Twitter/X</option>
      <option value="telegram">Telegram</option>
      <option value="tiktok">TikTok</option>
    </select>
    <label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;font-weight:600">Task Type *</label>
    <select id="tTaskType" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit;margin-bottom:10px">
      <option value="follow">👤 Follow</option>
      <option value="subscribe">🔔 Subscribe</option>
      <option value="watch">▶️ Watch Video</option>
      <option value="like">👍 Like</option>
      <option value="comment">💬 Comment</option>
      <option value="share">🔁 Share</option>
    </select>
    <label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;font-weight:600">Target Country (একটি বেছে নাও)</label>
    <select id="tCountry" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit;margin-bottom:10px">

      <option value="ALL">🌍 All Countries</option>
      <option value="AF">🇦🇫 Afghanistan</option>
      <option value="AL">🇦🇱 Albania</option>
      <option value="DZ">🇩🇿 Algeria</option>
      <option value="AD">🇦🇩 Andorra</option>
      <option value="AO">🇦🇴 Angola</option>
      <option value="AR">🇦🇷 Argentina</option>
      <option value="AM">🇦🇲 Armenia</option>
      <option value="AU">🇦🇺 Australia</option>
      <option value="AT">🇦🇹 Austria</option>
      <option value="AZ">🇦🇿 Azerbaijan</option>
      <option value="BH">🇧🇭 Bahrain</option>
      <option value="BD">🇧🇩 Bangladesh</option>
      <option value="BY">🇧🇾 Belarus</option>
      <option value="BE">🇧🇪 Belgium</option>
      <option value="BZ">🇧🇿 Belize</option>
      <option value="BJ">🇧🇯 Benin</option>
      <option value="BT">🇧🇹 Bhutan</option>
      <option value="BO">🇧🇴 Bolivia</option>
      <option value="BA">🇧🇦 Bosnia</option>
      <option value="BW">🇧🇼 Botswana</option>
      <option value="BR">🇧🇷 Brazil</option>
      <option value="BN">🇧🇳 Brunei</option>
      <option value="BG">🇧🇬 Bulgaria</option>
      <option value="BF">🇧🇫 Burkina Faso</option>
      <option value="BI">🇧🇮 Burundi</option>
      <option value="KH">🇰🇭 Cambodia</option>
      <option value="CM">🇨🇲 Cameroon</option>
      <option value="CA">🇨🇦 Canada</option>
      <option value="CF">🇨🇫 Central African Rep.</option>
      <option value="TD">🇹🇩 Chad</option>
      <option value="CL">🇨🇱 Chile</option>
      <option value="CN">🇨🇳 China</option>
      <option value="CO">🇨🇴 Colombia</option>
      <option value="CG">🇨🇬 Congo</option>
      <option value="CR">🇨🇷 Costa Rica</option>
      <option value="HR">🇭🇷 Croatia</option>
      <option value="CU">🇨🇺 Cuba</option>
      <option value="CY">🇨🇾 Cyprus</option>
      <option value="CZ">🇨🇿 Czech Republic</option>
      <option value="DK">🇩🇰 Denmark</option>
      <option value="DJ">🇩🇯 Djibouti</option>
      <option value="DO">🇩🇴 Dominican Republic</option>
      <option value="EC">🇪🇨 Ecuador</option>
      <option value="EG">🇪🇬 Egypt</option>
      <option value="SV">🇸🇻 El Salvador</option>
      <option value="GQ">🇬🇶 Equatorial Guinea</option>
      <option value="ER">🇪🇷 Eritrea</option>
      <option value="EE">🇪🇪 Estonia</option>
      <option value="ET">🇪🇹 Ethiopia</option>
      <option value="FJ">🇫🇯 Fiji</option>
      <option value="FI">🇫🇮 Finland</option>
      <option value="FR">🇫🇷 France</option>
      <option value="GA">🇬🇦 Gabon</option>
      <option value="GM">🇬🇲 Gambia</option>
      <option value="GE">🇬🇪 Georgia</option>
      <option value="DE">🇩🇪 Germany</option>
      <option value="GH">🇬🇭 Ghana</option>
      <option value="GR">🇬🇷 Greece</option>
      <option value="GT">🇬🇹 Guatemala</option>
      <option value="GN">🇬🇳 Guinea</option>
      <option value="GW">🇬🇼 Guinea-Bissau</option>
      <option value="GY">🇬🇾 Guyana</option>
      <option value="HT">🇭🇹 Haiti</option>
      <option value="HN">🇭🇳 Honduras</option>
      <option value="HK">🇭🇰 Hong Kong</option>
      <option value="HU">🇭🇺 Hungary</option>
      <option value="IS">🇮🇸 Iceland</option>
      <option value="IN">🇮🇳 India</option>
      <option value="ID">🇮🇩 Indonesia</option>
      <option value="IR">🇮🇷 Iran</option>
      <option value="IQ">🇮🇶 Iraq</option>
      <option value="IE">🇮🇪 Ireland</option>
      <option value="IL">🇮🇱 Israel</option>
      <option value="IT">🇮🇹 Italy</option>
      <option value="JM">🇯🇲 Jamaica</option>
      <option value="JP">🇯🇵 Japan</option>
      <option value="JO">🇯🇴 Jordan</option>
      <option value="KZ">🇰🇿 Kazakhstan</option>
      <option value="KE">🇰🇪 Kenya</option>
      <option value="KW">🇰🇼 Kuwait</option>
      <option value="KG">🇰🇬 Kyrgyzstan</option>
      <option value="LA">🇱🇦 Laos</option>
      <option value="LV">🇱🇻 Latvia</option>
      <option value="LB">🇱🇧 Lebanon</option>
      <option value="LS">🇱🇸 Lesotho</option>
      <option value="LR">🇱🇷 Liberia</option>
      <option value="LY">🇱🇾 Libya</option>
      <option value="LI">🇱🇮 Liechtenstein</option>
      <option value="LT">🇱🇹 Lithuania</option>
      <option value="LU">🇱🇺 Luxembourg</option>
      <option value="MO">🇲🇴 Macao</option>
      <option value="MK">🇲🇰 Macedonia</option>
      <option value="MG">🇲🇬 Madagascar</option>
      <option value="MW">🇲🇼 Malawi</option>
      <option value="MY">🇲🇾 Malaysia</option>
      <option value="MV">🇲🇻 Maldives</option>
      <option value="ML">🇲🇱 Mali</option>
      <option value="MT">🇲🇹 Malta</option>
      <option value="MR">🇲🇷 Mauritania</option>
      <option value="MU">🇲🇺 Mauritius</option>
      <option value="MX">🇲🇽 Mexico</option>
      <option value="MD">🇲🇩 Moldova</option>
      <option value="MN">🇲🇳 Mongolia</option>
      <option value="ME">🇲🇪 Montenegro</option>
      <option value="MA">🇲🇦 Morocco</option>
      <option value="MZ">🇲🇿 Mozambique</option>
      <option value="MM">🇲🇲 Myanmar</option>
      <option value="NA">🇳🇦 Namibia</option>
      <option value="NP">🇳🇵 Nepal</option>
      <option value="NL">🇳🇱 Netherlands</option>
      <option value="NZ">🇳🇿 New Zealand</option>
      <option value="NI">🇳🇮 Nicaragua</option>
      <option value="NE">🇳🇪 Niger</option>
      <option value="NG">🇳🇬 Nigeria</option>
      <option value="NO">🇳🇴 Norway</option>
      <option value="OM">🇴🇲 Oman</option>
      <option value="PK">🇵🇰 Pakistan</option>
      <option value="PA">🇵🇦 Panama</option>
      <option value="PG">🇵🇬 Papua New Guinea</option>
      <option value="PY">🇵🇾 Paraguay</option>
      <option value="PE">🇵🇪 Peru</option>
      <option value="PH">🇵🇭 Philippines</option>
      <option value="PL">🇵🇱 Poland</option>
      <option value="PT">🇵🇹 Portugal</option>
      <option value="QA">🇶🇦 Qatar</option>
      <option value="RO">🇷🇴 Romania</option>
      <option value="RU">🇷🇺 Russia</option>
      <option value="RW">🇷🇼 Rwanda</option>
      <option value="SA">🇸🇦 Saudi Arabia</option>
      <option value="SN">🇸🇳 Senegal</option>
      <option value="RS">🇷🇸 Serbia</option>
      <option value="SL">🇸🇱 Sierra Leone</option>
      <option value="SG">🇸🇬 Singapore</option>
      <option value="SK">🇸🇰 Slovakia</option>
      <option value="SI">🇸🇮 Slovenia</option>
      <option value="SO">🇸🇴 Somalia</option>
      <option value="ZA">🇿🇦 South Africa</option>
      <option value="SS">🇸🇸 South Sudan</option>
      <option value="ES">🇪🇸 Spain</option>
      <option value="LK">🇱🇰 Sri Lanka</option>
      <option value="SD">🇸🇩 Sudan</option>
      <option value="SR">🇸🇷 Suriname</option>
      <option value="SZ">🇸🇿 Swaziland</option>
      <option value="SE">🇸🇪 Sweden</option>
      <option value="CH">🇨🇭 Switzerland</option>
      <option value="SY">🇸🇾 Syria</option>
      <option value="TW">🇹🇼 Taiwan</option>
      <option value="TJ">🇹🇯 Tajikistan</option>
      <option value="TZ">🇹🇿 Tanzania</option>
      <option value="TH">🇹🇭 Thailand</option>
      <option value="TL">🇹🇱 Timor-Leste</option>
      <option value="TG">🇹🇬 Togo</option>
      <option value="TT">🇹🇹 Trinidad and Tobago</option>
      <option value="TN">🇹🇳 Tunisia</option>
      <option value="TR">🇹🇷 Turkey</option>
      <option value="TM">🇹🇲 Turkmenistan</option>
      <option value="UG">🇺🇬 Uganda</option>
      <option value="UA">🇺🇦 Ukraine</option>
      <option value="AE">🇦🇪 UAE</option>
      <option value="GB">🇬🇧 United Kingdom</option>
      <option value="US">🇺🇸 United States</option>
      <option value="UY">🇺🇾 Uruguay</option>
      <option value="UZ">🇺🇿 Uzbekistan</option>
      <option value="VE">🇻🇪 Venezuela</option>
      <option value="VN">🇻🇳 Vietnam</option>
      <option value="YE">🇾🇪 Yemen</option>
      <option value="ZM">🇿🇲 Zambia</option>
      <option value="ZW">🇿🇼 Zimbabwe</option>
    </select>
    <label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;font-weight:600">Task Link *</label>
    <input id="tLink" type="url" placeholder="https://youtube.com/channel/..." style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit;margin-bottom:10px">
    <label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;font-weight:600">Description</label>
    <input id="tDesc" type="text" placeholder="e.g. Subscribe and keep subscribed for 30 days" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit;margin-bottom:10px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div>
        <label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;font-weight:600">Reward ($)</label>
        <input id="tReward" type="number" placeholder="0.10" step="0.01" min="0.01" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit">
      </div>
      <div>
        <label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;font-weight:600">Max Per User</label>
        <input id="tMaxPerUser" type="number" placeholder="1" min="1" value="1" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit">
      </div>
    </div>
        <label style="font-size:12px;color:#475569;display:block;margin-bottom:4px;font-weight:600">Max Workers</label>
        <input id="tMax" type="number" placeholder="100" min="1" style="width:100%;padding:10px 13px;border:1.5px solid #dbeafe;border-radius:10px;font-size:13px;background:#f8fafc;color:#0f172a;outline:none;font-family:inherit">
      </div>
    </div>
    <button onclick="addSocialTask()" class="btn bp bau">➕ Add Task</button>
  </div>

  <!-- Submissions Review -->
  <div class="card mb12">
    <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#1e40af;margin-bottom:12px">📋 Pending Submissions</div>
    <div id="pendingSubmissions"><div style="font-size:12px;color:#64748b;text-align:center;padding:16px">Loading…</div></div>
  </div>

  <!-- Existing Tasks -->
  <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#475569;margin-bottom:10px">📱 Active Tasks (${tasks.length})</div>`;

  html += tasks.map(([id,t])=>`
  <div class="card mb10">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700">${escapeHtml(t.title)}</div>
      <div style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;${t.status==='active'?'background:#f0fdf4;color:#059669':'background:#fef2f2;color:#dc2626'}">${escapeHtml(t.status)}</div>
    </div>
    <div style="font-size:12px;color:#475569;margin-bottom:8px">${escapeHtml(t.platform)} · $${t.reward} · Workers: ${t.currentWorkers||0}/${t.maxWorkers}</div>
    <div style="display:flex;gap:8px">
      <button onclick="toggleTask('${id}','${t.status}')" style="flex:1;background:${t.status==='active'?'#fef2f2':'#f0fdf4'};border:1px solid ${t.status==='active'?'#fca5a5':'#86efac'};border-radius:8px;padding:7px;font-size:11px;font-weight:700;color:${t.status==='active'?'#dc2626':'#059669'};cursor:pointer">${t.status==='active'?'⏸ Pause':'▶ Activate'}</button>
      <button onclick="deleteTask('${id}')" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:700;color:#64748b;cursor:pointer">🗑️</button>
    </div>
  </div>`).join('');

  c.innerHTML = html;
  loadPendingSubmissions();
}

async function loadPendingSubmissions(){
  const el = document.getElementById('pendingSubmissions');
  if(!el) return;
  // Supabase directly — snake_case columns
  const {data:sData} = await sb.from('submissions').select('*').eq('status','pending').order('created_at',{ascending:false});
  const list = sData||[];
  if(!list.length){ el.innerHTML='<div style="font-size:12px;color:#64748b;text-align:center;padding:10px">No pending submissions</div>'; return; }
  el.innerHTML = list.map(s=>`
  <div style="padding:12px 0;border-bottom:1px solid #f1f5f9">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <div style="font-size:13px;font-weight:600">${escapeHtml(s.task_title||s.taskTitle||'')}</div>
      <div style="font-size:12px;font-weight:700;color:#059669">$${parseFloat(s.reward||0).toFixed(2)}</div>
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:8px">👤 ${escapeHtml(s.user_email||s.email||s.uid)} · ${new Date(s.created_at||s.createdAt||Date.now()).toLocaleDateString()}</div>
    ${s.photo_url ? `
<div style="margin-bottom:10px">
  <div style="position:relative;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:8px">
    <img src="${s.photo_url}"
      style="width:100%;height:auto;max-height:420px;object-fit:contain;display:block;border-radius:13px"
      onerror="this.parentNode.innerHTML='<div style=\'padding:20px;text-align:center;color:#94a3b8;font-size:12px\'>⚠️ Photo failed to load</div>'">
    <a href="${s.photo_url}" onclick="openLink(this.href);return false;"
      style="position:absolute;top:8px;right:8px;background:rgba(15,23,42,.65);backdrop-filter:blur(6px);border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;color:#fff;text-decoration:none;cursor:pointer">
      🔍 Full View
    </a>
  </div>
  <div style="display:flex;gap:8px">
    <button id="appBtn_${s.id}"
      onclick="handleApprove('${s.id}','${s.uid}',${s.reward})"
      style="flex:1;background:linear-gradient(135deg,#059669,#047857);border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 3px 10px rgba(5,150,105,.3)">✅ Approve</button>
    <button id="rejBtn_${s.id}"
      onclick="handleReject('${s.id}')"
      style="flex:1;background:linear-gradient(135deg,#dc2626,#b91c1c);border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 3px 10px rgba(220,38,38,.3)">❌ Reject</button>
  </div>
</div>` 
: `
<div style="font-size:11px;color:#f59e0b;background:rgba(245,158,11,.08);
  border-radius:6px;padding:6px 10px;margin-bottom:8px">
  ⚠️ No photo submitted
</div>
<div style="display:flex;gap:8px;margin-bottom:8px">
  <button id="appBtn_${s.id}" 
    onclick="handleApprove('${s.id}','${s.uid}',${s.reward})" 
    style="flex:1;background:linear-gradient(135deg,#059669,#047857);
    border:none;border-radius:8px;padding:7px;font-size:11px;
    font-weight:700;color:#fff;cursor:pointer">✅ Approve + Pay</button>
  <button id="rejBtn_${s.id}" 
    onclick="handleReject('${s.id}')" 
    style="flex:1;background:linear-gradient(135deg,#dc2626,#b91c1c);
    border:none;border-radius:8px;padding:7px;font-size:11px;
    font-weight:700;color:#fff;cursor:pointer">❌ Reject</button>
</div>`}
  </div>
`).join('');
}

async function handleApprove(subId, uid, reward){
  const aBtn = document.getElementById('appBtn_'+subId);
  const rBtn = document.getElementById('rejBtn_'+subId);
  if(aBtn){ aBtn.disabled=true; aBtn.textContent='⏳...'; }
  if(rBtn){ rBtn.disabled=true; }
  await approveSubmission(subId, uid, reward);
  deleteSubmissionPhoto(subId);
  if(aBtn){ aBtn.textContent='✅ Approved'; aBtn.style.background='#059669'; aBtn.style.flex='1'; }
  if(rBtn) rBtn.remove();
}

async function handleReject(subId){
  const aBtn = document.getElementById('appBtn_'+subId);
  const rBtn = document.getElementById('rejBtn_'+subId);
  if(aBtn){ aBtn.disabled=true; }
  if(rBtn){ rBtn.disabled=true; rBtn.textContent='⏳...'; }
  await rejectSubmission(subId);
  if(rBtn){ rBtn.textContent='❌ Rejected'; rBtn.style.background='#dc2626'; rBtn.style.flex='1'; }
  if(aBtn) aBtn.remove();
}

async function approveSubmission(subId, uid, reward){
  const {data:chk} = await sb.from('submissions')
    .select('status').eq('id',subId).single();
  if(chk?.status !== 'pending'){
    showToast('Already processed!','blue');
    loadPendingSubmissions();
    return;
  }
  await sb.from('submissions').update({status:'approved'}).eq('id', subId);
  await atomicIncrement(uid,'usdEarned',parseFloat(reward));

  // ── today_earned ও today_date আপডেট ──────────────
  // ⚠️ ফিক্স: আগে "read করে তারপর write" ছিল — Admin একের পর এক কয়েকটা
  // submission দ্রুত approve করলে (খুবই স্বাভাবিক ব্যবহার), একাধিক
  // today_earned আপডেট হারিয়ে যেতে পারত। এখন atomic_increment RPC
  // ব্যবহার হচ্ছে, তাই যত দ্রুতই approve করা হোক না কেন কিছু হারাবে না।
  try{
    const today = new Date().toDateString();
    const {data:uRow} = await sb.from('users').select('today_date').eq('id',uid).maybeSingle();
    const prevDate = uRow?.today_date || '';
    if(prevDate === today){
      // same day — atomic increment
      await sb.rpc('atomic_increment', { p_table:'users', p_id:uid, p_field:'today_earned', p_delta:parseFloat(reward) });
    } else {
      // new day — reset (এখানে race-এর ঝুঁকি কম, কারণ দিন বদলের মুহূর্তেই
      // শুধু প্রথম approval-এ ঘটে, তারপরের সবই উপরের atomic increment পথে যায়)
      await sb.from('users').update({
        today_earned: parseFloat(reward),
        today_date: today
      }).eq('id', uid);
    }
  }catch(e){ /* silent */ }

  // stats total_earned — atomic_increment RPC (আগে read-then-write ছিল, একই কারণে ফিক্স করা হলো)
  try{
    const {error:rpcErr} = await sb.rpc('atomic_increment', { p_table:'stats', p_id:'stats', p_field:'total_earned', p_delta:parseFloat(reward) });
    if(rpcErr){
      const {data:stRow} = await sb.from('stats').select('total_earned').eq('id','stats').maybeSingle();
      await sb.from('stats').upsert({id:'stats', total_earned:(parseFloat(stRow?.total_earned)||0)+parseFloat(reward)},{onConflict:'id'});
    }
  }catch(e){}
  trackMonthlyEarning(uid, parseFloat(reward)||0);
  // completedTasks — ⚠️ ফিক্স: আগে পুরো JSONB read করে, একটা key বসিয়ে,
  // পুরোটা write করা হতো — একই ইউজারের ২টা ভিন্ন টাস্ক প্রায় একসাথে
  // approve হলে একটা completedTasks marker হারিয়ে যেতে পারত (ইউজার
  // পেমেন্ট পেয়েও পরে আবার একই টাস্ক জমা দিতে পারত)। এখন Postgres-এর
  // jsonb_set একটা atomic SQL statement-এই হচ্ছে (jsonb_merge_key RPC),
  // মাঝখানে কোনো "read" ধাপ নেই বলে race করার সুযোগই নেই।
  const {data:subRow} = await sb.from('submissions').select('task_id').eq('id',subId).maybeSingle();
  const taskId = subRow?.task_id;
  if(taskId){
    const {error:jsonRpcErr} = await sb.rpc('jsonb_merge_key', {
      p_table:'users', p_id:uid, p_field:'completed_tasks', p_key:String(taskId), p_value:true
    });
    if(jsonRpcErr){
      // ফলব্যাক (RPC না থাকলে) — কম নিরাপদ কিন্তু কাজ চালানোর জন্য যথেষ্ট
      const {data:ctRow} = await sb.from('users').select('completed_tasks').eq('id',uid).maybeSingle();
      const ct = ctRow?.completed_tasks || {};
      ct[taskId] = true;
      await sb.from('users').update({completed_tasks: ct}).eq('id', uid);
    }
    EZCache.invalidate(`completedTasks_${uid}`);
  }
  showToast('✅ Approved! $'+parseFloat(reward).toFixed(2)+' added','green');
}

async function deleteSubmissionPhoto(subId){
  try{
    const {data:sub} = await sb.from('submissions')
      .select('photo_url').eq('id',subId).single();
    if(sub?.photo_url){
      const url = sub.photo_url;
      const marker = '/object/public/proofs/';
      const start = url.indexOf(marker);
      if(start !== -1){
        const filePath = decodeURIComponent(
          url.substring(start + marker.length)
        );
        await sb.storage.from('proofs').remove([filePath]);
        // ⚠️ ছোট পলিশ: শুধু আসল ফাইলটা Storage থেকে মুছলেই যথেষ্ট না —
        // submissions row-এ photo_url ফিল্ডটা তখনও একটা মৃত (delete হয়ে
        // যাওয়া) লিংক ধরে রাখে। এখন সেটাও খালি করে দেওয়া হচ্ছে, যাতে
        // ভবিষ্যতে কোথাও এই submission history দেখানো হলে ভাঙা ছবি
        // (broken image) না দেখায়।
        await sb.from('submissions').update({photo_url: null}).eq('id', subId);
      }
    }
  }catch(e){}
}

async function rejectSubmission(subId){
  deleteSubmissionPhoto(subId);
  await sb.from('submissions').update({status:'rejected'}).eq('id',subId);
  showToast('❌ Submission rejected','blue');
}

async function addSocialTask(){
  const title=document.getElementById('tTitle')?.value?.trim();
  const platform=document.getElementById('tPlatform')?.value;
  const taskType=document.getElementById('tTaskType')?.value||'follow';
const maxPerUser=parseInt(document.getElementById('tMaxPerUser')?.value||1);
  const link=document.getElementById('tLink')?.value?.trim();
  const desc=document.getElementById('tDesc')?.value?.trim();
  const reward=parseFloat(document.getElementById('tReward')?.value||0);
  const maxW=parseInt(document.getElementById('tMax')?.value||100);
  if(!title||!link||!reward){ showToast('Fill all required fields','blue'); return; }
  const id='TASK-'+Date.now();
  const taskCountry = (document.getElementById('tCountry')?.value||'ALL').trim();
  await sb.from('social_tasks').insert({
    id, title, platform, link,
    description: desc||title,
    reward: reward,
    max_workers: maxW,
    current_workers: 0,
    status: 'active',
    country: taskCountry,
    proof_type: 'screenshot',
    created_at: Date.now()
  });
  showToast('✅ Task added!','green');
  loadAdminTasks($('#adminContent'));
}

async function toggleTask(id, currentStatus){
  const newStatus = currentStatus==='active'?'paused':'active';
  await sb.from('social_tasks').update({status:newStatus}).eq('id',id);
  showToast(newStatus==='active'?'▶ Task activated':'⏸ Task paused','blue');
  loadAdminTasks($('#adminContent'));
}

async function deleteTask(id){
  if(!confirm('Delete this task?')) return;
  await sb.from('social_tasks').delete().eq('id',id);
  showToast('🗑️ Task deleted','blue');
  loadAdminTasks($('#adminContent'));
}

// ══════════════════════════════════════════════════════════
// 📥 CSV EXPORT — Users/Withdrawals লিস্ট এক ক্লিকে .csv ডাউনলোড
// ══════════════════════════════════════════════════════════
// rows: [{col1:val, col2:val, ...}, ...] — প্রতিটা object-এর key গুলো
// থেকে হেডার বানানো হয়, আর প্রতিটা value CSV-এর নিয়ম অনুযায়ী escape
// করা হয় (কমা/কোটেশন/নতুন লাইন থাকলেও যেন ফাইল না ভাঙে)
function exportToCSV(rows, filename){
  if(!rows || !rows.length){ toast('⚠️ Export করার মতো ডেটা নেই','w'); return; }
  const headers = Object.keys(rows[0]);
  const escapeCell = (val)=>{
    let s = (val===null||val===undefined) ? '' : String(val);
    // ── CSV Formula Injection ফিক্স: user-controlled ডেটা (name, account
    //    ইত্যাদি) যদি =, +, -, @ দিয়ে শুরু হয়, Excel/Google Sheets সেটাকে
    //    ফর্মুলা মনে করে রান করার চেষ্টা করতে পারে ("CSV Injection" নামে
    //    পরিচিত একটা ঝুঁকি)। সামনে একটা ' (single quote) বসিয়ে দিলে
    //    Excel/Sheets সেটাকে প্লেইন টেক্সট হিসেবে ধরে, ফর্মুলা হিসেবে না।
    if(/^[=+\-@]/.test(s)) s = "'" + s;
    if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const csvLines = [
    headers.join(','),
    ...rows.map(row => headers.map(h=>escapeCell(row[h])).join(','))
  ];
  // ⚠️ UTF-8 BOM (\uFEFF) যোগ করা হয়েছে যাতে বাংলা/অন্যান্য ইউনিকোড
  // টেক্সট থাকলেও Excel-এ সঠিকভাবে খোলে (BOM ছাড়া Excel অনেক সময় বাংলা
  // অক্ষর ভুল দেখায়)
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`✅ ${filename} ডাউনলোড হয়েছে`,'s');
}

async function loadAdminUsers(c){
  c.innerHTML='<div style="text-align:center;padding:20px;color:#64748b">⏳ Loading users...</div>';
  try{
    // Supabase থেকে সব user নাও
    const {data, error} = await sb.from('users').select('*').order('created_at',{ascending:false}).limit(100);
    if(error) throw error;
    const users = (data||[]).map(u=>({
      uid: u.id||u.uid,
      name: u.name||'',
      email: u.email||'',
      usdEarned: u.usd_earned||u.usdEarned||0,
      activeReferrals: u.active_referrals||u.activeReferrals||0,
      adsWatched: u.ads_watched||u.adsWatched||0,
      banned: u.banned||false,
      isAdmin: u.is_admin||u.isAdmin||false,
      createdAt: u.created_at||u.createdAt||''
    }));
    if(!users.length){
      c.innerHTML=`<div class="empty"><div class="ein">👥</div><div class="etx">${T('nun')}</div></div>`;
      return;
    }

    // Search bar + Export button + user list
    c.innerHTML=`
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input id="userSearch" class="inp" placeholder="🔍 Search by name or email..." style="margin-bottom:0;flex:1">
        <button id="exportUsersBtn" class="btn bh" style="width:auto;padding:0 16px;white-space:nowrap">📥 CSV</button>
      </div>
      <div id="userList"></div>`;

    document.getElementById('exportUsersBtn').onclick = ()=>{
      const csvRows = users.map(u=>({
        UID: u.uid, Name: u.name, Email: u.email,
        'Balance ($)': (u.usdEarned||0).toFixed(2),
        'Active Referrals': u.activeReferrals,
        'Ads Watched': u.adsWatched,
        Banned: u.banned?'Yes':'No',
        Admin: u.isAdmin?'Yes':'No',
        'Joined': u.createdAt,
      }));
      exportToCSV(csvRows, `earnova-users-${new Date().toISOString().slice(0,10)}.csv`);
    };

    function renderUsers(list){
      const el = document.getElementById('userList');
      if(!el) return;
      if(!list.length){ el.innerHTML='<div class="empty"><div class="ein">🔍</div><div class="etx">No users found</div></div>'; return; }
      el.innerHTML=list.map(u=>`
        <div class="arow" style="flex-direction:column;align-items:stretch;gap:8px">
          <div class="arow-l">
            <div class="fw6 sm" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${escapeHtml(u.name)||'(no name)'}
              ${u.isAdmin?'<span class="bdg bdp xs">⚙️ Admin</span>':''}
              ${u.banned?'<span class="bdg bdr xs">🚫 Banned</span>':''}
            </div>
            <div class="xs mu">📧 ${escapeHtml(u.email)}</div>
            <div class="xs mu">💰 ${fmt$(u.usdEarned)} · 👥 Refs: ${u.activeReferrals} · 📺 Ads: ${u.adsWatched}</div>
            <div class="xs mu" style="color:#94a3b8">🆔 ${(u.uid||'').slice(0,16)}... · 🗓 ${fmtD(u.createdAt)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn ${u.banned?'bg':'br'} bau bsm" data-uid="${u.uid}" data-action="${u.banned?'unban':'ban'}">
              ${u.banned?'✅ '+T('ub'):'🚫 '+T('bn')}
            </button>
            <button class="btn ${u.isAdmin?'br':'bh'} bau bsm" data-uid="${u.uid}" data-action="${u.isAdmin?'removeAdmin':'makeAdmin'}">
              ${u.isAdmin?'🔻 '+T('ra'):'⚙️ '+T('ma')}
            </button>
            <button class="btn br bau bsm" data-uid="${u.uid}" data-action="delete" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5">
              🗑️ Delete
            </button>
          </div>
        </div>`).join('');

      el.querySelectorAll('[data-uid]').forEach(btn=>{
        btn.onclick=async()=>{
          const uid=btn.dataset.uid, action=btn.dataset.action;
          if(!uid) return;

          // Delete confirm
          if(action==='delete'){
            const confirmDelete = confirm('⚠️ এই user কে সম্পূর্ণ delete করবে?\n\nUser এর সব data, withdrawals, এবং Supabase Auth account মুছে যাবে।\n\nএটা undo করা যাবে না!');
            if(!confirmDelete) return;
          }

          btn.disabled=true;
          btn.textContent='⏳...';
          try{
            if(action==='ban'){
              await sb.from('users').update({banned:true}).eq('id',uid);
              toast('🚫 User banned!','s');
            } else if(action==='unban'){
              await sb.from('users').update({banned:false}).eq('id',uid);
              toast('✅ User unbanned!','s');
            } else if(action==='makeAdmin'){
              await sb.from('users').update({is_admin:true}).eq('id',uid);
              toast('⚙️ Admin access given!','s');
            } else if(action==='removeAdmin'){
              await sb.from('users').update({is_admin:false}).eq('id',uid);
              toast('🔻 Admin access removed!','s');
            } else if(action==='delete'){
              // Step 1: User এর withdrawals delete করো
              await sb.from('withdrawals').delete().eq('uid',uid);
              // Step 2: User এর offers/tasks delete করো
              await sb.from('offers').delete().eq('uid',uid).catch(()=>{});
              // Step 3: Users table থেকে delete করো
              await sb.from('users').delete().eq('id',uid);
              // Step 4: Supabase Auth থেকে delete (admin API লাগে — না থাকলে skip)
              toast('🗑️ User deleted successfully!','s');
              loadAdminContent();
              return;
            }
            loadAdminContent();
          }catch(e){
            toast('Error: '+e.message,'e');
            btn.disabled=false;
          }
        };
      });
    }

    renderUsers(users);

    // Search functionality
    const searchEl = document.getElementById('userSearch');
    if(searchEl){
      searchEl.oninput=()=>{
        const q = searchEl.value.toLowerCase().trim();
        if(!q){ renderUsers(users); return; }
        renderUsers(users.filter(u=>
          (u.name||'').toLowerCase().includes(q) ||
          (u.email||'').toLowerCase().includes(q) ||
          (u.uid||'').toLowerCase().includes(q)
        ));
      };
    }

  }catch(e){
    c.innerHTML=`<div class="empty"><div class="ein">⚠️</div><div class="etx">Error: ${e.message}</div></div>`;
  }
}
// ══════════════════════════════════════════════════════════
// 🪪 ADMIN KYC REVIEW — ইউজারের জমা দেওয়া ID verification যাচাই
// ══════════════════════════════════════════════════════════
async function loadAdminKYC(c){
  c.innerHTML='<div style="text-align:center;padding:30px;color:#64748b">⏳ Loading...</div>';
  try{
    const {data, error} = await sb
      .from('kyc_submissions')
      .select('*')
      .order('created_at', {ascending:false})
      .limit(100);
    if(error) throw error;
    const items = data||[];
    if(!items.length){
      c.innerHTML=`<div class="empty"><div class="ein">🪪</div><div class="etx">এখনো কোনো KYC submission আসেনি</div></div>`;
      return;
    }
    // Pending গুলো সবার আগে দেখানো হচ্ছে (approve/reject করার দরকার সেগুলোই আগে)
    const sorted = [...items].sort((a,b)=>{
      if(a.status==='pending' && b.status!=='pending') return -1;
      if(b.status==='pending' && a.status!=='pending') return 1;
      return (b.created_at||0)-(a.created_at||0);
    });
    c.innerHTML = sorted.map(k=>`
    <div class="card mb10">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700">${escapeHtml(k.full_name)||'—'}</div>
          <div style="font-size:11px;color:#64748b">🪪 ID: ${escapeHtml(k.id_number)||'—'} · 👤 ${escapeHtml(k.user_email||k.uid)||'—'}</div>
          <div style="font-size:11px;color:#94a3b8">🗓 ${fmtD(k.created_at)}</div>
        </div>
        <div style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;${k.status==='approved'?'background:#f0fdf4;color:#059669':k.status==='rejected'?'background:#fef2f2;color:#dc2626':'background:#fefce8;color:#d97706'}">${k.status==='approved'?'✅ Approved':k.status==='rejected'?'❌ Rejected':'⏳ Pending'}</div>
      </div>
      ${k.photo_url ? `
      <div style="position:relative;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:10px">
        <img src="${k.photo_url}"
          style="width:100%;height:auto;max-height:420px;object-fit:contain;display:block;border-radius:13px"
          onerror="this.parentNode.innerHTML='<div style=\\'padding:20px;text-align:center;color:#94a3b8;font-size:12px\\'>⚠️ Photo failed to load</div>'">
        <a href="${k.photo_url}" onclick="openLink(this.href);return false;"
          style="position:absolute;top:8px;right:8px;background:rgba(15,23,42,.65);backdrop-filter:blur(6px);border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;color:#fff;text-decoration:none;cursor:pointer">
          🔍 Full View
        </a>
      </div>` : `<div style="font-size:11px;color:#f59e0b;background:rgba(245,158,11,.08);border-radius:6px;padding:6px 10px;margin-bottom:10px">⚠️ কোনো ছবি নেই</div>`}
      ${k.status==='pending' ? `
      <div style="display:flex;gap:8px">
        <button data-kid="${k.id}" data-kuid="${k.uid}" data-kaction="approve" style="flex:1;background:linear-gradient(135deg,#059669,#047857);border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;color:#fff;cursor:pointer">✅ Approve</button>
        <button data-kid="${k.id}" data-kuid="${k.uid}" data-kaction="reject" style="flex:1;background:linear-gradient(135deg,#dc2626,#b91c1c);border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;color:#fff;cursor:pointer">❌ Reject</button>
      </div>` : ''}
    </div>`).join('');

    c.querySelectorAll('[data-kid]').forEach(btn=>{
      btn.onclick = async ()=>{
        btn.disabled = true;
        const kid = btn.dataset.kid, kuid = btn.dataset.kuid, kaction = btn.dataset.kaction;
        const newStatus = kaction==='approve' ? 'approved' : 'rejected';
        try{
          const {error:e1} = await sb.from('kyc_submissions').update({status:newStatus}).eq('id',kid);
          if(e1) throw e1;
          const {error:e2} = await sb.from('users').update({kyc_status:newStatus}).eq('id',kuid);
          if(e2) throw e2;
          // ইউজারকে জানিয়ে দেওয়া (push notification, 'general' category)
          if(kaction==='approve'){
            await sendPushToUser(kuid, '✅ KYC Verified!', `আপনার Identity Verification অনুমোদিত হয়েছে — এখন যেকোনো পরিমাণ withdraw করতে পারবেন।`, '', 'general');
          } else {
            await sendPushToUser(kuid, '❌ KYC Rejected', `আপনার Identity Verification প্রত্যাখ্যাত হয়েছে — Profile পেজ থেকে আবার clear ছবি দিয়ে চেষ্টা করুন।`, '', 'general');
          }
          toast(kaction==='approve'?'✅ Approved!':'❌ Rejected!','s');
          loadAdminContent();
        }catch(e){
          toast('Error: '+e.message,'e');
          btn.disabled = false;
        }
      };
    });
  }catch(e){
    c.innerHTML=`<div class="empty"><div class="ein">⚠️</div><div class="etx">Error: ${e.message}</div></div>`;
  }
}

async function loadWithdrawals(c){
  c.innerHTML='<div style="text-align:center;padding:20px;color:#64748b">⏳ Loading...</div>';
  try{
    // Supabase থেকে সব withdrawals নাও — pending আগে
    const {data, error} = await sb
      .from('withdrawals')
      .select('*')
      .order('created_at', {ascending: false})
      .limit(50);
    if(error) throw error;
    const items = data || [];
    if(!items.length){
      c.innerHTML=`<div class="empty"><div class="ein">💸</div><div class="etx">${T('nuw')}</div></div>`;
      return;
    }
    // Pending গুলো আগে দেখাও
    const sorted = [...items].sort((a,b)=>{
      if(a.status==='pending' && b.status!=='pending') return -1;
      if(b.status==='pending' && a.status!=='pending') return 1;
      return new Date(b.created_at)-new Date(a.created_at);
    });
    c.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button id="exportWdBtn" class="btn bh" style="width:auto;padding:0 16px">📥 Export CSV</button>
    </div>` + sorted.map(w=>`<div class="arow">
      <div class="arow-l">
        <div class="fw6 sm">${escapeHtml(w.user_email||w.uid)} — <span class="cy">${fmt$(w.amount)}</span></div>
        <div class="xs mu">${CFG.methodEmoji[w.method]||escapeHtml(w.method)||'—'} · ${escapeHtml(w.account)||'—'}</div>
        <div class="xs mu">🗓 ${fmtD(w.created_at)} · ID: ${(w.id||'').slice(0,8)}</div>
      </div>
      <div class="arow-bt">
        <span class="bdg ${w.status==='approved'?'bdg2':w.status==='rejected'?'bdr':'bdy'}">${w.status==='approved'?'✅ '+T('apd'):w.status==='rejected'?'❌ '+T('rjd'):'⏳ '+T('pd')}</span>
        ${w.status==='pending'?`<button class="btn bg bau bsm" data-wid="${w.id}" data-waction="approve">${T('apr')}</button><button class="btn br bau bsm" data-wid="${w.id}" data-waction="reject">${T('rej')}</button>`:''}
      </div>
    </div>`).join('');
    document.getElementById('exportWdBtn').onclick = ()=>{
      const csvRows = sorted.map(w=>({
        ID: w.id, 'User Email': w.user_email||w.uid, 'User Name': w.user_name||'',
        'Amount ($)': parseFloat(w.amount||0).toFixed(2),
        Method: w.method, Account: w.account, Status: w.status,
        Date: fmtD(w.created_at),
      }));
      exportToCSV(csvRows, `earnova-withdrawals-${new Date().toISOString().slice(0,10)}.csv`);
    };
    c.querySelectorAll('[data-wid]').forEach(btn=>{
      btn.onclick=async()=>{
        btn.disabled=true;
        const wid=btn.dataset.wid, waction=btn.dataset.waction;
        const newStatus = waction==='approve'?'approved':'rejected';
        const {error} = await sb.from('withdrawals').update({status:newStatus}).eq('id',wid);
        if(error){ toast('Error: '+error.message,'e'); btn.disabled=false; return; }
        // ── Approve হলে stats.total_paid_out বাড়ানো (Home পেজের "Total Paid to Users" কাউন্টার এখান থেকেই সঠিক total পায়) ──
        // ⚠️ এখানে atomic_increment RPC ব্যবহার করা হচ্ছে (একই ফাংশন যেটা
        // ইউজারের ব্যালেন্স বাড়াতে ব্যবহার হয়, db.js এর atomicIncrement() দেখুন)
        // — সরাসরি "read করে তারপর write" করলে দুইজন admin একসাথে ২টা
        // withdrawal approve করলে একটা আপডেট হারিয়ে যেতে পারত (race condition)।
        if(waction==='approve'){
          const w = sorted.find(x=>x.id===wid);
          const amt = parseFloat(w?.amount||0);
          if(amt>0){
            try{
              const {error:rpcErr} = await sb.rpc('atomic_increment', {
                p_table:'stats', p_id:'stats', p_field:'total_paid_out', p_delta:amt
              });
              if(rpcErr){
                // RPC না থাকলে ফলব্যাক (কম নিরাপদ, কিন্তু কাজ চালানোর জন্য যথেষ্ট)
                const {data:stData} = await sb.from('stats').select('total_paid_out').eq('id','stats').maybeSingle();
                const curTotal = parseFloat(stData?.total_paid_out||0);
                await sb.from('stats').upsert({id:'stats', total_paid_out: curTotal+amt}, {onConflict:'id'});
              }
              EZCache.invalidateAll(); // যাতে Home পেজে পরের বার fresh total দেখায়
            }catch(e){ /* stats আপডেট fail হলেও withdrawal approval আটকাবে না */ }
          }
        }
        toast(waction==='approve'?'✅ Approved!':'❌ Rejected!','s');
        loadAdminContent();
      };
    });
  }catch(e){
    c.innerHTML=`<div class="empty"><div class="ein">⚠️</div><div class="etx">Error: ${e.message}</div></div>`;
  }
}

async function loadAdminNotices(c){
  c.innerHTML=`<div class="card mb12">
    <div class="card-hd">📢 ${T('pn')}</div>
    <textarea class="inp" id="adnTxt" placeholder="${T('an')}" rows="3"></textarea>
    <button class="btn bp" id="adnPost">${T('pn')}</button>
  </div>
  <div id="adnList"></div>`;
  $('#adnPost').onclick=async()=>{
    const txt=$('#adnTxt').value.trim();
    if(!txt){ toast('Write something','w'); return; }
    const nid = crypto.randomUUID ? crypto.randomUUID() : ('n_'+Date.now());
    const nRef=fDB.ref('notices/'+nid);
    await nRef.set({id:nid, text:txt, created_at:Date.now(), posted_by:S.user.uid});
    toast('Notice posted!','s');
    $('#adnTxt').value='';
    loadAdminNoticeList();
  };
  loadAdminNoticeList();
}

async function loadAdminNoticeList(){
  const l=$('#adnList'); if(!l) return;
  const snap=await fDB.ref('notices').orderByChild('created_at').limitToLast(10).once('value');
  const data=snap.val()||{};
  const items=Object.entries(data).map(([id,v])=>({...v,id}))
    .sort((a,b)=>(b.created_at||b.createdAt||0)-(a.created_at||a.createdAt||0));
  if(!items.length){ l.innerHTML=`<div class="empty"><div class="ein">📭</div><div class="etx">${T('nun2')}</div></div>`; return; }
  l.innerHTML=items.map(n=>`<div class="arow">
    <div class="arow-l"><div class="sm">${escapeHtml(n.text)}</div><div class="xs mu mt8">${fmtD(n.created_at||n.createdAt)}</div></div>
    <button class="btn br bau bsm" data-del-n="${n.id}">✕</button>
  </div>`).join('');
  l.querySelectorAll('[data-del-n]').forEach(btn=>{
    btn.onclick=async()=>{
      await fDB.ref(`notices/${btn.dataset.delN}`).remove();
      toast('Deleted','s'); loadAdminNoticeList();
    };
  });
}

async function loadAdminOffers(c){
  const snap=await fDB.ref('offers').once('value');
  const data=snap.val()||{};
  const all=[];
  Object.entries(data).forEach(([uid,offers])=>{
    Object.values(offers||{}).forEach(o=>all.push({...o,uid}));
  });
  all.sort((a,b)=>b.completedAt-a.completedAt);
  if(!all.length){ c.innerHTML=`<div class="empty"><div class="ein">📋</div><div class="etx">${T('nuo')}</div></div>`; return; }
  c.innerHTML=`<div class="card-hd">${T('oflist')}</div>`+all.slice(0,30).map(o=>`<div class="arow" data-ouid="${o.uid}" data-owid="${o.wallId}" data-oid="${o.id}" style="cursor:pointer">
    <div class="arow-l">
      <div class="fw6 sm">${o.uid?.slice(0,8)||'?'}… · ${S.wallData[o.wallId]?.name||o.wallId}</div>
      <div class="xs mu mt8">${fmt$(o.amount)} · ${fmtD(o.completedAt)}</div>
    </div>
    <span class="bdg bdg2">${T('apd')}</span>
  </div>`).join('');
  // Click on offer → show smartlink ad
  c.querySelectorAll('[data-oid]').forEach(row=>{
    row.onclick=()=>{
      startAd(null,'unlock',null);
    };
  });
}

