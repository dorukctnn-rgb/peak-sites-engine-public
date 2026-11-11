// HTML ve theme.css uretimi ("sahne" duzeni). Girdi: uret.mjs'in kurdugu "model" (isletmenin kendi verisi + secilen font + palet). Dil modeli yok; sablon + kural.
// Kurallar: buyuk baslik SLOGANDIR (ad degil); logo orijinal dosyadir ve hicbir filtre almaz; hareket katmanlari (WebGL, 3D, acilis) JS/WebGL olmadan da ayni icerigi duragan gosterir.
import { T, DAYS } from './metin.mjs';
import { ORTAK } from './yol.mjs';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rgbTriplet = (hex) => { const x = hex.replace('#', ''); return `${parseInt(x.slice(0, 2), 16)},${parseInt(x.slice(2, 4), 16)},${parseInt(x.slice(4, 6), 16)}`; };
const pct = (n) => `${+(n * 100).toFixed(1)}%`;
const X = {
  tr: { cardsH: ['Menüden', 'seçmeler'], cardsSub: (n) => `Kalemler ve fiyatlar ${n} menüsünden.`, all: (n) => `Tümünü gör (${n})`, signH: ['Öne', 'çıkanlar'], signSub: (n) => `Fotoğraflar ve fiyatlar ${n} sitesinden.`, about: 'Hakkımızda', photo: 'Fotoğraf', scroll: 'Kaydırın', photos: 'Fotoğraflar' },
  en: { cardsH: ['On', 'the menu'], cardsSub: (n) => `Dishes and prices from ${n}’s own menu.`, all: (n) => `See all ${n}`, signH: ['From', 'the kitchen'], signSub: (n) => `Photos and prices from ${n}’s own site.`, about: 'About', photo: 'Photo', scroll: 'Scroll', photos: 'Photos' },
};

const ICON = {
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M8.5 9h7M8.5 13h7"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>',
};

// ---------------- theme.css ----------------
export function themeCss(m) {
  const t = m.palette.t; const f = m.font; const k = m.kb; const lg = m.logo;
  const dispFam = `"${f.display.family}"`; const textFam = `"${f.text.family}"`;
  const headBg = lg ? lg.headBg : t.bg; const headInk = lg ? lg.headInk : t.ink;
  const split = m.variant === 'bolme';
  const lines = [];
  lines.push(`/* ${m.name}: kendi sitesinden alinan renkler ve fontlar. Font: ${f.display.family} (${f.display.via}), ${f.text.family} (${f.text.via}). Logo: orijinal dosya, filtre yok. */`);
  lines.push(m.fontFaceCss);
  lines.push(`:root{`);
  const v = { bg: t.bg, 'bg-rgb': rgbTriplet(t.bg), bg2: t.bg2, ink: t.ink, muted: t.muted, line: t.line, accent: t.accent, 'accent-ink': t.accentInk, 'accent-hi': t.accentHi, 'accent-text': t.accentText, accent2: t.accent2, 'accent2-rgb': rgbTriplet(t.accent2), 'accent2-text': t.accent2Text, deep: t.deep, 'on-deep': t.onDeep, 'on-deep-muted': t.onDeepMuted, 'accent-on-deep': t.accentOnDeep,
    'hero-ink': split ? t.ink : t.heroInk, 'hero-muted': split ? t.muted : 'rgba(255,255,255,.9)', 'hero-accent': split ? t.accentText : t.heroAccent, 'hero-line': split ? t.line : 'rgba(255,255,255,.26)', 'shade-rgb': rgbTriplet(t.shade), 'shade-a': m.shadeA, 'shade-m': m.shadeM,
    'head-bg': headBg, 'head-bg-rgb': rgbTriplet(headBg), 'head-ink': headInk };
  for (const [a, b] of Object.entries(v)) lines.push(`--${a}:${b};`);
  lines.push(`--display:${dispFam},${m.fallback.display};--text:${textFam},${m.fallback.text};`);
  lines.push(`--d-weight:${f.display.weight};--d-style:${f.display.italic ? 'italic' : 'normal'};--d-case:${m.caps ? 'uppercase' : 'none'};--d-ls:${m.ls}em;--em-style:${m.emStyle};`);
  lines.push(`--h1-size:${m.size.h1};--h1-max:${m.size.h1max};--h2-size:${m.size.h2};--h3-size:${m.size.h3};--h1-lh:${m.size.lh};--btn-r:${m.btnR};--r:${m.cardR};`);
  lines.push(`--kb-step:${k.step}s;--kb-total:${k.total}s;--kb-ov:${k.ov}s;`);
  lines.push(`--map-bg:${m.map.bg};--map-road:${m.map.road};--map-fine:${m.map.fine};`);
  if (lg) lines.push(`--lg-h:${Math.min(lg.d, Math.floor(300 / lg.ratio))}px;--lg-h-m:${Math.min(lg.m, Math.floor(200 / lg.ratio))}px;--head:${Math.max(72, lg.d + 28)}px;--head-m:${Math.max(58, lg.m + 22)}px;--intro-w:${lg.kare ? 'min(38vw, 230px)' : 'min(62vw, 380px)'};`);
  lines.push(`}`);
  // Ken Burns yedegi (WebGL yoksa): kendi fotograflari, yavas yaklasma ve kayma, fotograflar arasi gecis (yalniz CSS)
  const T0 = k.total; const ov = k.ov; const S = k.step;
  const p = (x) => +((x / T0) * 100).toFixed(3);
  lines.push(`@keyframes kb-fade{0%{opacity:0}${p(ov)}%{opacity:1}${p(S)}%{opacity:1}${p(S + ov)}%{opacity:0}100%{opacity:0}}`);
  const zoom = (name, dx, dy, s0, s1) => `@keyframes ${name}{0%{transform:scale(${s0}) translate3d(0,0,0)}${p(S + ov)}%{transform:scale(${s1}) translate3d(${dx}%,${dy}%,0)}100%{transform:scale(${s1}) translate3d(${dx}%,${dy}%,0)}}`;
  lines.push(zoom('kb-zoom-a', -1.6, -1.0, 1.02, 1.16), zoom('kb-zoom-b', 1.8, -0.8, 1.15, 1.03), zoom('kb-zoom-c', -1.2, 1.2, 1.02, 1.14));
  return lines.join('\n');
}

