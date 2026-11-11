// hat/sessiz.sh yardimcisi: bir gunluk dosyasindan herkese acik gunluge gidebilecek OZET satirlarini cikarir.
// Yalniz bilinen onekli satirlar (DONGU BITTI, URETIM BITTI, UYGULANDI, OZET, test sayilari).  JSON govdesi temizlenir:
// metin dizileri adede doner; slug, e-posta ya da adres benzeri anahtar/deger "?" olur; 40 karakterden uzun metin "?" olur.
//   node hat/sessiz-ozet.mjs <gunluk dosyasi>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ONEK = /^(DONGU BITTI|URETIM BITTI|UYGULANDI|OZET|# (?:tests|pass|fail|skipped|cancelled|todo)) ?(.*)$/;
export const kirli = (s) => /@|-(?:ie|au|nz|gb|tr)\d{3,}|https?:|www\./i.test(String(s));
export function temizle(v) {
  if (Array.isArray(v)) return v.every((x) => typeof x === 'string') ? v.length : v.map(temizle);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, w]) => [kirli(k) ? '?' : k, temizle(w)]));
  if (typeof v === 'string') return kirli(v) || v.length > 40 ? '?' : v;
  return v;
}
export function ozetSatirlari(metin, enCok = 8) {
  const out = [];
  for (const s of String(metin).split('\n').filter((x) => ONEK.test(x)).slice(-enCok)) {
    const m = ONEK.exec(s); let govde = m[2].replace(/ -> .*$/, '');
    const j = /^(\{.*\}|\[.*\])(.*)$/.exec(govde);
    if (j) { try { govde = JSON.stringify(temizle(JSON.parse(j[1]))) + (kirli(j[2]) ? '' : j[2]); } catch { govde = '?'; } }
    else if (kirli(govde)) govde = '?';
    out.push(`${m[1]} ${govde}`.trim().slice(0, 300));
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const f = process.argv[2];
  if (f && fs.existsSync(f)) for (const s of ozetSatirlari(fs.readFileSync(f, 'utf8'))) console.log(s);
}
