// 1. ADIM: CIKARICI.  node uyarla/cikar.mjs <slug|id|hepsi> [--force] [--out <klasor>] [--site <url> --name <ad> --lang tr|en --kind bar|restaurant|cafe --slug <ad>]
// Bir isletmenin herkese acik sitesinden: ad, logo, fotograflar (kucuk kopya), video, marka renkleri, fontlar, menu, saatler, adres, telefon, rezervasyon baglantisi;
// ayrica sitenin bugunku 1440 ve 390 ekran goruntusu. Dil modeli yok. Robots.txt'e uyulur, istekler tek tek ve aralikli yapilir (Polite), bir engel (403, 429, robots) asla asilmaz.
// Cikti: <out>/<slug>/cikarici.json + img/ (kucuk kopyalar) + once-*.jpg (ekran).  Biten isletme --force olmadan yeniden calistirilmaz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Polite } from './v2lib/polite.mjs';
import { jsonLd, metaContent, titleOf, decode, extractPhone, telefonMu, colourHints, stylesheets } from './v2lib/scrape.mjs';
import { sharp } from './lib/gorsel.mjs';
import { openBrowser, ziyaret } from './lib/ziyaret.mjs';
import { ldMenu, ldMenuUrls, menuLinks, menuFromText, pageIsMenu, groupMenu } from './lib/menu.mjs';
import { parseSaatler } from './lib/saat.mjs';
import { loadLeads, slugOf } from './lib/leads.mjs';
import { profil } from './sektor/index.mjs';
import { kapaliMi } from './lib/kapali.mjs';
import { siparisBul, eylemAdaylari, baglantiDogrula, linklerHtml } from './lib/siparis.mjs';
import { fotoTopla } from './lib/foto-topla.mjs';
import { logoAdaylari, logoSec } from './lib/logo-bul.mjs';
import { htmlToLines } from './v2lib/scrape.mjs';

