// HAT: GitHub Actions DAKIKA BUTCESI.  Ozel depolarda hesap basina ayda 2000 dakika ucretsiz (hepsi birlikte: gonderici peak-outreach da bundan yer); butce asilirsa is DURUR, para odenmez.
//   node hat/butce.mjs --repo dorukctnn-rgb/peak-sites-engine [--aylik 600] [--gunluk 50] [--tur 40]   (GITHUB_TOKEN ortamdan)
// Cikti: stdout'a `calis=true|false` ve `sure=<dk>` (GITHUB_OUTPUT'a da yazilir).  Hesap: bu deponun bu ayki kosularinin sure toplami (kosu basina yukari yuvarlanmis dakika).
// Depo HERKESE ACIK olunca dakika sinirsizdir: HAT_DAKIKA_SINIRSIZ=true AYLIK siniri kapatir.  GUNLUK ust sinir yine vardir (HAT_DAKIKA_GUNLUK;
// sinirsizken degisken yoksa 600 dk/gun): hat kontrolsuz kosmasin, takilan bir tur gunluk butceyi tuketmeden once durdurulsun.
// uygula.yml matris isleri paralel kosar: bir uygula kosusunun dakikasi UYGULA_CARPAN ile carpilir (duvar saati x paralel is, ozel depoda faturalanan dakikaya yakin ust tahmin).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GUNLUK_OZEL = 50; // ozel depo
export const GUNLUK_SINIRSIZ = 600; // herkese acik depo: HAT_DAKIKA_GUNLUK verilmediyse
export const UYGULA_CARPAN = 3;

export const dakika = (r) => { const b = Date.parse(r.run_started_at || r.created_at); const e = Date.parse(r.updated_at); return Number.isFinite(b) && Number.isFinite(e) && e > b ? Math.max(1, Math.ceil((e - b) / 60000)) : 1; };
// matris isi olan kosular paralel is kadar dakika yer (uygula); digerleri duvar saati
export const agirlikli = (r, carpan = UYGULA_CARPAN) => dakika(r) * (r.name === 'uygula' ? carpan : 1);
export const gunlukVarsayilan = (sinirsiz) => (sinirsiz ? GUNLUK_SINIRSIZ : GUNLUK_OZEL);

export function butceHesapla({ runs, simdi = new Date(), aylik = 600, gunluk = GUNLUK_OZEL, tur = 40, sinirsiz = false, carpan = UYGULA_CARPAN }) {
  const ay = simdi.toISOString().slice(0, 7); const gun = simdi.toISOString().slice(0, 10);
  let ayK = 0; let gunK = 0;
  for (const r of runs) { if (r.status && r.status !== 'completed') continue; const t = String(r.run_started_at || r.created_at || ''); if (t.slice(0, 7) === ay) { const m = agirlikli(r, carpan); ayK += m; if (t.slice(0, 10) === gun) gunK += m; } }
  const ayKalan = sinirsiz ? Infinity : aylik - ayK; const gunKalan = gunluk - gunK;
  const sure = Math.min(tur, ayKalan, gunKalan);
  const neden = sure >= 8 ? (sinirsiz ? 'depo herkese acik: aylik sinir yok, gunluk ust sinir var' : '') : (ayKalan < 8 ? `aylik butce doldu (${ayK}/${aylik} dk)` : `gunluk butce doldu (${gunK}/${gunluk} dk)`);
  return { calis: sure >= 8, sure: Math.max(0, Math.floor(sure)), ayKullanilan: ayK, gunKullanilan: gunK, neden };
}

export async function kosular(repo, token, simdi = new Date()) {
  const since = `${simdi.toISOString().slice(0, 7)}-01`; const out = [];
  for (let sayfa = 1; sayfa <= 8; sayfa++) {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=100&page=${sayfa}&created=>=${since}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'peak-sites-engine' } });
    if (!r.ok) throw new Error(`kosular okunamadi: ${r.status}`);
    const j = await r.json(); out.push(...(j.workflow_runs || [])); if ((j.workflow_runs || []).length < 100) break;
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const repo = arg('--repo', process.env.GITHUB_REPOSITORY); const sinirsiz = process.env.HAT_DAKIKA_SINIRSIZ === 'true';
  const sayi = (v, d) => { const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : d; };
  let r;
  try { r = butceHesapla({ runs: await kosular(repo, process.env.GITHUB_TOKEN), aylik: sayi(process.env.HAT_DAKIKA_AYLIK, sayi(arg('--aylik'), 600)), gunluk: sayi(process.env.HAT_DAKIKA_GUNLUK, sayi(arg('--gunluk'), gunlukVarsayilan(sinirsiz))), tur: sayi(arg('--tur'), 40), sinirsiz }); }
  catch (e) { r = { calis: false, sure: 0, ayKullanilan: 0, gunKullanilan: 0, neden: `butce okunamadi (${String(e.message).slice(0, 60)}): guvenli tarafta durulur` }; }
  console.log(`butce: ay ${r.ayKullanilan} dk, gun ${r.gunKullanilan} dk, bu tur ${r.sure} dk${r.neden ? ` (${r.neden})` : ''}`);
  const out = `calis=${r.calis}\nsure=${r.sure}\n`; console.log(out.trim().replace('\n', ' '));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, out);
}
