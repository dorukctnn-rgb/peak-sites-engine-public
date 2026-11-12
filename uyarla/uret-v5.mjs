// 3. ADIM (v5): URETICI.  node uyarla/uret-v5.mjs <slug,...> [--out <web/demo klasoru>]   (UYARLA_VERI=<uyarla-veri-v5>)
// Uc referans dili (REFERANS-A.md, lib/dil-v5.mjs): mekan = amritpalace grameri, sicak = khufus, sahil = ballenacabo. Fontlar referans sitenin fontlari
// (ucretsizse aynisi, ticariyse en yakin acik lisansli es); renk, logo, fotograf, metin, fiyat ve saat isletmenin KENDISINDEN.
// Kurallar (Doruk, 10 Kas): buyuk baslik bir slogandir (isim degil); logo dosyasi bayt bayt aynen; ana fotograf hero-secim.json'daki tek ve en iyi karedir ve
// kendi boyutunun ustune buyutulmez (1920 px altindaysa "cerceve" duzeni); ilk ekranda saat, adres, telefon, simdi acik ve tek ana eylem; fiyatli menu.
// Elle kayitlar: data/v5-elle.json (yalniz bu uretici okur; eski uret.mjs'in data/elle klasorune girmez).
// Cikti: <out>/r/<slug>-<kodV5>/{index.html, theme.css, img/}  +  ortak <out>/<ORTAK_V5>/{v5.css, v5.js, fonts/} (varsayilan _hat1v5).  Eski uret.mjs ve sayfalari degismez.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sharp, lin } from './lib/gorsel.mjs';
import { dosyaAdi, fontFaceCss, FALLBACK, ONBELLEK } from './lib/font.mjs';
import { renkPaleti, kontrastKontrol, paletteOk, contrast } from './lib/renk.mjs';
import { markaPaleti, paletSadakati } from './lib/marka.mjs';
import { saatDenetle, parseSaatler } from './lib/saat.mjs';
import { T, DAYS, telHref, mapsUrl, tzOf, cityLabel, adresTemizle } from './lib/metin.mjs';
import { sloganDogrula, sloganParcalari, ascii } from './lib/slogan.mjs';
import { logoPiksel, gorunurOran, lumHex } from './lib/logo.mjs';
import { logoKur, VERI, DEMO, sha256 } from './uret.mjs';
import { ORTAK_V5, SABLON_FONT } from './lib/yol.mjs';
import { platformHepsi as platformOf } from './lib/siparis-tr.mjs';
import { DILLER, dilSec, dilFontlari } from './lib/dil-v5.mjs';
import { themeCssV5, sayfaHtmlV5 } from './lib/sayfa-v5.mjs';
import { yasakVar } from './lib/sozluk.mjs';
import { fotoUyum, uyumBaglami, yuvaDaralt, yuvaUygun } from './lib/foto-uyum.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// sayfa kodu: bulutta gizli tuz (SAYFA_TUZU) ile 10 hane; tuz yoksa (yerel) el yapimi v5 demolarinin kurali (6 hane).  Tuz DEGISMEMELI.
const TUZ = process.env.SAYFA_TUZU || '';
export const kodV5 = (slug) => (TUZ ? crypto.createHash('sha1').update(`${TUZ}:v5:${slug}`).digest('hex').slice(0, 10) : crypto.createHash('sha1').update(`peak-uyarla-v5:${slug}`).digest('hex').slice(0, 6));
export const pageDirV5 = (slug) => `r/${slug}-${kodV5(slug)}`;
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export function elleV5(file = path.join(HERE, 'data', 'v5-elle.json')) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }
// hat: isletmenin icerik kaydi <veri>/<slug>/icerik.json (inceleme kararindan uygula yazar); yoksa data/v5-elle.json
export function icerikOku(veri, slug) { try { const j = JSON.parse(fs.readFileSync(path.join(veri, slug, 'icerik.json'), 'utf8')); return j.v5 || j; } catch { return null; } }

