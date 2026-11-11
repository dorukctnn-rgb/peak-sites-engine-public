// FOTOGRAF TOPLAMA (12 Kas 2026, cikarici guclendirme).  Isletmenin KENDI sitesindeki gercek fotograflari EN BUYUK surumleriyle bulur.
// Deneme turu olcumu (11 Kas): 42 hazirlik adayinin 21'i "az ya da kucuk fotograf" diye elendi.  Bu dosya o kaybi azaltir; kalite citasi dusmez:
//   - kaynaklar: img srcset (virgullu Wix/Squarespace adresleri bozulmadan), picture/source, data-src ve her data-* oznitelik, <noscript>, CSS arka plan
//     (satir ici ve <style>), og:image, twitter:image, preload imagesrcset, video poster, JSON-LD image, <a href=buyuk.jpg> (galeri baglantisi)
//   - alt sayfalar: ayni alan adi, galeri / hakkinda / menu (en cok 6); ana sayfa yetmediyse
//   - en buyuk surum: Wix (/v1/fill, /v1/crop sokulur), Squarespace (?format=2500w), WordPress (-WxH, -scaled), Shopify (_2048x), Webflow (-p-500),
//     GoDaddy (img1.wsimg.com /:/rs=w: eki), Drupal, Cloudinary, genislik parametreleri
//   - GERCEK piksel olculur (sharp); buyutme yok
//   - stok fotograf, uretilmis gorsel ve yazili afis ISARETLERI kaydedilir (url + metadata + olcu + goruntu analizi); karar yine goz turunda
// Ag yalniz disaridan verilen `getir` (Polite: robots.txt'e uyar, saniyede en cok 1 istek) ile yapilir; saf islevler agsiz test edilir.
import fs from 'node:fs';
import path from 'node:path';
import { analiz, hamming, kucult, sniff, sharp } from './gorsel.mjs';
import { rozetMi } from './rozet.mjs';
import { decode } from '../v2lib/scrape.mjs';
import { kalip } from './sozluk.mjs';

