// Gorsel analizi ve kucultme (sharp, tarayici yok): boyut, keskinlik, duzluk (afis/menu fotografi), odak noktasi, renk paleti, logo tonu, benzerlik parmak izi.
// Hicbir sey agdan gelmez; girdi bellekteki bir Buffer'dir.
import sharp from 'sharp';
sharp.cache(false);
sharp.concurrency(1);

export const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

export function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.slice(4, 12).toString().includes('ftypavif')) return 'image/avif';
  if (buf.slice(0, 3).toString() === 'GIF') return 'image/gif';
  const head = buf.slice(0, 500).toString('utf8').toLowerCase();
  if (head.includes('<svg') || (head.includes('<?xml') && head.includes('svg'))) return 'image/svg+xml';
  return null;
}

// -> { w, h, mime, meanL, meanS, transparent, whiteFrac, opaqueL, flat, gridStd, lapVar, focus:{x,y,spanX}, palette:[{hex,share,sat,l}], hash } | { error }
export async function analiz(buf, mime = sniff(buf)) {
  try {
    const svg = mime === 'image/svg+xml';
    const base = () => sharp(buf, { limitInputPixels: 80e6, density: svg ? 200 : undefined, animated: false });
    const meta = await base().metadata();
    let W = meta.width; let H = meta.height;
    if (!W || !H) return { error: 'no-size' };
    const o = await base().resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: !svg }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const d = o.data; const sw = o.info.width; const sh = o.info.height; const n = sw * sh;
    const L = new Float32Array(n); const Sat = new Float32Array(n); const A = new Uint8Array(n);
    let sumL = 0; let sumS = 0; let transparent = 0; let white = 0; let opaque = 0; let sumLop = 0;
    for (let i = 0; i < n; i++) {
      const r = d[i * 4]; const g = d[i * 4 + 1]; const b = d[i * 4 + 2]; const a = d[i * 4 + 3];
      A[i] = a;
      const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
      const s = mx === 0 ? 0 : (mx - mn) / mx;
      L[i] = l; Sat[i] = s; sumL += l; sumS += s;
      if (a < 40) transparent++; else { opaque++; sumLop += l; if (l > 0.82 && s < 0.12) white++; }
    }
    let flat = 0; let blocks = 0;
    for (let by = 0; by + 8 <= sh; by += 8) for (let bx = 0; bx + 8 <= sw; bx += 8) {
      let m = 0; let m2 = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = L[(by + y) * sw + bx + x] * 255; m += v; m2 += v * v; }
      m /= 64; const vr = m2 / 64 - m * m; blocks++; if (vr < 6) flat++;
    }
    // keskinlik: 600 px genislikte Laplace varyansi
    const tw = Math.min(600, W);
    const g2 = await base().flatten({ background: '#ffffff' }).resize({ width: tw }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const gw = g2.info.width; const gh = g2.info.height; const g = g2.data;
    let lm = 0; let l2 = 0; let cnt = 0;
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const i = y * gw + x; const v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - gw] - g[i + gw]; lm += v; l2 += v * v; cnt++; }
    lm /= Math.max(1, cnt); const lapVar = l2 / Math.max(1, cnt) - lm * lm;
    // odak: 12x12 izgara, kenar + doygunluk, en iyi ceyregin agirlik merkezi
    const GX = 12; const GY = 12; const sc = [];
    for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
      let e = 0; let s = 0; let c = 0;
      const x0 = Math.floor(gx * sw / GX); const x1 = Math.floor((gx + 1) * sw / GX); const y0 = Math.floor(gy * sh / GY); const y1 = Math.floor((gy + 1) * sh / GY);
      for (let y = Math.max(1, y0); y < Math.min(sh - 1, y1); y++) for (let x = Math.max(1, x0); x < Math.min(sw - 1, x1); x++) { const i = y * sw + x; e += Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + sw] - L[i - sw]); s += Sat[i]; c++; }
      const cx = (gx + 0.5) / GX - 0.5; const cy = (gy + 0.5) / GY - 0.5;
      sc.push({ gx, gy, v: c ? (e / c) * 6 + (s / c) * 0.6 - (cx * cx + cy * cy) * 0.15 : 0 });
    }
    const top = [...sc].sort((a, b) => b.v - a.v).slice(0, Math.ceil(sc.length / 4));
    let tv = 0; let fx = 0; let fy = 0; let minx = 1; let maxx = 0;
    for (const b of top) { tv += b.v; fx += (b.gx + 0.5) / GX * b.v; fy += (b.gy + 0.5) / GY * b.v; minx = Math.min(minx, b.gx / GX); maxx = Math.max(maxx, (b.gx + 1) / GX); }
    const focus = tv > 0 ? { x: +(fx / tv).toFixed(3), y: +(fy / tv).toFixed(3), spanX: +(maxx - minx).toFixed(3) } : { x: 0.5, y: 0.5, spanX: 1 };
    // palet: kanal basina 4 bit, opak ve beyaz olmayan pikseller
    const bins = new Map();
    for (let i = 0; i < n; i++) {
      if (A[i] < 200) continue;
      const r = d[i * 4]; const gg = d[i * 4 + 1]; const b = d[i * 4 + 2];
      if (L[i] > 0.86 && Sat[i] < 0.14) continue;
      const key = ((r >> 4) << 8) | ((gg >> 4) << 4) | (b >> 4);
      const e = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += gg; e.b += b; bins.set(key, e);
    }
    const tot = [...bins.values()].reduce((a, e) => a + e.n, 0) || 1;
    const palette = [...bins.values()].map((e) => {
      const r = Math.round(e.r / e.n); const gg = Math.round(e.g / e.n); const b = Math.round(e.b / e.n);
      const mx = Math.max(r, gg, b); const mn = Math.min(r, gg, b);
      return { hex: `#${hex2(r)}${hex2(gg)}${hex2(b)}`, share: +(e.n / tot).toFixed(4), sat: +(mx === 0 ? 0 : (mx - mn) / mx).toFixed(3), l: +(0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b)).toFixed(3) };
    }).sort((a, b) => b.share - a.share).slice(0, 12);
    // benzerlik: 9x8 gri, yatay fark (dHash)
    const dh = await base().flatten({ background: '#ffffff' }).resize({ width: 9, height: 8, fit: 'fill' }).greyscale().raw().toBuffer();
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += dh[y * 9 + x] > dh[y * 9 + x + 1] ? '1' : '0';
    return { w: W, h: H, mime, meanL: +(sumL / n).toFixed(3), meanS: +(sumS / n).toFixed(3), transparent: +(transparent / n).toFixed(3), whiteFrac: +(white / Math.max(1, opaque)).toFixed(3), opaqueL: +(sumLop / Math.max(1, opaque)).toFixed(3), flat: +(flat / Math.max(1, blocks)).toFixed(3), lapVar: +lapVar.toFixed(1), focus, palette, hash: bits };
  } catch (e) { return { error: String(e && e.message || e).slice(0, 100) }; }
}

