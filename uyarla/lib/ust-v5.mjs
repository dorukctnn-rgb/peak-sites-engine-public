// V5 UST KATMAN (12 Kas 2026): restoran v5 sayfasina sinematik ilk ekran, yemek sahnesi (ya da ince ayirici), sekmeli ve fotografi acilan urun menusu, yemek kaydiricisi,
// galeri seridi ve imlec izi verisi ekler.  Kayan yazi seridi (marquee) HICBIR sayfada yoktur (Doruk 12 Kas, kalici: "ucuz kaciyor"); yerinde isletmenin KENDI yemek
// fotografi dairede durur, kaydirinca ekrani doldurur, sonda yemegin adi ve gercek fiyati cikar; uygun fotograf yoksa yalniz ince bir ayirici.
// Iki parca:
//   ustHazirla(): icerik kararindaki icerik.ust bolumu + isletmenin kendi fotograflari -> NETLIK KAPISINDAN (lib/netlik.mjs) gecenler -> gorseller (sharp) + ust.json benzeri spec
//   ustUygula(html, spec): uretilen v5 sayfasini donusturur (sayfa metinleri tasinir, yeniden yazilmaz)
// icerik.ust bicimi (hepsi istege bagli; ornek: inceleme/ornek/v5.json):
//   { sahne: { foto: "05", yemek: "<menu kaleminin adi, aynen>", alt, fx, fy },        // fx, fy 0..1: yemegin fotograftaki yeri (dairenin baslangici)
//     menuFoto: { "<kalem adi>": "09" },  sekmeFoto: { "<bolum adi>": "06" },            // yalniz adi KESIN eslesen satira; emin degilsen sekmeye
//     galeri: { foto: ["01","02","04"], kicker, h2, p },  iz: { kesimler: [{ ad, foto, kutu:[x0,y0,x1,y1], elips:true }] } }
// Hicbir ust verisi yoksa sayfa yine tamdir: sekmeli menu (bolumler kalemlerin cat alanindan), ince ayirici, kendi karelerinden galeri (en az 3 temiz kare), iz yok.
// Her buyuk yuva icin: yalniz netlik + cozunurluk kapisindan gecen KENDI fotografi girer; gecmeyen yuva daralir (menu yalniz metin, galeri/kaydirici/sahne yok).
import fs from 'node:fs';
import path from 'node:path';
import { sharp, sniff } from './gorsel.mjs';
import { fotoDenetle } from './netlik.mjs';
import { kesimYap } from './kesme-v5.mjs';
import { sade, yuvaUygun } from './foto-uyum.mjs';
import { buyukSurumler } from './hero-sec.mjs';

export const UST_DOSYALAR = ['ust.css', 'ust.js', 'iz.js'];
// Telefon (390 x 844, 2x): dik ekran yatay fotografi yukseklikten kirpar, kaynak yuksekligi tabanin altindaysa buyutme gerekir.  Telafisi buyutme degil yerlesimdir:
// kahraman telefonda ayni fotografin DIK kesitiyle (kendi pikseliyle, kutu = kesit yuksekligi / 2 / 1.2) gelir, yemek sahnesi (ekrani dolduran) sahneEnAz yukseklik
// yoksa telefonda ince ayiriciya doner.  Masaustu ve tablet ayni kalir.
export const TELEFON = { kutuOran: 390 / 480, kesitEnYuk: 1360, sahneEnAz: 1600, genislikEn: 599 };
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// panel (menu yemek karesi) sizes: telefonda kutu 4:3 (yukseklik = 0.75 genislik), masaustunde ekran yuksekligi; cover yukseklikten kirpar, gereken genislik = kutu yuksekligi x en/boy
const panelSizes = (w, h) => `(max-width: 899px) ${Math.round(75 * w / h)}vw, max(50vw, ${Math.round(100 * w / h)}vh)`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (n, d = '50%') => (typeof n === 'number' && n >= 0 && n <= 1 ? `${Math.round(n * 100)}%` : d);

const YAZI = {
  tr: { galeri: { kicker: 'Galeri', h2: 'Mekândan kareler' }, kaydir: { kicker: 'Menü', h2: 'Menüden kareler', onceki: 'Önceki yemekler', sonraki: 'Sonraki yemekler' }, menuGenel: 'Menü', sekmeler: 'Menü bölümleri', foto: 'Fotoğraf: ' },
  en: { galeri: { kicker: 'Gallery', h2: 'A look inside' }, kaydir: { kicker: 'Menu', h2: 'Dishes from the menu', onceki: 'Previous dishes', sonraki: 'Next dishes' }, menuGenel: 'Menu', sekmeler: 'Menu sections', foto: 'Photo: ' },
};

