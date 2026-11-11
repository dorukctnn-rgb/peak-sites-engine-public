// RESTORAN KARARLARINI UYGULA (11 Kas 2026).  Iki inceleme asamasi (Doruk 11 Kas: "icerik turu yapamayacaksa sen yap!"):
//   1. icerik karari (tur "icerik", genellikle icerik turu): kahraman karesi, fiyatli menu, slogan ve bolum metinleri -> icerik.json -> uret (v5 ya da kategori)
//      -> siki kapi (restoran-kapi.mjs) -> gecerse "son-bakis" paketi (1440/1920/390 ekranlari + adaylar + menu kaynagi), gecmezse gozden-gecir.
//   2. son karar (tur "son", YALNIZ son goz, karar/songoz-* dalindan): kahramani, menuyu ve uc ekrani gozle dogrular.  "yayinla" -> yayin listesi + mail onizlemesi;
//      "duzelt" -> son gozun tam icerik karariyla yeniden uretim, sonra yine son-bakis (en cok 2 kez); "gozden-gecir"/"elendi" kayit.
// Hicbir restoran sayfasi son gozun "yayinla" karari olmadan yayin listesine girmez ve kuyruk satiri olusmaz.  icerik turu ile son goz secimleri yan yana kaydedilir
// (<veri>/<slug>/karsilastirma.json): kahraman karesi, menu, son inceleme.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { sharp } from './lib/gorsel.mjs';
import { denetle, kayitKur, baglam } from './restoran-icerik.mjs';
import { heroDosyalari } from './lib/hero-sec.mjs';
import { restoranKapi } from './restoran-kapi.mjs';

const J = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const W = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
const kopya = (src, dst) => { if (!fs.existsSync(src)) return; const st = fs.statSync(src); if (st.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const e of fs.readdirSync(src)) kopya(path.join(src, e), path.join(dst, e)); } else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); } };
export const icerikHash = (dir) => { try { return crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, 'icerik.json'))).digest('hex').slice(0, 12); } catch { return null; } };

