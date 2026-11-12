// LOGO NETLIK (12 Kas 2026, kalici kural): logo her ekranda 2x piksel yogunlugunda net olmali.  Logonun piksel genisligi ve yuksekligi, gosterildigi
// CSS boyutunun EN AZ iki kati: baslik, kayan baslik, alt bilgi, telefon (390) ve OZELLIKLE acilis animasyonu (logo en buyuk orada gosterilir).
// SVG her zaman gecer.  Bitmap asla buyutulmez.  Uc katman:
//   1) kaynak  : asilBoyutAdaylari(url) -> sitenin gonderdigi kucuk kopyanin AYNI dosyadaki buyuk asli (WordPress -WxH eki, Wix /v1/ donusumu, Squarespace format,
//                Next.js _next/image, Cloudinary, Shopify boyut eki).  logoSec (logo-bul.mjs) bunu dener: ayni en/boy orani + daha buyuk ise asil alinir.
//   2) hazirlik: netBoyut(logo, istek) -> baslik/telefon/acilis CSS boyutlari dogal boyutun yarisini gecmez; cok kucuk kalirsa acilista ve baslikta logo yerine
//                isletme adi yazilir.  netCss(dosyalar) -> sablon ne derse desin her logo img'si dogal boyutunun yarisinda durdurulur (CSS emniyeti).
//   3) kapi    : logoNetlikTara(browser, url) -> canli sayfada acilis (?capture/?nointro OLMADAN, animasyon durdurularak en buyuk karede), baslik, kayan baslik
//                ve alt bilgide naturalWidth/Height / CSS boyutu olculur; 2x altindaki her yer bir nedendir (sayfa gozden-gecir olur, yayina girmez).
import path from 'node:path';
import { sharp } from './gorsel.mjs';

