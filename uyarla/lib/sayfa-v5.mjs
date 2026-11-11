// v5 HTML ve theme.css uretimi. Uc referans dili (REFERANS-A.md): mekan (amritpalace grameri), sicak (khufus), sahil (ballenacabo).
// Girdi: uret-v5.mjs'in kurdugu model (isletmenin kendi verisi + dilin fontlari + kendi paleti). Dil modeli yok; sablon + kural.
// Kurallar: buyuk baslik SLOGANDIR; logo orijinal dosyadir, filtre almaz; ana sayfa fotografi hero-secim.json'daki tek karedir ve buyutulmez;
// eylem baglantilari isletmenin GERCEK baglantilaridir (rezervasyon, telefon, menu sayfasi); demo form yok. Hareket JS olmadan da ayni icerigi duragan gosterir.
import { T, DAYS } from './metin.mjs';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rgb = (hex) => { const x = hex.replace('#', ''); return `${parseInt(x.slice(0, 2), 16)},${parseInt(x.slice(2, 4), 16)},${parseInt(x.slice(4, 6), 16)}`; };
const pct = (n) => `${+(n * 100).toFixed(1)}%`;
const X = {
  en: { menus: 'Menus', seeMenu: 'See the menu', visit: 'Visit', about: 'About', hoursNote: 'Hours', also: 'Also at', links: 'Links', callNow: (p) => `Call ${p}`, opens: 'Opens in a new tab' },
  tr: { menus: 'Menü', seeMenu: 'Menüye bakın', visit: 'Ziyaret', about: 'Hakkımızda', hoursNote: 'Saatler', also: 'Diğer şube', links: 'Bağlantılar', callNow: (p) => `Arayın: ${p}`, opens: 'Yeni sekmede açılır' },
};
const ICON = {
  // 11 Kas (TR): siparis eylemi canta, WhatsApp hatti konusma balonu; rezervasyon takvim olarak kalir
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M8.5 9h7M8.5 13h7"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>',
};

// ---------------- theme.css ----------------
export function themeCssV5(m) {
  const t = m.palette.t; const f = m.font; const lg = m.logo; const s = m.size;
  const headBg = lg ? lg.headBg : t.bg; const headInk = lg ? lg.headInk : t.ink;
  const L = [];
  L.push(`/* ${m.name}: v5, ${m.dil} dili (${m.referans} grameri). Renkler isletmenin kendi sitesinden; fontlar referans dilin fontlari: ${f.display.family}, ${f.text.family}${f.script ? ', ' + f.script.family : ''}. Logo: orijinal dosya, filtre yok. Ana fotograf ${m.hero.w}x${m.hero.h} px, buyutme yok. */`);
  L.push(m.fontFaceCss);
  L.push(':root{');
  const v = { bg: t.bg, 'bg-rgb': rgb(t.bg), bg2: t.bg2, ink: t.ink, muted: t.muted, line: t.line, accent: t.accent, 'accent-ink': t.accentInk, 'accent-hi': t.accentHi, 'accent-text': t.accentText, deep: t.deep, 'on-deep': t.onDeep, 'on-deep-muted': t.onDeepMuted, 'accent-on-deep': t.accentOnDeep,
    'hero-ink': '#ffffff', 'hero-muted': 'rgba(255,255,255,.9)', 'hero-accent': t.heroAccent, 'hero-line': 'rgba(255,255,255,.28)', 'shade-rgb': rgb(t.shade), 'shade-a': m.shadeA, 'shade-m': m.shadeM, ...(m.shadeR ? { 'shade-r': m.shadeR } : {}),
    'head-bg': headBg, 'head-bg-rgb': rgb(headBg), 'head-ink': headInk, panel: m.panel.bg, 'panel-ink': m.panel.ink, 'panel-muted': m.panel.muted || m.panel.ink, card: m.card.bg, 'card-ink': m.card.ink, 'card-muted': m.card.muted || m.card.ink };
  if (m.wm) v['wm-size'] = m.wm;
  for (const [a, b] of Object.entries(v)) L.push(`--${a}:${b};`);
  L.push(`--display:"${f.display.family}",${m.fallback.display};--text:"${f.text.family}",${m.fallback.text};${f.script ? `--script:"${f.script.family}",cursive;` : ''}`);
  L.push(`--d-weight:${f.display.weight};--d-style:normal;--d-case:${f.display.upper ? 'uppercase' : 'none'};--d-ls:${f.display.ls}em;--em-style:${f.display.em && f.display.em.italic ? 'italic' : 'normal'};--em-weight:${f.display.em ? f.display.em.weight : 'inherit'};`);
  L.push(`--t-weight:${s.tWeight};--t-strong:${f.text.strong || 600};--t-size:${s.tSize};--lede-size:${s.lede};`);
  L.push(`--h1-size:${s.h1};--h1-max:${s.h1max};--h1-lh:${s.lh};--h2-size:${s.h2};--h2-lh:${s.h2lh};--h3-size:${s.h3};--h2s-size:${s.h2s};`);
  L.push(`--hero-w:${m.hero.w}px;--hero-h:${m.hero.h}px;--fx:${pct(m.hero.focus.x)};--fy:${pct(m.hero.focus.y)};`);
  if (lg) L.push(`--lg-h:${Math.min(lg.d, Math.floor(300 / lg.ratio))}px;--lg-h-m:${Math.min(lg.m, Math.floor(200 / lg.ratio))}px;--head:${Math.max(72, lg.d + 28)}px;--head-m:${Math.max(58, lg.m + 22)}px;--intro-w:${lg.kare ? 'min(38vw, 230px)' : 'min(62vw, 380px)'};`);
  L.push('}');
  // cerceve duzeni: fotograf kendi genisliginin ustune cikmaz; ekran daha genisse kenarlar marka zeminine erir
  if (m.variant === 'cerceve') L.push(`@media (min-width:${m.hero.w + 1}px){.v-cerceve .hero-media{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 9%,#000 91%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 9%,#000 91%,transparent 100%)}}`);
  L.push(`@media (max-width:899px){:root{--h1-size:clamp(30px,${s.h1m.toFixed(2)}vw,64px)}}`);
  return L.join('\n') + '\n';
}

