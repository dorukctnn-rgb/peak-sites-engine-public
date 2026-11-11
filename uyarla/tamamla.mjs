// TAMAMLA: eski cikarici.json'lara YENI alanlari ekler (cikarma yeniden kosulmaz: fotograf, menu, renk, saat, ekran goruntusu AYNEN kalir).
//   node uyarla/tamamla.mjs <slug,slug|hepsi> [--force]
// Eklenenler: slogan adaylari (kahraman basligi), GORUNEN font (canvas olcumu), isletmenin ORIJINAL logo dosyasi.
// Isletme basina tek tarayici ziyareti (ana sayfa) + tek logo istegi; robots.txt'e uyulur (Polite).  Doruk'un Chrome'u kullanilmaz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Polite } from './v2lib/polite.mjs';
import { openBrowser, ziyaret } from './lib/ziyaret.mjs';
import { sniff } from './lib/gorsel.mjs';
import { orijinalKaydet } from './lib/logo.mjs';
import { upgradeUrl } from './cikar.mjs';

export { VERI } from './lib/yol.mjs';
import { VERI } from './lib/yol.mjs';
const clean = (s, max = 400) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function tamamla(slug, { browser, polite, veri = VERI, force = false, log = console.log } = {}) {
  const dir = path.join(veri, slug); const jf = path.join(dir, 'cikarici.json');
  const R = JSON.parse(fs.readFileSync(jf, 'utf8'));
  if (!R.erisim || !R.erisim.ok) return { slug, durum: 'atla (site okunamadi)' };
  const tam = R.slogan && R.fonts && R.fonts.shown && (!R.logo || (R.logo.orig && R.logo.orig.file));
  if (tam && !force) return { slug, durum: 'atla (hazir)' };
  const home = await ziyaret(browser, R.lead.site, { polite, lang: R.lead.lang, wantImages: false });
  if (!home.ok) return { slug, durum: `ziyaret basarisiz (${home.why || home.status})` };
  const S = home.style;
  R.slogan = { cands: home.sloganAd || [], ogTitle: clean(home.meta.ogTitle, 160), title: clean(home.title, 160), desc: clean(home.meta.desc || home.meta.ogDesc) };
  R.fonts = R.fonts || {};
  R.fonts.shown = { h1: S.h1 && S.h1.shown, h2: S.h2 && S.h2.shown, h3: S.h3 && S.h3.shown, nav: S.nav && S.nav.shown, btn: S.btn && S.btn.shown, p: S.p && S.p.shown, body: S.body && S.body.shown, logo: S.logoText && S.logoText.shown };
  const rapor = { slug, durum: 'tamamlandi', shown: R.fonts.shown, aday: R.slogan.cands.length };
  if (R.logo) {
    // sayfadaki logo adaylari (ayni dosya adi, daha buyuk dogal boyut var mi)
    const base = (R.logo.url || '').split('/').pop().split('?')[0].replace(/\.[a-z0-9]+$/i, '');
    const alt = home.imgs.filter((i) => i.url && (i.url.includes(base) || /logo/i.test(`${i.url} ${i.cls}`))).map((i) => ({ url: i.url, nw: i.nw, nh: i.nh, rw: i.rw, rh: i.rh, inHeader: i.inHeader })).slice(0, 8);
    R.logo.altAdaylar = alt; rapor.logoAday = alt;
    const urls = [...new Set([upgradeUrl(R.logo.url), R.logo.url])];
    let saved = null;
    for (const u of urls) {
      const r = await polite.get(u, { maxBytes: 9_000_000, accept: 'image/*', binary: true });
      if (!r.ok) { log(`   logo istegi basarisiz: ${u.slice(0, 90)} (${r.why || r.status})`); continue; }
      const mime = sniff(r.buf); if (!mime || mime === 'image/gif') continue;
      saved = await orijinalKaydet(r.buf, mime, path.join(dir, 'img')); saved.url = u; break;
    }
    if (saved) { R.logo.orig = saved; rapor.logo = { file: saved.file, mime: saved.mime, w: saved.w, h: saved.h, bytes: saved.bytes, url: saved.url }; }
    else rapor.logo = 'orijinal indirilemedi';
  }
  R.tamamla = { at: new Date().toISOString(), not: 'slogan adaylari, gorunen font, orijinal logo sonradan eklendi (cikarma yeniden kosulmadi)' };
  fs.writeFileSync(jf, JSON.stringify(R, null, 1));
  return rapor;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const which = process.argv[2]; const force = process.argv.includes('--force');
  if (!which) { console.error('kullanim: node uyarla/tamamla.mjs <slug,slug|hepsi> [--force]'); process.exit(2); }
  const slugs = which === 'hepsi' ? fs.readdirSync(VERI).filter((s) => fs.existsSync(path.join(VERI, s, 'cikarici.json'))) : which.split(',');
  const polite = new Polite({ gapMs: 1100, hostGapMs: 1800 });
  const browser = await openBrowser();
  try { for (const s of slugs) { try { console.log(JSON.stringify(await tamamla(s, { browser, polite, force }))); } catch (e) { console.log(JSON.stringify({ slug: s, hata: String(e.stack || e).split('\n').slice(0, 3).join(' | ') })); } } } finally { await browser.close(); }
}
