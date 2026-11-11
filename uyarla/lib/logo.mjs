// LOGO: isletmenin ORIJINAL dosyasi aynen kullanilir. Yeniden renklendirme, filtre, kirpma, germe, harf cizimi YOK.
// Logo koyu zemin icin yapilmissa ve baslik acik ise (ya da tersi), degisen LOGO degil BASLIGIN ARKA PLANIDIR.
// Burada: orijinali kaydet, piksel analizi, baslik yuzeyi secimi, goruntu boyutu, dusuk cozunurluk karari.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { sharp, lin } from './gorsel.mjs';
import { contrast } from './renk.mjs';

const EXT = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/avif': 'avif' };
export const lumHex = (hex) => 0.2126 * lin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16));
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

// orijinal baytlar aynen yazilir (600 KB ustu raster: yalniz oran korunarak kayipsiz kucultme).  -> { file, mime, bytes, sha256, w, h, svg, note }
export async function orijinalKaydet(buf, mime, imgDir) {
  const svg = mime === 'image/svg+xml';
  let out = buf; let ext = EXT[mime] || 'png'; let note = null;
  if (!svg && buf.length > 600_000) {
    const m0 = await sharp(buf, { limitInputPixels: 80e6 }).metadata();
    if (m0.width > 1600) { out = await sharp(buf, { limitInputPixels: 80e6 }).resize({ width: 1600 }).png({ compressionLevel: 9 }).toBuffer(); ext = 'png'; note = 'büyük dosya: oran korunarak 1600 px PNG'; }
  }
  const meta = await sharp(out, { limitInputPixels: 80e6, density: svg ? 96 : undefined }).metadata();
  const file = `logo-orijinal.${ext}`;
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(imgDir, file), out);
  // sayfada kullanilan dosya kucultulduysa (600 KB ustu), sitenin gonderdigi HAM bayt ayrica ve degistirilmeden saklanir (sha256 ile)
  let ham = null;
  if (out !== buf) { const hext = EXT[mime] || 'png'; const hf = `logo-ham.${hext}`; fs.writeFileSync(path.join(imgDir, hf), buf); ham = { file: `img/${hf}`, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') }; }
  return { file: `img/${file}`, mime: svg ? mime : `image/${ext === 'jpg' ? 'jpeg' : ext}`, bytes: out.length, sha256: crypto.createHash('sha256').update(out).digest('hex'), w: meta.width, h: meta.height, svg, note, ...(ham ? { ham } : {}) };
}

// piksel analizi (yalniz okur): opak piksellerin aciklik listesi, seffaf mi, zeminli logoda kose rengi
export async function logoPiksel(buf, mime) {
  const svg = mime === 'image/svg+xml';
  const o = await sharp(buf, { limitInputPixels: 80e6, density: svg ? 200 : undefined, animated: false }).resize({ width: 360, height: 360, fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = o; const W = info.width; const H = info.height; const n = W * H;
  const lums = []; let transp = 0; let ink = null;
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    if (a < 20) { transp++; continue; }
    if (a >= 230) lums.push(0.2126 * lin(data[i * 4]) + 0.7152 * lin(data[i * 4 + 1]) + 0.0722 * lin(data[i * 4 + 2]));
  }
  const alpha = transp / n > 0.03;
  let corner = null;
  if (!alpha) {
    const blocks = [[0, 0], [W - 6, 0], [0, H - 6], [W - 6, H - 6]].map(([x0, y0]) => { let r = 0; let g = 0; let b = 0; let c = 0; for (let y = Math.max(0, y0); y < Math.min(H, y0 + 6); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + 6); x++) { const p = (y * W + x) * 4; r += data[p]; g += data[p + 1]; b += data[p + 2]; c++; } return [r / c, g / c, b / c]; });
    const spread = [0, 1, 2].map((k) => Math.max(...blocks.map((b) => b[k])) - Math.min(...blocks.map((b) => b[k])));
    if (Math.max(...spread) < 24) corner = `#${hex2(blocks.reduce((s, b) => s + b[0], 0) / 4)}${hex2(blocks.reduce((s, b) => s + b[1], 0) / 4)}${hex2(blocks.reduce((s, b) => s + b[2], 0) / 4)}`;
  }
  return { alpha, lums: Float32Array.from(lums), corner, w: W, h: H, ink };
}

// logonun opak piksellerinin kacta kaci bu zeminde okunur (kontrast >= min)
export function gorunurOran(lums, surfaceHex, min = 2) {
  if (!lums || !lums.length) return 1;
  const Ls = lumHex(surfaceHex); let ok = 0;
  for (const l of lums) if ((Math.max(l, Ls) + 0.05) / (Math.min(l, Ls) + 0.05) >= min) ok++;
  return ok / lums.length;
}

// BASLIK YUZEYI: logo hangi zeminde okunur.  top: foto uzerindeki ilk hal (null = seffaf kalir), solid: kaydirinca, foot: alt bilgi.
// Donus: { mode:'alpha'|'plate', top, topInk, solid, solidInk, foot, vis:{...} }  (renk yok = sayfanin kendi varsayilani)
export function baslikYuzeyi(lg, t, { heroDark = '#1a1612', esik = 0.94 } = {}) {
  const ink = (s) => [t.ink, t.onDeep, '#ffffff', '#111111'].find((c) => contrast(c, s) >= 7) || (lumHex(s) > 0.4 ? '#111111' : '#ffffff');
  const LIGHT = '#f4f0e8'; const DARK = '#15120f';
  if (!lg.alpha && lg.corner) { const c = lg.corner; return { mode: 'plate', top: c, topInk: ink(c), solid: c, solidInk: ink(c), foot: c, vis: { plate: c } }; }
  const vis = (s) => gorunurOran(lg.lums, s);
  const pick = (list) => { let best = null; for (const s of list) { const v = vis(s); if (v >= esik) return { s, v }; if (!best || v > best.v) best = { s, v }; } return best; };
  const out = { mode: 'alpha', vis: {} };
  const vHero = vis(heroDark); out.vis.hero = +vHero.toFixed(3);
  if (vHero >= esik) { out.top = null; out.topInk = null; }
  else { const p = pick([t.bg2, t.bg, '#ffffff', LIGHT, t.deep, DARK]); out.top = p.s; out.topInk = ink(p.s); out.vis.top = +p.v.toFixed(3); }
  if (out.top) { out.solid = out.top; out.solidInk = out.topInk; }
  else {
    const vb = vis(t.bg); out.vis.bg = +vb.toFixed(3);
    if (vb >= esik) { out.solid = null; out.solidInk = null; }
    else { const p = pick([t.deep, DARK, '#ffffff', LIGHT]); out.solid = p.s; out.solidInk = ink(p.s); out.vis.solid = +p.v.toFixed(3); }
  }
  out.foot = vis(t.bg) >= esik ? null : (out.solid || out.top || pick([t.deep, DARK, '#ffffff']).s);
  return out;
}

// goruntu boyutu (CSS px).  Raster logo: yukseklik dogal yuksekligin ~yarisi (2x keskinlik), masaustu 40-56, telefon 32-40.  SVG: 48 / 36.
export function logoBoyut(lg) {
  const svg = !!lg.svg;
  const h = (min, max, svgH) => (svg ? svgH : Math.max(min, Math.min(max, Math.round(lg.h / 2))));
  const d = h(40, 56, 48); const m = h(32, 40, 36); const f = h(44, 60, 52);
  return { d, m, f, maxW: 260, maxWm: 44 };
}
// dusuk cozunurluk: raster logo masaustu en kucuk yukseklikte (40 px) bile ~2x (en az 1,75x) keskin olamiyorsa yazi logosuna donulur
export const ORAN_MIN = 1.75;
export function dusukCozunurluk(lg) {
  if (lg.svg) return false;
  return lg.h / 40 < ORAN_MIN || lg.w < 90;
}
