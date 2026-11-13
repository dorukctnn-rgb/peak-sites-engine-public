// ANA SAYFA FOTOGRAFI SECICI (v5).  Doruk: "ana sayfada en iyi fotosunu koyman gerekiyor rastgele secip degil, orasi cok onemli."
// Kural (NOTLAR.md):
//   1. Her adayin EN BUYUK surumu bulunur: srcset'in en buyugu zaten cikaricida; burada WordPress -1024x683 eki, -scaled eki, Squarespace ?format=,
//      Wix /v1/fill/, Shopify _2048x, Drupal /styles/.../public/ gibi boyut ekleri sokulur ve orijinal denenir (robots.txt'e uyan Polite ile, saniyede en cok 1 istek).
//   2. Gercek piksel olculur (sharp metadata).  Tam ekran kahraman icin en az 1920 px genislik, tercihen 2400+; ASLA buyutme yok:
//      1920 altinda kalirsa duzen "cerceve" (gorsel kendi boyutunda, bolunmus ekran) secilir.
//   3. Puan: cozunurluk + keskinlik (Laplace varyansi) + pozlama + konu.  Yazi/logo/filigran/afis, ekran goruntusu, kolaj (iki karenin yan yana yapistirildigi banner),
//      cok koyu/cok acik, dik (portre) kareler elenir ya da dusuk puan alir.
//   4. Ilk 5 aday ve nedenleri hero-secim.json'a yazilir; secilen kare GOZLE kontrol edilir (ajan Read ile acar).
// Model yok; kural tabanli.  Ag yalniz buyuk surumu indirmek icin; fetch disaridan verilir ki testler agsiz calissin.
import fs from 'node:fs';
import path from 'node:path';
import { sharp, analiz, sniff } from './gorsel.mjs';
import { enBuyukSurumler } from './foto-topla.mjs';

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const HERO_MIN = 1920; export const HERO_IYI = 2400;

