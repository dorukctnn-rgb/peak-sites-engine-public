// 2. ADIM (font): isletmenin sitesindeki fontlardan, ucretsiz (acik lisansli) en uygun esi secer. Dil modeli yok; kural tabanli.
import { ORTAK } from './yol.mjs';
//  1) Ayni font Google Fonts / fontsource'ta varsa AYNISI.
//  2) Ticari ya da sistem fontuysa data/font-esleme.json tablosundaki ucretsiz es.
//  3) Bilinmeyen adsa: ad ve calisan stilden (serif/slab/geo/hum/neo/cond/script/mono) sinif cikar, katalogdan o sinifin favorisi (slug'a gore deterministik, ilk 3 icinden).
// Ticari font dosyasi ASLA kopyalanmaz: yalniz fontsource'taki acik lisansli dosyalar indirilir (onbellek: data/font-onbellek).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', 'data');
export const KATALOG = JSON.parse(fs.readFileSync(path.join(DATA, 'font-katalog.json'), 'utf8'));
const ALIAS = JSON.parse(fs.readFileSync(path.join(DATA, 'font-esleme.json'), 'utf8'));
const BULUNAN_F = path.join(DATA, 'font-bulunan.json'); // dinamik fontsource sorgularinin onbellegi: id -> meta | null
export const ONBELLEK = process.env.UYARLA_FONT_ONBELLEK || path.join(DATA, 'font-onbellek');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'inherit', 'initial', 'unset', 'emoji', 'math', 'fangsong', '-apple-system', 'blinkmacsystemfont']);
const ICON = /(icon|awesome|glyph|dashicons|material|ionicons|linea|elegant|eicons|swiper|fontello|themify|symbols?|wingdings|webdings|flaticon|stroke|lineicons|pe-icon|simple-line|bootstrap|boxicons|remix|feather)/i;
const squash = (s) => String(s).toLowerCase().replace(/["']/g, '').replace(/[^a-z0-9çğıöşüâêîôû]/g, '');
const idOf = (s) => String(s).toLowerCase().replace(/["']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const STRIP = /(variable|vf|regular|book|medium|semibold|bold|light|thin|black|heavy|italic|oblique|roman|normal|web|webfont|pro|std|ltd|lt|mt|ps|itc|cf|new|nova|soft|rounded|text|display|headline|narrow|condensed|extended)$/;

// bilinen bicim: "overpass-variable" (Typekit adi) -> overpass
export function adAday(raw) {
  const full = idOf(raw);
  const out = [full];
  let s = squash(raw);
  const toks = full.split('-');
  while (toks.length > 1 && STRIP.test(toks[toks.length - 1])) { toks.pop(); out.push(toks.join('-')); }
  out.push(...out.map((x) => x.replace(/-/g, '')));
  return { full, squash: s, ids: [...new Set(out)], squashList: [...new Set(out.map((x) => x.replace(/-/g, '')).concat(s))] };
}

let _bulunan = null;
function bulunanOku() { if (!_bulunan) { try { _bulunan = JSON.parse(fs.readFileSync(BULUNAN_F, 'utf8')); } catch { _bulunan = {}; } } return _bulunan; }
async function fontsourceMeta(id, { offline = false } = {}) {
  const c = bulunanOku();
  if (id in c) return c[id];
  if (offline) return null;
  let j = null;
  for (let t = 0; t < 3 && !j; t++) {
    try { const r = await fetch(`https://api.fontsource.org/v1/fonts/${id}`, { signal: AbortSignal.timeout(15000) }); if (r.status === 404) break; if (r.ok) j = await r.json(); else await sleep(1200 * (t + 1)); } catch { await sleep(1200); }
  }
  await sleep(300);
  const ok = j && /^(OFL|Apache|Ubuntu|MIT)/i.test(j.license || '');
  c[id] = ok ? { family: j.family, category: j.category, license: j.license, weights: j.weights, styles: j.styles, subsets: j.subsets.filter((s) => /^latin(-ext)?$/.test(s)), turkce: j.subsets.includes('latin-ext'), variable: !!j.variable } : null;
  try { fs.writeFileSync(BULUNAN_F, JSON.stringify(c, null, 1)); } catch { /* yoksay */ }
  return c[id];
}
const catToCls = (cat) => ({ serif: 'serif-trans', 'sans-serif': 'neo', display: 'geo', handwriting: 'script', monospace: 'mono' }[cat] || 'neo');

// ad -> { id, via, spec } | null     (spec: katalog benzeri kayit)
export async function adCoz(raw, { offline = false } = {}) {
  if (!raw || GENERIC.has(String(raw).toLowerCase()) || ICON.test(raw)) return null;
  const a = adAday(raw);
  for (const id of a.ids) if (KATALOG[id]) return { id, via: 'ayni', orig: raw, spec: KATALOG[id] };
  // Google Fonts / fontsource'ta (acik lisans) AYNI aile varsa her zaman AYNISI: tablodaki 'daha guzel' bir ese gidilmez
  const cand = a.ids.filter((x) => x.includes('-') || x.length >= 4).slice(0, 2);
  for (const id of cand) {
    const m = await fontsourceMeta(id, { offline });
    if (m) return { id, via: 'ayni', orig: raw, spec: { family: m.family, cls: catToCls(m.category), mood: 'sade', w: 0.54, xh: 'm', role: 'dt', category: m.category, license: m.license, weights: m.weights, styles: m.styles, subsets: m.subsets, turkce: m.turkce, variable: m.variable, dinamik: true } };
  }
  // ticari / sistem fontu: dosya kopyalanmaz, tablodaki en yakin ucretsiz es
  for (const k of a.squashList) if (ALIAS[k]) { const id = ALIAS[k]; if (KATALOG[id]) return { id, via: 'esdeger', orig: raw, spec: KATALOG[id] }; }
  return null;
}

// ad ve calisan stilden sinif (bilinmeyen ticari font icin)
export function adSinifi(name, ctx = {}) {
  const n = String(name || '').toLowerCase();
  if (/script|brush|signature|calligraph|handwrit|cursive|hand\b|marker|chalk/.test(n)) return 'script';
  if (/mono|code|courier|typewriter/.test(n)) return 'mono';
  if (/slab|rockwell|clarendon|egyptienne|memphis|serifa|stymie/.test(n)) return 'slab';
  if (/condensed|narrow|compress|cond\b|gothic.*(cond|narrow)|impact|bebas|oswald|knockout|league gothic|antonio|anton\b/.test(n)) return 'cond';
  if (/didot|bodoni|playfair|modern serif|ambroise|high.?contrast/.test(n)) return 'serif-didone';
  if (/garamond|caslon|bembo|sabon|jenson|goudy|janson|minion|plantin|cormorant|old.?style/.test(n)) return 'serif-old';
  if (/baskerville|georgia|times|palatino|charter|cambria|caladea|lora|merriweather|transitional/.test(n)) return 'serif-trans';
  if (/serif/.test(n) && !/sans/.test(n)) return 'serif-trans';
  if (/round|rounded|nunito|comfortaa|varela|quicksand/.test(n)) return 'round';
  if (/futura|avenir|gotham|montserrat|proxima|brandon|circular|geometric|sofia|poppins|spartan|raleway|jost|outfit|nexa|gilroy|avant/.test(n)) return 'geo';
  if (/helvetica|arial|univers|grotesk|grotesque|akzidenz|haas|swiss|roboto|inter\b|neue|aktiv|graphik|suisse/.test(n)) return 'neo';
  if (/gill|frutiger|myriad|lato|open sans|segoe|calibri|verdana|tahoma|humanist|optima|fira|source sans|cabin|museo/.test(n)) return 'hum';
  if (ctx.generics && ctx.generics.has('cursive')) return 'script';
  if (ctx.generics && ctx.generics.has('monospace')) return 'mono';
  if (ctx.generics && ctx.generics.has('serif') && !ctx.generics.has('sans-serif')) return 'serif-trans';
  return null;
}

const FAVORI = {
  'serif-old': ['cormorant-garamond', 'eb-garamond', 'libre-caslon-text', 'crimson-pro'], 'serif-trans': ['libre-baskerville', 'lora', 'spectral', 'gelasio'], 'serif-didone': ['playfair-display', 'bodoni-moda', 'dm-serif-display', 'noto-serif-display'],
  'serif-soft': ['fraunces', 'young-serif'], slab: ['zilla-slab', 'bitter', 'roboto-slab'], geo: ['jost', 'outfit', 'montserrat', 'urbanist', 'dm-sans'], hum: ['nunito-sans', 'lato', 'cabin', 'source-sans-3'],
  neo: ['inter', 'albert-sans', 'onest', 'work-sans'], round: ['nunito', 'quicksand', 'rubik'], cond: ['barlow-condensed', 'oswald', 'bebas-neue', 'archivo-narrow'], wide: ['sora', 'syne'],
  script: ['dancing-script', 'yellowtail', 'lobster'], mono: ['dm-mono', 'ibm-plex-mono', 'space-mono'], caps: ['cinzel', 'marcellus'],
};
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); };
export function sinifFavorisi(cls, { rol = 'd', tr = false, slug = '' } = {}) {
  const list = (FAVORI[cls] || FAVORI.geo).filter((id) => KATALOG[id] && KATALOG[id].role.includes(rol) && (!tr || KATALOG[id].turkce));
  const pool = list.length ? list : (FAVORI.geo).filter((id) => KATALOG[id]);
  return pool[hash(`${slug}:${rol}`) % Math.min(3, pool.length)];
}

const nearest = (have, want) => have.reduce((b, w) => (Math.abs(w - want) < Math.abs(b - want) ? w : b), have[0]);
export const wNum = (w) => { const n = Number(w); return Number.isFinite(n) && n > 0 ? n : /bold/.test(String(w)) ? 700 : 400; };

// basliklar ve metin icin tek tek coz.  stacks: R.fonts.stacks; S: heading ozeti (R.fonts.heading)
async function stackCoz(list, opts) {
  const generics = new Set((list || []).map((x) => String(x).toLowerCase()).filter((x) => GENERIC.has(x)));
  const names = (list || []).filter((x) => !GENERIC.has(String(x).toLowerCase()) && !ICON.test(x));
  for (const nm of names) { const r = await adCoz(nm, opts); if (r) return { ...r, generics }; }
  return { id: null, generics, unknown: names[0] || null };
}

// -> { display:{id,family,cls,weight,italic,via,orig}, text:{...}, accent?, notes[] }
export async function fontEslestir(R, { slug = '', tr = false, offline = false } = {}) {
  const st = (R.fonts && R.fonts.stacks) || {}; const hd = (R.fonts && R.fonts.heading) || {};
  const notes = [];
  const googleFirst = [...new Set(((R.fonts && R.fonts.googleFamilies) || []).flatMap((x) => String(x).split('|')).map((x) => x.split(':')[0].replace(/\+/g, ' ').trim()).filter(Boolean))];
  // GORUNEN font: yigindaki ilk aile gercekte yuklenmediyse (ornegin Montserrat bildirilmis ama yuklenmemis, ekranda Helvetica/Arial gorunuyor) yigin gorunen aileden baslar
  const sh = (R.fonts && R.fonts.shown) || {};
  // Istisna (10 Kas): bildirilen ilk aile ACIK LISANSLI ve bulunabiliyorsa (ornegin Muli/Montserrat) isletmenin secimi odur; sitesinde yuklenmiyor olsa bile o kullanilir ve not dusulur.
  const eff = async (list, key) => {
    const l = list || []; const s0 = sh[key]; if (!s0) return l;
    const i = l.findIndex((x) => String(x).toLowerCase() === String(s0).toLowerCase()); if (i <= 0) return l;
    const first = await adCoz(l[0], { offline });
    if (first) { const n = `${l[0]} sitede bildirilmiş ama yüklenmiyor (ekranda ${s0} görünüyor); taslakta bildirilen aile yüklendi`; if (!notes.includes(n)) notes.push(n); return l; }
    return l.slice(i);
  };
  const headList = [].concat(await eff(st.h1, 'h1'), await eff(st.h2, 'h2'), await eff(st.h3, 'h3'), await eff(st.logo, 'logo'));
  const textList = [].concat(await eff(st.p, 'p'), await eff(st.body, 'body'));
  let hd0 = await stackCoz(headList, { offline });
  let tx0 = await stackCoz(textList, { offline });
  // baslik yigini bos: dugme / menu yazisi, sonra sitenin yukledigi baska bir Google ailesi
  if (!hd0.id) { const r = await stackCoz([].concat(st.btn || [], st.nav || []), { offline }); if (r.id && r.id !== tx0.id) hd0 = r; }
  if (!hd0.id) for (const g of googleFirst) { const r = await adCoz(g, { offline }); if (r && r.id !== tx0.id) { hd0 = { ...r, generics: hd0.generics }; break; } }
  const upper = hd.transform === 'uppercase';
  const ls = parseFloat(hd.spacing) || 0;

  const pick = async (r, rol, ctx) => {
    if (r.id) return { id: r.id, spec: r.spec, via: r.via, orig: r.orig };
    let cls = adSinifi(r.unknown, { generics: r.generics });
    if (!cls) cls = rol === 'd' ? (upper && ls > 1 ? 'geo' : ctx.textCls === 'serif' ? 'serif-trans' : 'geo') : 'neo';
    const id = sinifFavorisi(cls, { rol, tr, slug });
    return { id, spec: KATALOG[id], via: 'sinif', orig: r.unknown || '(belirsiz)', cls };
  };
  let disp = await pick(hd0, 'd', {});
  let text = await pick(tx0, 't', {});
  // metin fontu baslik-yalniz bir font cikmasin (cond, script, caps, wide-display)
  if (!text.spec.role.includes('t') || ['cond', 'script', 'caps'].includes(text.spec.cls)) {
    const alt = sinifFavorisi(disp.spec.cls.startsWith('serif') || disp.spec.cls === 'caps' ? 'hum' : disp.spec.cls === 'script' ? 'hum' : 'neo', { rol: 't', tr, slug });
    notes.push(`metin fontu ${text.id} yalniz baslik icin uygun; metin ${alt} oldu`);
    text = { id: alt, spec: KATALOG[alt], via: 'sinif', orig: text.orig, cls: KATALOG[alt].cls };
  }
  // Turkce sayfa: latin-ext yoksa en yakin sinif favorisine kay
  for (const [k, o, rol] of [['display', disp, 'd'], ['text', text, 't']]) {
    if (tr && !o.spec.turkce) {
      const alt = sinifFavorisi(o.spec.cls, { rol, tr: true, slug });
      notes.push(`${o.id}: latin-ext (Turkce karakter) yok, ${alt} secildi`);
      const n = { id: alt, spec: KATALOG[alt], via: o.via === 'ayni' ? 'esdeger' : o.via, orig: o.orig, cls: o.spec.cls };
      if (k === 'display') disp = n; else text = n;
    }
  }
  // agirlik / italik
  const wantW = wNum(hd.weight);
  const dw = disp.spec.weights || [400, 700];
  let dWeight = nearest(dw, wantW);
  if (disp.spec.cls.startsWith('serif') || disp.spec.cls === 'caps' || disp.spec.cls === 'script') dWeight = nearest(dw, Math.min(wantW, 500));
  if (disp.spec.cls === 'script' || ['bebas-neue', 'anton', 'league-gothic', 'abril-fatface', 'dm-serif-display', 'gloock', 'young-serif', 'lobster', 'pacifico'].includes(disp.id)) dWeight = dw.includes(400) ? 400 : dw[0];
  const italic = hd.style === 'italic' && (disp.spec.styles || []).includes('italic');
  const tw = text.spec.weights || [400, 700];
  const tRegular = nearest(tw, 400); const tStrong = nearest(tw, 600);
  const out = {
    display: { id: disp.id, family: disp.spec.family, cls: disp.spec.cls, w: disp.spec.w, weight: dWeight, italic, via: disp.via, orig: disp.orig, mood: disp.spec.mood, license: disp.spec.license, styles: disp.spec.styles, subsets: disp.spec.subsets, upper, ls },
    text: { id: text.id, family: text.spec.family, cls: text.spec.cls, weight: tRegular, strong: tStrong, via: text.via, orig: text.orig, license: text.spec.license, styles: text.spec.styles, subsets: text.spec.subsets },
    notes,
  };
  return out;
}

// ---- dosyalar (fontsource, acik lisans) ----
const CDN = (id, subset, weight, style) => `https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/${subset}-${weight}-${style}.woff2`;
export const dosyaAdi = (id, subset, weight, style) => `${id}-${subset}-${weight}${style === 'italic' ? 'i' : ''}.woff2`;
async function indir(id, subset, weight, style) {
  const f = path.join(ONBELLEK, dosyaAdi(id, subset, weight, style));
  if (fs.existsSync(f)) return f;
  fs.mkdirSync(ONBELLEK, { recursive: true });
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(CDN(id, subset, weight, style), { signal: AbortSignal.timeout(20000) });
      if (r.status === 404) return null;
      if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.length > 1500) { fs.writeFileSync(f, b); await sleep(250); return f; } }
    } catch { /* tekrar dene */ }
    await sleep(1000 * (t + 1));
  }
  return null;
}
// gerekli dosyalar: [{ id, family, subset, weight, style, file(onbellek yolu) }]
export async function fontDosyalari(fe) {
  const need = [];
  const add = (o, weights, styles) => { for (const w of weights) for (const s of styles) for (const sub of (o.subsets && o.subsets.length ? o.subsets : ['latin', 'latin-ext'])) need.push({ id: o.id, family: o.family, subset: sub, weight: w, style: s }); };
  add(fe.display, [fe.display.weight], [fe.display.italic ? 'italic' : 'normal']);
  add(fe.text, [...new Set([fe.text.weight, fe.text.strong])], ['normal']);
  const out = [];
  for (const n of need) { const f = await indir(n.id, n.subset, n.weight, n.style); if (f) out.push({ ...n, file: f }); }
  return out;
}

const RANGE = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
};
// @font-face metni; url(prefix + dosya adi)
export function fontFaceCss(files, prefix = `../${ORTAK}/fonts/`) {
  return files.map((f) => `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:swap;src:url(${prefix}${dosyaAdi(f.id, f.subset, f.weight, f.style)}) format("woff2");unicode-range:${RANGE[f.subset] || RANGE.latin}}`).join('\n');
}
export const FALLBACK = { 'serif-old': 'Georgia, "Times New Roman", serif', 'serif-trans': 'Georgia, "Times New Roman", serif', 'serif-didone': 'Georgia, "Times New Roman", serif', 'serif-soft': 'Georgia, serif', caps: 'Georgia, serif', slab: 'Rockwell, "Courier New", serif', geo: 'system-ui, -apple-system, "Segoe UI", sans-serif', hum: 'system-ui, -apple-system, "Segoe UI", sans-serif', neo: 'system-ui, -apple-system, "Segoe UI", sans-serif', round: 'system-ui, "Segoe UI", sans-serif', cond: 'Impact, "Arial Narrow", sans-serif', wide: 'system-ui, sans-serif', script: 'cursive', mono: 'ui-monospace, Consolas, monospace' };
