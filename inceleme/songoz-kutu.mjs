// SON GOZ KUTUSU ARACI (koordinator, yerel; 12 Kas 2026).  Siki kapidan gecen restoran sayfalari bulutta "son goz kutusuna" (inceleme-kutusu dali, SON-GOZ-KUTUSU.json) duser.
// Bu arac kutudaki sayfalari 1440 ve 390 ekran goruntusuyle TEK bir HTML inceleme sayfasinda gosterir ve onay dosyalarini yazar.  Model, ag (kutu cekme disinda) ve tarayici yok:
// ekran goruntuleri bulut turunun siki kapida zaten cektigi dosyalardir.  Yalniz 'yayinla' onayi alan sayfa yayin paketine ve (RESTORAN_KUYRUK=acik ise) BEKLETILMIS kuyruk satirina gecer.
//   node inceleme/songoz-kutu.mjs cek   [--uzak <git adresi>] [--hedef calisma/songoz-kutu/kutu]        inceleme-kutusu dalini klonlar (varsayilan uzak: ozel veri deposu)
//   node inceleme/songoz-kutu.mjs liste --kutu <klasor> [--cikti calisma/songoz-kutu/inceleme.html] [--slug a,b]   tek HTML inceleme sayfasi (kendi kendine yeten)
//   node inceleme/songoz-kutu.mjs onay  --kutu <klasor> --dosya <onay.json>  | --yayinla a,b [--elendi c] [--gozden-gecir d] [--neden "..."]
//                                     [--cikti calisma/songoz-karar] [--push]
// Onay dosyasi (HTML sayfasinin "Onay dosyasini olustur" dugmesi de bunu uretir): { "kararlar": [ { "slug", "karar": "yayinla|gozden-gecir|elendi|duzelt", "neden", "gozlem": { "metin", "kanit" }?, "konuOzel"?, "icerik"? } ] }
// Cikti: <cikti>/karar/<parti>/<slug>.json (inceleme/ROUTINE-SONGOZ.md karar bicimi, inceleyen "son-goz").  --push: ozel veri deposu klonunda (--repo, varsayilan ../data) origin/main'den karar/songoz-<UTC yyyymmddHHMM> dali acar,
// karar dosyalarini commit eder ve iter; bu push veri deposundaki karar-tetik'i, o da motorun uygula.yml'ini baslatir (yalniz karar/songoz-* dalindaki yayinla yayina girer).  main, veri, inceleme-kutusu ve yayin-paketi'ne HICBIR sey yazilmaz.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { yasakVar, deger } from '../uyarla/lib/sozluk.mjs';

const J = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const atif = () => deger('atif', '');
// kutu ve karar dallari OZEL veri deposunda: varsayilan uzak adres ve yerel klon (motorun yaninda ../data)
export const VERI_URL = process.env.HAT_VERI_URL || `https://github.com/${process.env.HAT_VERI_DEPO || 'dorukctnn-rgb/peak-sites-data'}.git`;
export const VERI_KLON = process.env.HAT_VERI_KLON || path.resolve(KOK, '..', 'data');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- kutu okuma ----
// kutu klasoru -> [{ slug, parti, sablon, ad, ozet, bilgi, ekranlar }] (yalniz tur 'son-bakis'; SON-GOZ-KUTUSU.json yoksa BEKLEYEN.json)
export function kutuSayfalari(kutu, { slugs = null } = {}) {
  const liste = (J(path.join(kutu, 'BEKLEYEN.json'), {}).bekleyen || []).filter((x) => x.tur === 'son-bakis');
  const out = [];
  for (const x of liste) {
    if (slugs && !slugs.includes(x.slug)) continue;
    const d = path.join(kutu, x.slug); const ozet = J(path.join(d, 'ozet.json')); const bilgi = J(path.join(d, 'bilgi.json'), {});
    if (!ozet) continue;
    out.push({ slug: x.slug, parti: x.parti || 'sonGoz', sablon: x.sablon || ozet.sablon || null, ad: bilgi.ad || x.slug, sehir: bilgi.sehir || null, bolge: bilgi.bolge || null, dir: d, ozet, bilgi });
  }
  return out;
}

