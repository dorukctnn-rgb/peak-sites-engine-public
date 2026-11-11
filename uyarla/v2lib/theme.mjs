// Brand palette of one business: 2-3 colours taken from its logo or its site, checked for contrast before they are used.
// primary  = the brand colour (buttons, accents); pi = the text colour that reads on primary (>= 4.5:1)
// deep     = a dark shade of the brand hue (headings, dark panels); ink = body text; paper / tint = light backgrounds
// second   = a second brand colour when the logo or the site really has one, else null (deep is used instead)
import { hexToRgb, lum, sat } from './scrape.mjs';

export const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const contrast = (a, b) => { const la = lum(typeof a === 'string' ? hexToRgb(a) : a); const lb = lum(typeof b === 'string' ? hexToRgb(b) : b); const [hi, lo] = la > lb ? [la, lb] : [lb, la]; return (hi + 0.05) / (lo + 0.05); };
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn; const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4);
  return [h * 60, s, l];
}
export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
  const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// the lightness is moved (hue and saturation kept) until `against` reaches `min`; direction decided by which side gets there
export function ensureContrast(hex, against, min = 4.5) {
  if (contrast(hex, against) >= min) return hex;
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const againstDark = lum(hexToRgb(against)) < 0.25;
  for (let step = 1; step <= 40; step++) {
    const l2 = Math.max(0, Math.min(1, l + (againstDark ? 1 : -1) * step * 0.02));
    const c = toHex(hslToRgb([h, s, l2]));
    if (contrast(c, against) >= min) return c;
  }
  return againstDark ? '#ffffff' : '#111111';
}

const usable = (hex) => { const rgb = hexToRgb(hex); const s = sat(rgb); const l = lum(rgb); return { s, l, ok: s >= 0.22 && l > 0.025 && l < 0.78 }; };

// candidates: { hex, src, weight }; the logo wins, then the site's own declaration, then the most used colour of the css, last the photo
export function choosePalette({ logoPalette = [], hints = {}, heroPalette = [] }) {
  const cands = [];
  for (const c of logoPalette) { const u = usable(c.hex); if (u.ok && c.share >= 0.05) cands.push({ hex: c.hex, src: 'logo', w: 100 + c.share * 100 * (0.5 + u.s) }); }
  if (hints.theme) { const u = usable(hints.theme); if (u.ok) cands.push({ hex: hints.theme, src: 'theme-color', w: 80 }); }
  for (const v of hints.vars || []) { const u = usable(v.hex); if (u.ok) cands.push({ hex: v.hex, src: `css:${v.name}`, w: /primary|brand|main/.test(v.name) ? 75 : 60 }); }
  for (const f of hints.freq || []) if (f.n >= 3) cands.push({ hex: f.hex, src: 'css', w: 35 + Math.min(15, f.n) });
  for (const c of heroPalette) { const u = usable(c.hex); if (u.ok && c.share >= 0.06 && u.s >= 0.3) cands.push({ hex: c.hex, src: 'photo', w: 45 + c.share * 50 }); }
  cands.sort((a, b) => b.w - a.w);
  // a dark or grey logo (black on white) is a real brand too: the darkest big cluster of the logo
  let primary = cands[0] || null;
  let greyBrand = false;
  if (!primary && logoPalette.length) {
    const d = logoPalette.filter((c) => c.share >= 0.15 && c.l < 0.5)[0];
    if (d) { primary = { hex: d.hex, src: 'logo-neutral', w: 30 }; greyBrand = true; }
  }
  if (!primary) return null;
  const rgb = hexToRgb(primary.hex);
  let [h, s, l] = rgbToHsl(rgb);
  if (!greyBrand) { s = Math.min(s, 0.85); l = Math.max(0.22, Math.min(0.62, l)); }
  let p = toHex(hslToRgb([h, s, l]));
  // text on primary: white or near-black, whichever reads; else move the primary
  const WHITE = '#ffffff'; const DARK = '#14161a';
  let pi = contrast(p, WHITE) >= contrast(p, DARK) ? WHITE : DARK;
  if (contrast(p, pi) < 4.5) { p = ensureContrast(p, pi, 4.5); }
  const second = cands.find((c) => c.hex !== primary.hex && hueDist(rgbToHsl(hexToRgb(c.hex))[0], h) >= 35 && usable(c.hex).ok && c.src !== 'photo' && c.w >= 60);
  const deep = toHex(hslToRgb([h, Math.min(0.55, s), 0.13]));
  const tint = toHex(hslToRgb([h, Math.min(0.5, s), 0.955]));
  const paper = '#ffffff';
  const text = ensureContrast(toHex(hslToRgb([h, Math.min(0.6, s), 0.34])), tint, 4.8); // brand colour used as TEXT on light backgrounds (the tint is the darkest of them)
  return {
    primary: p, pi, deep, tint, paper, ink: '#181a1f', text,
    second: second ? ensureContrast(second.hex, paper, 3) : null,
    source: primary.src, picked: primary.hex, grey: greyBrand,
    checks: { primaryOnPi: +contrast(p, pi).toFixed(2), textOnPaper: +contrast(text, paper).toFixed(2), deepOnWhite: +contrast(deep, '#ffffff').toFixed(2) },
  };
}
