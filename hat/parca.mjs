// HAT: uygula.yml MATRISI icin is bolme.  Karar dosyalari (karar/<parti>/<slug>.json) en cok 4 PARCAYA bolunur; her parca ayri bir Actions isinde ayni anda kosar
// ("tur basina en cok 4 isletme ayni anda").  Bu dosya hafiftir (yalniz fs/path): plan isi npm kurmadan sayabilsin diye.
//   node hat/parca.mjs plan --karar . [--paralel 4]      -> stdout ve GITHUB_OUTPUT: adet=<karar sayisi> parca=[0,1,..] n=<parca sayisi>
//   node hat/parca.mjs slugs --karar . --parca 1/4       -> o parcanin slug listesi (virgullu)
// Bolme kararli: kararlar (parti, slug) siralanir, sira numarasi % n == parca.  Bozuk json dosyasi da sayilir (uygula 'karar-hatali' yazar).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PARALEL_USTSINIR = 4;

export function kararListesi(dir) {
  const out = []; const kd = path.join(dir, 'karar');
  for (const p of (fs.existsSync(kd) ? fs.readdirSync(kd) : []).sort()) {
    const pd = path.join(kd, p); if (!fs.statSync(pd).isDirectory()) continue;
    for (const f of fs.readdirSync(pd).filter((x) => x.endsWith('.json')).sort()) out.push({ parti: p, slug: f.replace(/\.json$/, '') });
  }
  return out;
}
// paralel: istenen (varsayilan 4); en cok 4 ve karar sayisi kadar; karar yoksa 0
export const parcaSayisi = (adet, paralel = PARALEL_USTSINIR) => {
  const p = Math.floor(Number(paralel)); const ist = Number.isFinite(p) && p >= 1 ? p : PARALEL_USTSINIR;
  return Math.min(PARALEL_USTSINIR, ist, Math.max(0, adet));
};
export const parcaCoz = (s) => { const m = /^(\d+)\/(\d+)$/.exec(String(s || '')); if (!m) return null; const i = +m[1]; const n = +m[2]; return n >= 1 && i < n ? { i, n } : null; };
// liste ({parti, slug} ya da ayni alanlari tasiyan nesne) -> i. parca
export const parcaSec = (liste, i, n) => [...liste].sort((a, b) => (a.parti + '/' + a.slug < b.parti + '/' + b.slug ? -1 : 1)).filter((_, k) => k % n === i);

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const liste = kararListesi(path.resolve(arg('--karar', '.')));
  if (process.argv[2] === 'slugs') {
    const c = parcaCoz(arg('--parca')); if (!c) { console.error('kullanim: --parca i/n'); process.exit(2); }
    console.log(parcaSec(liste, c.i, c.n).map((x) => x.slug).join(','));
  } else {
    const n = parcaSayisi(liste.length, arg('--paralel', process.env.HAT_PARALEL));
    // karar yoksa matris yine bir deger ister: [0] ve adet=0 (is 'if' ile atlanir)
    const o = `adet=${liste.length}\nn=${n}\nparca=${JSON.stringify(n ? Array.from({ length: n }, (_, i) => i) : [0])}\n`;
    process.stdout.write(o); if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, o);
  }
}
