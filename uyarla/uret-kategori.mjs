// KATEGORI URETICI (Ajan B): hizli-gundelik restoran kategorileri (burger, burrito, pizza) ve pastane icin sablondan demo sayfa.
//   node uyarla/uret-kategori.mjs <slug,...> [--veri <klasor>] [--out <web/demo>]
// Girdi : <veri>/<slug>/cikarici.json (+ img/, hero/), data/elle/kategori-b.json (kategori, slogan adaylari, kare secimi, tema, gercekler)
// Sablon: sablon-<kategori>/{site.css, page.js, sayfa.mjs, malzeme-3d.webp, malzeme-3d.json, malzeme-buyuk.webp} + sablon-kategori-ortak/imlec.js
//   Pastane (12 Kas): ortak 3D atlas yok; imlec izi sayfanin KENDI atlasi (lib/iz-atlas.mjs, isletmenin kendi urunleri), fontlar isletmenin kendi sitesinden (AYAR.isletmeFontu).
// Cikti : <out>/<ORTAK_K>/ (varsayilan _hat1k) {<kategori>.css, <kategori>.js, <kategori>-3d.webp, <kategori>-buyuk.webp, imlec.js, fonts/, CREDITS.txt}
//         <out>/r/<slug>-<kod>/{index.html, theme.css, img/}   (noindex)      + <veri>/<slug>/uret-kategori.json (rapor)
// Model yok, ag yok. Logo dosyasi bayt bayt ayni kopyalanir. Hicbir gorsel buyutulmez (withoutEnlargement).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sharp } from './lib/gorsel.mjs';
import { VERI, DEMO, ORTAK_K, SABLON_FONT } from './lib/yol.mjs';
import { ONBELLEK, KATALOG, adCoz, fontEslestir, fontDosyalari } from './lib/font.mjs';
import { izAtlas, izPlan, yuvarlakKesit } from './lib/iz-atlas.mjs';
import { KM, kmOf } from './lib/kategori-metin.mjs';
import { mapsUrl, konumGecerli } from './lib/metin.mjs';
import { kartFotoPlan, kartKirp, kenarAcik } from './lib/kart-foto.mjs';
import { fotoUyum, uyumBaglami, yuvaDaralt, yuvaUygun } from './lib/foto-uyum.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VERI_K = VERI;
export const DEMO_K = DEMO;
// sayfa kodu: bulutta gizli tuz (SAYFA_TUZU) ile 10 hane; tuz yoksa (yerel) el yapimi kategori demolarinin kurali (6 hane).  Tuz DEGISMEMELI.
const TUZ = process.env.SAYFA_TUZU || '';
export const kod = (slug) => (TUZ ? crypto.createHash('sha1').update(`${TUZ}:k:${slug}`).digest('hex').slice(0, 10) : crypto.createHash('sha1').update(`peak-uyarla:${slug}`).digest('hex').slice(0, 6));
export const pageDir = (slug) => `r/${slug}-${kod(slug)}`;
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// sizes degerindeki uzunluklari k ile carpar (medya kosullari degismez): "(max-width: 899px) 86vw, min(40vw, 680px)" x1.5 -> "... 129vw, min(60vw, 1020px)"
export function olcekSizes(sizes, k) {
  if (!(k > 1.01)) return sizes;
  return String(sizes).split(',').reduce((acc, part) => { // virgul min()/calc() icinde de olabilir: parantez dengesine gore birlestir
    const last = acc[acc.length - 1]; if (last !== undefined && (last.match(/\(/g) || []).length > (last.match(/\)/g) || []).length) acc[acc.length - 1] = `${last},${part}`; else acc.push(part); return acc;
  }, []).map((p) => { const m = /^(\s*\([^)]*\)\s*)?([\s\S]*)$/.exec(p); return `${m[1] || ''}${m[2].replace(/(\d+(?:\.\d+)?)(vw|px)/g, (_, n, u) => `${Math.round(Number(n) * k)}${u}`)}`; }).join(',');
}
const fontYolu = (f) => [path.join(SABLON_FONT, f), path.join(ONBELLEK, f)].find((x) => fs.existsSync(x)) || null;
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const TZ = { IE: 'Europe/Dublin', GB: 'Europe/London', NZ: 'Pacific/Auckland', AU: 'Australia/Sydney', TR: 'Europe/Istanbul', SG: 'Asia/Singapore' };
const AU_TZ = { melbourne: 'Australia/Melbourne', brisbane: 'Australia/Brisbane', 'gold coast': 'Australia/Brisbane', perth: 'Australia/Perth', adelaide: 'Australia/Adelaide', hobart: 'Australia/Hobart', darwin: 'Australia/Darwin' };
const CC = { IE: '+353', GB: '+44', AU: '+61', NZ: '+64', TR: '+90', SG: '+65' };
const ULKE = { IE: 'Ireland', GB: 'United Kingdom', AU: 'Australia', NZ: 'New Zealand', TR: 'Türkiye', SG: 'Singapore' };
const DAYS = KM.en.days;
const hhmm24 = (m) => { m %= 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

// logonun opak (gorunen) kutusu: olcu icin; dosyaya dokunulmaz
async function opakKutu(buf) {
  try {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  } catch { return null; }
}
export function elleKategori() { try { return JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'kategori-elle.json'), 'utf8')); } catch { return {}; } }
// hat: isletmenin icerik kaydi <veri>/<slug>/icerik.json (inceleme kararindan uygula yazar); yoksa data/elle/kategori-b.json
export function icerikKategori(veri, slug) { try { const j = JSON.parse(fs.readFileSync(path.join(veri, slug, 'icerik.json'), 'utf8')); return j.kategori ? j.kategori : j; } catch { return null; } }
export const hhmm12 = (m) => { m %= 1440; const h = Math.floor(m / 60), mi = m % 60; if (!h && !mi) return 'midnight'; if (h === 12 && !mi) return 'noon'; return `${h % 12 || 12}${mi ? ':' + String(mi).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}`; };
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, k) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
// zemin ustunde en az 4.5:1 olana kadar rengi koyulastir / aciklastir (renk tonu korunur)
export function okunur(renk, zemin, min = 4.5) { const hedef = lum(zemin) > 0.4 ? '#000000' : '#ffffff'; let c = renk; for (let k = 0; k <= 1 && kontrast(c, zemin) < min; k += 0.04) c = mix(renk, hedef, k); return c; }

