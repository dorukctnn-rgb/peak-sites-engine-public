// LOGO BULMA (12 Kas 2026, cikarici guclendirme).  Deneme turu: 42 hazirlik adayinin 6'si "logo yok" diye elendi (cikarici yalniz <img alt/class "logo">, favicon>=96 ve
// header img'ine bakiyordu).  Burada sitenin kendi logosu su kaynaklardan aranir:
//   JSON-LD logo, og:logo, <link rel=icon|apple-touch-icon|mask-icon>, header/nav icindeki img ve satir ici SVG, ana sayfaya giden baglantinin icindeki gorsel,
//   alt / class / id / dosya adinda "logo" gecen her img, CSS arka plan (class/id "logo").  SVG dosyasi tercih edilir.
// Logo dosyasi BAYTI DEGISTIRILMEDEN saklanir (orijinalKaydet); yeniden renklendirme, kirpma, germe yok.  Satir ici SVG yalniz kendi basina cizilebiliyorsa alinir
// ve dosya baytlari sitedeki serilestirilmis halidir (xmlns yoksa yalniz xmlns eklenir; not dusulur).
// Saf islev: logoAdaylari (agsiz test edilir).  Ag/dosya: logoSec (getir disaridan; robots.txt'e uyan Polite).
import { decode, jsonLd, metaContent } from '../v2lib/scrape.mjs';
import { sniff, analiz } from './gorsel.mjs';
import { srcsetEnBuyuk } from './foto-topla.mjs';
import { orijinalKaydet } from './logo.mjs';
import { asilBoyutAdaylari, asilUygun } from './logo-netlik.mjs';

