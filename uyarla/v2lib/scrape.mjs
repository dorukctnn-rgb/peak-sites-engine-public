// Pure helpers that read ONE business homepage (HTML text) for the v2 mockup: lines of visible text, prices, opening hours, phone, image candidates,
// logo candidates, colour hints. Nothing here touches the network. Every price and hour is returned with the source text it came from.
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", euro: '€', pound: '£', dollar: '$', ndash: '–', mdash: '—', hellip: '…', copy: '©', middot: '·', bull: '•', times: '×', lira: '₺', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
export function decode(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; } catch { return m; } }
    return ENT[e.toLowerCase()] ?? m;
  });
}

// visible text as lines: block tags and <br> break lines, table cells are joined with " | ", inline tags vanish (a space only between two spans)
export function htmlToLines(html) {
  let h = String(html || '');
  h = h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|select|option|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ');
  h = h.replace(/<\/(td|th)\s*>/gi, ' | ').replace(/<br\s*\/?>/gi, '\n');
  h = h.replace(/<\/?(p|div|li|tr|h[1-6]|section|article|header|footer|ul|ol|table|dl|dt|dd|blockquote|figure|figcaption|form|nav|aside|address|details|summary|main|tbody|thead|button|a)\b[^>]*>/gi, '\n');
  h = h.replace(/<\/span>\s*<span\b[^>]*>/gi, ' ').replace(/<[^>]+>/g, '');
  return decode(h).split('\n').map((l) => l.replace(/[ \t ​]+/g, ' ').replace(/^[\s|]+|[\s|]+$/g, '').trim()).filter(Boolean);
}

// ---- prices ------------------------------------------------------------------------------------------------
const CUR_SYM = '[$£€₺]';
const NUM = '(?:\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d{1,5}(?:[.,]\\d{1,2})?)';
const PRE = new RegExp(`(?:(?:US|AU|NZ|CA|C|A)\\s?)?${CUR_SYM}\\s?${NUM}(?:\\s?[-–—]\\s?(?:${CUR_SYM}\\s?)?${NUM})?(?![\\d])(?:\\s?\\+)?`, 'g');
const POST = new RegExp(`(?<![\\d.,$£€₺])${NUM}\\s?(?:TL|TRY|₺|€|EUR|£|GBP|\\$|USD)(?![A-Za-z0-9])`, 'g');
const BADNAME = /(shipping|free|gift|voucher|cart|checkout|subscribe|newsletter|©|copyright|%|\boff\b|discount|\bsale\b|promo|deposit|minimum|min\.|over [$£€]|kargo|ücretsiz|indirim|sepet|tax\b|vat\b|kdv|total|toplam|per month|\/mo\b|aylık|login|sign ?in|whatsapp|call us|tel\b|phone|@|http|www\.|\bsave\b|from only|cashback|points|\bgst\b|\bpst\b|\bhst\b)/i;
const PRICE_BAD_NAME_START = /^(add|extra|ekstra|with|plus|\+|and|or|ve|ile|from|price|prices|fiyat|fiyatlar|including|includes|include|served|choice|per|pp|each|up to|upto|starting|starts|only|just|now|was|dahil|başlayan|baslayan|adet)\b/i;

