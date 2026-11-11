// Menu: yalniz schema.org Menu/MenuItem verisinden ya da acikca "menu" olan bir sayfadaki "ad + fiyat" satirlarindan.
// Her kalem kaynak satirini tasir (src); uydurma yok. Kategori basliklari sayfadaki basliklardan gelir.
import { decode, htmlToLines, tidyPrice, priceValue, titleOf } from '../v2lib/scrape.mjs';

const CUR_SYM = '[$£€₺]';
const NUM = '(?:\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d{1,5}(?:[.,]\\d{1,2})?)';
const PRE = new RegExp(`(?:(?:US|AU|NZ|CA|C|A)\\s?)?${CUR_SYM}\\s?${NUM}(?:\\s?[-–—]\\s?(?:${CUR_SYM}\\s?)?${NUM})?(?![\\d])(?:\\s?\\+)?`, 'g');
const POST = new RegExp(`(?<![\\d.,$£€₺])${NUM}\\s?(?:TL|TRY|₺|€|EUR|£|GBP|\\$|USD)(?![A-Za-z0-9])`, 'g');
const BADNAME = /(shipping|free|gift|voucher|cart|checkout|subscribe|newsletter|©|copyright|%|\boff\b|discount|\bsale\b|promo|deposit|minimum|min\.|over [$£€]|kargo|ücretsiz|indirim|sepet|tax\b|vat\b|kdv|total|toplam|per month|\/mo\b|aylık|login|sign ?in|whatsapp|call us|tel\b|phone|@|http|www\.|\bsave\b|from only|cashback|points|\bgst\b|\bpst\b|\bhst\b|surcharge|public holiday|corkage|service charge|booking|reservation|rezervasyon)/i;
const BAD_START = /^(add|extra|ekstra|with|plus|\+|and|or|ve|ile|from|price|prices|fiyat|fiyatlar|including|includes|include|served|choice|per|pp|each|up to|upto|starting|starts|only|just|now|was|dahil|başlayan|baslayan|adet)\b/i;
export const MENU_WORD = /(^|[^a-z])(menu|menus|menü|menüler|food|drinks|cocktails|kokteyl|yemekler|içecekler|carta|speisekarte|dinner|lunch|brunch|breakfast|kahvaltı|wine|beverages?)([^a-z]|$)/i;
const clean = (s, max) => decode(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const types = (o) => [].concat(o && o['@type'] || []).map(String);
const CURS = { USD: '$', AUD: '$', CAD: '$', NZD: '$', EUR: '€', GBP: '£', TRY: '₺', TL: '₺' };

function tokens(line) {
  const out = [];
  for (const re of [PRE, POST]) { re.lastIndex = 0; let m; while ((m = re.exec(line))) out.push({ text: m[0], index: m.index, end: m.index + m[0].length }); }
  out.sort((a, b) => a.index - b.index);
  const kept = [];
  for (const t of out) if (!kept.length || t.index >= kept[kept.length - 1].end) kept.push(t);
  return kept;
}
const cleanName = (s) => s.replace(/[\s.…·•_\-–—:|=>→*]+$/g, '').replace(/\s+(?:from|starting at|starts at)$/i, '').replace(/^[\s.…·•_\-–—:|=>→*\d]+(?=[A-Za-zÇĞİÖŞÜçğıöşü])/, '').replace(/\s+/g, ' ').trim();
const looksName = (n) => n.length >= 3 && n.length <= 56 && /^\p{L}/u.test(n) && !/^\p{Ll}/u.test(n) && /\p{L}{3}/u.test(n) && (n.match(/\(/g) || []).length === (n.match(/\)/g) || []).length && !BADNAME.test(n) && !BAD_START.test(n) && !/[.!?]\s+\p{L}/u.test(n) && (n.match(/,/g) || []).length <= 1 && n.split(/\s+/).length <= 8;

// ---- schema.org ----
function priceOf(offers) {
  const o = Array.isArray(offers) ? offers[0] : offers;
  if (!o || typeof o !== 'object') return '';
  const p = o.price ?? o.lowPrice;
  if (p === undefined || p === null || p === '') return '';
  const n = String(p).trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(n)) return '';
  const cur = String(o.priceCurrency || '').toUpperCase();
  return CURS[cur] ? (cur === 'TRY' || cur === 'TL' ? `${n} ${CURS[cur]}` : `${CURS[cur]}${n}`) : n;
}
export function ldMenu(ld) {
  const out = []; const seen = new Set();
  const visit = (x, cat, depth = 0) => {
    if (!x || typeof x !== 'object' || depth > 9 || out.length >= 60) return;
    if (Array.isArray(x)) { x.forEach((y) => visit(y, cat, depth + 1)); return; }
    let c = cat;
    if (types(x).some((t) => /^MenuSection$/i.test(t)) && typeof x.name === 'string') c = clean(x.name, 40);
    if (types(x).some((t) => /^MenuItem$/i.test(t)) && typeof x.name === 'string') {
      const n = clean(x.name, 60);
      if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push({ n, d: clean(x.description, 160), p: priceOf(x.offers), cat: c || '', src: 'json-ld MenuItem' }); }
    }
    for (const k of ['hasMenu', 'hasMenuSection', 'hasMenuItem', 'menu', 'mainEntity', '@graph', 'itemListElement', 'item']) if (x[k] && typeof x[k] === 'object') visit(x[k], c, depth + 1);
  };
  ld.forEach((o) => visit(o, ''));
  return out;
}
export function ldMenuUrls(ld, base) {
  const out = [];
  for (const o of ld) for (const k of ['hasMenu', 'menu']) for (const x of [].concat(o && o[k] || [])) { const u = typeof x === 'string' ? x : x && x.url; if (u) { try { out.push(new URL(u, base).href); } catch { /* ignore */ } } }
  return out;
}

