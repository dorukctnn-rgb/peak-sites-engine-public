// RESTORAN SIKI KAPISI (11 Kas 2026): v5 ve kategori (burger, burrito, pizza) sayfalarinin YAYIN ONCESI otomatik kapisi.  Bir madde bile gecmezse sayfa
// "gozden-gecir" olur ve yayin paketine GIRMEZ (yarim kalite sayfa yok).  Gecen sayfa da yalniz Son goz turunun "yayinla" kararindan sonra yayina girer.
//   restoranKapi(slug, { browser, base, out, veri, sablon }) -> { status: 'hazir'|'gozden-gecir', reasons[], warnings[], ekranlar }
// Sablonun kendi kapisi: v5 -> kapi.mjs (kontrast, tasma, baslik, bozuk gorsel, font, konsol, ilk ekran, logo bozulmasi);
//                        kategori -> kategori-kapi.mjs (ayni olculer + imlec, dokunma, azaltilmis hareket).
// Ustune ortak maddeler: logo dosyasi bayt bayt (sha256), lint-copy 0, hicbir metinde yasak kisaltma yok, 1440/1920/390'da buyutulmus (bulanik) gorsel ve bos bolum yok,
// ilk ekranda simdi acik + bugunku saat + adres + telefon + isletmenin GERCEK siparis/rezervasyon baglantisi, en az 6 fiyatli menu kalemi ve kaydi tutulmus kaynagi.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sharp } from './lib/gorsel.mjs';
import { KAPI_SURUM } from './lib/surum.mjs';
import { yasakVar } from './lib/sozluk.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// sayfa icinde: buyutulmus gorsel, bos bolum, ilk ekran bilgileri (sablondan bagimsiz secicilerle)
async function genelDenetim(eylemUrl) {
  window.__px = window.__px || {};
  for (const im of document.querySelectorAll('img')) { const u = im.currentSrc || im.src; if (!u || window.__px[u] || !im.complete || !im.naturalWidth) continue; const t = new Image(); t.src = u; try { await t.decode(); window.__px[u] = [t.naturalWidth, t.naturalHeight]; } catch { window.__px[u] = [im.naturalWidth, im.naturalHeight]; } }
  const vw = innerWidth; const vh = innerHeight; const dpr = devicePixelRatio; const S = [];
  const gorunur = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
  const olcek = (el) => { let k = 1; for (let p = el; p && p !== document.body; p = p.parentElement) { const t = getComputedStyle(p).transform; if (t && t !== 'none') { const m = new DOMMatrix(t); k *= Math.sqrt(m.a * m.a + m.b * m.b); } } return k; };
  for (const im of document.querySelectorAll('img')) {
    if (!gorunur(im) || !im.offsetWidth || !im.complete || !im.naturalWidth) continue;
    const b = im.getBoundingClientRect(); if (b.bottom < -vh || b.top > vh * 2) continue;
    const [nw, nh] = window.__px[im.currentSrc || im.src] || [im.naturalWidth, im.naturalHeight]; const cs = getComputedStyle(im);
    const sx = im.offsetWidth / nw; const sy = im.offsetHeight / nh; const k = (cs.objectFit === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy)) * olcek(im) * dpr;
    if (k > 1.08 && !/logo/i.test(im.getAttribute('src') || '')) S.push(`buyutulmus gorsel (bulanik): ${(im.currentSrc || im.src).split('/').pop().split('?')[0]} x${k.toFixed(2)}`);
  }
  for (const s of document.querySelectorAll('main section, body > section, footer')) { if (!gorunur(s) || s.offsetHeight < 40) continue; const t = s.innerText.replace(/\s+/g, ' ').trim(); if (t.length < 12 && !s.querySelector('img,canvas,video,picture')) S.push(`bos bolum: ${s.id || String(s.className).split(' ')[0] || s.tagName}`); }
  const metin = [document.title, document.body.innerText, ...[...document.querySelectorAll('[alt],[aria-label],[title]')].map((e) => `${e.getAttribute('alt') || ''} ${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''}`)].join(' \n ');
  if (yasakVar('kisaltmaNoktali', metin)) S.push('metinde yasak kisaltma geciyor');
  // TR sayfasi (lang=tr, 11 Kas): adres ve sehir isletmenin kendisinin (Kadıköy/İstanbul, Lara/Antalya); bizim konumumuz sayfada hic yok, kural yalniz yurt disi sayfalarda
  if (document.documentElement.lang !== 'tr' && /T[uü]rkiye|Turkey|Antalya/i.test(metin)) S.push('metinde yasak yer adi');
  const ilk = (el) => { if (!el || !gorunur(el)) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < vh - 2 && b.bottom > 2; };
  const hepsi = (q) => [...document.querySelectorAll(q)];
  const ie = {
    durum: hepsi('[data-status]').filter(ilk).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).find((t) => t.length > 3) || null,
    saat: hepsi('[data-today], .f-hours, [data-hours]').filter(ilk).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).find((t) => /\d/.test(t) || /open|closed/i.test(t)) || null,
    adres: hepsi('a[href*="google.com/maps"], a[href*="maps.apple"], a[href*="goo.gl/maps"]').some(ilk),
    telefon: hepsi('a[href^="tel:"]').some(ilk),
    eylem: eylemUrl ? hepsi('a[href]').filter((a) => a.getAttribute('href') === eylemUrl).some(ilk) : false,
  };
  for (const [k, v] of Object.entries(ie)) if (!v) S.push(`ilk ekranda yok: ${k}`);
  const tel = hepsi('a[href^="tel:"]').filter(ilk);
  const anaDugmeler = hepsi('a.btn, .cta a, a.main, .top .btn, .hero a.btn').filter(ilk).map((a) => a.getAttribute('href')).filter((h) => h && !h.startsWith('#') && !h.startsWith('tel:') && !/maps/.test(h));
  if (eylemUrl && anaDugmeler.some((h) => h !== eylemUrl)) S.push(`ilk ekranda ikinci bir dis eylem var: ${anaDugmeler.filter((h) => h !== eylemUrl)[0]}`);
  return { sorun: S, ilkEkran: ie, tel: tel.length, sw: document.documentElement.scrollWidth, vw };
}

