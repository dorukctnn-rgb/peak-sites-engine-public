// HAT 2. ADIM: INCELEME KUTUSU.  Kapidan "hazir" cikan isletmelerin inceleme paketleri (sheet.jpg + bilgi.json) icerik turu turunun okuyacagi
// kutu/ klasorune girer.  Bulutta kutu/ engine deposunun `inceleme-kutusu` dalidir (tek commit, her yazista zorla yeniden: gecmis birikmez).
//   node hat/kutu.mjs ekle  --kutu <dir> --parti <id> [--slugs a,b]   kapi hazir + paketi olan (verilmezse hepsi) kutuya eklenir
//   node hat/kutu.mjs cikar --kutu <dir> --slugs a,b                   karari uygulanan isletmeler kutudan cikar
// BEKLEYEN.json = { bekleyen: [{ slug, parti, eklendi }] }.  Kutuda e-posta yok (bilgi.json isletmenin herkese acik sitesinden).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERI } from '../uyarla/uret.mjs';

const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export function kutuOku(kutu) { try { const o = J(path.join(kutu, 'BEKLEYEN.json')); return Array.isArray(o.bekleyen) ? o.bekleyen : []; } catch { return []; } }
// SON GOZ KUTUSU (12 Kas 2026): siki kapidan gecen restoran sayfalari ('son-bakis' paketleri) bu listeye duser; koordinator inceleme/songoz-kutu.mjs ile TOPLU bakar,
// 'yayinla' onay dosyalarini (karar/<parti>/<slug>.json, karar/songoz-* dali) yazar.  Yalniz onaylananlar yayin paketine ve (RESTORAN_KUYRUK=acik ise) BEKLETILMIS kuyruk satirina gecer.
const EKRANLAR = ['ekran-1440.jpg', 'ekran-390.jpg', 'ekran-1920.jpg', 'ekran-1440-tam.jpg', 'ekran-390-tam.jpg'];
const oku = (f) => { try { return J(f); } catch { return null; } };
export function sonGozKutusuOku(kutu) { const o = oku(path.join(kutu, 'SON-GOZ-KUTUSU.json')); return o && Array.isArray(o.sayfalar) ? o.sayfalar : []; }
function sonGozKutusuYaz(kutu, list) {
  const sayfalar = list.filter((x) => x.tur === 'son-bakis').map((x) => {
    const d = path.join(kutu, x.slug); const ozet = oku(path.join(d, 'ozet.json')) || {}; const bilgi = oku(path.join(d, 'bilgi.json')) || {};
    return { slug: x.slug, parti: x.parti || null, sablon: x.sablon || ozet.sablon || null, eklendi: x.eklendi || null, ad: bilgi.ad || null, sehir: bilgi.sehir || null, bolge: bilgi.bolge || null, sayfa: ozet.sayfa || null, icerikHash: ozet.icerikHash || null, kapi: ozet.kapi || null, ekranlar: EKRANLAR.filter((f) => fs.existsSync(path.join(d, f))) };
  });
  fs.writeFileSync(path.join(kutu, 'SON-GOZ-KUTUSU.json'), JSON.stringify({ _not: 'Siki kapidan gecen restoran sayfalari. Koordinator: node inceleme/songoz-kutu.mjs liste --kutu <bu klasor>. Yalniz yayinla onayi alanlar yayin paketine girer.', guncellendi: new Date().toISOString(), adet: sayfalar.length, sayfalar }, null, 1));
  return sayfalar.length;
}
function kutuKaydet(kutu, list) {
  fs.mkdirSync(kutu, { recursive: true });
  fs.writeFileSync(path.join(kutu, 'BEKLEYEN.json'), JSON.stringify({ bekleyen: list, guncellendi: new Date().toISOString() }, null, 1));
  const songoz = sonGozKutusuYaz(kutu, list);
  fs.writeFileSync(path.join(kutu, 'README.md'), `Inceleme kutusu: ${list.length} isletme bekliyor (${songoz} sayfa son goz kutusunda: SON-GOZ-KUTUSU.json). Yonerge: ana daldaki inceleme/ROUTINE.md ve inceleme/ROUTINE-SONGOZ.md. Bu dal hat tarafindan yeniden yazilir; elle duzenlenmez.\n`);
}