export const ENCOK_ALT_SAYFA = 6;
export const KEEP_ENCOK = 14;        // saklanan en cok fotograf
export const GETIR_ENCOK = 34;       // bir isletme icin en cok gorsel indirme (tarayicinin zaten indirdikleri sayilmaz)
export const HEDEF_SAGLAM = 8;       // bu kadar saglam fotograf bulununca alt sayfa taramasi durur
const RESIM = /\.(?:jpe?g|png|webp|avif)(?:[?#].*)?$/i;
const RESIM_YOL = /\.(?:jpe?g|png|webp|avif)$/i;

const abs = (u, base) => { try { const x = new URL(decode(String(u).trim().replace(/\\\//g, '/')), base); x.hash = ''; return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

// ---- srcset: adresler virgul icerebilir (Wix: /v1/fill/w_980,h_654,al_c/...), bu yuzden HTML kuralina gore ayristirilir ----
export function srcsetAyir(ss) {
  const s = String(ss || ''); const out = []; let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    let j = i; while (j < s.length && !/\s/.test(s[j])) j++;
    let url = s.slice(i, j); i = j;
    if (!url) break;
    let desc = '';
    if (url.endsWith(',')) url = url.replace(/,+$/, '');
    else { while (i < s.length && /\s/.test(s[i])) i++; let k = i; while (k < s.length && s[k] !== ',') k++; desc = s.slice(i, k).trim(); i = k + 1; }
    const w = /^(\d+(?:\.\d+)?)w$/i.exec(desc); const x = /^(\d+(?:\.\d+)?)x$/i.exec(desc);
    out.push({ u: url, w: w ? Number(w[1]) : 0, x: x ? Number(x[1]) : 0 });
  }
  return out;
}
export function srcsetEnBuyuk(ss) {
  const a = srcsetAyir(ss); if (!a.length) return null;
  return [...a].sort((p, q) => (q.w || q.x * 1000) - (p.w || p.x * 1000))[0];
}

// ---- 1. adres toplama (HTML; tarayicidan gelen cizilmis HTML de olur) ----
const tagOznitelik = (tag) => { const m = {}; for (const a of tag.matchAll(/\s([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) m[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? ''); return m; };
const DATA_ADRES = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-full-src', 'data-large-file', 'data-orig-file', 'data-image', 'data-hi-res-src', 'data-zoom-image', 'data-bg', 'data-background', 'data-background-image', 'data-bg-src', 'data-image-src', 'data-img-src', 'data-flickity-lazyload', 'data-thumb', 'data-parallax-image', 'data-lazyload'];
const SRCSET_AD = ['srcset', 'data-srcset', 'data-lazy-srcset', 'data-sizes-srcset', 'imagesrcset'];
const RESIM_ADRESI = /(?:https?:)?\/\/[^\s"'<>()\\]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'<>()\\]*)?|(?<![\w/])\/[^\s"'<>()\\]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'<>()\\]*)?/gi;

// -> [{ url, kaynak, w (bildirilen), alt, cls }]  (ayni adres bir kez)
export function htmlFotolari(html, base) {
  const out = []; const seen = new Set();
  const ekle = (u, kaynak, ek = {}) => { const url = abs(u, base); if (!url || seen.has(url)) return; if (!RESIM.test(new URL(url).pathname + new URL(url).search) && !/\/(?:media|content\/v1|isteam\/ip|uploads|images?|photos?|files)\//i.test(url)) return; seen.add(url); out.push({ url, kaynak, ...ek }); };
  const h = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ');
  // kosullu betikler hesaba katilmaz; <noscript> (tembel yukleme yedegi) KALIR
  const govde = h.replace(/<script\b(?![^>]*type=["']application\/(?:ld\+)?json["'])[\s\S]*?<\/script>/gi, ' ');
  // meta ve link
  for (const m of govde.matchAll(/<meta\b[^>]*>/gi)) {
    const a = tagOznitelik(m[0]); const k = String(a.property || a.name || a.itemprop || '').toLowerCase();
    if (/^(og:image(:url|:secure_url)?|twitter:image(:src)?)$/.test(k) && a.content) ekle(a.content, k.startsWith('og') ? 'og' : 'twitter');
  }
  for (const m of govde.matchAll(/<link\b[^>]*>/gi)) {
    const a = tagOznitelik(m[0]); const rel = String(a.rel || '').toLowerCase();
    if (rel === 'image_src' && a.href) ekle(a.href, 'link-image_src');
    if (rel === 'preload' && /image/i.test(a.as || '')) { const b = a.imagesrcset ? srcsetEnBuyuk(a.imagesrcset) : null; if (b) ekle(b.u, 'preload', { w: b.w }); else if (a.href) ekle(a.href, 'preload'); }
  }
  // picture / img / source / video
  for (const m of govde.matchAll(/<(img|source|video)\b[^>]*>/gi)) {
    const tag = m[0]; const a = tagOznitelik(tag); const ad = m[1].toLowerCase();
    if (ad === 'video') { if (a.poster) ekle(a.poster, 'video-poster'); continue; }
    if (ad === 'source' && /^(video|audio)\//i.test(a.type || '')) continue;
    for (const k of SRCSET_AD) if (a[k]) { const b = srcsetEnBuyuk(a[k]); if (b) ekle(b.u, ad === 'source' ? 'picture-source' : 'img-srcset', { w: b.w, alt: a.alt || '', cls: a.class || '' }); }
    for (const k of DATA_ADRES) if (a[k] && !/\s\d+w\b/.test(a[k])) { if (/,\s*\S+\s+\d+[wx]\b/.test(a[k])) { const b = srcsetEnBuyuk(a[k]); if (b) ekle(b.u, 'data-src', { w: b.w, alt: a.alt || '', cls: a.class || '' }); } else ekle(a[k], 'data-src', { alt: a.alt || '', cls: a.class || '' }); }
    if (a.src && !/^data:/i.test(a.src)) ekle(a.src, ad === 'source' ? 'picture-source' : 'img', { alt: a.alt || '', cls: a.class || '' });
  }
  // baglanti (galeri / lightbox buyuk dosyasi)
  for (const m of govde.matchAll(/<a\b[^>]*>/gi)) { const a = tagOznitelik(m[0]); if (a.href && RESIM_YOL.test(a.href.split('?')[0])) ekle(a.href, 'a-href', { cls: a.class || '' }); }
  // satir ici stil + her etiketin data-* oznitelikleri (Elementor / Divi / slider ayarlari dahil)
  for (const m of govde.matchAll(/<(?!img\b|source\b|meta\b|link\b)[a-zA-Z][^>]*>/g)) {
    const tag = m[0]; if (tag.length < 16 || (!/style=|data-/i.test(tag))) continue;
    const a = tagOznitelik(tag);
    if (a.style) for (const u of a.style.matchAll(/url\(\s*(?:&quot;|["'])?([^"')\s]+?)(?:&quot;|["'])?\s*\)/gi)) ekle(u[1], 'css-satir-ici', { cls: a.class || '' });
    for (const [k, v] of Object.entries(a)) {
      if (!k.startsWith('data-') || SRCSET_AD.includes(k) || DATA_ADRES.includes(k) || !v || v.length > 4000) continue;
      for (const u of String(v).replace(/\\\//g, '/').matchAll(RESIM_ADRESI)) ekle(u[0], 'data-oznitelik', { cls: a.class || '' });
    }
    for (const k of DATA_ADRES) if (a[k]) ekle(a[k], 'data-src', { cls: a.class || '' });
  }
  // <style> blogundaki arka planlar
  for (const m of govde.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) for (const u of m[1].matchAll(/background(?:-image)?\s*:[^;}]*?url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) ekle(u[1], 'css');
  // JSON-LD image / photo / thumbnail ve JSON veri bloklari
  for (const m of h.matchAll(/<script\b[^>]*type=["']application\/(ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j = null; try { j = JSON.parse(m[2].replace(/^\s*<!--|-->\s*$/g, '').trim()); } catch { j = null; }
    if (m[1] && j) { const gez = (x, d = 0) => { if (!x || d > 8) return; if (Array.isArray(x)) return x.forEach((y) => gez(y, d + 1)); if (typeof x !== 'object') return; for (const [k, v] of Object.entries(x)) { if (/^(image|photo|thumbnailUrl|primaryImageOfPage|contentUrl)$/i.test(k)) for (const y of [].concat(v)) { const u = typeof y === 'string' ? y : y && (y.url || y.contentUrl); if (typeof u === 'string') ekle(u, 'json-ld'); } else gez(v, d + 1); } }; gez(j); }
    else if (!m[1]) for (const u of m[2].replace(/\\\//g, '/').matchAll(/https?:\/\/[^\s"'<>\\]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'<>\\]*)?/gi)) ekle(u[0], 'json-veri');
  }
  return out;
}

// ---- 2. en buyuk surum ----
const WP_BOYUT = /-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|avif)$)/i;
const SHOPIFY_BOYUT = /_(?:\d{2,4}x\d{0,4}|\d{0,4}x\d{2,4}|pico|icon|thumb|small|compact|medium|large|grande|master)(?:_crop_\w+)?(?=\.(?:jpe?g|png|webp)$)/i;
const BOYUT_PARAM = /^(?:w|width|h|height|q|quality|fit|auto|format|fm|crop|dpr|resize|size|s|maxwidth|maxheight|max-w|max-h|rect|ssl)$/i;

// url -> [en buyuk ... en kucuk ... orijinal url]  (en cok 4)
export function enBuyukSurumler(url, { orijinal = false } = {}) {
  const out = []; const ekle = (u) => { if (u && !out.includes(u)) out.push(u); };
  let x; try { x = new URL(url); } catch { return [url]; }
  const p = x.pathname; const o = x.origin; const host = x.host.toLowerCase();
  // Wix: /media/<id>~mv2.jpg/v1/fill|fit|crop/... -> /media/<id>~mv2.jpg (orijinal); cok buyuksa fit/w_2560
  if (/wixstatic\.com$/.test(host) && /\/media\/[^/]+\/v1\//.test(p)) {
    const kok = p.split('/v1/')[0]; const ad = (p.split('/').pop() || 'f.jpg');
    ekle(o + kok); ekle(`${o}${kok}/v1/fit/w_2560,h_2560,q_90/${ad}`);
  }
  // Squarespace: ?format=2500w (en buyuk sunulan); hero icin once format=original
  if (/squarespace(?:-cdn)?\.com$/.test(host) || /\/content\/v1\//.test(p) || /\/static\/[0-9a-f]{24}\//.test(p)) {
    if (orijinal) ekle(`${o}${p}?format=original`);
    ekle(`${o}${p}?format=2500w`); ekle(`${o}${p}?format=1500w`);
  }
  // GoDaddy (img1.wsimg.com): /:/rs=w:600,h:400,cg:true,m eki sokulur
  if (/(?:^|\.)wsimg\.com$/.test(host) && p.includes('/:/')) { ekle(o + p.split('/:/')[0]); }
  // Webflow: -p-500.jpg, -p-1080.jpeg -> orijinal
  if (/(?:website-files\.com|webflow\.com|webflow\.io)$/.test(host) || /-p-\d{3,4}\.(?:jpe?g|png|webp)$/i.test(p)) {
    const w = p.replace(/-p-\d{3,4}(?=\.(?:jpe?g|png|webp)$)/i, ''); if (w !== p) ekle(o + w + x.search);
  }
  // Shopify: _2048x, _600x600_crop_center, _grande -> orijinal; width/height parametreleri sokulur (v= kalir)
  if (/shopify|\/cdn\/shop\//.test(host + p)) {
    const w = p.replace(SHOPIFY_BOYUT, ''); const q = new URLSearchParams(x.search); for (const k of [...q.keys()]) if (BOYUT_PARAM.test(k)) q.delete(k);
    const qs = q.toString() ? `?${q}` : ''; if (w !== p || x.search !== qs) ekle(`${o}${w}${qs}`);
  }
  // Drupal: /files/styles/<stil>/public/<yol> -> /files/<yol>
  if (/\/files\/styles\/[^/]+\/public\//.test(p)) ekle(o + p.replace(/\/files\/styles\/[^/]+\/public\//, '/files/'));
  // Cloudflare goruntu donusumu: /cdn-cgi/image/<secenekler>/<yol>
  const cf = /^\/cdn-cgi\/image\/[^/]+\/(.+)$/.exec(p); if (cf) ekle(`${o}/${cf[1]}`);
  // Cloudinary: /upload/w_800,c_fill/ -> /upload/
  if (/\/upload\/[^/]*(?:w_|h_|c_|q_|f_)\d*[^/]*\//.test(p) && /cloudinary|\/image\/upload\//.test(host + p)) ekle(o + p.replace(/\/upload\/[^/]+\//, '/upload/'));
  // WordPress: -1024x683 ve -scaled eki, Jetpack/Photon ve genislik parametreleri
  const noSize = p.replace(WP_BOYUT, ''); const noScaled = noSize.replace(/-scaled(?=\.(?:jpe?g|png|webp)$)/i, '');
  const qBoyutsuz = (() => { const q = new URLSearchParams(x.search); let d = false; for (const k of [...q.keys()]) if (BOYUT_PARAM.test(k) && !(/squarespace|wsimg/.test(host))) { q.delete(k); d = true; } return d ? (q.toString() ? `?${q}` : '') : x.search; })();
  if (noScaled !== p) ekle(o + noScaled + qBoyutsuz);
  if (noSize !== p) ekle(o + noSize + qBoyutsuz);
  if (qBoyutsuz !== x.search && !/squarespace/.test(host)) ekle(o + p + qBoyutsuz);
  ekle(url);
  return out.slice(0, 4);
}

// ayni goruntunun boyut varyantlarini ayni anahtara indirir (yineleme elemesi)
export function kanonikAnahtar(url) {
  try {
    const x = new URL(url); const host = x.host.toLowerCase().replace(/^www\./, ''); let p = x.pathname;
    if (/wixstatic\.com$/.test(host)) p = p.split('/v1/')[0];
    if (/wsimg\.com$/.test(host)) p = p.split('/:/')[0];
    p = p.replace(WP_BOYUT, '').replace(/-scaled(?=\.\w+$)/i, '').replace(SHOPIFY_BOYUT, '').replace(/-p-\d{3,4}(?=\.\w+$)/i, '').replace(/\/cdn-cgi\/image\/[^/]+\//, '/').replace(/@2x(?=\.\w+$)/, '');
    p = p.replace(/\/files\/styles\/[^/]+\/public\//, '/files/');
    return `${host}${p}`.toLowerCase();
  } catch { return String(url).toLowerCase(); }
}

// ---- 3. fotograf url'si mi (sozcuk sinirli: "close-up", "sealed" yanlis elenmesin) ----
const NOT_PHOTO_TOKEN = new Set(['sprite', 'sprites', 'icon', 'icons', 'favicon', 'avatar', 'placeholder', 'blank', 'loader', 'spinner', 'pixel', '1x1', 'badge', 'badges', 'payment', 'payments', 'visa', 'mastercard', 'paypal', 'tripadvisor', 'flag', 'flags', 'arrow', 'arrows', 'chevron', 'rating', 'ratings', 'facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'whatsapp', 'linkedin', 'pinterest', 'qr', 'qrcode', 'captcha', 'emoji', 'bullet', 'divider', 'separator', 'shadow', 'overlay', 'pattern', 'texture', 'gradient', 'cursor', 'hamburger', 'cookie', 'cookies', 'gdpr', 'trustpilot', 'award', 'awards', 'certificate', 'certification', 'seal', 'ssl', 'secure', 'logo', 'logos', 'wordmark', 'staticmap', 'googlemaps', 'mapbox', 'openstreetmap', 'gstatic']);
const HOST_KOTU = /(maps\.googleapis|maps\.gstatic|google\.com|mapbox|openstreetmap|tripadvisor|booking\.com|expedia|opentable|ubereats|doordash|deliveroo|trustpilot|facebook|fbcdn|instagram|cdninstagram|twitter|twimg|gravatar|googletagmanager|doubleclick|youtube|ytimg|yelp|gstatic)/i;
export function fotoUrlMu(u) {
  let x; try { x = new URL(u); } catch { return false; }
  if (HOST_KOTU.test(x.host)) return false;
  const yol = decodeURIComponent(x.pathname.toLowerCase());
  if (/\.(?:svg|gif|ico)$/.test(yol)) return false;
  const adSon = yol.split('/').pop() || '';
  const tokens = adSon.replace(/\.[a-z0-9]+$/, '').split(/[^a-z0-9]+/).filter(Boolean);
  for (const t of tokens) if (NOT_PHOTO_TOKEN.has(t)) return false;
  if (/(?:^|\/)(?:icons?|sprites?|emoji|flags?|badges?|payments?|social)(?:\/|$)/.test(yol)) return false;
  if (/\bmap[-_.]|\/maps?\//.test(yol) && /static|google|embed/.test(yol)) return false;
  return true;
}

// ---- 4. isaretler: stok, uretilmis, yazili afis ----
const STOK_URL = /(unsplash|pexels|pixabay|shutterstock|istockphoto|istock|gettyimages|getty-?images|depositphotos|adobestock|dreamstime|alamy|123rf|bigstock|stocksy|pond5|rawpixel|freepik|vecteezy|envato|stock[-_ ]?(?:photo|image)|stockphoto|nsplsh|picjumbo|burst\.shopify|lorempixel|picsum\.photos|placeimg|dummyimage|\/isteam\/stock\/|demo[-_]?image|sample[-_]?image|\bcomp[-_]\d)/i;
const STOK_META = /(Getty Images|Shutterstock|iStock|Adobe Stock|Depositphotos|Dreamstime|Alamy|123RF|Unsplash|Pexels|Pixabay|Stocksy|Bigstock)/;
// uretilmis gorsel isaretleri (dosya ust verisi): ozel sozlukte, kalip "uretilmisMeta"
// uretilmis gorsel isaretleri (dosya adi / alt metin): ozel sozlukte, kalip "uretilmisAd"
export const URETILMIS_OLCU = new Set(['1024x1024', '1344x768', '768x1344', '1376x768', '768x1376', '1536x1024', '1024x1536', '1792x1024', '1024x1792', '1216x832', '832x1216', '1152x896', '896x1152', '896x1195', '1456x816', '1248x832', '832x1248', '1184x864', '864x1184', '1408x768', '768x1408', '1536x1536']);
const AFIS_AD = /(menu|poster|flyer|banner|voucher|gift ?card|opening[-_ ]hours|price[-_ ]?list|promo|coupon|screen ?shot|untitled[-_ ]?design|canva|artboard|collage|quiz|trivia|karaoke|open[-_ ]mic|christmas|xmas|valentine|mothers?[-_ ]?day|fathers?[-_ ]?day|a4|a5|pdf[-_ ]page|invitation|save[-_ ]the[-_ ]date|special[-_ ]offer|happy[-_ ]hour|event[-_ ]?(?:poster|flyer))/i;

// buf: dosya baytlari (ilk 128 KB okunur); a: analiz() ciktisi; ad: url + alt metni.  -> { stok:[], uretilmis:[], afis:[] }
export function isaretler({ url = '', alt = '', buf = null, w = 0, h = 0, a = null }) {
  const out = { stok: [], uretilmis: [], afis: [] };
  let dosya = ''; try { dosya = decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch { dosya = url; }
  const host = (() => { try { return new URL(url).host; } catch { return ''; } })();
  const blob = `${host} ${decodeURIComponent((() => { try { return new URL(url).pathname; } catch { return ''; } })())} ${alt}`;
  const m1 = STOK_URL.exec(blob); if (m1) out.stok.push(`adres/alt: ${m1[0].toLowerCase()}`);
  const m2 = kalip('uretilmisAd').exec(`${dosya} ${alt}`); if (m2) out.uretilmis.push(`dosya adi/alt: ${m2[0].toLowerCase()}`);
  if (buf && buf.length) {
    const bas = buf.subarray(0, Math.min(buf.length, 131072)).toString('latin1');
    const m3 = STOK_META.exec(bas); if (m3) out.stok.push(`metadata: ${m3[0]}`);
    const m4 = kalip('uretilmisMeta').exec(bas); if (m4) out.uretilmis.push(`metadata: ${m4[0]}`);
  }
  if (w && h && URETILMIS_OLCU.has(`${w}x${h}`)) out.uretilmis.push(`olcu: ${w}x${h} (uretilmis gorsel olcusu; tek basina kanit degil)`);
  const m5 = AFIS_AD.exec(`${dosya} ${alt}`); if (m5) out.afis.push(`dosya adi/alt: ${m5[0].toLowerCase()}`);
  if (a) {
    if (a.meanS < 0.26 && a.lapVar > 1800 && a.flat > 0.2) out.afis.push('goruntu: duz renk ve keskin kenar (yazi izlenimi)');
    else if (a.flat > 0.55) out.afis.push(`goruntu: genis duz alanlar (${a.flat})`);
  }
  // KESIN: ad ipucu ("menu", "poster", "voucher" ...) + PNG ya da dik kare ya da goruntu analizi; yalniz dosya adinda "menu" gecen yatay JPG yemek fotografi olabilir (isaret kalir, kesin degil)
  const goruntu = out.afis.some((x) => /^goruntu:/.test(x));
  if (m5 && (/\.png(?:[?#]|$)/i.test(url) || (w && h && w / h < 1.05) || goruntu)) out.afis.push('kesin: afis ya da menu gorseli (ad ipucu + PNG/dik ya da goruntu analizi)');
  if (a && a.meanS < 0.26 && a.lapVar > 1800 && a.flat > 0.2) out.afis.push('kesin: yazi izlenimi (duz renk ve keskin kenar)');
  return out;
}
// "kesin" isaretler (sayfa kapisinda fotograf sayilmaz): stok (adres, metadata) ve metadata / dosya adiyla uretilmis; olcu tek basina kesin degil
export const kesinStok = (is) => (is.stok || []).length > 0;
export const kesinUretilmis = (is) => (is.uretilmis || []).some((x) => !/^olcu:/.test(x));
export const kesinAfis = (is) => (is.afis || []).some((x) => /^kesin:/.test(x));
// toplu: kare sayisinin >= %60'i (en az 3) ayni uretilmis-gorsel olcusunde ise hepsi uretilmis sayilir (Sofia Burwood: butun kareler 1376x768)
export function topluUretilmis(photos) {
  const sayim = {}; for (const p of photos) { const k = `${p.w}x${p.h}`; if (URETILMIS_OLCU.has(k)) sayim[k] = (sayim[k] || 0) + 1; }
  const [k, n] = Object.entries(sayim).sort((a, b) => b[1] - a[1])[0] || [];
  if (!k || n < 3 || n < photos.length * 0.6) return null;
  return { olcu: k, adet: n, toplam: photos.length };
}

// ---- 5. alt sayfa secimi (ayni alan adi; galeri > hakkinda > menu > iletisim) ----
const SAYFA_KURAL = [
  [10, /\b(gallery|galleries|galerie|galeria|galeri|photos?|photography|images|pictures|ambience|atmosphere|moments|instagram-feed)\b/i],
  [7, /\b(about|about-us|our-story|story|history|who-we-are|the-restaurant|restaurant|venue|dining|the-team|team|chef|philosophy|our-food|kitchen)\b/i],
  [6, /\b(menu|menus|food|drinks?|dishes|takeaway|take-away|specials|lunch|dinner|brunch|breakfast|dine-in|dine)\b/i],
  [4, /\b(contact|find-us|location|visit|hours|opening)\b/i],
];
const SAYFA_RED = /(privacy|terms|cookie|career|jobs?|gift|voucher|giftcard|login|cart|checkout|account|wp-admin|wp-login|feed|blog\/|news\/|category|tag\/|\.pdf|\.zip|\.docx?|mailto:|tel:|javascript:|#)/i;
const kayit = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
export function altSayfaSec(links, base, { yapildi = new Set(), en = ENCOK_ALT_SAYFA } = {}) {
  let host; try { host = kayit(new URL(base).host); } catch { return []; }
  const adaylar = new Map();
  for (const l of links || []) {
    let u; try { u = new URL(l.href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || kayit(u.host) !== host) continue;
    u.hash = ''; const href = u.href;
    if (u.pathname === '/' || u.pathname === new URL(base).pathname) continue;
    if (SAYFA_RED.test(href) || RESIM_YOL.test(u.pathname)) continue;
    const blob = `${u.pathname.replace(/[/_]+/g, ' ')} ${l.text || ''}`;
    let puan = 0; for (const [p, re] of SAYFA_KURAL) if (re.test(blob.replace(/-/g, '-'))) { puan = Math.max(puan, p); }
    if (!puan) continue;
    if (u.pathname.split('/').filter(Boolean).length > 3) puan -= 2; // derin sayfa (blog yazisi, tek urun) once degil
    const onceki = adaylar.get(href); if (!onceki || onceki.puan < puan) adaylar.set(href, { url: href, puan, text: String(l.text || '').slice(0, 40) });
  }
  return [...adaylar.values()].filter((a) => !yapildi.has(a.url)).sort((a, b) => b.puan - a.puan).slice(0, en);
}

// ---- 6. toplama: adaylari sirala, en buyuk surumleriyle indir, gercek pikseli olc, isaretle ----
// girdi: adaylar [{url, kaynak, ... , pre}]; getir(url) -> { buf, type } | null (Polite; robots'a uyar); onceden: Map(url -> {buf,type}) (tarayicinin zaten indirdikleri)
// -> { tutulan: [{ buf, url, w, h, a, isaret, ... }], elenen: [{ url, neden, w, h }], indirilen }
export async function adaylariOlc({ adaylar, getir, onceden = new Map(), tutulanOnce = [], hashler = [], butce = GETIR_ENCOK, hedef = KEEP_ENCOK, log = () => {} }) {
  const tutulan = []; const elenen = []; let indirilen = 0; const gorulen = new Set(tutulanOnce.map((p) => kanonikAnahtar(p.url)));
  const hs = [...hashler];
  for (const c of adaylar) {
    if (tutulanOnce.length + tutulan.length >= hedef) break;
    const key = kanonikAnahtar(c.url); if (gorulen.has(key)) continue; gorulen.add(key);
    if (rozetMi(c.alt, c.url)) { elenen.push({ url: c.url, neden: 'odul/rozet' }); continue; }
    if (!fotoUrlMu(c.url) && !c.big) { elenen.push({ url: c.url, neden: 'foto degil (adres)' }); continue; }
    // en buyuk surumden baslayarak; ilk ulasilan ve yeterince buyuk olan secilir (tarayicinin zaten indirdigi kopya yeterince buyukse ag acilmaz)
    const olc = async (u, b) => {
      const mime = sniff(b.buf); if (!mime || mime === 'image/gif' || mime === 'image/svg+xml') return null;
      let meta; try { meta = await sharp(b.buf, { limitInputPixels: 120e6 }).rotate().metadata(); } catch { return null; }
      const W = meta.orientation && meta.orientation >= 5 ? meta.height : meta.width; const H = meta.orientation && meta.orientation >= 5 ? meta.width : meta.height; if (!W || !H) return null;
      return { u, b, mime, w: W, h: H, buyuk: u !== c.url };
    };
    const surumler = enBuyukSurumler(c.url); let en = null; let denendi = 0;
    const eldeki = onceden.get(c.url); const eldekiOlcu = eldeki ? await olc(c.url, eldeki) : null;
    if (eldekiOlcu && eldekiOlcu.w >= 2000) en = eldekiOlcu;
    else {
      for (const u of surumler) {
        let b = onceden.get(u);
        if (!b) { if (indirilen >= butce || denendi >= 3) break; denendi++; indirilen++; try { b = await getir(u); } catch { b = null; } if (!b) continue; }
        const o = u === c.url && eldekiOlcu ? eldekiOlcu : await olc(u, b); if (!o) continue;
        if (!en || o.w > en.w) en = o;
        if (en.w >= 1600) break;
      }
    }
    if (!en) { elenen.push({ url: c.url, neden: 'indirilemedi' }); continue; }
    const a = await analiz(en.b.buf, en.mime); if (a.error) { elenen.push({ url: en.u, neden: `olculemedi (${a.error})` }); continue; }
    a.w = en.w; a.h = en.h; // EXIF yonu uygulanmis gercek piksel
    const ar = a.w / a.h;
    const bad = a.w < 640 || a.h < 400 ? 'kucuk' : a.flat > 0.55 ? 'duz (afis/menu/yazi)' : a.lapVar < 18 ? 'bulanik' : a.meanL < 0.004 || a.meanL > 0.88 ? 'cok koyu/acik' : ar > 3.2 || ar < 0.45 ? 'oran' : a.whiteFrac > 0.6 ? 'beyaz zemin' : hs.some((h) => hamming(h, a.hash) <= 6) ? 'benzer' : null;
    if (bad) { elenen.push({ url: en.u, neden: bad, w: a.w, h: a.h, kaynak: c.kaynak }); continue; }
    hs.push(a.hash);
    const is = isaretler({ url: en.u, alt: c.alt || '', buf: en.b.buf, w: a.w, h: a.h, a });
    log(`   foto ${a.w}x${a.h} ${en.buyuk ? '(buyuk surum) ' : ''}<- ${en.u.slice(0, 90)}`);
    tutulan.push({ ...c, url: en.u, ilkUrl: c.url, buyukSurum: en.buyuk, buf: en.b.buf, mime: en.mime, a, w: a.w, h: a.h, isaret: is });
  }
  return { tutulan, elenen, indirilen, hashler: hs };
}


// ---- 7. ORKESTRATOR: ana sayfa (tarayici verisi + cizilmis HTML) -> alt sayfalar -> saklanan kareler ----
const KAYNAK_PRE = { og: 30, twitter: 22, 'json-ld': 20, 'img-srcset': 18, 'picture-source': 18, preload: 16, 'a-href': 16, 'data-src': 16, img: 14, 'css-satir-ici': 14, 'link-image_src': 14, 'data-oznitelik': 12, css: 10, 'video-poster': 10, 'json-veri': 8 };
const PRE_ALT = 14; // alt sayfa fotografi (ana sayfa yetmediginde aday olur)

// tarayicinin DOM listesi (home.imgs) -> aday; eski cikarici suzgeclerini korur (alt bilgi/ust bilgi kucuk, gizli kucuk, adres kurallari)
export function domAdaylari(imgs) {
  const out = [];
  for (const im of imgs || []) {
    const buyukOk = !!(im.big && fotoUrlMu(im.big)); const url0 = im.ss || im.url;
    if (im.inFooter || (im.inHeader && im.rw < 400) || (!im.vis && im.via === 'img' && im.nw < 600 && !buyukOk)) continue;
    if (!buyukOk && !fotoUrlMu(url0) && !fotoUrlMu(im.url)) continue;
    if (im.via === 'img' && !buyukOk && !im.ss && (im.nw < 300 || im.nh < 200)) continue;
    const area = Math.max(im.rw * im.rh, buyukOk ? 40000 : 0);
    out.push({ url: buyukOk ? im.big : url0, ilk: im.url, nw: buyukOk ? 0 : im.nw, nh: buyukOk ? 0 : im.nh, alt: im.alt || '', cls: im.cls || '', via: im.via, kaynak: im.via === 'bg' ? 'css-arka-plan' : (im.ss ? 'img-srcset' : (buyukOk ? 'a-href' : 'img')), rw: im.rw, rh: im.rh, top: im.top, big: buyukOk, area, pre: Math.min(40, Math.sqrt(area) / 25) + (im.top < 1800 ? 8 : 0) + (im.via === 'bg' ? 6 : 0) + Math.min(20, (im.nw || 0) / 150) });
  }
  return out;
}

// -> { photos: [R.photos kaydi + buf], rapor }.  imgDir: <slug>/img (mNN.webp yazilir)
export async function fotoTopla({ home, base, sayfalar = [], ekImgs = [], sayfaAl = null, getir, dir, log = () => {}, hedefSaglam = HEDEF_SAGLAM, butce = GETIR_ENCOK, sureMs = 150000 }) {
  const t0 = Date.now(); const aday = new Map(); const rapor = { kaynaklar: {}, sayfalar: [], elenen: [], indirilen: 0, adaySayisi: 0 };
  const ekle = (c, sayfa) => {
    if (!c.url || !/^https?:/.test(c.url)) return;
    const k = kanonikAnahtar(c.url); const o = aday.get(k);
    const pre = c.pre != null ? c.pre : (KAYNAK_PRE[c.kaynak] ?? 12) + (sayfa ? -6 : 0);
    if (o) { if (pre > o.pre) Object.assign(o, c, { pre, sayfa: o.sayfa || sayfa }); else if (!o.alt && c.alt) o.alt = c.alt; return; }
    aday.set(k, { ...c, pre, sayfa: sayfa || null }); rapor.kaynaklar[c.kaynak] = (rapor.kaynaklar[c.kaynak] || 0) + 1;
  };
  for (const c of domAdaylari(home.imgs)) ekle(c, null);
  for (const c of htmlFotolari(home.html, base)) { if (fotoUrlMu(c.url) || c.kaynak === 'og' || c.kaynak === 'twitter' || c.kaynak === 'json-ld') ekle(c, null); }
  for (const sg of sayfalar) for (const c of htmlFotolari(sg.html, sg.url)) if (fotoUrlMu(c.url)) ekle({ ...c, pre: PRE_ALT + (KAYNAK_PRE[c.kaynak] || 12) / 10 }, sg.url);
  for (const u of ekImgs) if (fotoUrlMu(u)) ekle({ url: u, kaynak: 'alt-sayfa', via: 'ek', pre: PRE_ALT }, 'ek');
  const keep = []; let hashler = []; let indirilen = 0;
  const onceden = home.imgBodies || new Map();
  const tur = async () => {
    const liste = [...aday.values()].filter((c) => !c.islendi).sort((a, b) => b.pre - a.pre);
    for (const c of liste) c.islendi = true;
    const r = await adaylariOlc({ adaylar: liste, getir, onceden, tutulanOnce: keep, hashler, butce: butce - indirilen, hedef: KEEP_ENCOK, log });
    indirilen += r.indirilen; hashler = r.hashler; keep.push(...r.tutulan); rapor.elenen.push(...r.elenen);
  };
  const saglam = () => keep.filter((p) => p.w >= 800 && !kesinStok(p.isaret) && !kesinUretilmis(p.isaret)).length;
  await tur();
  // ana sayfa yetmediyse: galeri / hakkinda / menu alt sayfalari (ayni alan adi, en cok 6)
  const yapildi = new Set([base, ...sayfalar.map((x) => x.url)]);
  const yapilan = [...sayfalar.map((x) => x.url)];
  let guvenlik = 0;
  while (sayfaAl && saglam() < hedefSaglam && yapilan.length < ENCOK_ALT_SAYFA && keep.length < KEEP_ENCOK && Date.now() - t0 < sureMs && guvenlik++ < ENCOK_ALT_SAYFA + 2) {
    const sec = altSayfaSec(home.links, base, { yapildi, en: 1 })[0]; if (!sec) break;
    yapildi.add(sec.url); yapilan.push(sec.url);
    let pg = null; try { pg = await sayfaAl(sec.url); } catch { pg = null; }
    rapor.sayfalar.push({ url: sec.url, puan: sec.puan, okundu: !!pg });
    if (!pg) continue;
    for (const c of htmlFotolari(pg.html, pg.finalUrl || sec.url)) if (fotoUrlMu(c.url)) ekle({ ...c, pre: PRE_ALT + (KAYNAK_PRE[c.kaynak] || 12) / 10 }, sec.url);
    await tur();
  }
  rapor.indirilen = indirilen; rapor.adaySayisi = aday.size; rapor.altSayfaSayisi = yapilan.length;
  // toplu uretilmis olcusu
  const toplu = topluUretilmis(keep); if (toplu) { rapor.topluUretilmis = toplu; for (const p of keep) if (`${p.w}x${p.h}` === toplu.olcu) p.isaret.uretilmis.push(`toplu: ${toplu.adet}/${toplu.toplam} kare ${toplu.olcu}`); }
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  const photos = [];
  for (const p of keep) {
    const id = String(photos.length + 1).padStart(2, '0');
    const k = await kucult(p.buf, { maxW: 1800, quality: 78 });
    fs.writeFileSync(path.join(dir, 'img', `m${id}.webp`), k.buf);
    const a = p.a; const ar = a.w / a.h; const heroOk = a.w >= 1100 && ar >= 1.25 && ar <= 2.6 && a.lapVar >= 40;
    const is = {}; for (const k2 of ['stok', 'uretilmis', 'afis']) if (p.isaret[k2].length) is[k2] = p.isaret[k2];
    photos.push({ id, file: `img/m${id}.webp`, url: p.url, via: p.via || p.kaynak, w: a.w, h: a.h, ratio: +ar.toFixed(2), outW: k.w, outH: k.h, kb: Math.round(k.buf.length / 1024), lapVar: a.lapVar, meanL: a.meanL, meanS: a.meanS, focus: a.focus, palette: a.palette.slice(0, 6), alt: String(p.alt || '').replace(/\s+/g, ' ').trim().slice(0, 120), cls: p.cls || '', heroOk, score: +(p.pre + Math.min(30, a.lapVar / 40) + (heroOk ? 14 : 0)).toFixed(1), top: p.top ?? 9999, kaynak: p.kaynak, sayfa: p.sayfa || null, gercekPiksel: `${a.w}x${a.h}`, ...(p.buyukSurum ? { buyukSurum: true, ilkUrl: p.ilkUrl } : {}), ...(Object.keys(is).length ? { isaretler: is } : {}) });
  }
  return { photos, rapor };
}

export { kucult };
