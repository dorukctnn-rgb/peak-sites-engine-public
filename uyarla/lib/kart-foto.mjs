// KART FOTOGRAFI (11 Kas, pizza-foto): kaydiricidaki her urun kartina YALNIZ o urunun kendi fotografi.  Kaynak isletmenin KENDI web sitesi
// (cikarici.json photos: site sayfalari, urun sayfalari); siparis sitesi gorselleri ve genel "firinimizdan" yedek kareleri KULLANILMAZ.
// Eslesme dosya adindan, alt metninden ya da basliktan yapilir; adin butun sozcukleri yan yana gecmeli ve geriye yalniz genel sozcukler
// (pizza, scaled, 1024x683, isletme adi...) kalmali.  "Pizza Bread" karti "PizzaPomodoroMenu_Social Media-11.jpg" ile, "Il Birrificio" karti
// "Contact-IL-Birrificio-Italian-Restaurant-Camberwell.jpg" ile ESLESMEZ.  Eslesme yoksa kart oldugu gibi kalir.  Sonra goz (son goz / koordinator) dogrular;
// elle karar: slider.foto { "<kart adi>": "<id>" | { id, kirp, odak, alt, kaynak } | null (bu kart fotografsiz kalsin) }.
// Ag yok, model yok.
//   kartFotoBul(photos, ad, { isletme, haric, kullanilan }) -> { id, alan, metin } | null
//   kartFotoPlan(slider, photos, { isletme, haric })        -> [{ ad, id|null, kaynak, oto, bastirildi, aday, kirp, odak, alt }]
//   kartKirp({ width, height }, { kirp, odak }, ph)          -> { left, top, width, height }  (ORAN en/boy, buyutme yok)

export const ORAN = 5 / 4; // kart fotografi kutusu (site.css .slide-f aspect-ratio ile ayni)
export const EN_AZ = { w: 600, h: 480 }; // kendiliginden eslesmede en kucuk kare (kart 2x icin; buyutme yok)

const sade = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// basit kok: cogul / iyelik "s" ve son unlu atilir (daniele / daniels -> daniel, pizza / pizze -> pizz)
const kok = (t) => (t.length > 3 ? t.replace(/s$/, '').replace(/[aeio]$/, '') : t);
const parca = (s) => sade(s).replace(/\([^)]*\)/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
// adin kendisinden atilanlar (tur ve diyet etiketleri); "e", "di", "al" gibi baglaclar adda KALIR ("Polpette e Pecorino")
const AD_ATLA = new Set(['pizza', 'pizze', 'pizzas', 'pie', 'the', 'v', 'vg', 'vgo', 'gf', 'gfo', 'w'].map(kok));
// adin disinda kalabilecek genel sozcukler
const GENEL = new Set([...AD_ATLA, ...['pizzeria', 'our', 'img', 'image', 'photo', 'foto', 'pic', 'scaled', 'copy', 'final', 'edit', 'edited', 'new', 'web', 'hd', 'large', 'small', 'big', 'sm', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'gif', 'e', 'de', 'di', 'al'].map(kok)]);
const DOLGU = (t) => /^\d+$/.test(t) || /^\d+x\d+$/.test(t);
const YER_TUTUCU = /placeholder|woocommerce-placeholder|no-?image|default-?image/i;

