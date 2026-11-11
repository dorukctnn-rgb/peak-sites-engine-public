// EK: bitmis cikarmaya SONRADAN eklenen alanlar (cikar.mjs yeniden kosulmaz; fotograf, renk, saat, ekran goruntusu AYNEN kalir).
//   node uyarla/ek.mjs <slug,slug> [--force]
// 1) Menu eki: menusu eksik kalan isletmede (kalem < 12 ya da "atlanan" menu sayfasi var) ana sayfadaki menu baglantilarindan en cok 3 sayfa okunur
//    (satir kurali + "rozet" kurali); bulunan kalemler kaynak sayfasiyla eklenir.
// 2) Logo varyantlari: sitenin GERCEKTEN gosterdigi logo dosyalari (acik/koyu zemin surumleri) AYNEN indirilir; hicbiri degistirilmez.
// 3) Ana sayfadaki gercek paragraflar (hikaye bolumu icin isletmenin kendi cumleleri).
// Isletme basina en cok 1 + 3 + 3 kibar istek; robots.txt'e uyulur.  Tarayici acilmaz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Polite } from './v2lib/polite.mjs';
import { decode } from './v2lib/scrape.mjs';
import { sniff } from './lib/gorsel.mjs';
import { orijinalKaydet, logoPiksel } from './lib/logo.mjs';
import { menuLinks, menuFromText, groupMenu } from './lib/menu.mjs';
import { menuFromBadges } from './lib/menu-rozet.mjs';
import { profil } from './sektor/index.mjs';

