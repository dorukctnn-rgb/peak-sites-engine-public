// YEREL URETIMI BULUT VERISINE AKTAR.  Laptopta (ya da baska yerde) uretilmis isletme klasorlerini bulutun `veri` dalina tasir; bulut ayni isletmeyi yeniden uretmez
// (kapi.json nihai ise `kapiBitti`), kapidan hazir cikanlar icerik turu inceleme kutusuna girer.  Gonderim ya da sayfa yayini YAPMAZ.
//   node hat/yerel-aktar.mjs --kaynak <yerel veri klasoru> --depo <veri dali klonu> [--kutu <inceleme-kutusu dali klonu>] [--slugs a,b] [--parti yerel-1] [--yaz]
// - veri klasoru: <kaynak>/<slug>/{cikarici.json, kapi.json, uret.json, img/, inceleme/}  ->  <depo>/veri/<slug>/  (bulutta olan slug'a DOKUNULMAZ)
// - durum/kutu-gecmis.json'a eklenir (kutuya girmis sayilir; ayni isletme ikinci kez kutuya girmez)
// - --kutu verilirse kapidan hazir + inceleme paketi olanlar kutuya (sheet.jpg + bilgi.json + BEKLEYEN.json) eklenir
// Calisan bulut turuyla ayni anda koşmayin (gh run list --status in_progress bos olmali); tek dosyali durumlar (kutu-gecmis) once uzaktan okunup birlestirilir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ekle as kutuEkle } from './kutu.mjs';

const J = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

export function aktar({ kaynak, depo, kutu = null, slugs = null, parti = `yerel-${Date.now().toString(36)}`, yaz = false }) {
  const sonuc = { kopyalandi: [], vardi: [], atlandi: [], kutuya: 0 };
  const hepsi = (slugs && slugs.length ? slugs : fs.readdirSync(kaynak)).filter((s) => fs.existsSync(path.join(kaynak, s, 'cikarici.json')));
  for (const s of hepsi) {
    const hedef = path.join(depo, 'veri', s);
    if (fs.existsSync(path.join(hedef, 'cikarici.json'))) { sonuc.vardi.push(s); continue; }
    const kapi = J(path.join(kaynak, s, 'kapi.json'), null);
    if (!kapi || !kapi.status) { sonuc.atlandi.push(s); continue; } // kapidan gecmemis: bulut kendi uretir
    if (yaz) fs.cpSync(path.join(kaynak, s), hedef, { recursive: true, filter: (f) => !/[\\/](once-|sonra-)[^\\/]*$/.test(f) });
    sonuc.kopyalandi.push(s);
  }
  const gf = path.join(depo, 'durum', 'kutu-gecmis.json');
  const gecmis = new Set(J(gf, []));
  if (yaz) {
    for (const s of sonuc.kopyalandi) gecmis.add(s);
    fs.mkdirSync(path.dirname(gf), { recursive: true }); fs.writeFileSync(gf, JSON.stringify([...gecmis].sort(), null, 1));
  }
  if (kutu && yaz) {
    const hazir = sonuc.kopyalandi.filter((s) => J(path.join(depo, 'veri', s, 'kapi.json'), {}).status === 'hazir' && fs.existsSync(path.join(depo, 'veri', s, 'inceleme', 'sheet.jpg')));
    sonuc.kutuya = kutuEkle({ kutu, parti, slugs: hazir, veri: path.join(depo, 'veri') });
  }
  return sonuc;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  if (!arg('--kaynak') || !arg('--depo')) { console.error('kullanim: node hat/yerel-aktar.mjs --kaynak <veri> --depo <veri dali klonu> [--kutu <kutu klonu>] [--slugs a,b] [--parti id] [--yaz]'); process.exit(2); }
  const r = aktar({ kaynak: path.resolve(arg('--kaynak')), depo: path.resolve(arg('--depo')), kutu: arg('--kutu') ? path.resolve(arg('--kutu')) : null, slugs: arg('--slugs') ? arg('--slugs').split(',') : null, parti: arg('--parti') || undefined, yaz: process.argv.includes('--yaz') });
  console.log(`${process.argv.includes('--yaz') ? 'AKTARILDI' : 'KURU CALISMA'}: ${r.kopyalandi.length} kopyalanacak/kopyalandi, ${r.vardi.length} bulutta vardi, ${r.atlandi.length} kapisiz atlandi, kutuya ${r.kutuya}`);
}
