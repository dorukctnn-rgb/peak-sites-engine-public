// SABLON SECICI (11 Kas 2026, v5 tasima): isletmenin turune gore sayfa sablonu.  Doruk'un onayladigi kalite citasi (memory/website-demo-quality-bar):
//   restoran ve bar         -> v5 (uc referans dilinden biri: mekan / sicak / sahil; uyarla/lib/dil-v5.mjs secer)
//   burger                  -> burger  (referans cravburgers.shop)
//   burrito, taco, Meksika  -> burrito (referans burritomadre.rs)
//   pizza                   -> pizza   (referans sebastiano.polyarix.space)
//   konaklama, guzellik ve diger sektor profilleri -> 'eski' (uyarla/uret.mjs + sektor/<ad>.mjs; DEGISMEZ)
//   pastane, firin, tatlici -> KANCA (12 Kas 2026, yeme-icme odagi): tespit calisir (shop=bakery|pastry|confectionery, cuisine, ad, metin) ama "pastane" sablonu
//                              birlesene kadar sablon v5 doner; sonuc 'kategori: pastane' ipucunu tasir.  Sablon birlesince YALNIZ KATEGORILER'e 'pastane' eklenir, baska kod gerekmez.
// Kanit sirasi: OSM cuisine etiketi > isletmenin adi > sitenin kendi metni (en cok gecen tur sozcugu).  Model yok.
//   Mevcut uc kategori (burger, burrito, pizza) HER ZAMAN kanca kategorilerinden once denenir: kanca eski kararlari degistirmez.
import { SEKTOR } from './sektor/index.mjs';

export const KATEGORILER = ['burger', 'burrito', 'pizza'];
// sablonu henuz olmayan kategoriler: tespit edilir, sablonSec v5'e dusurur ("pastane" sablonu ayri PR'da gelir)
export const KANCA_KATEGORILER = ['pastane'];
export const SABLONLAR = ['v5', ...KATEGORILER];

const CUISINE = [
  ['burger', /^(burger|burgers|hamburger|smash_burger)$/],
  ['burrito', /^(mexican|tex-mex|tex_mex|burrito|burritos|taco|tacos|taqueria|latin_american_mexican)$/],
  ['pizza', /^(pizza|pizzeria|italian_pizza|neapolitan_pizza|pizza_by_the_slice)$/],
];
const AD = [
  ['burger', /\bburgers?\b|\bsmash(?:ed)?\b.*\bburg/i],
  ['burrito', /\b(burritos?|tacos?|taqueria|tacoria|cantina|mexican|mexicana|tex-?mex|el\s+\w+\s+loco)\b/i],
  ['pizza', /\b(pizza|pizzas|pizzeria|pizzaria|pizzeta)\b/i],
];
const METIN = { burger: /\bburgers?\b/gi, burrito: /\b(burritos?|tacos?|quesadillas?|nachos)\b/gi, pizza: /\b(pizzas?|pizzeria|margherita|wood[- ]fired)\b/gi };

// KANCA kategorileri (pastane, firin, tatli): sablon yok, yalniz tespit.  Kanit: cuisine > OSM dukkan etiketi (lead.tur) > ad > metin
const KANCA_CUISINE = [['pastane', /^(bakery|bakeries|patisserie|pastry|pastries|cake|cakes|cake_shop|confectionery|dessert|desserts|donut|donuts|doughnut|doughnuts|baklava|pastane|sweets)$/]];
const KANCA_TUR = [['pastane', /^(bakery|pastry shop|confectionery)$/]]; // lead/sektorler.mjs restoran.tur: shop=bakery | pastry | confectionery
const KANCA_AD = [['pastane', /(?<!\p{L})(?:pastane\p{L}*|p[âa]tisserie|bakery|bakehouse|boulangerie|cakery|cake ?shop|cupcakes?|tatl[ıi]c[ıi]\p{L}*|baklava\p{L}*)(?!\p{L})/iu]];
const KANCA_METIN = { pastane: /(?<!\p{L})(?:cakes?|pastr(?:y|ies)|croissants?|p[âa]tisserie|cupcakes?|[ée]clairs?|macarons?|baklava|brownies?|doughnuts?|donuts?|sourdough|pastane\p{L}*|kurabiye\p{L}*|po[ğg]a[çc]a\p{L}*)(?!\p{L})/giu };

