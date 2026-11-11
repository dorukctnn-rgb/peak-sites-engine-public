// HAT 4. ADIM: SAYFALARI YAYINA HAZIRLA (peakappsstudios deposu, web/demo/r/<slug>-<kod>/ + ortak web/demo/_hat1/).
//   node hat/yayinla.mjs --son calisma/son/liste.json --depo <peakappsstudios klonu> [--dal hat/yayin-<ts>]
// Yalniz dosyalari klona kopyalar ve denetler; commit/push/PR is akisi (uygula.yml) tarafindan yapilir.
// OTOMATIK BIRLESTIRME KOSULLARI (denetle()): degisiklik YALNIZ web/demo/r/** ve web/demo/_hat1/** altinda; her index.html noindex; dis betik yok;
// tek dosya <= 2 MB; toplam <= 80 MB.  Kosul tutmazsa PR acik kalir, koordinator bakar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO } from '../uyarla/uret.mjs';
import { ORTAK, ORTAK_V5, ORTAK_K } from '../uyarla/lib/yol.mjs';
import { yasakVar } from '../uyarla/lib/sozluk.mjs';
// restoran sayfasi yalniz Son goz turunun 'yayinla' kararindan sonra (sonGoz: true) yayina girer
export const yayinaGirer = (x) => x.durum === 'hazir' && (x.sektor !== 'restoran' || x.sonGoz === true);

const kopya = (src, dst) => { fs.mkdirSync(dst, { recursive: true }); for (const e of fs.readdirSync(src, { withFileTypes: true })) { const a = path.join(src, e.name); const b = path.join(dst, e.name); if (e.isDirectory()) kopya(a, b); else fs.copyFileSync(a, b); } };

export function sayfaDenetle(html) {
  const out = [];
  if (!/<meta name="robots" content="noindex/i.test(html)) out.push('noindex yok');
  if (/<script[^>]+src=["']https?:/i.test(html)) out.push('dis betik');
  if (/<link[^>]+href=["']https?:\/\/(?!peakappsstudio\.com)[^"']+["'][^>]*rel=["']stylesheet|<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i.test(html)) out.push('dis stil');
  if (yasakVar('kisaltma', html.replace(/<script[\s\S]*?<\/script>/g, ''))) out.push('yasak kisaltma');
  return out;
}

export function yayinHazirla({ son, depo, demo = DEMO }) {
  const hedef = path.join(depo, 'web', 'demo'); const sorun = []; const yazilan = [];
  for (const o of [ORTAK, ORTAK_V5, ORTAK_K]) if (fs.existsSync(path.join(demo, o))) kopya(path.join(demo, o), path.join(hedef, o));
  for (const x of son.filter(yayinaGirer)) {
    const src = path.join(demo, x.page); if (!fs.existsSync(path.join(src, 'index.html'))) { sorun.push(`${x.slug}: sayfa yok`); continue; }
    const d = sayfaDenetle(fs.readFileSync(path.join(src, 'index.html'), 'utf8')); if (d.length) { sorun.push(`${x.slug}: ${d.join(', ')}`); continue; }
    fs.rmSync(path.join(hedef, x.page), { recursive: true, force: true }); kopya(src, path.join(hedef, x.page)); yazilan.push(x.page);
  }
  return { yazilan, sorun };
}

// git diff --name-only ciktisi + klon -> birlestirme kosullari
export function birlesirMi(degisen, depo) {
  const neden = []; let toplam = 0;
  const izin = new RegExp(`^web/demo/(r/[a-z0-9-]+/|${ORTAK}/|${ORTAK_V5}/|${ORTAK_K}/)`);
  for (const f of degisen) {
    if (!izin.test(f)) { neden.push(`izin disi yol: ${f}`); continue; }
    const p = path.join(depo, f); if (!fs.existsSync(p)) continue; // silinen dosya yok sayilmaz: hat silmez
    const n = fs.statSync(p).size; toplam += n; if (n > 2 * 1024 * 1024) neden.push(`buyuk dosya: ${f}`);
    if (/index\.html$/.test(f)) { const d = sayfaDenetle(fs.readFileSync(p, 'utf8')); if (d.length) neden.push(`${f}: ${d.join(', ')}`); }
  }
  if (toplam > 80 * 1024 * 1024) neden.push(`toplam ${Math.round(toplam / 1048576)} MB`);
  if (!degisen.length) neden.push('degisiklik yok');
  return { ok: !neden.length, neden };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  if (process.argv[2] === 'denetle') {
    const degisen = fs.readFileSync(0, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
    const r = birlesirMi(degisen, path.resolve(arg('--depo')));
    console.log(r.ok ? 'BIRLESTIRILEBILIR' : `BIRLESTIRME YOK: ${r.neden.slice(0, 5).join(' | ')}`); process.exit(r.ok ? 0 : 1);
  }
  const son = JSON.parse(fs.readFileSync(arg('--son'), 'utf8'));
  const r = yayinHazirla({ son, depo: path.resolve(arg('--depo')) });
  console.log(`yayin: ${r.yazilan.length} sayfa kopyalandi${r.sorun.length ? `, sorun ${r.sorun.length}: ${r.sorun.slice(0, 3).join(' | ')}` : ''}`);
}
