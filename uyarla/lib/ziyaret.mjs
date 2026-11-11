// Bir isletmenin herkese acik sayfasini TEK headless Chromium ziyaretiyle (robots.txt'e uyarak) okur ve ekran goruntusunu alir:
// calisan stiller (renk, font, dugme), kullanilan renk dagilimi, yuklenen fontlar, gorsel adaylari (img + css arka plan), video, baglantilar, gorunen metin satirlari.
// Gorsellerin baytlari tarayicinin zaten indirdigi yanitlardan alinir (ikinci indirme yok).
// Doruk'un Chrome'u kullanilmaz; yalniz ms-playwright icindeki Chromium.
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { chromiumYolu } from './yol.mjs';

export const CHROME = process.env.MOCKUP_CHROME || chromiumYolu();
export const UA_D = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 PeakAppsStudioDraftBot/1.0';
export const UA_M = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 PeakAppsStudioDraftBot/1.0';
const SKIP_HOST = /(google-analytics|googletagmanager|doubleclick|facebook\.net|connect\.facebook|hotjar|clarity\.ms|segment\.io|mixpanel|fullstory|tiktok|snapchat|criteo|adsystem|hubspot|intercom|crisp\.chat|tawk\.to|livechat|drift\.com|optimizely)/i;
const KABUL = ['#onetrust-accept-btn-handler', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', 'button:has-text("Accept all")', 'button:has-text("Accept All")', 'button:has-text("Accept")', 'button:has-text("I agree")', 'button:has-text("Allow all")', 'button:has-text("Got it")', 'button:has-text("Kabul")', 'button:has-text("Tümünü kabul")', 'button:has-text("Agree")', 'button:has-text("OK")'];

export async function openBrowser() {
  return chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-dev-shm-usage', '--autoplay-policy=user-gesture-required'] });
}

// sayfa icinde calisir
function sayfaOku() {
  const vw = innerWidth; const H = Math.min(document.documentElement.scrollHeight, 5000);
  const hexOf = (c) => {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?/.exec(c || '');
    if (!m) return null;
    let a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    const h = (n) => Number(n).toString(16).padStart(2, '0');
    return { hex: `#${h(m[1])}${h(m[2])}${h(m[3])}`, a };
  };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = hexOf(getComputedStyle(e).backgroundColor); if (c && c.a > 0.6) return c.hex; } return '#ffffff'; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const fam = (cs) => (cs.fontFamily || '').split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  // GORUNEN aile: yigindaki ilk gercekten yuklu/kurulu aile (canvas olcumu: aile varsa genislik yedek fontlardan farkli cikar)
  const GEN = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system', 'blinkmacsystemfont']);
  const cv = document.createElement('canvas').getContext('2d');
  const PROBE = 'mmmmmmmmmmlliWWiqg ÇĞİŞöü0123456789';
  const mw = (f) => { cv.font = '72px ' + f; return cv.measureText(PROBE).width; };
  const BASE = { m: mw('monospace'), r: mw('serif'), s: mw('sans-serif') };
  const hasFont = (f) => { const q = '"' + f + '"'; return mw(q + ', monospace') !== BASE.m || mw(q + ', serif') !== BASE.r || mw(q + ', sans-serif') !== BASE.s; };
  const shownOf = (list) => { for (const f of list) { if (GEN.has(f.toLowerCase())) return f.toLowerCase(); if (hasFont(f)) return f; } return null; };
  const describe = (el) => {
    if (!el) return null; const cs = getComputedStyle(el);
    return { shown: shownOf(fam(cs)), color: (hexOf(cs.color) || {}).hex || null, bg: bgOf(el), ownBg: (hexOf(cs.backgroundColor) || {}).a > 0.6 ? hexOf(cs.backgroundColor).hex : null, family: fam(cs), size: parseFloat(cs.fontSize), weight: cs.fontWeight, transform: cs.textTransform, spacing: cs.letterSpacing, style: cs.fontStyle, radius: parseFloat(cs.borderTopLeftRadius) || 0, text: (el.innerText || '').trim().slice(0, 60) };
  };
  const firstVisible = (sel) => [...document.querySelectorAll(sel)].find(visible) || null;
  // renk dagilimi
  const bgMap = new Map(); const txMap = new Map(); const accMap = new Map();
  const els = [...document.querySelectorAll('body *')].slice(0, 2600);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.top > H || r.bottom < 0) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
    const bg = hexOf(cs.backgroundColor);
    if (bg && bg.a > 0.6) { const area = Math.min(r.width, vw) * Math.min(r.height, 1800); bgMap.set(bg.hex, (bgMap.get(bg.hex) || 0) + area); if (/^(a|button|input)$/i.test(el.tagName) || /btn|button|cta/i.test(el.className && el.className.baseVal === undefined ? el.className : '')) accMap.set(bg.hex, (accMap.get(bg.hex) || 0) + 1); }
    let own = 0; for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent.trim().length;
    if (own > 0) { const c = hexOf(cs.color); if (c) txMap.set(c.hex, (txMap.get(c.hex) || 0) + own * parseFloat(cs.fontSize)); }
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([hex, w]) => ({ hex, w: Math.round(w) }));
  // gorseller: img + css arka plan
  const imgs = [];
  const pos = (el) => { const r = el.getBoundingClientRect(); return { rw: Math.round(r.width), rh: Math.round(r.height), top: Math.round(r.top + scrollY) }; };
  // srcset'in EN BUYUK adayi (adresler virgul icerebilir: Wix /v1/fill/w_980,h_654,...); tarayici yalniz ekrana uyani indirir
  const ssBest = (txt) => { let best = null; for (const m of String(txt || '').matchAll(/(?:^|[\s,]+)(\S+?)\s+(\d+(?:\.\d+)?)([wx])(?=\s*(?:,|$))/g)) { const v = Number(m[2]) * (m[3] === 'x' ? 1000 : 1); if (!best || v > best.v) best = { u: m[1], v }; } return best ? best.u : ''; };
  const mutlak = (u) => { try { return u ? new URL(u, location.href).href : ''; } catch { return ''; } };
  for (const im of document.images) {
    const url = im.currentSrc || im.src; if (!url || /^data:/.test(url)) continue;
    // kucuk resim bir buyuk fotografa baglanmissa (galeri / lightbox) buyuk dosya adaydir
    const ah = im.closest('a[href]'); let big = ''; try { const h = ah && ah.getAttribute('href'); if (h && /\.(jpe?g|png|webp)(\?|$)/i.test(h)) big = new URL(h, location.href).href; } catch { big = ''; }
    let homeLink = false; try { if (ah) { const u = new URL(ah.getAttribute('href'), location.href); homeLink = u.origin === location.origin && (u.pathname === '/' || u.pathname === location.pathname); } } catch { homeLink = false; }
    const pic = im.closest('picture');
    const ss = mutlak(ssBest([im.getAttribute('srcset'), im.getAttribute('data-srcset'), ...(pic ? [...pic.querySelectorAll('source')].map((s) => s.getAttribute('srcset') || s.getAttribute('data-srcset')) : [])].filter(Boolean).join(', ')));
    imgs.push({ url, big: big !== url ? big : '', ss: ss && ss !== url ? ss : '', nw: im.naturalWidth, nh: im.naturalHeight, alt: (im.alt || '').slice(0, 120), cls: `${im.className && im.className.baseVal === undefined ? im.className : ''} ${im.id || ''}`.trim().slice(0, 80), id: (im.id || '').slice(0, 60), homeLink, via: 'img', vis: visible(im), inHeader: !!im.closest('header, nav, [class*=header], [class*=navbar]'), inFooter: !!im.closest('footer'), ...pos(im) });
  }
  let bgCount = 0;
  for (const el of els) {
    if (bgCount > 40) break;
    const cs = getComputedStyle(el); const bi = cs.backgroundImage;
    if (!bi || bi === 'none' || !/url\(/.test(bi)) continue;
    for (const m of bi.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const url = m[1]; if (/^data:/.test(url)) continue;
      const r = el.getBoundingClientRect(); const clx = `${el.className && el.className.baseVal === undefined ? el.className : ''} ${el.id || ''}`;
      if ((r.width < 120 || r.height < 80) && !(/logo|brand/i.test(clx) && r.width >= 30 && r.height >= 14)) continue;
      imgs.push({ url: new URL(url, location.href).href, nw: 0, nh: 0, alt: '', cls: String(el.className && el.className.baseVal === undefined ? el.className : '').slice(0, 80), id: (el.id || '').slice(0, 60), via: 'bg', vis: visible(el), inHeader: !!el.closest('header, nav'), inFooter: !!el.closest('footer'), ...pos(el) }); bgCount++;
    }
  }
  // satir ici SVG (logo adayi): header / nav / logo-marka kapsayicisi; sprite (<use>) kullananlar tek basina cizilemez
  const svgler = [];
  for (const sv of document.querySelectorAll('header svg, nav svg, [class*=logo i] svg, [id*=logo i] svg, [class*=brand i] svg, a[href="/"] svg')) {
    if (svgler.length >= 6) break;
    const r = sv.getBoundingClientRect(); if (r.width < 40 || r.height < 14 || !visible(sv)) continue;
    const mk = sv.outerHTML; if (/<use\b/i.test(mk) || mk.length > 250000) continue;
    const pc = sv.parentElement; svgler.push({ svg: mk, rw: Math.round(r.width), rh: Math.round(r.height), top: Math.round(r.top + scrollY), inHeader: !!sv.closest('header, nav'), cls: String(sv.getAttribute('class') || '').slice(0, 80), id: (sv.id || '').slice(0, 60), label: (sv.getAttribute('aria-label') || (sv.querySelector('title') || {}).textContent || '').slice(0, 60), parentCls: String(pc && pc.className && pc.className.baseVal === undefined ? pc.className : '').slice(0, 80) });
  }
  const videos = [...document.querySelectorAll('video')].map((v) => ({ src: v.currentSrc || v.src || '', sources: [...v.querySelectorAll('source')].map((s) => ({ src: s.src, type: s.type })), poster: v.poster || '', rw: Math.round(v.getBoundingClientRect().width), rh: Math.round(v.getBoundingClientRect().height), loop: v.loop, muted: v.muted }));
  const embeds = [...document.querySelectorAll('iframe')].map((f) => f.src).filter((s) => /youtube|vimeo/i.test(s)).slice(0, 3);
  const links = [...document.querySelectorAll('a[href]')].slice(0, 400).map((a) => ({ href: a.href, text: (a.innerText || a.getAttribute('aria-label') || a.title || '').replace(/\s+/g, ' ').trim().slice(0, 80) }));
  const btn = firstVisible('a[class*=btn], a[class*=button], button[class*=btn], button[class*=button], .elementor-button, a.wp-block-button__link, a[href*=reserv], a[href*=book], a[href*=rezerv]') || firstVisible('button:not([aria-label*=menu i])');
  const heads = [...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0, 12);
  const lines = (document.body.innerText || '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 900);
  const meta = (n) => { const e = document.querySelector(`meta[property="${n}"],meta[name="${n}"]`); return e ? e.content : ''; };
  // slogan adaylari: gorunur, kisa, yaprak metin dugumleri (ilk ~1500 px); ham metin (textContent) alinir, text-transform uygulanmaz
  const sloganAd = []; const seenS = new Set();
  for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,div,em,strong,blockquote,figcaption')) {
    if (sloganAd.length >= 40) break;
    if (el.closest('footer,nav,[class*=cookie i],[class*=consent i],[id*=cookie i],[class*=gdpr i],[role=dialog]')) continue;
    if ([...el.children].some((c) => /^(DIV|P|H[1-6]|UL|OL|SECTION|ARTICLE|FORM|TABLE|A|BUTTON|IMG|LI|SVG)$/.test(c.tagName))) continue;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 120 || t.split(' ').length < 2) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect(); const topY = Math.round(r.top + scrollY);
    if (topY > 1500) continue;
    const key = t.toLowerCase(); if (seenS.has(key)) continue; seenS.add(key);
    const cs = getComputedStyle(el);
    sloganAd.push({ tag: el.tagName.toLowerCase(), t, top: topY, fs: parseFloat(cs.fontSize), w: cs.fontWeight, tr: cs.textTransform, it: cs.fontStyle, cls: String((el.className && el.className.baseVal === undefined ? el.className : '') || '').slice(0, 60), inHeader: !!el.closest('header') });
  }
  const loadedFonts = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))];
  return {
    title: document.title, lang: document.documentElement.lang || '', textLen: (document.body.innerText || '').length, height: document.documentElement.scrollHeight,
    meta: { desc: meta('description'), ogDesc: meta('og:description'), ogTitle: meta('og:title'), ogImage: meta('og:image'), ogVideo: meta('og:video') || meta('og:video:url'), themeColor: meta('theme-color'), siteName: meta('og:site_name') },
    style: { body: describe(document.body), h1: describe(firstVisible('h1')), h2: describe(firstVisible('h2')), h3: describe(firstVisible('h3')), nav: describe(firstVisible('nav a, header a')), p: describe(firstVisible('main p, p')), btn: describe(btn), link: describe(firstVisible('main a, p a')), header: describe(firstVisible('header, [class*=header]')), footer: describe(firstVisible('footer')), logoText: describe(firstVisible('header a[class*=logo], .logo, [class*=site-title], [class*=brand]')), headsText: heads.map((h) => ({ tag: h.tagName, t: (h.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80), family: fam(getComputedStyle(h)) })) },
    used: { bg: top(bgMap, 8), text: top(txMap, 8), buttons: top(accMap, 4) },
    fonts: loadedFonts, imgs, svgler, videos, embeds, links, lines, sloganAd, title2: document.title,
  };
}

