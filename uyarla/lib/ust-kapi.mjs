// V5 UST KATMAN KAPISI (12 Kas 2026): restoran siki kapisinin (restoran-kapi.mjs) ustune eklenen maddeler.  Iki parca, ikisi de sayfayi degistirmez, yalniz olcer:
//   ustDosyaDenetimi({ sayfaDir, html, U })      dosyalar ve uretim kaydi: kayan yazi seridi yok, sahne ya da ince ayirici, her buyuk yuvadaki foto netlik + cozunurluk,
//                                                imlec izi varsa en az 4 temiz kesim ve kesim olculeri, atlas dosyasi
//   ustTarayiciDenetimi(browser, url, { U })     headless Chromium: LCP (4G benzeri aglarda masaustu ve telefon), sekmeler ve yemek fotograflari acilirken konsol hatasi 0,
//                                                kirik gorsel 0, imlec izi katmani, kayan yazi seridi DOM'da yok
// Donus: { sorunlar: [...], uyarilar: [...], olcum }.  Sorun = sayfa yayin paketine girmez; uyari = son goze gider.
import fs from 'node:fs';
import path from 'node:path';
import { netlikOlc, netlikGecer, cozunurlukYeter } from './netlik.mjs';
import { kesimKalite, KESME_ESIK } from './kesme-v5.mjs';

export const LCP_ESIK_MS = 2500;
// telefonda (Lighthouse "slow 4G", 1.6 Mbps) 2500 ms tek bir kahraman gorseliyle ancak kucuk dosyayla tutar: 2500-4000 arasi son goze uyari, 4000 ustu (Google'in "kotu" siniri) sorun
export const LCP_TELEFON_SORUN_MS = 4000;
export const BUYUTME_ESIK = 1.08;
// ag profilleri (CDP): Lighthouse "slow 4G" ve "regular 4G" (bayt/sn)
export const AG = { telefon: { latency: 150, downloadThroughput: Math.round(1.6e6 / 8), uploadThroughput: Math.round(0.75e6 / 8) }, masaustu: { latency: 80, downloadThroughput: Math.round(9e6 / 8), uploadThroughput: Math.round(3e6 / 8) } };

const YUVALAR = [
  { ad: 'kahraman', re: /^hero-(\d+)\.webp$/, seviye: 'siki', anahtar: () => 'hero' },
  { ad: 'sahne', re: /^sahne-(\d+)\.webp$/, seviye: 'siki', taban: 'sahne', anahtar: () => 'sahne' },
  { ad: 'menü paneli', re: /^mx-(.+)-(\d+)\.webp$/, seviye: 'buyuk', anahtar: (m) => `mx-${m[1]}`, atla: (m) => m[2] === 't' },
  { ad: 'galeri', re: /^gal-(.+)-(\d+)\.webp$/, seviye: 'buyuk', taban: 'galeri', anahtar: (m) => `gal-${m[1]}` },
  { ad: 'bölüm karesi', re: /^p(\d+)-(\d+)\.webp$/, seviye: 'buyuk', anahtar: (m) => `p${m[1]}` },
];

