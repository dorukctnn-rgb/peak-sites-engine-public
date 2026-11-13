// SABLON SECICI (11 Kas 2026, v5 tasima): isletmenin turune gore sayfa sablonu.  Doruk'un onayladigi kalite citasi (memory/website-demo-quality-bar):
//   restoran ve bar         -> v5 (uc referans dilinden biri: mekan / sicak / sahil; uyarla/lib/dil-v5.mjs secer)
//   burger                  -> burger  (referans cravburgers.shop)
//   burrito, taco, Meksika  -> burrito (referans burritomadre.rs)
//   pizza                   -> pizza   (referans sebastiano.polyarix.space)
//   konaklama, guzellik ve diger sektor profilleri -> 'eski' (uyarla/uret.mjs + sektor/<ad>.mjs; DEGISMEZ)
//   pastane, firin, tatlici -> pastane (12 Kas 2026): imleci isletmenin kendi urunlerinin izledigi kategori sablonu (sablon-pastane, ozel depoda).  Tespit kanca
//                              kurallariyla (shop=bakery|pastry|confectionery, cuisine, ad, metin) ve HER ZAMAN eski uc kategoriden sonra.
//   sokak lezzeti -> sokak (12 Kas 2026, yonetici karari "her isletmeye tek demo, stil turune gore"): doner, kebap, durum, pide ve lahmacun, tost, kumpir, tavuk,
//                              kokorec, cig kofte, shawarma, gyros, falafel.  Burger sablonunun AYNI kodu (sablon-burger) + ek katman (sablon-sokak): imlec izi
//                              isletmenin kendi urunleri, durunca tepside dizilir; renk ve font isletmenin kendi markasi.  Desenler lead/sektorler.mjs (SOKAK_*).
//                              Oturmali isaret (adinda restoran, ocakbasi, meyhane, balik ...; ya da OSM amenity=restaurant ve adinda sokak sozcugu yok) v5'te kalir.
//   Yeni bir kanca kategorisi (sablonu henuz yok) KANCA_KATEGORILER'e eklenir: tespit edilir, sablon v5'e duser ve 'kategori' ipucunu tasir.
// Kanit sirasi: OSM cuisine etiketi > isletmenin adi > sitenin kendi metni (en cok gecen tur sozcugu).  Model yok.
//   Mevcut uc kategori (burger, burrito, pizza) HER ZAMAN kanca kategorilerinden once denenir: kanca eski kararlari degistirmez.
import { SEKTOR } from './sektor/index.mjs';
import { SOKAK_MUTFAK, SOKAK_AD, OTURMALI_AD, SOKAK_METIN } from '../lead/sektorler.mjs';

export const KATEGORILER = ['burger', 'burrito', 'pizza', 'pastane', 'sokak'];
// sablonu henuz olmayan kategoriler: tespit edilir, sablonSec v5'e dusurur (pastane 12 Kas'ta sablonuyla KATEGORILER'e gecti)
export const KANCA_KATEGORILER = [];
export const SABLONLAR = ['v5', ...KATEGORILER];
// HAT ONCELIGI (12 Kas 2026, Doruk: "pizzacı ve hamburgercilere çok ağırlık ver, o şablonlar çok iyi!" ve "en çok hamburger web sitesi hoşuma gidiyor"):
//   burger EN ONDE; sonra oteki sokak lezzetleri (sokak, burrito/taco) ve pizza; sonra digerleri (v5, pastane)
export const ONCELIK = { burger: 0, pizza: 1, sokak: 1, burrito: 1 };
export const oncelik = (kategori) => ONCELIK[kategori] ?? 2;

const CUISINE = [
  ['burger', /^(burger|burgers|hamburger|smash_burger)$/],
  ['burrito', /^(mexican|tex-mex|tex_mex|burrito|burritos|taco|tacos|taqueria|latin_american_mexican)$/],
  ['pizza', /^(pizza|pizzeria|italian_pizza|neapolitan_pizza|pizza_by_the_slice)$/],
];
// 12 Kas 2026 (pizza ve burger onceligi): Turkce ekler ve bitisik yazim da yakalanir (Hamburger Evi, Burgerci, Pizzacı, Pizzetta); "Burgerfuel" gibi bitisik ad degil
const AD = [
  ['burger', /(?<!\p{L})(?:ham|cheese|smash(?:ed)?\s*)?burger(?:s|c[ıi]\p{L}*|lar\p{L}*|house)?(?!\p{L})|\bsmash(?:ed)?\b.*\bburg/iu],
  ['burrito', /\b(burritos?|tacos?|taqueria|tacoria|cantina|mexican|mexicana|tex-?mex|el\s+\w+\s+loco)\b/i],
  ['pizza', /(?<!\p{L})(?:pizza|pizzas|pizzeria|pizzaria|pizzeta|pizzetta|pizzac[ıi]\p{L}*|pizzalar\p{L}*|pizzaevi)(?!\p{L})/iu],
];
const METIN = { burger: /\bburgers?\b/gi, burrito: /\b(burritos?|tacos?|quesadillas?|nachos)\b/gi, pizza: /\b(pizzas?|pizzeria|margherita|wood[- ]fired)\b/gi };