async function kapat(pg) {
  for (const s of KABUL) {
    try { const el = pg.locator(s).first(); if (await el.isVisible({ timeout: 250 })) { await el.click({ timeout: 1200 }); await pg.waitForTimeout(700); return true; } } catch { /* sonraki */ }
  }
  return false;
}

// -> { ok, status, finalUrl, html, ...sayfaOku(), shots:{}, imgBodies: Map(url -> {buf,type}), fontFiles:[url], reqCount }
export async function ziyaret(browser, url, { polite, mobile = false, lang = 'en', shotPath, wantImages = true, log = () => {} } = {}) {
  const a = await polite.allowed(url);
  if (!a.ok) return { ok: false, why: a.why };
  const vp = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? UA_M : UA_D, locale: lang === 'tr' ? 'tr-TR' : 'en-US', reducedMotion: 'no-preference', ignoreHTTPSErrors: false });
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(20000);
  const imgBodies = new Map(); const fontFiles = []; let reqCount = 0; let bytes = 0; const pend = [];
  await pg.route('**/*', (route) => {
    const r = route.request(); const rt = r.resourceType(); const u = r.url();
    if (rt === 'media' || SKIP_HOST.test(new URL(u).host) || (mobile && rt === 'image' && false)) return route.abort();
    reqCount++; return route.continue();
  });
  pg.on('response', (res) => {
    try {
      const rq = res.request(); const rt = rq.resourceType(); const u = res.url();
      if (rt === 'font') fontFiles.push(u);
      if (!wantImages || rt !== 'image' || res.status() !== 200 || imgBodies.size >= 70 || bytes > 90e6) return;
      const type = (res.headers()['content-type'] || '').toLowerCase();
      if (!/^image\/(jpeg|png|webp|avif|svg)/.test(type)) return;
      const len = Number(res.headers()['content-length'] || 0);
      if (len && (len > 9e6 || len < 6000)) return;
      pend.push(res.body().then((buf) => { if (buf.length >= 6000 && buf.length <= 9e6 && !imgBodies.has(u)) { imgBodies.set(u, { buf, type }); bytes += buf.length; } }).catch(() => {}));
    } catch { /* yoksay */ }
  });
  const out = { ok: false, mobile };
  try {
    const resp = await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    out.status = resp ? resp.status() : 0;
    try { await pg.waitForLoadState('load', { timeout: 15000 }); } catch { /* yavas site: eldekiyle devam */ }
    out.finalUrl = pg.url();
    const b = await polite.allowed(out.finalUrl);
    if (!b.ok) { await ctx.close(); return { ok: false, why: b.why }; }
    if (out.status >= 400) { out.why = `http:${out.status}`; await ctx.close(); return out; }
    await pg.waitForTimeout(1800);
    out.cookie = await kapat(pg);
    // ilk ekran (kaydirmadan)
    if (shotPath) { await pg.waitForTimeout(600); await pg.screenshot({ path: shotPath.first, type: 'png' }).catch(() => {}); }
    // tembel gorselleri tetikle
    await pg.evaluate(async () => { const H = Math.min(document.documentElement.scrollHeight, 6000); for (let y = 0; y < H; y += 650) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 170)); } window.scrollTo(0, 0); }).catch(() => {});
    await pg.waitForTimeout(900);
    try { await pg.waitForLoadState('networkidle', { timeout: 4000 }); } catch { /* sorun degil */ }
    if (shotPath && shotPath.full) await pg.screenshot({ path: shotPath.full, type: 'png', fullPage: true, clip: { x: 0, y: 0, width: vp.width, height: Math.min(5200, await pg.evaluate(() => document.documentElement.scrollHeight)) } }).catch(() => {});
    const data = await pg.evaluate(sayfaOku);
    out.html = (await pg.content()).slice(0, 3_000_000);
    await Promise.allSettled(pend);
    Object.assign(out, data, { ok: true, imgBodies, fontFiles: [...new Set(fontFiles)].slice(0, 30), reqCount });
  } catch (e) { out.why = `browser:${String(e.message || e).slice(0, 100)}`; }
  await ctx.close();
  return out;
}
