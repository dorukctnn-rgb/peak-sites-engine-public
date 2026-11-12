// KATEGORI KAPISI (burger, burrito, pizza): uret-kategori.mjs ciktisini tek headless Chromium'da olcer ve goruntuler.  Yerel kategori-test.mjs'in
// (Ajan B, 11 Kas) islev bicimi: tarayici disaridan verilir, video kaydi yok.  Olculenler ayni: konsol/sayfa hatasi, yerel olmayan istek (engellenir, sayilir),
// yatay tasma, kutusundan tasan yazi, bozuk ve BUYUTULMUS (bulanik) gorsel, bos bolum, ilk ekranda saat/adres/telefon/simdi acik + tek ana eylem, fontlar,
// yasak kisaltma ve yer adlari, azaltilmis harekette efektin kapali oldugu, imlec efekti (parcacik siniri 40), telefonda dokunma patlamasi.
//   kategoriKapi(slug, { browser, base, veri }) -> rapor { sorunlar[], olcum, dosyalar }  ; <veri>/<slug>/sonra-{1440,1920,390}.jpg + test-kategori/rapor.json
import fs from 'node:fs';
import path from 'node:path';
import { sharp } from './lib/gorsel.mjs';
import { pageDir } from './uret-kategori.mjs';
import { kalip } from './lib/sozluk.mjs';
// tarayici icinde calisan denetime yasak kalip KAYNAK olarak gecer (modul kapsami tarayiciya tasinmaz; kalip yoksa kalip() hata firlatir: fail-closed)
export const kalipArg = (ad) => { const r = kalip(ad); return [r.source, r.flags.replace('g', '')]; };