// ---- 1. buyuk surum adaylari (buyukten kucuge; ilki orijinal olmaya en yakin) ----
// 12 Kas: once foto-topla.mjs enBuyukSurumler (Wix, Squarespace, WordPress, Shopify, Webflow, GoDaddy, Drupal, Cloudflare; hero icin Squarespace format=original once), sonra eski ek kurallar
export function buyukSurumler(url) {
  const yeni = enBuyukSurumler(url, { orijinal: true }); const eski = eskiBuyukSurumler(url);
  // eski kuralin "@2x" tahmini her jpg icin bir bos istek harcar; bir CDN kurali zaten uygulandiysa (yeni.length > 1) tahmin edilmez
  return [...yeni.filter((u) => u !== url), ...eski.filter((u) => u !== url && !yeni.includes(u) && !(yeni.length > 1 && /@2x\.\w+$/.test(u))), url];
}
function eskiBuyukSurumler(url) {
  const out = []; const push = (u) => { if (u && !out.includes(u)) out.push(u); };
  let x; try { x = new URL(url); } catch { return [url]; }
  const p = x.pathname; const base = `${x.origin}`;
  // Wix: /media/<id>~mv2.jpg/v1/fill/w_1440,h_900,.../file.jpg -> /media/<id>~mv2.jpg (orijinal)
  if (/wixstatic\.com$/i.test(x.host) && /\/v1\//.test(p)) push(base + p.split('/v1/')[0]);
  // Squarespace: ?format=2500w (en buyuk sunulan); ?format=original da denenir
  if (/squarespace(-cdn)?\.com$/i.test(x.host) || /\/content\/v1\//.test(p) || /\/static\/[0-9a-f]{24}\//.test(p)) { push(`${base}${p}?format=original`); push(`${base}${p}?format=2500w`); }
  // Shopify: file_2048x.jpg / file_1024x1024.jpg / file_600x_crop_center.jpg -> file.jpg ; ayrica ?width=4096
  if (/shopify/i.test(x.host) || /\/cdn\/shop\//.test(p)) { push(base + p.replace(/_(\d{2,4}x\d{0,4}|\d{0,4}x\d{2,4})(_crop_\w+)?(\.(?:jpe?g|png|webp))$/i, '$3')); push(`${base}${p.replace(/_(\d{2,4}x\d{0,4}|\d{0,4}x\d{2,4})(_crop_\w+)?(\.(?:jpe?g|png|webp))$/i, '$3')}?width=4096`); }
  // Drupal: /sites/x/files/styles/<stil>/public/<yol> -> /sites/x/files/<yol>
  if (/\/files\/styles\/[^/]+\/public\//.test(p)) push(base + p.replace(/\/files\/styles\/[^/]+\/public\//, '/files/'));
  // WordPress: -1024x683 eki ve -scaled eki (orijinal, -scaled'den buyuk olabilir); once eksiz, sonra yalniz boyut eksiz
  const noSize = p.replace(/-\d{2,4}x\d{2,4}(\.(?:jpe?g|png|webp|avif))$/i, '$1');
  if (noSize !== p) push(base + noSize);
  const noScaled = noSize.replace(/-scaled(\.(?:jpe?g|png|webp))$/i, '$1');
  if (noScaled !== noSize) { push(base + noScaled); }
  // Cloudinary / imgix / generic genislik parametreleri sokulur
  if (/\/upload\/[^/]*w_\d+/.test(p)) push(base + p.replace(/\/upload\/[^/]+\//, '/upload/'));
  if (/[?&](w|width|h|height|q|fit|auto|format)=/.test(x.search) && !/squarespace|format=/.test(x.href)) push(base + p);
  if (!noSize.endsWith('@2x' + path.extname(noSize))) { const at2 = noSize.replace(/(\.(?:jpe?g|png|webp))$/i, '@2x$1'); if (/-\d{2,4}x\d{2,4}\./.test(p) === false && /\.(jpe?g|png)$/i.test(p)) push(base + at2); }
  push(url); // son care: oldugu gibi
  return out;
}

// ---- 2b. merkez keskinligi: sig alan derinlikli (bokeh) yemek fotografinda konu keskin, arka plan bilerek yumusak.  Butun karenin Laplace varyansi
// boyle bir kareyi "yumusak" sayar (10 Kas gozle duzeltme: Pausa Pranzo 07, sefin elinde makarna 5472 px, 310'a dusmustu).  Orta %50x%50 bolgenin varyansi ayrica
// olculur; puan icin ikisinin buyugu kullanilir. ----
export async function merkezKeskinlik(buf) {
  try {
    const meta = await sharp(buf, { limitInputPixels: 120e6 }).rotate().metadata(); const W = meta.width; const H = meta.height; if (!W || !H) return 0;
    const o = await sharp(buf, { limitInputPixels: 120e6 }).rotate().extract({ left: Math.floor(W * 0.25), top: Math.floor(H * 0.25), width: Math.floor(W * 0.5), height: Math.floor(H * 0.5) }).resize({ width: Math.min(300, Math.floor(W * 0.5)) }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const gw = o.info.width; const gh = o.info.height; const g = o.data; let lm = 0; let l2 = 0; let cnt = 0;
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const i = y * gw + x; const v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - gw] - g[i + gw]; lm += v; l2 += v * v; cnt++; }
    lm /= Math.max(1, cnt); return +(l2 / Math.max(1, cnt) - lm * lm).toFixed(1);
  } catch { return 0; }
}

// ---- 3. kolaj / yan yana banner: orta bantta tek bir keskin dikey dikis ----
export async function kolajMu(buf) {
  try {
    const o = await sharp(buf, { limitInputPixels: 80e6 }).rotate().resize({ width: 400 }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const W = o.info.width; const H = o.info.height; const d = o.data; const col = [];
    for (let x = 0; x < W - 1; x++) { let s = 0; for (let y = 0; y < H; y++) s += Math.abs(d[y * W + x] - d[y * W + x + 1]); col.push(s / H); }
    const mid = col.slice(Math.floor(W * 0.3), Math.ceil(W * 0.7)); const sorted = mid.slice().sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)] || 1; const max = Math.max(...mid);
    // dikis: tek sutunda ortalamanin 7 kati ve mutlak olarak buyuk fark; komsulari normal (gercek bir kenar degil)
    const i = mid.indexOf(max); const nb = Math.max(mid[i - 2] || 0, mid[i + 2] || 0);
    const seam = max > 24 && max > med * 7 && nb < max * 0.35;
    // dikisin iki yaninda ortalama parlaklik belirgin farkli mi (iki ayri foto)
    let L = 0; let R = 0; const X = Math.floor(W * 0.3) + i;
    for (let y = 0; y < H; y += 2) { for (let x = 4; x < Math.min(60, X); x += 2) L += d[y * W + X - x]; for (let x = 4; x < Math.min(60, W - X - 1); x += 2) R += d[y * W + X + x]; }
    return { kolaj: seam, seamX: +((X) / W).toFixed(2), max: +max.toFixed(1), med: +med.toFixed(1), lrFark: Math.abs(L - R) > 0 ? 1 : 0 };
  } catch { return { kolaj: false }; }
}

// yazi/afis sezgisi: ad/sinif/alt ipuclari + dusuk renk cesidi + duz bloklar
const TEXTY = /(logo|banner|poster|flyer|menu|screen ?shot|screenshot|untitled[-_ ]?design|canva|collage|artboard|promo|voucher|gift ?card|coming[-_ ]soon|open[-_ ]mic|karaoke|quiz|trivia|live[-_ ]music|event|offer|deal|special|xmas|christmas|valentine|mother|father|news|card)/i;

// ---- puan ----
export function puanla(c) {
  const neden = []; let puan = 0;
  const w = c.w || 0; const h = c.h || 0; const ar = w && h ? w / h : 1;
  // cozunurluk: 4000+ (4K/retina icin de yeter) > 2400+ > 1920+ > kucuk
  if (w >= 4000) { puan += 33; neden.push(`${w} px genis (4000+, 4K ekrana da yeter)`); } else if (w >= HERO_IYI) { puan += 30; neden.push(`${w} px genis (2400+)`); } else if (w >= HERO_MIN) { puan += 22; neden.push(`${w} px genis (1920+)`); } else if (w >= 1600) { puan += 8; neden.push(`${w} px: tam ekrana az`); } else { puan -= 6; neden.push(`${w} px: tam ekran icin kucuk`); }
  const lap = Math.max(c.lapVar || 0, c.lapMerkez || 0); const ks = Math.min(24, lap / 70); puan += ks; neden.push(lap >= 900 ? (c.lapMerkez > (c.lapVar || 0) * 1.5 ? 'konu keskin (sig alan derinligi, arka plan bilerek yumusak)' : 'keskin') : lap >= 300 ? 'orta keskinlik' : 'yumusak/bulanik');
  const L = c.meanL ?? 0.3;
  if (L >= 0.10 && L <= 0.62) { puan += 14; neden.push('pozlama dengeli'); } else if (L >= 0.04 && L <= 0.75) { puan += 6; neden.push(L < 0.10 ? 'koyu (bilerek karanlik cekim olabilir)' : 'acik'); } else { puan -= 10; neden.push(L < 0.04 ? 'cok koyu' : 'cok acik'); }
  if (ar >= 1.4 && ar <= 2.1) { puan += 12; neden.push('yatay, ekrana uygun oran'); } else if (ar >= 1.2 && ar <= 2.6) { puan += 6; neden.push('oran kabul edilir'); } else if (ar < 1) { puan -= 18; neden.push('dik kare (portre): tam ekran olmaz'); } else { puan -= 6; neden.push('oran uc'); }
  if (c.siteHero) { puan += 8; neden.push('kendi sitesinde ilk ekranda'); }
  if (c.textish) { puan -= 40; neden.push('yazi/afis izlenimi (duz renk, keskin kenar)'); }
  // duz alanlar: ACIK ve detaysiz ise afis/ekran goruntusu; koyu zeminli keskin bir yemek fotografinin siyah fonu afis degildir (10 Kas gozle duzeltme: Steakhouse 66)
  if (c.flat > 0.35 && (L > 0.18 || lap < 400)) { puan -= 22; neden.push('genis duz alanlar (afis/menu/ekran goruntusu)'); } else if (c.flat > 0.35) { puan -= 4; neden.push('koyu duz zemin (studyo cekimi)'); }
  if (c.kolaj) { puan -= 35; neden.push('kolaj: iki kare yan yana yapistirilmis'); }
  // ad ipucu: logo/afis/menu/ekran goruntusu agir ceza; tasarim araci disa aktarimi (untitled design, canva, artboard) hafif ceza (fotograf olabilir, kolaj olabilir)
  if (c.nameHint) { const hafif = /untitled|canva|artboard|banner/.test(c.nameHint); puan -= hafif ? 10 : 25; neden.push(`dosya adi/alt yazi: ${c.nameHint}${hafif ? ' (tasarim araci disa aktarimi)' : ''}`); }
  if (c.png && (c.palette || []).length <= 3) { puan -= 10; neden.push('PNG, az renk (grafik olabilir)'); }
  if (c.whiteFrac > 0.45) { puan -= 12; neden.push('beyaz zemin agirlikli'); }
  return { puan: +puan.toFixed(1), neden };
}

// ---- ana akis ----
// R: cikarici.json; dir: isletme veri klasoru (img/mNN.webp); getir: async (url) => {buf,type}|null (Polite ile sarilir); imgDir: kahraman dosyalarinin yazilacagi klasor
export async function heroSec(R, { dir, imgDir, getir = null, log = () => {}, maxFetch = 8, haric = [], adayDir = null } = {}) {
  const photos = (R.photos || []).filter((p) => !haric.includes(String(p.id)));
  const cands = []; let fetched = 0;
  for (const p of photos) {
    const c = { id: p.id, url: p.url, w: p.w, h: p.h, lapVar: p.lapVar, meanL: p.meanL, meanS: p.meanS, flat: 0, whiteFrac: 0, palette: p.palette || [], focus: p.focus || { x: 0.5, y: 0.5 }, siteHero: !!(p.heroOk && ((p.top ?? 9999) < 900 || /hero|banner|slide|swiper|cover|header/i.test(p.cls || ''))), textish: p.meanS < 0.26 && p.lapVar > 1800, png: /\.png(\?|$)/i.test(p.url), kaynak: 'cikarici', alt: p.alt || '', buf: null, file: p.file };
    // ipucu yalniz dosya adi + alt yazi (CSS sinifi degil: "banner-background-image" gibi duzen siniflari icerik degildir)
    let hint = ''; try { hint = `${decodeURIComponent(path.basename(new URL(p.url, 'https://x').pathname))} ${p.alt || ''}`; } catch { hint = `${p.url} ${p.alt || ''}`; }
    const m = TEXTY.exec(hint); if (m) c.nameHint = m[0].toLowerCase();
    // en buyuk surum: once yerel karenin kendisi (cikarici en cok 1800 px sakladi), sonra ag
    const local = path.join(dir, p.file);
    if (fs.existsSync(local)) c.buf = fs.readFileSync(local);
    const ar = p.w / p.h;
    const worth = ar >= 1.1 && !(c.textish) && !(c.nameHint && !/menu|event|special/i.test(c.nameHint) && p.w < HERO_MIN); // dik ve afis kareler icin ag harcanmaz
    if (getir && worth && fetched < maxFetch) {
      for (const u of buyukSurumler(p.url)) {
        if (fetched >= maxFetch) break;
        fetched++;
        let r = null; try { r = await getir(u); } catch { r = null; }
        if (!r || !r.buf || !sniff(r.buf) || sniff(r.buf) === 'image/svg+xml') continue;
        let meta; try { meta = await sharp(r.buf, { limitInputPixels: 120e6 }).rotate().metadata(); } catch { continue; }
        const W = meta.width; const H = meta.height; if (!W || !H) continue;
        if (W >= p.w && W >= (c.w || 0)) { c.buf = r.buf; c.w = W; c.h = H; c.kaynak = u === p.url ? 'orijinal url' : `buyuk surum (${u.length > 90 ? '…' + u.slice(-60) : u})`; c.url = u; log(`   hero aday ${p.id}: ${W}x${H} <- ${u.slice(0, 100)}`); }
        if (W >= HERO_IYI || u === p.url) break; // yeterince buyuk ya da son care denendi
      }
    }
    if (c.buf) {
      try { const a = await analiz(c.buf); if (!a.error) { c.lapVar = a.lapVar; c.meanL = a.meanL; c.meanS = a.meanS; c.flat = a.flat; c.whiteFrac = a.whiteFrac; c.palette = a.palette; c.focus = a.focus; c.textish = a.meanS < 0.26 && a.lapVar > 1800 && a.flat > 0.2; if (!c.w) { c.w = a.w; c.h = a.h; } } } catch { /* olculemedi */ }
      c.lapMerkez = await merkezKeskinlik(c.buf);
      Object.assign(c, await kolajMu(c.buf));
    }
    const s = puanla(c); c.puan = s.puan; c.neden = s.neden;
    cands.push(c);
  }
  cands.sort((a, b) => b.puan - a.puan);
  const secilen = cands[0] || null;
  const duzen = secilen && secilen.w >= HERO_MIN && !secilen.kolaj && !secilen.textish ? 'tam' : 'cerceve';
  // dosyalar: buyutme YOK (withoutEnlargement); 2400 / 1600 / 960
  const out = { secilen: null, adaylar: cands.slice(0, 5).map((c) => ({ id: c.id, puan: c.puan, w: c.w, h: c.h, kaynak: c.kaynak, url: c.url, lapVar: Math.round(c.lapVar || 0), lapMerkez: Math.round(c.lapMerkez || 0), meanL: +(c.meanL || 0).toFixed(3), kolaj: !!c.kolaj, textish: !!c.textish, neden: c.neden })), duzen, kural: `tam ekran icin en az ${HERO_MIN} px (tercih ${HERO_IYI}+); buyutme yok; yazi/afis/kolaj elenir; ilk 5 aday puanla`, at: new Date().toISOString() };
  // hat (11 Kas): ilk 5 adayin goz kontrolu icin onizlemeleri (en cok 1600 px, buyutme yok); secimi puanlayici DEGIL inceleme turu yapar
  if (adayDir) {
    fs.mkdirSync(adayDir, { recursive: true });
    for (const [i, c] of cands.slice(0, 5).entries()) {
      if (!c.buf) continue;
      try { await sharp(c.buf, { limitInputPixels: 150e6 }).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(adayDir, `${c.id}.jpg`)); out.adaylar[i].onizleme = `${c.id}.jpg`; } catch { /* yazilamadi */ }
    }
  }
  if (secilen && secilen.buf && imgDir) {
    fs.mkdirSync(imgDir, { recursive: true });
    const files = {};
    for (const [k, w, q] of [['2400', 2400, 76], ['1600', 1600, 76], ['960', 960, 72]]) {
      if (k !== '960' && secilen.w < w * 0.9 && k !== '1600') continue; // 2400 dosyasi yalniz gercekten buyukse
      const o = await sharp(secilen.buf, { limitInputPixels: 120e6 }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer({ resolveWithObject: true });
      const name = `hero-${k}.webp`; fs.writeFileSync(path.join(imgDir, name), o.data); files[k] = { file: name, w: o.info.width, h: o.info.height, kb: Math.round(o.data.length / 1024) };
    }
    out.secilen = { id: secilen.id, w: secilen.w, h: secilen.h, kaynak: secilen.kaynak, url: secilen.url, puan: secilen.puan, neden: secilen.neden, focus: secilen.focus, files, gercekPiksel: `${secilen.w}x${secilen.h}`, buyutme: 'yok' };
  }
  return out;
}

// ---- 5. secilen karenin dosyalari (hat, 11 Kas): inceleme turu kareyi GOZLE secer; burada o karenin en buyuk surumu indirilir (en cok 3 istek, robots.txt'e
// uyan Polite), gercek piksel olculur ve hero-{3200,2400,1600,960}.webp BUYUTMEDEN yazilir.  1920 px altinda duzen 'cerceve'.  hero-secim.json: secim + ilk 5 aday + gerekce.
// getir: async (url) => { buf } | null ; inceleme: { inceleyen, gerekce, reddedilen }
export async function heroDosyalari(R, { dir, id, getir = null, adaylar = [], inceleme = {}, log = () => {} }) {
  const p = (R.photos || []).find((x) => String(x.id) === String(id)); if (!p) throw new Error(`hero karesi yok: ${id}`);
  let buf = fs.existsSync(path.join(dir, p.file)) ? fs.readFileSync(path.join(dir, p.file)) : null; let W = 0; let H = 0; let kaynak = 'yerel kopya (cikarici, en cok 1800 px)'; let url = p.url;
  if (buf) { const m = await sharp(buf).metadata(); W = m.width; H = m.height; }
  const aday = adaylar.find((a) => String(a.id) === String(id));
  const denenecek = [...new Set([...(aday && aday.url ? [aday.url] : []), ...buyukSurumler(p.url)])];
  let n = 0;
  for (const u of denenecek) {
    if (!getir || n >= 3) break; n++;
    let r = null; try { r = await getir(u); } catch { r = null; }
    if (!r || !r.buf || !sniff(r.buf) || sniff(r.buf) === 'image/svg+xml') continue;
    let meta; try { meta = await sharp(r.buf, { limitInputPixels: 150e6 }).rotate().metadata(); } catch { continue; }
    if (meta.width >= W) { buf = r.buf; W = meta.width; H = meta.height; kaynak = u === p.url ? 'orijinal url' : `buyuk surum (${u.length > 90 ? '…' + u.slice(-60) : u})`; url = u; log(`   hero ${id}: ${W}x${H} <- ${u.slice(0, 100)}`); }
    if (W >= 3200) break;
  }
  if (!buf) throw new Error(`hero karesi okunamadi: ${id}`);
  const imgDir = path.join(dir, 'hero'); fs.mkdirSync(imgDir, { recursive: true });
  for (const f of fs.readdirSync(imgDir)) if (/^hero-\d+\.webp$/.test(f)) fs.rmSync(path.join(imgDir, f));
  const files = {};
  // 1920-2159 px kaynak: 2400 dosyasi yok, 1600'e kucultmek tam ekran duzenini bozar; kaynagin kendi genisligi (buyutmeden) ayrica yazilir
  const yerli = W >= HERO_MIN && W < 2160 ? [[String(W), W, 76]] : [];
  for (const [k, w, q] of [['3200', 3200, 70], ['2400', 2400, 74], ...yerli, ['1600', 1600, 76], ['960', 960, 72]]) {
    if (W < w * 0.9 && k !== '960' && !(k === '1600' && !Object.keys(files).length)) continue;
    const o = await sharp(buf, { limitInputPixels: 150e6 }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer({ resolveWithObject: true });
    fs.writeFileSync(path.join(imgDir, `hero-${k}.webp`), o.data); files[k] = { file: `hero-${k}.webp`, w: o.info.width, h: o.info.height, kb: Math.round(o.data.length / 1024) };
  }
  const a = await analiz(buf).catch(() => ({}));
  const duzen = W >= HERO_MIN ? 'tam' : 'cerceve';
  const out = { slug: R.slug, adaylar, duzen, secilen: { id: String(id), w: W, h: H, kaynak, url, puan: aday ? aday.puan : null, neden: aday ? aday.neden : [], focus: (a && a.focus) || p.focus || { x: 0.5, y: 0.5 }, files, gercekPiksel: `${W}x${H}`, buyutme: 'yok', gozle: `${inceleme.inceleyen || 'inceleme'} secti: ${inceleme.gerekce || ''}`, puanlayicininIlki: adaylar[0] ? adaylar[0].id : null, reddedilen: inceleme.reddedilen || [] }, kural: `tam ekran icin en az ${HERO_MIN} px; altinda cerceve duzeni; buyutme yok`, at: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, 'hero-secim.json'), JSON.stringify(out, null, 1));
  return out;
}