// pastane, firin, tatli tespiti (eski uc kategoriden SONRA).  Kanit: cuisine > OSM dukkan etiketi (lead.tur) > ad > metin
const KANCA_CUISINE = [['pastane', /^(bakery|bakeries|patisserie|pastry|pastries|cake|cakes|cake_shop|confectionery|dessert|desserts|donut|donuts|doughnut|doughnuts|baklava|pastane|sweets)$/]];
const KANCA_TUR = [['pastane', /^(bakery|pastry shop|confectionery)$/]]; // lead/sektorler.mjs restoran.tur: shop=bakery | pastry | confectionery
const KANCA_AD = [['pastane', /(?<!\p{L})(?:pastane\p{L}*|p[âa]tisserie|bakery|bakehouse|boulangerie|cakery|cake ?shop|cupcakes?|tatl[ıi]c[ıi]\p{L}*|baklava\p{L}*)(?!\p{L})/iu]];
const KANCA_METIN = { pastane: /(?<!\p{L})(?:cakes?|pastr(?:y|ies)|croissants?|p[âa]tisserie|cupcakes?|[ée]clairs?|macarons?|baklava|brownies?|doughnuts?|donuts?|sourdough|pastane\p{L}*|kurabiye\p{L}*|po[ğg]a[çc]a\p{L}*)(?!\p{L})/giu };

// sokak lezzeti uygun mu: adinda oturmali isareti yok; OSM amenity=restaurant (oturmali restoran) ise adinda sokak sozcugu olmali
export function sokakUygun({ ad = '', amenity = '' } = {}) {
  const a = String(ad || '');
  if (OTURMALI_AD.test(a)) return false;
  return String(amenity || '').toLowerCase() !== 'restaurant' || SOKAK_AD.test(a);
}

// cuisine: OSM "cuisine" etiketi ("burger;american"); ad: isletme adi; metin: sitenin kendi metni (istege bagli); tur: lead.tur (OSM dukkan/amenity turu: "bakery", "cafe" ...)
// amenity: OSM amenity etiketi (fast_food | restaurant | ...): yalniz sokak lezzeti ile oturmali restoran ayriminda kullanilir
export function kategoriOf({ cuisine = '', ad = '', metin = '', tur = '', amenity = '' } = {}) {
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
  // sokak lezzeti ve pastane: mevcut uc kategori tutmadiysa.  Sokak yalniz oturmali degilse (sokakUygun); oturmali kebapci v5'te kalir (ipucu nedende).
  const sokakOk = sokakUygun({ ad, amenity }); let oturmali = null;
  for (const t of toks) {
    if (SOKAK_MUTFAK.test(t)) { if (sokakOk) return { kategori: 'sokak', neden: `OSM cuisine=${t}` }; oturmali = oturmali || `OSM cuisine=${t} ama oturmali (ad ya da amenity=restaurant)`; }
    for (const [k, re] of KANCA_CUISINE) if (re.test(t)) return { kategori: k, neden: `OSM cuisine=${t}` };
  }
  const turS = String(tur || '').toLowerCase().trim();
  for (const [k, re] of KANCA_TUR) if (re.test(turS)) return { kategori: k, neden: `OSM dukkan turu=${turS}` };
  const sm = SOKAK_AD.exec(String(ad || ''));
  if (sm) { if (sokakOk) return { kategori: 'sokak', neden: `adinda "${sm[0]}"` }; oturmali = oturmali || `adinda "${sm[0]}" ama oturmali`; }
  if (turS === 'kebab house' && sokakOk) return { kategori: 'sokak', neden: 'OSM turu=kebab house' };
  for (const [k, re] of KANCA_AD) { const m = re.exec(String(ad || '')); if (m) return { kategori: k, neden: `adinda "${m[0]}"` }; }
  if (say) {
    const enCok = Math.max(0, ...Object.values(say));
    const kanca = [['sokak', SOKAK_METIN], ...Object.entries(KANCA_METIN)].map(([k, re]) => [k, (String(metin).match(new RegExp(re.source, re.flags)) || []).length]).sort((a, b) => b[1] - a[1]);
    const [k, n] = kanca[0]; const ikinci = Math.max(enCok, (kanca[1] || [])[1] || 0);
    if (n >= 6 && n > ikinci * 2 && (k !== 'sokak' || sokakOk)) return { kategori: k, neden: `sitenin metninde ${n} kez (${kanca.map(([a, b]) => `${a} ${b}`).join(', ')})` };
  }
  return { kategori: null, neden: oturmali ? `${oturmali}: v5` : 'kategori ipucu yok' };
}

// lead: lead/tara ciktisi ya da cikarici lead'i; R: cikarici.json (varsa, metin ipucu icin)
// hazir: sablonu BIRLESMIS kategoriler (varsayilan KATEGORILER); kanca kategorisi bu listede degilse v5'e duser ve 'kategori' ipucunu tasir
export function sablonSec(lead = {}, R = null, hazir = KATEGORILER) {
  const sektor = lead.sektor || 'restoran';
  if (sektor !== 'restoran' && SEKTOR[sektor]) return { sablon: 'eski', neden: `sektor profili: ${sektor} (eski yol, degismez)` };
  if (sektor !== 'restoran') return { sablon: 'eski', neden: `restoran disi sektor: ${sektor}` };
  const metin = R ? [R.tagline, R.name && R.name.n, ...(((R.ek && R.ek.paragraflar) || []).slice(0, 6)), ...((R.menu && R.menu.items) || []).map((x) => `${x.n} ${x.cat || ''}`)].filter(Boolean).join(' \n ') : '';
  const k = kategoriOf({ cuisine: lead.mutfak || lead.cuisine || '', ad: lead.name || (R && R.name && R.name.n) || '', metin, tur: lead.kind || lead.tur || '', amenity: lead.amenity || '' });
  if (k.kategori && hazir.includes(k.kategori)) return { sablon: k.kategori, neden: k.neden };
  if (k.kategori) return { sablon: 'v5', kategori: k.kategori, neden: `${k.neden}; "${k.kategori}" sablonu henuz birlesmedi, v5'e dusuyor (dil-v5 referans dilini secer)` };
  return { sablon: 'v5', neden: `restoran/bar (${k.neden}); dil-v5 referans dilini secer` };
}