// sayfa ici denetim (tek fonksiyon; her genislikte)
export const DENETIM = async (arg) => {
  const { orderUrl, kis } = arg && typeof arg === 'object' ? arg : { orderUrl: arg, kis: null };
  window.__px = window.__px || {};
  for (const im of document.querySelectorAll('img')) { const u = im.currentSrc || im.src; if (!u || window.__px[u] || !im.complete || !im.naturalWidth) continue; const t = new Image(); t.src = u; try { await t.decode(); window.__px[u] = [t.naturalWidth, t.naturalHeight]; } catch { window.__px[u] = [im.naturalWidth, im.naturalHeight]; } }
  const vw = innerWidth, vh = innerHeight, dpr = devicePixelRatio, S = [];
  const gorunur = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
  const kirpilmis = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(o.overflowX)) { const b = p.getBoundingClientRect(); if (b.right <= vw + 1 && b.left >= -1) return true; } } return false; };
  const r = { vw, sw: document.documentElement.scrollWidth };
  if (r.sw > vw + 1) S.push(`yatay tasma: sayfa ${r.sw} > ${vw}`);
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.iz')) continue;
    const b = el.getBoundingClientRect(); if (!b.width || !gorunur(el)) continue;
    if ((b.right > vw + 1 || b.left < -1) && getComputedStyle(el).position !== 'fixed' && !kirpilmis(el)) S.push(`tasan oge: ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(b.left)}..${Math.round(b.right)}`);
  }
  // kutusundan tasan yazi
  for (const el of document.querySelectorAll('.l1, .l2, .h2, .btn, .status, .facts b, .mi-n, .mi-p, .tab, .card figcaption, .fact-v, .stk, .bar a')) {
    if (!gorunur(el)) continue; const b = el.getBoundingClientRect();
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') S.push(`yazi kutusundan tasiyor: ${el.className} "${el.textContent.trim().slice(0, 30)}"`);
    if ((el.matches('.l1, .l2')) && (b.right > vw - 2 || b.left < 2)) S.push(`baslik satiri ekran kenarina tasiyor: "${el.textContent.trim().slice(0, 30)}" ${Math.round(b.left)}..${Math.round(b.right)}`);
  }
  // gorseller: bozuk / buyutulmus
  const G = [];
  const olcek = (el) => { let k = 1; for (let p = el; p && p !== document.body; p = p.parentElement) { const t = getComputedStyle(p).transform; if (t && t !== 'none') { const m = new DOMMatrix(t); k *= Math.sqrt(m.a * m.a + m.b * m.b); } } return k; };
  for (const im of document.querySelectorAll('img')) {
    if (!gorunur(im) || !im.offsetWidth) continue;
    if (!im.complete || !im.naturalWidth) { if (!im.loading || im.loading !== 'lazy' || im.complete) S.push(`bozuk gorsel: ${im.getAttribute('src')}`); continue; }
    const cs = getComputedStyle(im); const [nw, nh] = window.__px[im.currentSrc || im.src] || [im.naturalWidth, im.naturalHeight]; const sx = im.offsetWidth / nw, sy = im.offsetHeight / nh;
    const k = (cs.objectFit === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy)) * olcek(im) * dpr;
    G.push({ src: (im.currentSrc || im.src).split('/').pop().split('?')[0], css: `${im.offsetWidth}x${im.offsetHeight}`, dogal: `${nw}x${nh}`, k: +k.toFixed(2) });
    if (k > 1.08) S.push(`buyutulmus gorsel (bulanik): ${G[G.length - 1].src} ${G[G.length - 1].css} css, dogal ${G[G.length - 1].dogal}, x${k.toFixed(2)}`);
  }
  // bos bolum
  for (const s of document.querySelectorAll('main > section, main > div, footer')) { const t = s.innerText.replace(/\s+/g, ' ').trim(); if (t.length < 12 && !s.querySelector('img,canvas,video')) S.push(`bos bolum: ${s.className || s.id}`); }
  for (const p of document.querySelectorAll('.panel')) if (!p.querySelector('.mi')) S.push(`bos menu sekmesi: ${p.id}`);
  // metin: yasak kisaltma ve yer adlari
  const metin = [document.title, document.querySelector('meta[name=description]')?.content || '', document.body.innerText, ...[...document.querySelectorAll('[alt],[aria-label],[title]')].map((e) => `${e.getAttribute('alt') || ''} ${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''}`)].join(' \n ');
  if (!kis) S.push('yasak kisaltma kalibi verilmedi'); else if (new RegExp(kis[0], kis[1]).test(metin)) S.push('metinde yasak kisaltma geciyor');
  // TR sayfasi (lang=tr, 11 Kas): adres ve sehir isletmenin kendisinin (Kadıköy/İstanbul, Lara/Antalya); bizim konumumuz sayfada hic yok, kural yalniz yurt disi sayfalarda
  if (document.documentElement.lang !== 'tr' && /T[uü]rkiye|Turkey|Antalya/i.test(metin)) S.push('metinde yasak yer adi');
  // ilk ekran: saat, adres, telefon, simdi acik, ana eylem
  const ilk = (el) => { if (!el || !gorunur(el)) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.top < vh - 2 && b.bottom > 2; };
  const st = document.querySelector('.top [data-status]');
  const ie = { durum: ilk(st) && !st.hasAttribute('data-empty') ? st.textContent.trim() : null, saat: ilk(document.querySelector('[data-today]')) ? document.querySelector('[data-today]').textContent.trim() : null, adres: ilk(document.querySelector('.facts a[href*="maps"]')), telefon: ilk(document.querySelector('.facts a[href^="tel:"]')) || ilk(document.querySelector('.bar a[href^="tel:"]')) };
  const eylemler = [...document.querySelectorAll('.cta .btn, .bar a.main, .top .btn')].filter(ilk);
  ie.eylem = eylemler.length ? eylemler.map((a) => a.getAttribute('href')).filter((h, i, a) => a.indexOf(h) === i) : [];
  ie.slogan = ilk(document.querySelector('.l1'));
  for (const [k, v] of Object.entries(ie)) if (!v || (Array.isArray(v) && !v.length)) S.push(`ilk ekranda yok: ${k}`);
  if (orderUrl && ie.eylem.length && !ie.eylem.every((h) => h === orderUrl)) S.push(`ilk ekranda birden cok ana eylem: ${ie.eylem.join(' | ')}`);
  // font
  const h1f = getComputedStyle(document.querySelector('.l1')).fontFamily;
  // yuklenen yuz aileleri (kategoriden bagimsiz: burger Mouse Memoirs/Modak/Barlow, burrito Archivo Black/Figtree, ...)
  const fonts = { h1: h1f.split(',')[0].replace(/"/g, ''), yuklu: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')))] };
  return { ...r, sorun: S, gorsel: G, ilkEkran: ie, fonts, h: document.documentElement.scrollHeight };
};

// kart fotograflari (pizza kaydiricisi): her karti ortaya kaydirip fotografin yuklendigini, buyutulmedigini (gercek piksel), srcset + tembel oldugunu,
// fotografli kaydiricida hicbir kartin ust alaninin bos kalmadigini olcer
export const KART_DENETIM = async () => {
  const sl = document.getElementById('slides'); if (!sl) return { kart: 0, foto: 0, sorun: [] };
  const S = []; const kartlar = [...sl.querySelectorAll('.slide')]; const adi = (c) => (c.querySelector('.slide-n') || {}).textContent?.trim() || c.id;
  const sb = sl.style.scrollBehavior; sl.style.scrollBehavior = 'auto'; sl.scrollIntoView({ block: 'center' });
  for (const c of kartlar) { sl.scrollLeft = c.offsetLeft - (sl.clientWidth - c.offsetWidth) / 2; await new Promise((r) => setTimeout(r, 140)); }
  const imgs = [...sl.querySelectorAll('.slide-f img')];
  await Promise.all(imgs.map((im) => (im.complete ? 0 : new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); setTimeout(r, 5000); }))));
  for (const im of imgs) {
    const ad = adi(im.closest('.slide'));
    if (!im.naturalWidth) { S.push(`kart fotografi yuklenmedi: ${ad}`); continue; }
    const t = new Image(); t.src = im.currentSrc || im.src; try { await t.decode(); } catch { /* olcu asagida 0 kalir */ }
    const k = t.naturalWidth ? Math.max(im.offsetWidth / t.naturalWidth, im.offsetHeight / t.naturalHeight) * devicePixelRatio : 0;
    if (k > 1.08) S.push(`kart fotografi buyutulmus (bulanik): ${ad} ${im.offsetWidth}x${im.offsetHeight} css, dogal ${t.naturalWidth}x${t.naturalHeight}, x${k.toFixed(2)}`);
    if (!im.getAttribute('srcset') || im.getAttribute('loading') !== 'lazy') S.push(`kart fotografi srcset ya da tembel yukleme yok: ${ad}`);
  }
  if (sl.classList.contains('has-f')) for (const c of kartlar) { const u = c.querySelector('.slide-f, .slide-m'); if (!u || u.offsetHeight < 60 || !u.querySelector('img, .spr')) S.push(`kart ust alani bos: ${adi(c)}`); }
  sl.scrollLeft = 0; sl.style.scrollBehavior = sb;
  return { kart: kartlar.length, foto: imgs.length, sorun: S };
};

