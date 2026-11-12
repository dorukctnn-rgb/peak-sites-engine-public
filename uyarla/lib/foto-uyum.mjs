// FOTO UYUMU KAPISI (12 Kas 2026, yonetici kurali, kalici): "fotolari iyi sec, en iyilerini koy her zaman", "rastgele foto koyma", "uyumlu olacak!".
// Demo sayfadaki her fotograf o isletmeye ve menusune uymali.  Sira:
//   1. isletmenin KENDI fotograflari (sitesi, menusu); logo, harita ekran goruntusu, ekran goruntusu, ikon, cok kucuk, bulanik, grafik, afis ve uretilmis gorsel elenir;
//   2. yetmezse TURE UYAN stok: stok karenin etiketi / alt metni / dosya adi isletmenin turuyle (burgerciye burger, pastaneye pasta ya da tatli, bara icki ya da bar ortami,
//      pizzaciya pizza) ya da menusundeki bir yemekle eslesmeli; eslesme yoksa, konu disiysa ya da baska turun yemegini gosteriyorsa KULLANILMAZ;
//   3. en iyi kare one konur (cozunurluk, en-boy orani, keskinlik, pozlama, konu: yemek ya da mekan), kendi kareleri her zaman stoktan once;
//   4. uyan kare yoksa yuva rastgele DOLDURULMAZ: uretici yuvayi daraltir (sablon bolumu gizler) ve uyari son goze gider; icerik karari uymayan kare secerse denetim HATA verir.
// Motorda stok kutuphanesi yok: "stok" su an isletmenin kendi sitesinde bulunan stok isaretli karelerdir (foto-topla isaretler).  Ayni kural ileride bir stok kaynagi
// eklenirse onun etiketlerine de uygulanir (fotoUyum stok parametresi).  Model yok, ag yok; saf islevler.
import { kesinStok, kesinUretilmis, kesinAfis, kanonikAnahtar } from './foto-topla.mjs';

// Esikler onayli alti demoyla (11 Kas, yonetici "demolar harika": uc v5, birer burger, burrito ve pizza) ayarlandi: bu demolarda sayfaya giren hicbir kare
// kapida elenmez; pizza demosunda gozle disarida birakilan logo (470x470) ve kucuk kare (500x512) kapida da elenir.
//   bolum yuvasi: en az 800 px genis ve 400 px yuksek (burrito demosunun 1920x485 ziyaret seridi gecer); urun karti ve alt sinir: 600x400 (foto-topla "kucuk" siniri)
export const EN_AZ = { w: 800, h: 400 };
export const EN_AZ_KART = { w: 600, h: 400 };
// lapVar (600 px genislikte Laplace varyansi): foto-topla 18 altini zaten atar; 25 alti bulanik.  Onayli demolarda en dusuk 28 (pizza demosunda hamur adimi, dik kare)
// ve 56 (bir v5 demosunun karti) sayfada.  150 alti yumusak: elenmez, siralamada geriye duser.
export const BULANIK = 25;
export const YUMUSAK = 150;

