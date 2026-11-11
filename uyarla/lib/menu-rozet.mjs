// Menu, "rozet" duzeni: fiyat ayri bir rozet/etiket ogesinde, ad bir baslikta.
//   A) <x class="...badge|price|fiyat...">NZD 26</x> <h3>AD</h3> [<em|p>aciklama]
//   B) <h4>AD</h4> <x class="...badge|price|fiyat...">NZD 8</x> [<em>aciklama]
// Kategori: kendisine fiyat rozeti eslik etmeyen en yakin onceki baslik.  Uydurma yok: her kalem kaynak parcasini tasir (src).
import { decode } from '../v2lib/scrape.mjs';

const clean = (s, max) => decode(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const BADGE = '<(?:div|span|p|strong|b)\\b[^>]*class="[^"]*(?:badge|price|fiyat|tutar)[^"]*"[^>]*>([^<]{1,24})</(?:div|span|p|strong|b)>';
const HEAD = (n) => `<h([2-5])\\b[^>]*>([\\s\\S]{1,160}?)</h\\${n}>`;
const TOK = () => new RegExp(`${BADGE}\\s*${HEAD(2)}|${HEAD(4)}\\s*${BADGE}|${HEAD(7)}`, 'gi');
const DESC = /^(?:\s*<\/li>)?\s*(?:<div\b[^>]*>\s*)?<(em|p)\b[^>]*>([\s\S]{4,400}?)<\/\1>/i;
const DIET = /\s*\((?:v|vg|gf|df|n)(?:\s*[,/]\s*(?:v|vg|gf|df|n))*\)\s*$/i;
const priceOf = (p) => { const m = /(\d{1,4}(?:[.,]\d{1,2})?)(?:\s*\/\s*\d{1,4}(?:[.,]\d{1,2})?)?/.exec(p || ''); return m ? m[0].replace(/\s+/g, '').replace(',', '.') : ''; };

export function menuFromBadges(html, { max = 80 } = {}) {
  const src = String(html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ');
  const tok = TOK(); const items = []; const seen = new Set(); let cat = ''; let m;
  while ((m = tok.exec(src)) && items.length < max) {
    let name; let price;
    if (m[1] !== undefined) { price = m[1]; name = m[3]; } else if (m[5] !== undefined) { name = m[5]; price = m[6]; } else {
      const h = clean(m[8], 60);
      if (h && h.length <= 40 && !/^(menu|menus|menü)$/i.test(h)) cat = h.replace(/\s+[-–—]\s.*$/, '').trim();
      continue;
    }
    name = clean(name, 70).replace(DIET, '').trim();
    const p = priceOf(clean(price, 24));
    if (!name || !p || !/\p{L}{3}/u.test(name) || seen.has(name.toLowerCase())) continue;
    let d = '';
    const dm = DESC.exec(src.slice(tok.lastIndex, tok.lastIndex + 700));
    if (dm) d = clean(dm[2], 300).replace(/\s*\/\s*Add\b.*$/i, '').replace(/\s+\d{1,3}$/, '').trim();
    seen.add(name.toLowerCase());
    items.push({ n: name, d: d.length > 150 ? `${d.slice(0, 147).replace(/[\s,;:]+\S*$/, '')}…` : d, p, cat, src: `rozet: ${clean(m[0], 120)}` });
  }
  return items;
}
