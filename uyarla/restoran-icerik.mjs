// RESTORAN ICERIK KARARI (11 Kas 2026): inceleme turunun yazdigi karar/<parti>/<slug>.json (tur "icerik") -> denetim -> <veri>/<slug>/icerik.json
// (v5 icin uret-v5.mjs'in elle kaydi, kategori icin uret-kategori.mjs'in kaydi).  Model yok, ag yok.
// Karar bicimi (ornekler: inceleme/ornek/<sablon>.json; kurallar: inceleme/ROUTINE.md "Restoran icerik turu"):
//   { tur: 'icerik', karar: 'icerik'|'gozden-gecir'|'elendi', neden, inceleyen: 'icerik-turu'|'sonGoz', sablon: 'v5'|'burger'|'burrito'|'pizza'|'pastane'|'sokak',
//     hero: { id, gerekce, reddedilen: [{ id, neden }] },
//     menu: { kaynak: { tur: 'sayfa'|'pdf'|'gorsel'|'siparis-sitesi', url, dosya, sayfa }, kalemler: [{ n, d, p, cat }] },
//     saat: { satirlar: [...], kaynak } | null,   eylem: { url, tur: 'siparis'|'rezervasyon' },
//     icerik: { ...sablonun kendi alanlari (ornek dosyadaki gibi); menu kalemleri, kahraman, saat ve eylem yukaridan eklenir },
//     gozlem: { metin: 'mailin ilk cumlesi: mevcut sitenin dogru ve isletmeye ozel bir gozlemi', kanit } }
// denetle() HATA listesi dondurur: tek hata bile karari uygulatmaz (gozden-gecir).  Uydurma onlemi: serbest metindeki her sayi ve her ovgu sozcugu
// sitenin kendi metninde (metin.txt) gecmeli; fiyatlar metin kaynakli menude (sayfa/siparis satirlari) kaynak dosyada aynen bulunmali.
import fs from 'node:fs';
import path from 'node:path';
import { sloganDogrula } from './lib/slogan.mjs';
import { SABLONLAR, KATEGORILER } from './sablon-sec.mjs';
import { yasakVar } from './lib/sozluk.mjs';
import { yuvaDenetle, sade as sadeAd } from './lib/foto-uyum.mjs';
import { telEylemEtiket } from './lib/metin.mjs';
import { kesimGecerli } from './lib/kesme-v5.mjs';