// Turkce harfler dahil sadelestirme: kucuk harf, aksansiz, harf ve rakam disi bosluk
export const sade = (s) => String(s ?? '').replace(/[ıİ]/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const re = (liste, bayrak = 'g') => new RegExp(`(?<![a-z])(?:${liste.join('|')})(?![a-z])`, bayrak);

// ---- isletme turleri ve konu sozcukleri (sade metin uzerinde) ----
export const TURLER = ['burger', 'pizza', 'burrito', 'pastane', 'dondurma', 'kafe', 'bar', 'kebap', 'restoran'];
const KELIME = {
  burger: ['burgers?', 'cheeseburgers?', 'hamburgers?', 'smash(?:ed)? burgers?', 'patty', 'patties', 'fries', 'milkshakes?', 'onion rings?', 'sliders?'],
  pizza: ['pizzas?', 'pizzeria', 'margherita', 'pepperoni', 'calzones?', 'wood ?fired', 'neapolitan', 'mozzarella', 'pizza oven'],
  burrito: ['burritos?', 'tacos?', 'quesadillas?', 'nachos', 'guacamole', 'salsa', 'tortillas?', 'enchiladas?', 'fajitas?', 'mexican', 'meksika\\w*', 'churros?'],
  pastane: ['cakes?', 'cupcakes?', 'cheesecakes?', 'pastr(?:y|ies)', 'patisserie', 'croissants?', 'macarons?', 'eclairs?', 'tarts?', 'desserts?', 'baklava\\w*', 'bakery', 'bakehouse', 'breads?', 'loaf', 'loaves', 'sourdough', 'cookies?', 'biscuits?', 'doughnuts?', 'donuts?', 'brownies?', 'muffins?', 'scones?', 'tatli\\w*', 'pastane\\w*', 'borek\\w*', 'pogaca\\w*', 'kurabiye\\w*', 'ekmek\\w*', 'firin\\w*', 'profiterol\\w*', 'ekler', 'kadayif\\w*', 'kunefe\\w*', 'sutlac\\w*', 'simit\\w*'],
  dondurma: ['ice ?creams?', 'gelato', 'gelateria', 'sorbets?', 'sundaes?', 'cones?', 'scoops?', 'frozen yog(?:h)?urt', 'dondurma\\w*', 'maras'],
  kafe: ['coffee', 'cafe', 'espresso', 'lattes?', 'cappuccinos?', 'flat whites?', 'barista', 'brunch', 'breakfast', 'teas?', 'kahve\\w*', 'kahvalti\\w*', 'cay', 'toasts?', 'sandwich(?:es)?', 'croissants?', 'cakes?', 'pastr(?:y|ies)'],
  bar: ['bars?', 'pubs?', 'cocktails?', 'beers?', 'pints?', 'ales?', 'lagers?', 'wines?', 'whiske?y', 'gin', 'spirits', 'taps?', 'bartenders?', 'drinks?', 'draught', 'brewery', 'taproom', 'kokteyl\\w*', 'bira\\w*', 'sarap\\w*', 'raki', 'meyhane\\w*'],
  kebap: ['kebabs?', 'kebap\\w*', 'doner\\w*', 'shawarma', 'sis', 'adana', 'urfa', 'iskender', 'lahmacun', 'pide\\w*', 'grill(?:ed)?', 'ocakbasi', 'mangal', 'kofte\\w*', 'meze\\w*', 'durum',
    // sokak lezzeti (12 Kas 2026, sokak sablonu): ayni tur
    'gyros', 'souvlaki', 'falafel', 'gozleme\\w*', 'hsp', 'snack ?packs?', 'kokorec\\w*', 'kumpir\\w*', 'ayran', 'tantuni\\w*', 'wraps?'],
  restoran: [], // genel restoran: tur sozcugu yok; stok yalniz menusundeki ya da mutfagindaki bir sozcukle eslesir
};
// Turkce "pasta" pastanede tatli (yurt disi metinde makarna): yalniz TR isletmesinde pastane sozcugu
const KELIME_TR = { pastane: ['pasta\\w*'] };
const MEKAN = ['interior', 'dining ?room', 'dining area', 'terrace', 'patio', 'beer garden', 'garden', 'counter', 'shop ?front', 'store ?front', 'exterior', 'venue', 'seating', 'salon', 'teras', 'bahce', 'ic mekan', 'vitrin'];
const EKIP = ['chefs?', 'staff', 'team', 'owners?', 'bakers?', 'baristas?', 'ekip\\w*', 'usta\\w*', 'sef\\w*'];
const YEMEK_GENEL = ['food', 'dish(?:es)?', 'plates?', 'meals?', 'dinner', 'lunch', 'starters?', 'mains?', 'yemek\\w*', 'tabak\\w*'];
// stok karede konu disi (yiyecek isletmesine ait olmayan sahne): bunlardan biri gecerse kare kullanilmaz
const KONU_DISI = ['office', 'laptops?', 'computers?', 'business ?(?:man|woman|men|women|people|meeting)', 'meetings?', 'handshake', 'landscape', 'mountains?', 'forest', 'cars?', 'skyline', 'fitness', 'gym', 'doctors?', 'medical', 'hospital', 'bedroom', 'hotel room', 'ofis', 'araba'];
// birbirine yakin turler: kafede pasta, pastanede kahve, dondurmacida tatli konu disi degildir
const YAKIN = { kafe: ['pastane', 'dondurma'], pastane: ['kafe', 'dondurma'], dondurma: ['pastane', 'kafe'] };
const OZEL_TUR = ['burger', 'pizza', 'burrito', 'pastane', 'dondurma', 'kebap'];
// isletme olmayan kare (dosya adi, alt metni, CSS sinifi; sade metin)
const LOGO = re(['logos?', 'logotype', 'wordmark', 'brandmark', 'brand mark', 'site ?icon'], '');
const HARITA = re(['maps?', 'staticmap', 'google ?maps?', 'location ?map', 'directions', 'harita\\w*', 'konum'], '');
const EKRAN = re(['screen ?shots?', 'screen ?capture', 'ekran goruntusu', 'ekran alintisi'], '');
const IKON = re(['icons?', 'ikon\\w*', 'favicon', 'sprites?', 'badges?', 'emoji', 'qr', 'qr ?code', 'qrcode', 'avatar', 'placeholder', 'no ?image'], '');

const say = (metin, liste) => { if (!liste.length) return []; const m = sade(metin).match(re(liste)); return [...new Set(m || [])]; };
const dosyaVeYol = (u) => { try { const x = new URL(u); return decodeURIComponent(x.pathname); } catch { return String(u || ''); } };
const kok = (t) => (t.length > 4 ? t.replace(/(?:es|s)$/, '') : t);

// isletmenin turu: sablon kategorisi (burger, burrito, pizza) > kanca kategorisi (pastane) > OSM turu (lead.kind) > mutfak > ad
export function isletmeTuru({ sablon = '', kategori = '', kind = '', mutfak = '', ad = '' } = {}) {
  if (['burger', 'burrito', 'pizza'].includes(sablon)) return sablon;
  if (sablon === 'sokak' || kategori === 'sokak') return 'kebap'; // sokak lezzeti sablonu: doner, kebap, pide-lahmacun, durum ... (KELIME.kebap)
  if (kategori === 'pastane' || sablon === 'pastane') return 'pastane';
  const k = sade(kind);
  if (/^(bakery|pastry shop|confectionery)$/.test(k)) return 'pastane';
  if (k === 'ice cream shop') return 'dondurma';
  if (k === 'kebab house') return 'kebap';
  if (k === 'cafe') return 'kafe';
  if (k === 'bar' || k === 'pub') return 'bar';
  if (k === 'burger joint') return 'burger';
  if (k === 'pizzeria') return 'pizza';
  if (k === 'burrito and taco bar') return 'burrito';
  const b = sade(`${mutfak} ${ad}`);
  if (/(?<![a-z])(kebab|kebap\w*|doner\w*|shawarma)(?![a-z])/.test(b)) return 'kebap';
  if (/(?<![a-z])(ice cream|gelato|dondurma\w*)(?![a-z])/.test(b)) return 'dondurma';
  if (/(?<![a-z])(coffee shop|coffee|cafe)(?![a-z])/.test(sade(mutfak))) return 'kafe';
  return 'restoran';
}

// menunun ozel sozcukleri (yemek adlari ve gruplari): stok karenin "bu isletmenin menusunde var" kaniti
const MENU_ATLA = new Set(['with', 'and', 'the', 'our', 'house', 'special', 'specials', 'small', 'large', 'regular', 'side', 'sides', 'extra', 'served', 'fresh', 'homemade', 'classic', 'choice', 'your', 'from', 'each', 'plus', 'add', 'ons', 'menu', 'vegan', 'vegetarian', 'gluten', 'free', 'glass', 'bottle', 'half', 'full', 'single', 'double', 'daily', 'today', 'kids', 'option', 'options', 'porsiyon', 'buyuk', 'kucuk', 'ozel', 'soslu', 'gunun', 'tam', 'yarim', 'adet']);
export function menuKelimeleri(items = []) {
  const out = new Set();
  for (const it of items || []) for (const t of sade(`${it.n || ''} ${it.cat || ''}`).split(' ')) if (t.length >= 4 && !MENU_ATLA.has(t) && !/^\d/.test(t)) out.add(kok(t));
  return out;
}
// mutfak etiketi (OSM cuisine: "italian;pizza") genel restoranda stok icin tur sozcugu yerine gecer
const mutfakKelimeleri = (mutfak) => new Set(sade(String(mutfak || '').replace(/[;,_]/g, ' ')).split(' ').filter((t) => t.length >= 4).map(kok));

// stok kare tura uyuyor mu?  meta: { alt, url, etiketler[] } ; ctx: { tur, dil, menu (Set), mutfak (Set) }
export function stokUyumu(meta = {}, { tur = 'restoran', dil = 'en', menu = new Set(), mutfak = new Set() } = {}) {
  const metin = [...(meta.etiketler || []), meta.alt || '', dosyaVeYol(meta.url)].join(' ');
  const disi = say(metin, KONU_DISI); if (disi.length) return { uyumlu: false, neden: `stok kare konu dışı (${disi.join(', ')})` };
  const liste = [...(KELIME[tur] || []), ...(dil === 'tr' ? (KELIME_TR[tur] || []) : []), ...(tur === 'bar' ? MEKAN : [])];
  const tokens = new Set(sade(metin).split(' ').filter(Boolean).map(kok));
  const menuEs = [...tokens].filter((t) => menu.has(t) || mutfak.has(t));
  const kendi = new Set([...say(metin, liste), ...menuEs]);
  if (!kendi.size) return { uyumlu: false, neden: `stok kare etiketi işletmenin türüyle (${tur}) ya da menüsüyle eşleşmiyor` };
  if (OZEL_TUR.includes(tur)) {
    for (const u of OZEL_TUR) {
      if (u === tur || (YAKIN[tur] || []).includes(u)) continue;
      const b = say(metin, [...KELIME[u], ...(dil === 'tr' ? (KELIME_TR[u] || []) : [])]).filter((x) => !kendi.has(x) && !menu.has(kok(x)));
      if (b.length > kendi.size) return { uyumlu: false, neden: `stok kare başka türün yemeğini gösteriyor (${u}: ${b.join(', ')})` };
    }
  }
  return { uyumlu: true, eslesen: [...kendi] };
}

// isletmenin kendi karesi sayfaya girebilir mi?  -> null (girer) | { tur, neden }
export function kendiEleme(p, { logoAnahtar = null } = {}) {
  const ipucu = `${dosyaVeYol(p.url).split('/').pop() || ''} ${p.alt || ''} ${p.cls || ''}`;
  const s = sade(ipucu);
  if (p.logo || (logoAnahtar && p.url && kanonikAnahtar(p.url) === logoAnahtar) || LOGO.test(s)) return { tur: 'logo', neden: 'logo' };
  if (HARITA.test(s) || /(?:maps\.googleapis|maps\.gstatic|staticmap|mapbox|openstreetmap)/i.test(String(p.url || ''))) return { tur: 'harita', neden: 'harita ekran görüntüsü' };
  if (EKRAN.test(s)) return { tur: 'ekran', neden: 'ekran görüntüsü' };
  // ikon: dosya adinda ya da kucuk karede (alt metni "plus icon img" gibi galeri kaplamasini anlatabilir: 1100 px galeri karesi ikon degildir)
  if (IKON.test(sade(dosyaVeYol(p.url).split('/').pop() || '')) || (IKON.test(s) && Math.max(p.w || 0, p.h || 0) < 1000)) return { tur: 'ikon', neden: 'ikon ya da işaret görseli' };
  const is = p.isaretler || {};
  if (kesinUretilmis(is) || p.uretilmis) return { tur: 'uretilmis', neden: 'üretilmiş görsel (gerçek fotoğraf değil)' };
  // yalniz KESIN afis isareti: "dusuk doygunluk + yuksek keskinlik" tek basina afis kaniti degil (onayli demolarda koyu zeminli et tabagi ve havuz karesi bu olcude)
  if (kesinAfis(is) || p.afis || p.duz) return { tur: 'afis', neden: 'afiş, menü ya da yazılı görsel' };
  if (/\.png(?:[?#]|$)/i.test(String(p.url || '')) && Array.isArray(p.palette) && p.palette.length && p.palette.length <= 3) return { tur: 'grafik', neden: 'az renkli PNG (grafik)' };
  if (typeof p.lapVar === 'number' && p.lapVar < BULANIK) return { tur: 'bulanik', neden: `bulanık (keskinlik ${Math.round(p.lapVar)})` };
  if ((p.w || 0) < EN_AZ_KART.w || (p.h || 0) < EN_AZ_KART.h) return { tur: 'kucuk', neden: `çok küçük (${p.w || 0}x${p.h || 0})` };
  return null;
}

// konu: dosya adi + alt metni (sade) -> 'yemek' | 'mekan' | 'ekip' | 'belirsiz'
export function konuOf(p, { tur = 'restoran', dil = 'en', menu = new Set() } = {}) {
  const metin = `${dosyaVeYol(p.url).split('/').pop() || ''} ${p.alt || ''} ${(p.etiketler || []).join(' ')}`;
  const tokens = sade(metin).split(' ').filter(Boolean).map(kok);
  if (say(metin, [...(KELIME[tur] || []), ...(dil === 'tr' ? (KELIME_TR[tur] || []) : []), ...YEMEK_GENEL]).length || tokens.some((t) => menu.has(t))) return 'yemek';
  if (say(metin, MEKAN).length) return 'mekan';
  if (say(metin, EKIP).length) return 'ekip';
  return 'belirsiz';
}

// en iyi kare once: cozunurluk, en-boy orani, keskinlik, pozlama, konu
export function fotoPuani(p, ctx = {}) {
  const neden = []; let puan = 0; const w = p.w || 0; const h = p.h || 0; const ar = w && h ? w / h : 1;
  puan += w >= 2400 ? 24 : w >= 1920 ? 20 : w >= 1400 ? 15 : w >= 1000 ? 10 : w >= EN_AZ.w ? 5 : 0; neden.push(`${w}x${h}`);
  if (ar >= 1.3 && ar <= 2.0) { puan += 12; neden.push('yatay'); } else if ((ar >= 1.1 && ar < 1.3) || (ar > 2.0 && ar <= 2.6)) puan += 6; else if (ar >= 0.75 && ar < 1.1) { puan += 2; neden.push('kareye yakın'); } else if (ar < 0.75) { puan -= 6; neden.push('dik'); } else { puan -= 4; neden.push('ince şerit'); }
  const lap = typeof p.lapVar === 'number' ? p.lapVar : 600; puan += Math.min(20, lap / 60); if (lap < YUMUSAK) neden.push('yumuşak');
  const L = p.meanL; if (L == null || (L >= 0.08 && L <= 0.65)) puan += 6; else if (L < 0.03 || L > 0.8) { puan -= 6; neden.push(L < 0.03 ? 'çok koyu' : 'çok açık'); }
  const konu = konuOf(p, ctx); puan += { yemek: 12, mekan: 8, ekip: 3, belirsiz: 0 }[konu]; if (konu !== 'belirsiz') neden.push(konu === 'yemek' ? 'yemek' : konu === 'mekan' ? 'mekân' : 'ekip');
  if (p.heroOk) puan += 4;
  return { puan: +puan.toFixed(1), konu, neden };
}

// ANA ISLEV: R.photos -> { tur, sira (uygun kimlikler, en iyi once, kendi once), uygun[], elenen[], ozet }
//   ctx: { tur, dil, menuItems, mutfak, logoUrl, stok: [{ id, url, alt, etiketler, w, h, lapVar, ... }] (istege bagli dis stok kaynagi) }
export function fotoUyum(photos = [], { tur = 'restoran', dil = 'en', menuItems = [], mutfak = '', logoUrl = null, stok = [] } = {}) {
  const menu = menuKelimeleri(menuItems); const mutfakS = mutfakKelimeleri(mutfak);
  const logoAnahtar = logoUrl ? kanonikAnahtar(logoUrl) : null;
  const ctx = { tur, dil, menu };
  const uygun = []; const elenen = [];
  const isle = (p, disStok) => {
    const id = String(p.id);
    const stokMu = disStok || kesinStok(p.isaretler || {}) || !!p.stok;
    const e = kendiEleme(p, { logoAnahtar }); if (e) { elenen.push({ id, tur: e.tur, neden: e.neden }); return; }
    let eslesen = null;
    if (stokMu) { const s = stokUyumu(p, { tur, dil, menu, mutfak: mutfakS }); if (!s.uyumlu) { elenen.push({ id, tur: 'stok', neden: s.neden }); return; } eslesen = s.eslesen; }
    const f = fotoPuani(p, ctx);
    uygun.push({ id, kaynak: stokMu ? 'stok' : 'kendi', puan: +(f.puan - (stokMu ? 10 : 0)).toFixed(1), konu: f.konu, w: p.w || 0, h: p.h || 0, neden: [...f.neden, ...(eslesen ? [`stok, eşleşen: ${eslesen.join(', ')}`] : [])], ...(((p.w || 0) < EN_AZ.w || (p.h || 0) < EN_AZ.h) ? { yalnizKart: true } : {}) });
  };
  for (const p of photos || []) isle(p, false);
  for (const p of stok || []) isle(p, true);
  // kendi kareleri her zaman stoktan once; sonra puan, sonra piksel alani
  uygun.sort((a, b) => (a.kaynak === b.kaynak ? 0 : a.kaynak === 'kendi' ? -1 : 1) || b.puan - a.puan || b.w * b.h - a.w * a.h);
  const sayim = {}; for (const e of elenen) sayim[e.tur] = (sayim[e.tur] || 0) + 1;
  const kendiN = uygun.filter((x) => x.kaynak === 'kendi').length;
  const ozet = `${(photos || []).length + (stok || []).length} kare: ${uygun.length} uygun (${kendiN} kendi, ${uygun.length - kendiN} stok), ${elenen.length} elendi${elenen.length ? ` (${Object.entries(sayim).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}`;
  return { tur, dil, sira: uygun.map((x) => x.id), uygun, elenen, ozet };
}

// yuva icin uygun mu?  kart: urun karti (daha kucuk kare yeter); -> { ok, neden }
export function yuvaUygun(uyum, id, { kart = false } = {}) {
  if (!uyum) return { ok: true };
  const sid = String(id); const u = (uyum.uygun || []).find((x) => x.id === sid);
  if (u) return u.yalnizKart && !kart ? { ok: false, neden: `çok küçük (${u.w}x${u.h}; bölüm için en az ${EN_AZ.w}x${EN_AZ.h})` } : { ok: true, kaynak: u.kaynak };
  const e = (uyum.elenen || []).find((x) => x.id === sid);
  return { ok: false, neden: e ? e.neden : 'fotoğraflarda yok' };
}

// icerik kararindaki butun fotograf yuvalari: [{ yuva, id, kart }] (logo karesi ve marka isareti yuva degildir)
export function kararYuvalari(k = {}) {
  const out = []; const ekle = (yuva, id, kart = false) => { if (id != null && id !== '' && id !== false) out.push({ yuva, id: String(typeof id === 'object' ? id.id : id), kart }); };
  const ic = k.icerik || {};
  if (k.hero && k.hero.id) ekle('hero', k.hero.id);
  const F = ic.foto || {};
  for (const y of ['menu', 'quiet', 'story', 'contact']) ekle(`foto.${y}`, F[y]);
  (F.cards || []).forEach((id, i) => ekle(`foto.cards[${i}]`, id));
  ((ic.cards && ic.cards.items) || []).forEach((x, i) => ekle(`cards.items[${i}]`, x && x.pic));
  for (const [y, ids] of Object.entries(ic.kareler || {})) [].concat(ids || []).forEach((id, i) => ekle(`kareler.${y}[${i}]`, id));
  (ic.trio || []).forEach((x, i) => ekle(`trio[${i}]`, x && x.id));
  (ic.duo || []).forEach((x, i) => ekle(`duo[${i}]`, x && x.foto));
  for (const [ad, v] of Object.entries((ic.slider && ic.slider.foto) || {})) if (v) ekle(`slider.foto[${ad}]`, v, true);
  const seen = new Set(); return out.filter((x) => { const key = `${x.yuva}:${x.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

// icerik kararinin yuvalarini kapidan gecirir -> hata listesi (bos = gecer).  Ana fotograf kendi karesi olmali (uygun kendi karesi varken stok olamaz).
export function yuvaDenetle(k, uyum) {
  if (!uyum) return [];
  const H = [];
  for (const y of kararYuvalari(k)) { const r = yuvaUygun(uyum, y.id, { kart: y.kart }); if (!r.ok) H.push(`foto uyumu: ${y.yuva} karesi ${y.id} kullanilamaz (${r.neden}); uyan kare yoksa yuva bos birakilir, sablon daraltir`); }
  const hero = k.hero && k.hero.id ? (uyum.uygun || []).find((x) => x.id === String(k.hero.id)) : null;
  if (hero && hero.kaynak === 'stok' && (uyum.uygun || []).some((x) => x.kaynak === 'kendi' && !x.yalnizKart)) H.push(`foto uyumu: ana fotograf (${hero.id}) stok kare; isletmenin kendi karesi olmali`);
  return H;
}

// uretici icin: secilen kimliklerden uymayanlari ayiklar (yuva daraltilir) -> { gecen: Set, uyari: [] }
export function yuvaDaralt(yuvalar, uyum) {
  const gecen = new Set(); const uyari = [];
  for (const y of yuvalar) { const r = yuvaUygun(uyum, y.id, { kart: y.kart }); if (r.ok) gecen.add(String(y.id)); else uyari.push(`foto uyumu: ${y.yuva} karesi ${y.id} uyumsuz (${r.neden}); yuva daraltildi`); }
  return { gecen, uyari };
}

// cikarici verisinden (R) kapinin baglami
export function uyumBaglami(R, { sablon = '', kategori = '', menuItems = null } = {}) {
  const lead = (R && R.lead) || {};
  const dil = lead.lang === 'tr' || lead.region === 'TR' ? 'tr' : 'en';
  return { tur: isletmeTuru({ sablon, kategori, kind: lead.kind, mutfak: lead.mutfak, ad: (R && R.name && R.name.n) || lead.name }), dil, menuItems: menuItems || ((R && R.menu && R.menu.items) || []), mutfak: lead.mutfak || '', logoUrl: (R && R.logo && R.logo.url) || null };
}