function priceTokens(line) {
  const out = [];
  for (const re of [PRE, POST]) { re.lastIndex = 0; let m; while ((m = re.exec(line))) out.push({ text: m[0], index: m.index, end: m.index + m[0].length }); }
  out.sort((a, b) => a.index - b.index);
  const kept = [];
  for (const t of out) if (!kept.length || t.index >= kept[kept.length - 1].end) kept.push(t);
  return kept;
}
export const tidyPrice = (s) => s.replace(/\s*\+$/, '').replace(/^((?:US|AU|NZ|CA|C|A)?\s?[$£€₺])\s+/, '$1').replace(/\s+/g, ' ').trim();
export function priceValue(p) {
  const d = (/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/.exec(p) || [])[1];
  if (!d) return NaN;
  const m = d.match(/[.,](\d{1,2})$/);
  const whole = m ? d.slice(0, d.length - m[0].length) : d;
  return Number(whole.replace(/[.,]/g, '')) + (m ? Number(`0.${m[1]}`) : 0);
}
const cleanName = (s) => s.replace(/[\s.…·•_\-–—:|=>→*]+$/g, '').replace(/^[\s.…·•_\-–—:|=>→*\d]+(?=[A-Za-zÇĞİÖŞÜçğıöşü])/, '').replace(/\s+/g, ' ').trim();
const UNIT = /^(adet|gram|gr|porsiyon|kg|kilo|lt|litre|piece|pieces|pcs|each|per|ad|g|ml|dakika|saat|seans|min|minutes|hour|hours)$/i;
const looksName = (n) => n.length >= 3 && /^\p{L}/u.test(n) && !UNIT.test(n.replace(/[^\p{L}]/gu, '')) && (n.match(/\(/g) || []).length === (n.match(/\)/g) || []).length &&!/^\p{Ll}/u.test(n) && n.length <= 46 && /\p{L}{3}/u.test(n) && !BADNAME.test(n) && !PRICE_BAD_NAME_START.test(n) && !/[.!?]\s+\p{L}/u.test(n) && (n.match(/,/g) || []).length <= 1 && n.split(/\s+/).length <= 7;

// -> [{ name, price, snippet }] in page order (max 8). snippet = the source line(s), exactly as read.
export function extractPrices(lines, { max = 8 } = {}) {
  const rows = [];
  const seen = new Set();
  const push = (name, price, snippet) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    const v = priceValue(price);
    if (!(v >= 1 && v <= 99999)) return;
    seen.add(key);
    rows.push({ name, price: tidyPrice(price), snippet });
  };
  for (let i = 0; i < lines.length && rows.length < max; i++) {
    const line = lines[i];
    if (line.length > 140) continue;
    const toks = priceTokens(line);
    if (toks.length !== 1) continue;
    const t = toks[0];
    const left = cleanName(line.slice(0, t.index));
    const right = cleanName(line.slice(t.end));
    if (left && looksName(left)) { push(left, t.text, line); continue; }
    if (!left && right && looksName(right)) { push(right, t.text, line); continue; }
    if (!left && (!right || !looksName(right)) && i > 0) {
      const prev = lines[i - 1];
      if (priceTokens(prev).length === 0 && prev.length <= 44) {
        const n = cleanName(prev);
        const rest = line.slice(t.end).trim();
        // "180,00 TL /Adet": the unit stays with the price, so "per piece" never turns into a bare number
        const unit = (/^\/\s?\p{L}[\p{L}\s.]{0,12}$/u.test(rest) || (UNIT.test(rest.replace(/[^\p{L}]/gu, '')) && rest.length <= 14)) ? rest : '';
        if (looksName(n)) push(n, unit ? `${t.text} ${unit}` : t.text, `${prev}\n${line}`);
      }
    }
  }
  return rows;
}