// kutu: kutunun en/boy orani (object-fit: cover). Kareden genis bir fotograf dik kutuda yukseklikten kirpilir ve gorunen genislik vw'den buyuk olur (11 Kas TR denemesi:
// 4:5 hikaye kutusunda p02-960 x1.13 buyutulmustu): sizes'daki vw degerleri foto/kutu oraniyla buyutulur, tarayici yeterli surumu secer
const pic = (p, { sizes, lazy = true, alt = '', big = true, kutu = null } = {}) => {
  const k = kutu ? Math.max(1, (p.w / p.h) / kutu) : 1;
  const sz = k > 1.01 ? String(sizes).replace(/(\d+(?:\.\d+)?)vw/g, (_, n) => `${Math.round(Number(n) * k)}vw`) : sizes;
  return `<img src="img/${p.name}-960.webp" srcset="img/${p.name}-960.webp ${p.w960}w${big && p.w > p.w960 ? `, img/${p.name}-1600.webp ${p.w}w` : ''}" sizes="${sz}" alt="${esc(alt)}" width="${p.w}" height="${p.h}"${lazy ? ' loading="lazy"' : ''} decoding="async">`;
};
// "*...*" isaretli vurgu -> <em class="vg">; sozcuk sozcuk sarmalama (kaydirinca alttan gelir)
function wordsHtml(parts, i0 = 0) {
  let wi = i0;
  return parts.map((part) => { const inner = part.t.trim().split(/\s+/).filter(Boolean).map((w) => `<span class="w" style="--i:${wi++}"><span>${esc(w)}</span></span>`).join(' '); return part.em ? `<em class="vg">${inner}</em>` : inner; }).join(' ');
}
const emHtml = (parts) => parts.map((p) => (p.em ? `<em class="vg">${esc(p.t.trim())}</em>` : esc(p.t.trim()))).join(' ');