const ID = /^\d{2}$/;
const FIYAT = /^(?:from\s+)?[£€$]\s?\d{1,4}(?:[.,]\d{2})?(?:\s?(?:\/|or|–|-)\s?[£€$]?\s?\d{1,4}(?:[.,]\d{2})?)?$/i;
// TR fiyat (11 Kas 2026): ₺450, ₺1.250, 450 TL, 450,00 ₺, 120-150 TL
export const FIYAT_TR = /^(?:₺\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s?(?:₺|TL))(?:\s?(?:\/|–|-|ya da)\s?(?:₺\s?)?\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s?(?:₺|TL)?)?$/u;
// Turkce ovgu sozcukleri: sitenin kendi metninde yoksa sayfaya yazilmaz (uydurma iddia olmaz)
const OVGU_TR = /(?<!\p{L})(en iyi|en lezzetli|meşhur|ünlü|efsane|efsanevi|dünyaca|ödüllü|bir numara|eşsiz|rakipsiz|benzersiz|otantik|kusursuz|mükemmel)(?!\p{L})/giu;
const OVGU = /\b(best|award[- ]?winning|awards?|#1|number one|famous|finest|world[- ]class|legendary|unbeatable|perfect|ultimate|iconic|renowned|top[- ]rated|must[- ]try|unrivall?ed|authentic)\b/gi;
const YASAK_KARAKTER = /[—→←✓✔✅!]|\p{Extended_Pictographic}/u;
// Anadil duzeyinde Turkce (KALICI kural, 12 Kas 2026: "cümleler falan düşük olmasın kelime olarak, düzgün Türkçe kullan sloganlarda ve içeriklerde"):
// kalip davet, kelime kelime ceviri, tuhaf edilgen, resmi "-mektedir" ve sik yazim hatalari TR kararinda hata sayilir; isletmenin kendi cumlesi
// bozuksa hafifce duzeltilir ya da kisa, dogru bir cumleyle degistirilir (bilgi uydurulmaz).  Liste canli sayfalarda bulunan orneklerden.
export const TR_YAPAY = [
  [/seçkilerimizi keşfedin|lezzetli seçki/iu, 'kalıp davet ("Lezzetli seçkilerimizi keşfedin")'],
  [/(?<!\p{L})keşfedin(?!\p{L})/iu, 'kalıp davet ("keşfedin")'],
  [/yola çıkıldı/iu, 'tuhaf edilgen ("köfteden yola çıkıldı")'],
  [/(?:sayfasındaki|menüsündeki|dosyasındaki|sitesindeki) gibidir/iu, 'resmî kalıp ("... gibidir"); "Fiyatlar ...\'daki menüden alındı." gibi yazılır'],
  [/(?<!\p{L})\p{L}{2,}(?:mektedir|maktadır)(?!\p{L})/iu, 'resmî "-mektedir/-maktadır" ("Rezervasyon kabul edilmemektedir" yerine "Rezervasyon almıyoruz")'],
  [/tencereden ızgaraya/iu, 'yapay başlık ("Günlük tencereden ızgaraya")'],
  [/damak sulandıran/iu, 'çeviri ("mouthwatering")'],
  [/yerel olarak tedarik/iu, 'çeviri ("locally sourced")'],
  [/(?<!\p{L})ip lamba/iu, 'çeviri ("string lights"): "asılı ampuller"'],
  [/(?<!\p{L})derin (?:yeşil|mavi|kırmızı|mor)(?!\p{L})/iu, 'çeviri ("deep green"): "koyu yeşil"'],
  [/restoran sıralanmış/iu, 'kelime kelime çeviri ("restaurant-lined")'],
  [/ateşinin karakteri/iu, 'çeviri ("character of the fire")'],
  [/atmosferi? ile tasarlan/iu, 'çeviri ("designed with a garden atmosphere")'],
  [/(?<!\p{L})mahsül/iu, 'yazım: "mahsul" ("deniz mahsullü")'],
  [/(?<!\p{L})yıldönüm/iu, 'yazım: "yıl dönümü"'],
  [/(?:den|dan|ten|tan) bu güne(?!\p{L})/iu, 'yazım: "bugüne" ("1971\'den bugüne")'],
  [/kremamsı/iu, 'yazım: "kremsi"'],
  [/(?<!\p{L})mono adet/iu, 'meslek ağzı: "tek kişilik"'],
  [/(?<!\p{L})lahana turşu(?!\p{L})/iu, 'eksik ek: "lahana turşusu"'],
];
// vurgu yildizlari ("Günlük tencereden *ızgaraya*") denetimden once atilir
export const trYapay = (t) => { const s = String(t || '').replace(/\*/g, ''); return TR_YAPAY.filter(([re]) => re.test(s)).map(([, neden]) => neden); };
const KAYNAK_TUR = ['sayfa', 'pdf', 'gorsel', 'siparis-sitesi'];

// karar icindeki butun serbest metinler (yol, metin) listesi
export function metinler(o, yol = '') {
  const out = [];
  if (typeof o === 'string') out.push([yol, o]);
  else if (Array.isArray(o)) o.forEach((x, i) => out.push(...metinler(x, `${yol}[${i}]`)));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (/^(url|link|kaynak|dosya|pic|id|sprite|renk|hud|tema|tema2|odak|heroOdak|tz|kategori|sablon|neden|foto_not|heroNeden|gerekce|kanit|cat|sayfa|foto|kareler|hero|haric|rez|isaret|order|sec|hedef|heroKirp|dil|palet|menuFoto|sekmeFoto|kesimler|kutu)$/i.test(k)) continue; out.push(...metinler(v, yol ? `${yol}.${k}` : k)); }
  return out;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');

// icerik.ust: { sahne: { foto, yemek, alt, fx, fy }, menuFoto: { "<kalem adi>": "09" }, sekmeFoto: { "<bolum adi>": "06" }, galeri: { foto: [...], kicker, h2, p }, iz: { kesimler: [{ ad, foto, kutu, elips }] } }
export function ustDenetle(u, ctx = {}, kalemler = []) {
  const H = []; const var_ = (id) => !ctx.fotoIds || ctx.fotoIds.includes(String(id));
  if (!u || typeof u !== 'object' || Array.isArray(u)) return ['icerik.ust nesne olmali'];
  const adlar = new Set(kalemler.map((x) => sadeAd(x && x.n))); const bolumler = new Set(kalemler.map((x) => sadeAd(x && x.cat)).filter(Boolean));
  const S = u.sahne; if (S != null) {
    if (!ID.test(String(S.foto || '')) || !var_(S.foto)) H.push(`ust.sahne.foto fotograflarda yok: ${S.foto}`);
    if (!adlar.has(sadeAd(S.yemek))) H.push(`ust.sahne.yemek menude yok (kalem adi aynen): ${S.yemek}`);
    for (const a of ['fx', 'fy']) if (S[a] != null && !(typeof S[a] === 'number' && S[a] >= 0 && S[a] <= 1)) H.push(`ust.sahne.${a} 0..1 olmali`);
  }
  for (const [ad, id] of Object.entries(u.menuFoto || {})) { if (!adlar.has(sadeAd(ad))) H.push(`ust.menuFoto: "${ad}" menude yok`); if (!ID.test(String(id)) || !var_(id)) H.push(`ust.menuFoto: fotograf yok ${id}`); }
  for (const [ad, id] of Object.entries(u.sekmeFoto || {})) { if (!bolumler.has(sadeAd(ad))) H.push(`ust.sekmeFoto: bolum yok "${ad}" (kalemlerin cat alani)`); if (!ID.test(String(id)) || !var_(id)) H.push(`ust.sekmeFoto: fotograf yok ${id}`); }
  if (u.galeri && u.galeri.foto != null) { if (!Array.isArray(u.galeri.foto)) H.push('ust.galeri.foto liste olmali'); else for (const id of u.galeri.foto) if (!ID.test(String(id)) || !var_(id)) H.push(`ust.galeri.foto yok: ${id}`); }
  const kes = (u.iz && u.iz.kesimler) || [];
  if (u.iz && !Array.isArray(kes)) H.push('ust.iz.kesimler liste olmali');
  else for (const [i, c] of kes.entries()) { const r = kesimGecerli(c); if (r) H.push(`ust.iz.kesimler[${i}]: ${r}`); else if (!var_(c.foto)) H.push(`ust.iz.kesimler[${i}].foto yok: ${c.foto}`); }
  return H;
}
// k: karar; ctx: { ad, fotoIds, metin (metin.txt), kaynakDosya: (rel) => icerik|null, kaynaklar (bilgi.menu_kaynaklari), adaylar (hero_adaylari) }
export function denetle(k, ctx = {}) {
  const H = [];
  if (!k || typeof k !== 'object') return ['karar dosyasi bozuk'];
  if (k.tur !== 'icerik') H.push('tur "icerik" olmali');
  if (!['icerik', 'gozden-gecir', 'elendi'].includes(k.karar)) H.push(`karar gecersiz: ${k.karar}`);
  if (k.karar !== 'icerik') return H;
  if (!SABLONLAR.includes(k.sablon)) H.push(`sablon gecersiz: ${k.sablon}`);
  if (!['icerik-turu', 'son-goz'].includes(k.inceleyen)) H.push('inceleyen icerik-turu ya da son-goz olmali');
  // kahraman: gozle secilen tek kare + gerekce
  const h = k.hero || {};
  if (!ID.test(String(h.id || ''))) H.push('hero.id iki haneli fotograf kimligi olmali');
  else if (ctx.fotoIds && !ctx.fotoIds.includes(String(h.id))) H.push(`hero.id fotograflarda yok: ${h.id}`);
  if (String(h.gerekce || '').length < 25) H.push('hero.gerekce yok ya da cok kisa (neden bu kare: yemek ya da mekan, uzerinde yazi/logo yok, keskin)');
  for (const r of h.reddedilen || []) if (!ID.test(String(r.id || '')) || !r.neden) H.push('hero.reddedilen ogeleri { id, neden } olmali');
  // 12 Kas FOTO UYUMU (lib/foto-uyum.mjs): her yuvadaki kare paketin foto uyumu listesinde "uygun" olmali (logo, harita, ikon, kucuk, bulanik, ture uymayan stok yok);
  // uyan kare yoksa yuva bos birakilir (sablon daraltir).  Eski paketlerde (foto_uyum yok) denetim atlanir.
  if (ctx.bilgi && ctx.bilgi.foto_uyum) H.push(...yuvaDenetle(k, ctx.bilgi.foto_uyum));
  // 12 Kas UST KATMAN (lib/ust-v5.mjs; yalniz v5): isteye bagli icerik.ust blogu.  Kimlikler paketteki fotograflarda olmali, kesim kutulari 0..1; gecmeyen ogeyi uretici sessizce atlamaz, burada hata olur.
  if (k.sablon === 'v5' && k.icerik && k.icerik.ust != null) H.push(...ustDenetle(k.icerik.ust, ctx, (k.menu && k.menu.kalemler) || []));
  // menu: en az 6 fiyatli kalem, kaynak kayitli ve robots izinli
  const m = k.menu || {}; const kal = Array.isArray(m.kalemler) ? m.kalemler : [];
  if (kal.length < 6) H.push(`fiyatli menu en az 6 kalem olmali (${kal.length})`);
  for (const [i, x] of kal.entries()) { if (!x || !String(x.n || '').trim()) H.push(`menu.kalemler[${i}] adi yok`); else if (!FIYAT.test(String(x.p || '').trim()) && !FIYAT_TR.test(String(x.p || '').trim())) H.push(`menu.kalemler[${i}] fiyat bicimi: "${x.p}"`); }
  const kay = m.kaynak || {};
  if (!KAYNAK_TUR.includes(kay.tur)) H.push(`menu.kaynak.tur ${KAYNAK_TUR.join('|')} olmali`);
  if (!kay.url && !kay.dosya) H.push('menu.kaynak adres ya da dosya gostermeli');
  if (ctx.kaynaklar) {
    const es = ctx.kaynaklar.find((x) => (kay.dosya && x.dosya === kay.dosya) || (kay.url && x.url === kay.url));
    if (!es) H.push('menu.kaynak paketteki menu_kaynaklari listesinde yok');
    else if (/yasak/.test(es.robots || '')) H.push('menu kaynagini robots.txt yasakliyor');
  }
  // metin kaynakli menude fiyat kaynak dosyada aynen gecer (uydurma fiyat olmaz)
  // dosya verilmeyen metin kaynagi (sayfa / siparis sitesi): fiyatlar sitenin metninde ve paketteki metin dosyalarinda aranir (deneme turu: yalniz url yazilip denetim atlatilmisti)
  const metinKaynak = ['sayfa', 'siparis-sitesi'].includes(kay.tur) && !(kay.dosya && /\.(pdf|jpe?g|png|webp)$/i.test(kay.dosya));
  if (ctx.kaynakDosya && ((kay.dosya && /\.txt$/.test(kay.dosya)) || metinKaynak)) {
    const src = kay.dosya && /\.txt$/.test(kay.dosya) ? ctx.kaynakDosya(kay.dosya) || '' : [ctx.metin || '', ...((ctx.kaynaklar || []).filter((x) => x.dosya && /\.txt$/.test(x.dosya)).map((x) => ctx.kaynakDosya(x.dosya) || ''))].join('\n');
    for (const x of kal) { const p = String(x.p || '').replace(/^from\s+/i, '').split(/\s?(?:\/|or|–|-)\s?/)[0].trim(); if (p && !src.includes(p.replace(/\s/g, '')) && !src.includes(p)) H.push(`fiyat kaynakta yok: ${x.n} ${x.p}`); }
  }
  // eylem: gercek siparis ya da rezervasyon baglantisi
  const e = k.eylem || {};
  // TELEFON EYLEMI (TR devam-3; 12 Kas 2026 butun ulkeler): cevrimici baglantisi olmayan isletmede eylem isletmenin kendi telefonudur (hazirlik kapisi bilgi.json eylem.tur
  // 'telefon' yazar); url yok, sayfa numarayi sitenin kendisinden alir.  Sitede gercek bir baglanti varken telefon secilemez.
  const telEylem = e.tur === 'telefon';
  if (telEylem) { if (ctx.bilgi && ctx.bilgi.eylem && ctx.bilgi.eylem.tur && ctx.bilgi.eylem.tur !== 'telefon') H.push(`eylem.tur telefon secildi ama sitede gercek ${ctx.bilgi.eylem.tur} baglantisi var: ${ctx.bilgi.eylem.url}`); if (e.url) H.push('telefon eyleminde url verilmez (numara sitenin kendisinden)'); }
  else {
    if (!/^https:\/\//.test(String(e.url || '')) || /peakappsstudio/.test(e.url || '')) H.push('eylem.url isletmenin gercek https siparis/rezervasyon baglantisi olmali');
    if (!['siparis', 'rezervasyon'].includes(e.tur)) H.push('eylem.tur siparis, rezervasyon ya da telefon olmali');
  }
  // saat
  if (k.saat && (!Array.isArray(k.saat.satirlar) || !k.saat.satirlar.length || !k.saat.kaynak)) H.push('saat { satirlar, kaynak } olmali ya da null');
  // slogan
  const ic = k.icerik || {};
  const slg = k.sablon === 'v5' ? ic.slogan && ic.slogan.text : (Array.isArray(ic.aday) && ic.aday[ic.sec || 0] && ic.aday[ic.sec || 0].text);
  if (!slg) H.push(k.sablon === 'v5' ? 'icerik.slogan.text yok' : 'icerik.aday[sec].text yok');
  else {
    const red = sloganDogrula(String(slg).replace(/\*/g, ''), ctx.ad || ''); if (red) H.push(`slogan reddedildi: ${red}`);
    if (ctx.ad && norm(String(slg).replace(/\*/g, '')).replace(/[^a-z0-9 ]/g, '').trim() === norm(ctx.ad).replace(/[^a-z0-9 ]/g, '').trim()) H.push('slogan isletmenin adi');
  }
  if (KATEGORILER.includes(k.sablon) && ic.kategori && ic.kategori !== k.sablon) H.push(`icerik.kategori (${ic.kategori}) sablonla (${k.sablon}) ayni olmali`);
  // SOKAK (12 Kas 2026): urun seridi ve menude fotograf yalniz menude adi ve fiyati olan kalemlerden, isletmenin kendi kesimleriyle (R.kesme kimligi k01...); kayan yazi yok
  if (k.sablon === 'sokak') {
    const adlar = new Set(kal.map((x) => norm(String(x.n || '')).trim()));
    const ur = Array.isArray(ic.urunler) ? ic.urunler : [];
    for (const [i, u] of ur.entries()) { if (!u || !adlar.has(norm(String(u.n || '')).trim())) H.push(`icerik.urunler[${i}] menude yok: ${u && u.n}`); if (!u || !/^k\d+$/.test(String(u.kesme || ''))) H.push(`icerik.urunler[${i}].kesme isletmenin kendi kesimi (k01...) olmali`); }
    if (ur.length && ur.length < 3) H.push('icerik.urunler en az 3 kalem olmali (ya da hic)');
    for (const n of Object.keys(ic.menuFoto || {})) if (!adlar.has(norm(n).trim())) H.push(`icerik.menuFoto menude yok: ${n}`);
    if (ic.devYazi || ic.serit) H.push('kayan yazi seridi yok (Doruk 12 Kas 2026, kalici): icerik.devYazi / icerik.serit kullanilmaz');
  }
  // adres ve telefon: cikarici bulamadiysa (bilgi.json null) icerikte sitenin metninden aynen; verilen her adres/telefon metinde gecmeli
  if (ctx.bilgi) {
    const adr = k.sablon === 'v5' ? ic.konum && ic.konum.address : ic.kategoriEk && ic.kategoriEk.adres;
    const tel = k.sablon === 'v5' ? ic.konum && ic.konum.phone : ic.kategoriEk && ic.kategoriEk.telefon;
    if (!ctx.bilgi.adres && !adr) H.push(`adres yok: metin.txt icindeki adres ${k.sablon === 'v5' ? 'icerik.konum.address' : 'icerik.kategoriEk.adres'} alanina yazilmali`);
    if (!ctx.bilgi.telefon && !tel) H.push(`telefon yok: metin.txt icindeki numara ${k.sablon === 'v5' ? 'icerik.konum.phone' : 'icerik.kategoriEk.telefon'} alanina yazilmali`);
    if (adr && ctx.metin && !norm(ctx.metin).includes(norm(String(adr).split(',')[0]).trim())) H.push(`adres sitenin metninde yok: ${String(adr).split(',')[0]}`);
    if (tel && ctx.metin && !ctx.metin.replace(/\D/g, '').includes(String(tel).replace(/\D/g, '').replace(/^(353|61|64|44|90)/, '').replace(/^0/, ''))) H.push('telefon sitenin metninde yok');
  }
  // gozlem (mailin ilk cumlesi)
  const g = k.gozlem || {};
  if (String(g.metin || '').length < 30 || String(g.metin || '').length > 170) H.push('gozlem.metin 30-170 karakter, tek cumle olmali');
  if (/\d/.test(g.metin || '')) H.push('gozlem.metin rakam icermez (mail kurali: sayilar yaziyla)');
  if (!g.kanit) H.push('gozlem.kanit yok (hangi ekran goruntusu ya da olcum)');
  // serbest metin kurallari
  const site = norm(ctx.metin || '');
  const trMi = k.dil === 'tr' || (ctx.bilgi && ctx.bilgi.bolge === 'TR');
  for (const [yol, t] of [...metinler(ic, 'icerik'), ['gozlem.metin', g.metin || '']]) {
    if (trMi) for (const neden of trYapay(t)) H.push(`${yol}: düşük Türkçe, ${neden}: ${t.slice(0, 60)}`);
    if (yasakVar('kisaltma', t)) H.push(`${yol}: yasak kisaltma gecemez`);
    if (YASAK_KARAKTER.test(t)) H.push(`${yol}: yasak isaret (uzun tire, ok, unlem, emoji): ${t.slice(0, 50)}`);
    // bizim konumumuz yazilmaz; TR isletmesinin kendi adresi/sehri (Kaleici, Antalya) onun bilgisidir, serbest: yalniz yurt disi sayfalarda yasak
    if (!trMi && /T[uü]rkiye|Turkey|Antalya/i.test(t)) H.push(`${yol}: yasak yer adi`);
    if (ctx.metin && !/^gozlem/.test(yol)) {
      for (const w of t.match(OVGU) || []) if (!site.includes(norm(w))) H.push(`${yol}: ovgu sozcugu sitenin metninde yok ("${w}")`);
      for (const w of t.match(OVGU_TR) || []) if (!site.includes(norm(w))) H.push(`${yol}: ovgu sozcugu sitenin metninde yok ("${w}")`);
      for (const n of t.match(/\d+(?:[.,]\d+)?/g) || []) if (!site.includes(n) && !/^(1|2|3|4|5|6|7|8|9|10)$/.test(n)) H.push(`${yol}: sayi sitenin metninde yok (${n})`);
    }
  }
  return [...new Set(H)];
}

// karar -> sablonun kayit bicimi (uret-v5 elle kaydi ya da uret-kategori kaydi)
export function kayitKur(k) {
  const ic = JSON.parse(JSON.stringify(k.icerik || {}));
  const kal = (k.menu.kalemler || []).map((x) => ({ n: String(x.n).trim(), d: String(x.d || '').trim(), p: String(x.p).trim(), cat: x.cat ? String(x.cat).trim() : undefined }));
  const kaynakYazi = `${k.menu.kaynak.tur}: ${k.menu.kaynak.url || k.menu.kaynak.dosya}${k.menu.kaynak.sayfa ? ` (sayfa ${k.menu.kaynak.sayfa})` : ''}; aktaran ${k.inceleyen}`;
  if (k.sablon === 'v5') {
    ic.foto = { ...(ic.foto || {}), hero: String(k.hero.id) };
    ic.menu = { ...(ic.menu || {}), items: kal.map(({ n, d, p, cat }) => ({ n, d, p, ...(cat ? { cat } : {}) })), kaynak: kaynakYazi };
    // telefon eylemi: etiket karardan (bilgi.json eylem.etiket/kisa), yoksa dile gore lib/metin.mjs telEylemEtiket (EN genel: etiket yok, sablon "Call <numara>" yazar)
    const te = telEylemEtiket(k.dil === 'tr' ? 'tr' : 'en', { rezervasyon: !!k.eylem.rezervasyonSozu });
    ic.cta = k.eylem.tur === 'telefon'
      ? { tur: 'telefon', ...((k.eylem.etiket || te.etiket) ? { label: k.eylem.etiket || te.etiket } : {}), short: k.eylem.kisa || te.kisa }
      : { url: k.eylem.url, tur: k.eylem.tur, platform: k.eylem.platform || null, ...(k.eylem.metin ? { metin: k.eylem.metin } : {}), ...(k.eylem.etiket ? { label: k.eylem.etiket, short: k.eylem.kisa || k.eylem.etiket } : {}) };
    if (k.saat && k.saat.satirlar) ic.saat = { satirlar: k.saat.satirlar.map(String), kaynak: k.saat.kaynak };
    ic.heroGerekce = k.hero.gerekce;
    return { v5: ic, sablon: 'v5' };
  }
  ic.kategori = k.sablon; ic.hero = [String(k.hero.id)]; ic.heroNeden = k.hero.gerekce; ic.menuKaynak = kaynakYazi;
  if (k.eylem.tur === 'telefon') { // siparis baglantisi yok (butun ulkeler); sablon kendi telefon eylemini (D.tel, "Call <numara>" / "Arayın: <numara>") kullanir
    ic.kategoriEk = { ...(ic.kategoriEk || {}), menu: kal.map((x) => ({ n: x.n, d: x.d, p: x.p, cat: x.cat || 'Menu' })), eylemTur: 'telefon' };
    if (k.saat && k.saat.satirlar) ic.kategoriEk.saatSatirlar = k.saat.satirlar.map(String);
    return { kategori: ic, sablon: k.sablon };
  }
  ic.kategoriEk = { ...(ic.kategoriEk || {}), menu: kal.map((x) => ({ n: x.n, d: x.d, p: x.p, cat: x.cat || 'Menu' })), siparis: { url: k.eylem.url, platform: k.eylem.platform || '', text: ic.eylem || (k.dil === 'tr' ? (k.eylem.tur === 'rezervasyon' ? 'Masa ayırtın' : k.eylem.metin || 'Sipariş ver') : k.eylem.tur === 'rezervasyon' ? 'Book a table' : 'Order online'), tur: k.eylem.tur, external: true } };
  if (k.saat && k.saat.satirlar) ic.kategoriEk.saatSatirlar = k.saat.satirlar.map(String);
  return { kategori: ic, sablon: k.sablon };
}

// paket klasorunden denetim baglami
export function baglam(paketDir, R) {
  const bilgi = (() => { try { return JSON.parse(fs.readFileSync(path.join(paketDir, 'bilgi.json'), 'utf8')); } catch { return {}; } })();
  const oku = (rel) => { try { return fs.readFileSync(path.join(paketDir, rel), 'utf8'); } catch { return null; } };
  return { ad: (R && R.name && R.name.n) || bilgi.ad || '', fotoIds: ((R && R.photos) || []).map((p) => String(p.id)), metin: oku('metin.txt') || '', kaynakDosya: oku, kaynaklar: bilgi.menu_kaynaklari || null, adaylar: bilgi.hero_adaylari || [], bilgi: Object.keys(bilgi).length ? bilgi : null };
}
