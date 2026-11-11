// Herkese acik depoda sizinti taramasi: gizli bilgi kaliplari, yasak yol/dosya turleri, ozel varliklar, izinli listede olmayan e-posta adresleri, istege bagli yasak terimler.
// Kullanim: node hat/sizinti-kontrol.mjs [--kok <klasor>] [--terimler <json>] [--terim-dosyasi <txt>]   (CI: ortam sirri gerektirmez)
//   - yasak terimler: ortam SIZINTI_YASAK_TERIMLER (satir satir; tek satirsa virgulle ayrilmis), --terim-dosyasi (satir satir) ve/veya --terimler ({ "tara": { "terimler": [...] } })
//     Her terim: duz metin (buyuk/kucuk harf duyarsiz), `re:<kalip>` (duyarli duzenli ifade, unicode) ya da `rei:<kalip>` (duyarsiz).  # ile baslayan satir yorumdur.
//   - izinli e-postalar: hat/sizinti-izin.json
// DEGER YAZDIRMAZ: yalniz tur, dosya ve satir.  Bulgu varsa cikis kodu 1.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const kok = path.resolve(arg('--kok', process.cwd()));

function dosyalar() {
  const g = spawnSync('git', ['-C', kok, 'ls-files', '-z'], { maxBuffer: 1 << 28 });
  if (g.status === 0 && g.stdout.length) return g.stdout.toString('utf8').split('\0').filter(Boolean);
  const out = [];
  const gez = (d) => {
    for (const e of fs.readdirSync(path.join(kok, d), { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const rel = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) gez(rel); else out.push(rel);
    }
  };
  gez('');
  return out;
}

const YASAK_YOL = [
  [/^(veri|durum|karar|onizleme)\//, 'yasak-klasor'],
  [/^web\/demo\//, 'yasak-klasor'],
  [/(^|\/)BEKLEYEN\.json$/, 'yasak-dosya'],
  [/\.jsonl$/, 'yasak-dosya-turu(jsonl)'],
  [/(^|\/)\.env(\.|$)/, 'yasak-dosya(.env)'],
  [/\.(pem|p12|pfx|keystore|jks)$/i, 'yasak-dosya(anahtar)'],
  [/(^|\/)(id_rsa|id_ed25519)/, 'yasak-dosya(ssh)'],
  [/(^|\/)(secrets?|credentials?)(\/|\.|$)/i, 'yasak-dosya(sir)'],
  // ozel varliklar: ozel veri deposundan calisma aninda gelir (hat/ozel-getir.mjs), bu depoya girmez
  [/^mail\//, 'ozel-varlik'],
  [/^uyarla\/sablon(-[^/]+)?\//, 'ozel-varlik'],
  [/^uyarla\/data\/(v5|kategori)-elle\.json$/, 'ozel-varlik'],
  [/^inceleme\/(ROUTINE[^/]*\.md|ornek\/)/, 'ozel-varlik'],
  [/^hat\/ozel-sozluk\.json$/, 'ozel-varlik'],
  [/(^|\/)test\/ozel-[^/]+\.test\.mjs$/, 'ozel-varlik'],
];
const KALIPLAR = [
  ['github-token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/g],
  ['sk-anahtar', /\bsk-(?:ant-|proj-|live-)?[A-Za-z0-9_-]{20,}/g],
  ['aws-anahtar', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['google-api-anahtar', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{10,}/g],
  ['ozel-anahtar', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ['paddle', /\b(?:pdl_(?:live|sdbx)_[a-z0-9_]{15,}|apikey_[a-z0-9]{20,})/g],
  ['stripe', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g],
  ['sendgrid', /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g],
  ['url-icinde-parola', /\bhttps?:\/\/[^/\s:@"'$]{2,}:(?!\$\{)[^/\s@"']{3,}@[A-Za-z0-9.-]+/g],
  ['iban-tr', /\bTR\d{2}\s?(?:\d{4}\s?){5}\d{2}\b/g],
];
const ATAMA = /(password|passwd|parola|sifre|secret|token|api[_-]?key|apikey|smtp[_-]?pass|auth[_-]?key|private[_-]?key)["']?\s*[:=]\s*["']([^"'\s$<{(`][^"'\s]{7,})["']/gi;
const ATAMA_ATLA = /^(?:process\.env|\$\{|secrets\.|true|false|null|undefined|your|xxx|example|placeholder|changeme|peakappsstudiodraftbot)/i;
const EPOSTA = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

let izin = { eposta_alanlari: [], eposta_tam: [] };
const izinDosya = path.join(kok, 'hat', 'sizinti-izin.json');
if (fs.existsSync(izinDosya)) izin = JSON.parse(fs.readFileSync(izinDosya, 'utf8'));
const izinAlan = new Set(izin.eposta_alanlari.map((x) => x.toLowerCase()));
const izinTam = new Set(izin.eposta_tam.map((x) => x.toLowerCase()));

const ortamTerim = (process.env.SIZINTI_YASAK_TERIMLER || '').replace(/\r/g, '');
let terimler = (ortamTerim.includes('\n') ? ortamTerim.split('\n') : ortamTerim.split(','));
const tf = arg('--terimler');
if (tf) terimler = terimler.concat(JSON.parse(fs.readFileSync(tf, 'utf8')).tara.terimler);
const td = arg('--terim-dosyasi');
if (td) terimler = terimler.concat(fs.readFileSync(td, 'utf8').replace(/\r/g, '').split('\n'));
terimler = terimler.map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
const terimlerKucuk = []; const terimKaliplari = [];
for (const t of terimler) {
  if (t.startsWith('re:')) terimKaliplari.push(new RegExp(t.slice(3), 'gu'));
  else if (t.startsWith('rei:')) terimKaliplari.push(new RegExp(t.slice(4), 'giu'));
  else terimlerKucuk.push(t.toLowerCase());
}

const bulgu = [];
const satirNo = (m, i) => { let n = 1; for (let k = 0; k < i; k++) if (m.charCodeAt(k) === 10) n++; return n; };

for (const f of dosyalar()) {
  if (f === 'hat/sizinti-kontrol.mjs' || f === 'hat/sizinti-izin.json') continue;
  for (const [re, tur] of YASAK_YOL) if (re.test(f)) bulgu.push({ tur, dosya: f });
  const tam = path.join(kok, f);
  let buf;
  try { buf = fs.readFileSync(tam); } catch { continue; }
  if (buf.slice(0, 8000).includes(0)) continue; // ikili (yazi tipi, gorsel)
  const m = buf.toString('utf8');
  for (const [tur, re] of KALIPLAR) { re.lastIndex = 0; let x; while ((x = re.exec(m))) bulgu.push({ tur, dosya: f, satir: satirNo(m, x.index) }); }
  ATAMA.lastIndex = 0; let a;
  while ((a = ATAMA.exec(m))) { if (!ATAMA_ATLA.test(a[2])) bulgu.push({ tur: `atama:${a[1].toLowerCase()}`, dosya: f, satir: satirNo(m, a.index) }); }
  EPOSTA.lastIndex = 0; let e;
  while ((e = EPOSTA.exec(m))) {
    const t = e[0].toLowerCase();
    if (/\.(png|jpe?g|webp|svg|gif|woff2?|css|m?js)$/.test(t)) continue;
    if (izinTam.has(t) || izinAlan.has(t.split('@')[1])) continue;
    bulgu.push({ tur: 'izinsiz-eposta', dosya: f, satir: satirNo(m, e.index) });
  }
  if (terimlerKucuk.length) {
    const k = m.toLowerCase();
    for (const t of terimlerKucuk) { let i = k.indexOf(t); while (i >= 0) { bulgu.push({ tur: 'yasak-terim', dosya: f, satir: satirNo(m, i) }); i = k.indexOf(t, i + t.length); } }
  }
  for (const re of terimKaliplari) { re.lastIndex = 0; let x; while ((x = re.exec(m))) { bulgu.push({ tur: 'yasak-terim', dosya: f, satir: satirNo(m, x.index) }); if (x[0] === '') re.lastIndex++; } }
}

const ozet = {};
for (const b of bulgu) ozet[b.tur] = (ozet[b.tur] || 0) + 1;
if (bulgu.length) {
  for (const b of bulgu.slice(0, 200)) console.log(`SIZINTI ${b.tur} ${b.dosya}${b.satir ? ':' + b.satir : ''}`);
  console.error(`sizinti-kontrol: ${bulgu.length} bulgu ${JSON.stringify(ozet)}`);
  process.exit(1);
}
console.log('sizinti-kontrol: temiz');