export { VERI } from './lib/yol.mjs';
import { VERI } from './lib/yol.mjs';
const clean = (s, max = 400) => decode(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const body = (r) => r.text || r.body || r.html || (r.buf ? r.buf.toString('utf8') : '');

export function paragraflar(html) {
  const src = String(html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, ' ');
  // <p> ya da yalniz metin iceren yaprak <div>
  const out = []; const re = /<p\b[^>]*>([\s\S]*?)<\/p>|<div\b[^>]*>([^<]{60,900})<\/div>/gi; let m;
  while ((m = re.exec(src)) && out.length < 12) {
    const t = clean(m[1] !== undefined ? m[1] : m[2], 700);
    if (t.length >= 60 && t.split(' ').length >= 10 && !/cookie|©|copyright|subscribe|newsletter|çerez|javascript|error|admin|mailing list/i.test(t) && !/https?:|@/.test(t)) out.push(t);
  }
  return out;
}

export async function ek(slug, { polite, veri = VERI, force = false, log = console.log } = {}) {
  const dir = path.join(veri, slug); const jf = path.join(dir, 'cikarici.json');
  const R = JSON.parse(fs.readFileSync(jf, 'utf8'));
  if (R.ek && !force) return { slug, durum: 'atla (hazir)' };
  const base = R.lead.site; const rapor = { slug, istek: 0 };
  const home = await polite.get(base, { maxBytes: 3_000_000, accept: 'text/html' }); rapor.istek++;
  if (!home.ok) return { slug, durum: `ana sayfa okunamadi (${home.why || home.status})` };
  const html = body(home);
  R.ek = { at: new Date().toISOString(), paragraflar: paragraflar(html) };
  // ---- menu ----
  const have = (R.menu && R.menu.items) || [];
  const skipped = ((R.menu && R.menu.skipped) || []).map((x) => x.url);
  const SM = profil(R.lead); // konaklama menu kullanmaz (atlanir); guzellik fiyat listesini kendi sozcuk ve suzgeciyle okur
  if ((have.length < 12 || skipped.length) && !(SM && !SM.MENU_ARA)) {
    const links = [...html.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1], text: clean(m[2], 80) }));
    const done = have.length ? R.menu.pageUrl : null;
    const urls = [...new Set([...menuLinks(links, base, SM && SM.MENU_SOZCUK ? SM.MENU_SOZCUK : undefined).filter((l) => !l.pdf).map((l) => l.url), ...skipped])].filter((u) => u !== done).slice(0, 3);
    const seen = new Set(have.map((i) => i.n.toLowerCase())); const added = [];
    for (const u of urls) {
      const r = await polite.get(u, { maxBytes: 2_500_000, accept: 'text/html' }); rapor.istek++;
      if (!r.ok) { log(`   menu sayfasi okunamadi: ${u} (${r.why || r.status})`); continue; }
      const h = body(r);
      const a = menuFromText(h, { lang: R.lead.lang, max: 40 }); const b = menuFromBadges(h);
      const rows0 = b.length > a.length ? b : a; const rows = SM && SM.menuSuz ? SM.menuSuz(rows0) : rows0;
      for (const it of rows) { if (seen.has(it.n.toLowerCase())) continue; seen.add(it.n.toLowerCase()); added.push({ ...it, page: u, ek: true }); }
    }
    if (added.length) {
      R.menu.items = have.concat(added).slice(0, 110);
      R.menu.groups = groupMenu(R.menu.items).map((g) => ({ name: g.name, n: g.items.length }));
      if (!R.menu.pageUrl || !have.length) R.menu.pageUrl = added[0].page;
    }
    R.ek.menu = { sayfalar: urls, eklenen: added.length }; rapor.menu = R.ek.menu;
  }
  // ---- logo varyantlari: sayfada gercekten gorunen (rw > 0) dosyalar ----
  if (R.logo && R.logo.altAdaylar) {
    const host = new URL(base).host.replace(/^www\./, '');
    const shown = R.logo.altAdaylar.filter((a) => a.rw > 0 && a.url && /logo/i.test(a.url) && new URL(a.url).host.replace(/^www\./, '') === host);
    const urls = [...new Set(shown.map((a) => a.url))].filter((u) => u !== (R.logo.orig && R.logo.orig.url)).slice(0, 3);
    const vars = [];
    for (const u of urls) {
      const r = await polite.get(u, { maxBytes: 4_000_000, accept: 'image/*', binary: true }); rapor.istek++;
      if (!r.ok) continue;
      const mime = sniff(r.buf); if (!mime || mime === 'image/gif') continue;
      const tmp = path.join(dir, 'img', `_v${vars.length}`);
      const s = await orijinalKaydet(r.buf, mime, tmp);
      const ext = s.file.split('.').pop(); const file = `img/logo-varyant-${vars.length + 1}.${ext}`;
      fs.renameSync(path.join(tmp, path.basename(s.file)), path.join(dir, file)); fs.rmdirSync(tmp);
      const px = await logoPiksel(r.buf, mime); const L = px.lums.length ? px.lums.reduce((x, y) => x + y, 0) / px.lums.length : 0;
      const rw = Math.max(...shown.filter((a) => a.url === u).map((a) => a.rw));
      vars.push({ ...s, file, url: u, alpha: px.alpha, meanL: +L.toFixed(3), tone: L > 0.5 ? 'light' : 'dark', inHeader: shown.some((a) => a.url === u && a.inHeader), rw });
    }
    R.logo.varyantlar = vars; rapor.logo = vars.map((v) => `${v.file} (${v.tone}, ${v.w}x${v.h})`);
  }
  fs.writeFileSync(jf, JSON.stringify(R, null, 1));
  rapor.durum = 'tamam'; rapor.paragraf = R.ek.paragraflar.length;
  return rapor;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const which = process.argv[2]; const force = process.argv.includes('--force');
  if (!which) { console.error('kullanim: node uyarla/ek.mjs <slug,slug> [--force]'); process.exit(2); }
  const polite = new Polite({ gapMs: 1500, hostGapMs: 2500 });
  for (const s of which.split(',')) { try { console.log(JSON.stringify(await ek(s, { polite, force }))); } catch (e) { console.log(JSON.stringify({ slug: s, hata: String(e.stack || e).split('\n').slice(0, 3).join(' | ') })); } }
}
