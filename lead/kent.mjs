// KENT TARAMASI (18 Kas 2026, yeni lead kaynaklari): ek kent kutulari (lead/osm.mjs METRO_EK; --plan metro ile eski METRO kentleri) icin OSM Overpass restoran ailesi listesi -> lead jsonl.
// Yalniz dikdortgen sorgusu (ulke alani yok; hafif).  Agir kutu (sunucu zaman asimi) dorde bolunur (bir kez).  Sonraki adimlar ayni: lead/tara.mjs (site + e-posta), arac/sec.mjs, hat/uretim.mjs.
//   node lead/kent.mjs --ulke GB [--kentler Cambridge,Oxford] [--sektor restoran] [--plan ek|metro|hepsi] [--sunucu 1] [--cikti calisma/lead/GB-yeni.jsonl]
// --sunucu: ilk denenecek Overpass aynasi (0 kumi.systems, 1 overpass-api.de; 18 Kas: kumi 504 / zaman asimi veriyordu, kent basina dakikalar); her kent bitince cikti dosyasina eklenir.
// Cikti satiri bul()'daki gibi lead + { host, kent }.  E-posta etiketi OSM'de varsa lead'e girer (ekrana basilmaz).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { METRO, METRO_EK, sorgu, overpass, leadOf } from './osm.mjs';
import { ULKELER, kapaliUlke } from './sektorler.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const kentler = (ulke, plan = 'ek') => [...(plan === 'metro' || plan === 'hepsi' ? METRO[ulke] || [] : []), ...(plan === 'ek' || plan === 'hepsi' ? METRO_EK[ulke] || [] : [])];
const dortBol = ([s, w, n, e]) => { const ms = (s + n) / 2; const mw = (w + e) / 2; return [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]].map((k) => k.map((x) => +x.toFixed(4))); };

// -> { leads, kentler: { ad: lead sayisi }, hatalar: [kent] }
export async function kentBul(ulke, secilen, { sektor = 'restoran', sorgula = overpass, bekleMs = 3000, log = () => {}, ilk = 1, zamanMs = 90000, kentBitti = null } = {}) {
  if (!ULKELER[ulke] || kapaliUlke(ulke)) throw new Error(`ulke hedefte degil: ${ulke}`);
  const seen = new Set(); const leads = []; const say = {}; const hatalar = [];
  const sor = async (kutu, ad, bol = true) => {
    try {
      const j = await sorgula(sorgu(ulke, sektor, { kutu, alansiz: true, zaman: 120 }), { tries: 3, log, ilk, zamanMs });
      let n = 0;
      for (const el of j.elements || []) {
        const l = leadOf(el, ulke, sektor); if (!l) continue;
        let host = ''; try { host = new URL(l.website).host.replace(/^www\./, ''); } catch { continue; }
        if (seen.has(host)) continue; seen.add(host); leads.push({ ...l, host, kent: ad }); n++;
      }
      say[ad] = (say[ad] || 0) + n;
    } catch (e) {
      if (bol && (e.agir || e.yavas)) { for (const k of dortBol(kutu)) { await sleep(bekleMs); await sor(k, ad, false); } return; }
      hatalar.push(ad); log(`${ad}: ${String(e.message).slice(0, 80)}`);
    }
  };
  for (const k of secilen) { const once = leads.length; await sor(k.kutu, k.ad); if (kentBitti) kentBitti(k.ad, leads.slice(once)); await sleep(bekleMs); }
  return { leads, kentler: say, hatalar: [...new Set(hatalar)] };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const ulke = arg('--ulke'); const sektor = arg('--sektor', 'restoran'); const plan = arg('--plan', 'ek');
  const ad = arg('--kentler') ? arg('--kentler').split(',').map((x) => x.trim().toLowerCase()) : null;
  const secilen = kentler(ulke, plan).filter((k) => !ad || ad.includes(k.ad.toLowerCase()));
  if (!secilen.length) { console.error(`kent yok: ${ulke} ${plan} ${ad || ''}`); process.exit(2); }
  const f = arg('--cikti', `calisma/lead/${ulke}-kent.jsonl`);
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, ''); // her kent bitince eklenir: kesilse de biten kentler dosyada
  const r = await kentBul(ulke, secilen, { sektor, log: console.error, ilk: Number(arg('--sunucu', 1)), kentBitti: (k, ls) => { if (ls.length) fs.appendFileSync(f, ls.map((x) => JSON.stringify(x)).join('\n') + '\n'); console.error(`${k}: ${ls.length} lead`); } });
  console.log(`${ulke} ${sektor}: ${r.leads.length} lead, ${secilen.length} kent -> ${f}\n${JSON.stringify(r.kentler)}${r.hatalar.length ? `\nHATA: ${r.hatalar.join(',')}` : ''}`);
}