// cuisine: OSM "cuisine" etiketi ("burger;american"); ad: isletme adi; metin: sitenin kendi metni (istege bagli); tur: lead.tur (OSM dukkan/amenity turu: "bakery", "cafe" ...)
export function kategoriOf({ cuisine = '', ad = '', metin = '', tur = '' } = {}) {
  const toks = String(cuisine || '').toLowerCase().split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  for (const t of toks) for (const [k, re] of CUISINE) if (re.test(t)) return { kategori: k, neden: `OSM cuisine=${t}` };
  for (const [k, re] of AD) { const m = re.exec(String(ad || '')); if (m) return { kategori: k, neden: `adinda "${m[0]}"` }; }
  const say = metin ? Object.fromEntries(Object.entries(METIN).map(([k, re]) => [k, (String(metin).match(re) || []).length])) : null;
  if (say) {
    const [k, n] = Object.entries(say).sort((a, b) => b[1] - a[1])[0];
    const ikinci = Object.values(say).sort((a, b) => b - a)[1] || 0;
    // metinden karar yalniz acik ustunlukle: en az 6 kez ve ikincinin iki katindan fazla (bir pizzacinin menusundeki tek burger onu burgerci yapmaz)
    if (n >= 6 && n > ikinci * 2) return { kategori: k, neden: `sitenin metninde ${n} kez (${Object.entries(say).map(([a, b]) => `${a} ${b}`).join(', ')})` };
  }
  // kanca kategorileri (pastane): mevcut uc kategori tutmadiysa
  for (const t of toks) for (const [k, re] of KANCA_CUISINE) if (re.test(t)) return { kategori: k, neden: `OSM cuisine=${t}` };
  const turS = String(tur || '').toLowerCase().trim();
  for (const [k, re] of KANCA_TUR) if (re.test(turS)) return { kategori: k, neden: `OSM dukkan turu=${turS}` };
  for (const [k, re] of KANCA_AD) { const m = re.exec(String(ad || '')); if (m) return { kategori: k, neden: `adinda "${m[0]}"` }; }
  if (say) {
    const enCok = Math.max(0, ...Object.values(say));
    for (const [k, re] of Object.entries(KANCA_METIN)) { const n = (String(metin).match(re) || []).length; if (n >= 6 && n > enCok * 2) return { kategori: k, neden: `sitenin metninde ${n} kez (${k} ${n})` }; }
  }
  return { kategori: null, neden: 'kategori ipucu yok' };
}

// lead: lead/tara ciktisi ya da cikarici lead'i; R: cikarici.json (varsa, metin ipucu icin)
// hazir: sablonu BIRLESMIS kategoriler (varsayilan KATEGORILER); kanca kategorisi bu listede degilse v5'e duser ve 'kategori' ipucunu tasir
export function sablonSec(lead = {}, R = null, hazir = KATEGORILER) {
  const sektor = lead.sektor || 'restoran';
  if (sektor !== 'restoran' && SEKTOR[sektor]) return { sablon: 'eski', neden: `sektor profili: ${sektor} (eski yol, degismez)` };
  if (sektor !== 'restoran') return { sablon: 'eski', neden: `restoran disi sektor: ${sektor}` };
  const metin = R ? [R.tagline, R.name && R.name.n, ...(((R.ek && R.ek.paragraflar) || []).slice(0, 6)), ...((R.menu && R.menu.items) || []).map((x) => `${x.n} ${x.cat || ''}`)].filter(Boolean).join(' \n ') : '';
  const k = kategoriOf({ cuisine: lead.mutfak || lead.cuisine || '', ad: lead.name || (R && R.name && R.name.n) || '', metin, tur: lead.kind || lead.tur || '' });
  if (k.kategori && hazir.includes(k.kategori)) return { sablon: k.kategori, neden: k.neden };
  if (k.kategori) return { sablon: 'v5', kategori: k.kategori, neden: `${k.neden}; "${k.kategori}" sablonu henuz birlesmedi, v5'e dusuyor (dil-v5 referans dilini secer)` };
  return { sablon: 'v5', neden: `restoran/bar (${k.neden}); dil-v5 referans dilini secer` };
}