// ---------------- index.html ----------------
export function sayfaHtmlV5(m) {
  const L = T[m.lang]; const D = DAYS[m.lang]; const x = X[m.lang] || X.en; const lg = m.logo; const dil = m.dil;
  const ext = (a) => (a && a.ext ? ' rel="noopener"' : '');
  const logoImg = (cls) => `<img class="${cls}" src="img/${lg.file}" alt="${esc(m.name)}" width="${lg.w}" height="${lg.h}" decoding="async">`;
  const brand = lg ? logoImg('lg') : `<span class="brand-t">${esc(m.name)}</span>`;
  const main = m.cta.main; const second = m.cta.second;
  const nav = [];
  if (m.menu) nav.push(['#menu', L.menu]);
  if (m.story) nav.push(['#hikaye', x.about]);
  nav.push(['#ziyaret', x.visit]);

  // ---- ilk ekran ----
  const facts = [];
  if (m.statusOk) facts.push(`<li class="f-status"><small>${esc(L.now)}</small><span data-status class="status-text"><i></i><b></b></span></li>`);
  if (m.hoursSummary.length) facts.push(`<li class="f-hours"><small>${esc(L.hours)}</small><span>${m.hoursSummary.slice(0, 4).map((r) => `${esc(r.days)} ${esc(r.t)}`).join('<br>')}</span></li>`);
  if (m.address) facts.push(`<li class="f-addr"><small>${esc(L.address)}</small><a href="${esc(m.mapsUrl)}" rel="noopener">${esc(m.address)}</a></li>`);
  if (m.phone) facts.push(`<li class="f-tel"><small>${esc(L.phone)}</small><a href="tel:${esc(m.tel)}">${esc(m.phone)}</a></li>`);
  const factsHtml = facts.length ? `<ul class="facts">${facts.join('')}</ul>` : '';
  const h1 = wordsHtml(m.slogan.parts);
  const ctaHtml = `<div class="cta"><a class="btn btn-accent btn-lg" href="${esc(main.href)}"${ext(main)}>${esc(main.label)}</a>${second ? `<a class="ul cta-2" href="${esc(second.href)}"${ext(second)}>${esc(second.label)}</a>` : ''}</div>`;
  const eyebrow = `<p class="eyebrow"><i></i>${esc(m.eyebrow)}</p>`;
  const lede = m.lede ? `<p class="lede">${esc(m.lede)}</p>` : '';
  let heroIn;
  if (dil === 'mekan') {
    heroIn = `<div class="hero-head">${eyebrow}<h1 id="h1">${h1}</h1>${m.tags.length ? `<p class="hero-tags">${m.tags.map((s) => `<span>${esc(s)}</span>`).join('<i></i>')}</p>` : ''}</div>
    <div class="hero-foot"><div>${lede}${ctaHtml}</div>${factsHtml}</div>`;
  } else heroIn = `${dil === 'sahil' ? '' : eyebrow}<h1 id="h1">${h1}</h1>${lede}${ctaHtml}${factsHtml}`; // ballena: kahramanda baslik ustu etiket yok
  const hf = m.hero.files; const heroSet = Object.keys(hf).map((k) => `img/${hf[k].file} ${hf[k].w}w`).join(', ');
  const heroSrc = hf['1600'] ? hf['1600'].file : hf[Object.keys(hf).pop()].file;
  // tam ekran kahraman object-fit: cover ile kirpilir: dik telefonda yukseklik sinirlar, gorunen genislik 100vh x en/boy olur (11 Kas TR denemesi: 390'da hero-960 x2.95
  // buyutulmustu). sizes bu yuzden max(100vw, en/boy x 100vh): masaustunde degismez, telefonda yeterli surum secilir
  const heroSizes = m.variant === 'cerceve' ? `(min-width: ${m.hero.w}px) ${m.hero.w}px, 100vw` : `max(100vw, ${Math.round((100 * m.hero.w) / m.hero.h)}vh)`;

  // ---- bolumler ----
  const S = {};
  if (m.marquee && m.marquee.length >= 4) {
    const run = m.marquee.map((s) => `<span>${esc(s)}</span>`).join('');
    S.marquee = `<div class="marquee" aria-label="${esc(m.marquee.join(', '))}"><div class="marquee-in" aria-hidden="true">${run}${run}</div></div>`;
  }
  if (m.menu) {
    const mn = m.menu;
    const rows = mn.items.map((it) => `<li class="dish"><h3>${it.href ? `<a class="ul" href="${esc(it.href)}" rel="noopener">${esc(it.n)}</a>` : esc(it.n)}</h3>${it.p ? `<span class="pr">${esc(it.p)}</span>` : ''}${it.d ? `<p class="dd">${esc(it.d)}</p>` : ''}</li>`).join('');
    S.menu = `<section class="split${dil === 'mekan' ? ' rev' : ''}" id="menu" aria-labelledby="menu-h" data-par>
  <div class="split-pic" style="--fx:${pct(mn.pic.focus.x)};--fy:${pct(mn.pic.focus.y)}">${pic(mn.pic, { sizes: '(max-width: 899px) 100vw, 50vw', alt: mn.pic.alt, kutu: 0.75 })}</div>
  <div class="split-panel">
    <span class="kicker rv">${esc(mn.kicker)}</span>
    <h2 class="h2 wr" id="menu-h">${wordsHtml(mn.h2)}</h2>
    ${mn.p ? `<p class="p rv">${esc(mn.p)}</p>` : ''}
    ${rows ? `<ul class="dishes rv">${rows}</ul>` : ''}
    ${mn.legend ? `<p class="legend rv">${esc(mn.legend)}</p>` : ''}
    ${mn.link ? `<a class="btn btn-ghost rv" href="${esc(mn.link)}" rel="noopener">${esc(L.fullMenu)}</a>` : ''}
  </div>
</section>`;
  }
  if (m.cards) {
    const c = m.cards;
    S.cards = `<section class="sec cards" aria-labelledby="cards-h">
  <div class="sec-h"><div><span class="kicker rv">${esc(c.kicker)}</span><h2 class="h2 wr" id="cards-h">${wordsHtml(c.h2)}</h2></div>${c.p ? `<p class="p rv">${esc(c.p)}</p>` : ''}</div>
  <div class="deck" style="--n:${c.items.length}" data-par>${c.items.map((it, i) => `<figure class="card" style="--i:${i};--fx:${pct(it.pic.focus.x)};--fy:${pct(it.pic.focus.y)}">${pic(it.pic, { sizes: `(max-width: 899px) 76vw, ${Math.round(92 / c.items.length)}vw`, alt: it.t || '' })}${it.t ? `<figcaption><b>${esc(it.t)}</b>${it.sub ? `<span class="card-sub">${esc(it.sub)}</span>` : ''}</figcaption>` : ''}<i class="glare" aria-hidden="true"></i></figure>`).join('')}</div>
</section>`;
  }
  if (m.story) {
    const st = m.story;
    S.story = `<section class="sec story" id="hikaye" aria-labelledby="story-h" data-par>
  <div><span class="kicker rv">${esc(st.kicker)}</span><h2 class="h2 wr" id="story-h">${wordsHtml([{ t: st.text, em: false }])}</h2>${st.p ? `<p class="p rv">${esc(st.p)}</p>` : ''}${dil === 'sicak' ? '<div class="rule rv"></div>' : ''}</div>
  ${st.pic ? `<div class="story-pic rv" style="--fx:${pct(st.pic.focus.x)};--fy:${pct(st.pic.focus.y)}">${pic(st.pic, { sizes: '(max-width: 1100px) 100vw, 40vw', alt: st.pic.alt, kutu: 0.8 })}</div>` : ''}
</section>`;
  }
  if (m.quiet) {
    const q = m.quiet;
    S.quiet = `<section class="quiet" aria-labelledby="quiet-h" data-par style="--q-w:${q.pic.w}px;--q-ar:${q.pic.w} / ${q.pic.h}">
  <div class="quiet-in" style="--fx:${pct(q.pic.focus.x)};--fy:${pct(q.pic.focus.y)}">${pic(q.pic, { sizes: `(min-width: ${q.pic.w}px) ${q.pic.w}px, 100vw`, alt: q.pic.alt })}
    <div class="quiet-shade" aria-hidden="true"></div>
    <div class="quiet-t">${q.kicker ? `<span class="kicker">${esc(q.kicker)}</span>` : ''}<h2 class="h2 wr" id="quiet-h">${wordsHtml(q.h2)}</h2></div>
    ${q.p ? `<p class="quiet-p rv">${esc(q.p)}</p>` : ''}
  </div>
</section>`;
  }
  const hoursTable = m.hoursTable && m.hoursOk ? `<table class="hours"><caption class="sr">${esc(L.hoursCap)}</caption><tbody>${m.hoursTable.map((r) => `<tr data-day="${r.d}"><th scope="row">${esc(r.label)}</th><td>${esc(r.t === null ? L.unknown : r.t)}</td></tr>`).join('')}</tbody></table>` : '';
  const ct = m.contact;
  S.contact = `<section class="sec contact${ct.pic ? '' : ' solo'}" id="ziyaret" aria-labelledby="vis-h" data-par>
  <div class="contact-card rv">
    <span class="kicker">${esc(ct.kicker)}</span>
    <h2 class="h2" id="vis-h">${emHtml(ct.h2)}</h2>
    ${m.statusOk ? '<p class="status-text" data-status><i></i><b></b></p>' : ''}
    ${hoursTable}
    <div class="addr">${m.address ? `<div><small>${esc(L.address)}</small><a href="${esc(m.mapsUrl)}" rel="noopener">${esc(m.address)}</a></div>` : ''}${m.phone ? `<div><small>${esc(L.phone)}</small><a href="tel:${esc(m.tel)}">${esc(m.phone)}</a></div>` : ''}</div>
    ${ct.notes.length ? `<ul class="notes">${ct.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    <div class="contact-cta"><a class="btn btn-accent" href="${esc(main.href)}"${ext(main)}>${esc(main.label)}</a>${m.mapsUrl ? `<a class="btn btn-ghost" href="${esc(m.mapsUrl)}" rel="noopener">${esc(L.directions)}</a>` : ''}</div>
  </div>
  ${ct.pic ? `<div class="contact-pic rv" style="--fx:${pct(ct.pic.focus.x)};--fy:${pct(ct.pic.focus.y)}">${pic(ct.pic, { sizes: '(max-width: 1100px) 100vw, 40vw', alt: ct.pic.alt, kutu: 0.8 })}</div>` : ''}
</section>`;
  const body = m.order.map((k) => S[k]).filter(Boolean).join('\n\n');

  // ---- alt bilgi, telefon cubugu ----
  const social = Object.entries(m.social || {}).map(([k, u]) => `<li><a href="${esc(u)}" rel="noopener">${esc(k === 'instagram' ? 'Instagram' : 'Facebook')}</a></li>`).join('');
  const barItems = [`<a class="main" href="${esc(main.href)}"${ext(main)}>${ICON[main.ikon] || (main.tel ? ICON.tel : ICON.cal)}<span>${esc(main.short)}</span></a>`];
  if (m.menu) barItems.push(`<a href="#menu">${ICON.menu}<span>${esc(L.menu)}</span></a>`);
  if (m.mapsUrl) barItems.push(`<a href="${esc(m.mapsUrl)}" rel="noopener">${ICON.pin}<span>${esc(L.directionsShort)}</span></a>`);
  if (m.phone && !main.tel) barItems.push(`<a href="tel:${esc(m.tel)}">${ICON.tel}<span>${esc(L.call)}</span></a>`);
  const barCols = `1.35fr ${new Array(barItems.length - 1).fill('1fr').join(' ')}`;
  const title = `${m.name}${m.cityLabel ? ' · ' + m.cityLabel : ''}: ${m.lang === 'tr' ? 'web sitesi taslağı' : 'website draft'}`;
  const desc = m.lang === 'tr' ? `${m.name} için hazırlanmış web sitesi taslağı (yayında değil).` : `A website draft prepared for ${m.name} (not live).`;
  const pre = (m.fontPreload || []).map((f) => `<link rel="preload" href="../../${m.ortak || '_uyarla'}/fonts/${f}" as="font" type="font/woff2" crossorigin>`).join('\n');
  const data = { t: { open: L.open('{t}'), shut: L.shut('{w}'), today: L.whenToday('{t}'), tomorrow: L.whenTomorrow('{t}'), dayAt: L.whenDay('{d}', '{t}') }, days: D, h: m.statusOk ? m.week : null, h12: !!m.h12, tz: m.tz };
  const icon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${m.palette.t.accent}"/><text x="16" y="23" font-family="Georgia,serif" font-size="20" font-weight="700" text-anchor="middle" fill="${m.palette.t.accentInk}">${esc((m.name.match(/[\p{L}\p{N}]/u) || ['•'])[0].toUpperCase())}</text></svg>`)}`;
  const topBtn = `<a class="btn ${dil === 'sahil' ? 'btn-ghost' : 'btn-accent'}" href="${esc(main.href)}"${ext(main)}>${esc(main.short2 || main.label)}</a>`;
  const navHtml = `<nav class="nav" aria-label="${esc(L.nav)}">${nav.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join('')}</nav>`;
  const status = m.statusOk ? '<span class="status" data-status role="status"><i></i><b></b></span>' : '';
  // ust cubuk: sahil = solda cerceveli ana eylem, ortada logo (ballena); sicak = solda gezinme, ortada logo (khufus); mekan = solda logo yaninda gezinme, sagda eylem (amrit)
  const top = dil === 'sahil' ? `<div class="top-l">${topBtn}</div><a class="brand" href="#top" aria-label="${esc(m.name)}">${brand}</a><div class="top-r">${status}<a class="top-link" href="#menu">${esc(L.menu)}</a><a class="top-link" href="#ziyaret">${esc(x.visit)}</a></div>`
    : dil === 'sicak' ? `${navHtml}<a class="brand" href="#top" aria-label="${esc(m.name)}">${brand}</a><div class="top-r">${status}${topBtn}</div>`
      : `<div class="top-l"><a class="brand" href="#top" aria-label="${esc(m.name)}">${brand}</a></div>${navHtml}<div class="top-r">${status}${topBtn}</div>`;
  return `<!doctype html>
