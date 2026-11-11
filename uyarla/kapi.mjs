// 4. ADIM: KALITE KAPISI + "gozden gecir" listesi.  node uyarla/kapi.mjs <slug,...|hepsi> [--out <web/demo>] [--force]
// Uretilen sayfayi yerel sunucudan (127.0.0.1, disariya cikis yok) TEK headless Chromium ile 1440 ve 390 px'te acar; kontrast, eksik fotograf, bozuk gorsel, tasma, font yuklenmesi ve
// ilk ekranin yazi okunurlugunu OLCER; 1440 ve 390 ekran goruntusu alir; sonucu <veri>/<slug>/kapi.json'a ve toplu listelere (LISTE.md) yazar.
// Gozden gecir listesindekiler maile GIRMEZ. Doruk'un Chrome'u kullanilmaz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharp } from './lib/gorsel.mjs';
import { lin } from './lib/gorsel.mjs';
import { openBrowser } from './lib/ziyaret.mjs';
import { sunucu } from './lib/sunucu.mjs';
import { VERI, DEMO } from './uret.mjs';
import { profil } from './sektor/index.mjs';
import { KAPI_SURUM } from './lib/surum.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// sayfa icinde
function olc() {
  const de = document.documentElement; const out = {};
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const inScroller = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const ox = getComputedStyle(e).overflowX; if ((ox === 'auto' || ox === 'scroll') && e !== document.body && e !== de) return true; } return false; };
  out.innerW = innerWidth; out.scrollW = de.scrollWidth; out.overflowX = de.scrollWidth > innerWidth + 1;
  const off = [];
  for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,li,span,td,th,label,b,small,legend,figcaption')) {
    if (!vis(el) || inScroller(el) || el.closest('.kb,.hero-media,.map svg,.marquee')) continue;
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1 || r.left < -1) off.push(`${el.tagName.toLowerCase()}.${String(el.className || '').slice(0, 18)} "${(el.textContent || '').trim().slice(0, 28)}" ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  out.offenders = off.slice(0, 8);
  const clip = [];
  for (const el of document.querySelectorAll('.btn,.tab,.dish h3,.facts li,.brand,.status,.chips label')) { if (!vis(el)) continue; if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && !/brand-t/.test(el.innerHTML.slice(0, 40))) clip.push(`${el.className || el.tagName} "${(el.textContent || '').trim().slice(0, 24)}"`); }
  out.clipped = clip.slice(0, 6);
  const h1 = document.querySelector('h1'); const cs = getComputedStyle(h1); const r = h1.getBoundingClientRect(); const fs = parseFloat(cs.fontSize);
  const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
  const tt = cs.textTransform === 'uppercase' ? (s) => s.toUpperCase() : (s) => s;
  const words = h1.textContent.trim().split(/\s+/);
  const longest = Math.max(...words.map((w) => c.measureText(tt(w)).width));
  out.h1 = { fs, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), lines: Math.round(r.height / (parseFloat(cs.lineHeight) || fs)), longestWord: Math.round(longest), room: Math.round(h1.clientWidth), wordFits: longest <= h1.clientWidth - 1, family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim() };
  const imgs = [...document.images].filter((i) => !i.closest('.hero-media') || i.complete);
  out.imgCount = document.images.length;
  out.broken = [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => (i.getAttribute('src') || '').slice(0, 60));
  out.fontsLoaded = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))];
  out.fontsFailed = [...new Set([...document.fonts].filter((f) => f.status === 'error').map((f) => f.family.replace(/["']/g, '')))];
  out.bodyFamily = getComputedStyle(document.body).fontFamily.split(',')[0].replace(/["']/g, '').trim();
  out.docH = de.scrollHeight;
  out.menuRows = document.querySelectorAll('.dish').length; out.hoursRows = document.querySelectorAll('.hours tr').length;
  const small = []; for (const el of document.querySelectorAll('a.btn,button.btn,.bar a,.tab')) { if (!vis(el)) continue; const rr = el.getBoundingClientRect(); if (rr.height < 40) small.push(`${(el.textContent || '').trim().slice(0, 18)} ${Math.round(rr.height)}px`); }
  out.smallTargets = small.slice(0, 4);
  const hero = document.querySelector('.hero-in'); const rects = [];
  for (const sel of ['.eyebrow', '.hero h1', '.lede', '.facts li']) for (const el of document.querySelectorAll(sel)) { if (!vis(el)) continue; const rr = el.getBoundingClientRect(); const s = getComputedStyle(el); rects.push({ sel, x: rr.left, y: rr.top, w: rr.width, h: rr.height, fs: parseFloat(s.fontSize), weight: parseInt(s.fontWeight) || 400, color: s.color }); }
  out.heroRects = rects; out.heroTop = hero ? Math.round(hero.getBoundingClientRect().top) : 0;
  const hmEl = document.querySelector('.hero-media'); const hmR = hmEl ? hmEl.getBoundingClientRect() : null;
  out.heroMedia = hmR && hmR.width > 40 && hmR.height > 40 ? { x: hmR.left, y: Math.max(0, hmR.top), w: hmR.width, h: Math.min(hmR.height, innerHeight - Math.max(0, hmR.top)) } : null;
  // ilk ekran: ana eylem, slogan ve bilgi satiri (saat/adres/telefon) gorunur mu
  // telefonda alt cubuk ekranin altini orter: onun altinda kalan "gorunur" sayilmaz
  const barEl = document.querySelector('.bar'); const barH = barEl && getComputedStyle(barEl).display !== 'none' ? barEl.getBoundingClientRect().height : 0;
  const inView = (el) => { if (!el || !vis(el)) return false; const rr = el.getBoundingClientRect(); return rr.top >= 0 && rr.bottom <= innerHeight - barH + 1; };
  // ana eylem: kahramandaki dugme ya da telefon alt cubugu (ust cubuktaki kucuk dugme sayilmaz)
  const mainBtn = [...document.querySelectorAll('.hero .btn-accent')].some(inView) || (barH > 0 && !!document.querySelector('.bar a.main'));
  const fl = [...document.querySelectorAll('.facts li')].filter(vis);
  out.firstScreen = { cta: mainBtn, h1: inView(h1), facts: fl.filter(inView).length, factsTotal: fl.length, heroBottom: hero ? Math.round(hero.getBoundingClientRect().bottom) : 0, limit: Math.round(innerHeight - barH) };
  out.gl = !!document.querySelector('.hero-media.gl-on'); out.h1Text = h1.textContent.trim().replace(/\s+/g, ' ');
  const lgo = document.querySelector('.top .brand img'); const lr = lgo ? lgo.getBoundingClientRect() : null;
  out.logo = lgo ? { ok: lgo.complete && lgo.naturalWidth > 0, filter: getComputedStyle(lgo).filter, ratio: +(lr.width / Math.max(1, lr.height)).toFixed(3), nat: +(lgo.naturalWidth / Math.max(1, lgo.naturalHeight)).toFixed(3) } : null;
  return out;
}
const lumOf = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
// ilk ekranda (metin gizliyken) metnin arkasindaki p90 parlaklik -> beyaz/renkli metinle kontrast
async function heroKontrast(buf, rects, f) {
  const meta = await sharp(buf).metadata();
  let worst = 99; let which = '';
  for (const r of rects) {
    const x = Math.max(0, Math.round(r.x * f)); const y = Math.max(0, Math.round(r.y * f)); const w = Math.min(meta.width - x, Math.round(r.w * f)); const h = Math.min(meta.height - y, Math.round(r.h * f));
    if (w < 4 || h < 4 || y >= meta.height) continue;
    const o = await sharp(buf).extract({ left: x, top: y, width: w, height: h }).resize({ width: Math.min(60, w) }).raw().toBuffer({ resolveWithObject: true });
    const ch = o.info.channels; const vals = [];
    for (let i = 0; i < o.data.length; i += ch) vals.push(lumOf(o.data[i], o.data[i + 1], o.data[i + 2]));
    vals.sort((p, q) => p - q); let p90 = vals[Math.floor(vals.length * 0.9)] || 0;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(r.color) || [0, 255, 255, 255];
    const fg = lumOf(+m[1], +m[2], +m[3]);
    const cr = (Math.max(fg, p90) + 0.05) / (Math.min(fg, p90) + 0.05);
    const large = r.fs >= 24 || (r.fs >= 18.66 && r.weight >= 700);
    const need = large ? 3 : 4.5;
    const score = cr / need;
    if (score < worst) { worst = score; which = `${r.sel} ${cr.toFixed(2)} (gerek ${need})`; }
  }
  return { ok: worst >= 1, worst: +worst.toFixed(2), which };
}

// kahraman fotograf alani bos/siyah mi (WebGL katmani ya da gorsel yuklenmedi)?  alan neredeyse tek renk VE cok koyu ise evet
export async function kahramanBosMu(buf, rect, f = 1) {
  if (!rect) return false;
  const meta = await sharp(buf).metadata();
  const left = Math.max(0, Math.round(rect.x * f)); const top = Math.max(0, Math.round(rect.y * f));
  const width = Math.min(Math.round(rect.w * f), meta.width - left); const height = Math.min(Math.round(rect.h * f), meta.height - top);
  if (width < 20 || height < 20) return false;
  const st = await sharp(buf).extract({ left, top, width, height }).removeAlpha().stats();
  const mean = st.channels.reduce((s, c) => s + c.mean, 0) / st.channels.length; const sd = st.channels.reduce((s, c) => s + c.stdev, 0) / st.channels.length;
  return mean < 16 && sd < 8;
}

async function olcVePoz(browser, base, rel, { mobile, dir, tag, out, wide = false }) {
  const vp = mobile ? { width: 390, height: 844 } : wide ? { width: 1920, height: 1080 } : { width: 1440, height: 900 };
  const dsf = mobile ? 2 : 1;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile, locale: 'en-US', reducedMotion: 'no-preference' });
  const pg = await ctx.newPage();
  const errs = []; const bad = []; const ext = [];
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  pg.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await pg.route('**/*', (route) => { const u = route.request().url(); if (!u.startsWith(base)) { ext.push(u.slice(0, 80)); return route.abort(); } return route.continue(); });
  pg.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 80)}`); });
  const res = { mobile };
  try {
    await pg.goto(`${base}/${rel}/index.html?capture=1`, { waitUntil: 'load', timeout: 30000 });
    await pg.evaluate(() => document.fonts.ready).catch(() => {});
    await pg.waitForTimeout(1600);
    const first = path.join(dir, mobile ? 'sonra-390.jpg' : wide ? 'sonra-1920.jpg' : 'sonra-1440.jpg');
    // metin gizliyken arka plan olcumu
    const r0 = await pg.evaluate(olc);
    const hide = await pg.addStyleTag({ content: '.hero-in > *,.top > *{visibility:hidden !important}' });
    const bgBuf = await pg.screenshot({ type: 'png' });
    await hide.evaluate((n) => n.remove());
    await pg.waitForTimeout(150);
    const shot = await pg.screenshot({ type: 'png' });
    await sharp(shot).jpeg({ quality: mobile ? 82 : 86, mozjpeg: true }).toFile(first);
    res.heroContrast = await heroKontrast(bgBuf, r0.heroRects, dsf);
    res.heroBos = await kahramanBosMu(bgBuf, r0.heroMedia, dsf);
    await pg.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 380) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 220)); } window.scrollTo(0, 0); document.querySelectorAll('.rv,.deck,.gal').forEach((e) => e.classList.add('in')); });
    await pg.evaluate(async () => { const ims = [...document.images]; ims.forEach((i) => { i.loading = 'eager'; }); document.querySelectorAll('.gal,.deck').forEach((g) => { g.scrollLeft = g.scrollWidth; }); const t0 = Date.now(); while (Date.now() - t0 < 12000 && ims.some((i) => !i.complete)) await new Promise((r) => setTimeout(r, 200)); document.querySelectorAll('.gal,.deck').forEach((g) => { g.scrollLeft = 0; }); });
    await pg.waitForTimeout(500);
    const m = await pg.evaluate(olc);
    // gizli sekmedeki ya da srcset'li gorsellerde naturalWidth 0 gorunebilir: gercekten bozuk mu, dosyayi ayri yukleyerek dogrula
    m.broken = await pg.evaluate(async () => { const bad = []; for (const i of document.images) { if (i.complete && i.naturalWidth > 0) continue; const u = i.currentSrc || i.src; if (!u) { bad.push('(src yok)'); continue; } const ok = await new Promise((r) => { const t = new Image(); t.onload = () => r(t.naturalWidth > 0); t.onerror = () => r(false); t.src = u; setTimeout(() => r(false), 8000); }); if (!ok) bad.push((i.getAttribute('src') || '').slice(0, 60)); } return bad; });
    Object.assign(res, m);
    res.firstScreen = r0.firstScreen; res.logo = r0.logo; res.gl = r0.gl; // ilk ekran olculeri kaydirmadan ONCE alinir
    const full = path.join(dir, mobile ? 'sonra-390-tam.jpg' : wide ? 'sonra-1920-tam.jpg' : 'sonra-1440-tam.jpg');
    await pg.evaluate(async () => { document.querySelectorAll('img').forEach((i) => { i.decoding = 'sync'; }); await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : 0))); });
    await pg.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await pg.waitForTimeout(700);
    const buf = await pg.screenshot({ type: 'png', fullPage: true, scale: 'css' });
    const meta = await sharp(buf).metadata();
    const maxH = mobile ? 12000 : 9000;
    let im = sharp(buf); if (meta.height > maxH) im = sharp(buf).extract({ left: 0, top: 0, width: meta.width, height: maxH });
    await im.jpeg({ quality: 74, mozjpeg: true }).toFile(full);
    res.shots = { first: path.basename(first), full: path.basename(full) };
  } catch (e) { res.error = String(e.message || e).slice(0, 160); }
  res.consoleErrors = errs.slice(0, 5); res.badResponses = bad.slice(0, 5); res.external = ext.slice(0, 5);
  await ctx.close();
  return res;
}