export { VERI } from './lib/yol.mjs';
import { VERI } from './lib/yol.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const clean = (s, max = 200) => decode(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const types = (o) => [].concat(o && o['@type'] || []).map(String);
const BIZ = /^(Restaurant|BarOrPub|FoodEstablishment|CafeOrCoffeeShop|Bakery|Brewery|Winery|Distillery|NightClub|FastFoodRestaurant|IceCreamShop|LocalBusiness|Organization|Hotel)$/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- ad ----
function pickName(html, ld, host, leadName, siteName) {
  for (const o of ld) if (types(o).some((t) => BIZ.test(t)) && typeof o.name === 'string' && clean(o.name, 80).length >= 2) return { n: clean(o.name, 60), via: 'json-ld' };
  const og = siteName || metaContent(html, 'og:site_name');
  if (og && og.length >= 2 && og.length <= 60) return { n: clean(og, 60), via: 'og:site_name' };
  const core = host.replace(/^www\./, '').split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const parts = titleOf(html).split(/\s+[|–—:·•-]\s+|\s*\|\s*/).map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 60);
  const score = (p) => { const k = p.toLowerCase().replace(/[^a-z0-9ğüşöçı]/g, ''); return k && (core.includes(k.slice(0, 6)) || k.includes(core.slice(0, 6))) ? 2 : 0; };
  const best = parts.sort((a, b) => score(b) - score(a))[0];
  if (best && score(best)) return { n: best, via: 'title' };
  if (leadName) return { n: clean(leadName, 60), via: 'lead-list' };
  return best ? { n: best, via: 'title-guess' } : null;
}
const norm = (x) => String(x || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
// bitisik yazilmis ad (12 Kas 2026, hat mail sesi): sitenin adi "alexandermotorinn" gibi bosluksuz ve lead listesi (OSM) adi AYNI harflerle ama bosluklu ("Alexander Motor Inn") ise
// o kullanilir; sayfadaki ve maildeki ad ayni ve temiz olur.  -> duzeltilmis nm ya da ayni nm
export function adBitisikDuzelt(nm, leadName) {
  const lead = String(leadName || '').trim();
  if (!nm || !lead || /\s/.test(nm.n) || !/\s/.test(lead) || norm(nm.n) !== norm(lead) || nm.n === lead) return nm;
  return { ...nm, full: nm.n, n: clean(lead, 60), via: `${nm.via} (bitisik ad: lead listesi adi)` };
}

// ---- gorsel yardimcilari ----
const stripSize = (u) => u.replace(/-\d{2,4}x\d{2,4}(\.(?:jpe?g|png|webp))(\?|$)/i, '$1$2');
export function upgradeUrl(u) {
  try {
    const x = new URL(u);
    if (/static\.wixstatic\.com$/.test(x.host) && /\/media\/[^/]+~mv2\.\w+\/v1\//.test(x.pathname)) return `${x.origin}${x.pathname.split('/v1/')[0]}`;
    if (/squarespace-cdn\.com$/.test(x.host)) { x.search = '?format=2500w'; return x.href; }
    const s = stripSize(u);
    return s;
  } catch { return u; }
}

async function fetchBytes(polite, url, log) {
  const r = await polite.get(url, { maxBytes: 9_000_000, accept: 'image/*', binary: true });
  if (!r.ok) { log(`   gorsel yok: ${url.slice(0, 90)} (${r.why || r.status})`); return null; }
  return { buf: r.buf, type: String(r.type || '') };
}

// ---- adres ----
const STREET_EN = /\b\d{1,5}[A-Za-z]?(?:[-/]\d{1,4})?\s+(?:[A-Z][A-Za-z'’.]+\s+){0,3}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Place|Pl|Terrace|Tce|Highway|Hwy|Crescent|Cres|Court|Ct|Parade|Pde|Square|Sq|Quay|Esplanade|Mall|Row|Plaza|Circuit|Close)\b\.?/;
// TR adres (11 Kas 2026): Turkce harfle biten sozcukte \b calismaz ("Bulvarı No"), harf bakisi + u bayragi; Cd./Mh./Sokağı kisaltmalari
export const STREET_TR = /(?:Mah\.|Mahallesi|Mh\.|Cad\.|Caddesi|Cd\.|Sok\.|Sokak|Sokağı|Sk\.|Bulvarı|Blv\.|Bulvar)(?!\p{L}).*?(?:No\s?[:.]?\s?\d+|\d+)/iu;
// TR siparis baglantisi (Yemeksepeti, Getir, Trendyol, Migros Yemek, wa.me): ayri dosyada (ortak siparis.mjs cikarici-guclendir dalinda yeniden kuruluyor)
import { siparisBulTr, eylemAdaylariTr } from './lib/siparis-tr.mjs';
export function adresBul(lines, ld, lang) {
  for (const o of ld) {
    const a = o && o.address;
    if (a && typeof a === 'object' && (a.streetAddress || a.addressLocality)) {
      const t = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).map((x) => clean(x, 60)).join(', ');
      if (t.length > 6) return { text: t, via: 'json-ld' };
    } else if (typeof a === 'string' && a.length > 8) return { text: clean(a, 120), via: 'json-ld' };
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.length > 130 || l.length < 8) continue;
    const hit = (lang === 'tr' ? STREET_TR.test(l) : STREET_EN.test(l)) || (STREET_EN.test(l) && lang === 'tr');
    if (!hit || /@|https?:|\bam\b|\bpm\b|open|opening/i.test(l) && !STREET_EN.test(l)) continue;
    let text = l.replace(/^(address|adres|find us|visit us|location)\s*[:\-–]?\s*/i, '');
    const nx = lines[i + 1];
    if (nx && nx.length <= 60 && /\b(\d{4,5}|[A-Z]{2,3}\s?\d{4}|[A-Z]\d[A-Z]\s?\d[A-Z]\d|QLD|NSW|VIC|WA|SA|TAS|NT|ACT|NZ|Ireland|Dublin|Istanbul|İstanbul)\b/.test(nx) && !/\d{1,2}:\d{2}/.test(nx)) text = `${text}, ${nx}`;
    return { text: text.replace(/\s*,\s*,/g, ',').slice(0, 130), via: 'page' };
  }
  return null;
}

// ---- rezervasyon / sosyal ----
const RESV_HOST = /(opentable|resy\.com|sevenrooms|thefork|tock|quandoo|dineplan|zenchef|tablein|bookatable|yelp\.com\/reservations|tableagent|bookings?\.|reservations?\.|resos\.com|bookingsplus|eatapp|dimmi|hungryhungry|hotelrunner|rezzie|mapp)/i;
export function rezervasyonBul(links, base) {
  for (const l of links) {
    let u; try { u = new URL(l.href, base); } catch { continue; }
    const blob = `${u.href} ${l.text}`;
    if (!/^https?:$/.test(u.protocol)) continue;
    if (/(catering|function|event|enquir|private|gift|voucher|career|job|menu\b|pdf$)/i.test(blob) && !RESV_HOST.test(u.host + u.pathname)) continue;
    if (RESV_HOST.test(u.host + u.pathname) || /\b(book(ing)?( a)? table|reserve|reservations?|make a reservation|rezervasyon|masa ayırt|rezerve)\b/i.test(l.text) || /\/(reservations?|book(ing)?|rezervasyon|reserve)(\/|$|\?)/i.test(u.pathname)) return { url: u.href, text: clean(l.text, 40), external: u.host.replace(/^www\./, '') !== new URL(base).host.replace(/^www\./, '') };
  }
  return null;
}
export function sosyalBul(links) {
  const out = {};
  for (const l of links) {
    const h = l.href || '';
    let m = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{2,40})\/?(?:\?|$)/.exec(h);
    if (m && !out.instagram && !/^(p|reel|explore|accounts|about)$/i.test(m[1])) out.instagram = `https://www.instagram.com/${m[1]}/`;
    m = /^https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9_.\-]{2,60})\/?(?:\?|$)/.exec(h);
    if (m && !out.facebook && !/^(sharer|share|tr|plugins|dialog|login)/i.test(m[1])) out.facebook = `https://www.facebook.com/${m[1]}/`;
  }
  return out;
}