<html lang="${m.lang}" class="d-${dil} v-${m.variant}${m.topSolid ? ' top-solid' : ''}${m.footPlate ? ' foot-plate' : ''} ${m.dark ? 'is-dark' : 'is-light'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="${lg ? lg.headBg : m.palette.t.bg}">
<meta name="color-scheme" content="${m.dark ? 'dark' : 'light'}">
<link rel="icon" href="${icon}">
${pre}
<link rel="preload" as="image" href="img/${heroSrc}" imagesrcset="${heroSet}" imagesizes="${heroSizes}" fetchpriority="high">
<link rel="stylesheet" href="../../${m.ortak || '_uyarla'}/v5.css">
<link rel="stylesheet" href="theme.css">
<script>(function(){var c=document.documentElement.classList,q=location.search;if(/capture=1/.test(q))c.add('no-intro','still');else if(/nointro=1/.test(q)||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))c.add('no-intro');})();</script>
</head>
<body>
<a class="skip" href="#main">${esc(L.skip)}</a>
<div class="intro" aria-hidden="true"><div class="intro-in">${lg ? `<img src="img/${lg.file}" alt="" width="${lg.w}" height="${lg.h}">` : `<span class="brand-t">${esc(m.name)}</span>`}<i></i></div></div>

<header class="top${m.topSolid ? ' solid' : ''}" id="top"${m.topSolid ? ' data-solid' : ''}>
  ${top}
