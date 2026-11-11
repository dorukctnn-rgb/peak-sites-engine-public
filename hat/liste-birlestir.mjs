// yayin-paketi dalinin liste.json'unu BIRIKTIRIR: her uygula turu yalniz kendi sonuclarini uretir, paket ise kalici olmali (koordinator tum hazir sayfalari bir arada gorsun).
//   node hat/liste-birlestir.mjs <paket/liste.json> <calisma/son/liste.json>
// Ayni slug'in yeni sonucu eskisinin yerine gecer; sonuc sirasi: eskiler, sonra yeni slug'lar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function birlestir(eski, yeni) {
  const m = new Map(); for (const x of [...(eski || []), ...(yeni || [])]) if (x && x.slug) m.set(x.slug, x);
  return [...m.values()];
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [hedef, yeni] = process.argv.slice(2);
  const oku = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; } };
  const r = birlestir(oku(hedef), oku(yeni));
  fs.mkdirSync(path.dirname(hedef), { recursive: true }); fs.writeFileSync(hedef, JSON.stringify(r, null, 1));
  console.log(`liste: ${r.length} kayit, ${r.filter((x) => x.durum === 'hazir').length} hazir`);
}