async function webp(buf, file, w, q = 78) {
  const o = await sharp(buf, { limitInputPixels: 150e6 }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(file, o.data); return { w: o.info.width, h: o.info.height };
}

// ---- 1. HAZIRLIK ----
// girdi: { dir (<veri>/<slug>), imgDir (sayfa img klasoru), R, e (isletmenin v5 kaydi), lang, items [{n,d,p,cat}], heroId, F (foto yuvalari), uyum, log }
export async function ustHazirla({ dir, imgDir, R, e = {}, lang, items = [], heroId = null, uyum = null, ayrik = new Set(), log = () => {} }) {
  const Y = YAZI[lang === 'tr' ? 'tr' : 'en']; const U0 = e.ust || {}; const uyari = []; const rapor = { sahne: null, menuFoto: [], galeri: [], iz: null, elenen: [] };
  const foto = (id) => (R.photos || []).find((p) => String(p.id) === String(id));
  const dosya = (id) => { const p = foto(id); const f = p && path.join(dir, p.file); return f && fs.existsSync(f) ? f : null; };
  const uygun = (id) => (uyum ? yuvaUygun(uyum, id, { kart: true }).ok : true);
  const spec = { lang: lang === 'tr' ? 'tr' : 'en', hero: null, menu: null, sahne: null, galeri: null, kaydir: null, iz: null, yazi: Y };

  // -- menu: bolumler (kalemlerin cat alani), fotografli yemekler --
  const fiyatli = items.filter((x) => clean(x.p));
  const adlar = new Map(fiyatli.map((x) => [sade(x.n), x]));
  const gruplar = []; const gi = new Map();
  for (const x of fiyatli) { const ad = clean(x.cat) || Y.menuGenel; if (!gi.has(ad)) { gi.set(ad, gruplar.length); gruplar.push({ ad, items: [] }); } gruplar[gi.get(ad)].items.push({ n: clean(x.n), d: clean(x.d), p: clean(x.p) }); }
  // fotograf atamalari: karar (menuFoto) + kendiliginden yalniz KESIN ad eslesmesi (fotografin kendi alt yazisi kalem adinin aynisi)
  const menuFoto = new Map();
  for (const [ad, id] of Object.entries(U0.menuFoto || {})) { const it = adlar.get(sade(ad)); if (!it) uyari.push(`ust.menuFoto: "${ad}" menüde yok, yok sayıldı`); else if (!/^\d{2}$/.test(String(id)) || !foto(id)) uyari.push(`ust.menuFoto: fotoğraf ${id} yok`); else menuFoto.set(sade(it.n), String(id)); }
  for (const p of R.photos || []) { const a = sade(p.alt || ''); if (a && adlar.has(a) && !menuFoto.has(a) && uygun(p.id)) menuFoto.set(a, String(p.id)); }
  const sekmeFoto = new Map();
  for (const [ad, id] of Object.entries(U0.sekmeFoto || {})) { if (!gruplar.some((g) => sade(g.ad) === sade(ad))) uyari.push(`ust.sekmeFoto: bölüm "${ad}" yok`); else if (!/^\d{2}$/.test(String(id)) || !foto(id)) uyari.push(`ust.sekmeFoto: fotoğraf ${id} yok`); else sekmeFoto.set(sade(ad), String(id)); }
  const onbellek = new Map();
  const panelFoto = async (id, ad) => {
    id = String(id); if (onbellek.has(id)) return onbellek.get(id);
    let sonuc = null; const f = dosya(id);
    if (!f) uyari.push(`menü fotoğrafı ${id}: dosya yok`);
    else if (!uygun(id)) uyari.push(`menü fotoğrafı ${id}: foto uyumu kapısından geçmedi`);
    else {
      const buf = fs.readFileSync(f); const d = await fotoDenetle(buf, 'panel');
      if (!d.ok) { uyari.push(`menü fotoğrafı ${id} kullanılmadı: ${d.neden.join('; ')}`); rapor.elenen.push({ id, yuva: 'menü', neden: d.neden.join('; '), olcu: d.olcu }); }
      else {
        const k = `f${id}`; const md = await sharp(buf).metadata(); const rot = md.orientation >= 5;
        const W = rot ? md.height : md.width; const H0 = rot ? md.width : md.height; const p = foto(id); const fo = (p && p.focus) || { x: 0.5, y: 0.5 };
        const b = { k, alt: clean(ad), fx: pct(fo.x), fy: pct(fo.y) };
        if (d.contain) { // kaynak yuksekligi panel icin kucuk: dogal boyutunda, buyutmeden, bulanik arka zeminle
          const r = await webp(buf, path.join(imgDir, `mx-${k}-${Math.min(W, 1400)}.webp`), 1400); Object.assign(b, { src: `img/mx-${k}-${r.w}.webp`, w: r.w, h: r.h, fit: 'contain', mobil: `img/mx-${k}-${r.w}.webp` });
        } else {
          const ws = [...new Set([900, Math.min(1400, W), Math.min(2048, W)].filter((x) => x <= W))]; const got = []; // cover dik kutuda yukseklikten kirpar: en buyuk surum kaynagin 2048 px'ine kadar
          for (const w of ws) { const r = await webp(buf, path.join(imgDir, `mx-${k}-${w}.webp`), w); got.push({ w: r.w, h: r.h, file: `img/mx-${k}-${r.w}.webp` }); }
          const big = got[got.length - 1]; Object.assign(b, { src: big.file, w: big.w, h: big.h, mobil: got[0].file, ...(got.length > 1 ? { srcset: got.map((g) => `${g.file} ${g.w}w`).join(', ') } : {}) });
        }
        const s = Math.round(Math.min(W, H0) * 0.8);
        try {
          const L = Math.max(0, Math.min(W - s, Math.round(fo.x * W - s / 2))); const T = Math.max(0, Math.min(H0 - s, Math.round(fo.y * H0 - s / 2)));
          const tb = await sharp(buf).rotate().extract({ left: L, top: T, width: s, height: s }).resize(160, 160).webp({ quality: 78 }).toBuffer(); fs.writeFileSync(path.join(imgDir, `mx-${k}-t.webp`), tb); b.thumb = `img/mx-${k}-t.webp`;
        } catch { b.thumb = null; }
        sonuc = b; rapor.menuFoto.push({ id, olcu: d.olcu, fit: d.contain ? 'contain' : 'cover' });
      }
    }
    onbellek.set(id, sonuc); return sonuc;
  };
  const fotolar = {}; const sekmeler = [];
  for (const g of gruplar) {
    const t = { ad: g.ad, items: [] }; const sf = sekmeFoto.get(sade(g.ad)); const sp = sf ? await panelFoto(sf, g.ad) : null;
    if (sp) { fotolar[sp.k] = sp; t.k = sp.k; }
    for (const it of g.items) { const id = menuFoto.get(sade(it.n)); const dp = id ? await panelFoto(id, it.n) : null; if (dp) { if (!fotolar[dp.k]) fotolar[dp.k] = { ...dp, cap: it.n, capB: g.ad }; it.k = dp.k; } t.items.push(it); }
    sekmeler.push(t);
  }
  // varsayilan foto: sekmelerin ilk fotografli yemegi ya da sekme fotografi; hicbiri gecmediyse menu yalniz metin
  const ilk = Object.values(fotolar)[0] || null;
  spec.menu = { tabs: sekmeler, fotolar, varsayilan: ilk ? { ...ilk } : null, yalin: !ilk, tek: sekmeler.length <= 1 };
  if (!ilk) uyari.push('menüde netlik kapısından geçen kendi fotoğrafı yok; menü yalnız metin');

  // -- yemek kaydiricisi: en az 4 fotografli, fiyatli yemek --
  const kd = []; const gorulen = new Set();
  for (const t of sekmeler) for (const it of t.items) if (it.k && !gorulen.has(it.k)) { gorulen.add(it.k); const b = fotolar[it.k]; kd.push({ src: b.mobil && b.fit !== 'contain' ? b.mobil : b.src, w: b.fit === 'contain' ? b.w : 900, h: b.fit === 'contain' ? b.h : Math.round(b.h * 900 / b.w), alt: it.n, n: it.n, p: it.p, d: it.d }); }
  if (kd.length >= 4) spec.kaydir = { ...Y.kaydir, items: kd };

  // -- yemek sahnesi: orijinal buyuk dosya (icerik asamasinda indirildi) netlik + 1920 px kapisindan gecerse; yoksa ince ayirici --
  const S0 = U0.sahne;
  if (S0 && S0.foto) {
    const sj = path.join(dir, 'ust', 'sahne.json'); let sm = null; try { sm = JSON.parse(fs.readFileSync(sj, 'utf8')); } catch { sm = null; }
    const it = S0.yemek ? adlar.get(sade(S0.yemek)) : null;
    if (!sm || String(sm.id) !== String(S0.foto)) uyari.push('sahne: büyük dosya yok (içerik aşamasında indirilmemiş); ince ayırıcı');
    else if (!sm.files) uyari.push(`sahne: ${sm.yok || 'büyük dosya yok'}`);
    else if (!it) uyari.push(`sahne: yemek "${S0.yemek || ''}" menüde yok ya da fiyatsız; ince ayırıcı`);
    else if (heroId && String(S0.foto) === String(heroId)) uyari.push('sahne: kahraman fotoğrafı sahnede tekrarlanmaz; ince ayırıcı');
    else if (!uygun(S0.foto)) uyari.push('sahne: fotoğraf foto uyumu kapısından geçmedi; ince ayırıcı');
    else {
      const en = Object.values(sm.files).sort((a, b) => b.w - a.w)[0]; const fp = path.join(dir, 'ust', en.file);
      const d = fs.existsSync(fp) ? await fotoDenetle(fs.readFileSync(fp), 'sahne') : { ok: false, neden: ['dosya yok'], olcu: null };
      rapor.sahne = { id: String(S0.foto), yemek: it.n, olcu: d.olcu, ok: d.ok, neden: d.neden };
      if (!d.ok) uyari.push(`sahne fotoğrafı ${S0.foto} kullanılmadı: ${d.neden.join('; ')}; ince ayırıcı`);
      else {
        const sets = []; for (const f of Object.values(sm.files).sort((a, b) => a.w - b.w)) { const kopya = `sahne-${f.w}.webp`; fs.copyFileSync(path.join(dir, 'ust', f.file), path.join(imgDir, kopya)); sets.push({ file: `img/${kopya}`, w: f.w, h: f.h }); }
        const mid = sets.find((x) => x.w >= 1500) || sets[sets.length - 1]; const big = sets[sets.length - 1];
        const fo = (foto(S0.foto) || {}).focus || { x: 0.5, y: 0.5 };
        spec.sahne = { src: mid.file, srcset: sets.map((x) => `${x.file} ${x.w}w`).join(', '), w: big.w, h: big.h, fx: pct(typeof S0.fx === 'number' ? S0.fx : fo.x), fy: pct(typeof S0.fy === 'number' ? S0.fy : fo.y), cx: Math.round((typeof S0.fx === 'number' ? S0.fx : fo.x) * 100), cy: Math.round((typeof S0.fy === 'number' ? S0.fy : fo.y) * 100), alt: clean(S0.alt) || it.n, not: { b: it.n, s: it.p } };
      }
    }
  }

  // -- galeri seridi: karar (galeri.foto) ya da kendi karelerinden (kendi, uyumlu, yemek disi once); en az 3 --
  const G0 = U0.galeri || {}; const kullanilmis = new Set([...(ayrik || [])].map(String)); if (heroId) kullanilmis.add(String(heroId)); if (S0 && S0.foto) kullanilmis.add(String(S0.foto));
  const acik = Array.isArray(G0.foto) && G0.foto.length; let adaylar = acik ? [...new Set(G0.foto.map(String))] : null;
  if (!adaylar && uyum) adaylar = (uyum.uygun || []).filter((x) => x.kaynak === 'kendi' && !x.yalnizKart && x.w / x.h >= 1.2 && !kullanilmis.has(x.id)).sort((a, b) => (a.konu === 'yemek' ? 1 : 0) - (b.konu === 'yemek' ? 1 : 0)).map((x) => x.id);
  const gal = [];
  for (const id of adaylar || []) {
    if (gal.length >= 6) break; if (!foto(id)) { uyari.push(`ust.galeri: fotoğraf ${id} yok`); continue; }
    const f = dosya(id); if (!f || !uygun(id) || String(id) === String(heroId) || (S0 && String(id) === String(S0.foto))) continue;
    const buf = fs.readFileSync(f); const d = await fotoDenetle(buf, 'galeri');
    if (!d.ok) { rapor.elenen.push({ id, yuva: 'galeri', neden: d.neden.join('; '), olcu: d.olcu }); if (acik) uyari.push(`galeri fotoğrafı ${id} kullanılmadı: ${d.neden.join('; ')}`); continue; }
    const W = d.olcu.w; const ws = [...new Set([960, Math.min(1600, W)])].filter((x) => x <= W); const got = [];
    for (const w of ws) { const r = await webp(buf, path.join(imgDir, `gal-${id}-${w}.webp`), w, 76); got.push({ w: r.w, h: r.h, file: `img/gal-${id}-${r.w}.webp` }); }
    const big = got[got.length - 1]; const fo = (foto(id) || {}).focus || { x: 0.5, y: 0.5 };
    gal.push({ src: got[0].file, ...(got.length > 1 ? { srcset: got.map((x) => `${x.file} ${x.w}w`).join(', ') } : {}), w: big.w, h: big.h, alt: clean((foto(id) || {}).alt) || (lang === 'tr' ? 'Mekândan bir kare' : 'A view of the room'), fx: pct(fo.x), fy: pct(fo.y) });
    rapor.galeri.push({ id, olcu: d.olcu });
  }
  if (gal.length >= 3) spec.galeri = { kicker: clean(G0.kicker) || Y.galeri.kicker, h2: clean(G0.h2) || Y.galeri.h2, p: clean(G0.p), items: gal };
  else if (gal.length) uyari.push(`galeri: yalnız ${gal.length} temiz kare; galeri gösterilmedi`);

  // -- imlec izi: icerik.ust.iz.kesimler -> temiz kesim (>= 4) --
  const kes = ((U0.iz || {}).kesimler) || [];
  if (kes.length) {
    const calisma = path.join(dir, 'ust', 'kesme');
    const r = kesimYap({ kesimler: kes, R, kaynakDizin: dir, calisma, log });
    rapor.iz = { durum: r.durum, gecen: r.gecen.map((g) => ({ ad: g.ad, kenarKontrast: g.rapor.kenarKontrast, doluluk: g.rapor.doluluk, kenarTemas: g.rapor.kenarTemas })), elenen: r.elenen };
    if (r.durum === 'ok') { fs.copyFileSync(r.atlas.file, path.join(imgDir, r.atlas.ad)); spec.iz = { src: `img/${r.atlas.ad}`, cell: r.atlas.hucre, n: r.atlas.n }; }
    else uyari.push(`imleç izi yok (${r.durum}${r.elenen.length ? `: ${r.elenen.slice(0, 3).map((x) => `${x.ad} ${x.neden}`).join('; ')}` : ''})`);
  }
  return { spec, uyari, rapor };
}

// ---- 2. HTML DONUSUMU ----
// h: uret-v5'in yazdigi sayfa; S: ustHazirla().spec + { hero: { xl: { src, w, h } } | null }
export function ustUygula(h, S) {
  const TR = (S.lang || 'tr') === 'tr'; const Y = S.yazi || YAZI[TR ? 'tr' : 'en'];
  const must = (c, m) => { if (!c) throw new Error(`ust katmani: ${m}`); };
  if (h.includes('/ust.css')) throw new Error('ust katmani: sayfaya zaten uygulanmis');
  const NL = h.includes('\r\n') ? '\r\n' : '\n';
  const ortak = (/href="((?:\.\.\/){2}[^"/]+)\/v5\.css"/.exec(h) || [])[1]; must(ortak, 'v5.css baglantisi yok');
  must(h.includes('<link rel="stylesheet" href="theme.css">'), 'theme.css baglantisi yok');
  h = h.replace('<link rel="stylesheet" href="theme.css">', `<link rel="stylesheet" href="theme.css">${NL}<link rel="stylesheet" href="${ortak}/ust.css">`);

  // kahraman: buyuk dosya (1920 px ve ustu) ve atmosfer katmani
  if (S.hero && S.hero.xl) {
    const x = S.hero.xl; const m = S.hero.m; const tel = TELEFON.genislikEn;
    h = h.replace('<section class="hero" aria-labelledby="h1">', `<section class="hero hero-xl${m ? ' hero-m' : ''}" aria-labelledby="h1" style="--hero-w:${x.w}px;--hero-h:${x.h}px${m ? `;--hero-mh:${m.h}px` : ''}">`);
    if (m) { // telefon: ayni fotografin dik kesiti (kendi pikseli), masaustu dosyasi telefona inmez
      const ri = /<img class="hero-img" [^>]*>/; must(ri.test(h), 'hero-img yok');
      h = h.replace(ri, (img) => `<picture class="hero-pic"><source media="(max-width: ${tel}px)" srcset="${esc(m.src)}" type="image/webp">${img}</picture>`);
      const rp = /<link rel="preload" as="image" href="[^"]*" imagesrcset="[^"]*" imagesizes="[^"]*" fetchpriority="high">/;
      if (rp.test(h)) h = h.replace(rp, (l) => `<link rel="preload" as="image" href="${esc(m.src)}" media="(max-width: ${tel}px)" type="image/webp" fetchpriority="high">${NL}${l.replace('<link rel="preload" as="image"', `<link rel="preload" as="image" media="(min-width: ${tel + 1}px)"`)}`);
    }
  }
  must(h.includes('<div class="hero-shade"></div>'), 'hero-shade yok');
  h = h.replace('<div class="hero-shade"></div>', '<div class="hero-shade"></div><div class="hero-grain" aria-hidden="true"></div>');

  // kayan yazi seridi hicbir zaman yok; kahramandan sonra: yemek sahnesi ya da ince ayirici
  h = h.replace(/<div class="marquee"[^>]*><div class="marquee-in"[^>]*>[\s\S]*?<\/div><\/div>\s*/g, '');
  const hs = h.indexOf('<section class="hero'); must(hs >= 0, 'kahraman bolumu yok'); const he = h.indexOf('</section>', hs) + '</section>'.length;
  const Z = S.sahne; const telefonYok = !!(Z && Z.h < TELEFON.sahneEnAz); // dik telefon ekrani sahneyi buyutmeden dolduramaz: telefonda ince ayirici
  const sahne = Z
    ? [`<section class="sahne${telefonYok ? ' sahne-m0' : ''}" aria-label="${esc(Z.not ? Z.not.b : Z.alt)}"${Z.cx != null ? ` data-cx="${Z.cx}" data-cy="${Z.cy}"` : ''}>`, `  <div class="sahne-pin">`, `    <div class="sahne-halka" aria-hidden="true"></div>`,
      `    <figure class="sahne-foto" style="--fx:${Z.fx || '50%'};--fy:${Z.fy || '50%'}"><img src="${esc(Z.src)}"${Z.srcset ? ` srcset="${esc(Z.srcset)}" sizes="max(100vw, ${Math.round(106 * Z.w / Z.h)}vh)"` : ''} alt="${esc(Z.alt)}" width="${Z.w}" height="${Z.h}" loading="lazy" decoding="async"></figure>`,
      Z.not ? `    <p class="sahne-not"><b>${esc(Z.not.b)}</b>${Z.not.s ? `<span>${esc(Z.not.s)}</span>` : ''}</p>` : '', `  </div>`, `</section>`, telefonYok ? '<div class="ayrac-m" aria-hidden="true"></div>' : ''].filter(Boolean).join(NL)
    : '<div class="ayrac" aria-hidden="true"></div>';
  h = h.slice(0, he) + NL + NL + sahne + h.slice(he);

  // menu: eski .split#menu bolumunden metinleri al, yerine urun menusu yaz
  const re = /<section class="split[^"]*" id="menu"/; const m0 = re.exec(h); must(m0, 'menu bolumu (.split#menu) yok');
  const mS = m0.index; const mE = h.indexOf('</section>', mS) + '</section>'.length; const eski = h.slice(mS, mE);
  const al = (r) => { const m = eski.match(r); return m ? m[1] : ''; };
  const kicker = al(/<span class="kicker rv">([\s\S]*?)<\/span>/); const h2 = al(/(<h2 class="h2 wr" id="menu-h">[\s\S]*?<\/h2>)/); const para = al(/(<p class="p rv">[\s\S]*?<\/p>)/);
  const legend = al(/(<p class="legend rv">[\s\S]*?<\/p>)/).replace('class="legend rv"', 'class="mx-legend rv"'); const btn = al(/(<a class="btn btn-ghost rv"[\s\S]*?<\/a>)/);
  must(h2, 'menu basligi okunamadi'); const M = S.menu; must(M && M.tabs && M.tabs.length, 'menu sekmeleri bos');
  for (const t of M.tabs) for (const it of t.items) must(it.p && String(it.p).trim(), `fiyatsiz satir: ${it.n}`);
  const F = M.fotolar || {}; const figs = [];
  if (M.varsayilan) { const v = M.varsayilan; figs.push(`<figure class="mx-fig on" data-k="0" style="--fx:${v.fx || '50%'};--fy:${v.fy || '50%'}${v.fit === 'contain' ? `;--nw:${v.w}px;--nh:${v.h}px` : ''}"${v.fit === 'contain' ? ' data-fit="contain"' : ''}><img src="${esc(v.src)}"${v.srcset ? ` srcset="${esc(v.srcset)}" sizes="${panelSizes(v.w, v.h)}"` : ''} alt="" width="${v.w}" height="${v.h}" decoding="async"></figure>`); }
  for (const [k, f] of Object.entries(F)) {
    const cn = f.fit === 'contain'; const st = [f.fx ? `--fx:${f.fx}` : '', f.fy ? `--fy:${f.fy}` : '', cn ? `--nw:${f.w}px;--nh:${f.h}px` : ''].filter(Boolean).join(';');
    figs.push(`<figure class="mx-fig" data-k="${esc(k)}"${cn ? ' data-fit="contain"' : ''}${st ? ` style="${st}"` : ''}><img data-src="${esc(f.src)}"${f.srcset ? ` data-srcset="${esc(f.srcset)}" sizes="${panelSizes(f.w, f.h)}"` : ''} alt="" width="${f.w}" height="${f.h}" decoding="async">${f.cap ? `<figcaption>${f.capB ? `<b>${esc(f.capB)}</b>` : ''}${esc(f.cap)}</figcaption>` : ''}</figure>`);
  }
  const tabs = M.tabs.map((t, i) => `<button class="mx-tab" type="button" role="tab" id="mxt-${i}" aria-controls="mxp-${i}" aria-selected="${i ? 'false' : 'true'}"${i ? ' tabindex="-1"' : ''}${t.k ? ` data-k="${esc(t.k)}"` : ''}>${esc(t.ad)}</button>`).join('');
  const panels = M.tabs.map((t, i) => {
    const lis = t.items.map((it) => {
      const has = it.k && F[it.k];
      const thumb = has && F[it.k].thumb ? `<img class="mx-thumb" src="${esc(F[it.k].thumb)}" alt="" width="58" height="58" loading="lazy" decoding="async">` : '';
      const big = has ? `<figure class="mx-big"><img data-src="${esc(F[it.k].mobil || F[it.k].src)}" alt="${esc(F[it.k].alt || it.n)}" width="${F[it.k].w}" height="${F[it.k].h}" decoding="async"></figure>` : '';
      const hit = has ? `<button class="mx-hit" type="button" aria-expanded="false" aria-label="${esc(Y.foto + it.n)}"></button>` : '';
      return `<li class="mx-dish"${has ? ` data-k="${esc(it.k)}"` : ''}>${thumb}<h3>${esc(it.n)}</h3><span class="pr">${esc(it.p)}</span>${it.d ? `<p class="dd">${esc(it.d)}</p>` : ''}${hit}${big}</li>`;
    }).join('');
    return `<div class="mx-panel" role="tabpanel" id="mxp-${i}" aria-labelledby="mxt-${i}"${i ? ' hidden' : ''}><ul class="mx-list">${lis}</ul></div>`;
  }).join(NL + '      ');
  const yeni = [`<section class="mx${M.yalin ? ' mx-yalin' : ''}${M.tek ? ' mx-tek' : ''}" id="menu" aria-labelledby="menu-h" data-par>`, M.yalin ? '' : `  <div class="mx-media" aria-hidden="true">${figs.join('')}</div>`, `  <div class="mx-body">`, `    <span class="kicker rv">${kicker}</span>`, `    ${h2}`, para ? `    ${para}` : '',
    `    <div class="mx-tabs" role="tablist" aria-label="${esc(Y.sekmeler)}">${tabs}</div>`, `    <div class="mx-panels">`, `      ${panels}`, `    </div>`, legend ? `    ${legend}` : '', btn ? `    ${btn}` : '', `  </div>`, `</section>`].filter((x) => x !== '').join(NL);
  let kd = '';
  if (S.kaydir && S.kaydir.items && S.kaydir.items.length >= 4) {
    const K = S.kaydir; const kw = String(K.h2).split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}"><span>${esc(w)}</span></span>`).join(' ');
    const ok = (y, l) => `<button class="kd-btn" type="button" data-yon="${y}" aria-label="${esc(l)}" aria-controls="kd-list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${y < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg></button>`;
    const cards = K.items.map((c, i) => `<li class="kd-card" style="--i:${i}"><figure><img src="${esc(c.src)}" alt="${esc(c.alt)}" width="${c.w}" height="${c.h}" loading="lazy" decoding="async" draggable="false"></figure><h3>${esc(c.n)}</h3><span class="pr">${esc(c.p)}</span>${c.d ? `<p>${esc(c.d)}</p>` : ''}</li>`).join('');
    kd = [`<section class="kd" aria-labelledby="kd-h">`, `  <div class="kd-h"><div>${K.kicker ? `<span class="kicker rv">${esc(K.kicker)}</span>` : ''}<h2 class="h2 wr" id="kd-h">${kw}</h2></div><div class="kd-ok">${ok(-1, K.onceki)}${ok(1, K.sonraki)}</div></div>`, `  <ul class="kd-list" id="kd-list" tabindex="0" aria-label="${esc(K.h2)}">${cards}</ul>`, `</section>`, '', ''].join(NL);
  }
  h = h.slice(0, mS) + kd + yeni + h.slice(mE);

  // galeri seridi: hikaye bolumunden sonra (hikaye yoksa menuden sonra)
  if (S.galeri && S.galeri.items && S.galeri.items.length >= 3) {
    const G = S.galeri; const words = String(G.h2).split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}"><span>${esc(w)}</span></span>`).join(' ');
    const items = G.items.map((g, i) => { const ar = g.w / g.h; const am = Math.min(ar, 4 / 3); return `<figure class="gal-item" style="--ar:${g.w} / ${g.h};--am:${am.toFixed(4)};--i:${i};--mw:${g.w}px${g.fx ? `;--fx:${g.fx}` : ''}${g.fy ? `;--fy:${g.fy}` : ''}"><img src="${esc(g.src)}"${g.srcset ? ` srcset="${esc(g.srcset)}" sizes="(max-width: 899px) ${Math.round(78 * ar / am)}vw, ${Math.round(100 * Math.min(2.2, ar) * 0.54 * 1.12)}vh"` : ''} alt="${esc(g.alt)}" width="${g.w}" height="${g.h}" loading="lazy" decoding="async"></figure>`; }).join('');
    const gal = ['', '', `<section class="gal" id="galeri" aria-labelledby="gal-h">`, `  <div class="gal-h"><div>${G.kicker ? `<span class="kicker rv">${esc(G.kicker)}</span>` : ''}<h2 class="h2 wr" id="gal-h">${words}</h2></div>${G.p ? `<p class="p rv">${esc(G.p)}</p>` : ''}</div>`, `  <div class="gal-track">${items}</div>`, `</section>`].join(NL);
    const sI = h.indexOf('id="hikaye"'); let at;
    if (sI >= 0) at = h.indexOf('</section>', sI) + '</section>'.length; else { const q = h.indexOf('id="menu"'); at = h.indexOf('</section>', q) + '</section>'.length; }
    h = h.slice(0, at) + gal + h.slice(at);
  }

  // veri + betik: v5.js'ten once veri, sonra ust.js
  const v5 = h.match(/<script src="((?:\.\.\/){2}[^"/]+)\/v5\.js" defer><\/script>/); must(v5, 'v5.js betigi yok');
  const U = {}; if (S.iz && S.iz.src && S.iz.n >= 4) U.iz = { src: S.iz.src, cell: S.iz.cell, n: S.iz.n };
  h = h.replace(v5[0], `<script type="application/json" id="r-ust">${JSON.stringify(U)}</script>${NL}${v5[0]}${NL}<script src="${v5[1]}/ust.js" defer></script>`);
  return h;
}

