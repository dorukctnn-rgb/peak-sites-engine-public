// SEKTOR KANITI: lead + tarama dosyalarindan olculmus sektor karsilastirmasi (tahmin yok).  Her satir bir <ULKE>-<sektor> dosyasi cifti.
//   node hat/sektor-kanit.mjs <lead klasoru> [--md cikti.md]
// Sutunlar: lead (websitesi olan, zincir elenmis), taranan, erisilemedi, iyi site, kotu site ama yayimlanmis e-posta yok, ADAY (kotu site + e-posta), aday orani, en sik kotu site bulgulari.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const jsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);

export function kanit(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^[A-Z]{2}-[a-z]+\.jsonl$/.test(x)).sort()) {
    const ad = f.replace(/\.jsonl$/, ''); const leads = jsonl(path.join(dir, f)); const tar = jsonl(path.join(dir, `${ad}.tarandi.jsonl`));
    const sayac = {}; const bulgu = {};
    for (const x of tar) { sayac[x.durum] = (sayac[x.durum] || 0) + 1; if (x.durum !== 'erisilemedi') for (const b of x.bulgular || []) bulgu[b.k] = (bulgu[b.k] || 0) + 1; }
    const erisilen = tar.length - (sayac.erisilemedi || 0);
    out.push({ ad, lead: leads.filter((l) => !l.elendi).length, elenen: leads.filter((l) => l.elendi).length, taranan: tar.length, erisilemedi: sayac.erisilemedi || 0, iyi: sayac['iyi-site'] || 0, epostasiz: sayac.engel || 0, aday: sayac.aday || 0, adayOrani: tar.length ? +(100 * (sayac.aday || 0) / tar.length).toFixed(1) : null, kotuOrani: erisilen ? +(100 * ((sayac.aday || 0) + (sayac.engel || 0)) / erisilen).toFixed(1) : null, bulgular: Object.entries(bulgu).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} ${n}`) });
  }
  return out;
}

export function tablo(rows) {
  const h = '| dosya | lead | taranan | ulasilamadi | iyi site | kotu site, e-posta yok | ADAY | aday % | kotu site % (ulasilanlar) | en sik bulgular |\n|---|---|---|---|---|---|---|---|---|---|';
  return [h, ...rows.map((r) => `| ${r.ad} | ${r.lead} | ${r.taranan} | ${r.erisilemedi} | ${r.iyi} | ${r.epostasiz} | ${r.aday} | ${r.adayOrani ?? '-'} | ${r.kotuOrani ?? '-'} | ${r.bulgular.join(', ')} |`)].join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = path.resolve(process.argv[2] || 'calisma/lead'); const md = tablo(kanit(dir));
  console.log(md);
  const i = process.argv.indexOf('--md'); if (i > 0) fs.writeFileSync(path.resolve(process.argv[i + 1]), `${md}\n`);
}