// urlnin son parcasi (uzanti ve WordPress boyut ekleri kalir; GENEL/DOLGU zaten eler)
export const dosyaAdi = (u) => { try { return decodeURIComponent(new URL(u).pathname.split('/').filter(Boolean).pop() || ''); } catch { return String(u || '').split(/[?#]/)[0].split('/').pop() || ''; } };

// metin (dosya adi / alt / baslik) bu adi tasiyor mu?  ad sozcukleri yan yana + geri kalan yalniz genel
export function adTasir(metin, ad, isletme = '') {
  const adT = parca(ad).map(kok).filter((t) => !AD_ATLA.has(t)); if (!adT.length) return false;
  const T = parca(metin).map(kok); const isl = new Set(parca(isletme).map(kok));
  for (let i = 0; i + adT.length <= T.length; i++) {
    if (!adT.every((t, j) => T[i + j] === t)) continue;
    const kalan = [...T.slice(0, i), ...T.slice(i + adT.length)];
    if (kalan.every((t) => GENEL.has(t) || DOLGU(t) || isl.has(t))) return true;
  }
  return false;
}

const uygun = (p, haric) => p && p.file && !haric.has(String(p.id)) && !YER_TUTUCU.test(p.url || '') && !(p.stok || p.uretilmis || p.afis || p.duz || p.logo) && !/logo/i.test(p.cls || '');

export function kartFotoBul(photos, ad, { isletme = '', haric = [], kullanilan = new Set() } = {}) {
  const H = new Set((haric || []).map(String)); const adaylar = [];
  for (const p of photos || []) {
    if (!uygun(p, H) || kullanilan.has(String(p.id))) continue;
    if ((p.w || 0) < EN_AZ.w || (p.h || 0) < EN_AZ.h) continue;
    for (const [alan, metin, puan] of [['dosya adi', dosyaAdi(p.url), 3], ['alt', p.alt, 2], ['baslik', p.title, 1]]) {
      if (metin && adTasir(metin, ad, isletme)) { adaylar.push({ id: String(p.id), alan, metin: String(metin).slice(0, 120), puan, alanPx: (p.w || 0) * (p.h || 0) }); break; }
    }
  }
  adaylar.sort((a, b) => b.puan - a.puan || b.alanPx - a.alanPx);
  return adaylar[0] ? { id: adaylar[0].id, alan: adaylar[0].alan, metin: adaylar[0].metin } : null;
}

export function kartFotoPlan(slider, photos, { isletme = '', haric = [] } = {}) {
  if (!slider || !Array.isArray(slider.secim)) return [];
  const elle = slider.foto || {}; const kullanilan = new Set(); const plan = [];
  // once elle kararlar (goz dogrulamasi), sonra kendiliginden eslesme; bir kare iki kartta kullanilmaz
  for (const ad of slider.secim) { const v = elle[ad]; if (v && (typeof v === 'string' || v.id)) kullanilan.add(String(typeof v === 'string' ? v : v.id)); }
  for (const ad of slider.secim) {
    const aday = kartFotoBul(photos, ad, { isletme, haric, kullanilan: new Set() });
    if (Object.prototype.hasOwnProperty.call(elle, ad)) {
      const v = elle[ad];
      if (v === null || v === false) { plan.push({ ad, id: null, kaynak: 'elle: fotografsiz', oto: false, bastirildi: true, aday }); continue; }
      const o = typeof v === 'string' ? { id: v } : v; const id = String(o.id);
      const ph = (photos || []).find((p) => String(p.id) === id);
      plan.push({ ad, id: ph ? id : null, kaynak: ph ? (o.kaynak || `elle: kare ${id}`) : `elle: kare ${id} yok`, oto: false, bastirildi: false, aday, kirp: o.kirp || null, odak: o.odak || null, alt: o.alt || '' });
      continue;
    }
    const k = kartFotoBul(photos, ad, { isletme, haric, kullanilan });
    if (k) kullanilan.add(k.id);
    plan.push({ ad, id: k ? k.id : null, kaynak: k ? `${k.alan}: ${k.metin}` : 'kendi sitesinde bu urunun adini tasiyan fotograf yok', oto: !!k, bastirildi: false, aday });
  }
  return plan;
}

// ORAN kutusu: elle kirpma ya da odak noktasi cevresindeki en buyuk kutu (kaynagin icinde kalir)
export function kartKirp(md, { kirp = null, odak = null } = {}, ph = {}) {
  const W = md.width, H = md.height;
  if (kirp) { const left = Math.max(0, Math.round(kirp.left)), top = Math.max(0, Math.round(kirp.top)); return { left, top, width: Math.min(Math.round(kirp.width), W - left), height: Math.min(Math.round(kirp.height), H - top) }; }
  const fx = (odak && odak.x) ?? (ph.focus && ph.focus.x) ?? 0.5, fy = (odak && odak.y) ?? (ph.focus && ph.focus.y) ?? 0.5;
  let w = W, h = Math.round(W / ORAN); if (h > H) { h = H; w = Math.round(H * ORAN); }
  const sinir = (v, a, b) => Math.max(a, Math.min(b, v));
  return { left: sinir(Math.round(fx * W - w / 2), 0, W - w), top: sinir(Math.round(fy * H - h / 2), 0, H - h), width: w, height: h };
}

// beyaz zeminli urun fotografi mi?  Kirpilmis karenin kucuk ham kopyasinda (RGB) dort kosedeki kucuk karelerin acikligi ve doygunlugu:
// yuvarlak pizzada zemin kosede gorunur (kenara degen kabuk ya da bardak tek koseyi bozar).  En az 3 kose acik ve doygunlugu dusukse acik zemin.
// Kaydiricidaki fotografli kartlarin cogu acik zeminliyse sablon kartlara acik kart zemini verir (fotograf degismez).
export function kenarAcik(data, w, h, ch = 3, k = 5) {
  const koseler = [[0, 0], [w - k, 0], [0, h - k], [w - k, h - k]].map(([x0, y0]) => {
    let L = 0, S = 0, n = 0;
    for (let y = y0; y < y0 + k; y++) for (let x = x0; x < x0 + k; x++) { const i = (y * w + x) * ch; const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); L += (mx + mn) / 2; S += mx - mn; n++; }
    return { L: L / n, S: S / n };
  });
  const acikKose = koseler.filter((c) => c.L > 0.8 && c.S < 0.16).length;
  const ort = (a) => +(koseler.reduce((t, c) => t + c[a], 0) / 4).toFixed(3);
  return { L: ort('L'), S: ort('S'), acikKose, acik: acikKose >= 3 };
}
