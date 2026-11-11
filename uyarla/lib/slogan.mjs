import { yasakVar } from './sozluk.mjs';
// KAHRAMAN BASLIGI (slogan) secici.  Kural tabanli, dil modeli yok, ayni girdi her zaman ayni cikti.
// Baslik logoda zaten gorunen isletme adini ASLA tekrar etmez.  Kaynak sirasi:
//   (a) isletmenin KENDI sloganı: sitesindeki alt baslik/baslik/slogan satiri, og:title ya da title (addan arindirilmis), aciklamanin ilk yan cumlesi.
//       Temizlik: BUYUK HARF -> cumle duzeni, 2-9 soz, cop (Welcome, Home, cerez, adres, saat, dugme metni...) elenir.
//   (b) yoksa cikarilan GERCEK verilerden (yemek/mutfak, semt ya da sehir, pisirme yontemi) sayfa dilinde sablon; slug'a gore deterministik secilir.
//       En iyi, odul, sayi gibi dogrulanamayan iddia YAZILMAZ.
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const ascii = (s) => String(s || '').toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); };
const loc = (lang) => (lang === 'tr' ? 'tr' : 'en');
export const cap = (s, lang = 'en') => { const t = clean(s); return t ? t.charAt(0).toLocaleUpperCase(loc(lang)) + t.slice(1) : t; };

// ---------- yemek / yontem / tur sozlugu ----------
// k: aranacak kok (ascii), tr: sayfada yazilacak biçim, en: ingilizce biçim
const DISH = [
  { re: /\blahmacun/, tr: 'lahmacun', en: 'lahmacun' }, { re: /\bpide/, tr: 'pide', en: 'pide' }, { re: /\b(kebap|kebab)/, tr: 'kebap', en: 'kebab' }, { re: /\bdoner/, tr: 'döner', en: 'döner' },
  { re: /\bkofte/, tr: 'köfte', en: 'köfte' }, { re: /\b(balik|deniz urun|seafood|fish)/, tr: 'balık', en: 'seafood' }, { re: /\bkahvalti|\bbreakfast|\bbrunch/, tr: 'kahvaltı', en: 'breakfast' },
  { re: /\bbaklava/, tr: 'baklava', en: 'baklava' }, { re: /\bkunefe/, tr: 'künefe', en: 'künefe' }, { re: /\bmanti/, tr: 'mantı', en: 'mantı' },
  { re: /\bpizza/, tr: 'pizza', en: 'pizza' }, { re: /\b(burger|hamburger)/, tr: 'burger', en: 'burgers' }, { re: /\btaco/, tr: 'taco', en: 'tacos' }, { re: /\bsushi/, tr: 'suşi', en: 'sushi' },
  { re: /\bramen/, tr: 'ramen', en: 'ramen' }, { re: /\b(pasta|spaghetti)/, tr: 'makarna', en: 'pasta' }, { re: /\b(steak|biftek)/, tr: 'biftek', en: 'steak' },
  { re: /\btapas/, tr: 'tapas', en: 'tapas' }, { re: /\bcurry/, tr: 'körü', en: 'curry' }, { re: /\b(bbq|barbecue|mangal)/, tr: 'mangal', en: 'barbecue' },
  { re: /\bcocktail|\bkokteyl/, tr: 'kokteyl', en: 'cocktails' }, { re: /\b(craft beer|beer|bira)\b/, tr: 'bira', en: 'beer' }, { re: /\b(wine|sarap)\b/, tr: 'şarap', en: 'wine' },
  { re: /\bcoffee|\bkahve/, tr: 'kahve', en: 'coffee' }, { re: /\b(pastr(y|ies)|bakery|patisserie|firin|pastane)/, tr: 'fırın ürünleri', en: 'pastries' }, { re: /\b(sandwich|sandvic)/, tr: 'sandviç', en: 'sandwiches' },
  { re: /\bnoodle/, tr: 'erişte', en: 'noodles' }, { re: /\b(dumpling)/, tr: 'mantı', en: 'dumplings' }, { re: /\b(oyster)/, tr: 'istiridye', en: 'oysters' }, { re: /\b(shawarma)/, tr: 'şavurma', en: 'shawarma' },
];
const METHOD = [
  { re: /\btas firin/, trAbl: 'taş fırından', en: 'stone-baked' }, { re: /\bodun (atesi|ates|firin)/, trAbl: 'odun ateşinden', en: 'wood-fired' }, { re: /wood[- ]?(fired|oven)/, trAbl: 'odun ateşinden', en: 'wood-fired' },
  { re: /stone[- ]?(baked|oven)/, trAbl: 'taş fırından', en: 'stone-baked' }, { re: /\b(mangal|komur)/, trAbl: 'mangaldan', en: 'charcoal-grilled' }, { re: /(charcoal|chargrill)/, trAbl: 'mangaldan', en: 'charcoal-grilled' },
  { re: /\btandir/, trAbl: 'tandırdan', en: 'tandoor-cooked' }, { re: /\b(smoked|smokehouse)/, trAbl: 'tüttürülmüş', en: 'smoked' }, { re: /slow[- ]cook/, trAbl: 'ağır ateşten', en: 'slow-cooked' },
];
const DISH_WORDS = new Set(['lahmacun', 'pide', 'kebap', 'kebab', 'doner', 'kofte', 'balik', 'kahvalti', 'baklava', 'kunefe', 'manti', 'pizza', 'burger', 'hamburger', 'taco', 'tacos', 'sushi', 'ramen', 'pasta', 'steak', 'tapas', 'curry', 'bbq', 'cocktail', 'cocktails', 'coffee', 'kahve', 'wine', 'beer', 'brunch', 'noodle', 'noodles']);
const GENERIC_NAME = new Set(['restaurant', 'restoran', 'bar', 'cafe', 'kafe', 'kitchen', 'grill', 'house', 'bistro', 'pizzeria', 'lounge', 'pub', 'taverna', 'tavern', 'eatery', 'diner', 'bakery', 'steakhouse', 'and', 'the', 'ile', 'lokanta', 'cuisine', 'food', 'foods', 'shawarma', 'mexican', 'laksa', 'fresh', 'drinks', 'cocktails', 'roma']);