// ---- 2b. TELEFON KAHRAMAN KESITI: masaustu kahraman dosyasinin odak noktasi etrafinda dik kesit (kutu 390:480), KENDI pikseli (kucultme ve buyutme yok), kucuk dosya ----
// buf: masaustu kahraman dosyasi (en buyuk surum), focus: {x,y} 0..1.  -> { src, w, h } (img/ altina yazilir)
export async function heroTelefon({ buf, focus = { x: 0.5, y: 0.5 }, imgDir }) {
  const md = await sharp(buf, { limitInputPixels: 150e6 }).metadata(); const W = md.width; const H = md.height;
  const Hc = Math.min(H, TELEFON.kesitEnYuk); const Wc = Math.min(W, Math.round(Hc * TELEFON.kutuOran));
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const left = cl(Math.round(focus.x * W - Wc / 2), 0, W - Wc); const top = cl(Math.round(focus.y * H - Hc / 2), 0, H - Hc);
  const o = await sharp(buf, { limitInputPixels: 150e6 }).extract({ left, top, width: Wc, height: Hc }).webp({ quality: 68, effort: 5 }).toBuffer({ resolveWithObject: true });
  const file = `hero-m-${Wc}.webp`; fs.writeFileSync(path.join(imgDir, file), o.data);
  return { src: `img/${file}`, w: Wc, h: Hc };
}