// ---- karar dosyasi kurma ve denetim ----
export const GOZLEM_MIN = 30;
export function gozlemDenetle(g) {
  const m = String((g && g.metin) || '');
  if (m.length < GOZLEM_MIN) return `gozlem cumlesi en az ${GOZLEM_MIN} karakter olmali`;
  if (/\d/.test(m)) return 'gozlem cumlesi rakamsiz olmali';
  if (!String((g && g.kanit) || '').trim()) return 'gozlem kaniti (hangi ekran) yok';
  return null;
}
// sayfa (kutuSayfalari ogesi) + onay ({ slug, karar, neden, gozlem?, konuOzel?, icerik? }) -> { karar } | { hata }
export function kararKur(sayfa, onay) {
  const k = onay.karar; const neden = String(onay.neden || '').trim();
  if (!['yayinla', 'gozden-gecir', 'elendi', 'duzelt'].includes(k)) return { hata: `${sayfa.slug}: bilinmeyen karar "${k}"` };
  const ik = sayfa.ozet.icerikKarari || {};
  for (const [ad, m] of [['neden', neden], ['gozlem', (onay.gozlem && onay.gozlem.metin) || ''], ['konuOzel', onay.konuOzel || '']]) if (yasakVar('kisaltma', m)) return { hata: `${sayfa.slug}: ${ad} icinde yasak kisaltma gecemez` };
  if (k === 'yayinla') {
    if (!sayfa.ozet.icerikHash) return { hata: `${sayfa.slug}: ozet.json icerikHash yok` };
    if (!sayfa.ozet.kapi || sayfa.ozet.kapi.status !== 'hazir') return { hata: `${sayfa.slug}: siki kapi hazir degil, yayinla verilemez` };
    // koordinatorun kendi cumlesi varsa kanit onun dogrulamasidir (eski site ekranlari); yoksa icerik turu cumlesi ve kendi kaniti
    const yeni = !!(onay.gozlem && onay.gozlem.metin);
    const g = yeni ? { metin: onay.gozlem.metin, kanit: onay.gozlem.kanit || 'once-390.jpg ve once-1440.jpg: koordinator dogruladi' } : { metin: (ik.gozlem && ik.gozlem.metin) || '', kanit: (ik.gozlem && ik.gozlem.kanit) || '' };
    const e = gozlemDenetle(g); if (e) return { hata: `${sayfa.slug}: ${e}` };
    return { karar: { tur: 'son', karar: 'yayinla', inceleyen: 'son-goz', icerikHash: sayfa.ozet.icerikHash, neden: neden || 'Coordinator batch review: hero, menu and the 1440 and 390 screens checked by eye.', gozlem: g, konuOzel: onay.konuOzel || ik.konuOzel || null, karsilastirma: onay.karsilastirma || { hero: 'ayni', menu: 'dogru', son: 'clean' }, icerik: null } };
  }
  if (!neden) return { hata: `${sayfa.slug}: ${k} icin neden yazilmali` };
  if (k === 'duzelt') {
    if (!onay.icerik || onay.icerik.tur !== 'icerik') return { hata: `${sayfa.slug}: duzelt icin TAM icerik karari (tur "icerik") gerekli; node uyarla/restoran-icerik-kontrol.mjs ile denetleyin` };
    return { karar: { tur: 'son', karar: 'duzelt', inceleyen: 'son-goz', icerikHash: sayfa.ozet.icerikHash, neden, karsilastirma: onay.karsilastirma || { hero: 'ayni', menu: 'dogru', son: neden }, icerik: { ...onay.icerik, inceleyen: 'son-goz', karar: 'icerik' } } };
  }
  return { karar: { tur: 'son', karar: k, inceleyen: 'son-goz', icerikHash: sayfa.ozet.icerikHash || null, neden, karsilastirma: onay.karsilastirma || { hero: 'ayni', menu: 'dogru', son: neden }, icerik: null } };
}

