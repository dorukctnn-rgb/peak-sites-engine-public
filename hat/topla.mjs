// HAT: uygula.yml MATRIS PARCALARININ ciktilarini toplar.  Her parca (en cok 4, ayni anda) kendi kararlarini uygular ve ciktisini bir artifact klasorune PAKETLER;
// son is (topla) bu klasorleri tek veri/demo/onizleme agacina BIRLESTIRIR ve eskiden tek isin urettigi son/liste.json'u yazar.  Model yok, ag yok.
//   node hat/topla.mjs paketle  --parca i/n --son <parca liste.json> [--elle <parca elle delta>] --karar . --veri <UYARLA_VERI> --demo <UYARLA_DEMO> --oniz <onizleme> --hedef <klasor>
//   node hat/topla.mjs birlestir --girdi <klasor: parca-*/> --veri <..> --demo <..> --oniz <..> --elle <uyarla/data/elle/hat.json> --son <son/liste.json> [--beklenen n]
// Paket duzeni: son.json, elle.json, veri/<slug>/**, demo/<ortak klasorler ve r/<slug>-<kod>/**>, onizleme/<slug>.jpg.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kararListesi, parcaCoz, parcaSec } from './parca.mjs';
import { ORTAK, ORTAK_V5, ORTAK_K } from '../uyarla/lib/yol.mjs';

const J = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const kopya = (src, dst) => { if (!fs.existsSync(src)) return false; fs.cpSync(src, dst, { recursive: true, force: true }); return true; };

// bir parcanin ciktisi: karar slug'larinin veri klasoru (kapi, icerik, ekranlar, kutu paketi), satirlarin sayfa klasoru + ortak klasorler, onizlemeler, son liste, elle degisiklikleri
export function paketle({ son, kararSlugs, veri, demo, onizDir, elleDelta = {}, hedef }) {
  fs.rmSync(hedef, { recursive: true, force: true }); fs.mkdirSync(hedef, { recursive: true });
  const say = { veri: 0, sayfa: 0, onizleme: 0 };
  for (const s of new Set(kararSlugs)) if (kopya(path.join(veri, s), path.join(hedef, 'veri', s))) say.veri++;
  for (const x of son) {
    if (x.page) { const rel = String(x.page).replace(/\/index\.html$/, '').replace(/\/$/, ''); if (kopya(path.join(demo, rel), path.join(hedef, 'demo', rel))) say.sayfa++; }
    if (x.onizleme && fs.existsSync(x.onizleme)) { fs.mkdirSync(path.join(hedef, 'onizleme'), { recursive: true }); fs.copyFileSync(x.onizleme, path.join(hedef, 'onizleme', path.basename(x.onizleme))); say.onizleme++; }
  }
  for (const o of [ORTAK, ORTAK_V5, ORTAK_K]) kopya(path.join(demo, o), path.join(hedef, 'demo', o));
  fs.writeFileSync(path.join(hedef, 'son.json'), JSON.stringify(son.map((x) => (x.onizleme ? { ...x, onizleme: path.basename(x.onizleme) } : x)), null, 1));
  fs.writeFileSync(path.join(hedef, 'elle.json'), JSON.stringify(elleDelta, null, 1));
  return say;
}

// parca klasorleri -> tek agac.  onizleme yolu sonuc satirlarinda hedef klasoru gosterir (kuyruk adimi dosyayi oradan kopyalar)
export function birlestir({ girdi, veri, demo, onizDir, elleDosya, sonDosya, beklenen = null }) {
  const parcalar = (fs.existsSync(girdi) ? fs.readdirSync(girdi) : []).filter((d) => /^parca-\d+$/.test(d) && fs.statSync(path.join(girdi, d)).isDirectory()).sort();
  const son = []; const delta = {}; let kopyalanan = 0;
  for (const d of parcalar) {
    const p = path.join(girdi, d);
    for (const [src, dst] of [['veri', veri], ['demo', demo], ['onizleme', onizDir]]) if (kopya(path.join(p, src), dst)) kopyalanan++;
    for (const x of J(path.join(p, 'son.json'), [])) son.push(x.onizleme ? { ...x, onizleme: path.join(onizDir, path.basename(x.onizleme)) } : x);
    Object.assign(delta, J(path.join(p, 'elle.json'), {}));
  }
  // elle kaydi: mevcut dosya + parca degisiklikleri (null = o isletmenin kaydi silinir)
  const elle = J(elleDosya, {}) || {};
  for (const [slug, kayit] of Object.entries(delta)) { if (kayit) elle[slug] = kayit; else delete elle[slug]; }
  fs.mkdirSync(path.dirname(elleDosya), { recursive: true });
  fs.writeFileSync(elleDosya, JSON.stringify({ _not: 'hat/uygula.mjs yazar: icerik turu inceleme kararlarindan (karar/<parti>/<slug>.json). Elle duzenlenmez.', ...Object.fromEntries(Object.entries(elle).filter(([k]) => k !== '_not')) }, null, 1));
  fs.mkdirSync(path.dirname(sonDosya), { recursive: true });
  fs.writeFileSync(sonDosya, JSON.stringify(son, null, 1));
  fs.writeFileSync(path.join(path.dirname(sonDosya), 'son-bakis.txt'), son.filter((x) => x.durum === 'son-bakis').map((x) => x.slug).join(','));
  fs.writeFileSync(path.join(path.dirname(sonDosya), 'kararli.txt'), son.map((x) => x.slug).join(','));
  const eksik = beklenen != null && parcalar.length < beklenen ? beklenen - parcalar.length : 0;
  return { parcalar: parcalar.length, satir: son.length, kopyalanan, eksik };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const yol = (k, d) => path.resolve(arg(k, d));
  if (process.argv[2] === 'paketle') {
    const c = parcaCoz(arg('--parca')); if (!c) { console.error('kullanim: --parca i/n'); process.exit(2); }
    const kararSlugs = parcaSec(kararListesi(yol('--karar', '.')), c.i, c.n).map((x) => x.slug);
    const r = paketle({ son: J(yol('--son'), []), kararSlugs, veri: yol('--veri'), demo: yol('--demo'), onizDir: yol('--oniz', 'calisma/onizleme'), elleDelta: arg('--elle') ? J(yol('--elle'), {}) : {}, hedef: yol('--hedef') });
    console.log(`paketlendi: ${r.veri} isletme verisi, ${r.sayfa} sayfa, ${r.onizleme} onizleme`);
  } else if (process.argv[2] === 'birlestir') {
    const r = birlestir({ girdi: yol('--girdi'), veri: yol('--veri'), demo: yol('--demo'), onizDir: yol('--oniz', 'calisma/onizleme'), elleDosya: yol('--elle'), sonDosya: yol('--son', 'calisma/son/liste.json'), beklenen: arg('--beklenen') ? Number(arg('--beklenen')) : null });
    console.log(`birlestirildi: ${r.parcalar} parca, ${r.satir} sonuc satiri${r.eksik ? `, UYARI: ${r.eksik} parca eksik (is dustu; kararlari dalda duruyor, elle yeniden calistirin)` : ''}`);
  } else { console.error('kullanim: node hat/topla.mjs paketle|birlestir ...'); process.exit(2); }
}