// ilk ekranda yazi okunmuyorsa golgeyi guclendir (foto cok acik)
// ust etiketin (eyebrow) marka rengi foto uzerinde okunmuyorsa: golge bir kez arttiktan sonra etiket yazi rengine cekilir (yalniz bu etiket; baslik ve dugme markada kalir)
export function eyebrowNotr(themeFile) {
  const css = fs.readFileSync(themeFile, 'utf8'); if (css.includes('/*eyebrow-notr*/')) return false;
  fs.writeFileSync(themeFile, css + '\n/*eyebrow-notr*/.hero .eyebrow{color:var(--hero-ink)}\n'); return true;
}
function golgeArtir(themeFile) {
  let css = fs.readFileSync(themeFile, 'utf8');
  const g = (n) => { const m = new RegExp('--' + n + ':([0-9.]+);').exec(css); return m ? +m[1] : null; };
  const mm = Math.min(0.95, (g('shade-m') || 0.72) + 0.09); const aa = Math.min(0.99, Math.max(g('shade-a') || 0.94, mm + 0.03));
  css = css.replace(/--shade-m:[0-9.]+;/, '--shade-m:' + mm.toFixed(3) + ';').replace(/--shade-a:[0-9.]+;/, '--shade-a:' + aa.toFixed(3) + ';');
  fs.writeFileSync(themeFile, css);
}
// h1 tasarsa theme.css'te boyutu kucult
function h1Kucult(themeFile, mobile, k = 0.88) {
  let css = fs.readFileSync(themeFile, 'utf8');
  if (mobile) css = css.replace(/(@media \(max-width:899px\)\{:root\{--h1-size:clamp\()(\d+)px,([\d.]+)vw/, (m, a, px, n) => `${a}${Math.max(24, Math.round(+px * k))}px,${Math.max(5.6, +n * k).toFixed(2)}vw`);
  else css = css.replace(/(--h1-size:clamp\(\d+px, min\()([\d.]+)vw, ([\d.]+)vh\)/, (m, a, n, v) => `${a}${Math.max(2.4, +n * k).toFixed(2)}vw, ${Math.max(5, +v * k).toFixed(1)}vh)`);
  fs.writeFileSync(themeFile, css);
}

export async function kapi(slug, { browser, base, out = DEMO, veri = VERI, log = console.log } = {}) {
  const dir = path.join(veri, slug);
  const R = JSON.parse(fs.readFileSync(path.join(dir, 'cikarici.json'), 'utf8'));
  const ur = fs.existsSync(path.join(dir, 'uret.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'uret.json'), 'utf8')) : null;
  const result = { surum: KAPI_SURUM, slug, name: R.name && R.name.n, site: R.lead.site, lang: R.lead.lang, region: R.lead.region, at: new Date().toISOString(), reasons: [], warnings: [], metrics: {} };
  if (R.kapali) {
    result.status = 'elendi';
    result.reasons.push(`işletme kapanmış (sitenin kendi sözü: ${R.kapali.neden})`);
    fs.writeFileSync(path.join(dir, 'kapi.json'), JSON.stringify(result, null, 1));
    return result;
  }
  if (!ur || !R.erisim || !R.erisim.ok || !R.photos || !R.photos.length) {
    result.status = 'elendi';
    result.reasons.push(!R.erisim || !R.erisim.ok ? `site okunamadi (${(R.erisim && R.erisim.why) || '-'})` : R.erisim.thin ? 'site bos ya da park sayfasi' : 'kullanilabilir fotograf yok');
    fs.writeFileSync(path.join(dir, 'kapi.json'), JSON.stringify(result, null, 1));
    return result;
  }
  result.page = ur.page;
  const themeFile = path.join(out, path.dirname(ur.page), 'theme.css');
  const fixes = [];
  let d; let m;
  for (let t = 0; t < 4; t++) {
    d = await olcVePoz(browser, base, path.dirname(ur.page), { mobile: false, dir, out });
    // ilk ekran butun olmali: slogan + ana eylem + bilgi satiri.  Sigmıyorsa once baslik kuculur (en cok 3 kez), golge sonra
    const fsBad = d.firstScreen && (!d.firstScreen.cta || !d.firstScreen.h1 || (d.firstScreen.factsTotal && d.firstScreen.facts < d.firstScreen.factsTotal));
    const bad = d.h1 && (!d.h1.wordFits || d.h1.right > d.innerW - 8 || d.h1.lines > 4 || fsBad);
    if (bad && t < 3) { h1Kucult(themeFile, false); fixes.push(`h1 (masaustu) kucultuldu x${t + 1}${fsBad ? ' (ilk ekran sigmadi)' : ''}`); continue; }
    if (d.heroContrast && !d.heroContrast.ok && t >= 1 && /^\.eyebrow\b/.test(d.heroContrast.which) && eyebrowNotr(themeFile)) { fixes.push('ust etiket rengi yazi rengine cekildi (masaustu)'); continue; }
    if (d.heroContrast && !d.heroContrast.ok && t < 3) { golgeArtir(themeFile); fixes.push(`hero golgesi artirildi (masaustu) x${t + 1}`); continue; }
    break;
  }
  for (let t = 0; t < 4; t++) {
    m = await olcVePoz(browser, base, path.dirname(ur.page), { mobile: true, dir, out });
    const fsBad = m.firstScreen && (!m.firstScreen.cta || !m.firstScreen.h1 || (m.firstScreen.factsTotal && m.firstScreen.facts < m.firstScreen.factsTotal));
    const bad = m.h1 && (!m.h1.wordFits || m.h1.right > m.innerW - 8 || m.h1.lines > 4 || fsBad);
    if (bad && t < 3) { h1Kucult(themeFile, true); fixes.push(`h1 (telefon) kucultuldu x${t + 1}${fsBad ? ' (ilk ekran sigmadi)' : ''}`); continue; }
    if (m.heroContrast && !m.heroContrast.ok && t >= 1 && /^\.eyebrow\b/.test(m.heroContrast.which) && eyebrowNotr(themeFile)) { fixes.push('ust etiket rengi yazi rengine cekildi (telefon)'); continue; }
    if (m.heroContrast && !m.heroContrast.ok && t < 3) { golgeArtir(themeFile); fixes.push(`hero golgesi artirildi (telefon) x${t + 1}`); continue; }
    break;
  }
  let x19;
  for (let t = 0; t < 3; t++) {
    x19 = await olcVePoz(browser, base, path.dirname(ur.page), { mobile: false, wide: true, dir, out });
    if (x19.heroContrast && !x19.heroContrast.ok && t >= 1 && /^\.eyebrow\b/.test(x19.heroContrast.which) && eyebrowNotr(themeFile)) { fixes.push('ust etiket rengi yazi rengine cekildi (1920)'); continue; }
    if (x19.heroContrast && !x19.heroContrast.ok && t < 2) { golgeArtir(themeFile); fixes.push(`hero golgesi artirildi (1920) x${t + 1}`); continue; }
    break;
  }
  const slim = (x) => { const { heroRects, shots, ...r } = x; return r; };
  result.metrics = { desktop: slim(d), wide: slim(x19), mobile: slim(m) }; result.shots = { desktop: d.shots, wide: x19.shots, mobile: m.shots }; result.autoFix = fixes;

  // ---- kurallar ----
  const why = result.reasons; const warn = result.warnings;
  const nPhoto = R.photos.length;
  if (nPhoto < 3) why.push(`fotoğraf sayısı 3'ten az (${nPhoto})`);
  if (!R.logo) why.push('logo yok');
  const SM = profil(R.lead);
  if (SM) { const k = SM.kapiKural(R, ur); why.push(...k.why); warn.push(...k.warn); } else {
    const nMenu = ur.menuItems || 0;
    if (!nMenu && !ur.menuLink) why.push('menü yok');
    else if (nMenu < 4) warn.push('menü kalemleri çıkarılamadı, yalnız menü bağlantısı var');
  }
  if (ur.palette && ur.palette.accentVia === 'varsayilan') why.push('marka rengi bulunamadı');
  if (!ur.palette.ok) why.push('kontrast sağlanamadı: ' + ur.palette.checks.filter((c) => !c.pass).map((c) => `${c.name} ${c.ratio}`).join(', '));
  if (!R.phone && !R.address) why.push('adres ve telefon yok');
  for (const [k, x] of [['masaüstü', d], ['1920', x19], ['telefon', m]]) {
    if (x.error) { why.push(`${k}: sayfa açılamadı (${x.error})`); continue; }
    if (x.heroBos) why.push(`${k}: kahraman fotoğraf alanı boş ya da siyah`);
    if (x.heroContrast && !x.heroContrast.ok) why.push(`${k}: ilk ekranda yazı kontrastı düşük (${x.heroContrast.which})`);
    if (x.broken && x.broken.length) why.push(`${k}: bozuk görsel (${x.broken.length}): ${x.broken.slice(0, 2).join(', ')}`);
    if (x.overflowX || (x.offenders && x.offenders.length)) why.push(`${k}: taşma (${x.overflowX ? 'yatay kaydırma, ' : ''}${(x.offenders || []).slice(0, 2).join(' | ')})`);
    if (x.h1 && (!x.h1.wordFits || x.h1.right > x.innerW - 4)) why.push(`${k}: başlık sığmıyor`);
    if (x.fontsFailed && x.fontsFailed.length) why.push(`${k}: font yüklenemedi (${x.fontsFailed.join(', ')})`);
    if (x.h1 && ur.fonts && !x.fontsLoaded.some((f) => f.toLowerCase() === (x.h1.family || '').toLowerCase())) warn.push(`${k}: başlık fontu yüklenen listede görünmüyor (${x.h1.family})`);
    if (x.external && x.external.length) warn.push(`${k}: dış istek engellendi (${x.external.length})`);
    if (x.badResponses && x.badResponses.length) why.push(`${k}: 4xx/5xx yanıt: ${x.badResponses[0]}`);
    if (x.consoleErrors && x.consoleErrors.length) why.push(`${k}: konsol hatası: ${x.consoleErrors[0]}`);
    if (x.firstScreen && !x.firstScreen.cta) why.push(`${k}: ilk ekranda ana eylem düğmesi yok`);
    if (x.firstScreen && !x.firstScreen.h1) why.push(`${k}: slogan ilk ekrana sığmıyor`);
    if (x.firstScreen && x.firstScreen.factsTotal && x.firstScreen.facts < x.firstScreen.factsTotal) why.push(`${k}: bilgi satırı (saat/adres/telefon) ilk ekranda tam görünmüyor (${x.firstScreen.facts}/${x.firstScreen.factsTotal})`);
    if (x.logo && (!x.logo.ok || x.logo.filter !== 'none' || Math.abs(x.logo.ratio - x.logo.nat) > 0.04)) why.push(`${k}: logo bozulmuş (filtre ${x.logo.filter}, oran ${x.logo.ratio}/${x.logo.nat})`);
    if (x.h1Text && result.name && x.h1Text.toLowerCase() === String(result.name).toLowerCase()) why.push(`${k}: büyük başlık işletme adı (slogan değil)`);
    if (x.clipped && x.clipped.length) warn.push(`${k}: kırpılan metin: ${x.clipped.slice(0, 2).join(' | ')}`);
    if (x.smallTargets && x.smallTargets.length && k === 'telefon') warn.push(`telefon: küçük dokunma alanı: ${x.smallTargets[0]}`);
  }
  if (SM && SM.SAAT_YOK) { /* konaklama: saat tablosu yok, giris/cikis gosterilir */ } else if (ur.hoursIssue) warn.push('çalışma saatleri sitede birbiriyle çelişiyor; sayfada saat tablosu ve "şimdi açık" gösterilmedi');
  else if (!ur.hoursOk) warn.push('çalışma saatleri bulunamadı (sayfada telefon bağlantısı gösterilir)');
  else if (!ur.statusOk) warn.push('"şimdi açık" rozeti yok (7 günün saati ya da saat dilimi eksik)');
  if (!R.reservation && !SM) warn.push('rezervasyon bağlantısı yok (demo form gösterilir)');
  if (ur.fonts && ur.fonts.display.via === 'sinif') warn.push(`başlık fontu tam eşleşmedi (${ur.fonts.display.orig} → ${ur.fonts.display.id}, sınıf eşi)`);
  if (ur.fonts && ur.fonts.text.via === 'sinif') warn.push(`metin fontu tam eşleşmedi (${ur.fonts.text.orig} → ${ur.fonts.text.id}, sınıf eşi)`);
  for (const w of ur.warn || []) if (!/marka rengi|kontrast:/.test(w)) warn.push(w);
  if (ur.heroContrast < 4.5) why.push(`hero yazı kontrastı (tahmin) ${ur.heroContrast}`);
  result.status = why.length ? 'gozden-gecir' : 'hazir';
  fs.writeFileSync(path.join(dir, 'kapi.json'), JSON.stringify(result, null, 1));
  log(`kapi: ${slug}  ${result.status}${why.length ? '  <- ' + why.join(' ; ') : ''}${warn.length ? '  (uyari: ' + warn.length + ')' : ''}`);
  return result;
}

export function listeYaz(veri = VERI) {
  const rows = [];
  for (const s of fs.readdirSync(veri)) { const f = path.join(veri, s, 'kapi.json'); if (fs.existsSync(f)) { try { rows.push(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch { /* yoksay */ } } }
  const by = (st) => rows.filter((r) => r.status === st);
  const slim = (r) => ({ slug: r.slug, ad: r.name, site: r.site, dil: r.lang, ulke: r.region, sayfa: r.page || null, nedenler: r.reasons, uyarilar: r.warnings });
  fs.writeFileSync(path.join(veri, 'liste-hazir.json'), JSON.stringify(by('hazir').map(slim), null, 1));
  fs.writeFileSync(path.join(veri, 'liste-gozden-gecir.json'), JSON.stringify(by('gozden-gecir').map(slim), null, 1));
  fs.writeFileSync(path.join(veri, 'liste-elendi.json'), JSON.stringify(by('elendi').map(slim), null, 1));
  const md = [`# Restoran taslakları: durum listesi`, '', `Hazır: ${by('hazir').length} · Gözden geçir: ${by('gozden-gecir').length} · Elendi: ${by('elendi').length} (toplam ${rows.length}).`, 'Gözden geçir ve elenenler maile GİRMEZ. Mailler yalnız Doruk\'un onayıyla gider.', '', '## Hazır', ...by('hazir').map((r) => `- ${r.name || r.slug} (${r.region}, ${r.lang}) ${r.page}${r.warnings.length ? ' — uyarı: ' + r.warnings.slice(0, 3).join('; ') : ''}`), '', '## Gözden geçir', ...by('gozden-gecir').map((r) => `- ${r.name || r.slug} (${r.region}): ${r.reasons.join('; ')}`), '', '## Elendi', ...by('elendi').map((r) => `- ${r.name || r.slug}: ${r.reasons.join('; ')}`), ''];
  fs.writeFileSync(path.join(veri, 'LISTE.md'), md.join('\n'));
  return { hazir: by('hazir').length, gozden: by('gozden-gecir').length, elendi: by('elendi').length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const which = process.argv[2];
  if (!which) { console.error('kullanim: node uyarla/kapi.mjs <slug,slug|hepsi> [--out web/demo] [--force]'); process.exit(2); }
  const out = arg('--out', DEMO); const force = process.argv.includes('--force');
  const slugs = which === 'hepsi' ? fs.readdirSync(VERI).filter((s) => fs.existsSync(path.join(VERI, s, 'cikarici.json'))) : which.split(',');
  const todo = slugs.filter((s) => force || !fs.existsSync(path.join(VERI, s, 'kapi.json')));
  const srv = await sunucu(out);
  const browser = todo.length ? await openBrowser() : null;
  try {
    for (const s of todo) { try { await kapi(s, { browser, base: srv.url, out }); } catch (e) { console.log(`${s}: HATA ${String(e.stack).split('\n').slice(0, 3).join(' | ')}`); } }
  } finally { if (browser) await browser.close(); await srv.close(); }
  console.log(JSON.stringify(listeYaz()));
}