// onaylar ([{ slug, karar, ... }]) -> karar dosyalari <cikti>/karar/<parti>/<slug>.json.  Hata varsa HICBIR dosya yazilmaz (kismi onay olmaz).
export function onayYaz({ kutu, onaylar, cikti, parti = null }) {
  const sayfalar = new Map(kutuSayfalari(kutu).map((s) => [s.slug, s])); const hata = []; const yazilacak = [];
  const gordum = new Set();
  for (const o of onaylar) {
    if (gordum.has(o.slug)) { hata.push(`${o.slug}: iki kez onaylanmis`); continue; } gordum.add(o.slug);
    const s = sayfalar.get(o.slug); if (!s) { hata.push(`${o.slug}: son goz kutusunda yok (son-bakis paketi ya da ozet.json yok)`); continue; }
    const r = kararKur(s, o); if (r.hata) hata.push(r.hata); else yazilacak.push({ s, karar: r.karar });
  }
  if (hata.length) return { yazilan: [], hata };
  const yazilan = [];
  for (const { s, karar } of yazilacak) { const f = path.join(cikti, 'karar', parti || s.parti, `${s.slug}.json`); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(karar, null, 1)); yazilan.push({ slug: s.slug, karar: karar.karar, dosya: f }); }
  return { yazilan, hata: [] };
}

// ---- HTML inceleme sayfasi ----
async function uri(dosya, { w, q = 72 } = {}) {
  if (!fs.existsSync(dosya)) return null;
  try { const { sharp } = await import('../uyarla/lib/gorsel.mjs'); const b = await sharp(dosya).resize({ width: w, withoutEnlargement: true }).jpeg({ quality: q, mozjpeg: true }).toBuffer(); return `data:image/jpeg;base64,${b.toString('base64')}`; } catch { return null; }
}
const menuIlk = (k) => (((k.menu && k.menu.kalemler) || []).slice(0, 8)).map((x) => `${x.n} ${x.p}`);
export async function incelemeHtml(sayfalar, { baslik = 'son goz kutusu' } = {}) {
  const kartlar = [];
  for (const [i, s] of sayfalar.entries()) {
    const ik = s.ozet.icerikKarari || {}; const kapi = s.ozet.kapi || {}; const g = ik.gozlem || {};
    const [a1440, a390, tam1440, tam390, once390, once1440] = await Promise.all([
      uri(path.join(s.dir, 'ekran-1440.jpg'), { w: 1200, q: 70 }), uri(path.join(s.dir, 'ekran-390.jpg'), { w: 390, q: 74 }),
      uri(path.join(s.dir, 'ekran-1440-tam.jpg'), { w: 800, q: 60 }), uri(path.join(s.dir, 'ekran-390-tam.jpg'), { w: 390, q: 62 }),
      uri(path.join(s.dir, 'once-390.jpg'), { w: 390, q: 66 }), uri(path.join(s.dir, 'once-1440.jpg'), { w: 800, q: 62 }),
    ]);
    const img = (u, ad, sinif = '') => (u ? `<img class="${sinif}" loading="lazy" src="${u}" alt="${esc(ad)}">` : `<p class="yok">${esc(ad)}: dosya yok</p>`);
    kartlar.push(`<article class="kart" data-slug="${esc(s.slug)}" id="k${i}">
  <header><h2>${esc(s.ad)}</h2><p class="alt"><code>${esc(s.slug)}</code> · şablon <b>${esc(s.sablon || '?')}</b>${s.sehir ? ` · ${esc(s.sehir)}` : ''}${s.bolge ? ` ${esc(s.bolge)}` : ''} · sayfa <code>${esc(s.ozet.sayfa || '-')}</code></p></header>
  <div class="ekranlar"><figure class="b1440"><figcaption>1440, ilk ekran</figcaption>${img(a1440, '1440 ilk ekran')}</figure><figure class="b390"><figcaption>390, ilk ekran</figcaption>${img(a390, '390 ilk ekran')}</figure></div>
  <div class="bilgi">
    <p><b>Kahraman:</b> ${esc((ik.hero && ik.hero.id) || '-')} — ${esc((ik.hero && ik.hero.gerekce) || '')}</p>
    <p><b>icerik turu gözlemi:</b> ${esc(g.metin || '-')} <small>(${esc(g.kanit || '')})</small></p>
    <p><b>Menü:</b> ${esc(menuIlk(ik).join(' · ') || '-')} <small>(${esc(String(kapi.menuKalem ?? ((ik.menu && ik.menu.kalemler) || []).length))} fiyatlı kalem)</small></p>
    <p><b>Eylem:</b> ${esc(JSON.stringify(kapi.eylem || ik.eylem || null))} · <b>Uyarılar:</b> ${esc((kapi.warnings || []).slice(0, 4).join(' | ') || 'yok')}</p>
    <p><b>Hash:</b> <code>${esc(s.ozet.icerikHash || '-')}</code> · kapı <b>${esc(kapi.status || '?')}</b></p>
  </div>
  <details><summary>Tam sayfalar ve eski site</summary><div class="tam">${img(tam1440, '1440 tam sayfa')}${img(tam390, '390 tam sayfa')}${img(once1440, 'eski site 1440')}${img(once390, 'eski site 390')}</div></details>
  <fieldset class="karar" data-slug="${esc(s.slug)}"><legend>Karar</legend>
    ${['yayinla', 'gozden-gecir', 'elendi', 'duzelt'].map((k) => `<label><input type="radio" name="k${i}" value="${k}"> ${k}</label>`).join(' ')}
    <input class="neden" type="text" placeholder="neden (elendi, gözden geçir, düzelt için zorunlu)" aria-label="neden">
    <textarea class="gozlem" rows="2" placeholder="gözlem cümlesini değiştirmek için (boş = icerik turu cümlesi; rakamsız, en az ${GOZLEM_MIN} karakter)" aria-label="gözlem"></textarea>
  </fieldset>
</article>`);
  }
  const veri = JSON.stringify(sayfalar.map((s) => s.slug)).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(baslik)}</title>
