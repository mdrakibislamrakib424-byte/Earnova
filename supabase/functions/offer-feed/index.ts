// ══════════════════════════════════════════════════════════
// EARNOVA — offer-feed  (Phase 4: offerwall feeds fetched on the SERVER)
// ══════════════════════════════════════════════════════════
// Why: the offerwall API key used to sit inside the app and travel through a public proxy.
// Now: the key lives only in the Supabase Secret  OFFER_CREDS  and the app asks THIS function.
//   • caller must be a logged-in, non-banned user (public anon key is rejected)
//   • result is cached in table offer_feed_cache for 30 min (shared by all users of a country)
//   • only https/http links are returned, text is length-limited
// Secret format (Dashboard → Edge Functions → Secrets → OFFER_CREDS):
//   {"cpagrip":{"userId":"12345","key":"abcdef..."}}      ← add other platforms the same way
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPA_URL              = Deno.env.get('SUPA_URL') ?? Deno.env.get('SUPABASE_URL')!;
const SUPA_SERVICE_ROLE_KEY = Deno.env.get('SUPA_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(SUPA_URL, SUPA_SERVICE_ROLE_KEY);

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://localhost,capacitor://localhost,http://localhost')
  .split(',').map((s) => s.trim()).filter(Boolean);
function corsHeaders(req: Request): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Vary': 'Origin',
  };
  const o = req.headers.get('Origin') ?? '';
  if (ALLOWED_ORIGINS.includes(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
}

// <<TESTABLE-START
// ── tiny XML reader (no library): gives the same querySelector/textContent shape the parsers expect ──
function xmlText(raw: string): string {
  const m = raw.trim().match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (m) return m[1];
  return raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
            .replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&');
}
function xmlAttr(tag: string, name: string): string {
  const m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i'));
  return m ? xmlText(m[1] ?? m[2] ?? '') : '';
}
function xmlItem(frag: string): any {
  return {
    querySelector(name: string) {
      if (!/^[a-z_:]+$/i.test(name)) return null;
      const m = frag.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
      if (m) return { textContent: xmlText(m[1]), getAttribute: (a: string) => xmlAttr(m[0], a) };
      const s = frag.match(new RegExp('<' + name + '(\\s[^>]*)?/?>', 'i'));
      if (s) return { textContent: '', getAttribute: (a: string) => xmlAttr(s[0], a) };
      return null;
    },
  };
}
function xmlDoc(txt: string): any {
  return {
    querySelectorAll(sel: string) {
      if (sel !== 'item') return [];
      const out: any[] = [];
      const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(txt)) && out.length < 200) out.push(xmlItem(m[1]));
      return out;
    },
  };
}


