// Lead listesi: yalniz restoran / bar / kafe satirlari ve yalniz bu isin ihtiyaci olan sutunlar.
// E-posta sutununa dokunulmaz (okunmaz, yazilmaz, hicbir ciktiya girmez).
import fs from 'node:fs';
import path from 'node:path';

export const LEADS_DIR = process.env.WEB_LEADS_OUT || '';
const KEEP = ['id', 'segment', 'region', 'lang', 'name', 'type', 'city', 'area', 'phone', 'website', 'rating', 'review_count'];

export function parseCsv(t) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const ascii = (s) => String(s).toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const slugOf = (name) => ascii(name).slice(0, 40) || 'isletme';

export function kindOf(type) {
  const t = String(type || '').toLowerCase();
  if (/^bar\/pub/.test(t) || /\b(bar|pub|cocktail|lounge|brewery|nightclub|meyhane)\b/.test(t.replace(/restaurant|restoran/g, ''))) return 'bar';
  if (/cafe|café|kahve|coffee|espresso|bubble tea|donut|bakery|dessert|ice cream|pastane/.test(t)) return 'cafe';
  return 'restaurant';
}
// "kafe/restoran (Haritalar: Lebanese restaurant)" -> "Lebanese restaurant"
export const categoryOf = (type) => { const m = /Haritalar:\s*([^)]+)/.exec(String(type || '')); return m ? m[1].trim() : ''; };

export function loadLeads({ dir = LEADS_DIR, only } = {}) {
  const files = fs.readdirSync(dir).filter((f) => /^leads-.*\.csv$/.test(f)).sort();
  const byKey = new Map();
  for (const fn of files) {
    const r = parseCsv(fs.readFileSync(path.join(dir, fn), 'utf8'));
    const h = r[0];
    const ix = Object.fromEntries(KEEP.map((k) => [k, h.indexOf(k)]));
    for (const x of r.slice(1)) {
      if (x.length < h.length) continue;
      const o = Object.fromEntries(KEEP.map((k) => [k, ix[k] >= 0 ? x[ix[k]] : '']));
      if (!/^(kafe\/restoran|bar\/pub)/.test(o.type) || !/^https?:\/\//i.test(o.website || '')) continue;
      let host; try { host = new URL(o.website).host.replace(/^www\./, ''); } catch { continue; }
      byKey.set(host, { id: o.id, name: o.name, site: o.website, kind: kindOf(o.type), category: categoryOf(o.type), lang: o.lang === 'tr' ? 'tr' : 'en', region: o.region, city: o.city, area: o.area, phone: o.phone, rating: Number(o.rating) || null, reviews: Number(o.review_count) || null, segment: o.segment, slug: slugOf(o.name) });
    }
  }
  const list = [...byKey.values()];
  const used = new Map();
  for (const l of list) { const n = used.get(l.slug) || 0; used.set(l.slug, n + 1); if (n) l.slug = `${l.slug}-${n + 1}`; }
  return only ? list.filter((l) => only.includes(l.slug) || only.includes(l.id)) : list;
}
