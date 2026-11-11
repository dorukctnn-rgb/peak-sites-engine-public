// Yasak sozcuk ve isaret kaliplari bu depoda durmaz: ozel veri deposundan calisma aninda gelir (node hat/ozel-getir.mjs -> hat/ozel-sozluk.json, .gitignore).
// Kalip yoksa denetim sessizce gecmez: ilk kullanimda hata firlatir (fail-closed).  Ortam OZEL_SOZLUK baska bir dosya gosterebilir (testler).
//   yasakVar('<kalip adi>', metin)  -> true/false
//   kalip('<ad>')                  -> RegExp (her cagrida lastIndex sifirlanir)
//   ifadeler('<ad>')               -> ek yasak ifade listesi
//   deger('<ad>', varsayilan)      -> duz deger
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VARSAYILAN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'hat', 'ozel-sozluk.json');
const dosya = () => process.env.OZEL_SOZLUK || VARSAYILAN;
let S = null; let SD = null;
const onbellek = new Map();

export function sozlukVarsa() {
  const f = dosya();
  if (S && SD === f) return S;
  if (!fs.existsSync(f)) return null;
  S = JSON.parse(fs.readFileSync(f, 'utf8')); SD = f; onbellek.clear();
  return S;
}
export function sozluk() {
  const s = sozlukVarsa();
  if (!s) throw new Error('ozel sozluk yok (hat/ozel-sozluk.json): once `node hat/ozel-getir.mjs --kaynak <veri deposu klonu>`');
  return s;
}
export function kalip(ad) {
  const s = sozluk();
  if (!onbellek.has(ad)) {
    const k = s.kalip && s.kalip[ad];
    if (!Array.isArray(k) || typeof k[0] !== 'string') throw new Error(`ozel sozlukte kalip yok: ${ad}`);
    onbellek.set(ad, new RegExp(k[0], k[1] || ''));
  }
  const re = onbellek.get(ad); re.lastIndex = 0; return re;
}
export const yasakVar = (ad, metin) => kalip(ad).test(String(metin ?? ''));
export const ifadeler = (ad) => { const s = sozluk(); return (s.ifade && Array.isArray(s.ifade[ad])) ? s.ifade[ad] : []; };
export const deger = (ad, varsayilan = null) => { const s = sozluk(); return s.deger && ad in s.deger ? s.deger[ad] : varsayilan; };