const RSS_PLATFORMS: Record<string, any> = {
  cpagrip:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://www.cpagrip.com/common/offer_feed_rss.php?user_id=${c.userId}&key=${c.key}&country=${cc}&tracking_id=${uid}`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:it.querySelector('category')?.textContent||'CPA',
      img:it.querySelector('image_url')?.textContent||'',
    })),
  },
  ogads:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://ogads.com/wall/api?pub_id=${c.userId}&key=${c.key}&country=${cc}&subid=${uid}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'Mobile', img:'',
    })),
  },
  adgate:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://wall.adgaterewards.com/api/v1/offers?key=${c.key}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'AdGate',
      img:it.querySelector('enclosure')?.getAttribute('url')||'',
    })),
  },
  adscend:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://adscendmedia.com/api/v1/wall?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&user_id=${uid}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'Adscend', img:'',
    })),
  },
  mylead:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://mylead.global/api/offers?token=${c.key}&country=${cc}&user=${uid}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'MyLead', img:'',
    })),
  },
  adworkm:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://www.adworkmedia.com/api/offers?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&subid=${uid}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'Premium', img:'',
    })),
  },
  cpalead:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://cpalead.com/dashboard/reports/camp_rss.php?id=${c.userId}&country=${cc}&subid=${uid}`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'CPALead', img:'',
    })),
  },
  offertoro:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://www.offertoro.com/api/serve/json/${c.userId}/${c.key}/${uid}?country=${cc}`,
    parse:(json:any)=>{
      const items=json?.offers||json?.data||[];
      return items.map((o:any)=>({
        title:o.name||o.title||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.offer_url||o.link||'',
        payout:parseFloat(o.payout||o.points||'0'),
        category:o.category||'OfferToro',
        img:o.picture||o.image||'',
      }));
    },
    isJson:true,
  },
  lootably:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://lootably.com/api/offers?placementID=${c.key}&userID=${uid}&country=${cc}&format=json`,
    parse:(json:any)=>{
      const items=json?.data||json?.offers||[];
      return items.map((o:any)=>({
        title:o.name||o.title||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.tracking_url||o.link||'',
        payout:parseFloat(o.payout||'0'),
        category:o.category||'Lootably',
        img:o.image_url||'',
      }));
    },
    isJson:true,
  },
  revuniv:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://www.revenueuniverse.com/api/wall?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&user_id=${uid}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'RevUniverse', img:'',
    })),
  },
  ayetstud:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://www.ayetstudios.com/api/feed?api_key=${c.key}&pub_id=${c.userId}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'Ayet', img:it.querySelector('image_url')?.textContent||'',
    })),
  },
  wannads:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://wannads.com/api/offers?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&subid=${uid}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'WannAds', img:'',
    })),
  },
  timewall:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://api.timewall.io/v1/offers?api_key=${c.key}&publisher_id=${c.userId}&country=${cc}&user_id=${uid}&format=json`,
    parse:(json:any)=>{
      const items=json?.offers||json?.data||[];
      return items.map((o:any)=>({
        title:o.title||o.name||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.offer_url||o.click_url||'',
        payout:parseFloat(o.payout||'0'),
        category:o.category||'TimeWall',
        img:o.image||'',
      }));
    },
    isJson:true,
  },
  kiwiwall:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://www.kiwiwall.com/wall/api/?api_secret=${c.key}&user_id=${uid}&country=${cc}`,
    parse:(json:any)=>{
      const items=json?.offers||json?.data||[];
      return items.map((o:any)=>({
        title:o.name||o.title||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.click_url||o.link||'',
        payout:parseFloat(o.payout||'0'),
        category:o.type||'KiwiWall',
        img:o.image||'',
      }));
    },
    isJson:true,
  },
  monlix:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://monlix.com/api/v3/offers?app_id=${c.userId}&api_key=${c.key}&uid=${uid}&country=${cc}`,
    parse:(json:any)=>{
      const items=json?.data?.offers||json?.offers||[];
      return items.map((o:any)=>({
        title:o.name||o.title||'',
        desc:(o.description||'').replace(/<[^>]*>/g,'').trim(),
        link:o.link||o.click_url||'',
        payout:parseFloat(o.payout||'0'),
        category:o.category||'Monlix',
        img:o.image||'',
      }));
    },
    isJson:true,
  },
  taprain:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://taprain.com/api/offers?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&user_id=${uid}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'TapRain', img:'',
    })),
  },
  ofwallme:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://offerwall.me/api/offers?api_key=${c.key}&pub_id=${c.userId}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'OfferWall', img:'',
    })),
  },
  ofwallinfo:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://offerwall.info/api/offers?api_key=${c.key}&publisher_id=${c.userId}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'OfferWall', img:'',
    })),
  },
  adwebm:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://adswebmedia.com/api/offers?pub_id=${c.userId}&api_key=${c.key}&country=${cc}&user_id=${uid}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'AdsWebMedia', img:'',
    })),
  },
  ofwallcom:{
    buildUrl:(c:any,cc:string,uid:string)=>`https://offerwall.com/api/offers?api_key=${c.key}&pub_id=${c.userId}&user_id=${uid}&country=${cc}&format=rss`,
    parse:(xml:any)=>[...xml.querySelectorAll('item')].map((it:any)=>({
      title:it.querySelector('title')?.textContent||'',
      desc:(it.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').trim(),
      link:it.querySelector('link')?.textContent||'',
      payout:parseFloat(it.querySelector('payout')?.textContent||'0'),
      category:'OfferWall', img:'',
    })),
  },
};

