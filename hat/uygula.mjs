// HAT 3. ADIM: INCELEME KARARLARINI UYGULA.  icerik turu turunun yazdigi karar/<parti>/<slug>.json dosyalari -> elle kaydi (uyarla/data/elle/hat.json)
// -> "hazir" olanlar icin uret + kapi yeniden -> son liste + mail onizleme gorseli.  Model yok.
//   node hat/uygula.mjs --karar <dir icinde karar/> [--son calisma/son/liste.json]
// Kural: bir isletme ancak kapi.status === 'hazir' VE karar.karar === 'hazir' ise yayina ve kuyruga gider.
// Restoran ailesi (v5, burger, burrito, pizza; 11 Kas): karar.tur 'icerik' (icerik turu) -> uret + siki kapi -> 'son-bakis'; karar.tur 'son' (YALNIZ son goz,
// karar/songoz-* dali) 'yayinla' -> yayin listesi.  son goz onayi olmayan restoran sayfasi listeye ve kuyruga girmez (uyarla/restoran-uygula.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharp } from '../uyarla/lib/gorsel.mjs';
import { kararToElle } from '../uyarla/inceleme-uygula.mjs';
import { VERI, DEMO } from '../uyarla/uret.mjs';
import { KOK } from '../uyarla/lib/yol.mjs';
import { parcaSec, parcaCoz } from './parca.mjs';
import { eskiEtiketCoz } from './etiket.mjs';

const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export const ELLE_HAT = path.join(KOK, 'uyarla', 'data', 'elle', 'hat.json');

export function kararlariOku(dir) {
  const out = []; const kd = path.join(dir, 'karar');
  for (const p of fs.existsSync(kd) ? fs.readdirSync(kd) : []) {
    const pd = path.join(kd, p); if (!fs.statSync(pd).isDirectory()) continue;
    for (const f of fs.readdirSync(pd).filter((x) => x.endsWith('.json'))) {
      let k = null; try { k = eskiEtiketCoz(J(path.join(pd, f))); } catch { /* bozuk */ }
      out.push({ parti: p, slug: f.replace(/\.json$/, ''), k });
    }
  }
  return out;
}

// isletme adi icin ek kaynaklar (12 Kas 2026, hat mail sesi): sitenin basligi (<title>), og:title ve secilen logonun alt metni; hat/kuyruk.mjs mailAdi sitenin adi, bunlar, OSM adi sirasiyla dener.
// Yalniz dolu olanlar yazilir; bos ise alan hic olmaz (eski kayitlar zaten bunsuz).
export function adAdaylariOku(R) {
  const o = {}; const al = (k, v) => { const t = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 160); if (t) o[k] = t; };
  al('baslik', R && R.slogan && R.slogan.title); al('ogTitle', R && R.slogan && R.slogan.ogTitle); al('logoAlt', R && R.logoAlt);
  return Object.keys(o).length ? o : undefined;
}

// maildeki "fiyatlariniz" cumlesi yalniz sayfada GERCEKTEN fiyat varsa: konaklamada en az bir odanin fiyati, guzellikte en az 4 fiyatli hizmet
export function fiyatVarMi(ur) {
  if (!ur) return false;
  if (ur.sektor === 'konaklama') return !!(ur.kon && ur.kon.fromP);
  if (ur.sektor === 'guzellik') return (ur.menuItems || 0) >= 4;
  return !!(ur.menuItems);
}

