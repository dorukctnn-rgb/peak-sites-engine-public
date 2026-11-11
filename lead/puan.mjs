// LEAD BULUCU (2/3): "KOTU SITE" PUANLAYICI.  Otomatik, olculmus bulgular; tahmin yok.  Iki katman:
//   1) HTML (fetch, tarayicisiz): https, viewport, telif yili, eski teknoloji izleri, sektorun temel bilgisi (fiyat, oda/hizmet, rezervasyon), sayfa agirligi
//   2) Tarayici (istege bagli, 390 px telefon): yatay tasma, yuklenme suresi, kirik gorsel, kucuk yazi
// Sonuc: { puan, kotu, bulgular: [{ k, v, p }] }.  kotu = puan >= ESIK.  Siteyi zaten iyi olana mail gitmez (puan < ESIK).
// Her bulgu bir olcumdur (deger + tarih), mailde ya da raporda "uydurma" yoktur.
import { SEKTORLER } from './sektorler.mjs';
import { isPhotoUrl, logoCandidates } from '../uyarla/v2lib/scrape.mjs';
const absUrl = (u, base) => { try { const x = new URL(String(u).trim().replace(/&amp;/g, '&'), base); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

export const ESIK = 4;
const yil = () => new Date().getUTCFullYear();

export function htmlPuan({ html = '', finalUrl = '', bytes = 0, ms = 0, sektor }) {
  const b = []; const add = (k, v, p) => b.push({ k, v, p });
  const h = String(html); const low = h.toLowerCase();
  const S = SEKTORLER[sektor] || {};
  if (finalUrl && !/^https:/i.test(finalUrl)) add('https-yok', finalUrl.split('/')[2], 3);
  if (!/<meta[^>]+name=["']?viewport/i.test(h)) add('viewport-yok', 'meta viewport yok (telefona uyumsuz)', 3);
  // telif yili: sayfadaki en buyuk "© 20xx" / "copyright 20xx" yili (aralikta son yil)
  const ys = [...h.matchAll(/(?:©|&copy;|copyright)\s*(?:[^<\d]{0,30})?((?:19|20)\d\d)(?:\s*[-–]\s*((?:19|20)\d\d))?/gi)].map((m) => Number(m[2] || m[1])).filter((y) => y >= 1995 && y <= yil());
  if (ys.length) { const y = Math.max(...ys); if (y <= yil() - 3) add('telif-eski', `© ${y}`, y <= yil() - 6 ? 3 : 2); }
  const eski = [];
  if (/jquery[.-]?1\.[0-9]\b|jquery\/1\.[0-9]\./i.test(h)) eski.push('jQuery 1.x');
  if (/\.swf\b|shockwave-flash/i.test(h)) eski.push('Flash');
  if (/<font\b/i.test(h)) eski.push('<font>');
  if (/<marquee\b|<blink\b/i.test(h)) eski.push('marquee');
  if (/<frameset\b|<frame\b/i.test(h)) eski.push('frame');
  if ((low.match(/<table\b/g) || []).length >= 6 && !/<table[^>]+class=["'][^"']*(price|menu|rate|tariff)/i.test(h)) eski.push('tablo duzeni');
  const gen = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i.exec(h); if (gen && /frontpage|iweb|muse|dreamweaver|homestead|freewebs|webs\.com|yola|serif webplus|website x5|rapidweaver [1-6]\b|joomla! 1\.|wordpress [1-4]\./i.test(gen[1])) eski.push(gen[1].slice(0, 40));
  if (/best viewed in|internet explorer|under construction/i.test(h)) eski.push('eski not');
  if (eski.length) add('eski-teknoloji', eski.join(', '), Math.min(3, eski.length + 1));
  if (S.rezervasyon && !S.rezervasyon.test(h) && !/\b(book now|book online|check availability|make a booking|reserve now|book an appointment|book a table)\b/i.test(h) && !/(?<!\p{L})(online sipari[şs]|sipari[şs] ver|hemen sipari[şs]|rezervasyon yap|online rezervasyon|masa ay[ıi]rt)(?!\p{L})/iu.test(h.replace(/<[^>]+>/g, ' '))) add('rezervasyon-yok', 'sayfada rezervasyon/randevu baglantisi yok', 2);
  if (S.anahtar && S.anahtar.fiyat && !S.anahtar.fiyat.test(h.replace(/<[^>]+>/g, ' '))) add('fiyat-yok', 'ana sayfada fiyat yok', 1);
  if (bytes > 4_000_000) add('agir', `${(bytes / 1e6).toFixed(1)} MB HTML`, 1);
  if (ms > 6000) add('yavas-yanit', `${(ms / 1000).toFixed(1)} sn ilk yanit`, 1);
  const img = (low.match(/<img\b/g) || []).length; if (img < 3) add('gorsel-az', `${img} gorsel`, 1);
  return b;
}

// tarayici olcumu (390 px): page = playwright Page (yeni baglam), url acilmis olmali
export async function tarayiciOlc(page) {
  return page.evaluate(() => {
    const de = document.documentElement; const out = { w: innerWidth, scrollW: de.scrollWidth };
    out.tasma = de.scrollWidth > innerWidth + 8;
    const imgs = [...document.images].filter((i) => i.getBoundingClientRect().width > 20);
    out.kirik = imgs.filter((i) => i.complete && i.naturalWidth === 0).length;
    const ps = [...document.querySelectorAll('p, li, td, a')].filter((e) => e.textContent.trim().length > 20).slice(0, 60);
    const fs = ps.map((e) => parseFloat(getComputedStyle(e).fontSize)).filter(Boolean).sort((a, b) => a - b);
    out.yaziMedyan = fs.length ? fs[Math.floor(fs.length / 2)] : null;
    const nav = performance.getEntriesByType('navigation')[0];
    out.yukMs = nav ? Math.round(nav.loadEventEnd || nav.domContentLoadedEventEnd || 0) : null;
    return out;
  });
}

export function tarayiciPuan(o) {
  const b = []; const add = (k, v, p) => b.push({ k, v, p });
  if (!o) return b;
  if (o.tasma) add('telefonda-tasma', `390 px ekranda sayfa ${o.scrollW} px genis`, 3);
  if (o.kirik >= 1) add('kirik-gorsel', `${o.kirik} kirik gorsel`, Math.min(2, o.kirik));
  if (o.yaziMedyan && o.yaziMedyan < 13) add('kucuk-yazi', `telefonda yazi ${o.yaziMedyan}px`, 1);
  if (o.yukMs && o.yukMs > 8000) add('yavas', `telefonda yuklenme ${(o.yukMs / 1000).toFixed(1)} sn`, 2);
  return b;
}

// Sektore ozel esik (11 Kas deneme turu): restoranda ana sayfada siparis/rezervasyon yok (2) + fiyat yok (1) zaten zayif bir sitedir; 4 esigiyle taranan
// 368 restoranin yalniz %8'i aday cikti, bunlarin cogu malzemesiz.  Restoran esigi 3; diger sektorler 4 (degismez).
export const ESIK_SEKTOR = { restoran: 3 };
export function topla(bulgular, sektor = null) {
  const puan = bulgular.reduce((s, x) => s + x.p, 0);
  return { puan, kotu: puan >= (ESIK_SEKTOR[sektor] ?? ESIK), bulgular, olculdu: new Date().toISOString().slice(0, 10) };
}

// URETILEBILIRLIK (malzeme) TAHMINI: ana sayfanin HTML'inden, tarayicisiz.  Siteyi yeniden yapmak icin isletmenin KENDI fotograflari ve logosu gerekir;
// cok kotu (eski teknoloji, tablo duzeni, https yok) siteler genelde az/kucuk fotografli olur ve kapida elenir (olculen: puan >= 8 olanlarin %14'u hazir, < 8 olanlarin %39'u).
// -> { foto: ayri foto benzeri adres sayisi (en cok 30), logo: logo adayi var mi, galeri: galeri sayfasina baglanti var mi }
export function malzemeOlc(html, base) {
  const h = String(html || '').slice(0, 600000).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, (m) => (/background(?:-image)?\s*:[^;}]*url\(/i.test(m) ? m : ' '));
  const set = new Set();
  const ekle = (u) => {
    const a = absUrl(u, base); if (!a || !isPhotoUrl(a)) return;
    if (!/\.(jpe?g|png|webp|avif)(\?|#|$)/i.test(a) && !/\/(wp-content\/uploads|images?|photos?|media|uploads)\//i.test(a)) return;
    if (/(?:^|[-_/])(?:logo|icon|favicon|sprite|button|btn|arrow|bullet|pixel|spacer|loading)[-_.\d]/i.test(a.split('/').pop())) return;
    if (/[-_](?:\d{1,2}x\d{1,2}|1[0-4]\dx1[0-4]\d)\.\w+$/.test(a)) return; // kucuk kucuk resim (thumb)
    set.add(a.replace(/-\d{2,4}x\d{2,4}(?=\.\w+$)/, '').split('?')[0]);
  };
  for (const m of h.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    for (const at of ['data-src', 'data-lazy-src', 'data-original', 'src']) { const r = new RegExp(String.raw`\s${at}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag); if (r) ekle(r[1] ?? r[2]); }
    const ss = /\ssrcset=(?:"([^"]*)"|'([^']*)')/i.exec(tag); if (ss) for (const p of String(ss[1] ?? ss[2]).split(',')) ekle(p.trim().split(/\s+/)[0]);
  }
  for (const m of h.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) ekle(m[1]);
  const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i.exec(h); if (og) ekle(og[1]);
  const logo = logoCandidates(h, base).length > 0;
  const galeri = /<a\b[^>]+href=["'][^"']*(?:gallery|galeri|photos?|images)[^"']*["']/i.test(h);
  return { foto: Math.min(30, set.size), logo, galeri };
}

// uretim sirasi: "yeterince kotu" siteler, ama en kotuler degil.  Olculen (10 Kas, 32 uretim): puan >= 8 olanlarin %14'u, < 8 olanlarin %39'u kapidan hazir cikti;
// viewport'u olmayan (en eski) sitelerin %7'si.  Cok kotu siteler genelde az/kucuk fotografli ya da tablo duzenlidir.  Sira: puan 6.5'a yakin olan once; logo adayi yoksa biraz geri.
// (malzeme.foto ana sayfa HTML'inden sayilir ve guvenilir bir tahmin cikmadi (JS ile yuklenen fotograflar): yalniz kayit icin tutulur, siralamaya girmez.)
export function uretimPuani(l) {
  const p = Number(l.puan) || 0; let s = -Math.abs(p - 6.5);
  if (l.malzeme && l.malzeme.logo === false) s -= 1.5;
  return s;
}