// Sayfa icinde (hareket acik, .ust-on): ekranda gorunen her fotografin gercek dosya pikseline gore buyutme orani.  Temel kapi (restoran-kapi.mjs) ?capture=1 ile duragan hali olcer;
// sahne dairesinin buyumesi, sekme ve dokunmayla acilan yemek fotograflari, galeri seridi gibi hareketli ve tembel yuvalari bu olcum yakalar.  k = gorunen / dosya x kutu olcegi x ekran yogunlugu
export async function sayfaBuyutme(esik) {
  window.__px = window.__px || {};
  for (const im of document.querySelectorAll('img')) { const u = im.currentSrc || im.src; if (!u || window.__px[u] || !im.complete || !im.naturalWidth) continue; const t = new Image(); t.src = u; try { await t.decode(); window.__px[u] = [t.naturalWidth, t.naturalHeight]; } catch { window.__px[u] = [im.naturalWidth, im.naturalHeight]; } }
  const vw = innerWidth; const vh = innerHeight; const dpr = devicePixelRatio; const S = [];
  const olcek = (el) => { let k = 1; for (let p = el; p && p !== document.body; p = p.parentElement) { const t = getComputedStyle(p).transform; if (t && t !== 'none') { const m = new DOMMatrix(t); k *= Math.sqrt(m.a * m.a + m.b * m.b); } } return k; };
  const gorunur = (el) => { for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  for (const im of document.querySelectorAll('img')) {
    const u = im.currentSrc || im.src; if (!u || /logo/i.test(u) || im.classList.contains('mx-thumb')) continue;
    if (!im.complete || !im.naturalWidth || !im.offsetWidth || !gorunur(im)) continue;
    const b = im.getBoundingClientRect(); if (b.bottom <= 0 || b.top >= vh || b.right <= 0 || b.left >= vw) continue;
    const [nw, nh] = window.__px[u] || [im.naturalWidth, im.naturalHeight]; const cs = getComputedStyle(im);
    const sx = im.offsetWidth / nw; const sy = im.offsetHeight / nh; const k = (cs.objectFit === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy)) * olcek(im) * dpr;
    if (k > esik) S.push(`${u.split('/').pop().split('?')[0]} x${k.toFixed(2)}`);
  }
  return S;
}

// sayfaDir: <out>/r/<slug>-<kod>; html: index.html metni; U: uret.json
export async function ustDosyaDenetimi({ sayfaDir, html, U = {} }) {
  const sorunlar = []; const uyarilar = []; const olcum = { netlik: {} };
  const ust = U.ust || {};
  // 1. kayan yazi seridi hicbir sayfada yok (Doruk 12 Kas: "ucuz kaciyor")
  if (/class="[^"]*\bmarquee\b/.test(html) || /\bmarquee-in\b/.test(html)) sorunlar.push('kayan yazı şeridi (marquee) sayfada: kalıcı kural, yerinde sahne ya da ince ayırıcı olur');
  // 2. ust katman uygulanmis; sahne ya da ince ayirici (tam biri)
  if (!ust.var || !/\/ust\.css"/.test(html) || !/\/ust\.js"/.test(html)) sorunlar.push('üst katman uygulanmamış (ust.css / ust.js bağlı değil)');
  const sahne = /<section class="sahne(?: [^"]*)?"/.test(html); const ayirac = /<div class="ayrac"/.test(html); // sahne-m0: telefonda ince ayiricinin yerini alan sahne de sahnedir
  if (sahne === ayirac) sorunlar.push('kahramandan sonra ya yemek sahnesi ya da ince ayırıcı olmalı');
  // 3. netlik + cozunurluk: sayfanin kullandigi her buyuk yuvadaki fotograf (en buyuk dosya)
  const imgD = path.join(sayfaDir, 'img'); const dosyalar = fs.existsSync(imgD) ? fs.readdirSync(imgD) : [];
  const grup = new Map();
  for (const f of dosyalar) {
    if (!html.includes(`img/${f}`)) continue;
    for (const y of YUVALAR) {
      const m = y.re.exec(f); if (!m) continue; if (y.atla && y.atla(m)) break;
      const w = Number(m[m.length - 1]); const k = y.anahtar(m); const g = grup.get(k);
      if (!g || w > g.w) grup.set(k, { y, w, f });
      break;
    }
  }
  for (const [k, g] of grup) {
    const m = await netlikOlc(fs.readFileSync(path.join(imgD, g.f)));
    olcum.netlik[k] = m.hata ? { hata: m.hata } : { dosya: g.f, w: m.w, h: m.h, p75: m.p75, p90: m.p90 };
    const n = netlikGecer(m, g.y.seviye); if (!n.ok) sorunlar.push(`yumuşak görüntü: ${g.y.ad} ${g.f}: ${n.neden}`);
    if (g.y.taban && !m.hata) { const c = cozunurlukYeter({ w: m.w, h: m.h }, g.y.taban); if (!c.ok) sorunlar.push(`düşük çözünürlük: ${g.y.ad} ${g.f}: ${c.neden}`); }
  }
  // kahramanin uretim anindaki olcusu (kaynak dosya; sayfadaki en buyuk dosyayla ayni foto)
  if (U.heroNetlik && U.heroNetlik.ok === false) sorunlar.push(`ana fotoğraf yumuşak: ${U.heroNetlik.neden}`);
  // 4. imlec izi: varsa en az 4 temiz kesim ve kesim olculeri; yoksa (python/opencv yok, kesim yetmedi) yalniz uyari
  const izRapor = ust.izRapor || null;
  if (ust.iz) {
    if (ust.iz < KESME_ESIK.enAz) sorunlar.push(`imleç izinde ${ust.iz} kesim (en az ${KESME_ESIK.enAz})`);
    const gecen = (izRapor && izRapor.gecen) || [];
    if (gecen.length !== ust.iz) sorunlar.push('iz kesimlerinin ölçü kaydı eksik');
    for (const g of gecen) for (const s of kesimKalite(g)) sorunlar.push(`kesim ${g.ad}: ${s}`);
    const atlas = dosyalar.find((f) => /^iz-[0-9a-f]{8}\.webp$/.test(f));
    if (!atlas || !html.includes(`img/${atlas}`)) sorunlar.push('iz atlas dosyası yok');
    olcum.iz = { n: ust.iz, kesimler: gecen.map((g) => ({ ad: g.ad, kenarKontrast: g.kenarKontrast, doluluk: g.doluluk, kenarTemas: g.kenarTemas })) };
  } else if (izRapor && izRapor.durum !== 'kesim-yok') uyarilar.push(`imleç izi yok (${izRapor.durum}${(izRapor.elenen || []).length ? `: ${izRapor.elenen.slice(0, 3).map((x) => `${x.ad} ${x.neden}`).join('; ')}` : ''})`);
  return { sorunlar, uyarilar, olcum };
}

