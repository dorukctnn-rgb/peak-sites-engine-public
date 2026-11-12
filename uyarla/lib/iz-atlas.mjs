// IZ ATLASI (pastane, 12 Kas 2026): imlec izindeki urunler ISLETMENIN KENDI urunleridir.  Sablonun ortak 3D atlasi yerine her sayfaya kendi atlasi yazilir.
//   Kaynak 1 (elle, en iyisi): R.kesme -> isletmenin kendi urun fotografindan kesilmis tek urun (saydam PNG; kesme tezgahi, GrabCut).  E.iz { zincir: [kesme id], parcalar: [...] }
//   Kaynak 2 (kendiliginden, bulut): foto uyum kapisindan gecen KENDI urun karelerinin ortasindan yuvarlak kesit (tabak gibi), kenari yumusak.  Stok kare kullanilmaz.
//   Hicbiri yoksa iz yok (bos ya da rastgele urun cizilmez).
// Atlas: satir = urun, sutun = Y ekseninde donus karesi (on yuz -> kenar -> arka yuz aynalanmis ve hafif golgeli).  Hucre 160 px (2x ekranda 80 css px'e kadar keskin).
// Model yok, ag yok; yalniz sharp.
import { sharp } from './gorsel.mjs';

export const IZ_HUCRE = 160;
export const IZ_KARE = 12;

// tek urun kesiti -> hucre boyunda saydam kare (urun hucrenin %88'ine sigar, buyutme yok sayilmaz: kaynak kesit hucreden buyukse kucultulur)
async function hucreye(buf, cell) {
  const k = await sharp(buf).ensureAlpha().trim({ threshold: 1 }).toBuffer({ resolveWithObject: true }).catch(async () => sharp(buf).ensureAlpha().toBuffer({ resolveWithObject: true }));
  const { width: w, height: h } = k.info; const s = (cell * 0.88) / Math.max(w, h);
  const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
  const kucuk = await sharp(k.data).resize(tw, th, { kernel: 'lanczos3' }).png().toBuffer();
  return { buf: kucuk, w: tw, h: th, kaynakW: w, kaynakH: h };
}

// yuvarlak kesit (kendiliginden): karenin odak noktasi cevresinde en buyuk kare, ortadaki daire, 3 px yumusak kenar
export async function yuvarlakKesit(buf, { odak = { x: 0.5, y: 0.5 }, oran = 0.82 } = {}) {
  const md = await sharp(buf).metadata(); const W = md.width, H = md.height;
  const s = Math.round(Math.min(W, H) * oran); const left = Math.max(0, Math.min(W - s, Math.round(odak.x * W - s / 2))); const top = Math.max(0, Math.min(H - s, Math.round(odak.y * H - s / 2)));
  const out = Math.min(640, s);
  const kare = await sharp(buf).extract({ left, top, width: s, height: s }).resize(out, out).toBuffer();
  const r = out / 2; const maske = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${out}" height="${out}"><defs><filter id="b"><feGaussianBlur stdDeviation="1.6"/></filter></defs><circle cx="${r}" cy="${r}" r="${r - 4}" fill="#fff" filter="url(#b)"/></svg>`);
  return sharp(kare).ensureAlpha().composite([{ input: maske, blend: 'dest-in' }]).png().toBuffer();
}

// N kare Y donusu: genislik |cos|, arka yuz aynali ve %22 koyu; kenar karesi bile en az %10 genislik (kaybolmaz)
export async function donusKareleri(urun, cell = IZ_HUCRE, N = IZ_KARE) {
  const kareler = [];
  for (let f = 0; f < N; f++) {
    const a = (f / N) * Math.PI * 2; const c = Math.cos(a); const sx = Math.max(0.1, Math.abs(c));
    const w = Math.max(1, Math.round(urun.w * sx));
    let img = sharp(urun.buf).resize(w, urun.h, { fit: 'fill', kernel: 'lanczos3' });
    if (c < 0) img = img.flop().modulate({ brightness: 0.78 });
    else if (sx < 0.98) img = img.modulate({ brightness: 0.9 + 0.1 * sx });
    kareler.push({ input: await img.png().toBuffer(), left: f * cell + Math.round((cell - w) / 2), top: Math.round((cell - urun.h) / 2) });
  }
  return kareler;
}

// liste: [{ ad, buf }] -> { webp, cell, frames, names, w, h }
export async function izAtlas(liste, { cell = IZ_HUCRE, frames = IZ_KARE, kalite = 82 } = {}) {
  const comp = []; const names = [];
  for (let r = 0; r < liste.length; r++) {
    const u = await hucreye(liste[r].buf, cell);
    for (const k of await donusKareleri(u, cell, frames)) comp.push({ ...k, top: k.top + r * cell });
    names.push(liste[r].ad);
  }
  const W = cell * frames, H = cell * Math.max(1, liste.length);
  const webp = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comp).webp({ quality: kalite, alphaQuality: 90, effort: 5 }).toBuffer();
  return { webp, cell, frames, names, w: W, h: H };
}

// hangi urunler?  E.iz (elle) > R.kesme (hepsi) > kendiliginden yuvarlak kesit (uyum sirasindaki kendi yemek kareleri, en cok 6)
// Elle secimden ikiden az kesme bulunursa (or. bulutta kesme yok) bir sonraki kaynaga gecilir: iz sessizce kapanmaz.
export function izPlan(E = {}, R = {}, uyum = null) {
  const kes = (R && R.kesme) || [];
  const el = (E && E.iz) || null;
  if (el && Array.isArray(el.parcalar || el.zincir)) {
    const ids = [...new Set([...(el.zincir || []), ...(el.parcalar || [])].map(String))];
    const liste = ids.map((id) => kes.find((k) => k.id === id)).filter(Boolean).map((k) => ({ id: k.id, ad: k.ad, file: k.file, kaynak: `kesme ${k.id} (kare ${k.kaynakFoto})` }));
    if (liste.length >= 2) return { yontem: 'elle', liste, zincir: (el.zincir || []).map(String).filter((id) => liste.some((x) => x.id === id)), parcalar: (el.parcalar || el.zincir || []).map(String).filter((id) => liste.some((x) => x.id === id)) };
  }
  if (kes.length) { const liste = kes.slice(0, 8).map((k) => ({ id: k.id, ad: k.ad, file: k.file, kaynak: `kesme ${k.id} (kare ${k.kaynakFoto})` })); return { yontem: 'kesme', liste, zincir: liste.slice(0, 5).map((x) => x.id), parcalar: liste.map((x) => x.id) }; }
  if (uyum) {
    const kendi = (uyum.uygun || []).filter((u) => u.kaynak === 'kendi' && u.konu === 'yemek').slice(0, 6);
    const liste = kendi.map((u) => ({ id: `y${u.id}`, foto: u.id, ad: `kare ${u.id}`, yuvarlak: true, kaynak: `kare ${u.id} (yuvarlak kesit)` }));
    return { yontem: 'yuvarlak', liste, zincir: liste.slice(0, 5).map((x) => x.id), parcalar: liste.map((x) => x.id) };
  }
  return { yontem: 'yok', liste: [], zincir: [], parcalar: [] };
}