function fontFace(aile, id, agirlik, stil = 'normal') {
  const out = [];
  for (const [alt, ur] of [['latin', LATIN], ['latin-ext', LATIN_EXT]]) {
    const f = `${id}-${alt}-${agirlik}${stil === 'italic' ? 'i' : ''}.woff2`; if (!fontYolu(f)) continue;
    out.push({ file: f, css: `@font-face{font-family:"${aile}";font-style:${stil};font-weight:${agirlik};font-display:swap;src:url(../../${ORTAK_K}/fonts/${f}) format("woff2");unicode-range:${ur}}` });
  }
  return out;
}

// isletmenin kendi fontlari -> { fontlar: [{ aile, id, agirlik, stil, rol, not, onYukle }], bilgi: { display, text, notlar } } | null (dosya yoksa)
export async function isletmeFontlari(R, E = {}, { slug = '', tr = false, AYAR = {} } = {}) {
  const fe = await fontEslestir(R, { slug, tr });
  const ez = (E && E.font) || {};
  const spec = async (id) => { if (KATALOG[id]) return { id, ...KATALOG[id] }; const r = await adCoz(id); return r ? { ...r.spec, id: r.id } : null; };
  for (const k of ['display', 'text']) {
    if (!ez[k]) continue; const s = await spec(ez[k]); if (!s) continue;
    if (tr && s.turkce === false) continue; // Turkce sayfada latin-ext olmayan aile yok sayilir
    const w = s.weights || [400, 700]; const yak = (x) => w.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), w[0]);
    if (k === 'display') fe.display = { ...fe.display, id: s.id, family: s.family, cls: s.cls || fe.display.cls, w: s.w, weight: yak(ez.displayAgirlik || (String(s.cls || '').startsWith('serif') ? 500 : 700)), italic: false, via: 'elle', orig: ez.neden || 'elle', styles: s.styles, subsets: s.subsets };
    else fe.text = { ...fe.text, id: s.id, family: s.family, cls: s.cls || fe.text.cls, weight: yak(400), strong: yak(ez.textKalin || 600), via: 'elle', orig: ez.neden || 'elle', styles: s.styles, subsets: s.subsets };
  }
  if (ez.displayAgirlik && !ez.display) { const w = (KATALOG[fe.display.id] || {}).weights || [fe.display.weight]; fe.display.weight = w.reduce((b, v) => (Math.abs(v - ez.displayAgirlik) < Math.abs(b - ez.displayAgirlik) ? v : b), w[0]); }
  const dosyalar = await fontDosyalari(fe);
  const var_ = (id, w, st = 'normal') => dosyalar.some((d) => d.id === id && d.weight === w && d.style === st);
  if (!var_(fe.display.id, fe.display.weight, fe.display.italic ? 'italic' : 'normal') || !var_(fe.text.id, fe.text.weight)) return null;
  // slogan vurgusu icin italik (istege bagli): basligin kendi italigi varsa
  const ek = [];
  if (AYAR.vurguItalik && (fe.display.styles || []).includes('italic')) {
    const d2 = await fontDosyalari({ display: { ...fe.display, italic: true }, text: { ...fe.text, strong: fe.text.weight } });
    if (d2.some((d) => d.id === fe.display.id && d.style === 'italic' && d.weight === fe.display.weight)) ek.push({ aile: fe.display.family, id: fe.display.id, agirlik: fe.display.weight, stil: 'italic', rol: 'slogan vurgusu (italik)', not: 'isletmenin kendi fontu' });
  }
  const fontlar = [
    { aile: fe.display.family, id: fe.display.id, agirlik: fe.display.weight, rol: 'başlık', not: `isletmenin kendi sitesinden (${fe.display.via}: ${fe.display.orig})`, onYukle: true },
    ...ek,
    { aile: fe.text.family, id: fe.text.id, agirlik: fe.text.weight, rol: 'gövde', not: `isletmenin kendi sitesinden (${fe.text.via}: ${fe.text.orig})` },
    ...(fe.text.strong !== fe.text.weight && var_(fe.text.id, fe.text.strong) ? [{ aile: fe.text.family, id: fe.text.id, agirlik: fe.text.strong, rol: 'gövde kalın, düğme', not: 'isletmenin kendi fontu', onYukle: true }] : []),
  ];
  return { fontlar, bilgi: { display: { id: fe.display.id, family: fe.display.family, cls: fe.display.cls, w: fe.display.w || (KATALOG[fe.display.id] || {}).w || 0.56, weight: fe.display.weight, italik: !!ek.length, via: fe.display.via, orig: fe.display.orig }, text: { id: fe.text.id, family: fe.text.family, cls: fe.text.cls, weight: fe.text.weight, strong: fe.text.strong, via: fe.text.via, orig: fe.text.orig }, notlar: fe.notes } };
}