<style>
:root{--bg:#f6f5f2;--ink:#1d1c1a;--mut:#6b675f;--card:#fff;--line:#dcd8cf;--acc:#14532d;--bad:#8a1c1c}
@media (prefers-color-scheme:dark){:root{--bg:#161513;--ink:#ece9e2;--mut:#a39e93;--card:#1f1e1b;--line:#33312c;--acc:#7ed39a;--bad:#f08a8a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{width:100%;padding:16px clamp(12px,2vw,32px) 120px}h1{font-size:22px;margin:8px 0 4px}.ust{color:var(--mut);margin:0 0 16px}
.kart{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 20px}.kart h2{margin:0;font-size:19px}.alt{margin:2px 0 12px;color:var(--mut)}
.ekranlar{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:16px;align-items:start}figure{margin:0}figcaption{font-size:12px;color:var(--mut);margin-bottom:4px}
img{display:block;max-width:100%;height:auto;border:1px solid var(--line);border-radius:8px}.tam{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:10px}
.bilgi p{margin:6px 0}small{color:var(--mut)}code{font:12.5px ui-monospace,Consolas,monospace}.yok{color:var(--bad)}
.karar{border:1px solid var(--line);border-radius:8px;margin:14px 0 0;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center}.karar .neden{flex:1 1 280px;min-width:200px}.karar .gozlem{flex:1 1 100%}
input[type=text],textarea{font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:6px;padding:6px 8px}
.cubuk{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px clamp(12px,2vw,32px);display:flex;gap:12px;align-items:center;flex-wrap:wrap}
button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--acc);background:var(--acc);color:#fff;cursor:pointer}@media (prefers-color-scheme:dark){button{color:#0d1a12}}
textarea.cikti{width:100%;min-height:140px;font:12.5px ui-monospace,Consolas,monospace;margin-top:12px}
@media (max-width:900px){.ekranlar{grid-template-columns:1fr}}
</style></head><body><main>
<h1>${esc(baslik)}: ${sayfalar.length} sayfa</h1>
<p class="ust">Her sayfa için 1440 ve 390 ilk ekranı, kahraman, menü ve gözlem. Karar seçin, sonra alttaki düğmeyle onay dosyasını oluşturun ve <code>node inceleme/songoz-kutu.mjs onay --kutu &lt;klasör&gt; --dosya songoz-onay.json --push</code> çalıştırın. Yalnız <b>yayinla</b> seçilen sayfalar yayın paketine geçer.</p>
${kartlar.join('\n')}
<textarea class="cikti" id="cikti" readonly hidden></textarea>
</main>
<div class="cubuk"><span id="say">0 karar</span><button id="uret" type="button">Onay dosyasını oluştur</button><a id="indir" download="songoz-onay.json" hidden>songoz-onay.json indir</a></div>
<script>
const SLUGS = ${veri};
document.getElementById('uret').addEventListener('click', () => {
  const kararlar = []; let eksik = 0;
  for (const f of document.querySelectorAll('fieldset.karar')) {
    const r = f.querySelector('input[type=radio]:checked'); if (!r) continue;
    const neden = f.querySelector('.neden').value.trim(); const g = f.querySelector('.gozlem').value.trim();
    if (r.value !== 'yayinla' && !neden) { eksik++; f.style.outline = '2px solid #c33'; continue; } f.style.outline = '';
    const o = { slug: f.dataset.slug, karar: r.value }; if (neden) o.neden = neden; if (g) o.gozlem = { metin: g, kanit: 'ekran-1440.jpg ve ekran-390.jpg: koordinator yazdi' };
    kararlar.push(o);
  }
  const t = document.getElementById('cikti'); t.hidden = false;
  t.value = JSON.stringify({ olusturuldu: new Date().toISOString(), kararlar }, null, 1);
  document.getElementById('say').textContent = kararlar.length + ' karar' + (eksik ? ', ' + eksik + ' kararda neden eksik' : '') + ' / ' + SLUGS.length + ' sayfa';
  const a = document.getElementById('indir'); a.href = URL.createObjectURL(new Blob([t.value], { type: 'application/json' })); a.hidden = false;
});
</script></body></html>`;
}

// ---- git: kutuyu cek, onay dalini yaz ----
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
export function kutuCek({ uzak = null, hedef, cwd = KOK }) {
  const url = uzak || VERI_URL; void cwd;
  fs.rmSync(hedef, { recursive: true, force: true }); fs.mkdirSync(path.dirname(hedef), { recursive: true });
  git(path.dirname(hedef), 'clone', '-q', '--depth', '1', '--branch', 'inceleme-kutusu', url, hedef);
  return hedef;
}
export const dalAdi = (simdi = new Date()) => `karar/songoz-${simdi.toISOString().replace(/\D/g, '').slice(0, 12)}`;
// cikti/karar -> yeni dal (origin/main'den), commit, push.  Kod deposunun calisma agacina dokunmaz (gecici worktree).
export function dalYaz({ cikti, repo = VERI_KLON, simdi = new Date(), uzakAna = 'origin/main', mesaj = null }) {
  const dal = dalAdi(simdi); const dosyalar = []; const gez = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) gez(p); else dosyalar.push(path.relative(path.join(cikti, 'karar'), p)); } };
  if (!fs.existsSync(path.join(cikti, 'karar'))) throw new Error('karar klasoru yok');
  gez(path.join(cikti, 'karar')); if (!dosyalar.length) throw new Error('karar dosyasi yok');
  const yayinla = dosyalar.filter((f) => (J(path.join(cikti, 'karar', f), {}) || {}).karar === 'yayinla').length;
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'songoz-dal-'));
  try {
    git(repo, 'fetch', '-q', 'origin', 'main');
    git(repo, 'worktree', 'add', '-q', '-b', dal, wt, uzakAna);
    fs.cpSync(path.join(cikti, 'karar'), path.join(wt, 'karar'), { recursive: true });
    git(wt, 'add', 'karar');
    git(wt, '-c', 'user.name=peak-songoz-kutu', '-c', 'user.email=songoz-kutu@peakappsstudio.com', 'commit', '-q', '-m', mesaj || `sonGoz: ${dosyalar.length} isletme (${yayinla} yayinla)\n\n${atif()}`);
    git(wt, 'push', '-q', '-u', 'origin', dal);
  } finally { try { git(repo, 'worktree', 'remove', '--force', wt); } catch { fs.rmSync(wt, { recursive: true, force: true }); } try { git(repo, 'branch', '-D', dal); } catch { /* dal yoksa */ } }
  return { dal, dosya: dosyalar.length, yayinla };
}

// ---- komut satiri ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && !String(process.argv[i + 1]).startsWith('--') ? process.argv[i + 1] : d; };
  const liste = (k) => String(arg(k, '')).split(',').map((x) => x.trim()).filter(Boolean);
  const cmd = process.argv[2];
  if (cmd === 'cek') {
    const h = kutuCek({ uzak: arg('--uzak'), hedef: path.resolve(arg('--hedef', 'calisma/songoz-kutu/kutu')) }); console.log(`kutu: ${h}`);
  } else if (cmd === 'liste') {
    const kutu = path.resolve(arg('--kutu', 'calisma/songoz-kutu/kutu')); const sy = kutuSayfalari(kutu, { slugs: liste('--slug').length ? liste('--slug') : null });
    const f = path.resolve(arg('--cikti', 'calisma/songoz-kutu/inceleme.html')); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, await incelemeHtml(sy)); console.log(`inceleme sayfasi: ${f} (${sy.length} sayfa, ${(fs.statSync(f).size / 1048576).toFixed(1)} MB)`);
  } else if (cmd === 'onay') {
    const kutu = path.resolve(arg('--kutu', 'calisma/songoz-kutu/kutu')); const cikti = path.resolve(arg('--cikti', 'calisma/songoz-karar'));
    let onaylar = [];
    if (arg('--dosya')) onaylar = (J(path.resolve(arg('--dosya')), {}).kararlar) || [];
    const neden = arg('--neden', '');
    for (const [bayrak, karar] of [['--yayinla', 'yayinla'], ['--elendi', 'elendi'], ['--gozden-gecir', 'gozden-gecir']]) for (const slug of liste(bayrak)) onaylar.push({ slug, karar, ...(neden ? { neden } : {}) });
    if (!onaylar.length) { console.error('onay yok: --dosya ya da --yayinla/--elendi/--gozden-gecir verin'); process.exit(2); }
    fs.rmSync(path.join(cikti, 'karar'), { recursive: true, force: true });
    const r = onayYaz({ kutu, onaylar, cikti });
    if (r.hata.length) { console.error(`HATA (hicbir dosya yazilmadi):\n- ${r.hata.join('\n- ')}`); process.exit(1); }
    console.log(`karar dosyalari: ${r.yazilan.map((x) => `${x.slug}=${x.karar}`).join(', ')} -> ${path.join(cikti, 'karar')}`);
    if (process.argv.includes('--push')) { const d = dalYaz({ cikti, repo: path.resolve(arg('--repo', VERI_KLON)) }); console.log(`push: ${d.dal} (${d.dosya} dosya, ${d.yayinla} yayinla); veri deposundaki karar-tetik uygula.yml'i baslatir`); }
    else console.log('push yapilmadi (--push ile karar/songoz-<ts> dali acilir; elle: karar/ klasorunu yeni dalda commit edip itin)');
  } else { console.error('kullanim: node inceleme/songoz-kutu.mjs cek|liste|onay ...'); process.exit(2); }
}