</header>

<main id="main">
<section class="hero" aria-labelledby="h1">
  <div class="hero-media"><img class="hero-img" src="img/${heroSrc}" srcset="${heroSet}" sizes="${heroSizes}" alt="${esc(m.hero.alt || '')}" width="${m.hero.w}" height="${m.hero.h}" fetchpriority="high" decoding="async"></div>
  <div class="hero-shade"></div>
  <div class="hero-in wrap">
    ${heroIn}
  </div>
</section>

${body}
</main>

<footer class="foot">
  <div class="foot-grid">
    <div><a class="brand" href="#top" aria-label="${esc(m.name)}">${brand}</a><p>${esc(L.draft(m.name))}</p></div>
    <div><h4>${esc(x.visit)}</h4><ul>${m.address ? `<li><a href="${esc(m.mapsUrl)}" rel="noopener">${esc(m.address)}</a></li>` : ''}${m.phone ? `<li><a href="tel:${esc(m.tel)}">${esc(m.phone)}</a></li>` : ''}${(m.also || []).map((a) => `<li><span>${esc(x.also)}</span>${esc(a)}</li>`).join('')}</ul></div>
    <div><h4>${esc(L.hours)}</h4><ul>${m.hoursSummary.length ? m.hoursSummary.map((r) => `<li>${esc(r.daysLong)}<span>${esc(r.t)}</span></li>`).join('') : `<li>${esc(L.callUs)}</li>`}</ul></div>
    <div><h4>${esc(x.links)}</h4><ul><li><a href="${esc(main.href)}"${ext(main)}>${esc(main.label)}</a></li>${m.menu && m.menu.link ? `<li><a href="${esc(m.menu.link)}" rel="noopener">${esc(L.fullMenu)}</a></li>` : ''}${social}${m.site ? `<li><a href="${esc(m.site)}" rel="noopener nofollow">${esc(L.currentSite)}</a></li>` : ''}</ul></div>
  </div>
  <div class="wordmark" aria-hidden="true">${esc(m.name)}</div>
  <div class="foot-last"><span>${esc(L.draftBy)}</span><span>${esc(m.lang === 'tr' ? 'Taslak, yayında değil' : 'Draft, not live')}</span></div>
</footer>

<nav class="bar" aria-label="${esc(L.quick)}" style="grid-template-columns:${barCols}">
  ${barItems.join('\n  ')}
</nav>

<script type="application/json" id="r-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script src="../../${m.ortak || '_uyarla'}/v5.js" defer></script>
</body>
</html>
`;
}
