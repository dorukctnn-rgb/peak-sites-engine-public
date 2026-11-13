// node --test uyarla/test/netlik.test.mjs   (ag yok, ozel varlik yok; yalniz sharp)
// NETLIK KAPISI (lib/netlik.mjs): kahraman, sahne ve buyuk yuvalarda yumusak ya da buyutulmus fotograf yok ("flu goruntu olmasin hic").
import test from 'node:test'; import assert from 'node:assert/strict';
import { sharp } from '../lib/gorsel.mjs';
import { netlikOlc, netlikGecer, cozunurlukYeter, fotoDenetle, ESIK, TABAN } from '../lib/netlik.mjs';

// deterministik sahte "yemek karesi": sert kenarli renkli bloklar + ince doku (keskin) ya da ayni kare bulaniklastirilmis (yumusak)
function ham(w, h, tohum = 7) {
  let s = tohum; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const a = Buffer.alloc(w * h * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = 90; a[i + 1] = 70; a[i + 2] = 55; }
  for (let n = 0; n < Math.round((w * h) / 9000); n++) {
    const bw = 12 + Math.floor(r() * 90); const bh = 12 + Math.floor(r() * 90); const x0 = Math.floor(r() * (w - bw)); const y0 = Math.floor(r() * (h - bh));
    const c = [Math.floor(r() * 255), Math.floor(r() * 255), Math.floor(r() * 255)];
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) { const i = (y * w + x) * 3; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; }
  }
  return a;
}
const keskin = (w = 1920, h = 1080) => sharp(ham(w, h), { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
const yumusak = async (w = 1920, h = 1080, sigma = 9) => sharp(ham(w, h), { raw: { width: w, height: h, channels: 3 } }).blur(sigma).jpeg({ quality: 92 }).toBuffer();

test('netlik: keskin kare her seviyede gecer', async () => {
  const m = await netlikOlc(await keskin());
  assert.ok(m.p75 > ESIK.siki.p75 && m.p90 > ESIK.siki.p90, JSON.stringify(m));
  assert.equal(netlikGecer(m, 'siki').ok, true); assert.equal(netlikGecer(m, 'buyuk').ok, true);
});

test('netlik: bulanik (odak disi) kare elenir, mesaj sayilari gosterir', async () => {
  const m = await netlikOlc(await yumusak());
  for (const sev of ['siki', 'buyuk']) { const g = netlikGecer(m, sev); assert.equal(g.ok, false, `${sev}: ${JSON.stringify(m)}`); assert.match(g.neden, /yumuşak görüntü \(netlik p75 \d+, p90 \d+/); }
});

test('netlik: kucuk kaynagin buyutulmus hali (1920 px ama aslinda 480 px) netlikte elenir', async () => {
  const kucuk = await sharp(ham(480, 270), { raw: { width: 480, height: 270, channels: 3 } }).resize({ width: 1920, kernel: 'lanczos3' }).jpeg({ quality: 92 }).toBuffer();
  const d = await fotoDenetle(kucuk, 'sahne');
  assert.equal(d.ok, false); assert.ok(d.neden.some((x) => /yumuşak görüntü/.test(x)), d.neden.join('; '));
});

test('netlik: dokusuz (duz renk) kare olculemez ve gecmez', async () => {
  const duz = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: { r: 120, g: 110, b: 100 } } }).jpeg().toBuffer();
  const g = netlikGecer(await netlikOlc(duz), 'buyuk'); assert.equal(g.ok, false); assert.match(g.neden, /dokusuz/);
});

test('netlik: okunamayan dosya gecmez', async () => {
  const g = netlikGecer(await netlikOlc(Buffer.from('bu bir fotograf degil')), 'siki'); assert.equal(g.ok, false); assert.match(g.neden, /okunamadı/);
});

test('cozunurluk: sahne ve kahraman en az 1920 px genis; panelde kaynak kisaysa dogal boyutunda (contain), buyutme yok', () => {
  assert.equal(TABAN.sahne.w, 1920); assert.equal(TABAN.hero.w, 1920);
  assert.equal(cozunurlukYeter({ w: 1919, h: 1080 }, 'sahne').ok, false);
  assert.equal(cozunurlukYeter({ w: 1920, h: 1080 }, 'sahne').ok, true);
  assert.equal(cozunurlukYeter({ w: 1280, h: 720 }, 'hero').ok, false);
  const p = cozunurlukYeter({ w: 1000, h: 667 }, 'panel'); assert.equal(p.ok, false); assert.equal(p.contain, true);
  assert.equal(cozunurlukYeter({ w: 1500, h: 1500 }, 'panel').ok, true);
  assert.equal(cozunurlukYeter({ w: 1100, h: 700 }, 'galeri').ok, false);
});

test('fotoDenetle: sahne = keskin ve 1920+; keskin ama 1600 px ise cozunurlukten elenir; panelde dusuk yukseklik contain ile gecer', async () => {
  const iyi = await fotoDenetle(await keskin(2400, 1350), 'sahne'); assert.equal(iyi.ok, true, iyi.neden.join('; ')); assert.equal(iyi.olcu.w, 2400);
  const dar = await fotoDenetle(await keskin(1600, 900), 'sahne'); assert.equal(dar.ok, false); assert.ok(dar.neden.some((x) => /1600 px genişlik/.test(x)), dar.neden.join('; '));
  const panel = await fotoDenetle(await keskin(1400, 700), 'panel'); assert.equal(panel.ok, true, panel.neden.join('; ')); assert.equal(panel.contain, true);
  const yum = await fotoDenetle(await yumusak(1400, 1100), 'panel'); assert.equal(yum.ok, false);
});

// esiklerin gercek isletme fotograflariyla ayari (12 Kas; yalniz olculen sayilar): kendi cekimi keskin kareler gecer, odak disi biftek ve yumusak hamburger kalir
test('netlik: gercek olcumlere gore esikler (keskin kareler gecer, yumusak biftek/hamburger kalir)', () => {
  const m = (p75, p90) => ({ p75, p90, bloklar: 300 });
  for (const [p75, p90] of [[129, 350], [76, 183], [53, 202], [243, 500], [381, 734], [643, 1044]]) assert.equal(netlikGecer(m(p75, p90), 'buyuk').ok, true, `buyuk ${p75}/${p90}`);
  for (const [p75, p90] of [[129, 350], [381, 734], [643, 1044]]) assert.equal(netlikGecer(m(p75, p90), 'siki').ok, true, `siki ${p75}/${p90}`);
  for (const [p75, p90] of [[23, 98], [13, 101], [13, 93], [20, 45], [18, 41]]) { assert.equal(netlikGecer(m(p75, p90), 'buyuk').ok, false, `buyuk ${p75}/${p90}`); assert.equal(netlikGecer(m(p75, p90), 'siki').ok, false, `siki ${p75}/${p90}`); }
});