const words = (text, cls = 'w') => String(text).split(/\s+/).filter(Boolean).map((w, i) => `<span class="${cls}" style="--i:${i}"><span>${esc(w)}</span></span>`).join(' ');
const pic = (p, { size = '960', sizes, lazy = true, cls = '', alt = '' } = {}) => `<img${cls ? ` class="${cls}"` : ''} src="img/${p.name}-${size}.webp" srcset="img/${p.name}-960.webp 960w, img/${p.name}-1600.webp 1600w" sizes="${sizes}" alt="${esc(alt)}" width="${p.w}" height="${p.h}"${lazy ? ' loading="lazy" fetchpriority="low"' : ' fetchpriority="high"'} decoding="async">`;

// ---------------- index.html ----------------
export function sayfaHtml(m) {
  const E = (m.etiket && (m.etiket[m.lang] || m.etiket.en)) || {};
  const L = { ...T[m.lang], ...E }; const D = DAYS[m.lang]; const x = { ...X[m.lang], ...(E.x || {}) }; const lg = m.logo;
  const K = m.sektor === 'konaklama' ? m.kon : null; // kucuk konaklama profili
  const G = m.sektor === 'guzellik' ? m.kon : null; // guzellik profili (restoran sayfa yapisi: hizmet ve fiyat listesi = menu)
  const KB = K || G; // dogrudan randevu / rezervasyon hedefi olan profil
  const hasMenu = m.menu.groups.length > 0; const hasLink = !!m.menu.link; const hasSign = m.signature.length >= 3;
  const nav = [];
  const hasRooms = !!(K && K.odalar.length >= 2);
  if (hasRooms) nav.push(['#odalar', L.rooms]);
  if ((hasMenu || hasLink) && !nav.some(([, t]) => t === L.menu)) nav.push(['#menu', L.menu]); // konaklamada "Rooms" iki kez cikmasin
  if (m.gallery.length >= 3) nav.push(['#galeri', L.gallery]);
  nav.push(['#ziyaret', L.visit]);
  const bookExt = !!(KB && KB.bookUrl && KB.bookHost);
  const bookHref = bookExt ? KB.bookUrl : '#rezervasyon';
  const bookAttr = bookExt ? ' rel="noopener"' : '';
  const secondary = hasRooms ? `<a class="btn btn-ghost btn-lg" href="#odalar">${esc(L.seeMenu)}</a>` : hasMenu || hasLink ? `<a class="btn btn-ghost btn-lg" href="#menu">${esc(L.seeMenu)}</a>` : m.mapsUrl ? `<a class="btn btn-ghost btn-lg" href="${esc(m.mapsUrl)}" rel="noopener">${esc(L.directionsShort)}</a>` : '';
  // LOGO: orijinal dosya, oldugu gibi (genislik/yukseklik oranini tarayici korur; filtre, kirpma yok)
  const logoImg = (cls, alt) => `<img class="${cls}" src="img/${lg.file}" alt="${esc(alt)}" width="${lg.w}" height="${lg.h}" decoding="async">`;
  const brandHtml = (cls) => (lg ? logoImg(cls, m.name) : `<span class="brand-t">${esc(m.name)}</span>`);
  const split = m.variant === 'bolme';
  const heroSizes = split ? '(max-width: 899px) 100vw, 56vw' : '100vw';
  const slides = m.hero.map((p, i) => `<li style="--i:${i};--fx:${pct(p.focus.x)};--fy:${pct(p.focus.y)}"${p.depth ? ` data-d="img/${p.depth}"` : ''}>${pic(p, { size: '1600', sizes: heroSizes, lazy: i > 0 })}</li>`).join('');
  const facts = [];
  if (K) {
    if (K.giris.in) facts.push(`<li class="f-hours"><small>${esc(L.checkIn)}</small><span>${esc(K.giris.in)}${K.giris.out ? `<br><span class="f-note">${esc(L.checkOut)} ${esc(K.giris.out)}</span>` : ''}</span></li>`);
    if (K.fromP) facts.push(`<li class="f-status"><small>${esc(L.from)}</small><span>${esc(K.fromP)} ${esc(L.perNight)}</span></li>`);
  }
  if (m.statusOk) facts.push(`<li class="f-status"><small>${esc(L.now)}</small><span data-status class="status-text"><i></i><b></b></span></li>`);
  if (m.hoursSummary.length) facts.push(`<li class="f-hours"><small>${esc(L.hours)}</small><span>${m.hoursSummary.slice(0, 3).map((r) => `${esc(r.days)} ${esc(r.t)}`).join('<br>')}${m.hoursNote && m.hoursSummary.length <= 2 ? `<br><span class="f-note">${esc(m.hoursNote)}</span>` : ''}</span></li>`);
  if (m.address) facts.push(`<li class="f-addr"><small>${esc(L.address)}</small><a href="${esc(m.mapsUrl)}" rel="noopener">${esc(m.address)}</a></li>`);
  if (m.phone) facts.push(`<li class="f-tel"><small>${esc(L.phone)}</small><a href="tel:${esc(m.tel)}">${esc(m.phone)}</a></li>`);
  // slogan: sozcuk sozcuk (acilista asagidan gelir); vurgulu parca <em>
  let wi = 0;
  const h1 = m.slogan.parts.map((part) => { const inner = part.t.trim().split(/\s+/).filter(Boolean).map((w) => `<span class="w" style="--i:${wi++}"><span>${esc(w)}</span></span>`).join(' '); return part.em ? `<em>${inner}</em>` : inner; }).join(' ');

  // one cikanlar: 3D egilen kartlar (kendi yemek fotograflari + kendi fiyatlari)
  const signHtml = hasSign ? `<section class="sec sign" id="one-cikanlar" aria-labelledby="sign-h">
  <div class="sec-h rv"><h2 id="sign-h">${esc(x.signH[0])} <em>${esc(x.signH[1])}</em></h2><p>${esc(x.signSub(m.name))}</p></div>
  <div class="deck${m.signature.every((x) => x.pic.w / x.pic.h >= 1.25) ? ' land' : ''}" data-deck data-n="${m.signature.length}">${m.signature.map((s, i) => `
    <article class="card3" style="--i:${i}"><div class="card3-in">
      <div class="card3-pic" style="--fx:${pct(s.pic.focus.x)};--fy:${pct(s.pic.focus.y)}">${pic(s.pic, { sizes: '(max-width: 899px) 74vw, 26vw' })}</div>
      ${s.p ? `<span class="card3-pr">${esc(s.p)}</span>` : ''}
      <div class="card3-t"><h3>${esc(s.n)}</h3>${s.d ? `<p>${esc(s.d)}</p>` : ''}</div>
      <i class="glare" aria-hidden="true"></i>
    </div></article>`).join('')}
  </div>
</section>` : (m.menuCards && m.menuCards.length >= 3) ? `<section class="sec sign" id="one-cikanlar" aria-labelledby="sign-h">
  <div class="sec-h rv"><h2 id="sign-h">${esc(x.cardsH[0])} <em>${esc(x.cardsH[1])}</em></h2><p>${esc(x.cardsSub(m.name))}</p></div>
  <div class="deck cards" data-deck data-n="${m.menuCards.length}" style="--n:${m.menuCards.length}">${m.menuCards.map((c, i) => `
    <article class="card3 mcard" style="--i:${i}"><a class="card3-in" href="#menu" data-tab="${c.tab}">
      <span class="mcard-n">${String(i + 1).padStart(2, '0')}</span>
      <h3>${esc(c.name)}</h3>
      <ul>${c.items.map((it) => `<li><span>${esc(it.n)}</span><b>${esc(it.p)}</b></li>`).join('')}</ul>
      <span class="mcard-more">${esc(x.all(c.n))}</span>
      <i class="glare" aria-hidden="true"></i>
    </a></article>`).join('')}
  </div>
</section>` : '';

  // odalar (konaklama): kendi oda adlari, "from" fiyatlari ve ozellikleri; 3D egilen kartlar (fotograf yalniz alt yazisi o odayi soyluyorsa kartta)
  const roomsHtml = hasRooms ? `<section class="sec sign rooms" id="odalar" aria-labelledby="oda-h">
  <div class="sec-h rv"><h2 id="oda-h">${esc(L.roomsH[0])} <em>${esc(L.roomsH[1])}</em></h2><p>${esc(L.roomsSub(m.name, K.odalar.some((o) => o.p)))}</p></div>
  <div class="deck cards" data-deck data-n="${K.odalar.length}" style="--n:${K.odalar.length}">${K.odalar.map((o, i) => `
    <article class="card3 mcard" style="--i:${i}"><a class="card3-in" href="${esc(bookHref)}"${bookAttr}>
      <span class="mcard-n">${String(i + 1).padStart(2, '0')}</span>
      <h3>${esc(o.n)}</h3>
      ${o.d ? `<p class="mcard-d">${esc(o.d)}</p>` : ''}
      <ul>${o.p ? `<li><span>${esc(o.per === 'person' ? 'Per person' : o.per === 'week' ? 'A week' : 'From')}</span><b>${esc(o.p)}</b></li>` : ''}${o.oz.map((z) => `<li><span>${esc(z)}</span><b></b></li>`).join('')}</ul>
      <span class="mcard-more">${esc(L.book)}</span>
      <i class="glare" aria-hidden="true"></i>
    </a></article>`).join('')}
  </div>
</section>` : '';
  const amenHtml = K && K.olanak.length >= 3 ? `<section class="sec amen-sec" id="olanaklar" aria-labelledby="ol-h">
  <div class="sec-h rv"><h2 id="ol-h">${esc(L.amenH[0])} <em>${esc(L.amenH[1])}</em></h2><p>${esc(L.amenSub(m.name))}</p></div>
  <ul class="amen rv">${K.olanak.map((a, i) => `<li style="--i:${i}">${esc(a)}</li>`).join('')}</ul>
</section>` : '';

  // hikaye: kendi cumlesi, kaydirdikca sozcuk sozcuk aydinlanir; kendi fotograflari 3D olarak masaya dizilir
  const storyHtml = m.story ? `<section class="story" data-story aria-labelledby="story-k">
  <div class="story-pin">
    <div class="story-t"><p class="kicker" id="story-k">${esc(x.about)}</p><p class="story-q">${words(m.story.text)}</p></div>
    <div class="story-pics" aria-hidden="true">${m.story.pics.map((p, i) => `<figure style="--k:${i};--fx:${pct(p.focus.x)};--fy:${pct(p.focus.y)}">${pic(p, { sizes: '(max-width: 899px) 60vw, 28vw' })}</figure>`).join('')}</div>
  </div>
</section>` : '';

  // galeri
  let galleryHtml = '';
  if (m.gallery.length >= 3) {
    const five = m.gallery.length >= 5; const items = m.gallery.slice(0, five ? 5 : 3);
    // buyuk (dik) kutuya dik bir kare gelir; hic dik kare yoksa ilk kutu yatay olur (m5w)
    const pi = items.findIndex((p) => p.h / p.w >= 1.1); if (five && pi > 0) items.unshift(items.splice(pi, 1)[0]);
    const wide = five && pi < 0;
    galleryHtml = `<section class="sec" id="galeri" aria-labelledby="gal-h">
  <div class="sec-h rv"><h2 id="gal-h">${esc(L.galleryH[0])} <em>${esc(L.galleryH[1])}</em></h2></div>
  <div class="gal${five ? (wide ? ' m5 m5w' : ' m5') : ''}" data-tilt-group>${items.map((p, i) => `<figure class="tilt" style="--i:${i};--fx:${pct(p.focus.x)};--fy:${pct(p.focus.y)}">${pic(p, { size: p.w >= 1400 && five && i === 0 ? '1600' : '960', sizes: `(max-width: 899px) 78vw, ${five ? '40vw' : '33vw'}`, alt: p.alt || '' })}${p.alt ? `<figcaption>${esc(p.alt)}</figcaption>` : ''}</figure>`).join('')}</div>
  ${m.stats.length >= 2 ? `<div class="stats rv">${m.stats.map((s) => `<div><b>${esc(s.v)}</b><span>${esc(s.l)}</span></div>`).join('')}</div>` : ''}
</section>`;
  }
  // menu
  let menuHtml = '';
  if (hasMenu) {
    const g = m.menu.groups; const solo = g.length === 1;
    menuHtml = `<section class="sec menu" id="menu" aria-labelledby="menu-h">
  <div class="sec-h rv"><h2 id="menu-h">${esc(L.menuH)}</h2><p>${esc(L.menuSub(m.name))}</p></div>
  ${solo ? '' : `<div class="tabbar"><div class="tabs" role="tablist">${g.map((y, i) => `<button class="tab" role="tab" id="tab-${i}" aria-controls="p-${i}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}>${esc(y.name)}</button>`).join('')}</div></div>`}
  <div class="menu-grid${m.menuVis.length ? '' : ' solo'}">
    <div>
      ${g.map((y, i) => `<ul class="panel" role="${solo ? 'list' : 'tabpanel'}" id="p-${i}"${solo ? '' : ` aria-labelledby="tab-${i}"`}${i ? ' hidden' : ''}>${y.items.map((it, j) => `
        <li class="dish" style="--j:${j}"><h3>${esc(it.n)}</h3>${it.p ? `<span class="pr">${esc(it.p)}</span>` : ''}${it.d ? `<p class="dd">${esc(it.d)}</p>` : ''}</li>`).join('')}
      </ul>`).join('\n      ')}
      <p class="legend">${esc(L.menuLegend(m.name))}${m.menu.link ? ` <a href="${esc(m.menu.link)}" rel="noopener">${esc(L.fullMenu)}</a>` : ''}</p>
    </div>
    ${m.menuVis.length ? `<div class="menu-vis" aria-hidden="true">${m.menuVis.map((p) => pic(p, { sizes: '(min-width: 1101px) 40vw, 1px' }).replace('<img', `<img style="--fx:${pct(p.focus.x)};--fy:${pct(p.focus.y)}"`)).join('')}</div>` : ''}
  </div>
</section>`;
  } else if (hasLink) {
    menuHtml = `<section class="sec menu" id="menu" aria-labelledby="menu-h">
  <div class="sec-h rv"><h2 id="menu-h">${esc(L.menuH)}</h2></div>
  <div class="menu-link rv"><p>${esc(L.menuLinkOnly)}</p><a class="btn btn-accent btn-lg" href="${esc(m.menu.link)}" rel="noopener">${esc(L.fullMenu)}</a></div>
</section>`;
  }
  // rezervasyon
  const days = m.slots ? [0, 1, 2, 3].map((i) => { const lb = i === 0 ? L.today : i === 1 ? L.tomorrow : DAYS[m.lang][(i + 2) % 7]; const hid = i > 1 ? ' hidden' : ''; return `<input type="radio" name="gun" id="gun${i}" value="${esc(lb)}" data-l="${esc(lb)}"${i === 0 ? ' checked' : ''}${hid}><label for="gun${i}"${hid}>${esc(lb)}</label>`; }).join('') : `<input type="radio" name="gun" id="gun0" value="${esc(L.today)}" data-l="${esc(L.today)}" checked><label for="gun0">${esc(L.today)}</label><input type="radio" name="gun" id="gun1" value="${esc(L.tomorrow)}" data-l="${esc(L.tomorrow)}"><label for="gun1">${esc(L.tomorrow)}</label>`;
  const slotsHtml = m.firstSlots.map((s, i) => `<input type="radio" name="saat" id="saat${i}" value="${s}" data-l="${s}"${i === Math.min(2, m.firstSlots.length - 1) ? ' checked' : ''}><label for="saat${i}">${s}</label>`).join('');
  const realLine = m.reservationHost ? L.realLine(m.reservationHost) : L.realLineGeneric;
  const nightsHtml = [1, 2, 3, 4, 5, 6, 7].map((n, i) => `<input type="radio" name="saat" id="saat${i}" value="${n}" data-l="${esc(L.nights ? L.nights(n) : n)}"${n === 2 ? ' checked' : ''}><label for="saat${i}">${n}</label>`).join('');
  const bookPicHtml = m.bookPic ? `<div class="book-pic rv" style="--fx:${pct(m.bookPic.focus.x)};--fy:${pct(m.bookPic.focus.y)}">
      ${pic(m.bookPic, { sizes: '(max-width: 1100px) 100vw, 40vw' })}
      ${m.phone ? `<div><p>${esc(L.callUs)}</p><a href="tel:${esc(m.tel)}">${esc(m.phone)}</a></div>` : ''}
    </div>` : '';
  const directBook = bookExt ? `<section class="sec book on-deep" id="rezervasyon" aria-labelledby="rez-h">
  <div class="book-grid">
    ${bookPicHtml}
    <div class="rv">
      <h2 class="h2" id="rez-h">${esc(L.bookDirectH[0])} <em>${esc(L.bookDirectH[1])}</em></h2>
      <p class="book-lead">${esc(L.bookDirectSub(KB.bookHost))}</p>
      <div class="visit-cta"><a class="btn btn-accent btn-lg" href="${esc(KB.bookUrl)}" rel="noopener">${esc(L.bookDirectBtn)}</a>${m.phone ? `<a class="btn btn-ghost btn-lg" href="tel:${esc(m.tel)}">${esc(L.call)}</a>` : ''}</div>
    </div>
  </div>
</section>` : '';
  const konForm = `<section class="sec book on-deep" id="rezervasyon" aria-labelledby="rez-h">
  <div class="book-grid">
    ${bookPicHtml}
    <div class="rv">
      <h2 class="h2" id="rez-h">${esc(L.bookH[0])} <em>${esc(L.bookH[1])}</em></h2>
      <p class="book-lead">${esc(L.bookSub)}</p>
      <form id="rez" novalidate>
        <div class="fields">
          <fieldset><legend>${esc(L.people)}</legend><div class="chips">${[1, 2, 3, 4, 5, 6].map((n, i) => `<input type="radio" name="kisi" id="kisi${i}" value="${n}" data-l="${n}"${n === 2 ? ' checked' : ''}><label for="kisi${i}">${n}</label>`).join('')}</div></fieldset>
          <div class="two">
            <div class="fld"><label for="gun">${esc(L.day)}</label><input id="gun" name="gun" type="date" required data-date></div>
            <fieldset><legend>${esc(L.time)}</legend><div class="chips">${nightsHtml}</div></fieldset>
          </div>
          <div class="two">
            <div class="fld"><label for="ad">${esc(L.name)}</label><input id="ad" name="ad" type="text" autocomplete="name" required></div>
            <div class="fld"><label for="eposta">${esc(L.email)}</label><input id="eposta" name="eposta" type="email" autocomplete="email" required></div>
          </div>
          <div class="fld"><label for="not">${esc(L.note)}</label><textarea id="not" name="not" placeholder="${esc(L.notePh)}"></textarea></div>
          <p class="sum" data-sum aria-live="polite"></p>
          <button class="btn btn-accent btn-lg" type="submit">${esc(L.send)}</button>
        </div>
        <div class="done" role="status"><h3 data-thanks></h3><p class="sum" data-done-sum></p><p>${esc(L.replyLine)} (${esc(L.demoNote)} ${esc(L.realLineGeneric)})</p></div>
      </form>
    </div>
  </div>
</section>`;
  const konBook = K ? (bookExt ? directBook : konForm) : '';
  const kisiList = G ? (G.hizmetler || []) : [1, 2, 3, 4, 5, 6, 7, 8]; // guzellik: kisi sayisi yerine sitedeki hizmet adlari
  const bookHtml = K ? konBook : G && bookExt ? directBook : `<section class="sec book on-deep" id="rezervasyon" aria-labelledby="rez-h">
  <div class="book-grid">
    ${m.bookPic ? `<div class="book-pic rv" style="--fx:${pct(m.bookPic.focus.x)};--fy:${pct(m.bookPic.focus.y)}">
      ${pic(m.bookPic, { sizes: '(max-width: 1100px) 100vw, 40vw' })}
      ${m.phone ? `<div><p>${esc(L.callUs)}</p><a href="tel:${esc(m.tel)}">${esc(m.phone)}</a></div>` : ''}
    </div>` : ''}
    <div class="rv">
      <h2 class="h2" id="rez-h">${esc(L.bookH[0])} <em>${esc(L.bookH[1])}</em></h2>
      <p class="book-lead">${esc(L.bookSub)}</p>
      <form id="rez" novalidate>
        <div class="fields">
          ${kisiList.length ? `<fieldset><legend>${esc(L.people)}</legend><div class="chips">${kisiList.map((n, i) => `<input type="radio" name="kisi" id="kisi${i}" value="${esc(n)}" data-l="${esc(n)}"${(G ? i === 0 : n === 2) ? ' checked' : ''}><label for="kisi${i}">${esc(n)}</label>`).join('')}</div></fieldset>` : ''}
          <fieldset><legend>${esc(L.day)}</legend><div class="chips">${days}</div></fieldset>
          <fieldset><legend>${esc(L.time)}</legend><div class="chips" data-slots>${slotsHtml}</div></fieldset>
          <div class="two">
            <div class="fld"><label for="ad">${esc(L.name)}</label><input id="ad" name="ad" type="text" autocomplete="name" required></div>
            <div class="fld"><label for="tel">${esc(L.tel)}</label><input id="tel" name="tel" type="tel" inputmode="tel" autocomplete="tel" required></div>
          </div>
          <div class="fld"><label for="not">${esc(L.note)}</label><textarea id="not" name="not" placeholder="${esc(L.notePh)}"></textarea></div>
          <p class="sum" data-sum aria-live="polite"></p>
          <button class="btn btn-accent btn-lg" type="submit">${esc(L.send)}</button>
        </div>
        <div class="done" role="status"><h3 data-thanks></h3><p class="sum" data-done-sum></p><p>${esc(L.replyLine)} (${esc(L.demoNote)} ${esc(realLine)})</p></div>
      </form>
    </div>
  </div>
</section>`;
  // ziyaret
  const konTable = K && (K.giris.in || K.giris.out) ? `<table class="hours"><caption class="sr">${esc(L.checkIn)}</caption><tbody>${K.giris.in ? `<tr><th scope="row">${esc(L.checkIn)}</th><td>${esc(K.giris.in)}</td></tr>` : ''}${K.giris.out ? `<tr><th scope="row">${esc(L.checkOut)}</th><td>${esc(K.giris.out)}</td></tr>` : ''}</tbody></table>` : '';
  const hoursTable = K ? (konTable || (m.phone ? `<p class="book-lead">${esc(L.callUs)}: <a class="ul" href="tel:${esc(m.tel)}">${esc(m.phone)}</a></p>` : '')) : m.hoursTable && m.hoursOk ? `<table class="hours"><caption class="sr">${esc(L.hoursCap)}</caption><tbody>${m.hoursTable.map((r) => `
        <tr data-day="${r.d}"><th scope="row">${esc(r.label)}</th><td>${esc(r.t === null ? L.unknown : r.t)}</td></tr>`).join('')}
      </tbody></table>${m.hoursNote ? `<p class="hours-note">${esc(m.hoursNote)}</p>` : ''}` : (m.phone ? `<p class="book-lead">${esc(L.callUs)}: <a class="ul" href="tel:${esc(m.tel)}">${esc(m.phone)}</a></p>` : '');
  const visitHtml = `<section class="sec" id="ziyaret" aria-labelledby="vis-h">
  <div class="visit-grid">
    <div class="rv">
      <h2 class="h2" id="vis-h">${esc(L.visitH[0])} <em>${esc(L.visitH[1])}</em></h2>
      ${hoursTable}
      ${m.address || m.phone ? `<p class="addr"><small>${esc(L.address)}</small>${m.address ? esc(m.address) : ''}${m.address && m.phone ? '<br>' : ''}${m.phone ? `<a href="tel:${esc(m.tel)}">${esc(m.phone)}</a>` : ''}</p>` : ''}
      <div class="visit-cta">
        ${m.mapsUrl ? `<a class="btn btn-accent" href="${esc(m.mapsUrl)}" rel="noopener">${esc(L.directions)}</a>` : ''}
        ${m.phone ? `<a class="btn btn-ghost" href="tel:${esc(m.tel)}">${esc(L.call)}</a>` : ''}
      </div>
    </div>
    <div class="map rv" role="img" aria-label="${esc(L.map)}"><svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect class="map-bg" width="800" height="520"/>
        <g fill="none" stroke-linecap="round" class="map-road">
          <path d="M-20 120 C 180 150 340 70 560 130 S 760 190 840 150" stroke-width="22"/>
          <path d="M-20 380 C 160 340 300 430 520 380 S 740 330 840 390" stroke-width="22"/>
          <path d="M140 -20 C 160 160 90 320 150 540" stroke-width="18"/>
          <path d="M470 -20 C 430 140 520 300 470 540" stroke-width="26"/>
          <path d="M660 -20 C 640 160 700 300 650 540" stroke-width="16"/>
          <path d="M-20 250 L840 262" stroke-width="12"/>
        </g>
        <g fill="none" stroke-width="2" stroke-linecap="round" class="map-fine"><path d="M-20 40 L840 70M-20 200 L840 220M-20 460 L840 480M300 -20 L330 540M570 -20 L590 540"/></g>
        <g transform="translate(470 262)"><circle class="map-halo" r="46" opacity=".14"/><circle class="map-halo" r="22" opacity=".24"/><path class="map-pin" d="M0 14 C 0 14 -17 -3 -17 -15 a17 17 0 0 1 34 0 C 17 -3 0 14 0 14Z" transform="translate(0 -10)"/><circle class="map-dot" cy="-25" r="6"/></g>
      </svg>${m.address ? `<div class="map-a"><span>${esc(m.address)}</span>${m.mapsUrl ? `<a href="${esc(m.mapsUrl)}" rel="noopener">${esc(L.openMaps)}</a>` : ''}</div>` : ''}</div>
  </div>
</section>`;
  // alt cubuk (telefon)
  const barItems = [`<a class="main" href="${esc(bookHref)}"${bookAttr}>${ICON.cal}<span>${esc(L.bookShort)}</span></a>`];
  if (hasRooms) barItems.push(`<a href="#odalar">${ICON.menu}<span>${esc(L.rooms)}</span></a>`);
  else if (hasMenu || hasLink) barItems.push(`<a href="#menu">${ICON.menu}<span>${esc(L.menu)}</span></a>`);
  if (m.mapsUrl) barItems.push(`<a href="${esc(m.mapsUrl)}" rel="noopener">${ICON.pin}<span>${esc(L.directionsShort)}</span></a>`);
  if (m.phone) barItems.push(`<a href="tel:${esc(m.tel)}">${ICON.tel}<span>${esc(L.call)}</span></a>`);
  const barCols = `1.35fr ${new Array(barItems.length - 1).fill('1fr').join(' ')}`;
  const social = Object.entries(m.social || {}).map(([k, u]) => `<a href="${esc(u)}" rel="noopener">${esc(k === 'instagram' ? 'Instagram' : 'Facebook')}</a>`).join('');
  const title = `${m.name}${m.cityLabel ? ' · ' + m.cityLabel : ''}: ${m.lang === 'tr' ? 'web sitesi taslağı' : 'website draft'}`;
  const desc = m.lang === 'tr' ? `${m.name} için hazırlanmış web sitesi taslağı (yayında değil).` : `A website draft prepared for ${m.name} (not live).`;
  const pre = (m.fontPreload || []).map((f) => `<link rel="preload" href="../../${ORTAK}/fonts/${f}" as="font" type="font/woff2" crossorigin>`).join('\n');
  const data = { t: { open: L.open('{t}'), shut: L.shut('{w}'), today: L.whenToday('{t}'), tomorrow: L.whenTomorrow('{t}'), dayAt: L.whenDay('{d}', '{t}'), guests: L.guests('{n}'), thanks: L.thanks('{n}').replace(/, \{n\}/, '{n}'), todayLabel: L.today, tomorrowLabel: L.tomorrow, photo: x.photo },
    days: D, h: m.statusOk ? m.week : null, h12: !!m.h12, tz: m.tz, slots: m.slots, fx: m.fx, glow: rgbTriplet(m.palette.t.accent2).split(',').map((n) => +(n / 255).toFixed(3)) };
  const icon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${m.palette.t.accent}"/><text x="16" y="23" font-family="Georgia,serif" font-size="20" font-weight="700" text-anchor="middle" fill="${m.palette.t.accentInk}">${esc((m.name.match(/[\p{L}\p{N}]/u) || ['•'])[0].toUpperCase())}</text></svg>`)}`;
  const heroLogo = lg && lg.hero && m.variant === 'orta' ? `<img class="hero-logo" src="img/${lg.hero.file}" alt="" width="${lg.hero.w}" height="${lg.hero.h}" decoding="async">` : '';
  const introLogo = lg ? (lg.hero && m.variant === 'orta' ? `<img src="img/${lg.hero.file}" alt="" width="${lg.hero.w}" height="${lg.hero.h}">` : `<img src="img/${lg.file}" alt="" width="${lg.w}" height="${lg.h}">`) : `<span class="brand-t">${esc(m.name)}</span>`;
  return `<!doctype html>
<html lang="${m.lang}" class="v-${m.variant} fx-${m.fx} ${m.dark ? 'is-dark' : 'is-light'}${m.sektor ? ' s-' + m.sektor : ''}">
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
<link rel="preload" as="image" href="img/${m.hero[0].name}-1600.webp" imagesrcset="img/${m.hero[0].name}-960.webp 960w, img/${m.hero[0].name}-1600.webp 1600w" imagesizes="${heroSizes}" fetchpriority="high">
<link rel="stylesheet" href="../../${ORTAK}/site.css">
<link rel="stylesheet" href="theme.css">
<script>(function(){var c=document.documentElement.classList,q=location.search;if(/capture=1/.test(q))c.add('no-intro','still');else if(/nointro=1/.test(q)||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))c.add('no-intro');})();</script>
</head>
<body>
<a class="skip" href="#main">${esc(L.skip)}</a>
<div class="intro" aria-hidden="true"><div class="intro-in">${introLogo}<i></i></div></div>

<header class="top" id="top">
  <a class="brand" href="#top" aria-label="${esc(m.name)}">${brandHtml('lg')}</a>
  <nav class="nav" aria-label="${esc(L.nav)}">${nav.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join('')}</nav>
  <div class="top-r">
    ${m.statusOk ? '<span class="status" data-status role="status"><i></i><b></b></span>' : ''}
    <a class="btn btn-accent" href="${esc(bookHref)}"${bookAttr}>${esc(L.book)}</a>
  </div>
</header>

<main id="main">
<section class="hero" aria-labelledby="h1">
  <div class="hero-media" data-gl>
    <ul class="kb" aria-hidden="true">${slides}</ul>
  </div>
  <div class="hero-shade"></div>
  <div class="hero-idx" data-idx hidden></div>
  <div class="hero-in wrap">
    ${heroLogo}
    <p class="eyebrow"><i></i>${esc(m.eyebrow)}</p>
    <h1 id="h1">${h1}</h1>
    ${m.lede ? `<p class="lede">${esc(m.lede)}</p>` : ''}
    <div class="cta">
      <a class="btn btn-accent btn-lg" href="${esc(bookHref)}"${bookAttr}>${esc(L.book)}</a>
      ${secondary}
    </div>
    ${facts.length ? `<ul class="facts">${facts.join('\n      ')}</ul>` : ''}
  </div>
</section>

${K ? `${roomsHtml}

${storyHtml}

${signHtml}

${galleryHtml}

${amenHtml}` : `${signHtml}

${storyHtml}

${menuHtml}

${galleryHtml}`}

${bookHtml}

${visitHtml}
</main>

<footer class="foot">
  <div><a class="brand" href="#top" aria-label="${esc(m.name)}">${brandHtml('lg')}</a>
    <p>${esc(L.draft(m.name))}</p>
    ${social ? `<div class="sm">${social}</div>` : ''}
  </div>
  <p>${esc(L.draftBy)}${m.site ? ` · <a href="${esc(m.site)}" rel="noopener nofollow">${esc(L.currentSite)}</a>` : ''}</p>
</footer>

<nav class="bar" aria-label="${esc(L.quick)}" style="grid-template-columns:${barCols}">
  ${barItems.join('\n  ')}
</nav>

<script type="application/json" id="r-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script src="../../${ORTAK}/page.js" defer></script>
</body>
</html>
`;
}
