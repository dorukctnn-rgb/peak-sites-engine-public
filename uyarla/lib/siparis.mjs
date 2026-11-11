// Siparis baglantisi (hizli-gundelik restoranlar): isletmenin GERCEK online siparis baglantisi (kendi sistemi ya da Deliveroo, Uber Eats, Just Eat, Menulog, DoorDash, Flipdish, Order YoYo...).
// Rezervasyon degil; kategori sablonlarinin tek ana eylemi "siparis ver" bu baglantiya gider.  Baglanti bulunamazsa sablon telefonu ana eylem yapar.
// [ad, tur, adres deseni].  tur: 'siparis' (online siparis / paket / kurye) ya da 'rezervasyon' (masa).  Deneme turu (11 Kas) sonrasi genisletildi:
// Order YoYo, Mobi2Go, Wowapps, Deliveroo, Uber Eats, Just Eat, DoorDash, Menulog, Square Online, Toast, ChowNow, Flipdish, Gloria Food;
// OpenTable, SevenRooms, NowBookIt, ResDiary, Quandoo, TheFork (+ Resy, Tock, Dimmi, Zenchef, TableIn, Bookatable, EatApp, Resos ...).
export const PLATFORMLAR = [
  ['Order YoYo', 'siparis', /orderyoyo\./i], ['Mobi2Go', 'siparis', /mobi2go\./i], ['Wowapps', 'siparis', /wowapps?\./i],
  ['deliveroo', 'siparis', /deliveroo\./i], ['Uber Eats', 'siparis', /ubereats\.com|uber\.com\/[a-z-]*\/store/i], ['Just Eat', 'siparis', /just-?eat\./i], ['Menulog', 'siparis', /menulog\./i], ['DoorDash', 'siparis', /doordash\./i],
  ['Flipdish', 'siparis', /flipdish/i], ['Square Online', 'siparis', /square\.site|squareup\.com\/store|\.square\.online/i], ['Toast', 'siparis', /toasttab\.com|toast\.site/i], ['ChowNow', 'siparis', /chownow\./i],
  ['GloriaFood', 'siparis', /gloriafood|restaurantlogin\.com|(?:^|\/\/)order\.online|foodbooking\.com\/ordering/i],
  ['Delivereasy', 'siparis', /delivereasy\./i], ['me&u', 'siparis', /meandu\.app|mryum\.com|mr-?yum/i], ['Bopple', 'siparis', /bopple\./i], ['HungryHungry', 'siparis', /hungryhungry\.com\/(?!reserv)/i],
  ['Slerp', 'siparis', /slerp\./i], ['Storekit', 'siparis', /storekit\./i], ['Foodhub', 'siparis', /foodhub\./i], ['Nextorder', 'siparis', /nextorder\./i], ['ChefHero', 'siparis', /chefhero\./i], ['Wolt', 'siparis', /wolt\.com\/[a-z]{2}\/[a-z]{3}\/[a-z-]+\/restaurant/i], ['OrderMeal', 'siparis', /ordermeal\./i], ['Lightspeed Order', 'siparis', /lightspeedhq\.[a-z.]+\/order|\.lightspeedr?esto\./i], ['Shopify', 'siparis', /myshopify\.com/i],
  ['OpenTable', 'rezervasyon', /opentable\.[a-z.]+/i], ['SevenRooms', 'rezervasyon', /sevenrooms\./i], ['NowBookIt', 'rezervasyon', /nowbookit\./i], ['ResDiary', 'rezervasyon', /resdiary\./i], ['Quandoo', 'rezervasyon', /quandoo\./i], ['TheFork', 'rezervasyon', /thefork\.|lafourchette\./i],
  ['Resy', 'rezervasyon', /resy\.com/i], ['Tock', 'rezervasyon', /exploretock\.com|tock\.com/i], ['Dimmi', 'rezervasyon', /dimmi\.com/i], ['Zenchef', 'rezervasyon', /zenchef\./i], ['TableIn', 'rezervasyon', /tablein\./i], ['Bookatable', 'rezervasyon', /bookatable\./i],
  ['EatApp', 'rezervasyon', /eatapp\.co/i], ['Resos', 'rezervasyon', /resos\.com/i], ['Dineplan', 'rezervasyon', /dineplan\./i], ['TableAgent', 'rezervasyon', /tableagent\./i], ['Bookingsplus', 'rezervasyon', /bookingsplus\./i], ['HungryHungry', 'rezervasyon', /hungryhungry\.com\/reserv/i],
  // TR (cikarici-guclendir #2 birlesince): Yemeksepeti, Getir, Trendyol, Migros Yemek.  WhatsApp (wa.me) burada DEGIL: yalniz TR yolunda (lib/siparis-tr.mjs) gercek eylem sayilir.
  ['Yemeksepeti', 'siparis', /yemeksepeti\.com\/(?!$)/i], ['Getir Yemek', 'siparis', /getir\.com\/(?:yemek|restoran)|getiryemek/i], ['Trendyol Yemek', 'siparis', /tgoyemek\.com\/|trendyol\.com\/yemek|trendyolyemek/i], ['Migros Yemek', 'siparis', /migros\.com\.tr\/yemek|migrosyemek/i],
  ['Yelp', 'rezervasyon', /yelp\.com\/reservations/i], ['Mapp', 'rezervasyon', /\.mapp\.[a-z]+\/|mapp\.[a-z]+\/book/i], ['Gloria Food (rezervasyon)', 'rezervasyon', /foodbooking\.com\/(?!ordering)/i],
];
const PLATFORM = PLATFORMLAR.filter((p) => p[1] === 'siparis').map(([n, , re]) => [n, re]);
const ORDER_PATH = /\/(order|order-online|online-order|ordering|takeaway|click-and-collect|clickandcollect|delivery|shop)(\/|$|\?)/i;
const ORDER_TEXT = /\b(order (now|online|here|food|takeaway|delivery|ahead|for (pickup|collection|delivery))|click\s?(&|and)\s?collect|order)\b/i;
const NOT = /(gift|voucher|career|job|catering|merch|franchis|facebook|instagram|tiktok|mailto:|tel:|#)/i;

export function platformOf(url) { for (const [n, re] of PLATFORM) if (re.test(url)) return n; return null; }
// url bir siparis ya da rezervasyon saglayicisinin mi? -> { ad, tur } | null
export function saglayiciOf(url) { for (const [ad, tur, re] of PLATFORMLAR) if (re.test(url)) return { ad, tur }; return null; }

// links: [{href, text}], base: sayfa adresi.  -> { url, platform, text, external } | null
export function siparisBul(links, base) {
  const host = (() => { try { return new URL(base).host.replace(/^www\./, ''); } catch { return ''; } })();
  const cands = [];
  for (const l of links || []) {
    let u; try { u = new URL(l.href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const blob = `${u.href} ${l.text || ''}`;
    if (NOT.test(blob) && !platformOf(u.href)) continue;
    const plat = platformOf(u.href);
    const ext = u.host.replace(/^www\./, '') !== host;
    // kendi sitenin ana sayfasina giden baglanti ("Cafe, Take Away, order online" gibi baslik ya da logo baglantisi) siparis baglantisi DEGILDIR (deneme turu: Macaris)
    if (!ext && !plat && (u.pathname === '/' || u.pathname === '' || /^\/index\.(?:html?|php|aspx?)$/i.test(u.pathname))) continue;
    let score = 0;
    if (plat) score += plat === 'Flipdish' && !ext ? 5 : 4;
    if (ORDER_PATH.test(u.pathname)) score += 3;
    if (ORDER_TEXT.test(l.text || '')) score += 3;
    if (/\.(pdf|jpe?g|png|webp|css|js|ico)(\?|$)/i.test(u.pathname)) continue;
    if (!score) continue;
    // kendi sistemi (ayni alan ya da isletme adli alt alan) one gecer; sonra platformlar
    if (!ext || (host && u.host.includes(host.split('.')[0]))) score += 2;
    cands.push({ url: u.href, platform: plat || (ext ? u.host.replace(/^www\./, '') : 'own'), text: String(l.text || '').replace(/\s+/g, ' ').trim().slice(0, 40), external: ext, score });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0] || null;
}

// HTML'den baglanti listesi (tarayicisiz yol)
export function linklerHtml(html) {
  return [...String(html || '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) }));
}

// ---- 12 Kas 2026 (cikarici guclendirme): <a> disinda da ara ----
// Deneme turu: 42 adayin 12'sinde "gercek siparis ya da rezervasyon baglantisi yok".  Baglanti cogu zaman <a> degildi: gomulu pencere (iframe), betik
// yuklemesi (OpenTable / SevenRooms widget), data-href, onclick ve JSON icindeydi.  Sitenin HTML'inin her yerinde bilinen saglayicilarin adresleri aranir.
const HTML_ADRES = /(?:https?:)?\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[/?][^\s"'<>\\)]*)?/gi;
const KAYNAK_RED = /\.(?:css|js|png|jpe?g|gif|svg|webp|woff2?|ico|json|xml)(?:\?|$)/i;
// html -> [{ url, platform, tur, kanit }] (ayni adres bir kez; saglayici ana sayfasi ve statik dosyalar degil)
export function saglayiciBaglantilari(html, base) {
  const out = []; const seen = new Set(); const h = String(html || '').replace(/\\\//g, '/').replace(/&amp;/g, '&').replace(/<!--[\s\S]*?-->/g, ' ');
  for (const m of h.matchAll(HTML_ADRES)) {
    let raw = m[0].replace(/[.,;:)]+$/, ''); if (raw.startsWith('//')) raw = `https:${raw}`;
    const sg = saglayiciOf(raw); if (!sg) continue;
    let u; try { u = new URL(raw, base); } catch { continue; }
    if (KAYNAK_RED.test(u.pathname)) continue;
    if (/gift|voucher|giftcard|card-selection/i.test(`${u.host}${u.pathname}`)) continue; // hediye karti satisi (giftcards.nowbookit.com) siparis ya da rezervasyon degil
    const idx = m.index; const onceki = h.slice(Math.max(0, idx - 90), idx).toLowerCase();
    if (/rel=["'](?:preconnect|dns-prefetch|preload|stylesheet|canonical|alternate)["'][^>]*$/.test(onceki) || /<link\b[^>]*$/.test(onceki)) continue; // baglanti ipucu, sayfa degil
    if ((u.pathname === '/' || u.pathname === '') && !u.search) continue; // saglayicinin ana sayfasi isletmenin baglantisi degil
    let url = u.href;
    // OpenTable widget yukleyicisi (betik) -> restoranin rezervasyon sayfasi
    const rid = /opentable\.[a-z.]+\/widget\/reservation\/loader\?[^#]*\brid=(\d+)/i.exec(url); if (rid) url = `https://www.opentable.com/restref/client/?rid=${rid[1]}`;
    if (seen.has(url)) continue; seen.add(url);
    const kanit = /<iframe\b[^>]*$/.test(onceki) ? 'iframe' : /<script\b[^>]*$/.test(onceki) ? 'betik' : /href=["']?$/.test(onceki) ? 'baglanti' : 'metin';
    out.push({ url, platform: sg.ad, tur: sg.tur, kanit });
  }
  return out;
}

// baglantilar ([{href,text}]) + html -> { siparis, rezervasyon }: her biri { url, platform, text, external, kanit } | null
export function eylemAdaylari({ links = [], html = '', base }) {
  const host = (() => { try { return new URL(base).host.replace(/^www\./, ''); } catch { return ''; } })();
  const siparis = siparisBul(links, base);
  const sg = saglayiciBaglantilari(html, base);
  const hatS = sg.filter((x) => x.tur === 'siparis'); const hatR = sg.filter((x) => x.tur === 'rezervasyon');
  const ext = (u) => { try { return new URL(u).host.replace(/^www\./, '') !== host; } catch { return true; } };
  const sip = siparis || (hatS[0] ? { url: hatS[0].url, platform: hatS[0].platform, text: '', external: ext(hatS[0].url), kanit: hatS[0].kanit } : null);
  if (sip && !sip.kanit) sip.kanit = 'baglanti';
  const rez = hatR[0] ? { url: hatR[0].url, platform: hatR[0].platform, text: '', external: ext(hatR[0].url), kanit: hatR[0].kanit } : null;
  return { siparis: sip, rezervasyon: rez };
}

// ---- baglanti canlilik denemesi: YALNIZ ag istegi (HEAD, gerekirse tek GET); polite robots.txt'e uyar ve istekleri aralar ----
// durum: 'canli' (2xx/3xx), 'muhtemelen-canli' (Cloudflare 403: bot korumasi, sayfa vardir), 'dogrulanamadi' (robots, baska 403/401/429, 5xx, zaman asimi), 'olu' (404/410, DNS yok, ana sayfaya yonlendi)
export async function baglantiDogrula(url, polite) {
  let r; try { r = await polite.head(url); } catch (e) { r = { ok: false, hata: String(e.message).slice(0, 40) }; }
  const at = new Date().toISOString().slice(0, 10);
  if (!r) return { durum: 'dogrulanamadi', neden: 'yanit yok', at };
  if (r.robots) return { durum: 'dogrulanamadi', neden: `robots.txt izin vermiyor (${r.why})`, at };
  if (r.hata) return { durum: /ENOTFOUND|EAI_AGAIN|CERT|ERR_TLS|UNABLE_TO_VERIFY|ECONNREFUSED/i.test(r.hata) ? 'olu' : 'dogrulanamadi', neden: r.hata, at };
  const st = r.status;
  if (st >= 200 && st < 400) {
    try { const f = new URL(r.finalUrl); const o = new URL(url); if ((f.pathname === '/' || f.pathname === '') && f.host === o.host && o.pathname.split('/').filter(Boolean).length >= 2) return { durum: 'olu', status: st, neden: `ana sayfaya yonlendi (${f.href.slice(0, 80)})`, yontem: r.yontem, at }; } catch { /* url okunamadi */ }
    return { durum: 'canli', status: st, yontem: r.yontem, at };
  }
  if (st === 404 || st === 410) return { durum: 'olu', status: st, yontem: r.yontem, at };
  if (st === 403 && r.cf) return { durum: 'muhtemelen-canli', status: st, neden: 'Cloudflare 403 (bot korumasi); sayfa vardir ama bu istemciye acilmiyor', yontem: r.yontem, at };
  return { durum: 'dogrulanamadi', status: st, neden: st === 403 ? '403 (bot korumasi, Cloudflare degil)' : `http ${st}`, yontem: r.yontem, at };
}