export const NET_ORAN = 2;
const RASTER = /\.(png|jpe?g|webp|avif)(?:[?#]|$)/i;

// ---------------- 1) kaynak: ayni dosyanin buyuk asli (saf islev) ----------------
// girdi: sitedeki logo adresi -> daha buyuk asil olabilecek adresler (en olasi once, en cok 3).  Yeni bir logo UYDURMAZ: yalniz ayni yoldaki ayni dosya.
export function asilBoyutAdaylari(url) {
  let u; try { u = new URL(url); } catch { return []; }
  const out = [];
  const ekle = (x) => { if (x && x !== url && !out.includes(x)) out.push(x); };
  const h = u.host.toLowerCase(); const p = u.pathname;
  // WordPress: ad-300x97.png -> ad.png ; ad-scaled.jpg -> ad.jpg
  if (/\/wp-content\/uploads\//i.test(p)) {
    const m = /^(.*?)-\d{2,5}x\d{2,5}(\.[a-z0-9]+)$/i.exec(p); if (m) ekle(`${u.origin}${m[1]}${m[2]}`);
    const s = /^(.*?)-scaled(\.[a-z0-9]+)$/i.exec(p); if (s) ekle(`${u.origin}${s[1]}${s[2]}`);
  }
  // Wix: /media/<id>~mv2.png/v1/fill/w_186,h_148,.../ad.png -> /media/<id>~mv2.png
  if (/(?:^|\.)wixstatic\.com$/.test(h)) { const m = /^(\/media\/[^/]+?\.(?:png|jpe?g|webp|gif|svg))(?:\/v1\/.*)?$/i.exec(p); if (m && m[1] !== p) ekle(`${u.origin}${m[1]}`); }
  // Squarespace: ...?format=500w -> sorgusuz asil
  if (/squarespace-cdn\.com$|sqspcdn\.com$/.test(h) && u.search) ekle(`${u.origin}${p}`);
  // Next.js gorsel iyilestiricisi: /_next/image?url=%2Fimages%2Flogo.png&w=384 -> /images/logo.png
  if (p === '/_next/image' && u.searchParams.get('url')) { try { ekle(new URL(u.searchParams.get('url'), u.origin).href); } catch { /* gecersiz */ } }
  // Cloudinary: /image/upload/<donusum>/v123/ad.png -> /image/upload/v123/ad.png
  if (/res\.cloudinary\.com$/.test(h)) { const m = /^(.*\/image\/upload\/)(?:[a-z]_[^/]+\/)+(v\d+\/.+)$/i.exec(p); if (m) ekle(`${u.origin}${m[1]}${m[2]}`); }
  // Shopify: ad_200x.png / ad_200x80.png ve ?width= -> ad.png
  if (/(?:^|\.)shopify(?:cdn)?\.com$/.test(h) || /\/cdn\/shop\//.test(p)) { const m = /^(.*?)_(?:\d+x\d*|x\d+)(?:@\dx)?(\.[a-z0-9]+)$/i.exec(p); ekle(`${u.origin}${m ? m[1] + m[2] : p}`); }
  return out.slice(0, 3);
}

// asil gercekten ayni logonun buyugu mu: raster, ayni en/boy orani (%3), en az %20 daha genis
export function asilUygun(kucuk, buyuk) {
  if (!kucuk || !buyuk || !kucuk.w || !buyuk.w) return false;
  const r1 = kucuk.w / kucuk.h; const r2 = buyuk.w / buyuk.h;
  return Math.abs(r1 - r2) / r1 <= 0.03 && buyuk.w >= kucuk.w * 1.2;
}

// ---------------- 2) hazirlik: guvenli boyutlar ----------------
// logo: { w, h, svg }  istek: sablonun istedigi CSS boyutlari.  altK: alt bilgi logosu basliktan bu kat buyuk (v5 1.1, eski sablon 1.12).
// -> { baslik, baslikMobil, acilis, acilisYazi, baslikYazi, kare, sinirW, sinirH }
export function netBoyut(logo, { baslik = 48, baslikMobil = 40, acilis = 230, altK = 1.12, oran = NET_ORAN, minBaslik = null, minAcilis = null } = {}) {
  const w = Number(logo && logo.w) || 0; const hh = Number(logo && logo.h) || 0;
  const kare = w && hh ? w / hh < 1.6 : true;
  if (!logo || logo.svg) return { baslik, baslikMobil, acilis, acilisYazi: false, baslikYazi: false, kare, sinirW: null, sinirH: null };
  const sinirW = Math.floor(w / oran); const sinirH = Math.floor(hh / oran);
  // baslik yuksekligi: alt bilgi (baslik x altK) bile dogal yuksekligin yarisini gecmez; genislik ayni orandan gelir
  const hMax = Math.floor(hh / (oran * altK));
  const b = Math.min(baslik, hMax); const bm = Math.min(baslikMobil, hMax);
  const a = Math.min(acilis, sinirW, Math.floor(sinirH * (w / hh)));
  const mb = minBaslik ?? (kare ? 30 : 22); const ma = minAcilis ?? (kare ? 96 : 140);
  return { baslik: b, baslikMobil: bm, acilis: a, acilisYazi: a < ma, baslikYazi: bm < mb, kare, sinirW, sinirH };
}

// CSS emniyeti: sablonun CSS'i ne isterse istesin, her logo img'si dogal boyutunun yarisinda durur (genislik ve yukseklik).  SVG icin kural yok.
// dosyalar: [{ file: 'img/logo.png', w, h, svg }]
export function netCss(dosyalar, { oran = NET_ORAN } = {}) {
  const L = [];
  for (const d of [].concat(dosyalar || [])) {
    if (!d || d.svg || !d.file || !d.w || !d.h || /\.svg$/i.test(d.file)) continue;
    L.push(`:root img[src="${d.file}"]{max-width:${Math.floor(d.w / oran)}px;max-height:${Math.floor(d.h / oran)}px}`);
  }
  return L.length ? `/* logo netlik: hicbir logo dogal boyutunun yarisindan buyuk cizilmez (2x) */\n${L.join('\n')}\n` : '';
}

// bos tuval: seffaf logoda gorunen icerigin (alfa > 16) kutusu tuvalin ne kadari.  Opak logo (kendi zemini/plakasi olan) olculmez: zemin tasarimin parcasi olabilir.
// Dosyaya dokunmaz; son goze uyari icindir (ornek: 500 px seffaf tuvalin ortasinda kucuk logo, sayfada beyaz kutu gibi durur).
export async function bosTuval(buf) {
  try {
    const { data, info } = await sharp(buf, { limitInputPixels: 80e6 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width; const H = info.height; let x0 = W; let y0 = H; let x1 = -1; let y1 = -1; let seffaf = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = data[(y * W + x) * 4 + 3]; if (a > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } else seffaf++; }
    if (seffaf / (W * H) < 0.03 || x1 < 0) return { W, H, opak: x1 >= 0, bos: false };
    const w = x1 - x0 + 1; const h = y1 - y0 + 1;
    const kenar = { sol: x0 / W, ust: y0 / H, sag: (W - 1 - x1) / W, alt: (H - 1 - y1) / H };
    const icerik = (w * h) / (W * H);
    return { W, H, w, h, icerik: +icerik.toFixed(3), kenar, bos: icerik < 0.7 || Object.values(kenar).some((k) => k > 0.12) };
  } catch { return null; }
}

// ---------------- 3) kapi: canli sayfada olcum ----------------
// sayfa icinde calisir (disaridan degisken almaz): her logo img'si icin yer, dogal ve CSS boyutu
export function logoOlcDom() {
  const yer = (el) => (el.closest('.intro') ? 'acilis' : el.closest('footer, .foot, .f-wrap') ? 'alt bilgi' : el.closest('header, .top, nav') ? 'baslik' : 'diger');
  const gor = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') return false; } return true; };
  const out = [];
  for (const i of document.querySelectorAll('img')) {
    const src = i.getAttribute('src') || '';
    if (!/logo/i.test(src) && !i.closest('.intro, .brand') && !i.classList.contains('foot-logo')) continue;
    const r = i.getBoundingClientRect(); const svg = /\.svg(?:[?#]|$)/i.test(i.currentSrc || src);
    if (!r.width || !r.height || !gor(i)) continue;
    const oran = i.naturalWidth ? Math.min(i.naturalWidth / r.width, i.naturalHeight / r.height) : 0;
    out.push({ yer: yer(i), src: src.split('/').pop().split('?')[0], nw: i.naturalWidth, nh: i.naturalHeight, cw: +r.width.toFixed(1), ch: +r.height.toFixed(1), oran: +oran.toFixed(2), svg });
  }
  return out;
}

// olcumleri nedene cevirir (saf): ayni yer+dosya icin en kotu oran
export function logoSorunlari(olcumler, { esik = NET_ORAN, etiket = '' } = {}) {
  const enKotu = new Map();
  for (const o of olcumler || []) {
    if (!o || o.svg || !o.nw) continue;
    const k = `${o.yer}|${o.src}`; const v = enKotu.get(k); if (!v || o.oran < v.oran) enKotu.set(k, o);
  }
  const S = [];
  for (const o of enKotu.values()) if (o.oran < esik) S.push(`${etiket ? `${etiket}: ` : ''}logo 2x altinda (${o.yer}): ${o.src} ${o.nw}x${o.nh} -> ${Math.round(o.cw)}x${Math.round(o.ch)} css (${o.oran}x)`);
  return S;
}

// canli sayfa: 1440 ve 390'da acilis (animasyon durdurularak), baslik, kayan baslik, alt bilgi.  dir verilirse acilis ekran goruntusu (son goz icin).
// -> { sorunlar: [], olcum: { '1440': [...], '390': [...] }, dosyalar: [] }
export async function logoNetlikTara(browser, url, { esik = NET_ORAN, dir = null, genislikler = [['1440', 1440, 900, false], ['390', 390, 844, true]] } = {}) {
  const rep = { sorunlar: [], olcum: {}, dosyalar: [] };
  const origin = new URL(url).origin;
  for (const [etiket, w, hgt, mob] of genislikler) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob, reducedMotion: 'no-preference' });
    const pg = await ctx.newPage(); const hepsi = [];
    await pg.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(origin) || u.startsWith('data:')) return r.continue(); return r.abort(); });
    try {
      await pg.goto(url, { waitUntil: 'load', timeout: 45000 }); await pg.evaluate(() => document.fonts.ready);
      // acilis: CSS animasyonlari durdurulup giris boyunca taranir; logo en buyuk oldugu karede olculur
      const acilisVar = await pg.evaluate(() => { const i = document.querySelector('.intro'); return !!i && getComputedStyle(i).display !== 'none'; });
      if (acilisVar) {
        let enIyi = null;
        for (const t of [250, 500, 750, 950, 1100]) {
          await pg.evaluate((tt) => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = tt; } catch { /* yok */ } } }, t);
          await pg.waitForTimeout(40);
          const r = (await pg.evaluate(logoOlcDom)).filter((x) => x.yer === 'acilis');
          const alan = r.reduce((s, x) => s + x.cw * x.ch, 0);
          if (!enIyi || alan > enIyi.alan) enIyi = { t, alan, r };
        }
        hepsi.push(...enIyi.r);
        if (dir && enIyi.r.length) {
          await pg.evaluate((tt) => { for (const a of document.getAnimations()) { try { a.currentTime = tt; } catch { /* yok */ } } }, enIyi.t);
          const f = path.join(dir, `logo-acilis-${etiket}.jpg`); await pg.screenshot({ path: f, type: 'jpeg', quality: 72 }); rep.dosyalar.push(f);
        }
        await pg.evaluate(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch { /* sonsuz */ } } });
      }
      await pg.waitForTimeout(150);
      hepsi.push(...(await pg.evaluate(logoOlcDom)).filter((x) => x.yer !== 'acilis'));
      await pg.evaluate(() => scrollTo(0, 700)); await pg.waitForTimeout(350);
      hepsi.push(...(await pg.evaluate(logoOlcDom)).filter((x) => x.yer === 'baslik'));
      await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(500);
      hepsi.push(...(await pg.evaluate(logoOlcDom)).filter((x) => x.yer === 'alt bilgi'));
      rep.olcum[etiket] = hepsi;
      rep.sorunlar.push(...logoSorunlari(hepsi, { esik, etiket }));
    } catch (e) { rep.sorunlar.push(`${etiket}: logo netligi olculemedi (${String(e.message).slice(0, 90)})`); }
    await ctx.close();
  }
  rep.sorunlar = [...new Set(rep.sorunlar)];
  return rep;
}