export async function kategoriKapi(slug, { browser, base, veri }) {
  const dir = path.join(veri, slug, 'test-kategori'); fs.mkdirSync(dir, { recursive: true });
  const R = JSON.parse(fs.readFileSync(path.join(veri, slug, 'cikarici.json'), 'utf8'));
  const orderUrl = (R.order && R.order.url) || null;
  const srv = { url: base };
  const url = `${base}/${pageDir(slug)}/index.html`;
  const rep = { slug, at: new Date().toISOString(), url: pageDir(slug), hatalar: [], disIstek: [], olcum: {}, sorunlar: [], dosyalar: [] };
  // kendi sitesinde adi tasiyan fotografi olan kart fotografsiz kalmaz (elle "null" ile bastirilan haric)
  const UR = (() => { try { return JSON.parse(fs.readFileSync(path.join(veri, slug, 'uret-kategori.json'), 'utf8')); } catch { return {}; } })();
  const kartBeklenen = (UR.kartFoto || []).filter((k) => k.id).length;
  for (const k of UR.kartFoto || []) if (!k.id && k.aday && !k.bastirildi) rep.sorunlar.push(`kart fotografsiz ama kendi sitesinde fotografi var: ${k.ad} (kare ${k.aday})`);
  const jpg = async (pg, file, q = 82, clip, ust = false) => { const b = await pg.screenshot({ type: 'png', clip }); await sharp(b).jpeg({ quality: q, mozjpeg: true }).toFile(path.join(ust ? path.join(veri, slug) : dir, file)); rep.dosyalar.push(file); };
  const guard = async (pg, label) => {
    pg.on('console', (m) => { if (m.type() === 'error') rep.hatalar.push(`${label}: ${m.text().slice(0, 180)}`); });
    pg.on('pageerror', (e) => rep.hatalar.push(`${label}: ${String(e.message).slice(0, 180)}`));
    pg.on('requestfailed', (r) => { if (r.url().startsWith(srv.url)) rep.hatalar.push(`${label}: istek basarisiz ${r.url().replace(srv.url, '')}`); });
    await pg.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(srv.url) || u.startsWith('data:')) return r.continue(); rep.disIstek.push(`${label}: ${u.slice(0, 120)}`); return r.abort(); });
  };
  const tumSayfa = (pg) => pg.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += innerHeight * 0.7) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 70)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 300)); });
  const BOLUM = false;
    /* ---- 1) duragan ilk ekranlar + denetim: 1440, 1920, 390 ---- */
    for (const [label, vp, opt] of [['1440', { width: 1440, height: 900 }, {}], ['1920', { width: 1920, height: 1080 }, {}], ['390', { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'no-preference', ...opt });
      const pg = await ctx.newPage(); await guard(pg, label);
      await pg.goto(`${url}?capture=1`, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(500);
      const ilk = await pg.evaluate(DENETIM, { orderUrl, kis: kalipArg('kisaltmaKelime') });
      await jpg(pg, `sonra-${label}.jpg`, 86, undefined, true);
      await tumSayfa(pg); await pg.waitForTimeout(400);
      // tum bolumleri gezip gorselleri denetle (tembel yuklenenler dahil)
      const bolumler = await pg.evaluate(() => [...document.querySelectorAll('main > section, main > div.ticker, footer')].map((s) => ({ ad: s.id || s.className.split(' ')[0], y: Math.round(s.getBoundingClientRect().top + scrollY), h: Math.round(s.offsetHeight) })));
      const tum = { sorun: [], gorsel: [] };
      for (const b of bolumler) {
        await pg.evaluate((y) => scrollTo(0, y), Math.max(0, b.y - (label === '390' ? 70 : 90))); await pg.waitForTimeout(260);
        const a = await pg.evaluate(DENETIM, { orderUrl, kis: kalipArg('kisaltmaKelime') });
        for (const s of a.sorun) if (!s.startsWith('ilk ekranda') && !tum.sorun.includes(s)) tum.sorun.push(s);
        for (const g of a.gorsel) if (!tum.gorsel.find((x) => x.src === g.src && x.css === g.css)) tum.gorsel.push(g);
        if (BOLUM) await jpg(pg, `bolum-${label}-${b.ad}.jpg`, 78);
      }
      const kd = await pg.evaluate(KART_DENETIM);
      if (kd.foto !== kartBeklenen) kd.sorun.push(`kart fotografi sayisi ${kd.foto}, beklenen ${kartBeklenen}`);
      rep.olcum[label] = { ilkEkran: ilk.ilkEkran, fonts: ilk.fonts, sayfaH: ilk.h, ilkSorun: ilk.sorun, bolumler, sorun: tum.sorun, gorsel: tum.gorsel, kart: kd };
      for (const s of [...ilk.sorun, ...tum.sorun, ...kd.sorun]) rep.sorunlar.push(`${label}: ${s}`);
      await ctx.close();
    }
    /* ---- 2) hareketli masaustu: imlec zinciri, ust uste burger, sacilma, tiklama patlamasi, kare suresi ---- */
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      const pg = await ctx.newPage(); await guard(pg, 'imlec');
      await pg.goto(`${url}?nointro=1`, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
      await pg.mouse.move(700, 400); await pg.waitForFunction(() => !!window.__iz && !!document.querySelector('.iz canvas'), null, { timeout: 8000 }).catch(() => {});
      const var_ = await pg.evaluate(() => !!window.__iz);
      if (!var_) rep.sorunlar.push('imlec: efekt yuklenmedi');
      // kare suresi olcer
      await pg.evaluate(() => { window.__fps = { n: 0, long: 0, max: 0, t: 0 }; let last = 0; const f = (t) => { if (last) { const d = t - last; window.__fps.n++; window.__fps.t += d; if (d > 24) window.__fps.long++; if (d > window.__fps.max) window.__fps.max = d; } last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
      // yavas egri: zincir
      for (let i = 0; i <= 70; i++) { const a = i / 70; await pg.mouse.move(380 + a * 700, 300 + Math.sin(a * Math.PI * 2) * 150); await pg.waitForTimeout(14); }
      await jpg(pg, 'imlec-zincir.jpg', 84, { x: 500, y: 60, width: 760, height: 520 });
      await pg.waitForTimeout(1500);
      const yer = { x: 1080, y: 300 };
      await jpg(pg, 'imlec-burger.jpg', 88, { x: yer.x - 60, y: yer.y - 80, width: 260, height: 240 });
      // hizli hareket: sacilma
      for (let i = 0; i <= 18; i++) { await pg.mouse.move(1080 - i * 42, 300 + i * 18); await pg.waitForTimeout(8); }
      const liveFast = await pg.evaluate(() => window.__iz && window.__iz.live());
      await pg.mouse.click(560, 470); await pg.waitForTimeout(16); await pg.mouse.click(640, 430);
      await pg.waitForTimeout(120);
      const liveBurst = await pg.evaluate(() => window.__iz && window.__iz.live());
      await jpg(pg, 'imlec-sacilma.jpg', 84, { x: 200, y: 140, width: 900, height: 760 });
      for (let i = 0; i < 12; i++) { await pg.mouse.click(400 + i * 40, 500); }
      const liveMax = await pg.evaluate(() => window.__iz && window.__iz.live());
      await pg.waitForTimeout(2600);
      const liveEnd = await pg.evaluate(() => window.__iz && window.__iz.live());
      const fps = await pg.evaluate(() => window.__fps);
      rep.olcum.imlec = { yuklendi: var_, parcacikHizli: liveFast, parcacikPatlama: liveBurst, parcacikTepe: liveMax, parcacikSonra: liveEnd, ust: 40, kare: { sayi: fps.n, ortMs: +(fps.t / Math.max(1, fps.n)).toFixed(2), uzun: fps.long, enUzunMs: +fps.max.toFixed(1) } };
      if (liveMax > 40) rep.sorunlar.push(`imlec: parcacik siniri asildi ${liveMax}`);
      if (!liveBurst) rep.sorunlar.push('imlec: tiklamada patlama yok');
      // dugme ustunde zincir solar mi (tiklanan yer kapanmasin)
      const btn = await pg.$('.top .btn'); if (btn) { const bb = await btn.boundingBox(); await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 }); await pg.waitForTimeout(500); }
      rep.olcum.imlec.dugmeUstu = await pg.evaluate(() => { const c = document.querySelector('.iz canvas'); if (!c) return null; const g = c.getContext('2d'); const b = document.querySelector('.top .btn').getBoundingClientRect(); const d = g.getImageData(Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 30) n++; return n; });
      await ctx.close();
    }
    /* ---- 3) telefon: dokunma patlamasi ---- */
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
      const pg = await ctx.newPage(); await guard(pg, 'dokunma');
      await pg.goto(`${url}?nointro=1`, { waitUntil: 'load' }); await pg.waitForFunction(() => !!window.__iz, null, { timeout: 8000 }).catch(() => {});
      await pg.touchscreen.tap(195, 520); await pg.waitForTimeout(140);
      const live = await pg.evaluate(() => window.__iz && window.__iz.live());
      await jpg(pg, 'dokunma-390.jpg', 82);
      rep.olcum.dokunma = { yuklendi: await pg.evaluate(() => !!window.__iz), parcacik: live };
      if (!live) rep.sorunlar.push('telefon: dokunmada patlama yok');
      await ctx.close();
    }
    /* ---- 4) azaltilmis hareket: efekt ve acilis kapali, icerik gorunur ---- */
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const pg = await ctx.newPage(); await guard(pg, 'azaltilmis');
      await pg.goto(url, { waitUntil: 'load' }); await pg.mouse.move(600, 400); await pg.mouse.move(900, 500, { steps: 10 }); await pg.waitForTimeout(2200);
      rep.olcum.azaltilmis = await pg.evaluate(() => ({ iz: !!document.querySelector('.iz') || !!window.__iz, intro: getComputedStyle(document.querySelector('.intro')).display, h1: document.querySelector('.l1').getBoundingClientRect().height > 10, kart: [...document.querySelectorAll('.card')].every((c) => +getComputedStyle(c).opacity === 1) }));
      if (rep.olcum.azaltilmis.iz) rep.sorunlar.push('azaltilmis harekette imlec efekti acik');
      if (rep.olcum.azaltilmis.intro !== 'none') rep.sorunlar.push('azaltilmis harekette acilis var');
      await ctx.close();
    }
  rep.hatalar = [...new Set(rep.hatalar)]; rep.disIstek = [...new Set(rep.disIstek)];
  if (rep.hatalar.length) rep.sorunlar.push(...rep.hatalar.map((h) => `konsol: ${h}`));
  if (rep.disIstek.length) rep.sorunlar.push(...rep.disIstek.map((h) => `dis istek: ${h}`));
  rep.sorunlar = [...new Set(rep.sorunlar)];
  fs.writeFileSync(path.join(dir, 'rapor.json'), JSON.stringify(rep, null, 1));
  return rep;
}