// mail onizlemesi: yeni sayfanin TELEFON ilk ekrani, 60-120 KB statik JPEG (maile gomulur; ek dosya degil; GIF/video yok)
export async function telefonOnizleme(src, hedef) {
  if (!fs.existsSync(src)) return null;
  let best = null;
  for (const [w, q] of [[360, 80], [360, 72], [340, 70], [320, 66], [360, 86], [390, 88], [390, 92]]) {
    const buf = await sharp(src).resize({ width: w }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    const kb = buf.length / 1024;
    if (kb >= 60 && kb <= 120) { best = { buf, w, q, kb }; break; }
    if (!best || Math.abs(kb - 90) < Math.abs(best.kb - 90)) best = { buf, w, q, kb };
  }
  fs.mkdirSync(path.dirname(hedef), { recursive: true }); fs.writeFileSync(hedef, best.buf);
  return { file: hedef, kb: Math.round(best.kb), w: best.w };
}

// kapi.json / uret.json 'page' degeri index.html DOSYASIdir; sonuc satirlarinda (yayinla.mjs, kuyruk.mjs, teslim) sayfa KLASORU beklenir (r/<slug>-<kod>)
export const sayfaKlasoru = (p) => String(p || '').replace(/\/index\.html$/, '').replace(/\/$/, '');

function karsilastirmaYaz(dir, alan, deger) {
  const f = path.join(dir, 'karsilastirma.json'); const k = J(f, {}); k[alan] = { ...(k[alan] || {}), ...deger, at: new Date().toISOString() }; W(f, k); return k;
}
const ozetKarar = (k) => ({ hero: k.hero && k.hero.id, heroGerekce: k.hero && k.hero.gerekce, menuKalem: k.menu && (k.menu.kalemler || []).length, menuKaynak: k.menu && k.menu.kaynak, menuIlk3: k.menu && (k.menu.kalemler || []).slice(0, 3).map((x) => `${x.n} ${x.p}`), slogan: k.sablon === 'v5' ? k.icerik && k.icerik.slogan && k.icerik.slogan.text : k.icerik && k.icerik.aday && (k.icerik.aday[k.icerik.sec || 0] || {}).text, gozlem: k.gozlem && k.gozlem.metin });

// k: icerik karari; paketDir: inceleme kutusundaki <slug>/ klasoru (bilgi.json, metin.txt, menu-kaynak/, hero-aday/)
export async function icerikUygula(slug, k, { veri, out, browser, base, getir = null, paketDir, log = () => {} }) {
  const dir = path.join(veri, slug); const R = J(path.join(dir, 'cikarici.json'));
  if (!R) return { slug, durum: 'veri-yok', neden: 'cikarici.json yok' };
  if (k.karar !== 'icerik') return { slug, durum: k.karar, neden: String(k.neden || '').slice(0, 200) };
  const H = denetle(k, baglam(paketDir, R));
  W(path.join(dir, `inceleme-${k.inceleyen || 'bilinmiyor'}.json`), k);
  karsilastirmaYaz(dir, k.inceleyen === 'son-goz' ? 'sonGozIcerik' : 'icerikTuru', { ...ozetKarar(k), denetimHata: H });
  if (H.length) return { slug, durum: 'gozden-gecir', neden: `icerik denetimi (${H.length}): ${H.slice(0, 3).join('; ')}`, hatalar: H };
  const kayit = kayitKur(k);
  W(path.join(dir, 'icerik.json'), { _not: `inceleme karari (${k.inceleyen}) ile yazildi; elle duzenlenmez`, ...kayit });
  const HA = J(path.join(dir, 'hero-adaylar.json'), { adaylar: [] });
  if (k.sablon === 'v5') await heroDosyalari({ ...R, slug }, { dir, id: k.hero.id, getir, adaylar: HA.adaylar, inceleme: { inceleyen: k.inceleyen, gerekce: k.hero.gerekce, reddedilen: k.hero.reddedilen || [] }, log });
  else W(path.join(dir, 'hero-secim.json'), { slug, adaylar: HA.adaylar, secilen: { id: String(k.hero.id), gozle: `${k.inceleyen} secti: ${k.hero.gerekce}`, reddedilen: k.hero.reddedilen || [], puanlayicininIlki: HA.adaylar[0] ? HA.adaylar[0].id : null }, duzen: 'cerceve (kategori sablonu)', at: new Date().toISOString() });
  try {
    if (k.sablon === 'v5') { const { uretV5 } = await import('./uret-v5.mjs'); const r = await uretV5(slug, { veri, out, log }); if (r.status !== 'uretildi') return { slug, durum: 'gozden-gecir', neden: `uretim: ${(r.reasons || []).join('; ')}` }; }
    else { const { tamamla } = await import('./kategori-tamamla.mjs'); const { uretKategori } = await import('./uret-kategori.mjs'); tamamla(slug, { veri }); await uretKategori(slug, { veri, out, log }); }
  } catch (e) { return { slug, durum: 'gozden-gecir', neden: `uretim hatasi: ${String(e.message).slice(0, 160)}` }; }
  const kk = await restoranKapi(slug, { browser, base, out, veri, sablon: k.sablon, log });
  if (kk.status !== 'hazir') return { slug, durum: 'gozden-gecir', neden: `siki kapi: ${kk.reasons.slice(0, 3).join('; ')}`, kapi: kk };
  // son-bakis paketi (Son goz turu bunu okur)
  const son = path.join(dir, 'son'); fs.rmSync(son, { recursive: true, force: true }); fs.mkdirSync(son, { recursive: true });
  for (const f of ['sonra-1440.jpg', 'sonra-1920.jpg', 'sonra-390.jpg', 'son-390-tam.jpg', 'son-1440-tam.jpg']) if (fs.existsSync(path.join(dir, f))) fs.copyFileSync(path.join(dir, f), path.join(son, f.replace(/^sonra-/, 'ekran-').replace(/^son-/, 'ekran-')));
  for (const f of ['hero-adaylar.jpg', 'hero-aday', 'menu-kaynak', 'once-390.jpg', 'once-1440.jpg', 'bilgi.json', 'metin.txt', 'fotolar.jpg']) kopya(path.join(paketDir, f), path.join(son, f));
  W(path.join(son, 'ozet.json'), { slug, sablon: k.sablon, sayfa: kk.page, icerikHash: icerikHash(dir), icerikKarari: k, kapi: { status: kk.status, warnings: kk.warnings, menuKalem: kk.menuKalem, eylem: kk.eylem }, heroSecim: J(path.join(dir, 'hero-secim.json'), {}).secilen || null, uret: J(path.join(dir, k.sablon === 'v5' ? 'uret.json' : 'uret-kategori.json'), {}) });
  return { slug, durum: 'son-bakis', page: sayfaKlasoru(kk.page), sablon: k.sablon };
}

// son goz son karari.  sonGozDal: karar karar/songoz-* dalindan mi geldi (uygula.yml GITHUB_REF_NAME'den verir)
// araclar: sayfa yoksa yeniden kurmak icin { kur(slug, sablon, ctx), kapi(slug, sablon) } (varsayilan: gercek uretici ve siki kapi); testler sahte verir
export async function sonUygula(slug, k, { veri, out, browser, base, getir = null, paketDir, onizDir, sonGozDal = false, araclar = null, log = () => {} }) {
  const dir = path.join(veri, slug); const R = J(path.join(dir, 'cikarici.json'));
  if (!R) return { slug, durum: 'veri-yok', neden: 'cikarici.json yok' };
  if (k.tur !== 'son' || k.inceleyen !== 'son-goz' || !sonGozDal) return { slug, durum: 'karar-hatali', neden: 'son karar yalniz Son goz turunun karar/songoz-* dalindan gelir' };
  const S = J(path.join(dir, 'karsilastirma.json'), {});
  karsilastirmaYaz(dir, 'sonGoz', { karar: k.karar, hero: k.hero ? k.hero.id : (S.icerikTuru && S.icerikTuru.hero), heroAyni: k.hero ? String(k.hero.id) === String(S.icerikTuru && S.icerikTuru.hero) : true, menuDuzeltme: !!(k.icerik && k.icerik.menu), notlar: k.notlar || [], neden: k.neden || '', gozlem: k.gozlem && k.gozlem.metin });
  if (k.karar === 'duzelt') {
    const n = (J(path.join(dir, 'kapi.json'), {}).duzeltme || 0) + 1;
    if (n > 2) return { slug, durum: 'gozden-gecir', neden: 'iki duzeltmeden sonra hala yayinlanmadi' };
    if (!k.icerik || k.icerik.tur !== 'icerik') return { slug, durum: 'karar-hatali', neden: 'duzelt karari tam bir icerik karari (tur icerik, inceleyen songoz) tasimali' };
    const r = await icerikUygula(slug, { ...k.icerik, inceleyen: 'son-goz' }, { veri, out, browser, base, getir, paketDir, log });
    const kf = path.join(dir, 'kapi.json'); const kj = J(kf, {}); kj.duzeltme = n; W(kf, kj);
    return r;
  }
  if (k.karar !== 'yayinla') return { slug, durum: k.karar, neden: String(k.neden || '').slice(0, 200) };
  let kk = J(path.join(dir, 'kapi.json'), {});
  if (kk.status !== 'hazir' || !kk.siki) return { slug, durum: 'gozden-gecir', neden: 'siki kapi hazir degil' };
  if (k.icerikHash && k.icerikHash !== icerikHash(dir)) return { slug, durum: 'gozden-gecir', neden: 'son goz baska bir surume bakti (icerikHash tutmuyor)' };
  const g = k.gozlem || {};
  if (String(g.metin || '').length < 30 || /\d/.test(g.metin || '')) return { slug, durum: 'karar-hatali', neden: 'yayinla karari dogrulanmis gozlem cumlesi tasimali (rakamsiz)' };
  // ONAY ayri bir is olarak (taze bulut ortami) kosar: sayfa klasoru yoktur.  Onaylanan icerik kaydindan (icerik.json + kahraman dosyalari, veri dalinda) yeniden kurulur ve siki kapidan bir kez daha gecer.
  if (!fs.existsSync(path.join(out, sayfaKlasoru(kk.page), 'index.html'))) {
    const A = araclar || { kur: sayfaKur, kapi: (s, sablon) => restoranKapi(s, { browser, base, out, veri, sablon, log }) };
    try { await A.kur(slug, kk.sablon, { veri, out, log }); } catch (e) { return { slug, durum: 'gozden-gecir', neden: `onay sonrasi sayfa kurulamadi: ${String(e.message).slice(0, 140)}` }; }
    const yk = await A.kapi(slug, kk.sablon);
    if (yk.status !== 'hazir') return { slug, durum: 'gozden-gecir', neden: `siki kapi (onay sonrasi yeniden kurulum): ${(yk.reasons || []).slice(0, 3).join('; ')}` };
    kk = J(path.join(dir, 'kapi.json'), yk);
    if (!fs.existsSync(path.join(out, sayfaKlasoru(kk.page), 'index.html'))) return { slug, durum: 'gozden-gecir', neden: 'onay sonrasi sayfa dosyasi yok' };
  }
  const on = await telefonOnizleme(path.join(dir, 'sonra-390.jpg'), path.join(onizDir, `${slug}.jpg`));
  if (!on) return { slug, durum: 'gozden-gecir', neden: 'telefon onizlemesi uretilemedi' };
  const ik = J(path.join(dir, 'icerik.json'), {});
  return { slug, leadId: R.lead && R.lead.id, ad: R.name && R.name.n, durum: 'hazir', sonGoz: true, page: sayfaKlasoru(kk.page), sektor: 'restoran', sablon: kk.sablon, fiyatVar: (kk.menuKalem || 0) >= 6, onizleme: on.file, onizlemeKb: on.kb, gozlem: g.metin, gozlemKanit: g.kanit || '', konuOzel: k.konuOzel || null, slogan: ik.v5 ? ik.v5.slogan && ik.v5.slogan.text : ik.kategori && ik.kategori.aday && (ik.kategori.aday[ik.kategori.sec || 0] || {}).text, neden: String(k.neden || '').slice(0, 200) };
}

// onaylanmis icerik kaydindan (icerik.json ve kahraman dosyalari; ikisi de veri dalinda) sayfayi yeniden kurar; ag yok
export async function sayfaKur(slug, sablon, { veri, out, log = () => {} }) {
  if (sablon === 'v5') { const { uretV5 } = await import('./uret-v5.mjs'); const r = await uretV5(slug, { veri, out, log }); if (r.status !== 'uretildi') throw new Error(`uretim: ${(r.reasons || []).join('; ')}`); }
  else { const { tamamla } = await import('./kategori-tamamla.mjs'); const { uretKategori } = await import('./uret-kategori.mjs'); tamamla(slug, { veri }); await uretKategori(slug, { veri, out, log }); }
}
