import { markaPaleti } from '../lib/marka.mjs';
// node --test uyarla/test/uyarla.test.mjs   (ag gerekmez: font adlari cevrimdisi cozulur)
import test from 'node:test'; import assert from 'node:assert/strict';
import { adCoz, sinifFavorisi, adSinifi, fontEslestir, KATALOG } from '../lib/font.mjs';
import { renkPaleti, kontrastKontrol, paletteOk, contrast } from '../lib/renk.mjs';
import { telHref, fmtPrice, saatTablo, saatOzet, tzOf, T } from '../lib/metin.mjs';
import { sayfaHtml, themeCss } from '../lib/sayfa.mjs';

test('font: ayni font Google Fonts/katalogda varsa aynisi', async () => {
  const a = await adCoz('overpass-variable', { offline: true }); assert.equal(a.id, 'overpass'); assert.equal(a.via, 'ayni');
  const b = await adCoz('"Playfair Display"', { offline: true }); assert.equal(b.id, 'playfair-display'); assert.equal(b.via, 'ayni');
});
test('font: ticari font tablodaki ucretsiz ese gider, dosya kopyalanmaz', async () => {
  for (const [n, id] of [['Proxima Nova', 'figtree'], ['Gotham', 'montserrat'], ['Helvetica Neue', 'inter'], ['Futura PT', 'jost'], ['Garamond', 'eb-garamond'], ['ambroise-std', 'playfair-display']]) {
    const r = await adCoz(n, { offline: true }); assert.equal(r.id, id, n); assert.equal(r.via, 'esdeger');
  }
  assert.equal(await adCoz('Bilinmeyen Ozel Font', { offline: true }), null);
  assert.equal(await adCoz('sans-serif', { offline: true }), null);
  assert.equal(await adCoz('FontAwesome', { offline: true }), null);
});
test('font: katalog yalniz acik lisans', () => { for (const [id, f] of Object.entries(KATALOG)) assert.match(f.license, /^(OFL|Apache|Ubuntu|MIT)/i, id); });
test('font: bilinmeyen ad siniflanir; Turkce sayfada latin-ext sart', () => {
  assert.equal(adSinifi('Brush Script MT'), 'script'); assert.equal(adSinifi('Rockwell Std'), 'slab'); assert.equal(adSinifi('Trade Gothic Condensed'), 'cond');
  for (const cls of ['serif-old', 'geo', 'slab', 'cond', 'script']) { const id = sinifFavorisi(cls, { rol: 'd', tr: true, slug: 'x' }); assert.ok(KATALOG[id].turkce, `${cls} -> ${id}`); }
});
test('font: eslestir tam akis (stack -> display/text)', async () => {
  const R = { fonts: { stacks: { h1: ['calluna-x'], p: ['Helvetica Neue', 'Arial', 'sans-serif'], body: [] }, heading: { transform: 'uppercase', weight: '700', style: 'normal', spacing: '1px' }, googleFamilies: [] } };
  const f = await fontEslestir(R, { slug: 'deneme', tr: true, offline: true });
  assert.equal(f.text.id, 'inter'); assert.ok(f.display.id && KATALOG[f.display.id].turkce); assert.equal(f.display.upper, true);
});
test('renk: acik ve koyu markada tum ciftler kontrast gecer', () => {
  const light = { colours: { hints: {}, computed: { body: { bg: '#efebe1', color: '#333d2c' }, btn: { ownBg: '#c07b36', radius: 4 } }, used: { bg: [{ hex: '#efebe1', w: 4e6 }, { hex: '#c07b36', w: 5e4 }], text: [{ hex: '#333d2c', w: 3e4 }], buttons: [{ hex: '#c07b36', w: 5 }] } }, logo: { palette: [{ hex: '#143318', share: 1 }] } };
  const dark = { colours: { hints: {}, computed: { body: { bg: '#16181b', color: '#f0f0f0' }, btn: { ownBg: '#e13b4d' } }, used: { bg: [{ hex: '#262728', w: 8e5 }, { hex: '#16181b', w: 7e5 }], text: [{ hex: '#f0f0f0', w: 2e4 }], buttons: [{ hex: '#e13b4d', w: 6 }] } } };
  for (const R of [light, dark]) { const p = renkPaleti(R); assert.ok(paletteOk(p.checks), JSON.stringify(p.checks.filter((c) => !c.pass))); }
  assert.equal(renkPaleti(light).mode, 'light'); assert.equal(renkPaleti(dark).mode, 'dark');
  assert.equal(renkPaleti(light).t.accent, '#c07b36'); // marka rengi aynen kalir
});
test('renk: marka rengi bulunamazsa uyari ve varsayilan', () => {
  const p = renkPaleti({ colours: { hints: {}, computed: { body: { bg: '#ffffff', color: '#000000' } }, used: { bg: [{ hex: '#ffffff', w: 1e6 }], text: [{ hex: '#000000', w: 1e4 }], buttons: [] } } });
  assert.equal(p.fallback, true); assert.match(p.warn[0], /marka rengi/);
});
test('renk: kontrast hesabi', () => { assert.ok(contrast('#000000', '#ffffff') > 20.9); assert.ok(contrast('#777777', '#ffffff') < 4.6); });
test('metin: telefon, fiyat, saat dilimi', () => {
  assert.equal(telHref('(07)12345678', 'AU'), '+61712345678'); assert.equal(telHref('0212 555 12 34', 'TR'), '+902125551234'); assert.equal(telHref('(212) 555-0100', 'US'), '+12125550100'); assert.equal(telHref('+44 20 7946 0958', 'GB'), '+442079460958');
  assert.equal(fmtPrice('10', 'AU'), '$10'); assert.equal(fmtPrice('480', 'TR'), '480 ₺'); assert.equal(fmtPrice('€12.50', 'IE'), '€12.50'); assert.equal(fmtPrice('480 TL', 'TR'), '480 ₺');
  assert.equal(tzOf('Brisbane', 'AU'), 'Australia/Brisbane'); assert.equal(tzOf('İstanbul', 'TR'), 'Europe/Istanbul'); assert.equal(tzOf('Calgary', 'CA'), 'America/Edmonton'); assert.equal(tzOf('Bilinmeyen', 'US'), null);
});
test('metin: saat ozeti ardisik gunleri birlestirir', () => {
  const week = [[420, 1440], [540, 1440], [540, 1440], [540, 1440], [540, 1440], [420, 1440], [420, 1440]];
  const hours = { week, byDay: week.map((w) => `${String(Math.floor(w[0] / 60)).padStart(2, '0')}:${String(w[0] % 60).padStart(2, '0')}–00:00`) };
  const o = saatOzet(saatTablo(hours, 'tr'), 'tr');
  assert.equal(o.length, 2); assert.equal(o[0].days, 'Pzt–Per'); assert.equal(o[0].t, '09:00–00:00'); assert.equal(o[1].days, 'Cum–Paz');
});
test('sayfa: HTML uretimi, noindex, yasak kisaltma gecmez, bos alan kalmaz', () => {
  const R = { colours: { hints: {}, computed: { body: { bg: '#fff', color: '#111' }, btn: { ownBg: '#aa3322' } }, used: { bg: [{ hex: '#ffffff', w: 1 }], text: [], buttons: [{ hex: '#aa3322', w: 1 }] } } };
  const pal = markaPaleti(R, renkPaleti(R));
  const ph = (n) => ({ name: `p0${n}`, w: 1600, h: 900, focus: { x: 0.5, y: 0.4 }, alt: '' });
  const fe = { display: { id: 'jost', family: 'Jost', cls: 'geo', weight: 600, italic: false, via: 'ayni', styles: ['normal'] }, text: { id: 'inter', family: 'Inter', cls: 'neo', weight: 400, via: 'esdeger' } };
  const m = { variant: 'tam', fx: 'firca', dark: false, slogan: { text: 'Mahallenin sofrası', parts: [{ t: 'Mahallenin', em: false }, { t: 'sofrası', em: true }] }, signature: [], story: null, hoursSummary: [], slug: 'x', lang: 'tr', name: 'Deneme Lokanta', cityLabel: 'İstanbul', site: 'https://example.com', palette: pal, font: fe, fontFaceCss: '', fontPreload: [], caps: false, ls: -0.01, emStyle: 'normal', size: { h1: 'clamp(44px, 10vw, 214px)', h2: 'clamp(34px,5vw,88px)', h3: '24px', lh: 0.94, h1max: '12em' }, btnR: '999px', cardR: '8px', shadeA: 0.94, shadeM: 0.72, kb: { step: 7, total: 21, ov: 1.4 }, map: { bg: pal.t.bg2, road: '#ddd', fine: '#eee' }, fallback: { display: 'sans-serif', text: 'sans-serif' }, logo: null, hero: [1, 2, 3].map(ph), gallery: [1, 2, 3].map(ph), menuVis: [], bookPic: ph(1), eyebrow: 'Restoran · İstanbul', lede: 'Kısa bir cümle.', about: '', stats: [], hoursOk: false, hoursTable: null, hoursSummary: [], week: null, tz: null, statusOk: false, slots: null, firstSlots: ['18:00', '19:00', '20:00'], address: 'Örnek Sokak 1', phone: '0212 555 12 34', tel: '+902125551234', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=x', social: {}, reservationHost: null, video: null, menu: { groups: [{ name: 'Ana', items: [{ n: 'Köfte', d: 'Izgara', p: '480 ₺' }, { n: 'Pilav', d: '', p: '90 ₺' }] }], link: null } };
  const html = sayfaHtml(m); const css = themeCss(m);
  assert.match(html, /name="robots" content="noindex, nofollow/); assert.match(html, /Deneme Lokanta/); assert.match(html, /Köfte/); assert.match(css, /--accent:#/);
  assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, '') + css, /undefined|NaN|\bnull\b/); // satir ici yapilandirma JSON'unda null olabilir; gorunen metinde olmaz
  assert.ok(!yasakVar('kisaltmaGenis', html));
  assert.match(css, /@keyframes kb-fade/);
  assert.match(html, /<h1 id="h1">[\s\S]*Mahallenin[\s\S]*<em>[\s\S]*sofrası/); assert.doesNotMatch(html.match(/<h1[\s\S]*?<\/h1>/)[0], /Deneme Lokanta/); // baslik slogandir, ad degil
  assert.match(html, /class="v-tam fx-firca/); assert.match(html, /data-gl/);
  assert.ok(T.tr.thanks('Ayşe').includes('Ayşe'));
});
import { ledeOf } from '../uret.mjs';
import { yasakVar } from '../lib/sozluk.mjs';
test('lede: cop meta aciklamalari (hidden article, WordPress, CTA) elenir, gercek cumle kalir', () => {
  assert.equal(ledeOf('This is a hidden article.').lede, '');
  assert.equal(ledeOf('Just another WordPress site').lede, '');
  assert.equal(ledeOf('Click here to view our menu and book now.').lede, '');
  assert.equal(ledeOf('Hi').lede, '');
  const r = ledeOf('Riverbar offers spectacular views, delectable food and an extensive array of drinks. Book now online.');
  assert.match(r.lede, /^Riverbar offers spectacular views/); assert.doesNotMatch(r.lede + r.about, /Book now/);
});
