// NETLIK KAPISI (12 Kas 2026, KALICI kural: "flu goruntu olmasin hic"): kahramanda, yemek sahnesinde (kaydirinca ekrani dolduran) ve buyuk yuvalarda
// (menu paneli, galeri seridi, yemek kaydiricisi) hicbir fotograf yumusak ya da buyutulmus gorunmez.  Iki olcu, ikisi de gecmeli:
//   1. NETLIK: yerel Laplace varyansi.  Kare 64 px bloklara bolunur (analiz genisligi en cok 1600 px: ekranda goruntulenen olcege yakin), yalniz dokulu bloklar
//      (en kucuk-en buyuk parlaklik farki >= 24) sayilir; blok varyanslarinin 75. ve 90. yuzdeligi alinir.  p90 = karedeki EN KESKIN bolge (konu); sig alan derinlikli
//      (arka plani bilerek bulanik) bir yemek fotografinda da konu keskindir ve gecer, butunuyle odak disi bir kare p90'da da dusuk kalir.  Butun kareye bakan tek bir
//      varyans bokeh'li fotografi haksiz yere eler, yalniz ortaya bakan ise odak disi kenari kacirir.
//   2. COZUNURLUK TABANI: dosyanin pikseli, gosterildigi CSS boyutunun en az 1 kati (sahne ve kahraman icin ~2x: 1440 genislikte tam ekran = 1920+ px).  Daha kucuk
//      kaynak buyutulmus (bulanik) gorunur; telafisi kucuk yerlesimdir (cerceve duzeni, sahne yerine ince ayirici), buyutme degil.
// Esikler gercek isletme fotograflariyla ayarlandi (12 Kas): kendi cekimi keskin yemek ve mekan kareleri esigi gecer; odak disi (tum karesi yumusak) bir biftek karesi
// (p75 23, p90 98 @1600) ve yumusak hamburger / sandvic kareleri (p90 41-46) elenir; sig alan derinlikli salon karesi (p90 146) buyuk yuvada gecer.
// Model yok, ag yok; yalniz sharp.
import { sharp } from './gorsel.mjs';

export const ANALIZ_GENISLIK = 1600;
export const BLOK = 64;
export const DOKU_MIN = 24;
// seviyeler: siki = kahraman ve yemek sahnesi (tam ekran); buyuk = menu paneli, galeri seridi, kaydirici (yarim ekran ve buyuk yuvalar)
export const ESIK = { siki: { p75: 70, p90: 220 }, buyuk: { p75: 10, p90: 140 } };
// cozunurluk tabani (piksel): sahne ve kahraman tam genislikte gosterilir (1440 CSS px x ~1.33 = 1920: retina icin kahramanin 2400+ dosyasi secilir ama 1920 alt sinirdir)
export const TABAN = { sahne: { w: 1920 }, hero: { w: 1920 }, panel: { h: 1000 }, galeri: { w: 1280 }, kart: { w: 900 } };

// ham gri tampondan blok istatistigi
function blokIstatistik(g, gw, gh) {
  const v = [];
  for (let by = 0; by + BLOK <= gh; by += BLOK) {
    for (let bx = 0; bx + BLOK <= gw; bx += BLOK) {
      let lm = 0; let l2 = 0; let n = 0; let mn = 255; let mx = 0;
      for (let y = by + 1; y < by + BLOK - 1; y++) {
        for (let x = bx + 1; x < bx + BLOK - 1; x++) {
          const i = y * gw + x; const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - gw] - g[i + gw];
          lm += l; l2 += l * l; n++; if (g[i] < mn) mn = g[i]; if (g[i] > mx) mx = g[i];
        }
      }
      lm /= n; if (mx - mn >= DOKU_MIN) v.push(l2 / n - lm * lm);
    }
  }
  v.sort((a, b) => a - b);
  const p = (q) => (v.length ? v[Math.min(v.length - 1, Math.floor(v.length * q))] : 0);
  return { p75: Math.round(p(0.75)), p90: Math.round(p(0.9)), bloklar: v.length };
}

// -> { w, h, p75, p90, bloklar }; okunamayan dosya { hata }
export async function netlikOlc(buf) {
  try {
    const meta = await sharp(buf, { limitInputPixels: 200e6 }).rotate().metadata();
    const o = await sharp(buf, { limitInputPixels: 200e6 }).rotate().resize({ width: ANALIZ_GENISLIK, withoutEnlargement: true }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const s = blokIstatistik(o.data, o.info.width, o.info.height);
    const { width: w, height: h } = (() => { const q = meta.orientation && meta.orientation >= 5 ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height }; return q; })();
    return { w, h, ...s };
  } catch (e) { return { hata: String(e.message).slice(0, 80) }; }
}

export function netlikGecer(m, seviye = 'siki') {
  if (!m || m.hata) return { ok: false, neden: 'fotoğraf okunamadı' };
  const e = ESIK[seviye] || ESIK.siki;
  if (m.bloklar < 8) return { ok: false, neden: `dokusuz kare (${m.bloklar} dokulu blok): netlik ölçülemedi` };
  if (m.p90 < e.p90 || m.p75 < e.p75) return { ok: false, neden: `yumuşak görüntü (netlik p75 ${m.p75}, p90 ${m.p90}; en az ${e.p75} ve ${e.p90})` };
  return { ok: true };
}

// yuva: sahne | hero | panel | galeri | kart.  piksel: { w, h } -> { ok, neden }.  panel: dikey kutu; kaynak yuksekligi tabanin altindaysa "contain" (dogal boyutunda) onerilir
export function cozunurlukYeter(piksel, yuva) {
  const t = TABAN[yuva]; if (!t || !piksel) return { ok: true };
  if (t.w && piksel.w < t.w) return { ok: false, neden: `${piksel.w} px genişlik (${yuva} için en az ${t.w} px; büyütülmez)` };
  if (t.h && piksel.h < t.h) return { ok: false, contain: true, neden: `${piksel.h} px yükseklik (${yuva} panelinde tam kutu için en az ${t.h} px; doğal boyutunda gösterilir)` };
  return { ok: true };
}

// tek cagri: tampon + yuva -> { ok, neden[], olcu, contain }
//   panel: cozunurluk yetmezse contain ile (dogal boyutunda) gecer; netlik yine zorunludur
export async function fotoDenetle(buf, yuva, { px = null } = {}) {
  const m = await netlikOlc(buf);
  const seviye = yuva === 'sahne' || yuva === 'hero' ? 'siki' : 'buyuk';
  const n = netlikGecer(m, seviye); const neden = [];
  if (!n.ok) neden.push(n.neden);
  const c = cozunurlukYeter(px || (m.hata ? null : { w: m.w, h: m.h }), yuva);
  let contain = false;
  if (!c.ok) { if (c.contain) contain = true; else neden.push(c.neden); }
  return { ok: neden.length === 0, neden, olcu: m.hata ? null : { w: m.w, h: m.h, p75: m.p75, p90: m.p90 }, contain };
}