export const hamming = (a, b) => { let d = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++; return d; };

// kucultme: EXIF donusu uygulanir, buyutme yok, webp. -> { buf, w, h }
export async function kucult(buf, { maxW = 1280, quality = 72, svg = false } = {}) {
  const o = await sharp(buf, { limitInputPixels: 80e6, density: svg ? 300 : undefined, animated: false }).rotate().resize({ width: maxW, withoutEnlargement: !svg }).webp({ quality, effort: 5, alphaQuality: 92 }).toBuffer({ resolveWithObject: true });
  return { buf: o.data, w: o.info.width, h: o.info.height };
}

// kare/dikey kirpma (ornek: telefon posteri) odak noktasina gore
export async function kirp(buf, { w, h, focus = { x: 0.5, y: 0.5 }, quality = 70 }) {
  const meta = await sharp(buf).metadata();
  const ar = w / h; let cw = meta.width; let ch = Math.round(cw / ar);
  if (ch > meta.height) { ch = meta.height; cw = Math.round(ch * ar); }
  const left = Math.max(0, Math.min(meta.width - cw, Math.round(focus.x * meta.width - cw / 2)));
  const top = Math.max(0, Math.min(meta.height - ch, Math.round(focus.y * meta.height - ch / 2)));
  return sharp(buf).extract({ left, top, width: cw, height: ch }).resize({ width: w, height: h }).webp({ quality, effort: 5 }).toBuffer();
}

export { sharp };
