// HAT 4. ADIM: SAYFALARI YAYINA TESLIM ET (peakappsstudios deposu: dal + PR; kosullar tutarsa ve sektor onayliysa otomatik birlestirme).
//   node hat/teslim.mjs --son calisma/son/liste.json --site <peakappsstudios klonu> [--onay <onay.json>] [--birlestir]
// - yalniz web/demo/r/<slug>-<kod>/ ve web/demo/_hat1/ degisir (hat/yayinla.mjs birlesirMi denetler); baska yola dokunan PR acik kalir.
// - Birlestirme: --birlestir verilmis, denetim temiz VE listedeki her sektor onay.json'da onayli.  Onaysiz sektorun PR'i acik kalir; koordinator 5 sayfayi gozle onaylayinca birlestirir.
// - Cloud'da GH_TOKEN (HAT_PAT) ile, yerelde oturum acmis gh ile calisir.  Ana siteye (web/ disinda) HICBIR sey yazilmaz.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yayinHazirla, birlesirMi } from './yayinla.mjs';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const gh = (cwd, ...a) => execFileSync('gh', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function sektorlerOnayli(son, onay) { const s = [...new Set(son.filter((x) => x.durum === 'hazir').map((x) => x.sektor))]; return { sektorler: s, onayli: s.length > 0 && s.every((k) => onay[k] && onay[k].onaylandi) }; }

export function teslim({ son, site, onay = {}, birlestir = false, dal = `hat/yayin-${new Date().toISOString().replace(/\D/g, '').slice(0, 12)}`, demo, calistir = { git, gh }, log = console.log }) {
  const G = calistir.git; const H = calistir.gh;
  G(site, 'checkout', '-q', '-B', dal, 'origin/main');
  const { yazilan, sorun } = yayinHazirla({ son, depo: site, ...(demo ? { demo } : {}) });
  if (!yazilan.length) { log(`teslim: kopyalanan sayfa yok${sorun.length ? ` (sorun: ${sorun.slice(0, 3).join(' | ')})` : ''}`); return { yazilan, sorun, pr: null }; }
  G(site, 'add', 'web/demo');
  const degisen = G(site, 'diff', '--cached', '--name-only').split('\n').map((s) => s.trim()).filter(Boolean);
  const b = birlesirMi(degisen, site);
  G(site, '-c', 'user.name=peak-hat[bot]', '-c', 'user.email=hat@peakappsstudio.com', 'commit', '-q', '-m', `web/demo: ${yazilan.length} isletme sayfasi (hat)`);
  G(site, 'push', '-q', '-u', 'origin', dal);
  const govde = `Hat: ${yazilan.length} demo sayfasi (noindex, bagli hicbir yerden link verilmez). Degisen yollar yalniz web/demo/r/** ve web/demo/_hat1/**.\nOtomatik birlestirme denetimi: ${b.ok ? 'temiz' : b.neden.slice(0, 5).join(' | ')}`;
  const url = H(site, 'pr', 'create', '--base', 'main', '--head', dal, '--title', `web/demo: ${yazilan.length} isletme sayfasi (hat)`, '--body', govde).trim();
  const o = sektorlerOnayli(son, onay);
  let birlesti = false;
  if (birlestir && b.ok && o.onayli) { H(site, 'pr', 'merge', url, '--squash'); birlesti = true; }
  log(`teslim: ${yazilan.length} sayfa, PR ${url}, ${birlesti ? 'BIRLESTIRILDI' : `acik kaldi (${!birlestir ? 'birlestirme istenmedi' : !b.ok ? 'denetim: ' + b.neden[0] : `sektor onaysiz: ${o.sektorler.join(',')}`})`}`);
  return { yazilan, sorun, pr: url, birlesti, denetim: b };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const onayF = arg('--onay'); let onay = {}; try { if (onayF) onay = JSON.parse(fs.readFileSync(path.resolve(onayF), 'utf8')); } catch { /* yok */ }
  teslim({ son: JSON.parse(fs.readFileSync(path.resolve(arg('--son')), 'utf8')), site: path.resolve(arg('--site')), onay, birlestir: process.argv.includes('--birlestir'), dal: arg('--dal') || undefined });
}