async function tarayiciDenetim(browser, url, eylemUrl, dir) {
  const out = { sorunlar: [], olcum: {} };
  for (const [label, vp, opt] of [['1440', { width: 1440, height: 900 }, {}], ['1920', { width: 1920, height: 1080 }, {}], ['390', { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'no-preference', ...opt });
    const pg = await ctx.newPage(); const hata = [];
    pg.on('console', (m) => { if (m.type() === 'error') hata.push(m.text().slice(0, 160)); }); pg.on('pageerror', (e) => hata.push(String(e.message).slice(0, 160)));
    await pg.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(new URL(url).origin) || u.startsWith('data:')) return r.continue(); return r.abort(); });
    try {
      await pg.goto(`${url}?capture=1`, { waitUntil: 'load', timeout: 45000 }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(600);
      const ilk = await pg.evaluate(genelDenetim, eylemUrl);
      // tum sayfa: tembel gorseller yuklensin diye ekran ekran in, her ekranda buyutulmus gorsel ve bos bolum denetimi
      const H = await pg.evaluate(() => document.documentElement.scrollHeight); const tum = new Set();
      for (let y = 0; y < H; y += vp.height * 0.8) { await pg.evaluate((yy) => scrollTo(0, yy), y); await pg.waitForTimeout(160); const a = await pg.evaluate(genelDenetim, eylemUrl); for (const s of a.sorun) if (!s.startsWith('ilk ekranda')) tum.add(s); }
      await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(300);
      if (label !== '1920') { const b = await pg.screenshot({ type: 'png', fullPage: true }); const m = await sharp(b).metadata(); const w = label === '390' ? 390 : 720; let im = sharp(b, { limitInputPixels: 400e6 }); if (m.height > 16000) im = im.extract({ left: 0, top: 0, width: m.width, height: 16000 }); await im.resize({ width: w }).jpeg({ quality: 68, mozjpeg: true }).toFile(path.join(dir, `son-${label}-tam.jpg`)); }
      out.olcum[label] = { ilkEkran: ilk.ilkEkran, sw: ilk.sw };
      for (const s of [...ilk.sorun, ...tum]) out.sorunlar.push(`${label}: ${s}`);
      if (ilk.sw > ilk.vw + 1) out.sorunlar.push(`${label}: yatay tasma ${ilk.sw} > ${ilk.vw}`);
      for (const h of [...new Set(hata)]) out.sorunlar.push(`${label}: konsol: ${h}`);
    } catch (e) { out.sorunlar.push(`${label}: sayfa acilamadi (${String(e.message).slice(0, 100)})`); }
    await ctx.close();
  }
  out.sorunlar = [...new Set(out.sorunlar)];
  return out;
}

export function lintCopy(file) {
  const r = spawnSync(process.execPath, [path.join(HERE, 'lint-copy.mjs'), file, '--json'], { encoding: 'utf8', timeout: 60000 });
  let f = []; try { f = JSON.parse(r.stdout || '[]'); } catch { f = [{ type: 'lint-copy calismadi', sample: String(r.stderr || '').slice(0, 80) }]; }
  return f.filter((x) => x.type !== 'banned font family'); // sablon fontlari referans sitenin fontlari, Doruk onayli (11 Kas); fontlar sablonun css dosyasinda
}