export function hazirlar(veri = VERI) {
  const out = [];
  for (const s of fs.existsSync(veri) ? fs.readdirSync(veri).sort() : []) {
    const k = path.join(veri, s, 'kapi.json');
    if (!fs.existsSync(k) || !fs.existsSync(path.join(veri, s, 'inceleme', 'sheet.jpg'))) continue;
    try { if (J(k).status === 'hazir') out.push(s); } catch { /* bozuk */ }
  }
  return out;
}

// restoran ailesi: icerik bekleyenler (kapi 'icerik-bekliyor' + paket/bilgi.json)
export function icerikHazir(veri = VERI) {
  const out = [];
  for (const s of fs.existsSync(veri) ? fs.readdirSync(veri).sort() : []) {
    const k = path.join(veri, s, 'kapi.json');
    if (!fs.existsSync(k) || !fs.existsSync(path.join(veri, s, 'paket', 'bilgi.json'))) continue;
    try { if (J(k).status === 'icerik-bekliyor') out.push(s); } catch { /* bozuk */ }
  }
  return out;
}
const kopyaDir = (src, dst) => { fs.mkdirSync(dst, { recursive: true }); for (const e of fs.readdirSync(src, { withFileTypes: true })) { const a = path.join(src, e.name); const b = path.join(dst, e.name); if (e.isDirectory()) kopyaDir(a, b); else fs.copyFileSync(a, b); } };

// tur: 'icerik' (paket/ -> icerik turu icerik turu) | 'son-bakis' (son/ -> Son goz turu) | yok (eski: inceleme/sheet.jpg + bilgi.json)
export function ekle({ kutu, parti, slugs, veri = VERI, tur = null }) {
  const list = kutuOku(kutu); const var_ = new Set(list.map((x) => x.slug)); let n = 0;
  for (const s of slugs) {
    if (tur === 'icerik' || tur === 'son-bakis') {
      const src = path.join(veri, s, tur === 'icerik' ? 'paket' : 'son'); if (!fs.existsSync(path.join(src, 'bilgi.json'))) continue;
      const i = list.findIndex((x) => x.slug === s); if (i >= 0) list.splice(i, 1);
      fs.rmSync(path.join(kutu, s), { recursive: true, force: true }); kopyaDir(src, path.join(kutu, s));
      let sablon = null; try { sablon = J(path.join(src, 'bilgi.json')).sablon; } catch { /* yok */ }
      list.push({ slug: s, parti, tur, sablon, eklendi: new Date().toISOString() }); n++; continue;
    }
    if (var_.has(s)) continue;
    const src = path.join(veri, s, 'inceleme'); if (!fs.existsSync(path.join(src, 'sheet.jpg'))) continue;
    fs.mkdirSync(path.join(kutu, s), { recursive: true });
    for (const f of ['sheet.jpg', 'bilgi.json']) fs.copyFileSync(path.join(src, f), path.join(kutu, s, f));
    list.push({ slug: s, parti, eklendi: new Date().toISOString() }); n++;
  }
  kutuKaydet(kutu, list);
  return n;
}

export function cikar({ kutu, slugs }) {
  const rm = new Set(slugs); const list = kutuOku(kutu).filter((x) => !rm.has(x.slug));
  for (const s of rm) fs.rmSync(path.join(kutu, s), { recursive: true, force: true });
  kutuKaydet(kutu, list);
  return list.length;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const kutu = path.resolve(arg('--kutu', 'calisma/kutu')); const cmd = process.argv[2];
  if (cmd === 'ekle') console.log(`kutu: ${ekle({ kutu, parti: arg('--parti'), tur: arg('--tur') || null, slugs: arg('--slugs') !== undefined ? String(arg('--slugs')).split(',').filter(Boolean) : hazirlar() })} isletme eklendi, ${kutuOku(kutu).length} bekliyor`);
  else if (cmd === 'cikar') console.log(`kutu: ${cikar({ kutu, slugs: String(arg('--slugs', '')).split(',').filter(Boolean) })} bekliyor`);
  else { console.error('kullanim: node hat/kutu.mjs ekle|cikar --kutu <dir> [--parti id] [--slugs a,b]'); process.exit(2); }
}
