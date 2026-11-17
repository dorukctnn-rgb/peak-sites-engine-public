// PAKET ON SUZGECI (18 Kas 2026, web-ajani-12).  Icerik turu (alt ajan, 5-6 paketlik partide 190-260k token) yalniz GECME OLASILIGI YUKSEK paketlere harcansin diye,
// ajandan ONCE, kodla (model yok, ag yok): hazirlik paketini (<veri>/<slug>/paket/) puanlar, kesin elenecekleri nedenleriyle ayirir, gerisini sirali kisa liste yapar.
// 17-18 Kas turu: ~420 aday -> 70 icerik-bekliyor -> 23 icerik turu -> 5 karar -> 4 sayfa.  Gozlenen ret nedenleri (stok-18-20kas\NOTLAR.md, DURUM-15KAS.md):
//   1) menude 6 adli yemek yok (yalniz basliklar, yalniz bufe fiyati, yalniz Instagram afisi)        -> menu: yemek adi sayimi (metin / PDF metni / fiyatli satir)
//   2) ana fotograf: kendi 2400 px+ kare yok (stok ana fotograf yalniz yemegi acikca uyan turde)       -> hero
//   3) logo yerinde odul / puan rozeti ya da okunmayacak kadar kucuk logo                              -> logo
//   4) saat: 7 gun cozulemiyor, 'late' kapanis, celisen satirlar                                       -> saat
//   5) zincir / grup / franchise / kardes mekanlar                                                      -> zincir
//   6) mevcut site zaten guclu (rezervasyon motoru, modern altyapi, cok sayfa)                          -> AGIRLIK (sert kural degil)
// Sert kural -> gecer=false (nedenleri listelenir, kalici eleme DEGIL: kapi.json'a dokunulmaz).  Gecenler puana gore sirali; icerik turune yalniz listenin basi gider.
// CLI:  node hat/paket-suzgec.mjs --veri <veri klasoru> [--durum icerik-bekliyor|hepsi] [--ilk 6] [--min 60] [--yaz] [--json cikti.json] [--hepsi]
// E-posta adresi ve telefon okunmaz ve yazilmaz (yalniz bilgi.json'daki varlik bakilir).  Ag yok; PDF metni icin yerel pdftotext (varsa) cagrilir.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ZINCIR_METIN, TR_ZINCIR_METIN, FIYAT_SATIR } from '../uyarla/restoran-hazirla.mjs';
import { isletmeTuru } from '../uyarla/lib/foto-uyum.mjs';
import { rozetMi } from '../uyarla/lib/rozet.mjs';

export const SURUM = 1;
// kisa listeye girmek icin en az puan (sert kurallari gecenler arasinda) ve varsayilan liste boyu
export const MIN_PUAN = 60;
export const ILK_VARSAYILAN = 6;
export const HERO_EN_AZ = 2400; // kendi ana fotografin uzun kenari (piksel)
export const MENU_EN_AZ = 6; // adli yemek
// logo: baslikta ~40-56 px yukseklik 2x net gerekir -> kisa kenar en az 80, uzun kenar en az 150 (greenwood: 114 px logo elendi); 300 px altina puan dusurulur
export const LOGO_KISA_EN_AZ = 80;
export const LOGO_UZUN_EN_AZ = 150;

const J = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const oku = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const sade = (s) => String(s ?? '').replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[öÖ]/g, 'o').replace(/[üÜ]/g, 'u').toLowerCase();
const temizSatir = (s) => String(s).replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ').replace(/https?:\/\/\S+|<https?:[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const decodeGuvenli = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// ================= 1) MENU: adli yemek sayimi =================
const BASLIK_KELIME = new Set(('breakfast brunch lunch dinner supper drinks drink beverages beverage coffee coffees tea teas desserts dessert sweets sweet sides side salads salad fresh soups soup starters starter entree entrees mains main kids kid childrens children specials special wines wine beers beer ' +
  'cocktails cocktail spirits menu menus food sandwiches sandwich catering functions function wedding christmas takeaway delivery vegetarian vegan gluten free extras extra snacks snack appetizers appetizer share plates plate small large all day dine in set bar bottle sunday weekend happy hour ' +
  'and the our see view download online order home about contact gallery book now more read from to for with of a on at hot cold iced smoothies juices juice shakes milkshakes pasta pizzas pizza burgers burger sauces sauce toppings topping add ons mocktails non alcoholic list contents ' +
  'kahvalti corba salata tatli icecek ana yemek yemekler menumuz ara sicaklar soguklar').split(' '));