// ---- opening hours -----------------------------------------------------------------------------------------
const DAY = '(?:mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|pzt|pazartesi|sal[ıi]|çar(?:şamba)?|car(?:samba)?|per(?:şembe)?|cum(?:a|artesi)?|cmt|paz(?:ar)?|hafta ?i[cç]i|hafta ?sonu|her ?g[uü]n|daily|every ?day|weekdays?|weekends?)';
const TIME = '(?:[01]?\\d|2[0-3])(?:[:.][0-5]\\d)?\\s?(?:am|pm|a\\.m\\.|p\\.m\\.)?';
const RANGE = `${TIME}\\s?(?:-|–|—|to|ile|/)\\s?${TIME}`;
const HOURS_LINE = new RegExp(`\\b${DAY}\\b[^\\d\\n]{0,28}${RANGE}`, 'i');
const HOURS_ANY_TIME = /(?:[01]?\d|2[0-3])[:.][0-5]\d|\d\s?(?:am|pm)\b/i;
export function extractHours(lines, ld = []) {
  const out = [];
  const spec = [];
  for (const o of ld) {
    const oh = o && o.openingHours;
    for (const s of Array.isArray(oh) ? oh : oh ? [oh] : []) if (typeof s === 'string' && /\d/.test(s)) spec.push(s.trim());
    const ohs = o && o.openingHoursSpecification;
    for (const x of Array.isArray(ohs) ? ohs : ohs ? [ohs] : []) {
      if (x && x.opens && x.closes) {
        const days = (Array.isArray(x.dayOfWeek) ? x.dayOfWeek : [x.dayOfWeek]).filter(Boolean).map((d) => String(d).replace(/^.*\//, '').slice(0, 3));
        if (days.length) spec.push(`${days.length > 2 ? `${days[0]}-${days[days.length - 1]}` : days.join(', ')} ${String(x.opens).slice(0, 5)}-${String(x.closes).slice(0, 5)}`);
      }
    }
  }
  for (const s of spec) { if (out.length < 3 && HOURS_ANY_TIME.test(s)) out.push({ text: s.replace(/\s+/g, ' '), source: 'json-ld' }); }
  if (out.length) return out;
  for (const line of lines) {
    if (out.length >= 3) break;
    if (line.length > 80) continue;
    if (HOURS_LINE.test(line)) {
      const text = line.replace(/\s+/g, ' ').trim();
      if (!out.some((x) => x.text === text)) out.push({ text, source: 'page' });
    }
  }
  return out;
}

// ---- phone -------------------------------------------------------------------------------------------------
// Telefon gibi gorunen ama telefon olmayan diziler (sayfalama "9 10 11 12 13 14 15", yil listesi "2019 2020 2021") elenir.
export function telefonMu(t) {
  const s = String(t || '').trim(); const digits = (s.match(/\d/g) || []).length;
  if (digits < 7 || digits > 15) return false;
  const gr = s.replace(/[^\d]+/g, ' ').trim().split(' ').filter(Boolean);
  if (gr.length >= 4 && gr.filter((g) => g.length <= 2).length >= gr.length - 1) return false;
  if (gr.length >= 2 && gr.every((g) => /^(19|20)\d\d$/.test(g))) return false;
  if (new Set(s.replace(/[^\d]/g, '')).size <= 2) return false;
  return true;
}
export function extractPhone(html, ld = []) {
  for (const m of String(html).matchAll(/href=["']tel:([^"']+)["']/gi)) {
    let raw = m[1];
    try { raw = decodeURIComponent(raw); } catch { /* keep raw */ }
    const t = decode(raw).replace(/[^\d+()\s.-]/g, '').trim();
    if (telefonMu(t)) return t;
  }
  for (const o of ld) if (o && typeof o.telephone === 'string' && telefonMu(o.telephone)) return o.telephone.trim();
  return null;
}

// ---- json-ld and meta --------------------------------------------------------------------------------------
export function jsonLd(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].replace(/^\s*<!--|-->\s*$/g, '').trim());
      const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { out.push(x); if (x['@graph']) walk(x['@graph']); } };
      walk(j);
    } catch { /* a broken block is ignored */ }
  }
  return out;
}
export function metaContent(html, key) {
  const re = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${key.replace(/[.:]/g, '\\$&')}["'][^>]*>`, 'i');
  const tag = (re.exec(html) || [])[0];
  if (!tag) return null;
  const c = /content=["']([^"']*)["']/i.exec(tag);
  return c ? decode(c[1]).trim() : null;
}
export function titleOf(html) { const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html); return m ? decode(m[1]).replace(/\s+/g, ' ').trim() : ''; }

