// Ozel varliklari (sablonlar ve yazi tipleri, mail metinleri ve denetimleri, inceleme yonergeleri ve ornekleri, demo verisi, sozluk, ozel testler)
// ozel veri deposunun main dalindaki motor/ klasorunden bu calisma agacina kopyalar.  Bu yollar .gitignore'dadir: herkese acik depoya girmez
// (hat/sizinti-kontrol.mjs de engeller).  Is akislari bunu HAT_PAT ile cekilen veri deposu kopyasindan calistirir; yerelde ve rutinlerde ayni komut.
//   node hat/ozel-getir.mjs --kaynak <veri deposu klonu> [--hedef <motor kok>] [--kontrol]
//   --kontrol: kopyalamaz; gerekli ozel varliklar yerinde mi bakar (cikis 0/1)
// Cikti yalniz sayidir (dosya adi ya da icerik basilmaz).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// motor/ altinda izin verilen yollar (yalniz bunlar kopyalanir; baska bir sey varsa DURUR)
export const OZEL_YOLLAR = [
  /^mail\/[^/]+\.mjs$/,
  /^uyarla\/sablon(-[a-z0-9-]+)?\/.+$/,
  /^uyarla\/data\/(v5|kategori)-elle\.json$/,
  /^inceleme\/ROUTINE(-[A-Z]+)?\.md$/,
  /^inceleme\/ornek\/[a-z0-9-]+\.json$/,
  /^hat\/ozel-sozluk\.json$/,
  /^(hat|uyarla|lead|sektor)\/test\/ozel-[a-z0-9-]+\.test\.mjs$/,
];
// calisma icin sart olanlar (--kontrol)
export const GEREKLI = ['hat/ozel-sozluk.json', 'mail/sablon.mjs', 'uyarla/sablon/v5.css', 'uyarla/data/v5-elle.json'];

export const izinliMi = (rel) => OZEL_YOLLAR.some((re) => re.test(rel));

export function ozelGetir({ kaynak, hedef = KOK }) {
  const kok = path.join(kaynak, 'motor');
  if (!fs.existsSync(kok)) throw new Error('kaynakta motor/ klasoru yok (veri deposunun main dali mi?)');
  const dosyalar = [];
  const gez = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isSymbolicLink()) throw new Error('sembolik baglanti kabul edilmez'); if (e.isDirectory()) gez(p); else dosyalar.push(path.relative(kok, p).split(path.sep).join('/')); } };
  gez(kok);
  const izinsiz = dosyalar.filter((f) => !izinliMi(f));
  if (izinsiz.length) throw new Error(`motor/ icinde izinli listede olmayan ${izinsiz.length} dosya var: kopyalanmadi`);
  for (const f of dosyalar) { const h = path.join(hedef, f); fs.mkdirSync(path.dirname(h), { recursive: true }); fs.copyFileSync(path.join(kok, f), h); }
  return { dosya: dosyalar.length };
}

export const eksikler = (hedef = KOK) => GEREKLI.filter((f) => !fs.existsSync(path.join(hedef, f)));

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const hedef = path.resolve(arg('--hedef', KOK));
  if (process.argv.includes('--kontrol')) {
    const e = eksikler(hedef);
    if (e.length) { console.error(`ozel varliklar eksik (${e.length}); once: node hat/ozel-getir.mjs --kaynak <veri deposu klonu>`); process.exit(1); }
    console.log('ozel varliklar yerinde'); process.exit(0);
  }
  const kaynak = path.resolve(arg('--kaynak', path.join(KOK, '..', 'data')));
  const r = ozelGetir({ kaynak, hedef });
  const e = eksikler(hedef);
  console.log(`ozel varliklar: ${r.dosya} dosya kopyalandi${e.length ? `, EKSIK ${e.length}` : ''}`);
  if (e.length) process.exit(1);
}
