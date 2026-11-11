// Inceleme turunun oz denetimi: node uyarla/restoran-icerik-kontrol.mjs <paket klasoru> <karar dosyasi>
// Karari uygulamadan once AYNI kurallarla (restoran-icerik.mjs denetle) kontrol eder; "TAMAM" yazmali.  Ag yok, dosya yazmaz.
import fs from 'node:fs';
import path from 'node:path';
import { denetle, baglam } from './restoran-icerik.mjs';

const [paket, kararF] = process.argv.slice(2);
if (!paket || !kararF) { console.error('kullanim: node uyarla/restoran-icerik-kontrol.mjs <paket klasoru> <karar dosyasi>'); process.exit(2); }
let k; try { k = JSON.parse(fs.readFileSync(kararF, 'utf8')); } catch (e) { console.log(`HATA karar okunamadi: ${e.message}`); process.exit(1); }
let bilgi = {}; try { bilgi = JSON.parse(fs.readFileSync(path.join(paket, 'bilgi.json'), 'utf8')); } catch { /* yok */ }
const R = { name: { n: bilgi.ad || '' }, photos: (bilgi.fotograflar || []).map((p) => ({ id: String(p.id) })) };
const kk = k.tur === 'son' && k.icerik ? k.icerik : k;
if (k.tur === 'son' && k.karar !== 'duzelt') {
  const H = [];
  if (k.inceleyen !== 'son-goz') H.push('son karar yalniz inceleyen "son-goz"');
  if (!['yayinla', 'duzelt', 'gozden-gecir', 'elendi'].includes(k.karar)) H.push(`karar gecersiz: ${k.karar}`);
  if (k.karar === 'yayinla') { if (!k.icerikHash) H.push('icerikHash yok (ozet.json)'); if (String((k.gozlem || {}).metin || '').length < 30 || /\d/.test((k.gozlem || {}).metin || '')) H.push('gozlem.metin dogrulanmis, rakamsiz tek cumle olmali'); if (!k.karsilastirma) H.push('karsilastirma alani yok (hero, menu, son)'); }
  console.log(H.length ? `HATA (${H.length}):\n- ${H.join('\n- ')}` : 'TAMAM'); process.exit(H.length ? 1 : 0);
}
const H = k.karar === 'icerik' || kk.karar === 'icerik' ? denetle(kk, baglam(paket, R)) : [];
console.log(H.length ? `HATA (${H.length}):\n- ${H.join('\n- ')}` : 'TAMAM');
process.exit(H.length ? 1 : 0);