const NAV_RE = /(?:@|https?:|www\.|\bcookies?\b|wordpress|\bwix\b|powered by|copyright|©|all rights|privacy|terms|skip to|log ?in|sign ?up|newsletter|navigate|toggle|follow us|quick links|gift ?cards?|e-?gift|subscribe|\bsearch\b|select page|top of page|bottom of page|read more|learn more|click here|see the menu|view (?:our )?menus?|download|reservations?|opening hours|trading hours|\bhours\b|contact us|find us|address|\btel\b|phone|instagram|facebook|tiktok|twitter|google|tripadvisor|photo gallery|reviews?|testimonials?|what.s on|venue hire|our story|about us|online order|order online|book (?:a )?table|menus? (?:updated|available))/i;
const SAAT_SATIR = /\b\d{1,2}(?:[:.]\d{2})?\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b|\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day|s|sday|nesday|rsday|urday)?\b|\bpazartesi|\bcumartesi/i;
const FIYAT_GURULTU = /\b(adults?|child(?:ren)?|seniors?|buffet|per (?:person|head|table)|sessions?|surcharge|corkage|delivery fee|service fee|minimum (?:spend|order)|public holidays?|bring your own|byo|gift (?:card|voucher)s?|deposit)\b/i;
const YEMEK_KELIME = new RegExp(`(?<![a-z])(?:${[
  'chicken', 'beef', 'pork', 'lamb', 'duck', 'turkey', 'veal', 'fish', 'prawns?', 'shrimp', 'salmon', 'tuna', 'barramundi', 'snapper', 'squid', 'calamari', 'crab', 'lobster', 'oysters?', 'mussels?', 'scallops?', 'steaks?', 'ribs?', 'wings?', 'bacon', 'ham', 'sausages?', 'chorizo', 'eggs?',
  'cheese', 'tofu', 'rice', 'noodles?', 'pasta', 'spaghetti', 'penne', 'ravioli', 'gnocchi', 'risotto', 'lasagn[ae]', 'carbonara', 'pizzas?', 'burgers?', 'fries', 'chips', 'salad', 'soup', 'curry', 'dumplings?', 'satay', 'roti', 'naan', 'paratha', 'bread', 'toast', 'sandwich(?:es)?', 'wraps?', 'tacos?', 'burritos?', 'nachos', 'quesadillas?',
  'falafel', 'hummus', 'kebabs?', 'kofte', 'gyros?', 'souvlaki', 'shawarma', 'cakes?', 'tarts?', 'pies?', 'pastr(?:y|ies)', 'croissants?', 'brownies?', 'cookies?', 'muffins?', 'scones?', 'gelato', 'ice cream', 'pancakes?', 'waffles?', 'omelette', 'bruschetta', 'panini', 'sushi', 'sashimi', 'ramen', 'pho', 'laksa', 'biryani', 'tikka', 'masala', 'korma', 'vindaloo', 'paneer',
  'dosa', 'samosas?', 'bhaji', 'tempura', 'teriyaki', 'bao', 'banh mi', 'kimchi', 'bibimbap', 'bulgogi', 'pad thai', 'tom yum', 'tom kha', 'larb', 'stir[- ]?fr(?:y|ied)', 'fried rice', 'spring rolls?', 'bbq', 'grilled', 'roast', 'fritters?', 'mash', 'pudding', 'cheesecake', 'tiramisu', 'sorbet', 'espresso', 'latte', 'cappuccino',
  'tavuk', 'kuzu', 'dana', 'pilav', 'corba', 'salata', 'pide', 'lahmacun', 'doner', 'kebap', 'baklava', 'borek', 'manti', 'tatli', 'kahvalti', 'makarna', 'balik', 'izgara', 'tost', 'mercimek',
].join('|')})(?![a-z])`, 'i');
// malzeme sozcukleri: yemek ADI degil, ad + aciklama ciftinde ACIKLAMA satirinin yemek tarifi oldugunu gosterir
const MALZEME = /(?<![a-z])(?:lentils?|chickpeas?|beans?|potato(?:es)?|mushrooms?|vegetables?|veggies?|onions?|garlic|tomato(?:es)?|spinach|kale|cabbage|carrots?|pumpkin|eggplant|aubergine|capsicum|avocado|mango|coconut|peanuts?|cream|butter|chilli|chili|herbs?|sauce|marinated|seasoned|topped|glazed|sauteed|simmered|slow cooked|baked|fried|steamed|crispy|served|filled|stuffed|fresh|spiced|dough|flour|sugar|chocolate|vanilla|caramel|berry|berries|lemon|olive|basil|cumin|turmeric|ginger)(?![a-z])/i;
const SATIR_FIYATLI = new RegExp(FIYAT_SATIR.source, 'u');
const SATIR_SONU_SAYI = /^(.{3,60}?)[\s.…·_\-–—:]*\s(\d{1,3}(?:[.,]\d{1,2})?)\s*$/;
const ADI_UYGUN = (s) => { const t = s.trim(); if (t.length < 3 || t.length > 70) return false; if (t.split(/\s+/).length > 8) return false; if (!/\p{L}{3}/u.test(t)) return false; if (/[.!?]\s*$/.test(t)) return false; return true; };
const BASLIK_MI = (s) => { const k = sade(s).replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean); return !k.length || k.every((w) => BASLIK_KELIME.has(w) || /^\d+$/.test(w)); };
const fiyatAdiYasak = (ad) => /^(?:extra|add|upgrade|available|from|size|small|large|regular|each|per)\b/i.test(ad.trim());