// ---- renk yardimcilari ----
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a) => `#${a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const mix = (a, b, t) => { const A = hx(a); const B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
// yazi rengini zemine karsi en az `min` kontrasta getirir (zemin acıksa koyulasir, koyuysa acilir)
function fitInk(fg, bgs, min) {
  let c = fg; const dark = bgs.every((b) => lumHex(b) > 0.4);
  for (let i = 0; i < 40 && bgs.some((b) => contrast(c, b) < min); i++) c = mix(c, dark ? '#000000' : '#ffffff', 0.08);
  return c;
}
// ikincil yazi: ana yazidan zemine dogru biraz kayar ama 4.5'in altina inmez
export function ikincil(ink, bg) { for (const t of [0.24, 0.16, 0.08]) { const c = mix(ink, bg, t); if (contrast(c, bg) >= 4.6) return c; } return ink; }

// ---- saat: 12 saatlik kisa yazim, haftayi saran gruplama (Sun to Thu) ----
const SHORT = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], tr: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] };
export function zaman(m, h12) {
  m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60); const mi = m % 60;
  if (!h12) return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  return `${h % 12 || 12}${mi ? `:${String(mi).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
}
// "11:30am–9:30pm": aralik cizgisi bitisik (premium-web-style: bosluklu tire yok)
export const aralik = (w, h12) => `${zaman(w[0], h12)}–${zaman(w[1], h12)}`;
export function saatOzetV5(hrs, lang, h12) {
  if (!hrs) return [];
  const L = T[lang]; const D = DAYS[lang]; const S = SHORT[lang] || SHORT.en;
  // TR gun araligi bitisik kisa cizgi ("Pzt-Çar", "Pazartesi-Cuma"): bosluklu ya da harf arasi uzun tire premium-web-style/lint-copy'de yasak
  const and = lang === 'tr' ? 've' : '&'; const to = lang === 'tr' ? '-' : 'to';
  const key = (d) => (hrs.week[d] ? aralik(hrs.week[d], h12) : hrs.byDay && hrs.byDay[d] === 'closed' ? 'kapali' : null);
  let g = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) { const k = key(d); const last = g[g.length - 1]; if (last && last.k === k) last.days.push(d); else g.push({ k, days: [d] }); }
  if (g.length > 1 && g[0].k === g[g.length - 1].k) { const last = g.pop(); g[0].days = last.days.concat(g[0].days); }
  g = g.filter((x) => x.k !== null);
  g = g.filter((x) => x.k !== 'kapali').concat(g.filter((x) => x.k === 'kapali')); // once acik gunler, kapali gunler sonda
  const lbl = (arr, days) => { const n = days.length; const a = days[0]; const b = days[n - 1]; return n === 1 ? arr[a] : n === 2 ? `${arr[a]} ${and} ${arr[b]}` : lang === 'tr' ? `${arr[a]}${to}${arr[b]}` : `${arr[a]} ${to} ${arr[b]}`; };
  return g.map((x) => ({ days: lbl(S, x.days), daysLong: lbl(D, x.days), t: x.k === 'kapali' ? L.closed.toLocaleLowerCase(lang) : x.k, closed: x.k === 'kapali' }));
}
export function saatTabloV5(hrs, lang, h12) {
  if (!hrs) return null; const L = T[lang];
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ d, label: DAYS[lang][d], t: hrs.week[d] ? aralik(hrs.week[d], h12) : hrs.byDay && hrs.byDay[d] === 'closed' ? L.closed : null }));
}

// ---- baslik olculeri: dil + sloganin en uzun sozcugu (kapi gercek olcumle dogrular, gerekirse kucultur) ----
export function boyutV5(dil, sloganText, fe) {
  const caps = !!fe.display.upper; const ls = fe.display.ls || 0;
  const wch = (fe.display.w || 0.5) * (caps ? 1.18 : 1) * (1 + ls);
  const words = sloganText.split(/\s+/).filter(Boolean); const longest = Math.max(...words.map((w) => w.length)); const len = sloganText.length;
  const R = {
    mekan: { base: 8, avail: 88, lines: 2, vh: 15, max: 150, h2: 'clamp(36px, 4.6vw, 88px)', h2lh: 0.9, h3: 'clamp(19px, 1.5vw, 25px)', h2s: 'clamp(26px, 2.5vw, 44px)', tSize: '15px', tWeight: 400, mob: 13 },
    sicak: { base: 6.6, avail: 84, lines: 2, vh: 12, max: 128, h2: 'clamp(34px, 3.8vw, 70px)', h2lh: 1.04, h3: 'clamp(20px, 1.6vw, 27px)', h2s: 'clamp(26px, 2.6vw, 46px)', tSize: '15.5px', tWeight: 400, mob: 13 },
    sahil: { base: 6.2, avail: 56, lines: 3, vh: 12, max: 132, h2: 'clamp(32px, 4vw, 72px)', h2lh: 0.95, h3: 'clamp(15px, 1.12vw, 19px)', h2s: 'clamp(24px, 2.3vw, 40px)', tSize: '15.5px', tWeight: 400, mob: 12 },
  }[dil];
  const perLine = Math.max(longest, Math.ceil(len / R.lines));
  const vw = Math.min(R.base, R.avail / (longest * wch));
  const h1max = `${((perLine + 1) * wch).toFixed(2)}em`;
  const vwM = Math.min(R.mob, (88 / (longest * wch)) * 0.96);
  return { h1: `clamp(34px, min(${vw.toFixed(2)}vw, ${R.vh}vh), ${R.max}px)`, h1m: vwM, h1max, lh: fe.display.lh || 1, h2: R.h2, h2lh: R.h2lh, h3: R.h3, h2s: R.h2s, tSize: R.tSize, tWeight: R.tWeight, lede: '16px', wch };
}

async function toFile(buf, file, w, q) {
  const o = await sharp(buf, { limitInputPixels: 80e6, animated: false }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(file, o.data);
  return { w: o.info.width, h: o.info.height, kb: Math.round(o.data.length / 1024) };
}
// foto altinda yazi okunurlugu: alt yarinin p90 parlakligi (dogrusal)
async function p90Alt(buf, from = 0.45) {
  const o = await sharp(buf).resize({ width: 96 }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = o.info.width; const h = o.info.height; const vals = [];
  for (let y = Math.floor(h * from); y < h; y++) for (let x = 0; x < w; x++) vals.push(lin(o.data[y * w + x]));
  vals.sort((a, b) => a - b); return vals[Math.floor(vals.length * 0.9)] || 0;
}

// ---- fontlar: dilin fontlari onbellekten (fontsource, OFL); ag yok ----
function fontKur(fe, out) {
  const need = new Map();
  const add = (o, weights, styles) => { for (const w of weights) for (const s of styles) for (const sub of (o.subsets && o.subsets.length ? o.subsets : ['latin', 'latin-ext'])) need.set(`${o.id}|${sub}|${w}|${s}`, { id: o.id, family: o.family, subset: sub, weight: w, style: s }); };
  add(fe.display, [fe.display.weight], [fe.display.italic ? 'italic' : 'normal']);
  if (fe.display.em && fe.display.em.italic) add(fe.display, [fe.display.em.weight], ['italic']);
  add(fe.text, [...new Set([fe.text.weight, fe.text.strong, fe.text.light].filter(Boolean))], ['normal']);
  if (fe.script) add(fe.script, [fe.script.weight], ['normal']);
  for (const e of fe.ekstra || []) add(e, [e.weight], [e.italic ? 'italic' : 'normal']);
  const files = []; const missing = [];
  const dir = path.join(out, ORTAK_V5, 'fonts'); fs.mkdirSync(dir, { recursive: true });
  for (const n of need.values()) {
    const name = dosyaAdi(n.id, n.subset, n.weight, n.style); const src = [path.join(SABLON_FONT, name), path.join(ONBELLEK, name)].find((x) => fs.existsSync(x)) || path.join(ONBELLEK, name);
    if (!fs.existsSync(src)) { missing.push(name); continue; }
    const dst = path.join(dir, name); if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    files.push({ ...n, file: src });
  }
  return { files, missing };
}

// ---- palet: isletmenin kendi renkleri (marka sadakati); elle: yanlis olculen zemin yoksayilir, kendi metin rengi korunur ----
export function paletKur(R, elle) {
  let R2 = R; const notes = [];
  const pe = elle && elle.palet;
  if (pe && Array.isArray(pe.yoksay) && pe.yoksay.length) {
    const drop = new Set(pe.yoksay.map((s) => String(s).toLowerCase()));
    const used = { ...((R.colours && R.colours.used) || {}) }; used.bg = (used.bg || []).filter((x) => !drop.has(String(x.hex).toLowerCase()));
    R2 = { ...R, colours: { ...R.colours, used } }; notes.push(`zemin ölçümünden yoksayılan: ${[...drop].join(', ')} (${pe.neden || 'elle'})`);
  }
  const pal = markaPaleti(R2, renkPaleti(R2, { photoPalette: (R.photos && R.photos[0] && R.photos[0].palette) || [] }));
  if (pal.t.bg.toLowerCase() === '#000000') pal.t.bg = '#0c0c0d';
  if (pe && pe.ink && /^#[0-9a-f]{6}$/i.test(pe.ink)) {
    if (contrast(pe.ink, pal.t.bg) >= 7 && contrast(pe.ink, pal.t.bg2) >= 7) { pal.t.ink = pe.ink.toLowerCase(); pal.t.muted = fitInk(mix(pal.t.ink, pal.t.bg, 0.28), [pal.t.bg, pal.t.bg2], 4.7); pal.t.line = mix(pal.t.bg, pal.t.ink, 0.16); notes.push(`metin rengi sitenin kendi rengi: ${pal.t.ink}`); }
    else notes.push(`sitenin metin rengi ${pe.ink} zeminde 7:1 vermedi; üretilen ton kaldı`);
  }
  if (pe && pe.deep && /^#[0-9a-f]{6}$/i.test(pe.deep) && lumHex(pe.deep) < 0.12) {
    const t = pal.t; t.deep = pe.deep.toLowerCase(); t.onDeep = fitInk(mix(t.bg, t.deep, 0.04), [t.deep], 12); t.onDeepMuted = fitInk(mix(t.onDeep, t.deep, 0.3), [t.deep], 4.7); t.accentOnDeep = fitInk(t.accent, [t.deep], 4.5); t.shade = mix(t.deep, '#000000', 0.45); t.heroAccent = fitInk(t.accent, [mix(t.shade, '#2a2622', 0.35)], 5.5);
    notes.push(`koyu yüzey sitenin kendi rengi: ${t.deep}`);
  }
  pal.checks = kontrastKontrol(pal.t);
  return { pal, notes };
}

async function picKur(id, R, dir, imgDir, alt) {
  const p = (R.photos || []).find((x) => x.id === String(id)); if (!p) return null;
  const buf = fs.readFileSync(path.join(dir, p.file));
  const big = await toFile(buf, path.join(imgDir, `p${p.id}-1600.webp`), 1600, 76);
  const sm = await toFile(buf, path.join(imgDir, `p${p.id}-960.webp`), 960, 74);
  return { id: p.id, name: `p${p.id}`, w: big.w, h: big.h, w960: sm.w, kb: big.kb, focus: p.focus || { x: 0.5, y: 0.5 }, alt: clean(alt || '') };
}

export async function uretV5(slug, { veri = VERI, out = DEMO, elle: E0 = null, log = console.log, yazRapor = true } = {}) {
  const dir = path.join(veri, slug);
  const ik = icerikOku(veri, slug); const E = E0 || (ik ? { [slug]: ik } : elleV5());
  const jf = path.join(dir, 'cikarici.json'); const hf = path.join(dir, 'hero-secim.json');
  if (!fs.existsSync(jf)) return { slug, status: 'elendi', reasons: ['cikarici.json yok'] };
  if (!fs.existsSync(hf)) return { slug, status: 'elendi', reasons: ['hero-secim.json yok (once v5-hero.mjs)'] };
  const R = JSON.parse(fs.readFileSync(jf, 'utf8')); const HS = JSON.parse(fs.readFileSync(hf, 'utf8'));
  const e = E[slug] || {}; const lead = R.lead; const lang = lead.lang === 'tr' ? 'tr' : 'en'; const L = T[lang]; const region = lead.region;
  const name = clean(R.name.n); const warn = []; const notes = [];
  if (!R.erisim || !R.erisim.ok) return { slug, status: 'elendi', reasons: ['site okunamadi'] };

  // ---- palet + dil ----
  const { pal, notes: pn } = paletKur(R, e); notes.push(...pn);
  if (!paletteOk(pal.checks)) warn.push(`kontrast: ${pal.checks.filter((c) => !c.pass).map((c) => `${c.name} ${c.ratio}`).join(', ')}`);
  if (pal.fallback) warn.push('marka rengi bulunamadi');
  const sadakat = paletSadakati(R, pal); if (!sadakat.ok) warn.push(`palet sadakati: ${sadakat.sorun.join('; ')}`);
  const ds = e.dil && DILLER[e.dil] ? { dil: e.dil, neden: ['elle seçildi'] } : dilSec(R, pal);
  const dil = ds.dil; const D = DILLER[dil]; const dark = pal.mode === 'dark'; const t = pal.t;

  // ---- cikti klasoru ----
  const rel = pageDirV5(slug); const pdir = path.join(out, rel); const imgDir = path.join(pdir, 'img');
  fs.rmSync(imgDir, { recursive: true, force: true }); fs.mkdirSync(imgDir, { recursive: true });

  // ---- ana fotograf: hero-secim.json'daki tek kare, kendi boyutlarinda (buyutme yok) ----
  const sec = HS.secilen; const variant = HS.duzen === 'cerceve' || sec.w < 1920 ? 'cerceve' : 'tam';
  const files = {}; let biggest = null;
  for (const [k, f] of Object.entries(sec.files || {})) {
    const src = path.join(dir, 'hero', f.file); if (!fs.existsSync(src)) { warn.push(`hero dosyasi yok: ${f.file}`); continue; }
    fs.copyFileSync(src, path.join(imgDir, f.file));
    const mt = await sharp(src).metadata(); files[k] = { file: f.file, w: mt.width, h: mt.height, kb: Math.round(fs.statSync(src).size / 1024) };
    if (!biggest || mt.width > biggest.w) biggest = files[k];
  }
  if (!biggest) return { slug, status: 'elendi', reasons: ['hero dosyalari yok'] };
  const heroBuf = fs.readFileSync(path.join(imgDir, (files['1600'] || biggest).file));
  const alt = e.alt || {};
  const hero = { id: sec.id, w: biggest.w, h: biggest.h, files, focus: { x: sec.focus ? sec.focus.x : 0.5, y: sec.focus ? sec.focus.y : 0.5 }, alt: clean(alt[sec.id] || ''), orig: sec.gercekPiksel || `${sec.w}x${sec.h}`, kaynak: sec.url };
  if (variant === 'tam' && biggest.w < 1920) warn.push(`tam ekran hero ${biggest.w} px (1920 altinda)`);

  // ---- fotograflar (bolumler) ----
  const F = e.foto || {}; const pics = {};
  // FOTO UYUMU (12 Kas, lib/foto-uyum.mjs): uymayan kare (logo, harita, ikon, kucuk, bulanik, ture uymayan stok) yuvaya girmez; yuva daralir, uyari son goze gider
  const uyum = fotoUyum(R.photos || [], uyumBaglami(R, { sablon: 'v5', menuItems: (e.menu && e.menu.items) || null }));
  const yuvalar = [['foto.menu', F.menu], ['foto.quiet', F.quiet], ['foto.story', F.story], ['foto.contact', F.contact], ...(F.cards || []).map((id, i) => [`foto.cards[${i}]`, id]), ...(((e.cards && e.cards.items) || []).map((x, i) => [`cards.items[${i}]`, x && x.pic]))]
    .filter(([, id]) => id && String(id) !== String(sec.id)).map(([yuva, id]) => ({ yuva, id: String(id) }));
  const daralt = yuvaDaralt(yuvalar, uyum); const fotoUyari = [...new Set(daralt.uyari)];
  const heroUy = yuvaUygun(uyum, sec.id); const heroUyumsuz = heroUy.ok ? null : `kare ${sec.id}: ${heroUy.neden}`;
  if (heroUyumsuz) fotoUyari.unshift(`foto uyumu: ana fotograf ${heroUyumsuz}`);
  warn.push(...fotoUyari);
  const ids = [F.menu, F.quiet, F.story, F.contact, ...(F.cards || [])].filter(Boolean).filter((id) => daralt.gecen.has(String(id)));
  for (const id of new Set(ids)) { if (String(id) === String(sec.id)) continue; const p = await picKur(id, R, dir, imgDir, alt[id]); if (p) pics[id] = p; else warn.push(`foto yok: ${id}`); }
  const P = (id) => (id ? pics[id] || null : null);

  // ---- logo: orijinal dosya aynen ----
  const logo = await logoKur({ ...R, slug }, dir, imgDir, t, { shade: t.shade });
  let topSolid = false;
  if (!logo) warn.push('logo yok');
  else {
    const px = await logoPiksel(fs.readFileSync(path.join(imgDir, logo.file)), R.logo.orig.mime);
    const onPhoto = gorunurOran(px.lums, t.shade);
    // logo fotograf ustunde okunmuyorsa ya da kendi dolu zemini (plaka) varsa ust cubuk bastan logonun zemininde durur
    topSolid = logo.plate || onPhoto < 0.9; logo.onPhoto = +onPhoto.toFixed(3);
    // alt bilgi koyu yuzeyde: logo orada okunmuyorsa kendi zemininde (plaka) durur
    logo.onDeep = +gorunurOran(px.lums, t.deep).toFixed(3); logo.footPlate = !logo.plate && logo.onDeep < 0.9;
    // ust cubuk yazisi: paletin kendi metin rengi (sitenin hesaplanan nav rengi tarayici varsayilani #0000ee olabiliyor)
    logo.headInk = [t.ink, t.onDeep, '#ffffff', '#111111'].find((c) => contrast(c, logo.headBg) >= 7) || logo.headInk;
    if (logo.hero) { fs.rmSync(path.join(imgDir, logo.hero.file), { force: true }); delete logo.hero; }
    // LOGO NETLIK (12 Kas): dosya 2x icin kucukse acilis isletme adini yazar (kurala uygun otomatik cozum: not); baslikta da olmuyorsa son goz bilir (uyari)
    if (logo.acilisYazi) notes.push(`logo netlik: dosya ${logo.w}x${logo.h}, acilista 2x net gosterilemez; acilista isletme adi yazili`);
    if (logo.baslikYazi) warn.push(`logo netlik: dosya ${logo.w}x${logo.h}, baslikta 2x net gosterilemez; baslik ve alt bilgide isletme adi yazili`);
  }

  // ---- font ----
  const fe = dilFontlari(dil);
  const { files: ffiles, missing } = fontKur(fe, out);
  if (missing.length) warn.push(`font dosyasi yok: ${missing.join(', ')}`);
  const latin = (id, w, st) => ffiles.find((x) => x.id === id && x.subset === 'latin' && x.weight === w && x.style === st);
  const fontPreload = [latin(fe.display.id, fe.display.weight, fe.display.italic ? 'italic' : 'normal'), latin(fe.text.id, fe.text.weight, 'normal')].filter(Boolean).map((x) => dosyaAdi(x.id, x.subset, x.weight, x.style)).filter((v, i, a) => a.indexOf(v) === i);
  notes.push(...fe.notes);

  // ---- slogan ----
  let slogan;
  if (e.slogan && e.slogan.text) {
    const red = sloganDogrula(e.slogan.text, name);
    if (red) { warn.push(`elle slogan reddedildi: ${red}`); }
    else slogan = { ham: e.slogan.text, kaynak: `elle (${e.slogan.kaynak || ''})`, aday: (e.slogan.aday || []).map((x) => x.replace(/\*/g, '')), neden: e.slogan.neden || '' };
  }
  if (!slogan) return { slug, status: 'elendi', reasons: ['slogan yok (v5 icin data/v5-elle.json gerekir)'] };
  slogan.text = slogan.ham.replace(/\*/g, ''); slogan.parts = sloganParcalari(slogan.ham);
  if (ascii(slogan.text) === ascii(name)) warn.push('slogan isletme adiyla ayni');
  const size = boyutV5(dil, slogan.text, fe);

  // ---- konum, telefon ----
  const K = e.konum || {};
  const address = clean(K.address) || (R.address ? adresTemizle(clean(R.address.text)) || null : null);
  const phoneRaw = clean(K.phone) || (R.phone ? clean(R.phone) : null);
  const tel = phoneRaw ? telHref(phoneRaw, region) : null;
  let phone = phoneRaw;
  if (phone && region === 'AU' && /^\+61\d{9}$/.test(phone)) phone = `(0${phone[3]}) ${phone.slice(4, 8)} ${phone.slice(8)}`;
  // adres OSM'den geldiyse (cikarici.json address.konum) harita koordinata gider; elle adres (icerik.konum) sitenin metnidir, koordinat kullanilmaz
  const konum = !clean(K.address) && R.address && R.address.konum ? R.address.konum : null;
  const maps = address ? mapsUrl(address, name, lead.city, konum) : null;
  if (K.kaynak) notes.push(`adres/telefon: ${K.kaynak}`);

  // ---- saat ----
  let hoursIn = R.hours;
  if (e.saat && Array.isArray(e.saat.satirlar) && e.saat.satirlar.length) {
    const p = parseSaatler(e.saat.satirlar);
    if (p && p.tableOk) { hoursIn = p; notes.push(`saatler sitenin kendi satırlarından (${e.saat.kaynak || 'elle'})`); } else warn.push('elle saat satirlari cozulmedi');
  }
  if (hoursIn === R.hours && R.hours && R.hours.via) notes.push(`saatler ${R.hours.via}${R.hours.ham ? `: "${R.hours.ham}"` : ''} (sitede saat yok)`);
  if (konum) notes.push(`adres ve harita ${R.address.via || 'osm'} (sitede adres yok)`);
  const sd = saatDenetle(hoursIn); const hrs = sd.hours;
  const h12 = ['AU', 'NZ', 'US', 'CA', 'SG'].includes(region); const tz = tzOf(lead.city, region);
  let known = 0; if (hrs) for (let d = 0; d < 7; d++) if (hrs.week[d] || (hrs.byDay && hrs.byDay[d] === 'closed')) known++;
  const hoursOk = !!hrs && known >= 5; const statusOk = !!hrs && known === 7 && !!tz;
  const hoursSummary = hoursOk ? saatOzetV5(hrs, lang, h12) : [];
  const hoursTable = hoursOk ? saatTabloV5(hrs, lang, h12) : null;
  if (!statusOk) warn.push('"simdi acik" gosterilemiyor (7 gunun saati ya da saat dilimi eksik)');

  // ---- tek ana eylem: isletmenin gercek baglantisi ----
  // telefon eylemi (TR devam-3; 12 Kas 2026 butun ulkeler): karar 'telefon' dediyse cikaricinin dis rezervasyon izi de kullanilmaz; ana dugme isletmenin kendi numarasi
  const telKarar = !!(e.cta && e.cta.tur === 'telefon');
  const resv = telKarar ? null : (e.cta && e.cta.url) || (R.reservation && R.reservation.external ? R.reservation.url : null);
  // TR (11 Kas 2026): eylemin turu gercek baglantidan; siparis platformu -> "Sipariş ver", WhatsApp hatti -> "WhatsApp'tan yazın"/"sipariş ver", rezervasyon -> "Masa ayırtın"
  const ct = e.cta || {}; const pl = resv ? platformOf(resv) : null;
  const trEtiket = lang !== 'tr' || !resv ? null
    : ct.label ? { label: ct.label, short: ct.short || ct.label, short2: ct.label }
      : pl === 'WhatsApp' ? (/sipari/i.test(`${ct.tur || ''} ${ct.metin || ''}`) ? { label: 'WhatsApp\'tan sipariş ver', short: 'Sipariş', short2: 'Sipariş ver', ikon: 'chat' } : { label: 'WhatsApp\'tan yazın', short: 'WhatsApp', short2: 'WhatsApp\'tan yazın', ikon: 'chat' })
        : (ct.tur === 'siparis' || (pl && ct.tur !== 'rezervasyon')) ? { label: 'Sipariş ver', short: 'Sipariş', short2: 'Sipariş ver', ikon: 'bag' } : null;
  const main = resv ? { href: resv, label: L.book, short: L.bookShort, short2: L.book, ...(trEtiket || {}), ext: true }
    : tel ? { href: `tel:${tel}`, label: telKarar && ct.label ? ct.label : `${L.call} ${phone}`, short: telKarar && ct.short ? ct.short : L.call, short2: telKarar && ct.label ? ct.label : lang === 'tr' ? 'Arayın' : 'Call us', tel: true }
      : { href: maps, label: L.directions, short: L.directionsShort, ext: true };

  // ---- bolumler (yalniz dolu olanlar) ----
  const parts = (s) => sloganParcalari(String(s || ''));
  const mE = e.menu; let menu = null; let menuItems = 0;
  if (mE && Array.isArray(mE.items) && mE.items.length) {
    menu = { pic: P(F.menu), kicker: mE.kicker || L.menu, h2: parts(mE.h2 || L.menu), p: mE.p || '', items: mE.items.map((it) => ({ n: clean(it.n), d: clean(it.d), p: clean(it.p) })), legend: mE.legend || '', link: mE.link || (R.menu && R.menu.pageUrl) || null };
    menuItems = menu.items.filter((x) => x.p).length;
    if (!menu.pic) { warn.push('menu fotografi yok'); menu = null; menuItems = 0; }
  }
  const second = menu ? { href: '#menu', label: L.seeMenu } : null;
  const cards = e.cards && e.cards.items ? { kicker: e.cards.kicker, h2: parts(e.cards.h2), p: e.cards.p || '', items: e.cards.items.map((it) => ({ pic: P(it.pic), t: it.t, sub: it.sub || '' })).filter((x) => x.pic) } : null;
  if (cards && cards.items.length < 3) { warn.push('kart fotografi eksik; kartlar gosterilmedi'); }
  const story = e.story ? { kicker: e.story.kicker || '', text: e.story.text, p: e.story.p || '', pic: P(F.story) } : null;
  // sessiz fotograf bolumu yatay kare ister (dik kare bu bolumde daralir ve yazi sigmaz)
  let quiet = e.quiet && P(F.quiet) ? { pic: P(F.quiet), kicker: e.quiet.kicker || '', h2: parts(e.quiet.h2), p: e.quiet.p || '' } : null;
  if (quiet && quiet.pic.w / quiet.pic.h < 1.3) { warn.push(`sessiz bolum fotografi dik (${quiet.pic.id}); bolum gosterilmedi`); quiet = null; }
  const contact = { kicker: (e.contact && e.contact.kicker) || L.visit, h2: parts((e.contact && e.contact.h2) || L.visitH.join(' ')), notes: (e.contact && e.contact.notes) || [], pic: P(F.contact) };
  const marquee = Array.isArray(e.marquee) && e.marquee.length >= 4 ? e.marquee : null;

  // ---- yuzeyler ----
  const panel = { bg: t.accent, ink: t.accentInk }; panel.muted = ikincil(panel.ink, panel.bg);
  const card = dark ? { bg: t.bg, ink: t.ink } : { bg: t.bg2, ink: t.ink }; card.muted = ikincil(card.ink, card.bg);
  if (contrast(panel.ink, panel.bg) < 4.5) warn.push(`panel yazisi kontrasti ${contrast(panel.ink, panel.bg).toFixed(2)}`);

  // ---- foto ustunde yazi okunurlugu (tahmin; kapi gercek olcer) ----
  const shadeL = lumHex(t.shade); const worst = await p90Alt(heroBuf, dil === 'mekan' ? 0.3 : 0.45);
  const shadeM = +Math.max(0.6, Math.min(0.95, (worst - 0.152) / Math.max(0.05, worst - shadeL))).toFixed(3);
  const shadeA = +Math.max(0.94, Math.min(0.99, shadeM + 0.04)).toFixed(3);
  const heroContrast = +(1.05 / (worst * (1 - shadeM) + shadeL * shadeM + 0.05)).toFixed(2);
  if (heroContrast < 4.5) warn.push(`hero yazi kontrasti (tahmin) ${heroContrast}`);

  // ---- dev wordmark: adin uzunluguna gore, tasmaz ----
  const wmLen = Math.max(4, name.length); const wmW = size.wch;
  const wm = `clamp(28px, ${Math.min(12, 88 / (wmLen * wmW)).toFixed(2)}vw, 240px)`;

  const model = {
    slug, lang, name, cityLabel: cityLabel(lead.city, lang), site: lead.site, dil, referans: D.referans, variant, topSolid, dark,
    palette: pal, font: fe, fontFaceCss: fontFaceCss(ffiles, `../../${ORTAK_V5}/fonts/`), ortak: ORTAK_V5, fontPreload,
    fallback: { display: FALLBACK[fe.display.cls] || FALLBACK.geo, text: FALLBACK[fe.text.cls] || FALLBACK.neo },
    // icerik.golgeMerkez (11 Kas, TR denemesi): sicak dilinde basligin arkasindaki golge yalniz koyulasabilir (.46 -> en cok .75); cok acik zeminli (beyaz masa) kahramanda ust etiket okunsun diye
    shadeR: e.golgeMerkez ? +Math.max(0.46, Math.min(0.75, Number(e.golgeMerkez) || 0)).toFixed(2) : null,
    size, hero, logo, shadeA, shadeM, panel, card, wm, footPlate: !!(logo && logo.footPlate),
    slogan, eyebrow: e.eyebrow || '', lede: e.lede || '', tags: e.tags || [],
    cta: { main, second }, statusOk, hoursOk, hoursSummary, hoursTable, week: hrs ? hrs.week : null, h12, tz,
    address, phone, tel, mapsUrl: maps, social: R.social || {}, also: e.also || [],
    marquee, menu, cards: cards && cards.items.length >= 3 ? cards : null, story, quiet, contact,
    order: ((o) => (o.includes('contact') ? o : o.concat('contact')))(Array.isArray(e.order) && e.order.length ? e.order : ['menu', 'story', 'contact']),
  };

  // ---- yaz ----
  const css = themeCssV5(model) + `@media (max-width:899px){:root{--wm-size:clamp(24px,${Math.min(15, 90 / (wmLen * wmW)).toFixed(2)}vw,96px)}}\n`;
  fs.writeFileSync(path.join(pdir, 'theme.css'), css);
  const html = sayfaHtmlV5(model);
  if (yasakVar('kisaltma', html.replace(/<script[\s\S]*?<\/script>/g, ''))) warn.push('sayfa metninde yasak kisaltma geciyor');
  fs.writeFileSync(path.join(pdir, 'index.html'), html);
  const shared = path.join(out, ORTAK_V5); fs.mkdirSync(shared, { recursive: true });
  for (const x of ['v5.css', 'v5.js']) fs.copyFileSync(path.join(HERE, 'sablon', x), path.join(shared, x));
  const lic = [...new Set([fe.display, fe.text, fe.script].filter(Boolean).map((x) => `${x.family}: ${x.license} (fontsource / Google Fonts)`))];
  const licF = path.join(shared, 'fonts', 'LICENSES.txt');
  const have = fs.existsSync(licF) ? fs.readFileSync(licF, 'utf8').split('\n').filter(Boolean) : [];
  fs.writeFileSync(licF, [...new Set([...have, ...lic])].sort().join('\n') + '\n');

  const report = {
    slug, surum: 'v5', page: `${rel}/index.html`, lang, mode: pal.mode, dil, referans: D.referans, dilNeden: ds.neden, variant, topSolid,
    slogan: { text: slogan.text, kaynak: slogan.kaynak, aday: slogan.aday, neden: slogan.neden },
    logo: logo ? { file: logo.file, sha256: logo.sha256, kaynak: logo.kaynak, w: logo.w, h: logo.h, headBg: logo.headBg, headInk: logo.headInk, plate: logo.plate, onPhoto: logo.onPhoto } : null,
    fonts: { display: { id: fe.display.id, family: fe.display.family, via: fe.display.via, orig: fe.display.orig, weight: fe.display.weight, license: fe.display.license }, text: { id: fe.text.id, family: fe.text.family, via: fe.text.via, orig: fe.text.orig, license: fe.text.license }, script: fe.script ? { id: fe.script.id, family: fe.script.family, orig: fe.script.orig } : null },
    palette: { accent: t.accent, accentInk: t.accentInk, bg: t.bg, bg2: t.bg2, ink: t.ink, deep: t.deep, shade: t.shade, panel: panel.bg, card: card.bg, accentVia: pal.source.accent && pal.source.accent.via, ok: paletteOk(pal.checks), checks: pal.checks, marka: pal.marka, sadakat },
    hero: { id: hero.id, served: `${hero.w}x${hero.h}`, orig: hero.orig, files: Object.values(files).map((f) => `${f.file} ${f.w}x${f.h} ${f.kb}KB`), kaynak: hero.kaynak, neden: sec.neden, gozle: sec.gozle || null, adaylar: (HS.adaylar || []).slice(0, 5).map((a) => ({ id: a.id, px: `${a.w}x${a.h}`, puan: a.puan, neden: a.neden })), duzen: variant },
    heroContrast, shadeA, shadeM, photos: Object.keys(pics).length + 1, menuItems, menuLink: !!(menu && menu.link), menuKaynak: mE ? mE.kaynak || null : null,
    hoursOk, hoursIssue: sd.issue, statusOk, tz, sections: model.order.filter((k) => model[k]), notes, warn, size: size.h1,
    fotoUyum: { tur: uyum.tur, ozet: uyum.ozet, sira: uyum.sira }, fotoUyari, heroUyumsuz,
  };
  if (yazRapor) fs.writeFileSync(path.join(dir, 'uret.json'), JSON.stringify(report, null, 1));
  log(`uretildi (v5): ${rel}  (${dil}/${D.referans}, ${variant}, slogan "${slogan.text}", font ${fe.display.id}/${fe.text.id}, ${pal.mode}, hero ${hero.w}x${hero.h} (orijinal ${hero.orig}), menu ${menuItems}, saat ${hoursOk ? 'var' : 'yok'}${statusOk ? ' + simdi acik' : ''}${warn.length ? ', UYARI: ' + warn.join('; ') : ''})`);
  return { slug, status: 'uretildi', dir: pdir, rel, report, model };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const which = process.argv[2];
  if (!which) { console.error('kullanim: UYARLA_VERI=<uyarla-veri-v5> node uyarla/uret-v5.mjs <slug,slug> [--out web/demo klasoru]'); process.exit(2); }
  const out = arg('--out', DEMO);
  for (const s of which.split(',')) { try { const r = await uretV5(s, { out }); if (r.status !== 'uretildi') console.log(`${s}: ${r.status} (${r.reasons.join('; ')})`); } catch (err) { console.log(`${s}: HATA ${err.stack.split('\n').slice(0, 4).join(' | ')}`); } }
}