export async function restoranKapi(slug, { browser, base, out, veri, sablon, log = () => {} }) {
  const dir = path.join(veri, slug); const R = J(path.join(dir, 'cikarici.json')); const ik = J(path.join(dir, 'icerik.json'), {});
  const why = []; const warn = []; let page = null; let eylemUrl = null; let menuN = 0; let menuKaynak = null; let base0 = null;
  if (sablon === 'v5') {
    const { kapi } = await import('./kapi.mjs');
    base0 = await kapi(slug, { browser, base, out, veri, log });
    why.push(...(base0.reasons || [])); warn.push(...(base0.warnings || []));
    const U = J(path.join(dir, 'uret.json'), {});
    page = U.page; menuN = U.menuItems || 0; menuKaynak = U.menuKaynak || null; eylemUrl = ik.v5 && ik.v5.cta && ik.v5.cta.url;
    if (!U.statusOk) why.push('"şimdi açık" gösterilemiyor (7 günün saati ya da saat dilimi eksik)');
    if (!U.hoursOk) why.push('çalışma saatleri yok');
    if (U.logo) { const pf = path.join(out, path.dirname(U.page), 'img', U.logo.file); if (!fs.existsSync(pf) || sha(pf) !== R.logo.orig.sha256) why.push('logo dosyası bayt bayt aynı değil (sha256)'); } else why.push('logo yok');
    if (U.variant === 'tam' && U.hero && parseInt(String(U.hero.served).split('x')[0], 10) < 1920) why.push('tam ekran ana fotoğraf 1920 px altında');
  } else {
    const { kategoriKapi } = await import('./kategori-kapi.mjs'); const { pageDir } = await import('./uret-kategori.mjs');
    const rep = await kategoriKapi(slug, { browser, base, veri });
    why.push(...rep.sorunlar);
    const UK = J(path.join(dir, 'uret-kategori.json'), {});
    page = `${pageDir(slug)}/index.html`; const R2 = J(path.join(dir, 'cikarici.json'));
    menuN = ((R2.menu && R2.menu.items) || []).filter((x) => x.p).length; menuKaynak = ik.kategori && ik.kategori.menuKaynak; eylemUrl = R2.order && R2.order.url;
    if (!UK.logo || !UK.logo.ayni) why.push('logo dosyası bayt bayt aynı değil (sha256)');
    const pf = path.join(out, pageDir(slug), 'img', `logo${path.extname(R.logo.orig.file).toLowerCase()}`); if (!fs.existsSync(pf) || sha(pf) !== R.logo.orig.sha256) why.push('sayfadaki logo dosyası orijinalle aynı değil (sha256)');
    if (!R2.hours || !R2.hours.week || R2.hours.week.filter(Boolean).length + Object.values(R2.hours.byDay || {}).filter((x) => x === 'closed').length < 7) why.push('"şimdi açık" için 7 günün saati yok');
    for (const u of UK.uyarilar || []) if (/kontrast dusuk|kare yok|font dosyasi yok/.test(u)) why.push(u);
  }
  if (menuN < 6) why.push(`fiyatlı menü kalemi az (${menuN}; en az 6)`);
  if (!menuKaynak) why.push('menünün kaynağı kayıtlı değil');
  const html = page ? path.join(out, page) : null;
  // TR telefon eylemi (TR devam-3): kararda eylem 'telefon' ise ana eylem sayfanin ilk tel: baglantisidir (isletmenin kendi numarasi); ilk ekranda olmasi asagida olculur
  const telKarar = R.lead && R.lead.region === 'TR' && ((ik.v5 && ik.v5.cta && ik.v5.cta.tur === 'telefon') || (ik.kategori && ik.kategori.kategoriEk && ik.kategori.kategoriEk.eylemTur === 'telefon'));
  if (!eylemUrl && telKarar && html && fs.existsSync(html)) { const m = /<a\b[^>]*href="(tel:\+90\d{7,10})"/.exec(fs.readFileSync(html, 'utf8')); if (m) { eylemUrl = m[1]; warn.push(`ana eylem telefon (${m[1]}): sitede çevrimiçi sipariş/rezervasyon bağlantısı yok`); } }
  if (!eylemUrl) why.push('gerçek sipariş/rezervasyon bağlantısı yok');
  if (!html || !fs.existsSync(html)) why.push('sayfa dosyası yok');
  else {
    const lf = lintCopy(html); if (lf.length) why.push(`lint-copy ${lf.length} bulgu: ${lf.slice(0, 2).map((x) => `${x.type} "${String(x.sample || '').trim().slice(0, 30)}"`).join('; ')}`);
    const ham = fs.readFileSync(html, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    if (yasakVar('kisaltma', ham)) why.push('sayfa kaynağında yasak kısaltma geçiyor');
    if (!/<meta name="robots" content="noindex/.test(ham)) why.push('noindex yok');
    const td = await tarayiciDenetim(browser, `${base}/${page}`, eylemUrl, dir);
    why.push(...td.sorunlar);
  }
  const k = { ...(base0 || {}), surum: KAPI_SURUM, slug, name: R.name && R.name.n, site: R.lead.site, region: R.lead.region, sektor: 'restoran', sablon, at: new Date().toISOString(), status: why.length ? 'gozden-gecir' : 'hazir', reasons: [...new Set(why)], warnings: [...new Set(warn)], page: page ? path.dirname(page) : null, eylem: eylemUrl, menuKalem: menuN, menuKaynak, siki: true };
  fs.writeFileSync(path.join(dir, 'kapi.json'), JSON.stringify(k, null, 1));
  return k;
}