// metin -> { adlar: [yemek adi], yontem: {fiyatli, cift, sozcuk}, kesin, dogrulandi }.  Uc yontem birlikte sayilir (tekrarsiz): fiyatli satir adi (para simgeli ya da satir sonunda sayi),
// ad + aciklama cifti, yemek sozcugu iceren kisa satir.  Baslik (Breakfast, Drinks), gezinti, saat, adres ve bufe / seans fiyati yemek sayilmaz.
export function yemekAdlari(metin) {
  const adlar = new Map(); const ekle = (ad, yontem, anahtar = ad) => { const k = sade(anahtar).replace(/[^a-z0-9]+/g, ' ').trim(); if (k.length >= 3 && !adlar.has(k)) adlar.set(k, yontem); };
  const satirlar = String(metin || '').split('\n').map(temizSatir).filter(Boolean);
  const para = (s) => SATIR_FIYATLI.test(s);
  const adGecerli = (ad) => !!ad && /\p{L}{3}/u.test(ad) && ad.split(/\s+/).length <= 9 && !BASLIK_MI(ad) && !NAV_RE.test(ad) && !fiyatAdiYasak(ad) && !/^\d/.test(ad.trim());
  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];
    // (1) fiyatli satir: "[ADI] aciklama: $9", "aciklama | A$10 | Adi", "Adi ..... 12.50", ya da "Adi 18.5"; ad bir onceki satirda olabilir
    const sonSayi = !para(s) && !SAAT_SATIR.test(s) && !NAV_RE.test(s) ? SATIR_SONU_SAYI.exec(s) : null;
    if ((para(s) && !FIYAT_GURULTU.test(s) && !SAAT_SATIR.test(s.replace(SATIR_FIYATLI, ' '))) || (sonSayi && !FIYAT_GURULTU.test(s))) {
      let ad = ''; let anahtar = null;
      // paket satirlari "[GRUP ya da AD] kalan: $fiyat" (sayfa.txt: bracket grup, kalan ad; siparis.txt: bracket ad): ikisinden gecerli olan, tekrar anahtari tum satir
      const kose = /^\[([^\]]{2,60})\]\s*(.*)$/.exec(s); const bar = s.split('|').map((x) => x.trim()).filter(Boolean);
      if (kose) { const kalan = kose[2].replace(new RegExp(FIYAT_SATIR.source, 'gu'), ' ').replace(/[:\s]+$/, '').trim(); ad = [kalan, kose[1]].find((x) => x && adGecerli(x)) || ''; anahtar = `${kose[1]} ${kalan}`; }
      else if (bar.length >= 3) ad = bar.find((x) => !para(x) && x.length <= 60 && x.split(/\s+/).length <= 7) || '';
      else if (sonSayi) ad = sonSayi[1].trim();
      else { const x = s.replace(new RegExp(FIYAT_SATIR.source, 'gu'), ' ').replace(/[.…·_\-–—:|]{2,}/g, ' ').replace(/\s+/g, ' ').trim(); ad = x.split(/\s+[-–—]\s+|\s{2,}/)[0] || x; }
      if (!ad || ad.split(/\s+/).length > 9) { const o = satirlar[i - 1]; if (o && ADI_UYGUN(o) && !BASLIK_MI(o) && !NAV_RE.test(o)) ad = o; }
      if (adGecerli(ad)) ekle(ad, 'fiyatli', anahtar || ad);
      continue;
    }
    if (NAV_RE.test(s) || SAAT_SATIR.test(s)) continue;
    // (2) ad + aciklama cifti: kisa ad satiri, ardindan en az 5 sozcuklu aciklama; ad bir baslik (Breakfast, Drinks ...) degil
    const n = satirlar[i + 1];
    // aciklama satiri yemek sozcugu icermeli ya da virgullu malzeme listesi olmali (pazarlama / gezinti paragrafi cift sayilmaz)
    if (ADI_UYGUN(s) && s.split(/\s+/).length <= 6 && !BASLIK_MI(s) && n && n.split(/\s+/).length >= 5 && /[a-zçğıöşü]/.test(n) && !NAV_RE.test(n) && /^[\p{Lu}"“(]/u.test(s) && (YEMEK_KELIME.test(sade(n)) || MALZEME.test(sade(n)) || (n.match(/,/g) || []).length >= 2)) ekle(s, 'cift');
    // (3) yemek sozcugu iceren kisa satir (ad)
    else if (ADI_UYGUN(s) && s.split(/\s+/).length <= 6 && !BASLIK_MI(s) && YEMEK_KELIME.test(sade(s)) && /^[\p{Lu}0-9"“(]/u.test(s)) ekle(s, 'sozcuk');
  }
  const yontem = [...adlar.values()].reduce((m, y) => { m[y] = (m[y] || 0) + 1; return m; }, {});
  // sozcuk yontemi tek basina zayif: fiyatli + cift en az 6 ise ya da toplam en az 10 ise dogrulanmis sayilir
  const kesin = (yontem.fiyatli || 0) + (yontem.cift || 0);
  return { adlar: [...adlar.keys()], yontem, kesin, dogrulandi: kesin >= MENU_EN_AZ || adlar.size >= MENU_EN_AZ + 4 };
}

// pdftotext (varsa): menu PDF'inin metni.  Yoksa ya da metin cikmazsa null (taranmis PDF: gorsel gibi belirsiz sayilir).  Sinirlar: 30 MB, 12 sn, 600 KB cikti.
export function pdfMetniOku(dosya) {
  try {
    if (!fs.existsSync(dosya) || fs.statSync(dosya).size > 30e6) return null;
    const r = spawnSync('pdftotext', ['-q', '-enc', 'UTF-8', dosya, '-'], { encoding: 'utf8', timeout: 12000, maxBuffer: 600000, windowsHide: true });
    if (r.error || r.status !== 0) return null;
    return r.stdout || null;
  } catch { return null; }
}
const MENU_GORSEL_IPUCU = /menu|men[uü]|carta|food|price|fiyat|drinks?|lunch|dinner|breakfast/i;

// paket -> menu bulgusu.  kind: 'metin' (>= 6 adli yemek dogrulandi) | 'pdf-resim' (PDF var, metin yok: dogrulanamaz) | 'gorsel' (adi menu diyen buyuk gorsel) | 'yok'
export function menuOlc(paketDir, bilgi, { pdfMetin = pdfMetniOku } = {}) {
  const mk = path.join(paketDir, 'menu-kaynak'); const kaynak = (bilgi && bilgi.menu_kaynaklari) || [];
  let dosyalar = []; try { dosyalar = fs.readdirSync(mk); } catch { /* yok */ }
  const adlar = new Map(); let kesin = 0;
  for (const f of dosyalar.filter((x) => /\.txt$/i.test(x))) { const y = yemekAdlari(oku(path.join(mk, f))); for (const a of y.adlar) adlar.set(a, f); kesin += y.kesin; }
  let pdfMetinli = 0; let pdfResim = 0;
  for (const f of dosyalar.filter((x) => /\.pdf$/i.test(x)).slice(0, 4)) {
    const t = pdfMetin(path.join(mk, f));
    if (t && t.replace(/\s+/g, '').length >= 200) { pdfMetinli++; const y = yemekAdlari(t); for (const a of y.adlar) adlar.set(a, f); kesin += y.kesin; } else pdfResim++;
  }
  const hepsi = { adet: adlar.size, pdfMetinli, pdfResim, notlar: [] };
  if (kesin >= MENU_EN_AZ || adlar.size >= MENU_EN_AZ + 4) return { kind: 'metin', ...hepsi };
  // paket kopyasinda menu dosyasi yoksa bilgi.json'daki FIYATLI kalem sayisi (fiyatsiz kaynakta sayi basliklari da sayar: guvenilmez)
  const fiyatliKalem = kaynak.filter((x) => !x.fiyatsiz && (x.tur === 'sayfa' || x.tur === 'siparis-sitesi')).reduce((s, x) => s + (x.kalem || 0), 0);
  if (!dosyalar.length && fiyatliKalem >= MENU_EN_AZ + 2) return { kind: 'metin', ...hepsi, adet: fiyatliKalem, notlar: ['dosya yok: bilgi.json kalem sayisi'] };
  if (pdfResim > 0) return { kind: 'pdf-resim', ...hepsi, notlar: ['PDF metni okunamadi (taranmis ya da pdftotext yok)'] };
  const gorsel = kaynak.filter((x) => x.tur === 'gorsel' && !/feed-images|instagram|fbcdn|cdninstagram/i.test(x.url || '') && MENU_GORSEL_IPUCU.test(decodeGuvenli(String(x.url || '').split('?')[0].split('/').pop())) && (parseInt(String(x.px || '0'), 10) || 0) >= 1000);
  if (gorsel.length) return { kind: 'gorsel', ...hepsi, notlar: [`menu gorseli: ${gorsel.length}`] };
  return { kind: 'yok', ...hepsi };
}

// ================= 2) ANA FOTOGRAF =================
// stok ana fotograf yalniz yemegi / mekan turu acikca uyan isletmede (ROUTINE.md 1b): sablon kategorisi ya da taninan mutfak
const MUTFAK_NET = /(?<![a-z])(thai|indian|chinese|japanese|sushi|ramen|korean|vietnamese|italian|pasta|pizza|burger|mexican|greek|turkish|lebanese|middle[ _]eastern|malaysian|indonesian|french|spanish|tapas|steak[ _]?house|seafood|fish[ _]and[ _]chips|kebab|bbq|barbecue|bakery|cake|ice[ _]cream|coffee[ _]shop|dim[ _]sum|noodle|curry|afghan|nepalese|sri[ _]lankan|ethiopian|african|brazilian|peruvian|american|diner|brunch|breakfast|dessert|crepe|waffle|donut|sandwich)(?![a-z])/i;
const OZEL_TUR = new Set(['burger', 'pizza', 'burrito', 'pastane', 'dondurma', 'kebap']);
export function heroOlc(bilgi = {}) {
  const fo = bilgi.fotograflar || [];
  const uygun = (f) => String(f.uyum || '').startsWith('uygun');
  const kendi = fo.filter((f) => f.kaynak !== 'stok' && uygun(f));
  const uzun = (f) => Math.max(f.w || 0, f.h || 0);
  const buyuk = kendi.filter((f) => uzun(f) >= HERO_EN_AZ);
  const yatay = kendi.filter((f) => (f.w || 0) >= HERO_EN_AZ && (f.w || 0) >= (f.h || 0));
  const enGenis = kendi.reduce((m, f) => Math.max(m, f.w || 0), 0);
  const stokVar = fo.some((f) => f.kaynak === 'stok' && uygun(f));
  const tur = isletmeTuru({ sablon: bilgi.sablon || '', kind: bilgi.tur || '', mutfak: bilgi.mutfak || '', ad: bilgi.ad || '' });
  const stokTur = OZEL_TUR.has(tur) || MUTFAK_NET.test(sade(`${bilgi.mutfak || ''} ${bilgi.ad || ''}`));
  const adaylar = (bilgi.hero_adaylari || []).map((a) => ({ en: Math.max(0, ...String(a.px || '').split('x').map(Number).filter(Number.isFinite)), puan: Number(a.puan) || 0 }));
  const enIyiBuyukAday = adaylar.filter((a) => a.en >= HERO_EN_AZ).reduce((m, a) => Math.max(m, a.puan), 0);
  return { kendi: kendi.length, buyuk: buyuk.length, yatay: yatay.length, enGenis, stokVar, stokTur, tur, enIyiBuyukAday };
}

// ================= 3) LOGO =================
const LOGO_ROZET = /\b(guru|travell?ers?[ _-]?choice|michelin|good[ _-]?food[ _-]?guide|zomato|yelp|google[ _-]?reviews?|top[ _-]?rated|best[ _-]?of|laureate|recommended|certified|dineout|uber[ _-]?eats|menulog|doordash|deliveroo|just[ _-]?eat)\b/i;
export function logoOlc(bilgi = {}) {
  const l = bilgi.logo; if (!l || !(l.dosya || l.kaynak)) return { var: false };
  const m = /^(\d+)x(\d+)$/.exec(String(l.boyut || '')); const w = m ? Number(m[1]) : 0; const h = m ? Number(m[2]) : 0;
  const svg = /\.svg(?:[?#]|$)/i.test(String(l.dosya || '')) || /\.svg(?:[?#]|$)/i.test(String(l.kaynak || ''));
  const ad = decodeGuvenli(String(l.kaynak || l.dosya || '').split('?')[0].split('/').pop() || '');
  const rozet = LOGO_ROZET.test(ad.replace(/[_.]+/g, ' ')) || LOGO_ROZET.test(ad) || rozetMi('', l.kaynak || l.dosya || '');
  return { var: true, w, h, svg, rozet, kisa: svg ? Infinity : Math.min(w, h), uzun: svg ? Infinity : Math.max(w, h) };
}

// ================= 4) SAAT =================
const GUN_KOK = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|pazartesi|sali|carsamba|persembe|cuma(?:rtesi)?|pazar)';
const GUN_IDX = (t) => { const k = t.slice(0, 3); if (k === 'paz') return t.startsWith('pazartesi') ? 1 : 0; if (k === 'cum') return t.startsWith('cumartesi') ? 6 : 5; return { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0, sal: 2, car: 3, per: 4 }[k]; };
const GUN_TOKEN = new RegExp(`(?<![a-z])(?:${GUN_KOK})(?![a-z])`, 'g');
const GUN_GRUP = /(?<![a-z])(?:every ?day|everyday|daily|7 days(?: a week)?|seven days|all week|her gun|haftanin her gunu|weekdays?|week ?ends?|hafta ici|hafta sonu)(?![a-z])/g;
const ARALIK = /^\s*(?:-|–|—|to|through|thru|till|until|ile)\s*$/;
const LISTE = /^\s*(?:,|&|and|\/|\+|ve)\s*$/;
const SAAT_ARALIK = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|—|to|until|till|til|ile)\s*(\d{1,2}|late|midnight)(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/g;
const GEC_RE = /(?:-|–|—|\bto\b|until|till|til|'til|’til)\s*late\b(?!\s+(?:afternoon|morning|lunch|brunch|breakfast|dinner|evening|summer|autumn|winter|spring))|\blate\b\s*(?:night)?\s*$/i;
const ETIKET_RE = /(lunch|dinner|breakfast|brunch|kitchen|happy hour|takeaway|take-away|delivery|dine[- ]in|bar\b|cellar|tasting|sunday roast|bottomless|kahvalti|aksam|ogle)/;
const TATIL = /holiday|christmas|xmas|easter|boxing day|new year|anzac|good friday|australia day|waitangi|bank holiday|st patrick|mothers day|valentine/;

function dakika(h, m, ap) { let x = Number(h); const mm = Number(m || 0); if (ap) { const p = ap[0] === 'p'; if (p && x < 12) x += 12; if (!p && x === 12) x = 0; } return x * 60 + mm; }
// metin[basla:bitis] icindeki gun jetonlarindan gun kumesi (aralik: Mon - Fri, Thursday to Tuesday = haftayi saran)
function gunKumesi(metin, basla, bitis) {
  const pen = metin.slice(basla, bitis); const g = new Set(); const jt = [...pen.matchAll(GUN_TOKEN)];
  for (let i = 0; i < jt.length; i++) {
    const a = GUN_IDX(jt[i][0]); let b = null; let aralik = false;
    if (i + 1 < jt.length) { const gap = pen.slice(jt[i].index + jt[i][0].length, jt[i + 1].index); if (ARALIK.test(gap)) { aralik = true; b = GUN_IDX(jt[i + 1][0]); } }
    if (aralik) { for (let d = a; ; d = (d + 1) % 7) { g.add(d); if (d === b) break; } i++; } else g.add(a);
  }
  return g;
}
// satirdaki gun GRUPLARI: ardisik jetonlar (aralarinda yalniz baglac / tire) tek grup; her grubun zaman bolumu bir sonraki grubun basina kadar
function gunGruplari(s) {
  const gruplar = []; let cur = null;
  for (const t of s.matchAll(GUN_TOKEN)) {
    const bas = t.index; const son = bas + t[0].length;
    if (cur && (ARALIK.test(s.slice(cur.son, bas)) || LISTE.test(s.slice(cur.son, bas)))) cur.son = son; else { if (cur) gruplar.push(cur); cur = { bas, son }; }
  }
  if (cur) gruplar.push(cur);
  for (const gk of s.matchAll(GUN_GRUP)) { const b = gk.index; const e = b + gk[0].length; if (!gruplar.some((x) => b < x.son && e > x.bas)) gruplar.push({ bas: b, son: e, ozel: gk[0] }); }
  return gruplar.sort((a, b) => a.bas - b.bas);
}
// metin -> girdiler [{ gunler:Set, kapali, araliklar:[[ac,kapa]], gec, etiket, satir }]
export function saatGirdileri(metin) {
  const satirlar = String(metin || '').split('\n').map((s) => sade(temizSatir(s))).filter(Boolean).map((s) => (TATIL.test(s) || SATIR_FIYATLI.test(s) ? '' : s));
  const out = [];
  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i]; if (!s) continue; const gr = gunGruplari(s);
    for (let k = 0; k < gr.length; k++) {
      const g = gr[k]; let gunler;
      if (g.ozel) { const o = g.ozel; gunler = /week ?ends?|hafta sonu/.test(o) ? new Set([6, 0]) : /weekdays?|hafta ici/.test(o) ? new Set([1, 2, 3, 4, 5]) : new Set([0, 1, 2, 3, 4, 5, 6]); } else gunler = gunKumesi(s, g.bas, g.son);
      if (!gunler.size) continue;
      let zaman = s.slice(g.son, k + 1 < gr.length ? gr[k + 1].bas : s.length); let ilerle = 0;
      while (!/\d|closed|kapali|\blate\b/.test(zaman) && ilerle < 2 && i + 1 + ilerle < satirlar.length && satirlar[i + 1 + ilerle] && !gunGruplari(satirlar[i + 1 + ilerle]).length) { zaman += ' ' + satirlar[i + 1 + ilerle]; ilerle++; }
      if (!/\d|closed|kapali|\blate\b/.test(zaman)) continue;
      const yakin = zaman.trim().slice(0, 30); const kapali = /\b(closed|kapali)\b/.test(yakin) && !/\d{1,2}\s?(?:am|pm)|\d{1,2}[:.]\d{2}/.test(yakin);
      const araliklar = []; let gec = false;
      for (const m of zaman.matchAll(SAAT_ARALIK)) {
        const ap1 = m[3] || (m[6] && Number(m[1]) <= Number(m[4]) ? m[6] : '');
        if (/^late$/.test(m[4])) { gec = true; continue; }
        araliklar.push([dakika(m[1], m[2], ap1), /^midnight$/.test(m[4]) ? 24 * 60 : dakika(m[4], m[5], m[6] || '')]);
      }
      if (GEC_RE.test(zaman)) gec = true;
      if (!kapali && !araliklar.length && !gec) continue;
      const onc = (s.slice(0, g.bas) + ' ' + (i > 0 ? satirlar[i - 1] : '')).trim();
      const et = ETIKET_RE.exec(onc.slice(-60)); out.push({ gunler, kapali, araliklar, gec, etiket: et ? et[1] : '', satir: i });
    }
  }
  return out;
}
// girdiler -> { celiski: [neden], tutarsiz: bool, acik: Set, kapali: Set, gec: bool }
export function saatCoz(girdiler) {
  const tekil = new Map(); for (const g of girdiler) tekil.set(`${[...g.gunler].sort().join('')}|${g.kapali}|${g.araliklar.map((a) => a.join('-')).join(',')}|${g.gec}|${g.etiket}`, g);
  const L = [...tekil.values()]; const celiski = []; const acik = new Set(); const kapali = new Set(); let gec = false; let tutarsiz = false; let kucukFark = false;
  for (const g of L) { if (g.gec) gec = true; for (const d of g.gunler) { if (g.kapali) kapali.add(d); else acik.add(d); } }
  for (let d = 0; d < 7; d++) {
    const o = L.filter((g) => g.gunler.has(d));
    for (const et of new Set(o.map((g) => g.etiket))) {
      const a = o.filter((g) => g.etiket === et);
      if (a.some((g) => g.kapali) && a.some((g) => !g.kapali && (g.araliklar.length || g.gec))) celiski.push(`gun ${d}: hem kapali hem acik`);
      const ac = a.filter((g) => !g.kapali && g.araliklar.length);
      for (let i = 0; i < ac.length; i++) for (let j = i + 1; j < ac.length; j++) {
        const x = ac[i].araliklar[0]; const y = ac[j].araliklar[0];
        if (!(x[0] < y[1] && y[0] < x[1])) continue; // ayrik araliklar (ogle + aksam) celiski degil
        if (Math.abs(x[0] - y[0]) >= 60 || Math.abs(x[1] - y[1]) >= 120) celiski.push(`gun ${d}: ${x.join('-')} ile ${y.join('-')} celisiyor`);
        else if (Math.abs(x[0] - y[0]) >= 30 || Math.abs(x[1] - y[1]) >= 30) kucukFark = true;
      }
    }
  }
  // ayni etiket ve ayni saat, gun kumesi biri digerinin ALT kumesi (Tue-Sun / Wed-Sun)
  const ac = L.filter((g) => !g.kapali && g.araliklar.length);
  for (const a of ac) for (const b of ac) if (a !== b && a.etiket === b.etiket && a.araliklar.join() === b.araliklar.join() && a.gunler.size > b.gunler.size && b.gunler.size >= 3 && [...b.gunler].every((d) => a.gunler.has(d))) tutarsiz = true;
  return { celiski: [...new Set(celiski)], tutarsiz, kucukFark, acik, kapali, gec };
}
// bilgi.json saat kaydinda anlamsiz aralik: sabah acilip gece yarisindan sonra kapanan, 18 saati asan ya da 00:00'da baslayan
export function saatCop(saat = {}) {
  const w = saat.week || []; const bd = saat.byDay || []; const nedenler = [];
  w.forEach((x, d) => { if (!x) return; const [a, k] = x; if (k < a && a < 12 * 60) nedenler.push(`gun ${d}: ${a}-${k} sabah acilip gece kapaniyor`); else if (k >= a && k - a > 18 * 60) nedenler.push(`gun ${d}: 18 saatten uzun`); });
  bd.forEach((x, d) => { if (typeof x === 'string' && /(?:^|,\s*)00:00\S{1,3}\d/.test(x)) nedenler.push(`gun ${d}: 00:00 ile baslayan aralik`); });
  return nedenler;
}
export function saatOlc(bilgi = {}, metin = '') {
  const saat = bilgi.saat || {}; const w = saat.week || [];
  const girdi = saatGirdileri(metin); const c = saatCoz(girdi); const cop = saatCop(saat);
  const acikGun = new Set([...c.acik]); w.forEach((x, d) => { if (x) acikGun.add(d); });
  const kapaliGun = new Set([...c.kapali].filter((d) => !acikGun.has(d)));
  const bilinmeyen = saat.tableOk === true ? 0 : [0, 1, 2, 3, 4, 5, 6].filter((d) => !acikGun.has(d) && !kapaliGun.has(d)).length;
  return { acik: acikGun.size, kapali: kapaliGun.size, bilinmeyen, gec: c.gec, celiski: c.celiski, tutarsiz: c.tutarsiz, kucukFark: c.kucukFark, cop, girdi: girdi.length, kaynak: saat.kaynak || null };
}

// ================= 5) ZINCIR / GRUP =================
const KAPANDI = /\b(?:permanently closed|closed permanently|has (?:now )?closed down|we(?:'ve| have) closed|closed (?:its|our) doors|ceased trading|our last day was|final day of trading)\b/i;
const KARDES = /\bsister (?:restaurants?|venues?|pubs?|cafes?|bars?|sites?|businesses|brands?|companies|stores?)\b/i;
const MERKEZ = /\bhead office\b/i;
const KONUMLAR = /(?:^|\n)\s*(?:our |other |all |more )?locations\s*(?:\n|$)|\b(?:our|other|all|more)\s+(?:\w+\s+){0,2}locations\b|\blocations across\b|\b(?:visit|find) our (?:stores?|branches|shops|restaurants|cafes)\b/i;
const SUBE_SATIR = /^[ \t]*[\p{L}'’.-]+(?:[ \t]+[\p{L}'’.-]+)?[ \t]+[Şş]ube[ \t]*:?[ \t]*$/gmu;
export function zincirOlc(metin = '') {
  const m = String(metin || ''); const sert = []; const yumusak = [];
  const z = ZINCIR_METIN.exec(m) || TR_ZINCIR_METIN.exec(m); if (z) sert.push(`zincir/franchise yazisi: "${z[0].slice(0, 50)}"`);
  const p = /part of\s+(?:the\s+)?([^.,\n]{1,60}?)\s+(group|hospitality|collective|holdings)\b/i.exec(m); if (p && /^[A-Z]/.test(p[1].trim())) sert.push(`bir grubun parcasi: "${p[0].slice(0, 60)}"`);
  const k = KARDES.exec(m); if (k) sert.push(`kardes mekanlar: "${k[0]}"`);
  if (MERKEZ.test(m)) sert.push('merkez ofis / subeler');
  const l = KONUMLAR.exec(m); if (l) sert.push(`birden cok konum: "${l[0].trim().slice(0, 40)}"`);
  const sb = [...new Set([...m.matchAll(SUBE_SATIR)].map((x) => x[0].trim().toLowerCase()))]; if (sb.length >= 2) sert.push(`birden cok sube (${sb.length})`);
  const kp = KAPANDI.exec(m); if (kp) sert.push(`isletme kapanmis: "${kp[0]}"`);
  const g = /\b(?:[A-Z][\w&'’-]+\s+){1,3}(?:Group|Hospitality)\b(?!\s+(?:booking|bookings|menu|menus|dining|enquir|function|event|order|reservation|size|rate|lunch|dinner|chat))/.exec(m); if (g) yumusak.push({ k: 'grup-adi', p: 15, neden: `grup adi gibi: "${g[0].slice(0, 40)}"` });
  const adresler = new Set([...m.matchAll(/\b\d{1,5}[A-Za-z]?\s+[A-Z][\w'’.]+(?:\s+[A-Z][\w'’.]+){0,3}\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Quay|Square|Place|Terrace|Parade|Drive|Dr|Way|Row|Court|Ct|Highway|Hwy|Boulevard|Blvd)\b/g)].map((x) => x[0].toLowerCase().replace(/[^a-z0-9]+/g, '')));
  if (adresler.size >= 3) yumusak.push({ k: 'cok-adres', p: 12, neden: `metinde ${adresler.size} ayri sokak adresi` });
  return { sert, yumusak };
}

// ================= 6) MEVCUT SITE GUCU (agirlik) =================
const REZ_MOTOR = /(sevenrooms|opentable|resdiary|resy\.com|tock(?:tix)?\.com|tablepath|bookedin|dojo\.app|quandoo|bookatable|eveve|nowbookit|tablein|zenchef|thefork|designmynight|tablecheck|restaurant ?hub|mobi-booking|tableagent)/i;
const MODERN = /(webflow|w-embed|w-nav|sqs-|squarespace|framer|__next|next\.js|nuxt|gatsby|astro|shopify|vercel|netlify)/i;
export function siteGucOlc(bilgi = {}, cik = null) {
  const g = []; const ek = (k, p, neden) => g.push({ k, p, neden });
  const rez = bilgi.rezervasyon && bilgi.rezervasyon.url; const siparis = bilgi.siparis && bilgi.siparis.url;
  if (rez && REZ_MOTOR.test(rez)) ek('rezervasyon-motoru', 1.5, 'gercek cevrimici rezervasyon motoru');
  else if (rez) ek('rezervasyon-baglantisi', 0.5, 'rezervasyon baglantisi');
  if (siparis) ek('siparis-baglantisi', 0.5, 'cevrimici siparis baglantisi');
  if (cik) {
    const sayfa = Array.isArray(cik.pages) ? cik.pages.length : 0; if (sayfa >= 4) ek('cok-sayfa', 1, `${sayfa} sayfa okundu`);
    const sinif = ((cik.slogan && cik.slogan.cands) || []).map((c) => String(c.cls || '')).join(' ');
    const yaz = JSON.stringify((cik.fonts && cik.fonts.loaded) || []);
    if (MODERN.test(sinif) || MODERN.test(yaz)) ek('modern-altyapi', 1, 'modern site altyapisi (sinif/yazi izi)');
    if (cik.erisim && /^https:/i.test(String(cik.erisim.finalUrl || ''))) { const vp = !((bilgi.eski_site_bulgulari || []).some((b) => b.k === 'viewport-yok')); if (vp) ek('https-duyarli', 0.5, 'https + duyarli (viewport)'); }
  }
  return { agirliklar: g, toplam: g.reduce((s, x) => s + x.p, 0) };
}

// bilgi.gorsel_uyari: "3/10 kare uretilmis gorsel olcusunde (1376x768, 1024x1024 ...)" -> { n, toplam }
export function uretilmisKare(uyari) { const m = /(\d+)\s*\/\s*(\d+)\s+kare\s+uretilmis/i.exec(String(uyari || '')); return m ? { n: Number(m[1]), toplam: Number(m[2]) } : { n: 0, toplam: 0 }; }

// ================= PUANLAMA =================
export function paketOzellik(paketDir, { pdfMetin = pdfMetniOku } = {}) {
  const bilgi = J(path.join(paketDir, 'bilgi.json'), {}) || {}; const metin = oku(path.join(paketDir, 'metin.txt'));
  const cik = J(path.join(path.dirname(paketDir), 'cikarici.json'), null);
  return {
    slug: bilgi.slug || path.basename(path.dirname(paketDir)), ad: bilgi.ad || '', bolge: bilgi.bolge || '', sablon: bilgi.sablon || '',
    menu: menuOlc(paketDir, bilgi, { pdfMetin }), hero: heroOlc(bilgi), logo: logoOlc(bilgi), saat: saatOlc(bilgi, metin), zincir: zincirOlc(metin), guc: siteGucOlc(bilgi, cik),
    fotoSayisi: (bilgi.fotograflar || []).filter((f) => f.kaynak !== 'stok' && String(f.uyum || '').startsWith('uygun')).length,
    uretilmis: uretilmisKare(bilgi.gorsel_uyari),
    eski: (bilgi.eski_site_bulgulari || []).reduce((s, x) => s + (Number(x.p) || 0), 0),
    eylem: (bilgi.eylem && bilgi.eylem.tur) || null, eylemUrl: !!((bilgi.eylem && bilgi.eylem.url) || (bilgi.rezervasyon && bilgi.rezervasyon.url) || (bilgi.siparis && bilgi.siparis.url)),
    telefonVar: !!bilgi.telefon,
  };
}
// ozellik -> { gecer, puan, sert:[{k,neden}], yumusak:[{k,p,neden}], bilesenler }.  puan 0..~100 (yalniz siralama icin); sert kural varsa gecer=false.
export function puanla(o) {
  const sert = []; const yumusak = []; const bil = {}; const S = (k, neden) => sert.push({ k, neden }); const Y = (k, p, neden) => yumusak.push({ k, p, neden });
  // menu (0..25)
  const m = o.menu;
  if (m.kind === 'metin') bil.menu = Math.min(25, 18 + (m.adet - MENU_EN_AZ) * 0.75);
  else if (m.kind === 'pdf-resim' || m.kind === 'gorsel') { bil.menu = 14; Y('menu-dogrulanamadi', 0, m.kind === 'gorsel' ? 'menu gorsel olarak, yemek adlari okunamiyor' : 'menu PDF, metni okunamadi'); }
  else { bil.menu = 0; S('menu', `menude ${MENU_EN_AZ} adli yemek yok (${m.adet} bulundu; ${(m.notlar || []).join('; ') || 'yalniz baslik / gezinti metni'})`); }
  // ana fotograf (0..25 + aday puani)
  const h = o.hero;
  if (h.yatay > 0) bil.hero = h.enGenis >= 3000 ? 25 : 22;
  else if (h.buyuk > 0) bil.hero = 15;
  else if (h.stokVar) bil.hero = 12;
  else if (h.stokTur) bil.hero = 9;
  else { bil.hero = 0; S('hero', `kendi ${HERO_EN_AZ} px+ kare yok (en genis ${h.enGenis} px) ve yemegi acikca uyan stok turu degil (${h.tur})`); }
  bil.heroAday = h.enIyiBuyukAday ? Math.max(-2, Math.min(3, (h.enIyiBuyukAday - 60) / 10)) : 0;
  bil.foto = Math.min(10, o.fotoSayisi);
  if (o.uretilmis.n >= 3) S('foto', `${o.uretilmis.n}/${o.uretilmis.toplam} kare uretilmis gorsel olcusunde (yapay gorunumlu set)`); else if (o.uretilmis.n >= 1) Y('uretilmis-foto', 5, `${o.uretilmis.n} kare uretilmis gorsel olcusunde`);
  if (o.fotoSayisi < 5) Y('az-foto', 8, `${o.fotoSayisi} kullanilabilir kendi foto (en az 5)`);
  // logo (0..10)
  const l = o.logo;
  if (!l.var) { bil.logo = 0; S('logo', 'logo yok'); } else {
    if (l.rozet) S('logo', 'logo yerinde odul / degerlendirme rozeti');
    if (!l.svg && (l.kisa < LOGO_KISA_EN_AZ || l.uzun < LOGO_UZUN_EN_AZ)) S('logo', `logo okunmayacak kadar kucuk (${l.w}x${l.h}; en az ${LOGO_UZUN_EN_AZ} px uzun, ${LOGO_KISA_EN_AZ} px kisa kenar)`);
    bil.logo = l.svg || l.uzun >= 600 ? 10 : l.uzun >= 300 ? 8 : l.uzun >= 200 ? 5 : l.uzun >= 150 ? 3 : 1;
  }
  // saat (0..15)
  const s = o.saat;
  if (s.acik === 0) S('saat', 'hicbir gunun acilis saati cozulemedi');
  if (s.gec) S('saat', "kapanis saati 'late' (saat yok)");
  if (s.celiski.length) S('saat', `celisen saat satirlari (${s.celiski[0]})`);
  if (s.cop.length) S('saat', `anlamsiz saat kaydi (${s.cop[0]})`);
  if (s.tutarsiz) Y('saat-tutarsiz', 12, 'ayni saat iki farkli gun kumesiyle yaziyor');
  if (s.kucukFark) Y('saat-kucuk-fark', 4, 'ayni gunun saatleri 30-120 dk farkli yaziyor');
  bil.saat = Math.max(0, 15 - s.bilinmeyen * 2);
  // zincir
  for (const x of o.zincir.sert) S('zincir', x);
  for (const x of o.zincir.yumusak) Y(x.k, x.p, x.neden);
  // eylem (0..5), zayif site (0..8), guclu site (agirlik)
  bil.eylem = o.eylemUrl ? 5 : o.eylem === 'telefon' ? 3 : 0;
  bil.zayifSite = Math.min(8, o.eski);
  const guc = o.guc.toplam * 1.5; if (guc > 0) Y('site-guclu', guc, o.guc.agirliklar.map((x) => x.k).join(', '));
  if (!o.eylemUrl && !o.telefonVar) S('eylem', 'ne siparis/rezervasyon baglantisi ne telefon var');
  const toplam = Object.values(bil).reduce((a, b) => a + b, 0) - yumusak.reduce((a, b) => a + b.p, 0);
  return { gecer: sert.length === 0, puan: +toplam.toFixed(1), sert, yumusak, bilesenler: bil };
}

// ayni adli kardes paketler (al-arez / al-arez-2 / al-arez-express): ayni ilk iki sozcuk ya da tek uzun sozcuk
const adAnahtar = (ad) => sade(ad).replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(the|cafe|restaurant|bar|kitchen|express|2|3|ii)\b/g, ' ').replace(/\s+/g, ' ').trim();
export function kardesler(ozellikler) {
  const out = new Map(); const A = ozellikler.map((o) => ({ o, k: adAnahtar(o.ad).split(' ').filter(Boolean) }));
  for (const a of A) for (const b of A) {
    if (a === b || !a.k.length || !b.k.length) continue; const n = Math.min(2, a.k.length, b.k.length);
    if (a.k.slice(0, n).join(' ') === b.k.slice(0, n).join(' ') && (n >= 2 || a.k[0].length >= 6)) out.set(a.o.slug, `ayni adli baska paket: ${b.o.slug}`);
  }
  return out;
}

export function suzgec(ozellikler, { ilk = ILK_VARSAYILAN, min = MIN_PUAN } = {}) {
  const kd = kardesler(ozellikler);
  const hepsi = ozellikler.map((o) => { const r = puanla(o); if (kd.has(o.slug)) { r.sert.push({ k: 'zincir', neden: kd.get(o.slug) }); r.gecer = false; } return { slug: o.slug, ad: o.ad, bolge: o.bolge, sablon: o.sablon, ...r }; });
  const gecenler = hepsi.filter((r) => r.gecer && r.puan >= min).sort((a, b) => b.puan - a.puan);
  return { liste: gecenler.slice(0, ilk), gecenler, elenenler: hepsi.filter((r) => !r.gecer).sort((a, b) => b.puan - a.puan), dusukPuan: hepsi.filter((r) => r.gecer && r.puan < min), hepsi };
}

// <veri>/<slug>/paket klasorlerini topla (durum filtresi: kapi.json status)
export function paketleriBul(veri, { durum = 'icerik-bekliyor' } = {}) {
  const out = [];
  for (const d of fs.readdirSync(veri).sort()) {
    const pk = path.join(veri, d, 'paket'); if (!fs.existsSync(path.join(pk, 'bilgi.json'))) continue;
    if (durum) { const k = J(path.join(veri, d, 'kapi.json'), null); if (!k || k.status !== durum) continue; }
    out.push(pk);
  }
  return out;
}
// icerik karari verilmis slug'lar: <kok>/<klasor>/karar/w2a/<slug>.json (icerik turunun her partisi ayri klasor); yeniden incelenmez (biten olcum tekrarlanmaz)
export function kararVerilmis(kok) {
  const out = new Set();
  let ust = []; try { ust = fs.readdirSync(kok, { withFileTypes: true }); } catch { return out; }
  for (const e of ust) {
    if (!e.isDirectory()) continue; const d = path.join(kok, e.name, 'karar', 'w2a');
    let f = []; try { f = fs.readdirSync(d); } catch { continue; }
    for (const x of f) if (/\.json$/i.test(x)) out.add(x.slice(0, -5));
  }
  return out;
}
// slug listesi dosyasi (satir satir; # yorum)
export const slugDosyasi = (f) => new Set(oku(f).split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#')));
// paket klasorleri -> yalniz haric listesinde olmayan ve (varsa) kapi.json'u verilen zamandan yeni olanlar
export function paketSuz(dirs, { haric = new Set(), yeniSonra = 0 } = {}) {
  return dirs.filter((d) => {
    const slug = path.basename(path.dirname(d)); if (haric.has(slug)) return false;
    if (yeniSonra) { try { if (fs.statSync(path.join(path.dirname(d), 'kapi.json')).mtimeMs < yeniSonra) return false; } catch { return false; } }
    return true;
  });
}
// uretim.mjs'ten: tek paketin puani paket/on-suzgec.json'a (durum degismez, kalici eleme degil)
export function suzgecYaz(paketDir, opts) {
  try { const o = paketOzellik(paketDir, opts); const r = puanla(o); fs.writeFileSync(path.join(paketDir, 'on-suzgec.json'), JSON.stringify({ surum: SURUM, at: new Date().toISOString(), gecer: r.gecer, puan: r.puan, sert: r.sert, yumusak: r.yumusak, bilesenler: r.bilesenler }, null, 1)); return r; } catch { return null; }
}

// ---- CLI ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const bayrak = (k) => process.argv.includes(k);
  const veri = arg('--veri', ''); if (!veri) { console.error('kullanim: node hat/paket-suzgec.mjs --veri <veri klasoru> [--durum icerik-bekliyor|hepsi] [--ilk 6] [--min 60] [--yaz] [--json dosya] [--hepsi] [--karar-kok <klasor>] [--haric <slug dosyasi>] [--yeni-sonra <ISO zaman>]'); process.exit(2); }
  // --karar-kok: icerik karari verilmis paketleri atla (<kok>/*/karar/w2a/<slug>.json); --haric: slug dosyasi (on bakista elenenler); --yeni-sonra: yalniz kapi.json'u bu zamandan yeni olanlar
  const haric = new Set([...(arg('--karar-kok') ? kararVerilmis(arg('--karar-kok')) : []), ...(arg('--haric') ? slugDosyasi(arg('--haric')) : [])]);
  const durum = arg('--durum', 'icerik-bekliyor'); const dirs = paketSuz(paketleriBul(veri, { durum: durum === 'hepsi' ? null : durum }), { haric, yeniSonra: arg('--yeni-sonra') ? Date.parse(arg('--yeni-sonra')) : 0 });
  const ilk = Number(arg('--ilk', ILK_VARSAYILAN)); const min = Number(arg('--min', MIN_PUAN));
  const oz = dirs.map((d) => paketOzellik(d)); const r = suzgec(oz, { ilk, min });
  if (bayrak('--yaz')) for (const d of dirs) suzgecYaz(d);
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(r.hepsi.map((x) => ({ slug: x.slug, gecer: x.gecer, puan: x.puan, sert: x.sert.map((s) => `${s.k}: ${s.neden}`), yumusak: x.yumusak.map((s) => `${s.k}(-${s.p})`) })), null, 1));
  console.log(`paket ${dirs.length} | sert kurali gecen ${r.gecenler.length + r.dusukPuan.length} | puan >= ${min}: ${r.gecenler.length} | elenen ${r.elenenler.length}`);
  const nedenSay = {}; for (const e of r.elenenler) for (const k of new Set(e.sert.map((x) => x.k))) nedenSay[k] = (nedenSay[k] || 0) + 1;
  console.log('ret nedenleri (bir paket birden cok nedene girebilir):', JSON.stringify(nedenSay));
  console.log(`\nKISA LISTE (icerik turune gidecek, ilk ${ilk}):`);
  r.liste.forEach((x, i) => console.log(`${String(i + 1).padStart(2)}. ${x.puan.toFixed(1).padStart(5)}  ${x.slug}  [${x.bolge} ${x.sablon}]${x.yumusak.length ? '  uyari: ' + x.yumusak.map((y) => y.k).join(', ') : ''}`));
  if (bayrak('--hepsi')) { console.log('\nGECENLER (liste disi):'); r.gecenler.slice(ilk).forEach((x) => console.log(`    ${x.puan.toFixed(1).padStart(5)}  ${x.slug}`)); console.log('\nELENENLER:'); r.elenenler.forEach((x) => console.log(`    ${x.slug}: ${x.sert.map((s) => s.k).join(',')}`)); }
}