const abs = (u, base) => { try { const x = new URL(decode(String(u).trim()), base); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
// logo olmayan ama adinda "logo" gecen gorseller: sosyal, odeme, platform, odul, ortak, siparis siteleri
const KOTU = /facebook|instagram|twitter|tiktok|youtube|whatsapp|linkedin|pinterest|payment|visa|mastercard|paypal|tripadvisor|trip-?advisor|google|partner|sponsor|award|accolade|rosette|certificate|recommended|badge|(?:^|[^a-z])(?:wix|squarespace|godaddy|weebly|shopify|wordpress|webflow|jimdo)(?:[^a-z]|$)|powered|made-?with|platform|deliveroo|uber-?eats|just-?eat|opentable|menulog|doordash|resdiary|sevenrooms|quandoo|thefork|flipdish|order-?yoyo|supplier|member|assoc|affiliat/i;
const IKON_KOTU = /(icon|hamburger|burger-?menu|menu-?toggle|arrow|chevron|search|cart|bag|close|social|facebook|instagram|twitter|youtube|tiktok|whatsapp|phone|mail|user|account|play|pause|star|heart|check|plus|minus|caret|share|download|pin|map|globe|lang)/i;
const LOGO_AD = /logo|brand|wordmark|site-?title|site-?name|masthead|navbar-?brand|header-?mark/i;

// logo dosyasi isletmenin kendi alan adinda ya da bilinen bir site kurucu/CDN'inde olmali; ucuncu tarafin dosyasi (odeme/taksit ortagi, siparis platformu rozeti) logo degildir
// (olcum: Sofia ve Noi Pizzeria'da assets.zwift.com.au/RetailerLogos/... bir odeme ortaginin logosu "logo" diye secilmisti)
const CDN = /(?:^|\.)(?:wixstatic\.com|parastorage\.com|wixmp\.com|squarespace-cdn\.com|squarespace\.com|sqspcdn\.com|wsimg\.com|cloudfront\.net|amazonaws\.com|googleusercontent\.com|shopify\.com|shopifycdn\.com|website-files\.com|webflow\.com|webflow\.io|cloudinary\.com|imgix\.net|wp\.com|azureedge\.net|b-cdn\.net|cdn-website\.com|multiscreensite\.com|editmysite\.com|weebly\.com|duda\.co|strikingly\.com|carrd\.co|framer\.app|framerusercontent\.com|vercel\.app|netlify\.app|pages\.dev|r2\.dev|ucarecdn\.com|cdn\.prod\.website-files\.com)$/i;
const IKILI = /^(?:co|com|org|net|ac|gov|edu|ltd|plc)$/i;
export function kayitliAlan(host) { const p = String(host || '').toLowerCase().replace(/^www\./, '').split('.'); if (p.length <= 2) return p.join('.'); return p.slice(IKILI.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? -3 : -2).join('.'); }
export function guvenilirHost(url, base) {
  try { const h = new URL(url).host; const b = new URL(base).host; return kayitliAlan(h) === kayitliAlan(b) || CDN.test(h); } catch { return false; }
}

// girdi: html (cizilmis ya da ham), base, imgs (cikaricinin DOM listesi: url, alt, cls, id, via, vis, inHeader, inFooter, rw, rh, top, nw, homeLink), svgler (satir ici svg: svg, rw, rh, inHeader, cls, label, top)
// -> [{ url?, svg?, via, puan, ... }] puana gore (en cok 10)
export function logoAdaylari({ html = '', base, imgs = [], svgler = [] }) {
  const out = []; const gorulen = new Set();
  const ekle = (c) => { if (c.url && !guvenilirHost(c.url, base)) return; const k = c.svg ?`svg:${c.svg.length}:${c.svg.slice(0, 80)}` : c.url; if (!k || gorulen.has(k)) return; gorulen.add(k); out.push(c); };
  const h = String(html || '');
  // 1. JSON-LD logo
  for (const o of jsonLd(h)) { const l = o && o.logo; for (const y of [].concat(l || [])) { const u = typeof y === 'string' ? y : y && (y.url || y.contentUrl); const a = u && abs(u, base); if (a && !KOTU.test(a)) ekle({ url: a, via: 'ld', puan: 10 }); } }
  // 2. og:logo, itemprop=logo
  const og = metaContent(h, 'og:logo'); if (og) { const a = abs(og, base); if (a) ekle({ url: a, via: 'og-logo', puan: 9 }); }
  for (const m of h.matchAll(/<(?:meta|link)\b[^>]*(?:itemprop|rel)=["']logo["'][^>]*>/gi)) { const u = /(?:content|href)=["']([^"']+)["']/i.exec(m[0]); const a = u && abs(u[1], base); if (a) ekle({ url: a, via: 'itemprop-logo', puan: 9 }); }
  // 3. DOM: header img'leri ve "logo" adli gorseller
  for (const im of imgs) {
    if (im.via !== 'img' && im.via !== 'bg') continue;
    const blob = `${im.url} ${im.alt || ''} ${im.cls || ''} ${im.id || ''}`; const ad = LOGO_AD.test(blob);
    if (KOTU.test(blob) && !(/logo/i.test(im.alt || '') && !KOTU.test(im.alt || ''))) continue;
    if (im.inFooter && !ad) continue;
    const url = im.ss || im.url; if (!url || /^data:/.test(url)) continue;
    let puan = 0; let via = '';
    if (im.via === 'bg') { if (ad && im.vis !== false && im.rw >= 30) { puan = 5; via = 'css-logo'; } else continue; }
    else if (im.inHeader && im.vis && im.rw >= 40 && im.top < 260) { puan = ad ? 9 : (im.homeLink ? 7 : 5); via = ad ? 'img-header-logo' : (im.homeLink ? 'img-ana-sayfa-baglantisi' : 'img-header'); }
    else if (ad && im.vis !== false) { puan = im.inFooter ? 3 : 7; via = 'img-logo-adli'; }
    else if (im.homeLink && im.vis && im.top < 300 && im.rw >= 40) { puan = 6; via = 'img-ana-sayfa-baglantisi'; }
    else continue;
    if (/\.svg(?:[?#]|$)/i.test(url)) puan += 2;
    if (im.inFooter) puan -= 2;
    ekle({ url, via, puan, rw: im.rw, rh: im.rh });
  }
  // 3b. DOM: satir ici SVG (header / logo baglantisi); ikonlar (menu, sosyal, ok) elenir
  for (const s of svgler) {
    const blob = `${s.cls || ''} ${s.label || ''} ${s.parentCls || ''} ${s.id || ''}`;
    if (!s.svg || s.svg.length < 200 || s.svg.length > 250000) continue;
    if ((IKON_KOTU.test(blob) && !LOGO_AD.test(blob)) || KOTU.test(blob)) continue;
    if (!(s.rw >= 40 && s.rh >= 14 && s.top < 320)) continue;
    // kendi basina cizilebilmeli: renk, ic <style> ya da fill/stroke ozniteligi; yalniz currentColor ya da CSS sinifi ise sayfaya bagimli
    const bagimsiz = /<style\b|\sfill=["']#?[0-9a-z]{3,8}["']|\sstroke=["']#?[0-9a-z]{3,8}["']/i.test(s.svg) && !/^[^>]*\bfill=["']currentColor["']/i.test(s.svg.slice(0, 400));
    if (!bagimsiz) continue;
    ekle({ svg: s.svg, via: 'svg-satir-ici', puan: (LOGO_AD.test(blob) ? 8 : 5) + (s.inHeader ? 1 : 0), rw: s.rw, rh: s.rh });
  }
  // 4. statik HTML: ilk 90 KB'daki logo adli img (DOM yoksa ya da DOM'da yoksa), favicon ve apple-touch-icon
  const bas = h.slice(0, 90000).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  for (const m of bas.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]; const at = (n) => { const r = new RegExp(`\\s${n}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag); return r ? decode(r[1] ?? r[2]) : null; };
    const ss = at('srcset') || at('data-srcset'); let src = at('data-src') || at('data-lazy-src') || at('src');
    const best = ss ? srcsetEnBuyuk(ss) : null; if (best && best.u && (!src || /^data:/i.test(src))) src = best.u;
    if (!src || /^data:/i.test(src)) continue;
    const blob = `${src} ${at('alt') || ''} ${at('class') || ''} ${at('id') || ''}`;
    if (LOGO_AD.test(blob) && !KOTU.test(blob)) { const a = abs(src, base); if (a) ekle({ url: a, via: 'img-logo-adli', puan: 6 + (/\.svg(?:[?#]|$)/i.test(a) ? 2 : 0) }); }
  }
  for (const m of h.matchAll(/<link\b[^>]*rel=["']([^"']*)["'][^>]*>/gi)) {
    const rel = m[1].toLowerCase(); if (!/\bicon\b|apple-touch-icon|mask-icon/.test(rel)) continue;
    const hr = /href=["']([^"']+)["']/i.exec(m[0]); const sz = /sizes=["'](\d+)x\d+["']/i.exec(m[0]); const a = hr && abs(hr[1], base); if (!a) continue;
    const svg = /\.svg(?:[?#]|$)/i.test(a) || /type=["']image\/svg/i.test(m[0]);
    if (/apple-touch-icon/.test(rel)) ekle({ url: a, via: 'icon', puan: 4 });
    else if (svg) ekle({ url: a, via: 'favicon', puan: 3 });
    else if (sz && Number(sz[1]) >= 96) ekle({ url: a, via: 'favicon', puan: 3 });
  }
  return out.sort((a, b) => b.puan - a.puan).slice(0, 10);
}

const SVG_NS = 'http://www.w3.org/2000/svg';
// satir ici svg metnini bagimsiz .svg dosyasi baytlarina cevirir: yalniz xmlns yoksa eklenir
export function svgDosyasi(svg) {
  let s = String(svg).trim(); let not = null;
  if (!/^<svg\b[^>]*\sxmlns=/i.test(s)) { s = s.replace(/^<svg\b/i, `<svg xmlns="${SVG_NS}"`); not = 'satir ici SVG: yalniz xmlns eklendi'; }
  if (/\sxlink:href=/i.test(s) && !/xmlns:xlink=/i.test(s)) s = s.replace(/^<svg\b/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  return { buf: Buffer.from(s, 'utf8'), not };
}

// aday listesinden ilk gecerli logolari indirir/okur, SVG'yi tercih eder, ORIJINAL baytlari kaydeder.
// getir(url) -> { buf, type } | null ; onceden: Map(url -> { buf }) (tarayicinin zaten indirdikleri); imgDir: <slug>/img
// -> { logo | null, rapor: [{ via, url, sonuc }] }
export async function logoSec({ adaylar, getir, onceden = new Map(), imgDir, log = () => {}, en = 6 }) {
  const rapor = []; const gecerli = []; let n = 0;
  for (const c of adaylar) {
    if (n >= en) break; n++;
    let buf; let mime; let url = c.url || null; let not = null;
    if (c.svg) { const d = svgDosyasi(c.svg); buf = d.buf; mime = 'image/svg+xml'; not = d.not; }
    else {
      let b = onceden.get(c.url) || null; if (!b) { try { b = await getir(c.url); } catch { b = null; } }
      if (!b) { rapor.push({ via: c.via, url: c.url, sonuc: 'indirilemedi' }); continue; }
      buf = b.buf; mime = sniff(buf);
    }
    if (!mime || mime === 'image/gif') { rapor.push({ via: c.via, url, sonuc: 'gorsel degil/gif' }); continue; }
    let a = await analiz(buf, mime); if (a.error) { rapor.push({ via: c.via, url, sonuc: `olculemedi (${a.error})` }); continue; }
    // LOGO NETLIK (12 Kas): site kucuk bir kopya gonderdiyse (WordPress -WxH, Wix /v1/, Squarespace format, _next/image ...) ayni dosyanin buyuk asli denenir;
    // ayni en/boy oraninda ve en az %20 genisse (ya da ayni oranda SVG ise) o alinir.  Yeni logo uydurulmaz: ayni yoldaki ayni dosya.
    if (url && mime !== 'image/svg+xml') {
      for (const au of asilBoyutAdaylari(url)) {
        if (!guvenilirHost(au, url)) continue;
        let b2 = onceden.get(au) || null; if (!b2) { try { b2 = await getir(au); } catch { b2 = null; } }
        if (!b2 || !b2.buf) continue;
        const m2 = sniff(b2.buf); if (!m2 || m2 === 'image/gif') continue;
        const a2 = await analiz(b2.buf, m2); if (a2.error) continue;
        const ayniOran = a2.w && a2.h && Math.abs(a2.w / a2.h - a.w / a.h) / (a.w / a.h) <= 0.03;
        if (!(m2 === 'image/svg+xml' ? ayniOran : asilUygun(a, a2))) { rapor.push({ via: c.via, url: au, sonuc: `asil uymadi (${a2.w}x${a2.h})` }); continue; }
        rapor.push({ via: c.via, url: au, sonuc: `buyuk asil (${a.w}x${a.h} -> ${a2.w}x${a2.h})` });
        not = `${not ? `${not}; ` : ''}buyuk asil: ${url} yerine ${au}`; buf = b2.buf; mime = m2; url = au; a = a2;
        break;
      }
    }
    const svg = mime === 'image/svg+xml'; const min = c.via === 'favicon' || c.via === 'icon' ? 96 : 40;
    if (!svg && (a.w < min || a.h < min * 0.3)) { rapor.push({ via: c.via, url, sonuc: `kucuk (${a.w}x${a.h})` }); continue; }
    if (!svg && (a.w / a.h > 9 || a.w / a.h < 0.25)) { rapor.push({ via: c.via, url, sonuc: 'oran' }); continue; }
    if (!svg && a.flat > 0.9 && a.palette.length < 2) { rapor.push({ via: c.via, url, sonuc: 'bos/duz' }); continue; }
    if (svg && (a.transparent > 0.995)) { rapor.push({ via: c.via, url, sonuc: 'SVG bos cizim' }); continue; }
    const alpha = a.transparent > 0.08;
    // basligin ya da favicon'un yerine gecen FOTOGRAF logo degildir: opak, az duz blok ve az beyaz
    if (!svg && !alpha && ['img-header', 'img-header-logo', 'icon', 'favicon', 'img-ana-sayfa-baglantisi'].includes(c.via) && a.flat < 0.35 && a.whiteFrac < 0.45 && a.w >= 500) { rapor.push({ via: c.via, url, sonuc: `fotograf gibi (duz ${a.flat.toFixed(2)})` }); continue; }
    rapor.push({ via: c.via, url, sonuc: `uygun (${a.w}x${a.h}${svg ? ' svg' : ''})` });
    gecerli.push({ c, buf, mime, a, alpha, svg, url, not, puan: c.puan + (svg ? 3 : 0) });
    // yeterince guvenilir ilk aday (ld/og/header-logo) bulundu ve svg degilse bir de svg adayina bakilir; en yuksek puanli kazanir
    if (gecerli.length >= 3) break;
  }
  if (!gecerli.length) return { logo: null, rapor };
  const k = gecerli.sort((a, b) => b.puan - a.puan)[0];
  const orj = await orijinalKaydet(k.buf, k.mime, imgDir);
  const { kucult } = await import('./gorsel.mjs');
  const fs = await import('node:fs'); const path = await import('node:path');
  const kc = await kucult(k.buf, { maxW: 560, quality: 88, svg: k.svg });
  fs.writeFileSync(path.join(imgDir, 'logo.webp'), kc.buf);
  const logo = { orig: orj, file: 'img/logo.webp', via: k.c.via, url: k.url, mime: k.mime, w: k.a.w, h: k.a.h, outW: kc.w, outH: kc.h, alpha: k.alpha, opaqueL: k.a.opaqueL, whiteFrac: k.a.whiteFrac, palette: k.a.palette.slice(0, 6), tone: k.alpha ? (k.a.opaqueL < 0.35 ? 'dark' : 'light') : 'plate', ratio: +(k.a.w / k.a.h).toFixed(2), ...(k.not ? { not: k.not } : {}) };
  return { logo, rapor };
}