// tarayici: LCP + etkilesim.  browser: Playwright Chromium; url: tam sayfa adresi (yerel sunucu)
export async function ustTarayiciDenetimi(browser, url, { U = {} } = {}) {
  const sorunlar = []; const uyarilar = []; const olcum = { lcp: {} };
  const kaynak = new URL(url).origin;
  for (const [etiket, vp, opt, ag] of [['telefon', { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }, AG.telefon], ['masaüstü', { width: 1440, height: 900 }, {}, AG.masaustu], ['1920', { width: 1920, height: 1080 }, {}, AG.masaustu]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'no-preference', ...opt });
    const pg = await ctx.newPage(); const hata = []; const kirik = []; const buyuk = new Set(); const olc = async () => { for (const s of await pg.evaluate(sayfaBuyutme, BUYUTME_ESIK)) buyuk.add(s); };
    pg.on('console', (m) => { if (m.type() === 'error') hata.push(m.text().slice(0, 160)); }); pg.on('pageerror', (e) => hata.push(String(e.message).slice(0, 160)));
    pg.on('requestfailed', (r) => { if (r.url().startsWith(kaynak)) kirik.push(r.url().split('/').pop().split('?')[0]); });
    await pg.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(kaynak) || u.startsWith('data:')) return r.continue(); return r.abort(); });
    try {
      const cdp = await ctx.newCDPSession(pg); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...ag });
      await pg.addInitScript(() => { window.__lcp = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch { /* LCP yok */ } });
      await pg.goto(url, { waitUntil: 'load', timeout: 60000 }); await pg.waitForTimeout(1200);
      const lcp = await pg.evaluate(() => Math.round(window.__lcp)); olcum.lcp[etiket] = lcp;
      if (!lcp) uyarilar.push(`LCP ölçülemedi (${etiket})`);
      else if (etiket === 'telefon') { if (lcp > LCP_TELEFON_SORUN_MS) sorunlar.push(`LCP ${lcp} ms (telefon; en çok ${LCP_TELEFON_SORUN_MS} ms, slow 4G)`); else if (lcp > LCP_ESIK_MS) uyarilar.push(`LCP ${lcp} ms (telefon, slow 4G; hedef ${LCP_ESIK_MS} ms)`); } else if (lcp > LCP_ESIK_MS) sorunlar.push(`LCP ${lcp} ms (${etiket}; en çok ${LCP_ESIK_MS} ms, 4G benzeri ağ)`);
      await pg.evaluate(() => document.fonts.ready);
      // kayan yazi seridi DOM'da yok (CSS ile gizlenmis bile olsa)
      if (await pg.evaluate(() => !!document.querySelector('.marquee, .marquee-in, [class*="marquee"]'))) sorunlar.push(`${etiket}: kayan yazı şeridi DOM'da`);
      // menu sekmeleri: her sekme acilir, tek panel gorunur, yemek fotograflari yuklenir
      const sekme = await pg.$$('.mx-tab');
      for (let i = 0; i < sekme.length; i++) {
        await pg.evaluate((n) => document.querySelectorAll('.mx-tab')[n].scrollIntoView({ block: 'center' }), i);
        await sekme[i].click({ timeout: 4000 }).catch(() => { sorunlar.push(`${etiket}: menü sekmesi ${i + 1} tıklanamadı`); });
        await pg.waitForTimeout(650); await olc();
        const acik = await pg.evaluate(() => [...document.querySelectorAll('.mx-panel')].filter((p) => !p.hidden && getComputedStyle(p).display !== 'none').length);
        if (acik !== 1) sorunlar.push(`${etiket}: menü sekmesi ${i + 1} açılınca ${acik} panel görünür (1 olmalı)`);
      }
      // yemek fotografi: satira dokun / uzerine gel; fotograf yuklenir
      const hit = await pg.$('.mx-hit');
      if (hit) { await hit.scrollIntoViewIfNeeded().catch(() => {}); if (etiket === 'telefon') await hit.tap({ timeout: 4000 }).catch(() => {}); else await pg.hover('.mx-dish[data-k]', { timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(700); await olc(); }
      // her sayfa konumunda yuklenmis ama kirik (naturalWidth 0) gorsel yok
      const H = await pg.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += vp.height * 0.5) { await pg.evaluate((yy) => scrollTo(0, yy), y); await pg.waitForTimeout(260); await olc(); }
      const bozuk = await pg.evaluate(() => [...document.querySelectorAll('img')].filter((i) => i.getAttribute('src') && i.complete && !i.naturalWidth).map((i) => (i.getAttribute('src') || '').split('/').pop()));
      for (const b of [...new Set([...bozuk, ...kirik])]) sorunlar.push(`${etiket}: kırık görsel: ${b}`);
      for (const b of buyuk) sorunlar.push(`${etiket}: büyütülmüş görsel (bulanık, hareket açık): ${b}`);
      // imlec izi (yalniz masaustu: ince isaretci): veri varsa katman kurulur ve calisir
      if (etiket === 'masaüstü' && U.ust && U.ust.iz) {
        await pg.evaluate(() => scrollTo(0, 0));
        for (let i = 0; i < 14; i++) { await pg.mouse.move(120 + i * 70, 300 + (i % 4) * 90, { steps: 4 }); await pg.waitForTimeout(40); }
        const iz = await pg.evaluate(() => ({ katman: !!document.querySelector('.iz-v5 canvas'), api: !!window.__izv5 }));
        olcum.iz = iz; if (!iz.katman || !iz.api) sorunlar.push('imleç izi kurulamadı (atlas yüklenmedi ya da iz.js çalışmadı)');
      }
      for (const h of [...new Set(hata)]) sorunlar.push(`${etiket}: konsol: ${h}`);
    } catch (e) { sorunlar.push(`${etiket}: üst katman denetimi durdu (${String(e.message).slice(0, 100)})`); }
    await ctx.close();
  }
  return { sorunlar: [...new Set(sorunlar)], uyarilar, olcum };
}