// mail onizlemesi: sayfanin 1440 ilk ekrani, 640 px genis JPEG (<= 300 KB, gercek JPEG)
export async function onizleme(slug, { veri = VERI, hedef }) {
  const src = path.join(veri, slug, 'sonra-1440.jpg'); if (!fs.existsSync(src)) return null;
  for (const q of [82, 74, 66, 58]) {
    const buf = await sharp(src).resize({ width: 640 }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    if (buf.length <= 290 * 1024) { fs.mkdirSync(path.dirname(hedef), { recursive: true }); fs.writeFileSync(hedef, buf); return { file: hedef, kb: Math.round(buf.length / 1024) }; }
  }
  return null;
}

// parca: 'i/n' (uygula.yml matrisi: kararlar n parcaya bolunur, bu is yalniz i. parcayi uygular); elleDelta: bu parcanin elle kaydi degisiklikleri ({slug: kayit | null}) doldurulur
export async function uygula({ kararDir, veri = VERI, out = DEMO, onizDir, kutuDir = null, sonGozDal = false, polite = null, parca = null, elleDelta = null, log = console.log }) {
  let hepsi = kararlariOku(kararDir); const sonuc = [];
  const pc = parca ? parcaCoz(parca) : null; if (parca && !pc) throw new Error(`parca i/n bicimde olmali: ${parca}`);
  if (pc) hepsi = parcaSec(hepsi, pc.i, pc.n);
  const restoran = hepsi.filter((x) => x.k && (x.k.tur === 'icerik' || x.k.tur === 'son'));
  const list = hepsi.filter((x) => !restoran.includes(x));
  if (restoran.length) sonuc.push(...(await restoranUygula({ list: restoran, veri, out, onizDir, kutuDir, sonGozDal, polite, log })));
  const elle = fs.existsSync(ELLE_HAT) ? J(ELLE_HAT) : {};
  const tekrar = [];
  for (const x of list) {
    const cf = path.join(veri, x.slug, 'cikarici.json');
    if (!fs.existsSync(cf)) { sonuc.push({ slug: x.slug, parti: x.parti, durum: 'veri-yok', neden: 'cikarici.json bulunamadi (onbellek silinmis): yeniden uretilecek' }); continue; }
    const R = J(cf); const r = kararToElle(x.k, { name: R.name && R.name.n, photoIds: (R.photos || []).map((p) => p.id) });
    if (!r.ok) { sonuc.push({ slug: x.slug, parti: x.parti, durum: 'karar-hatali', neden: r.why }); continue; }
    if (x.k.karar !== 'hazir') { sonuc.push({ slug: x.slug, parti: x.parti, durum: x.k.karar, neden: String(x.k.neden || '').slice(0, 200) }); continue; }
    if (r.elle) elle[x.slug] = r.elle; else delete elle[x.slug];
    if (elleDelta) elleDelta[x.slug] = r.elle || null;
    tekrar.push(x);
  }
  fs.mkdirSync(path.dirname(ELLE_HAT), { recursive: true });
  fs.writeFileSync(ELLE_HAT, JSON.stringify({ _not: 'hat/uygula.mjs yazar: icerik turu inceleme kararlarindan (karar/<parti>/<slug>.json). Elle duzenlenmez.', ...Object.fromEntries(Object.entries(elle).filter(([k]) => k !== '_not')) }, null, 1));
  if (tekrar.length) {
    const { uret } = await import('../uyarla/uret.mjs'); const { kapi } = await import('../uyarla/kapi.mjs');
    const { openBrowser } = await import('../uyarla/lib/ziyaret.mjs'); const { sunucu } = await import('../uyarla/lib/sunucu.mjs');
    const srv = await sunucu(out); const browser = await openBrowser();
    try {
      for (const x of tekrar) {
        try {
          await uret(x.slug, { veri, out, log: () => {} });
          fs.rmSync(path.join(veri, x.slug, 'kapi.json'), { force: true });
          const k = await kapi(x.slug, { browser, base: srv.url, out, veri, log: () => {} });
          if (k.status !== 'hazir') { sonuc.push({ slug: x.slug, parti: x.parti, durum: 'gozden-gecir', neden: `kapi (inceleme sonrasi): ${k.reasons.slice(0, 2).join('; ')}` }); continue; }
          const ur = J(path.join(veri, x.slug, 'uret.json'));
          const on = await onizleme(x.slug, { veri, hedef: path.join(onizDir, `${x.slug}.jpg`) });
          if (!on) { sonuc.push({ slug: x.slug, parti: x.parti, durum: 'gozden-gecir', neden: 'onizleme gorseli uretilemedi' }); continue; }
          const R2 = J(path.join(veri, x.slug, 'cikarici.json'));
          sonuc.push({ slug: x.slug, leadId: R2.lead && R2.lead.id, ad: R2.name && R2.name.n, adAdaylari: adAdaylariOku(R2), parti: x.parti, durum: 'hazir', page: path.dirname(ur.page), sektor: ur.sektor, fiyatVar: fiyatVarMi(ur), onizleme: on.file, neden: String(x.k.neden || '').slice(0, 200) });
          log(`hazir: ${x.slug} -> ${path.dirname(ur.page)}`);
        } catch (e) { sonuc.push({ slug: x.slug, parti: x.parti, durum: 'gozden-gecir', neden: `hata: ${String(e.message).slice(0, 120)}` }); }
      }
    } finally { await browser.close().catch(() => {}); await srv.close(); }
  }
  return sonuc;
}

// restoran kararlari: tek tarayici, tek yerel sunucu; ag yalniz secilen kahraman karesinin buyuk surumu icin (Polite, robots.txt)
export async function restoranUygula({ list, veri, out, onizDir, kutuDir, sonGozDal, polite, log = console.log }) {
  const { icerikUygula, sonUygula } = await import('../uyarla/restoran-uygula.mjs');
  const { openBrowser } = await import('../uyarla/lib/ziyaret.mjs'); const { sunucu } = await import('../uyarla/lib/sunucu.mjs');
  let P = polite; if (!P) { const { Polite } = await import('../uyarla/v2lib/polite.mjs'); P = new Polite({ gapMs: 1100, hostGapMs: 1800, timeoutMs: 60000 }); }
  const getir = async (u) => { const r = await P.get(u, { maxBytes: 40_000_000, accept: 'image/*', binary: true }); return r.ok && r.buf ? r : null; };
  const srv = await sunucu(out); const browser = await openBrowser(); const sonuc = [];
  try {
    for (const x of list) {
      const paketDir = kutuDir ? path.join(kutuDir, x.slug) : path.join(veri, x.slug, x.k.tur === 'son' ? 'son' : 'paket');
      try {
        const r = x.k.tur === 'icerik'
          ? await icerikUygula(x.slug, x.k, { veri, out, browser, base: srv.url, getir, paketDir, log: () => {} })
          : await sonUygula(x.slug, x.k, { veri, out, browser, base: srv.url, getir, paketDir, onizDir, sonGozDal, log: () => {} });
        sonuc.push({ ...r, parti: x.parti, tur: x.k.tur, inceleyen: x.k.inceleyen || null });
        log(`${x.k.tur} ${x.slug}: ${r.durum}${r.neden ? ' <- ' + String(r.neden).slice(0, 140) : ''}`);
      } catch (e) { sonuc.push({ slug: x.slug, parti: x.parti, tur: x.k.tur, durum: 'gozden-gecir', neden: `hata: ${String(e.message).slice(0, 140)}` }); }
    }
  } finally { await browser.close().catch(() => {}); await srv.close(); }
  return sonuc;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const dal = arg('--dal', process.env.GITHUB_REF_NAME || '');
  const elleDelta = {};
  const s = await uygula({ kararDir: path.resolve(arg('--karar', '.')), onizDir: path.resolve(arg('--oniz', 'calisma/onizleme')), kutuDir: arg('--kutu') ? path.resolve(arg('--kutu')) : null, sonGozDal: /^karar\/songoz-/.test(dal), parca: arg('--parca') || null, elleDelta });
  if (arg('--elle-delta')) { const ed = path.resolve(arg('--elle-delta')); fs.mkdirSync(path.dirname(ed), { recursive: true }); fs.writeFileSync(ed, JSON.stringify(elleDelta, null, 1)); }
  const f = path.resolve(arg('--son', 'calisma/son/liste.json')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(s, null, 1));
  const by = s.reduce((m, x) => { m[x.durum] = (m[x.durum] || 0) + 1; return m; }, {});
  fs.writeFileSync(path.join(path.dirname(f), 'son-bakis.txt'), s.filter((x) => x.durum === 'son-bakis').map((x) => x.slug).join(','));
  console.log(`UYGULANDI ${JSON.stringify(by)} -> ${f}`);
}