// ---------- ad ----------
export function adTokenleri(name) { return ascii(name).split(' ').filter((w) => w.length >= 4 && !GENERIC_NAME.has(w) && !DISH_WORDS.has(w)); }
export function adiIcerir(text, name) {
  const t = ` ${ascii(text)} `; const full = ascii(name);
  if (full.length >= 3 && t.includes(` ${full} `)) return true;
  return adTokenleri(name).some((w) => t.includes(` ${w} `) || (w.length >= 5 && new RegExp(` ${w}[a-z]{0,3} `).test(t)));
}
export const adMi = (text, name) => { const a = ascii(text); const b = ascii(name); return !!a && (a === b || a === `${b} ${ascii('restaurant')}` || b.startsWith(a) && a.length >= 6); };

// ---------- cop / buton / betimleyici ----------
const JUNK = /\b(hidden article|just another|wordpress|lorem ipsum|coming soon|under construction|sample page|page not found|untitled|default (tagline|description)|your (site|website) (tagline|description)|powered by|all rights reserved|copyright|cookie|cerez|gdpr|privacy|terms|javascript|loading|skip to|enable|browser|accept|reject|preferences)\b|©/i;
const NAVJUNK = /^((our|the|all) )?(rooms?|accommodation|suites|apartments|cottages|rates|tariffs?|prices|price list|services|treatments|book(ing)?( now| online)?|check availability|select language|language|check[- ]?in|check[- ]?out|cookie policy|read more|buy now|explore|view (all|more))$|^(home|homepage|home page|main page|index|menu|menus|about( us)?|contact( us)?|gallery|blog|news|events?|specials?|reservations?|order( online)?|gift (cards?|vouchers?)|catering|careers?|jobs|directions|opening hours|hours|location|faq|shop|login|sign in|book (a )?table|anasayfa|ana sayfa|hakkımızda|menü|iletişim|galeri|rezervasyon|sipariş|duyurular|kariyer)$/i;
const CTA = /\b(book|reserve|order|call|view|see|click|learn|read|contact|visit|subscribe|sign up|follow|get directions|find us|check out|shop|buy)\b.{0,24}\b(now|here|online|menu|more|us|today|page|our|a table)\b|^(book|reserve|order|view|see|click|learn|read|contact|visit|follow|call|explore|discover)\b|(rezervasyon|masa ayırt|sipariş|tıkla|keşfet|başla|devamı|daha fazla|iletişim|bize ulaş|hemen|incele|menüyü|görüntüle|yolculuğuna)/i;
const FACTUAL = /(\d{1,2}[:.]\d{2}|\d{3,}[ -]\d{2,}|[$€£₺]\s?\d|\d\s?(am|pm|tl)\b|%|https?:|www\.|@|\b(google|tripadvisor|yelp|facebook|instagram|reviews?|yorum|puan|stars?|rated|based on|out of)\b|\b(mon|tue|wed|thu|fri|sat|sun)\w*[-–]|\b(pzt|sal|çar|per|cum|cmt|paz)\b.*\d|\bmah\.|\bcad\.|\bsok\.|\b(street|st|road|rd|avenue|ave)\b\.?\s*\d|\b\d+\s+\w+\s+(street|road|rd|st|avenue)\b)/i;
const DESCRIPTOR = /^(cafe|café|bakery|restaurant|bar|pub|pizzeria|kitchen|grill|bistro|coffee( shop)?|brasserie|diner|eatery|lounge|restoran|kafe|lokanta|pideci|kebapçı|kebapci|tatlıcı|fırın|bar & (grill|kitchen)|(restaurant|cafe|café|bakery|bar|pub|kitchen|grill)\s*(&|and|ve|\+|\/)\s*(restaurant|cafe|café|bakery|bar|pub|kitchen|grill|bistro|lounge)|[a-zçğıöşü' -]{3,20}\s(restaurant|restoran|bar|cafe|café|kafe|bistro|grill|bakery|kitchen|pub))$/i;
const GREETING = /\b(welcome|hos ?geldin\w*|hoş ?geldin\w*|bienvenid\w*|willkommen|bienvenue|benvenut\w*)\b/i;
// dogrulanamayan iddia (en iyi, odul...): sitenin kendi cumlesi olsa bile geri plana atilir
const CLAIM = /(?<![\p{L}])(en iyi|en güzel|en lezzetli|number one|no\.? ?1|best|finest|awards?|award-winning|ödüllü|top[- ]rated|leading|famous|ünlü)(?![\p{L}])|#1/iu;
const COLLOC = /\b(slogan|tagline|strapline|motto|subtitle|sub-?title|sub-?head\w*|hero|slide|banner|caption|lead|intro|claim)\b/i;

// ---------- temizlik ----------
const wordsOf = (t) => clean(t).split(' ').filter(Boolean);
const upperRatio = (t) => { const L = [...t].filter((c) => /\p{L}/u.test(c)); return L.length ? L.filter((c) => c === c.toLocaleUpperCase() && c !== c.toLocaleLowerCase()).length / L.length : 0; };
// BUYUK HARF ya da Her Kelime Buyuk -> cumle duzeni (sayfa dilinde)
export function cumleDuzeni(text, lang) {
  let t = clean(text).replace(/^["'“”‘’«»\-–—•·\s]+|["'“”‘’«»\s]+$/g, '').replace(/[.!…:;,\s]+$/g, '');
  if (!t) return '';
  const w = wordsOf(t); const L = loc(lang);
  const long = w.filter((x) => x.replace(/[^\p{L}]/gu, '').length >= 3);
  const title = long.length >= 3 && long.filter((x) => /^\p{Lu}/u.test(x)).length / long.length >= 0.7;
  if (upperRatio(t) > 0.8 && /\p{L}{3}/u.test(t)) t = t.toLocaleLowerCase(L);
  else if (title) t = w.map((x) => (x === x.toLocaleUpperCase(L) && x.length <= 4 && /\p{L}/u.test(x) ? x : x.toLocaleLowerCase(L))).join(' ');
  return cap(t, lang);
}
const nWords = (t) => wordsOf(t).length;

// bir metni slogan adayi olarak degerlendir: temiz metin ya da { red: neden }
export function adayDegerlendir(raw, { name = '', lang = 'en' } = {}) {
  let t = clean(raw);
  if (!t) return { red: 'bos' };
  if (JUNK.test(t)) return { red: 'cop' };
  if (FACTUAL.test(t)) return { red: 'adres/saat/yorum' };
  if (CTA.test(t)) return { red: 'dugme metni' };
  let c = cumleDuzeni(t, lang);
  // 9 sozden uzunsa ilk yan cumle (ayrac: , ; : - | . ! ?) ; yoksa reddet (ortadan kesmek yok)
  if (nWords(c) > 9) {
    const first = c.split(/\s*[,;:–—|.!?]\s*|\s+-\s+/).map(clean).filter(Boolean)[0] || '';
    if (nWords(first) >= 2 && nWords(first) <= 9) c = cap(first, lang); else return { red: 'uzun' };
  }
  const n = nWords(c);
  if (n < 2) return { red: 'kisa' };
  if (!/\p{L}{3}/u.test(c)) return { red: 'harf yok' };
  if (t.includes('?')) return { red: 'soru' };
  const lowC = c.toLocaleLowerCase(loc(lang));
  if (NAVJUNK.test(c) || DESCRIPTOR.test(lowC)) return { red: 'menu/betimleyici' };
  if (n <= 6 && /\b(restaurant|bar|cafe|café|pub|bistro|grill|kitchen|bakery|restoran|kafe|lokanta)\b/.test(lowC) && /\b(in|at|on|of)\b/.test(lowC)) return { red: 'betimleyici (tur + yer)' };
  if (adiIcerir(c, name) || adMi(c, name)) return { red: 'isletme adi' };
  let greet = false;
  if (GREETING.test(c)) { const rest = clean(c.replace(GREETING, ' ').replace(/\b(to|our|the|at|in|us|bize|aramıza|sitemize|restoranımıza)\b/gi, ' ')); if (nWords(rest) < 2) return { red: 'selamlama' }; greet = true; }
  return { text: c, greet, words: n };
}

// ---------- adayin puani ----------
function puan(c, a) {
  const tagP = { h1: 6, h2: 5, h3: 4, h4: 3 }[c.tag] || 2;
  let s = tagP;
  s += c.top < 1000 ? 2 : c.top < 1500 ? 0 : -2;
  if (COLLOC.test(c.cls || '')) s += 2;
  if (c.fs >= 28) s += 1.5; else if (c.fs >= 20) s += 0.5;
  if (c.inHeader) s -= 2;
  if (a.greet) s -= 5;
  if (CLAIM.test(a.text)) s -= 5;
  if (/(?<![\p{L}])(menu|menü|menüsü)(?![\p{L}])/iu.test(a.text)) s -= 2;
  if (a.words >= 3 && a.words <= 7) s += 1;
  if (/[,;]/.test(a.text)) s += 0.5;
  return s;
}

// og:title / title: ayraclarla bol, isim iceren parcalari at
function baslikParcalari(t) { return clean(t).split(/\s*[|–—·•]\s*|\s+-\s+|\s*:\s+/).map(clean).filter(Boolean); }
// aciklama: "<Ad> offers A, B and C ..." -> "A, B"
function adsizAciklama(sentence, name, lang) {
  const m = /^\s*(?:[\p{L}'’&.-]+\s+){1,4}?(offers|serves|brings|features|boasts|has|provides|combines|sunar|sunuyor|sunmaktadır)\s+(.+)$/iu.exec(sentence);
  if (!m || !adiIcerir(sentence.slice(0, m.index + m[0].length - m[2].length), name)) return null;
  const items = m[2].split(/\s*,\s*|\s+and\s+|\s+ve\s+/).map(clean).filter(Boolean);
  const out = [];
  for (const it of items) { if (nWords([...out, it].join(', ')) > 9 || out.length >= 2) break; out.push(it.replace(/^(an?|the)\s+/i, '')); }
  return out.length ? cap(out.join(', '), lang) : null;
}
function aciklamaAdaylari(desc, name, lang) {
  const out = [];
  const sents = (clean(desc).match(/[^.!?]+[.!?]*/g) || []).map(clean).filter(Boolean);
  for (const s of sents.slice(0, 3)) {
    const x = adsizAciklama(s, name, lang); if (x) out.push({ raw: x, via: 'aciklama(adsiz)' });
    const first = s.split(/\s*[,;–—:]\s*/)[0]; if (first) out.push({ raw: first, via: 'aciklama(ilk yan cumle)' });
  }
  return out;
}

// ---------- gercek verilerden gerceklikler ----------
const STREET_RE = /^(?:\d{1,5}[A-Za-z]?(?:[-/]\d{1,4})?\s+|.*\b(?:mah\.|mahallesi|cad\.|caddesi|sok\.|sokak|bulvarı)\b|.*\b(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|way|place|pl|terrace|plaza|parade|quay|esplanade)\b\.?)/i;
const STATE_RE = /^(QLD|NSW|VIC|WA|SA|TAS|NT|ACT|NZ|AU|USA?|UK|IE|CA|[A-Z]{2})$/;
const ABBR = { rd: 'Road', st: 'Street', ave: 'Avenue', blvd: 'Boulevard', dr: 'Drive', ln: 'Lane', pl: 'Place', tce: 'Terrace', hwy: 'Highway' };
export function adresParcala(text) {
  const parts = clean(text).split(',').map(clean).filter((p) => p && !/^\(?\+?\d[\d\s().-]{6,}$/.test(p));
  let si = parts.findIndex((p) => STREET_RE.test(p));
  let street = null;
  if (si >= 0) { const sp = parts[si]; if (/\b(mah\.|mahallesi|cad\.|caddesi|sok\.|sokak)\b/i.test(sp)) { const m = /([\p{L}'’ ]+?)\s+(?:cad\.|caddesi|sok\.|sokak|sk\.)/iu.exec(sp); street = m ? clean(m[0]) : null; } else street = clean(sp.replace(/^\d{1,5}[A-Za-z]?(?:[-/]\d{1,4})?\s+/, '')).replace(/\b(\w{2,4})\.?$/, (x, w) => ABBR[w.toLowerCase()] || x); }
  const rest = (si >= 0 ? parts.slice(si + 1) : parts.slice(-2)).map((p) => clean(p.replace(/\s+(NZ|AU|QLD|NSW|VIC|WA|TAS|ACT|NT|SA|USA|UK)$/i, '').replace(/\s+\d{4,5}$/, ''))).filter((p) => p && !/^\d{3,6}$/.test(p) && !STATE_RE.test(p) && !/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(p));
  const city = rest.length ? rest[rest.length - 1] : null;
  const area = rest.length >= 2 ? rest[0] : null;
  return { street: street && street.length >= 3 ? street : null, area, city };
}
const trLast = (s) => { const v = [...String(s).toLocaleLowerCase('tr')].reverse().find((c) => 'aıoueiöü'.includes(c)); return v || 'a'; };
// Turkce bulunma eki: Antalya'da, Konyaaltı'nda, Beşiktaş'ta, Kadıköy'de
export function trBulunma(place) {
  const p = clean(place); if (!p) return '';
  const low = p.toLocaleLowerCase('tr'); const lastC = low[low.length - 1]; const back = 'aıou'.includes(trLast(low)); const V = back ? 'a' : 'e';
  let suf;
  if ('aıoueiöü'.includes(lastC)) suf = ('ıiuü'.includes(lastC) && low.length >= 7) ? `n${'d'}${V}` : `d${V}`;
  else if ('çfhkpsşt'.includes(lastC)) suf = `t${V}`;
  else suf = `d${V}`;
  return `${p}’${suf}`;
}
const METHOD_TR_FIX = (m) => m;
export function gerceklikler(R, lang) {
  const lead = R.lead || {}; const name = (R.name && R.name.n) || lead.name || '';
  const cands = ((R.slogan && R.slogan.cands) || []).map((c) => c.t);
  const groups = ((R.menu && R.menu.groups) || []).map((g) => ({ n: g.name, k: g.n }));
  const items = ((R.menu && R.menu.items) || []).map((i) => `${i.n} ${i.d || ''}`);
  const cat = clean(lead.category);
  const desc = [R.tagline, R.slogan && R.slogan.desc, R.slogan && R.slogan.ogTitle, R.slogan && R.slogan.title].filter(Boolean).join(' ');
  // agirlikli derlem
  const bag = []; const add = (txt, w) => { if (txt) bag.push({ a: ascii(txt), w }); };
  add(name, 3); add(cat, 2); add(desc, 2); cands.slice(0, 40).forEach((c) => add(c, 1.5)); groups.forEach((g) => add(g.n, 1 + Math.min(2, g.k / 6))); items.slice(0, 30).forEach((i) => add(i, 0.5));
  const score = (re) => bag.reduce((s, b) => s + (re.test(b.a) ? b.w : 0), 0);
  const dishes = DISH.map((d, i) => ({ d, i, s: score(d.re) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
  // birbirinin kopyasi olan (ayni tr/en bicimi) yemekleri ele
  const uniq = []; for (const x of dishes) if (!uniq.some((u) => u.d.tr === x.d.tr || u.d.en === x.d.en)) uniq.push(x);
  const meth = METHOD.map((m, i) => ({ m, i, s: score(m.re) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i)[0];
  const ad = lead.address || (R.address && R.address.text) || '';
  const ap = adresParcala((R.address && R.address.text) || '');
  const area = clean(lead.area) || (ap.area && ap.area.length >= 3 ? ap.area : null) || null; // "D" gibi tek harfli kirintilar semt sayilmaz
  const city = clean(lead.city) || ap.city || null;
  // tur ifadesi: sitedeki betimleyici ("CAFE & BAKERY") > lead kategorisi > tur
  let kindPhrase = null;
  // restoran disi sektorlerde tur ifadesi sektorun kendi turu (guest house, bed and breakfast, hair salon ...); sitenin "Restaurant" gibi satiri tur olmaz
  const sektKind = lead.sektor && lead.sektor !== 'restoran' && lead.kind ? clean(lead.kind).toLowerCase() : null;
  const desc1 = sektKind ? null : cands.find((c) => DESCRIPTOR.test(clean(c).toLocaleLowerCase(loc(lang))) && !adiIcerir(c, name));
  if (desc1) kindPhrase = clean(desc1).toLocaleLowerCase(loc(lang)).replace(/\s*(&|\+|\/)\s*/g, ' and ').replace(/\bcafe\b/, 'café');
  if (!kindPhrase && lang !== 'tr' && cat && /^[A-Za-z &-]{3,26}$/.test(cat) && !/\b(and|&)\b/i.test(name)) kindPhrase = cat.toLowerCase().replace(/\s*(&|\+|\/)\s*/g, ' and ').replace(/\bcafe\b/, 'café');
  const kind = lead.kind || 'restaurant';
  if (!kindPhrase && sektKind) kindPhrase = sektKind;
  if (!kindPhrase) kindPhrase = { restaurant: 'restaurant', bar: 'bar', cafe: 'café' }[kind] || 'restaurant';
  return { dish: uniq[0] ? uniq[0].d : null, dish2: uniq[1] ? uniq[1].d : null, method: meth ? meth.m : null, area, city, street: ap.street, kind, kindPhrase, address: ad };
}

// ---------- sablonlar ----------
const KIND_TR = { restaurant: 'restoran', bar: 'bar', cafe: 'kafe' };
export function sablonlar(f, lang) {
  const out = [];
  const place = f.area || f.city;
  if (lang === 'tr') {
    const c = (s) => cap(s, 'tr');
    if (f.area && f.method && f.dish) out.push({ id: 'tr-semt-yontem-yemek', text: c(`${trBulunma(f.area)} ${f.method.trAbl} ${f.dish.tr}`) });
    if (f.area && f.dish && f.dish2) out.push({ id: 'tr-semt-iki-yemek', text: c(`${trBulunma(f.area)} ${f.dish.tr} ve ${f.dish2.tr}`) });
    if (f.city && f.method && f.dish) out.push({ id: 'tr-sehir-yontem-yemek', text: c(`${trBulunma(f.city)} ${f.method.trAbl} ${f.dish.tr}`) });
    if (f.method && f.dish && f.dish2) out.push({ id: 'tr-yontem-iki-yemek', text: c(`${f.method.trAbl} ${f.dish.tr} ve ${f.dish2.tr}`) });
    if (place && f.dish) out.push({ id: 'tr-yer-yemek', text: c(`${trBulunma(place)} ${f.dish.tr}`) });
    if (place) out.push({ id: 'tr-yer-tur', text: c(`${trBulunma(place)} bir ${KIND_TR[f.kind] || 'restoran'}`) });
  } else {
    const c = (s) => cap(s, 'en');
    if (f.method && f.dish && place) out.push({ id: 'en-yontem-yemek-yer', text: c(`${f.method.en} ${f.dish.en} in ${place}`) });
    if (f.dish && f.dish2 && place) out.push({ id: 'en-iki-yemek-yer', text: c(`${f.dish.en} and ${f.dish2.en} in ${place}`) });
    if (f.dish && place) out.push({ id: 'en-yemek-yer', text: c(`${f.dish.en} in ${place}`) });
    if (f.kindPhrase && f.area) out.push({ id: 'en-tur-semt', text: c(`${f.kindPhrase} in ${f.area}`) });
    if (f.kindPhrase && f.street && f.city) out.push({ id: 'en-tur-cadde', text: c(`${f.kindPhrase} on ${f.street}, ${f.city}`) });
    if (f.kindPhrase && f.city) out.push({ id: 'en-tur-sehir', text: c(`${f.kindPhrase} in ${f.city}`) });
  }
  return out.filter((x) => nWords(x.text) >= 2 && nWords(x.text) <= 9);
}

// ---------- ana giris ----------
// -> { text, kaynak, aday:[{text,via,puan}], red:[{raw,neden}], gerceklik }
export function sloganSec(R, { lang, slug } = {}) {
  lang = lang || (R.lead && R.lead.lang) || 'en';
  const name = (R.name && R.name.n) || (R.lead && R.lead.name) || '';
  const S = R.slogan || {}; const red = []; const adaylar = [];
  const dene = (raw, via, bonus, c) => { const a = adayDegerlendir(raw, { name, lang }); if (a.red) { if (red.length < 40) red.push({ raw: clean(raw).slice(0, 80), neden: a.red, via }); return; } adaylar.push({ text: a.text, via, puan: (c ? puan(c, a) : 4) + bonus }); };
  // 1) sitedeki hero / alt baslik / slogan satirlari
  // yalniz ilk ekran (kahraman bolgesi) ya da sinifi slogan/alt baslik diyen satirlar; asagidaki bolum basliklari baslik olmaz
  for (const c of S.cands || []) { if (c.top > 950 && !COLLOC.test(c.cls || '')) { if (red.length < 40) red.push({ raw: clean(c.t).slice(0, 80), neden: 'ilk ekranin disinda', via: `site:${c.tag}` }); continue; } dene(c.t, `site:${c.tag}`, 0, c); }
  // 2) og:title ve title, adin gectigi parcalar atilarak
  for (const [k, via] of [[S.ogTitle, 'og:title'], [S.title, 'title']]) for (const p of baslikParcalari(k || '')) dene(p, via, -2.5);
  // 3) aciklamanin adsiz hali ya da ilk yan cumlesi
  for (const x of aciklamaAdaylari(S.desc || R.tagline || '', name, lang)) dene(x.raw, x.via, -3.5);
  const sirali = adaylar.map((a, i) => ({ ...a, i })).sort((a, b) => b.puan - a.puan || a.i - b.i);
  // ayni metin iki kez gelirse tek say
  const seen = new Set(); const tekil = sirali.filter((a) => { const k = ascii(a.text); if (seen.has(k)) return false; seen.add(k); return true; });
  const f = gerceklikler(R, lang);
  if (tekil.length) return { text: tekil[0].text, kaynak: `kendi (${tekil[0].via})`, aday: tekil.slice(0, 6), red, gerceklik: f };
  const sab = sablonlar(f, lang);
  if (sab.length) { const pick = sab[hash(`${slug || name}:slogan`) % sab.length]; return { text: pick.text, kaynak: `sablon (${pick.id})`, aday: [], red, gerceklik: f, sablonlar: sab.map((x) => x.id) }; }
  // son care: yalniz tur + sehir (ad degil)
  const last = lang === 'tr' ? cap(`${f.city ? trBulunma(f.city) + ' ' : ''}${KIND_TR[f.kind] || 'restoran'}`, 'tr') : cap(`${f.kindPhrase}${f.city ? ' in ' + f.city : ''}`, 'en');
  return { text: nWords(last) >= 2 ? last : cap(f.kindPhrase, lang), kaynak: 'sablon (son-care)', aday: [], red, gerceklik: f };
}

// ---------- elle yazilmis / secilmis slogan denetimi ----------
// Kural her kaynaga aynidir: isletme adini tekrar etmez, 2-9 soz, dogrulanamayan iddia (en iyi, odul...) yok.
export const iddiaVar = (t) => CLAIM.test(String(t || ''));
export function sloganDogrula(text, name) {
  const t = clean(String(text || '').replace(/\*/g, ''));
  if (!t) return 'bos';
  const n = nWords(t);
  if (n < 2 || n > 9) return `soz sayisi ${n} (2-9 olmali)`;
  if (/\d{3,}|@|www\.|https?:/i.test(t)) return 'telefon, adres ya da baglanti';
  if ((n <= 3 && /^(tel|phone|mobile|call|e-?mail|contact|home|menu|rooms?|gallery|book(?:ing)?|about|welcome)(?![\p{L}])/iu.test(t)) || /[»›:]\s*$/.test(t)) return 'gezinme ya da iletisim satiri';
  if (adiIcerir(t, name) || adMi(t, name)) return 'isletme adini tekrar ediyor';
  if (iddiaVar(t)) return 'dogrulanamayan iddia';
  if (yasakVar('kisaltmaVeIfade', t)) return 'yasak sozcuk';
  return null;
}
// "*...*" ile isaretli vurgu parcasi -> [{ t, em }]; isaret yoksa son virgulden sonrasi vurgulanir
export function sloganParcalari(text) {
  const out = []; const re = /\*([^*]+)\*/g; let last = 0; let m; const s = String(text || '');
  while ((m = re.exec(s))) { if (m.index > last) out.push({ t: s.slice(last, m.index), em: false }); out.push({ t: m[1], em: true }); last = m.index + m[0].length; }
  if (last < s.length) out.push({ t: s.slice(last), em: false });
  if (out.length === 1 && !out[0].em) { const i = s.lastIndexOf(', '); if (i > 0 && s.length - i > 6) return [{ t: s.slice(0, i + 2), em: false }, { t: s.slice(i + 2), em: true }]; }
  return out;
}

// alt satir (lede) slogani tekrar etmesin: sloganin sozlerinin %60'indan fazlasini iceren cumleler elenir
export function sloganlaOrtusur(sentence, slogan) {
  const sw = ascii(slogan).split(' ').filter((w) => w.length >= 3); if (!sw.length) return false;
  const t = ` ${ascii(sentence)} `;
  return sw.filter((w) => t.includes(` ${w}`)).length / sw.length >= 0.6;
}
