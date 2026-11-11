// 2. ADIM (renk): isletmenin kendi sitesinden (dugme rengi, logo, tema rengi, sayfa zemini, metin rengi) bir palet turetir ve her cifti WCAG kontrastiyla denetler.
// Hicbir renk uydurulmaz: bulunamazsa uyari yazilir ("marka rengi bulunamadi") ve gozden gecir listesine girer.
// Cikti: { mode:'light'|'dark', t:{bg,bg2,ink,muted,line,accent,accentInk,accentHi,accentText,deep,onDeep,onDeepMuted,accentOnDeep,heroInk,heroAccent,shade}, checks:[], warn:[], source:{} }
import { hexToRgb, lum, sat } from '../v2lib/scrape.mjs';
import { contrast, ensureContrast, rgbToHsl, hslToRgb, toHex } from '../v2lib/theme.mjs';

export { contrast };
const hex6 = (h) => { if (!h) return null; let x = String(h).trim().toLowerCase(); if (!x.startsWith('#')) return null; x = x.slice(1); if (x.length === 3) x = x.split('').map((c) => c + c).join(''); return /^[0-9a-f]{6}$/.test(x) ? `#${x}` : null; };
const rgbOf = (h) => hexToRgb(h);
const Lum = (h) => lum(rgbOf(h));
const Sat = (h) => sat(rgbOf(h));
const hsl = (h) => rgbToHsl(rgbOf(h));
const fromHsl = (h, s, l) => toHex(hslToRgb([h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))]));
const mix = (a, b, t) => { const A = rgbOf(a); const B = rgbOf(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const WHITE = '#ffffff';

// kontrasti saglayana kadar aciklik kaydirilir (ton ve doygunluk korunur)
const fit = (hex, against, min) => { const list = [].concat(against); let c = hex; for (let i = 0; i < 4; i++) { let ok = true; for (const a of list) { if (contrast(c, a) < min) { c = ensureContrast(c, a, min); ok = false; } } if (ok) break; } return c; };

const usableAccent = (h) => { if (!h) return false; const s = Sat(h); const l = Lum(h); return s >= 0.26 && l > 0.02 && l < 0.8; };

export function renkPaleti(R, { photoPalette = [] } = {}) {
  const C = R.colours || {}; const hints = C.hints || {}; const comp = C.computed || {}; const used = C.used || {};
  const warn = []; const source = {};
  // ---- sayfa zemini ve mod ----
  const bgList = (used.bg || []).map((x) => ({ hex: hex6(x.hex), w: x.w })).filter((x) => x.hex);
  const bodyBg = hex6(comp.body && comp.body.bg);
  const neutralBgs = bgList.filter((x) => Sat(x.hex) < 0.38 || Lum(x.hex) < 0.06);
  let base = neutralBgs[0] ? neutralBgs[0].hex : bodyBg || '#ffffff';
  // koyu site: en buyuk iki koyu zemin
  const darkBgs = neutralBgs.filter((x) => Lum(x.hex) < 0.12);
  // sitenin kendi sayfa zemini koyuysa (govde zemini) mod koyu: beyaz kartlar olsa bile sitenin ana havasi koyudur
  const bodyOwn = hex6(comp.body && comp.body.ownBg);
  const bodyDark = !!bodyOwn && Lum(bodyOwn) < 0.1 && Sat(bodyOwn) < 0.55;
  let mode = (Lum(base) < 0.14 || bodyDark) ? 'dark' : 'light';
  const totalBg = bgList.reduce((a, x) => a + x.w, 0) || 1;
  const siteDark = neutralBgs.filter((x) => Lum(x.hex) < 0.12 && x.w >= totalBg * 0.015)[0] || null; // sitenin kendi koyu yuzeyi (baslik, alt bilgi, koyu bolum)
  if (mode === 'light' && darkBgs.length && darkBgs[0].w > (neutralBgs[0] ? neutralBgs[0].w : 0) * 0.9) mode = 'dark';
  if (mode === 'dark') base = bodyDark ? bodyOwn : (darkBgs.length ? darkBgs.sort((a, b) => Lum(a.hex) - Lum(b.hex))[0].hex : base);
  source.baseBg = base; source.mode = mode;

  // ---- vurgu rengi ----
  const cands = [];
  const push = (hex, via) => { const h = hex6(hex); if (h && usableAccent(h)) cands.push({ hex: h, via }); };
  if (comp.btn) { push(comp.btn.ownBg, 'dugme'); }
  for (const b of used.buttons || []) push(b.hex, 'dugme(sayim)');
  for (const p of (R.logo && R.logo.palette) || []) if (p.share >= 0.04) push(p.hex, 'logo');
  push(hints.theme, 'theme-color'); push(R.colours && R.colours.themeColor, 'theme-color');
  for (const v of hints.vars || []) push(v.hex, `css:${v.name}`);
  for (const f of hints.freq || []) if (f.n >= 3) push(f.hex, 'css');
  for (const b of bgList) if (b.hex !== base) push(b.hex, 'zemin');
  for (const t of used.text || []) push(t.hex, 'metin');
  for (const p of photoPalette) if (p.share >= 0.06) push(p.hex, 'foto');
  let accent0 = cands[0];
  // sirke zemin ile ayni renk degil
  if (accent0 && contrast(accent0.hex, base) < 1.25) accent0 = cands.find((c) => contrast(c.hex, base) >= 1.25) || accent0;
  let fallback = false;
  if (!accent0) {
    // logo koyu/notr bir marka ise (siyah-beyaz) onu kullan, yoksa varsayilan: koyu modda amber, acik modda sicak kahve
    const lp = ((R.logo && R.logo.palette) || []).find((p) => p.share >= 0.15 && Lum(p.hex) < 0.5);
    if (lp) { accent0 = { hex: lp.hex, via: 'logo(notr)' }; }
    else { accent0 = { hex: mode === 'dark' ? '#d99a3d' : '#8a5a2b', via: 'varsayilan' }; fallback = true; warn.push('marka rengi bulunamadi (varsayilan renk kullanildi)'); }
  }
  source.accent = accent0;
  let accent = accent0.hex;
  const [ah, as0, al0] = hsl(accent);
  // ikinci marka rengi (logo ya da site): vurgudan farkli ton
  const second = cands.find((c) => c.via === 'logo' && hueDist(hsl(c.hex)[0], ah) >= 25) || ((R.logo && R.logo.palette) || []).map((p) => ({ hex: hex6(p.hex), via: 'logo(koyu)', share: p.share })).find((p) => p.hex && p.share >= 0.12 && Lum(p.hex) < 0.2 && Sat(p.hex) >= 0.2 && hueDist(hsl(p.hex)[0], ah) >= 20);
  source.second = second || null;

  // ---- yuzeyler ----
  let bg; let bg2;
  if (mode === 'dark') {
    bg = Lum(base) < 0.1 ? base : fromHsl(hsl(base)[0], Math.min(hsl(base)[1], 0.3), 0.07);
    const other = darkBgs.find((x) => x.hex !== bg && Lum(x.hex) > Lum(bg) && Lum(x.hex) < 0.14);
    bg2 = other ? other.hex : mix(bg, WHITE, 0.045);
  } else {
    bg = Lum(base) > 0.55 ? base : mix(base, WHITE, 0.82);
    const pure = Lum(bg) > 0.93 && Sat(bg) < 0.05;
    const hh = pure ? ah : hsl(bg)[0];
    const ss = pure ? Math.min(0.5, as0) : Math.max(0.1, hsl(bg)[1]);
    bg2 = pure ? fromHsl(hh, ss, 0.955) : mix(bg, fromHsl(hsl(bg)[0], ss, 0.88), 0.55);
    if (Lum(bg2) > Lum(bg) + 0.002) bg2 = mix(bg, '#000000', 0.04);
  }
  // ---- metin ----
  const siteInk = hex6(comp.body && comp.body.color) || ((used.text || [])[0] && hex6(used.text[0].hex));
  let ink;
  if (mode === 'light') {
    ink = siteInk && Lum(siteInk) < 0.2 && contrast(siteInk, bg) >= 9 ? siteInk : fromHsl(ah, Math.min(0.3, as0), 0.1);
  } else {
    // sitenin kendi acik metin rengi (en cok kullanilan) aynen; yoksa vurgu tonunda kirik beyaz
    const lightInk = [siteInk, ...(used.text || []).map((x) => hex6(x.hex))].find((h) => h && Lum(h) > 0.6 && contrast(h, bg) >= 10);
    ink = lightInk || fromHsl(ah, Math.min(0.18, as0), 0.93);
  }
  ink = fit(ink, [bg, bg2], 9);
  const muted = fit(mix(ink, bg, mode === 'light' ? 0.32 : 0.3), [bg, bg2], 4.7);
  const line = mode === 'light' ? mix(bg, ink, 0.16) : mix(bg, ink, 0.2);
  // ---- vurgu turevleri ----
  // dugme zemini: marka rengi aynen; uzerindeki yazi beyaz ya da koyu, hangisi okunuyorsa; ikisi de 4.5 vermezse vurgu kaydirilir
  const DARKINK = fromHsl(ah, Math.min(0.4, as0), 0.08);
  let accentInk = contrast(accent, WHITE) >= contrast(accent, DARKINK) ? WHITE : DARKINK;
  if (contrast(accent, accentInk) < 4.5) { accent = ensureContrast(accent, accentInk, 4.5); }
  const accentText = fit(accent, [bg, bg2], 4.5); // vurgu rengi METIN olarak (basliktaki vurgu, fiyat, baglanti)
  // koyu panel
  let deep;
  if (mode === 'dark') deep = mix(bg, '#000000', 0.25);
  else if (siteDark) deep = siteDark.hex;
  else if (second && Lum(second.hex) < 0.22) deep = fromHsl(hsl(second.hex)[0], Math.min(hsl(second.hex)[1], 0.6), Math.min(0.16, Math.max(0.08, hsl(second.hex)[2])));
  else deep = fromHsl(ah, Math.min(0.45, as0 * 0.6), 0.12);
  const onDeep = fit(fromHsl(hsl(deep)[0], 0.18, 0.94), [deep], 12);
  const onDeepMuted = fit(mix(onDeep, deep, 0.3), [deep], 4.7);
  const accentOnDeep = fit(accent, [deep], 4.5);
  const accentHi = mode === 'dark' ? fromHsl(ah, as0, Math.min(0.82, hsl(accent)[2] + 0.07)) : fromHsl(ah, as0, Math.max(0.12, hsl(accent)[2] - 0.06));
  // hero (fotograf uzerinde): beyaz yazi, vurgu koyu zeminde okunur
  const shade = mix(deep, '#000000', 0.45);
  const heroAccent = fit(accent, [mix(shade, '#2a2622', 0.35)], 5.5);
  const t = { bg, bg2, ink, muted, line, accent, accentInk, accentHi, accentText, deep, onDeep, onDeepMuted, accentOnDeep, heroInk: '#ffffff', heroAccent, shade };
  const checks = kontrastKontrol(t);
  return { mode, t, checks, warn, source, fallback };
}

// bir palet icin tum yazi-zemin ciftleri
export function kontrastKontrol(t) {
  const pairs = [
    ['ink / bg', t.ink, t.bg, 7], ['ink / bg2', t.ink, t.bg2, 7], ['muted / bg', t.muted, t.bg, 4.5], ['muted / bg2', t.muted, t.bg2, 4.5],
    ['accentText / bg', t.accentText, t.bg, 4.5], ['accentText / bg2', t.accentText, t.bg2, 4.5], ['accentInk / accent (dugme)', t.accentInk, t.accent, 4.5],
    ['onDeep / deep', t.onDeep, t.deep, 7], ['onDeepMuted / deep', t.onDeepMuted, t.deep, 4.5], ['accentOnDeep / deep', t.accentOnDeep, t.deep, 4.5],
    ['heroInk / hero zemin', t.heroInk, mix(t.shade, '#2a2622', 0.35), 7], ['heroAccent / hero zemin', t.heroAccent, mix(t.shade, '#2a2622', 0.35), 4.5],
  ];
  return pairs.map(([name, fg, bg, min]) => ({ name, fg, bg, ratio: +contrast(fg, bg).toFixed(2), min, pass: contrast(fg, bg) >= min }));
}
export const paletteOk = (checks) => checks.every((c) => c.pass);