// ---- images ------------------------------------------------------------------------------------------------
const abs = (u, base) => { try { const x = new URL(decode(String(u).trim()), base); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
const NOT_PHOTO = /(sprite|icon|favicon|avatar|placeholder|blank\.|loader|spinner|pixel|1x1|badge|payment|visa|mastercard|paypal|tripadvisor|google-?maps?|staticmap|maps\.googleapis|openstreetmap|mapbox|\bmap[-_.]|flag|arrow|chevron|stars?[-_.]|rating|facebook|instagram|twitter|tiktok|youtube|whatsapp|linkedin|pinterest|qr[-_.]?code|captcha|emoji|bullet|divider|separator|shadow|overlay|pattern|texture|gradient|cursor|close|menu-?icon|hamburger|search[-_]|cookie|gdpr|trustpilot|award|certif|seal|ssl|secure|booking\.com|expedia|opentable|ubereats|doordash|deliveroo|yemeksepeti|getir|trendyol|logo)/i;
const STOCK = /(shutterstock|istockphoto|istock|gettyimages|getty-?images|depositphotos|adobestock|dreamstime|alamy|123rf|bigstock|stock[-_]?photo|stockphoto|watermark|envato|unsplash-preview|canva\.com|freepik|vecteezy|pngtree|pikbest|\bcomp[-_]\d)/i;
const HOST_BAD = /(maps\.googleapis|maps\.gstatic|google\.com|mapbox|openstreetmap|tripadvisor|booking\.com|expedia|opentable|ubereats|doordash|deliveroo|trustpilot|facebook|fbcdn|instagram|cdninstagram|twitter|twimg|gravatar|googletagmanager|doubleclick|youtube|ytimg|yelp)/i;
export const isPhotoUrl = (u) => {
  const rest = String(u).replace(/^https?:\/\/[^/]+/, '');
  if (NOT_PHOTO.test(rest) || STOCK.test(u) || HOST_BAD.test(u.replace(/^https?:\/\/([^/]+).*$/, '$1'))) return false;
  if (/\.svg(\?|#|$)/i.test(rest) || /\.gif(\?|#|$)/i.test(rest) || /\.ico(\?|#|$)/i.test(rest)) return false;
  return true;
};
const bestOfSrcset = (ss) => {
  const parts = String(ss).split(',').map((p) => p.trim()).filter(Boolean).map((p) => { const [u, d] = p.split(/\s+/); const w = /(\d+)w/.exec(d || '')?.[1] || /(\d+(?:\.\d+)?)x/.exec(d || '')?.[1]; return { u, w: Number(w) || 0 }; });
  parts.sort((a, b) => b.w - a.w);
  return parts[0] || null;
};
// -> [{ url, via, w?, h?, alt?, cls?, at? }]: head sources first (og, twitter, json-ld), then <img> / <source> / background urls in document order
export function imageCandidates(html, base) {
  const out = [];
  const seen = new Set();
  const add = (u, via, extra = {}) => {
    const url = abs(u, base);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ url, via, ...extra });
  };
  for (const k of ['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']) { const v = metaContent(html, k); if (v) add(v, k.startsWith('og') ? 'og' : 'twitter'); }
  const il = /<link\b[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i.exec(html);
  if (il) add(il[1], 'og');
  for (const o of jsonLd(html)) {
    const im = o && o.image;
    for (const x of Array.isArray(im) ? im : im ? [im] : []) add(typeof x === 'string' ? x : x && (x.url || x.contentUrl), 'ld');
  }
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const pos = (idx) => idx / Math.max(1, body.length);
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (n) => { const r = new RegExp(`\\s${n}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag); return r ? decode(r[1] ?? r[2]) : null; };
    const ss = attr('srcset') || attr('data-srcset') || attr('data-lazy-srcset');
    let src = attr('data-src') || attr('data-lazy-src') || attr('data-original') || attr('data-lazy') || attr('src');
    if (src && /^data:/i.test(src)) src = attr('data-src') || attr('data-lazy-src') || null;
    let w = Number(attr('width')) || 0;
    const h = Number(attr('height')) || 0;
    const best = ss ? bestOfSrcset(ss) : null;
    if (best && best.u) { src = best.u; if (best.w) w = Math.max(w, best.w); }
    if (!src) continue;
    add(src, 'img', { w, h, alt: attr('alt') || '', cls: `${attr('class') || ''} ${attr('id') || ''}`.trim(), at: pos(m.index) });
  }
  for (const m of body.matchAll(/<source\b[^>]*srcset=["']([^"']+)["']/gi)) { const b = bestOfSrcset(m[1]); if (b) add(b.u, 'source', { w: b.w, at: pos(m.index) }); }
  for (const m of body.matchAll(/(?:background(?:-image)?\s*:[^;"']*?url\(\s*["']?|data-(?:bg|background|bg-image)=["'])([^"')\s]+)/gi)) add(m[1], 'bg', { at: pos(m.index) });
  return out;
}

// logo candidates: <img> in the first part of the page with "logo" in its name, JSON-LD logo, og:logo, apple-touch-icon
export function logoCandidates(html, base) {
  const out = [];
  const seen = new Set();
  const add = (u, via, extra = {}) => { const url = abs(u, base); if (!url || seen.has(url)) return; seen.add(url); out.push({ url, via, ...extra }); };
  for (const o of jsonLd(html)) { const l = o && o.logo; if (l) add(typeof l === 'string' ? l : l.url || l.contentUrl, 'ld'); }
  const lg = metaContent(html, 'og:logo'); if (lg) add(lg, 'og');
  const head = html.slice(0, Math.min(html.length, 90000)).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  for (const m of head.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (n) => { const r = new RegExp(`\\s${n}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag); return r ? decode(r[1] ?? r[2]) : null; };
    const ss = attr('srcset');
    let src = attr('data-src') || attr('data-lazy-src') || attr('src');
    const best = ss ? bestOfSrcset(ss) : null;
    if (best && best.u && (!src || /^data:/i.test(src))) src = best.u;
    if (!src || /^data:/i.test(src)) continue;
    const blob = `${src} ${attr('alt') || ''} ${attr('class') || ''} ${attr('id') || ''}`;
    if (/logo|brand|wordmark|site-?title/i.test(blob) && !/facebook|instagram|twitter|payment|visa|trip|google|partner|sponsor|award|accolade|rosette|certificate|recommended|footer-?logo|badge|(^|[^a-z])(wix|squarespace|godaddy|weebly|shopify|wordpress|webflow|jimdo)([^a-z]|$)|powered|made-?with|platform/i.test(blob)) add(src, 'img');
  }
  for (const m of html.matchAll(/<link\b[^>]*rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/gi)) add(m[1], 'icon');
  return out;
}

// ---- colours -----------------------------------------------------------------------------------------------
export function hexToRgb(h) { const x = h.replace('#', ''); const f = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.slice(0, 6); return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]; }
export const sat = ([r, g, b]) => { const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
export const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
// colours that ship with WordPress, Gutenberg, Astra, Elementor, Divi and the like: they say nothing about the business
const THEME_DEFAULTS = new Set(['#cf2e2e', '#ff6900', '#fcb900', '#f78da7', '#00d084', '#8ed1fc', '#0693e3', '#9b51e0', '#abb8c3', '#7bdcb5', '#313131', '#32373c', '#0274be', '#21759b', '#1e73be', '#2ea3f2', '#0073aa', '#0085ba', '#00a0d2', '#6ec1e4', '#61ce70', '#4054b2', '#23a455', '#a4afb7', '#54595f', '#7a7a7a', '#0bb5ff', '#1d9ff5', '#2271b1', '#135e96', '#3858e9', '#007cba']);
const norm6 = (h) => { let x = String(h).trim().toLowerCase(); if (/^#[0-9a-f]{3}$/.test(x)) x = `#${x[1]}${x[1]}${x[2]}${x[2]}${x[3]}${x[3]}`; return /^#[0-9a-f]{6}/.test(x) ? x.slice(0, 7) : null; };
// theme-color meta, css custom properties with brand-like names, the most used saturated hex colours
export function colourHints(html, cssTexts = []) {
  const hints = { theme: null, vars: [], freq: [] };
  const tc = metaContent(html, 'theme-color') || metaContent(html, 'msapplication-TileColor');
  if (tc && !THEME_DEFAULTS.has(norm6(tc))) hints.theme = norm6(tc);
  const all = `${html.match(/<style[\s\S]*?<\/style>/gi)?.join('\n') || ''}\n${cssTexts.join('\n')}`;
  for (const m of all.matchAll(/--([a-z0-9-]*?(?:primary|brand|accent|main|theme|color-1|colour|highlight|secondary)[a-z0-9-]*)\s*:\s*(#[0-9a-f]{3,8})\b/gi)) { const h = norm6(m[2]); if (h && !THEME_DEFAULTS.has(h)) hints.vars.push({ name: m[1].toLowerCase(), hex: h }); }
  const count = new Map();
  for (const m of all.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) { const h = norm6(`#${m[1]}`); if (h) count.set(h, (count.get(h) || 0) + 1); }
  hints.freq = [...count.entries()].filter(([h]) => !THEME_DEFAULTS.has(h)).filter(([h]) => { const c = hexToRgb(h); return sat(c) > 0.28 && lum(c) > 0.02 && lum(c) < 0.8; }).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([hex, n]) => ({ hex, n }));
  return hints;
}

// ---- links worth one more request --------------------------------------------------------------------------
const SUB = /(price|pricing|rates?|tarif|fiyat|menu|menü|service|hizmet|rooms?|odalar?|accommodation|packages?|membership|uyelik|üyelik|treatment|tours?|turlar)/i;
export function subpageLinks(html, base, max = 2) {
  const out = [];
  const seen = new Set();
  const origin = (() => { try { return new URL(base).host.replace(/^www\./, ''); } catch { return ''; } })();
  const rank = (s) => (/(price|pricing|rates?|tarif|fiyat)/i.test(s) ? 0 : /(menu|menü)/i.test(s) ? 1 : /(service|hizmet|treatment)/i.test(s) ? 2 : /(rooms?|odalar?|accommodation)/i.test(s) ? 3 : 4);
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const u = abs(m[1], base);
    if (!u) continue;
    let x; try { x = new URL(u); } catch { continue; }
    if (x.host.replace(/^www\./, '') !== origin || seen.has(x.pathname) || x.pathname === '/' || /\.(pdf|jpe?g|png|zip|docx?)$/i.test(x.pathname)) continue;
    const text = decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const blob = `${x.pathname} ${text}`;
    if (!SUB.test(blob) || /(cart|checkout|account|login|blog|news|gift|privacy|terms|cookie|policy)/i.test(blob)) continue;
    seen.add(x.pathname);
    out.push({ url: x.href, text, r: rank(blob) });
  }
  out.sort((a, b) => a.r - b.r);
  return out.slice(0, max);
}

// stylesheets of the page worth reading for colour variables (not frameworks, not font services)
export function stylesheets(html, base, max = 2) {
  const out = [];
  for (const m of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
    const h = /href=["']([^"']+)["']/i.exec(m[0]);
    if (!h) continue;
    const u = abs(h[1], base);
    if (u && !/fonts\.googleapis|font-awesome|fontawesome|bootstrap|animate|swiper|slick|owl|lightbox|fancybox|jquery|elementor\/assets\/lib|wp-includes|dashicons/i.test(u)) out.push(u);
  }
  return out.slice(0, max);
}