// ---- 3. SAHNE ICIN BUYUK DOSYA (icerik asamasi, ag var): fotografin en buyuk surumu indirilir, sahne-{2400,1600,1024}.webp BUYUTMEDEN <veri>/<slug>/ust/ altina yazilir ----
// getir: async (url) => { buf } | null.  1920 px altinda dosya yazilmaz (sahne yerine ince ayirici).
export async function sahneDosyalari(R, { dir, id, getir = null, log = () => {} }) {
  const p = (R.photos || []).find((x) => String(x.id) === String(id)); if (!p) return { ok: false, neden: `fotoğraf yok: ${id}` };
  let buf = fs.existsSync(path.join(dir, p.file)) ? fs.readFileSync(path.join(dir, p.file)) : null; let W = 0; let H = 0; let url = p.url;
  if (buf) { const m = await sharp(buf).rotate().metadata(); W = m.width; H = m.height; }
  let n = 0;
  for (const u of buyukSurumler(p.url)) {
    if (!getir || n >= 3) break; n++;
    let r = null; try { r = await getir(u); } catch { r = null; }
    if (!r || !r.buf || !sniff(r.buf) || sniff(r.buf) === 'image/svg+xml') continue;
    let meta; try { meta = await sharp(r.buf, { limitInputPixels: 150e6 }).rotate().metadata(); } catch { continue; }
    if (meta.width >= W) { buf = r.buf; W = meta.width; H = meta.height; url = u; log(`   sahne ${id}: ${W}x${H}`); }
    if (W >= 2400) break;
  }
  if (!buf) return { ok: false, neden: 'fotoğraf okunamadı' };
  const out = path.join(dir, 'ust'); fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/^sahne-\d+\.webp$/.test(f)) fs.rmSync(path.join(out, f));
  if (W < 1920) { fs.writeFileSync(path.join(out, 'sahne.json'), JSON.stringify({ id: String(id), w: W, h: H, url, yok: `1920 px altinda (${W}); sahne yerine ince ayirici` }, null, 1)); return { ok: false, neden: `${W} px (en az 1920)` }; }
  const files = {};
  // 1920-2159 px kaynak: 2400 dosyasi yok; kaynagin kendi genisligi (buyutmeden) yazilir, boylece sahne tabani (1920 px) saglanir
  for (const [k, w, q] of [['2400', 2400, 76], ...(W < 2160 ? [[String(W), W, 76]] : []), ['1600', 1600, 76], ['1024', 1024, 72]]) {
    if (k === '2400' && W < 2160) continue;
    const o = await sharp(buf, { limitInputPixels: 150e6 }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer({ resolveWithObject: true });
    fs.writeFileSync(path.join(out, `sahne-${o.info.width}.webp`), o.data); files[k] = { file: `sahne-${o.info.width}.webp`, w: o.info.width, h: o.info.height };
  }
  fs.writeFileSync(path.join(out, 'sahne.json'), JSON.stringify({ id: String(id), w: W, h: H, url, files, at: new Date().toISOString() }, null, 1));
  return { ok: true, w: W, h: H };
}