export async function uretKategori(slug, { veri = VERI_K, out = DEMO_K, log = console.log } = {}) {
  const dir = path.join(veri, slug);
  const R = JSON.parse(fs.readFileSync(path.join(dir, 'cikarici.json'), 'utf8'));
  const E = icerikKategori(veri, slug) || elleKategori()[slug]; if (!E || !E.kategori) throw new Error(`${slug}: icerik.json (ya da data/elle/kategori-b.json) kaydi ya da kategori yok`);
  const kat = E.kategori; const S = path.join(HERE, `sablon-${kat}`);
  const { sayfa, AYAR } = await import(pathToFileURL(path.join(S, 'sayfa.mjs')).href + `?t=${Date.now()}`);
  const pd = path.join(out, pageDir(slug)); const imgDir = path.join(pd, 'img'); const ortak = path.join(out, ORTAK_K);
  fs.mkdirSync(imgDir, { recursive: true }); fs.mkdirSync(path.join(ortak, 'fonts'), { recursive: true });
  const rapor = { slug, kategori: kat, at: new Date().toISOString(), sayfa: pageDir(slug), dosyalar: [], uyarilar: [] };

  /* ---- ortak dosyalar ---- */
  const atlasVar = fs.existsSync(path.join(S, 'malzeme-3d.json'));
  const atlas = atlasVar ? JSON.parse(fs.readFileSync(path.join(S, 'malzeme-3d.json'), 'utf8')) : { cell: 0, frames: 0, names: [] };
  for (const [a, b] of [[path.join(S, 'site.css'), `${kat}.css`], [path.join(S, 'page.js'), `${kat}.js`], [path.join(S, 'malzeme-3d.webp'), `${kat}-3d.webp`], [path.join(S, 'malzeme-buyuk.webp'), `${kat}-buyuk.webp`], [path.join(HERE, 'sablon-kategori-ortak', 'imlec.js'), 'imlec.js'], [path.join(HERE, 'sablon-kategori-ortak', 'CREDITS.txt'), 'CREDITS.txt'], [path.join(HERE, 'sablon-kategori-ortak', 'FONT-LICENSES.txt'), path.join('fonts', 'LICENSES.txt')]]) if (fs.existsSync(a)) fs.copyFileSync(a, path.join(ortak, b));
  const sh = crypto.createHash('sha1').update(fs.readFileSync(path.join(S, 'site.css'))).update(fs.readFileSync(path.join(S, 'page.js'))).update(fs.readFileSync(path.join(HERE, 'sablon-kategori-ortak', 'imlec.js')));
  if (atlasVar) sh.update(fs.readFileSync(path.join(S, 'malzeme-3d.webp')));
  const surum = sh.digest('hex').slice(0, 8);

  /* ---- fontlar: kategori (referans) fontlari + govde ---- */
  // FONT KANCASI (pastane, 12 Kas): AYAR.isletmeFontu -> basliklar ve metin isletmenin KENDI sitesindeki fontlardan (lib/font.mjs fontEslestir; ticari olana en yakin
  // ucretsiz es).  Elle karar E.font { display, text } (isletmenin sitesinde yuklu olan bir aile) onu ezer.  Dosya bulunamazsa sablonun yedek fontlari kalir.
  let fontlar = AYAR.fontlar; let fontBilgi = null;
  if (AYAR.isletmeFontu) {
    try { const k = await isletmeFontlari(R, E, { slug, tr: R.lead.lang === 'tr' || R.lead.region === 'TR', AYAR }); if (k) { fontlar = k.fontlar; fontBilgi = k.bilgi; } else rapor.uyarilar.push('isletme fontu cozulemedi; sablonun yedek fontlari'); } catch (e) { rapor.uyarilar.push(`isletme fontu hatasi: ${String(e.message || e).slice(0, 120)}; sablonun yedek fontlari`); }
  }
  const faces = []; const fontNot = [];
  for (const f of fontlar) { const ff = fontFace(f.aile, f.id, f.agirlik, f.stil); if (!ff.length) rapor.uyarilar.push(`font dosyasi yok: ${f.id}-${f.agirlik}`); faces.push(...ff); if (!fontNot.includes(f.aile)) fontNot.push(f.aile); }
  for (const f of faces) fs.copyFileSync(fontYolu(f.file), path.join(ortak, 'fonts', f.file));
  rapor.fontlar = fontlar.map((f) => ({ aile: f.aile, agirlik: f.agirlik, rol: f.rol, not: f.not }));
  if (fontBilgi) rapor.fontKanca = fontBilgi;

  /* ---- logo: orijinal dosya, bayt bayt ---- */
  const lo = R.logo && R.logo.orig; if (!lo) throw new Error(`${slug}: logo yok`);
  const logoBuf = fs.readFileSync(path.join(dir, lo.file)); const logoAd = 'logo' + path.extname(lo.file).toLowerCase();
  fs.writeFileSync(path.join(imgDir, logoAd), logoBuf);
  const logo = { src: `img/${logoAd}`, w: lo.w, h: lo.h, sha256: crypto.createHash('sha256').update(logoBuf).digest('hex'), ayni: crypto.createHash('sha256').update(logoBuf).digest('hex') === lo.sha256, opak: await opakKutu(logoBuf) };
  rapor.logo = logo;

  /* ---- fotograflar: kendi kareleri, buyutme yok ---- */
  const P = {};
  async function yaz(buf, ad, w, q = 80) { const o = await sharp(buf).resize({ width: w, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer({ resolveWithObject: true }); fs.writeFileSync(path.join(imgDir, ad), o.data); rapor.dosyalar.push({ f: `img/${ad}`, w: o.info.width, h: o.info.height, kb: Math.round(o.data.length / 1024) }); return o.info; }
  // FOTO UYUMU (12 Kas, lib/foto-uyum.mjs): uymayan kare (logo, harita, ikon, kucuk, bulanik, ture uymayan stok) bolum yuvasina girmez; sablon karesi olmayan
  // yuvayi gizler (daraltma), uyari son goze gider.  Ana fotograf daraltilmaz: uymuyorsa siki kapi sayfayi gecirmez.
  const uyum = fotoUyum(R.photos || [], uyumBaglami(R, { sablon: kat }));
  const heroId = String((E.hero || [])[0] ?? '');
  const yuvalar = Object.entries(E.kareler || {}).flatMap(([y, ids]) => [].concat(ids || []).map((id, i) => ({ yuva: `kareler.${y}[${i}]`, id: String(id) }))).filter((y) => y.id && y.id !== heroId);
  const daralt = yuvaDaralt(yuvalar, uyum); const fotoUyari = [...new Set(daralt.uyari)];
  const heroUy = E.heroKirp && !heroId ? { ok: true } : yuvaUygun(uyum, heroId); const heroUyumsuz = heroUy.ok ? null : `kare ${heroId}: ${heroUy.neden}`;
  if (heroUyumsuz) fotoUyari.unshift(`foto uyumu: ana fotograf ${heroUyumsuz}`);
  rapor.uyarilar.push(...fotoUyari); rapor.fotoUyum = { tur: uyum.tur, ozet: uyum.ozet, sira: uyum.sira }; rapor.fotoUyari = fotoUyari; rapor.heroUyumsuz = heroUyumsuz;
  const yuvaId = new Set(yuvalar.map((y) => y.id));
  const kullan = [...new Set([...(E.heroKirp ? [] : (E.hero || []).slice(0, 1)), ...(E.kareler ? Object.values(E.kareler).flat() : [])].map(String))].filter((id) => !(E.haric || []).map(String).includes(id)).filter((id) => id === heroId || !yuvaId.has(id) || daralt.gecen.has(id));
  for (const id of kullan) {
    const ph = (R.photos || []).find((p) => p.id === id); if (!ph) { rapor.uyarilar.push(`kare yok: ${id}`); continue; }
    const buf = fs.readFileSync(path.join(dir, ph.file)); const md = await sharp(buf).metadata();
    const big = await yaz(buf, `p${id}-${Math.min(1800, md.width)}.webp`, 1800, 80); const sm = await yaz(buf, `p${id}-960.webp`, 960, 76);
    P[id] = { id, big: `img/p${id}-${Math.min(1800, md.width)}.webp`, bw: big.width, bh: big.height, sm: `img/p${id}-960.webp`, sw: sm.width, sh: sm.height, fx: ((E.odak && E.odak[id] && E.odak[id].x) ?? (ph.focus && ph.focus.x) ?? 0.5) * 100, fy: ((E.odak && E.odak[id] && E.odak[id].y) ?? (ph.focus && ph.focus.y) ?? 0.5) * 100, gercekW: ph.w, gercekH: ph.h };
  }
  // kahraman: elle kirpma (orijinal dosyadan) ya da secilen karenin tamami
  let hero;
  if (E.heroKirp) {
    const k = E.heroKirp; const src = sharp(fs.readFileSync(path.join(dir, k.src))); const md = await src.metadata();
    const buf = await src.extract({ left: k.left, top: k.top, width: k.width, height: k.height }).png().toBuffer();
    const a = await yaz(buf, `hero-${k.width}.webp`, k.width, 86); const b = await yaz(buf, 'hero-800.webp', 800, 80); const c = k.width > 1300 ? await yaz(buf, 'hero-1200.webp', 1200, 82) : null;
    hero = { big: `img/hero-${k.width}.webp`, bw: a.width, bh: a.height, sm: 'img/hero-800.webp', sw: b.width, sh: b.height, srcset: `img/hero-800.webp ${b.width}w, ${c ? `img/hero-1200.webp ${c.width}w, ` : ''}img/hero-${k.width}.webp ${a.width}w`, kaynak: `${k.src} ${md.width}x${md.height}`, kirpma: `${k.width}x${k.height}`, maxCss: k.width, fx: ((E.heroOdak && E.heroOdak.x) ?? 0.5) * 100, fy: ((E.heroOdak && E.heroOdak.y) ?? 0.5) * 100 };
  } else { const h0 = P[String((E.hero || [])[0])]; hero = { ...h0, kaynak: `kare ${h0.id} ${h0.gercekW}x${h0.gercekH}`, kirpma: null, maxCss: h0.bw }; }
  // object-fit: cover kutularinda yatay kare kutunun yuksekligine gore buyur: sizes en/boy orani kadar buyutulur (deneme turu 11 Kas: pizza dairesinde 3:2 kare
  // 960 surumuyle x1.10-1.15 buyutulmustu; kapi yakaladi).  Fazla bayt bulaniktan iyidir; buyuk surum zaten var.
  hero.sizes = olcekSizes(AYAR.heroSizes || '100vw', Math.max(1, (hero.bw || 1) / (hero.bh || 1)));
  rapor.hero = hero;
  // ikinci marka isareti (or. BCB simsek): isletmenin kendi grafigi, oran ve renk aynen; yalniz kucultulur (buyutme yok), saydamlik korunur
  let isaret = null;
  if (E.isaret) {
    const ph = (R.photos || []).find((p) => p.id === String(E.isaret.id));
    if (!ph) rapor.uyarilar.push(`isaret karesi yok: ${E.isaret.id}`);
    else { const w = Math.min(E.isaret.w || 480, ph.w); const o = await yaz(fs.readFileSync(path.join(dir, ph.file)), `isaret-${w}.webp`, w, 88); isaret = { src: `img/isaret-${w}.webp`, w: o.width, h: o.height, kaynak: ph.url }; rapor.isaret = isaret; }
  }
  // IMLEC IZI ATLASI (pastane): sayfanin kendi atlasi, isletmenin KENDI urunleri (lib/iz-atlas.mjs).  Elle kesmeler > kesmeler > kendi yemek karelerinden yuvarlak kesit.
  let iz = null;
  if (AYAR.izKendi) {
    const plan = izPlan(E, R, uyum); rapor.iz = { yontem: plan.yontem, urunler: plan.liste.map((x) => ({ id: x.id, ad: x.ad, kaynak: x.kaynak })) };
    const liste = [];
    for (const x of plan.liste) {
      if (x.yuvarlak) { const ph = (R.photos || []).find((p) => String(p.id) === String(x.foto)); if (ph) liste.push({ id: x.id, ad: x.ad, buf: await yuvarlakKesit(fs.readFileSync(path.join(dir, ph.file)), { odak: ph.focus || undefined }) }); }
      else liste.push({ id: x.id, ad: x.ad, buf: fs.readFileSync(path.join(dir, x.file)) });
    }
    if (liste.length >= 2) {
      const at = await izAtlas(liste); const ad = `iz-${crypto.createHash('sha1').update(at.webp).digest('hex').slice(0, 8)}.webp`;
      fs.writeFileSync(path.join(imgDir, ad), at.webp); rapor.dosyalar.push({ f: `img/${ad}`, w: at.w, h: at.h, kb: Math.round(at.webp.length / 1024) });
      const varId = (id) => liste.some((x) => x.id === id);
      iz = { src: `img/${ad}`, cell: at.cell, frames: at.frames, names: liste.map((x) => x.id), adlar: liste.map((x) => x.ad), zincir: plan.zincir.filter(varId), parcalar: plan.parcalar.filter(varId) };
    } else rapor.uyarilar.push('imlec izi: isletmenin kendi urununden en az iki kesit yok; iz kapali (rastgele urun cizilmez)');
  }
  // kart fotograflari (pizza kaydiricisi): her kartta YALNIZ o urunun kendi fotografi (lib/kart-foto.mjs); yoksa kart oldugu gibi kalir.
  // ORAN (5:4) kutusuna kirpilir, 480 ve 960 genislik (kaynaktan buyuk yazilmaz), sablon srcset + loading=lazy ile kullanir.
  const KF = {}; rapor.kartFoto = [];
  for (const k of kartFotoPlan(E.slider, R.photos || [], { isletme: (R.name && R.name.n) || R.lead.name, haric: [...(E.haric || []), ...uyum.elenen.map((x) => x.id)] })) {
    rapor.kartFoto.push({ ad: k.ad, id: k.id, kaynak: k.kaynak, oto: k.oto, bastirildi: k.bastirildi, aday: k.aday ? k.aday.id : null });
    if (!k.id) continue;
    const ph = R.photos.find((p) => String(p.id) === k.id); const kb = fs.readFileSync(path.join(dir, ph.file)); const md = await sharp(kb).metadata();
    const c = kartKirp(md, { ...k, oran: AYAR.kartOran }, ph); const buf = await sharp(kb).extract(c).png().toBuffer(); const v = [];
    for (const w of [...new Set([480, 960].map((x) => Math.min(x, c.width)))]) { const o = await yaz(buf, `k${k.id}-${w}.webp`, w, 80); v.push({ f: `img/k${k.id}-${w}.webp`, w: o.width, h: o.height }); }
    const son = v[v.length - 1];
    const kn = await sharp(buf).resize(48, 38, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const zemin = kenarAcik(kn.data, kn.info.width, kn.info.height, kn.info.channels);
    KF[k.ad] = { id: k.id, src: son.f, srcset: v.map((x) => `${x.f} ${x.w}w`).join(', '), w: son.w, h: son.h, alt: k.alt || '', kirp: `${c.width}x${c.height}`, kaynak: k.kaynak, acik: zemin.acik };
    Object.assign(rapor.kartFoto[rapor.kartFoto.length - 1], { zemin });
    if (c.width < 960) rapor.uyarilar.push(`kart fotografi kucuk: ${k.ad} ${c.width} px (buyutulmedi)`);
  }

  /* ---- metin ve veri ---- */
  const ad = (R.name && R.name.n) || R.lead.name; const bolge = R.lead.region; const sehir = R.lead.city;
  const sec = E.aday[E.sec || 0]; const m = /^(.*?)\*(.+?)\*(.*)$/.exec(sec.text);
  const slogan = m ? { l1: m[1].trim(), l2: (m[2] + m[3]).trim(), duz: sec.text.replace(/\*/g, '') } : { l1: sec.text, l2: '', duz: sec.text };
  const week = (R.hours && R.hours.week) || null;
  // kaynak kaydi (12 Kas 2026): saat ya da adres sitede yoksa OSM'den gelir; son goz ve inceleme bunu gorur
  rapor.kaynaklar = { saat: R.hours ? R.hours.via || (R.hours.source === 'json-ld' ? 'sitenin schema.org kaydi' : 'sitenin metni') : null, adres: R.address ? R.address.via || 'site' : null };
  // dil: isletmenin dili (TR 11 Kas 2026: Turkce arayuz, 24 saat, Turkce gun adlari, Turkiye saati)
  const dil = R.lead.lang === 'tr' || bolge === 'TR' ? 'tr' : 'en'; const t = kmOf(dil);
  const saatler = week ? [1, 2, 3, 4, 5, 6, 0].map((d) => ({ d, gun: t.days[d], t: week[d] ? (dil === 'tr' ? `${hhmm24(week[d][0])}–${hhmm24(week[d][1])}` : `${hhmm12(week[d][0])} to ${hhmm12(week[d][1])}`) : t.closed })) : [];
  const telRaw = String(R.phone || '').replace(/[^\d+]/g, ''); const tel = telRaw ? (telRaw.startsWith('+') ? telRaw : (CC[bolge] || '') + telRaw.replace(/^0/, '')) : '';
  const adres = (R.address && R.address.text) || '';
  const menuG = []; for (const it of (R.menu && R.menu.items) || []) { let g = menuG.find((x) => x.name === it.cat); if (!g) menuG.push(g = { name: it.cat || 'Menu', items: [] }); g.items.push(it); }
  const T = E.tema || {}; const C = (R.colours && R.colours.computed) || {};
  const bg = T.bg || (C.body && C.body.bg) || '#1b1b1b'; const koyu = lum(bg) < 0.3;
  const ink = T.ink || (koyu ? '#ffffff' : '#1b1b1b'); const accent = T.accent || (C.nav && C.nav.color) || '#f91814';
  const paper = T.paper || (koyu ? '#f6efe2' : '#ffffff'); const paperInk = T.paperInk || '#1b1b1b';
  const tema = {
    bg, 'bg-rgb': rgb(bg).join(','), bg2: T.bg2 || mix(bg, ink, 0.07), ink, muted: T.muted || mix(ink, bg, 0.3), line: mix(bg, ink, 0.2),
    accent, 'accent-ink': T.accentInk || (kontrast(accent, '#1b1b1b') >= kontrast(accent, '#ffffff') ? '#1b1b1b' : '#ffffff'), 'accent-hi': T.accentHi || mix(accent, '#ffffff', 0.14), 'accent-on-bg': okunur(accent, bg),
    'accent-text': okunur(accent, paper), paper, 'paper-ink': paperInk, 'paper-muted': mix(paperInk, paper, 0.36),
    'head-bg': T.headBg || bg, 'head-bg-rgb': rgb(T.headBg || bg).join(','), 'head-ink': T.headInk || ink,
  };
  rapor.tema = tema; rapor.kontrast = { 'ink/bg': +kontrast(ink, bg).toFixed(2), 'muted/bg': +kontrast(tema.muted, bg).toFixed(2), 'accent-ink/accent': +kontrast(tema['accent-ink'], accent).toFixed(2), 'accent-on-bg/bg': +kontrast(tema['accent-on-bg'], bg).toFixed(2), 'accent-text/paper': +kontrast(tema['accent-text'], paper).toFixed(2), 'paper-muted/paper': +kontrast(tema['paper-muted'], paper).toFixed(2) };
  for (const [k, v] of Object.entries(rapor.kontrast)) if (v < 4.5) rapor.uyarilar.push(`kontrast dusuk: ${k} ${v}`);

  const D = {
    slug, kat, ad, sehir, bolge, ulke: ULKE[bolge] || '', site: R.lead.site, dil, t, koyu, logo, hero, P, KF, E, R, slogan, atlas, surum, isaret, iz, font: fontBilgi,
    ustYazi: E.ustYazi || R.tagline || '', lede: E.lede || '', saatler, week,
    tel: tel ? { href: `tel:${tel}`, text: R.phone } : null,
    // adres OSM'den geldiyse (address.konum) harita ve yol tarifi koordinata gider (12 Kas 2026)
    adres: adres ? { text: adres, map: R.address && konumGecerli(R.address.konum) ? mapsUrl(adres, ad, sehir, R.address.konum) : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ad}, ${adres}`)}`, ...(R.address && konumGecerli(R.address.konum) ? { konum: R.address.konum, kaynak: R.address.via || 'osm' } : {}) } : null,
    siparis: R.order || null, hediye: R.giftUrl || null, social: R.social || {}, menu: menuG, ek: R.kategoriEk || {}, paragraflar: (R.ek && R.ek.paragraflar) || [],
    veri: {
      t: dil === 'tr' ? { ...t.durum, to: t.to, closedToday: t.closedToday } : t.durum,
      days: t.days, h: week, h12: dil !== 'tr', tz: E.tz || (bolge === 'AU' ? AU_TZ[String(sehir).toLowerCase()] : null) || TZ[bolge] || null,
      imlec: iz ? { src: iz.src, cell: iz.cell, frames: iz.frames, names: iz.names, stack: iz.zincir, gap: null, parts: iz.parcalar, max: 40, yer: AYAR.izYer || null, boy: AYAR.izBoy || null } : AYAR.izKendi ? null : { src: `../../${ORTAK_K}/${kat}-3d.webp?v=${surum}`, cell: atlas.cell, frames: atlas.frames, names: atlas.names, stack: AYAR.zincir, gap: AYAR.zincirAralik || null, parts: AYAR.parcalar, max: 40 },
    },
    esc,
    // <img> yardimcisi: srcset yalniz gercek genisliklerle
    img: (p, { sizes = '100vw', cls = '', alt = '', lazy = true, pri = false } = {}) => `<img${cls ? ` class="${cls}"` : ''} src="${p.big}" srcset="${p.sm} ${p.sw}w, ${p.big} ${p.bw}w" sizes="${olcekSizes(sizes, Math.max(1, p.bw / p.bh))}" alt="${esc(alt)}" width="${p.bw}" height="${p.bh}"${lazy ? ' loading="lazy"' : ''}${pri ? ' fetchpriority="high"' : ''} decoding="async" style="--fx:${(p.fx ?? 50).toFixed(1)}%;--fy:${(p.fy ?? 50).toFixed(1)}%">`,
    // kart fotografi yardimcisi: dosya zaten kutu oraninda (kirpilmis), sizes olceklenmez; her zaman tembel
    kimg: (k, { sizes = '100vw', alt = '' } = {}) => `<img src="${k.src}" srcset="${k.srcset}" sizes="${sizes}" alt="${esc(alt)}" width="${k.w}" height="${k.h}" loading="lazy" decoding="async">`,
  };
  const govde = sayfa(D);

  /* ---- theme.css ---- */
  const logoH = AYAR.logoH ? AYAR.logoH(logo) : 44;
  const css = `/* ${ad}: renkler isletmenin kendi sitesinden (zemin ${bg}, vurgu ${accent}). Fontlar: ${rapor.fontlar.map((f) => `${f.aile} (${f.rol})`).join(', ')}. Logo: orijinal dosya, filtre yok. */\n${faces.map((f) => f.css).join('\n')}\n:root{\n${Object.entries(tema).map(([k, v]) => `--${k}:${v};`).join('\n')}\n${AYAR.temaEk ? AYAR.temaEk(D, logo) : ''}--lg-h:${logoH}px;\n--hero-max:${hero.maxCss}px;\n--hero-ar:${(hero.bw / hero.bh).toFixed(4)};\n}\n`;
  fs.writeFileSync(path.join(pd, 'theme.css'), css);

  /* ---- index.html ---- */
  const bas = (ad.normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[A-Za-z0-9]/) || ['R'])[0].toUpperCase();
  const ikon = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${accent}"/><text x="16" y="23" font-family="Georgia,serif" font-size="20" font-weight="700" text-anchor="middle" fill="${tema['accent-ink']}">${bas}</text></svg>`);
  const on = fontlar.filter((f) => f.onYukle && f.stil !== 'italic').map((f) => `<link rel="preload" href="../../${ORTAK_K}/fonts/${f.id}-latin-${f.agirlik}.woff2" as="font" type="font/woff2" crossorigin>`).join('\n');
  const html = `<!doctype html>
<html lang="${dil}" class="k-${kat}${koyu ? ' is-dark' : ''}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t.title(ad, sehir))}</title>
<meta name="description" content="${esc(t.desc(ad))}">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="${tema['head-bg']}">
<meta name="color-scheme" content="${koyu ? 'dark' : 'light'}">
<link rel="icon" href="${ikon}">
${on}
<link rel="preload" as="image" href="${hero.big}" imagesrcset="${hero.srcset || `${hero.sm} ${hero.sw}w, ${hero.big} ${hero.bw}w`}" imagesizes="${hero.sizes}" fetchpriority="high">
<link rel="stylesheet" href="../../${ORTAK_K}/${kat}.css?v=${surum}">
<link rel="stylesheet" href="theme.css?v=${surum}">
<script>(function(){var c=document.documentElement.classList,q=location.search;if(/capture=1/.test(q))c.add('no-intro','still');else if(/nointro=1/.test(q)||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))c.add('no-intro');})();</script>
</head>
<body>
${govde}
<script type="application/json" id="r-data">${JSON.stringify(D.veri).replace(/</g, '\\u003c')}</script>
<script src="../../${ORTAK_K}/${kat}.js?v=${surum}" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(pd, 'index.html'), html);
  // bu calismada yazilmayan eski gorseller (yalniz bu sayfanin img/ klasoru) kaldirilir: depoya bayat dosya girmesin
  const yazilan = new Set([logoAd, ...rapor.dosyalar.map((x) => x.f.slice(4))]);
  for (const f of fs.readdirSync(imgDir)) if (!yazilan.has(f)) { fs.unlinkSync(path.join(imgDir, f)); rapor.uyarilar.push(`eski dosya kaldirildi: img/${f}`); }
  rapor.kb = { html: Math.round(html.length / 1024), css: Math.round(fs.statSync(path.join(ortak, `${kat}.css`)).size / 1024), js: Math.round(fs.statSync(path.join(ortak, `${kat}.js`)).size / 1024), imlec: Math.round(fs.statSync(path.join(ortak, 'imlec.js')).size / 1024), atlas: fs.existsSync(path.join(ortak, `${kat}-3d.webp`)) ? Math.round(fs.statSync(path.join(ortak, `${kat}-3d.webp`)).size / 1024) : null, iz: iz ? Math.round(fs.statSync(path.join(imgDir, iz.src.slice(4))).size / 1024) : null };
  rapor.slogan = { secilen: slogan.duz, kaynak: sec.kaynak, adaylar: E.aday.map((a) => a.text.replace(/\*/g, '')) };
  fs.writeFileSync(path.join(dir, 'uret-kategori.json'), JSON.stringify(rapor, null, 1));
  log(`${slug}: ${kat} -> ${pageDir(slug)} | hero ${hero.bw}x${hero.bh} (${hero.kaynak}) | ${rapor.dosyalar.length} gorsel | uyari ${rapor.uyarilar.length ? rapor.uyarilar.join('; ') : 'yok'}`);
  return rapor;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const which = process.argv[2]; if (!which) { console.error('kullanim: node uyarla/uret-kategori.mjs <slug,slug> [--veri klasor] [--out web/demo]'); process.exit(2); }
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  for (const s of which.split(',')) await uretKategori(s, { veri: arg('--veri', VERI_K), out: arg('--out', DEMO_K) });
}