// ---- tek istek: HEAD (robots + aralik) ----
async function head(polite, url) {
  const a = await polite.allowed(url); if (!a.ok) return null;
  const u = new URL(url); await polite.wait(u.host); polite.count++;
  try { const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'PeakAppsStudioDraftBot/1.0 (+https://peakappsstudio.com/web/; info@peakappsstudio.com)' } }); return { ok: r.ok, status: r.status, type: r.headers.get('content-type') || '', len: Number(r.headers.get('content-length') || 0) }; } catch { return null; }
}

// ---- ana is ----
// bir sayfanin html'inden fotograf adresleri: <a href=buyuk.jpg> (lightbox), srcset'in en buyugu, data-src / src.  Ayni anda en cok 40.
export function imgUrlleri(html, base) {
  const out = new Set(); const h = String(html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const ekle = (u) => { try { const x = new URL(String(u).trim().split(/\s+/)[0], base); if (/^https?:$/.test(x.protocol) && /\.(jpe?g|png|webp)$/i.test(x.pathname)) out.add(x.href); } catch { /* bozuk adres */ } };
  for (const m of h.matchAll(/<a\b[^>]*href=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) ekle(m[1]);
  for (const m of h.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0]; const ss = /\b(?:data-)?srcset=["']([^"']+)["']/i.exec(t);
    if (ss) { const best = ss[1].split(',').map((s) => s.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 })).sort((a, b) => b.w - a.w)[0]; if (best && best.u) ekle(best.u); }
    const s = /\b(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)["']/i.exec(t); if (s) ekle(s[1]);
  }
  return [...out].slice(0, 40);
}