// ---- menu sayfasina giden baglantilar ----
export function menuLinks(links, base, sozcuk = MENU_WORD) {
  const host = new URL(base).host.replace(/^www\./, '');
  const out = []; const seen = new Set();
  for (const l of links) {
    let u; try { u = new URL(l.href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const text = clean(l.text, 80);
    const blob = `${decodeURIComponent(u.pathname)} ${text}`;
    const pdf = /\.pdf$/i.test(u.pathname);
    const same = u.host.replace(/^www\./, '') === host;
    if ((!same && !pdf) || u.pathname === '/' || seen.has(u.href)) continue;
    if (!sozcuk.test(blob) || /(cart|checkout|login|account|blog|news|gift|voucher|privacy|terms|cookie|career|job|catering|function|event)/i.test(blob)) continue;
    seen.add(u.href);
    out.push({ url: u.href, text, pdf, same });
  }
  return out.sort((a, b) => Number(a.pdf) - Number(b.pdf) || a.url.length - b.url.length).slice(0, 5);
}

// ---- sayfa metni ----
const HMARK = '§§H§§';
function marked(html) {
  return String(html || '').replace(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (m, n, inner) => `\n${HMARK}${inner.replace(/<[^>]+>/g, ' ')}\n`);
}
const isCaps = (s, loc = 'en') => s.length >= 3 && s.length <= 30 && s === s.toLocaleUpperCase(loc) && /\p{L}{3}/u.test(s) && !/\d/.test(s);
export function menuFromText(html, { max = 30, lang = 'en' } = {}) {
  const loc = lang === 'tr' ? 'tr' : 'en';
  const lines = htmlToLines(marked(html)).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const items = []; const seen = new Set();
  let cat = '';
  const isHead = (l) => l.startsWith(HMARK) || (isCaps(l, loc) && tokens(l).length === 0);
  for (let i = 0; i < lines.length && items.length < max; i++) {
    let line = lines[i];
    if (line.startsWith(HMARK)) { const h = clean(line.slice(HMARK.length), 40); if (h && h.length <= 40 && tokens(h).length === 0 && !/^(menu|menü|our menu|menus?)$/i.test(h)) cat = h; continue; }
    if (isCaps(line, loc) && tokens(line).length === 0) { cat = line.charAt(0) + line.slice(1).toLocaleLowerCase(loc); continue; }
    if (line.length > 180) continue;
    const t = tokens(line);
    let name = ''; let price = ''; let srcLine = line; let consumed = 0;
    if (t.length === 1) {
      const left = cleanName(line.slice(0, t[0].index)); const right = cleanName(line.slice(t[0].end));
      if (left && looksName(left)) { name = left; price = t[0].text; }
      else if (!left && right && looksName(right)) { name = right; price = t[0].text; }
      else if (!left && i > 0) {
        const prev = lines[i - 1];
        if (!prev.startsWith(HMARK) && tokens(prev).length === 0 && prev.length <= 50 && looksName(cleanName(prev))) { name = cleanName(prev); price = t[0].text; srcLine = `${prev}\n${line}`; }
      }
    } else if (t.length === 0) {
      // fiyatsiz para birimi: "Kingfish Crudo, Pink Pepper Oil (a) 36"
      const m = /^(\p{Lu}[^|]{2,110}?)\s+(\d{1,4}(?:[.,]\d{1,2})?)$/u.exec(line);
      if (m && !isHead(line) && !/\b(am|pm|hours|daily|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(m[1]) && !/[+:@]|https?:|www\./i.test(m[1])) {
        let body = m[1].trim().replace(/\s*\((?:[a-z]{1,3}(?:\s*,\s*[a-z]{1,3})*)\)\s*$/i, '').trim();
        const [n0, ...rest] = body.split(/,\s+/);
        if (looksName(n0.trim()) && Number(m[2].replace(',', '.')) >= 3) { name = n0.trim(); price = m[2]; if (rest.length) { items.push({ n: name, d: rest.join(', ').slice(0, 160), p: price, cat, src: `line: ${line}`.slice(0, 220) }); seen.add(name.toLowerCase()); continue; } }
      }
    }
    if (!name) continue;
    const v = priceValue(price);
    if (!(v >= 1 && v <= 99999) || seen.has(name.toLowerCase())) continue;
    // aciklama: sonraki satir fiyatsiz, baslik degil, isim gibi degil
    let desc = '';
    const nx = lines[i + 1];
    if (nx && !isHead(nx) && tokens(nx).length === 0 && nx.length >= 10 && nx.length <= 170 && !/^\p{Lu}[^.,]{2,40}$/u.test(nx) && !BADNAME.test(nx)) { desc = nx; consumed = 1; }
    seen.add(name.toLowerCase());
    items.push({ n: name, d: desc, p: tidyPrice(price), cat, src: `line: ${srcLine}`.slice(0, 220) });
    i += consumed;
  }
  return items;
}

export const pageIsMenu = (finalUrl, html, sozcuk = MENU_WORD) => {
  let p = ''; try { p = decodeURIComponent(new URL(finalUrl).pathname); } catch { /* ignore */ }
  return sozcuk.test(p) || sozcuk.test(titleOf(html)) || sozcuk.test(clean((/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1], 120));
};

// kategorileri sirayla grupla: [{name, items:[...]}]
export function groupMenu(items) {
  const groups = [];
  for (const it of items) {
    const name = it.cat || '';
    let g = groups.find((x) => x.name === name);
    if (!g) { g = { name, items: [] }; groups.push(g); }
    g.items.push(it);
  }
  return groups;
}