const UID_TOKEN = 'EZUIDTOKEN';           // placeholder; replaced with the real user id per request

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1000) : 0;
}
function cleanOffers(list: any[]): any[] {
  const out: any[] = [];
  for (const o of list || []) {
    const title = String(o?.title ?? '').trim().slice(0, 160);
    const link  = String(o?.link ?? '').trim();
    if (!title || !/^https?:\/\//i.test(link) || link.length > 1500) continue;
    const img = String(o?.img ?? '').trim();
    out.push({
      title,
      desc: String(o?.desc ?? '').slice(0, 400),
      link,
      payout: num(o?.payout),
      category: String(o?.category ?? '').slice(0, 40),
      img: /^https?:\/\//i.test(img) && img.length < 1000 ? img : '',
    });
    if (out.length >= 100) break;
  }
  return out;
}
// TESTABLE-END>>

const CACHE_MS = 30 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { offers: [], error: 'POST only' }, 405);

  // logged-in, non-banned user only
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(req, { offers: [], error: 'Unauthorized' }, 401);
  const { data: auth, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !auth?.user) return json(req, { offers: [], error: 'Unauthorized' }, 401);
  const userId = auth.user.id;
  const { data: me } = await supabaseAdmin.from('users').select('banned').eq('id', userId).maybeSingle();
  if (!me || me.banned === true) return json(req, { offers: [], error: 'Forbidden' }, 403);

  let payload: any;
  try { payload = await req.json(); } catch { return json(req, { offers: [], error: 'Invalid JSON' }, 400); }

  const platform = String(payload?.platform ?? '');
  const plat = RSS_PLATFORMS[platform];
  if (!plat) return json(req, { offers: [] });

  let creds: any = null;
  try { creds = JSON.parse(Deno.env.get('OFFER_CREDS') ?? '{}')[platform]; } catch { creds = null; }
  if (!creds || !creds.key) return json(req, { offers: [] });       // platform not configured

  // country: Cloudflare's header when present, otherwise what the app detected
  const hdr = (req.headers.get('cf-ipcountry') ?? '').toUpperCase();
  const given = String(payload?.country ?? '').toUpperCase();
  const cc = /^[A-Z]{2}$/.test(hdr) && hdr !== 'XX' && hdr !== 'T1' ? hdr : (/^[A-Z]{2}$/.test(given) ? given : 'US');
  const cacheKey = platform + ':' + cc;

  const { data: cached } = await supabaseAdmin.from('offer_feed_cache').select('data,fetched_at').eq('cache_key', cacheKey).maybeSingle();
  let offers: any[] | null = null;
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_MS) offers = cached.data as any[];

  if (!offers) {
    try {
      const url = plat.buildUrl(creds, cc, UID_TOKEN);
      const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 EARNOVA' } });
      if (!res.ok) throw new Error('upstream ' + res.status);
      let raw: any[];
      if (plat.isJson) {
        raw = plat.parse(await res.json()) || [];
      } else {
        const txt = (await res.text()).slice(0, 2_000_000);
        raw = plat.parse(xmlDoc(txt)) || [];
      }
      offers = cleanOffers(raw);
      await supabaseAdmin.from('offer_feed_cache').upsert({ cache_key: cacheKey, data: offers, fetched_at: new Date().toISOString() });
    } catch (e) {
      console.error('offer-feed upstream error:', platform, String(e));
      offers = cached ? (cached.data as any[]) : [];          // stale copy is better than nothing
    }
  }

  // put this user's id into the tracking links
  const uidEnc = encodeURIComponent(userId);
  const out = (offers || []).map((o) => ({ ...o, link: String(o.link).split(UID_TOKEN).join(uidEnc) }));
  return json(req, { offers: out });
});