// olcum: true -> ekran goruntusu ve telefon ziyareti yok (yalniz malzeme: fotograf, logo, baglanti; hazirlik kapisi olcumu icin).  ziyaretFn: onbellekli ziyaret (olcum araci).
export async function cikar(lead, { browser, polite, out = VERI, force = false, log = console.log, olcum = false, ziyaretFn = ziyaret } = {}) {
  const dir = path.join(out, lead.slug);
  const jf = path.join(dir, 'cikarici.json');
  if (fs.existsSync(jf) && !force) { log(`atla (hazir): ${lead.slug}`); return JSON.parse(fs.readFileSync(jf, 'utf8')); }
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  const t0 = Date.now(); const startReq = polite.count;
  const SM = profil(lead);
  const R = { v: 2, slug: lead.slug, lead: { id: lead.id, sektor: lead.sektor || null, mutfak: lead.mutfak || null, name: lead.name, site: lead.site, kind: lead.kind, category: lead.category, lang: lead.lang, region: lead.region, city: lead.city, rating: lead.rating, reviews: lead.reviews }, fetchedAt: new Date().toISOString(), pages: [], notes: [] };
  const finish = () => { R.requests = polite.count - startReq; R.seconds = Math.round((Date.now() - t0) / 1000); fs.writeFileSync(jf, JSON.stringify(R, null, 1)); return R; };

  log(`>> ${lead.slug} ${lead.site}`);
  const shotD = { first: path.join(dir, 'once-1440-ham.png'), full: path.join(dir, 'once-1440-tam-ham.png') };
  const home = await ziyaretFn(browser, lead.site, { polite, lang: lead.lang, shotPath: olcum ? undefined : shotD });
  R.pages.push({ url: lead.site, status: home.ok ? home.status : home.why });
  if (!home.ok) { R.erisim = { ok: false, why: home.why || `http:${home.status}` }; return finish(); }
  R.erisim = { ok: true, status: home.status, finalUrl: home.finalUrl, thin: home.textLen < 300, textLen: home.textLen, cookie: home.cookie };
  const base = home.finalUrl; const host = new URL(base).host;
  const html = home.html; const ld = jsonLd(html);
  const lines = home.lines;
  const kapali = kapaliMi(lines.join(' \n ')); if (kapali) R.kapali = kapali;

  // ad ve cumle
  const nm = adBitisikDuzelt(pickName(html, ld, host, lead.name, home.meta.siteName), lead.name);
  if (nm && lead.name && norm(nm.n).startsWith(norm(lead.name)) && norm(lead.name).length >= 4 && nm.n.length > lead.name.length) { nm.full = nm.n; nm.n = clean(lead.name, 60); nm.via += ' (kisa ad: lead listesi)'; }
  // sitenin adres satiri ad diye alinmissa ("23 Main St,") isletmenin kendi (lead listesi) adi kullanilir
  if (nm && lead.name && (/^\d/.test(nm.n) || /,\s*$/.test(nm.n) || /\b(street|st|road|rd|avenue|ave|lane|ln|quay|terrace)\b\.?,?\s*$/i.test(nm.n))) { nm.full = nm.n; nm.n = clean(lead.name, 60); nm.via += ' (adres gibi: lead listesi adi)'; }
  R.name = nm;
  let tag = clean(home.meta.desc || home.meta.ogDesc || (ld.find((o) => typeof o.description === 'string') || {}).description || '', 400);
  if (/just another wordpress|lorem ipsum|coming soon|under construction|cookie|javascript|©|wix\.com|squarespace|^home$/i.test(tag) || /https?:|www\.|@/.test(tag) || tag.length < 25) tag = '';
  R.tagline = tag;
  // slogan adaylari (kahraman basligi icin): sitedeki gorunur kisa metinler + og:title/title/aciklama
  R.slogan = { cands: home.sloganAd || [], ogTitle: clean(home.meta.ogTitle || '', 160), title: clean(home.title || '', 160), desc: clean(home.meta.desc || home.meta.ogDesc || '', 400) };

  // renkler (sayfa + varsa bir stil dosyasi)
  const css = [];
  let hints = colourHints(html, css);
  if (!hints.theme && !hints.vars.length) {
    for (const u of stylesheets(html, base, 1)) { const r = await polite.get(u, { maxBytes: 700_000, accept: 'text/css' }); R.pages.push({ url: u, status: r.ok ? r.status : r.why }); if (r.ok) css.push(r.text); }
    hints = colourHints(html, css);
  }
  const FRAMEWORK = new Set(['#428bca', '#357ebd', '#337ab7', '#286090', '#2e6da4', '#23527c', '#007bff', '#0056b3', '#0069d9', '#0d6efd', '#0a58ca', '#6c757d', '#17a2b8', '#28a745', '#dc3545', '#ffc107', '#343a40', '#5cb85c', '#5bc0de', '#f0ad4e', '#d9534f', '#1779ba', '#2ba6cb', '#e7e7e7']);
  hints = { ...hints, theme: FRAMEWORK.has(hints.theme) ? null : hints.theme, vars: hints.vars.filter((v) => !FRAMEWORK.has(v.hex)), freq: hints.freq.filter((f) => !FRAMEWORK.has(f.hex)) };
  R.colours = { hints, computed: { body: home.style.body, h1: home.style.h1, h2: home.style.h2, btn: home.style.btn, link: home.style.link, header: home.style.header, footer: home.style.footer, nav: home.style.nav }, used: home.used, themeColor: home.meta.themeColor || null };

  // fontlar
  const gl = [...html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"')\s>]+)/gi)].map((m) => decode(m[1]));
  const googleFamilies = [];
  for (const q of gl) for (const f of q.matchAll(/family=([^&:;|]+)/g)) googleFamilies.push(decodeURIComponent(f[1]).replace(/\+/g, ' ').trim());
  const typekit = [...html.matchAll(/use\.typekit\.net\/([a-z0-9]+)\.css/gi)].map((m) => m[1]);
  const S = home.style;
  const stack = (x) => (x && x.family) || [];
  R.fonts = { loaded: home.fonts, googleFamilies: [...new Set(googleFamilies)], typekit, fontFiles: home.fontFiles.map((u) => decodeURIComponent(u.split('?')[0].split('/').pop())).slice(0, 20),
    stacks: { h1: stack(S.h1), h2: stack(S.h2), h3: stack(S.h3), nav: stack(S.nav), btn: stack(S.btn), p: stack(S.p), body: stack(S.body), logo: stack(S.logoText) },
    shown: { h1: S.h1 && S.h1.shown, h2: S.h2 && S.h2.shown, h3: S.h3 && S.h3.shown, nav: S.nav && S.nav.shown, btn: S.btn && S.btn.shown, p: S.p && S.p.shown, body: S.body && S.body.shown, logo: S.logoText && S.logoText.shown },
    heading: { transform: (S.h1 || S.h2 || {}).transform || null, weight: (S.h1 || S.h2 || {}).weight || null, style: (S.h1 || S.h2 || {}).style || null, spacing: (S.h1 || S.h2 || {}).spacing || null } };

  // telefon, adres, saat, rezervasyon, sosyal
  R.phone = extractPhone(html, ld) || null;
  if (!R.phone) { const m = lines.map((l) => /(?:^|\s)(\+?\d[\d\s().-]{7,17}\d)(?:\s|$)/.exec(l)).find((x) => x && (x[1].match(/\d/g) || []).length >= 8 && (x[1].match(/\d/g) || []).length <= 13 && telefonMu(x[1])); if (m) R.phone = m[1].trim(); }
  R.address = adresBul(lines, ld, lead.lang);
  R.hours = parseSaatler(lines, ld);
  R.reservation = rezervasyonBul(home.links, base);
  // restoran (v5 ve kategori sablonlari): gercek siparis baglantisi + sitenin kendi metni (icerik turu yalniz bunlari okur; ag acmaz)
  const restoranMi = !SM;
  if (restoranMi) { R.order = (lead.lang === 'tr' || lead.region === 'TR' ? siparisBulTr : siparisBul)(home.links, base); try { fs.writeFileSync(path.join(dir, '_home.txt'), lines.slice(0, 600).join('\n')); } catch { /* yazilamadi */ } }
  const altMetin = [];
  R.social = sosyalBul(home.links);

  // alt sayfalar (en fazla 3): menu ve (adres/saat/telefon eksikse) iletisim
  let menuItems = ldMenu(ld).map((x) => ({ ...x, page: base })); let menuVia = menuItems.length ? 'json-ld (ana sayfa)' : null;
  const menuPdfs = []; let menuPageUrl = null; const skipped = [];
  const cands = [...ldMenuUrls(ld, base).map((url) => ({ url, text: 'hasMenu', pdf: /\.pdf$/i.test(url), same: true })), ...menuLinks(home.links, base, SM && SM.MENU_SOZCUK ? SM.MENU_SOZCUK : undefined)];
  const tried = new Set([base]);
  const needContact = !R.address || !R.hours || !R.phone;
  const ekImgs = []; // oda / galeri gibi alt sayfalarda gorulen fotograflar (ana sayfada kullanilabilir foto azsa aday olur)
  const sayfalar = []; // okunan alt sayfalar { url, html, links } (fotograf, logo ve siparis baglantisi taramasi bunlari da okur)
  const sayfaOnbellek = new Map();
  async function sayfaAl(url) {
    if (sayfaOnbellek.has(url)) return sayfaOnbellek.get(url);
    const sonuc = await sayfaAlHam(url); sayfaOnbellek.set(url, sonuc);
    if (sonuc) sayfalar.push({ url: sonuc.finalUrl || url, html: sonuc.html, links: sonuc.links || linklerHtml(sonuc.html) });
    return sonuc;
  }
  async function sayfaAlHam(url) {
    const r = await polite.get(url, { maxBytes: 2_500_000, accept: 'text/html' });
    R.pages.push({ url, status: r.ok ? r.status : r.why });
    if (!r.ok || !/html|xml|text/.test(r.type || 'text/html')) return null;
    for (const u of imgUrlleri(r.text, r.finalUrl || url)) if (!ekImgs.includes(u)) ekImgs.push(u);
    const txtLen = r.text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').length;
    if (txtLen < 500) { // JS ile cizilen sayfa: tarayicida bir kez oku
      const v = await ziyaretFn(browser, url, { polite, lang: lead.lang, wantImages: false });
      R.pages.push({ url, status: v.ok ? `render:${v.status}` : v.why });
      if (v.ok) { if (restoranMi) altMetin.push(`## ${v.finalUrl}\n${(v.lines || []).slice(0, 300).join('\n')}`); return { html: v.html, finalUrl: v.finalUrl, lines: v.lines, links: v.links }; }
    }
    if (restoranMi) altMetin.push(`## ${r.finalUrl || url}\n${htmlToLines(r.text).slice(0, 300).join('\n')}`);
    return { html: r.text, finalUrl: r.finalUrl || url, lines: null, links: null };
  }
  for (const p of (SM && !SM.MENU_ARA ? [] : cands)) { // sektor profilinde (konaklama ...) restoran menusu aranmaz; guzellik fiyat listesini ayni cikaricidan okur
    if (menuItems.length >= 6) break;
    if (tried.has(p.url) || tried.size > 4) continue;
    tried.add(p.url);
    if (p.pdf) { menuPdfs.push(p.url); skipped.push({ url: p.url, why: 'pdf menu (okunmadi, baglanti olarak kalir)' }); continue; }
    if (!p.same) { skipped.push({ url: p.url, why: 'baska site' }); continue; }
    const pg = await sayfaAl(p.url);
    if (!pg) { skipped.push({ url: p.url, why: 'acilamadi' }); continue; }
    const ld2 = jsonLd(pg.html);
    const fromLd = ldMenu(ld2);
    if (fromLd.length >= 3) { menuItems = fromLd.map((x) => ({ ...x, page: pg.finalUrl })); menuVia = 'json-ld (menu sayfasi)'; menuPageUrl = pg.finalUrl; break; }
    if (!pageIsMenu(pg.finalUrl, pg.html, SM && SM.MENU_SOZCUK ? SM.MENU_SOZCUK : undefined)) { skipped.push({ url: p.url, why: 'sayfa acikca menu degil' }); continue; }
    const rows = menuFromText(pg.html, { lang: lead.lang });
    if (rows.length >= 4) { menuItems = rows.map((x) => ({ ...x, page: pg.finalUrl })); menuVia = 'menu sayfasi (ad + fiyat satirlari)'; menuPageUrl = pg.finalUrl; break; }
    menuPageUrl = menuPageUrl || pg.finalUrl;
    skipped.push({ url: p.url, why: `yalniz ${rows.length} fiyatli satir` });
  }
  if (needContact) {
    const cl = home.links.filter((l) => { try { const u = new URL(l.href, base); return u.host.replace(/^www\./, '') === host.replace(/^www\./, '') && /(contact|iletişim|iletisim|find-us|visit|location|about|hakkımızda|hakkimizda|hours|opening)/i.test(`${u.pathname} ${l.text}`) && u.pathname !== '/' && !tried.has(u.href); } catch { return false; } }).slice(0, 2);
    for (const l of cl) {
      if (R.address && R.hours && R.phone) break;
      const u = new URL(l.href, base).href; tried.add(u);
      const pg = await sayfaAl(u); if (!pg) continue;
      const ld3 = jsonLd(pg.html);
      const lines3 = pg.lines || (await import('./v2lib/scrape.mjs')).htmlToLines(pg.html);
      if (!R.phone) R.phone = extractPhone(pg.html, ld3);
      if (!R.address) R.address = adresBul(lines3, ld3, lead.lang);
      if (!R.hours) R.hours = parseSaatler(lines3, ld3);
      if (!R.reservation && pg.links) R.reservation = rezervasyonBul(pg.links, pg.finalUrl);
      if (restoranMi && !R.order && pg.links) R.order = siparisBul(pg.links, pg.finalUrl);
    }
  }
  // siparis / rezervasyon baglantisi (12 Kas): <a> disinda iframe, betik, data-href, JSON; ana sayfa + okunan alt sayfalar; ag istegiyle canlilik denemesi
  if (restoranMi) {
    const kaynaklar = [{ links: home.links, html, base }, ...sayfalar.map((x) => ({ links: x.links || [], html: x.html, base: x.url }))];
    let sip = null; let rez = R.reservation && R.reservation.external ? R.reservation : null;
    const trMi = lead.lang === 'tr' || lead.region === 'TR';
    for (const k of kaynaklar) { const e = (trMi ? eylemAdaylariTr : eylemAdaylari)(k); if (!sip && e.siparis) sip = e.siparis; if (!rez && e.rezervasyon) rez = e.rezervasyon; if (sip && rez) break; }
    if (sip) { sip.dogrulama = await baglantiDogrula(sip.url, polite); R.order = sip; } else R.order = null;
    if (rez) { if (!R.reservation || R.reservation.url !== rez.url) R.reservation = rez; R.reservation.dogrulama = await baglantiDogrula(R.reservation.url, polite); }
  }
  if (restoranMi && altMetin.length) { try { fs.writeFileSync(path.join(dir, '_sayfalar.txt'), altMetin.join('\n\n')); } catch { /* yazilamadi */ } }
  if (SM && SM.ek) await SM.ek({ R, home, base, sayfaAl, jsonLd, polite });
  if (!R.phone && lead.phone) { R.phone = lead.phone; R.phoneVia = 'lead-list'; }
  const items = (SM && SM.menuSuz ? SM.menuSuz(menuItems) : menuItems).filter((x) => x.n && x.n.length >= 3).slice(0, 30);
  R.menu = { via: menuVia, items, groups: groupMenu(items).map((g) => ({ name: g.name, n: g.items.length })), pageUrl: menuPageUrl || (menuLinks(home.links, base, SM && SM.MENU_SOZCUK ? SM.MENU_SOZCUK : undefined)[0] || {}).url || null, pdfs: [...new Set([...menuPdfs, ...menuLinks(home.links, base, SM && SM.MENU_SOZCUK ? SM.MENU_SOZCUK : undefined).filter((l) => l.pdf).map((l) => l.url)])].slice(0, 3), skipped };

  // logo (12 Kas: lib/logo-bul.mjs): JSON-LD, og:logo, header img + satir ici SVG, ana sayfa baglantisi, logo adli img, CSS arka plan, favicon/apple-touch-icon; SVG tercih; bayt DEGISMEZ
  const logoAd = logoAdaylari({ html, base, imgs: home.imgs, svgler: home.svgler });
  const ls = await logoSec({ adaylar: logoAd, getir: (u) => fetchBytes(polite, u, log), onceden: home.imgBodies, imgDir: path.join(dir, 'img'), log });
  R.logo = ls.logo; R.logoRapor = ls.rapor;
  // secilen logonun img alt metni: isletme adi adayi (hat/kuyruk.mjs mailAdi: sitenin adi, basligi, logo alt metni, OSM adi sirasiyla)
  R.logoAlt = ((home.imgs || []).find((im) => im.alt && ls.logo && ls.logo.url && (im.url === ls.logo.url || im.ss === ls.logo.url || im.big === ls.logo.url)) || {}).alt || null;

  // fotograflar (12 Kas: lib/foto-topla.mjs): srcset/picture/data-src/CSS/og/twitter/JSON-LD + alt sayfalar (galeri, hakkinda, menu; en cok 6) + en buyuk surum + gercek piksel + stok/uretilmis/afis isaretleri
  const fs2 = await fotoTopla({ home, base, sayfalar: sayfalar.slice(), ekImgs, sayfaAl, getir: (u) => fetchBytes(polite, u, log), dir, log });
  R.photos = fs2.photos; R.fotoRapor = { ...fs2.rapor, elenenOzet: fs2.rapor.elenen.reduce((m, x) => { m[x.neden] = (m[x.neden] || 0) + 1; return m; }, {}), elenen: fs2.rapor.elenen.slice(0, 60) };
  for (const e of fs2.rapor.elenen.slice(0, 40)) R.notes.push(`foto elendi (${e.neden}): ${String(e.url).slice(0, 100)}`);

  // video (kopyalanmaz; yalniz dogrudan mp4/webm baglantisi)
  let video = null;
  const vc = [];
  for (const v of home.videos) { for (const s of [v.src, ...v.sources.map((x) => x.src)]) if (s && /\.(mp4|webm)(\?|$)/i.test(s) && !/^blob:/.test(s)) vc.push({ url: s, poster: v.poster, rw: v.rw, rh: v.rh }); }
  if (home.meta.ogVideo && /\.(mp4|webm)(\?|$)/i.test(home.meta.ogVideo)) vc.push({ url: home.meta.ogVideo, poster: '' });
  for (const c of vc.slice(0, 2)) {
    const h = await head(polite, c.url);
    if (h && h.ok && /video\//.test(h.type) && h.len > 0 && h.len <= 14_000_000) { video = { url: c.url, type: h.type.split(';')[0], bytes: h.len, poster: c.poster || null, rw: c.rw || null, rh: c.rh || null }; break; }
    else if (h) R.notes.push(`video atlandi (${h.status} ${h.type} ${h.len}B): ${c.url.slice(0, 90)}`);
  }
  R.video = video; R.videoEmbeds = home.embeds;

  // bugunku sitenin ekran goruntusu (once)
  if (!olcum) try {
    const fixShot = async (src, dst, q, maxH) => { if (!fs.existsSync(src)) return null; let im = sharp(src); const m = await im.metadata(); if (maxH && m.height > maxH) im = sharp(src).extract({ left: 0, top: 0, width: m.width, height: maxH }); await im.jpeg({ quality: q, mozjpeg: true }).toFile(dst); fs.unlinkSync(src); return path.basename(dst); };
    R.before = { d1440: await fixShot(shotD.first, path.join(dir, 'once-1440.jpg'), 86), d1440full: await fixShot(shotD.full, path.join(dir, 'once-1440-tam.jpg'), 74, 5200) };
  } catch (e) { R.notes.push(`once ekrani islenemedi: ${e.message}`); }
  const shotM = { first: path.join(dir, 'once-390-ham.png'), full: path.join(dir, 'once-390-tam-ham.png') };
  const mob = olcum ? { ok: false, why: 'olcum modu' } : await ziyaretFn(browser, lead.site, { polite, lang: lead.lang, mobile: true, shotPath: shotM, wantImages: false });
  if (mob.ok) {
    try {
      const fix = async (src, dst, q, maxH) => { if (!fs.existsSync(src)) return null; let im = sharp(src); const m = await im.metadata(); if (maxH && m.height > maxH) im = sharp(src).extract({ left: 0, top: 0, width: m.width, height: maxH }); await im.jpeg({ quality: q, mozjpeg: true }).toFile(dst); fs.unlinkSync(src); return path.basename(dst); };
      R.before.m390 = await fix(shotM.first, path.join(dir, 'once-390.jpg'), 86);
      R.before.m390full = await fix(shotM.full, path.join(dir, 'once-390-tam.jpg'), 74, 9000);
      R.before.mobileOverflow = mob.height ? null : null;
    } catch (e) { R.notes.push(`once (telefon) islenemedi: ${e.message}`); }
  } else if (!olcum) R.notes.push(`telefon ziyareti yapilamadi: ${mob.why}`);
  return finish();
}

// ---- cli ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const which = process.argv[2];
  if (!which) { console.error('kullanim: node uyarla/cikar.mjs <slug|id|hepsi> [--force] [--out klasor] | --site <url> --name <ad> --lang tr|en --kind bar|restaurant|cafe --slug ad'); process.exit(2); }
  const out = arg('--out', VERI); const force = process.argv.includes('--force');
  let leads;
  if (arg('--site')) { const nm = arg('--name', ''); leads = [{ id: '', name: nm, site: arg('--site'), kind: arg('--kind', 'restaurant'), category: '', lang: arg('--lang', 'en'), region: '', city: '', slug: arg('--slug', slugOf(nm || new URL(arg('--site')).host)) }]; }
  else { const all = loadLeads(); leads = which === 'hepsi' ? all : all.filter((l) => which.split(',').includes(l.slug) || which.split(',').includes(l.id)); }
  if (!leads.length) { console.error('lead bulunamadi'); process.exit(1); }
  const polite = new Polite({ gapMs: 1100, hostGapMs: 1800 });
  const browser = await openBrowser();
  try {
    for (const l of leads) {
      try { const r = await cikar(l, { browser, polite, out, force }); console.log(JSON.stringify({ slug: l.slug, erisim: r.erisim && r.erisim.ok, ad: r.name && r.name.n, logo: !!r.logo, foto: (r.photos || []).length, video: !!r.video, menu: (r.menu && r.menu.items.length) || 0, saat: !!(r.hours && r.hours.known), adres: !!r.address, tel: !!r.phone, rez: !!r.reservation, istek: r.requests, sn: r.seconds })); }
      catch (e) { console.log(JSON.stringify({ slug: l.slug, hata: String(e.message || e).slice(0, 160) })); }
      await sleep(1500);
    }
  } finally { await browser.close(); }
}
