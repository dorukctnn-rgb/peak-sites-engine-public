// RESTORAN HAZIRLIK (11 Kas 2026, v5 tasima).  Restoran, bar, burgerci, burrito/taco ve pizzaci icin hattin BETIK asamasi: sayfayi URETMEZ.
// Kalite citasi (memory/website-demo-quality-bar) goz ve karar ister: ana fotograf, slogan, fiyatli menu metni.  Bu adim yalniz malzemeyi toplar ve
// onu inceleme turunun (inceleme/ROUTINE.md icerik bolumu) okuyacagi pakete koyar.  Ag yalniz Polite ile (robots.txt'e uyulur, istekler aralikli).
//   restoranHazirla(lead, { veri, polite }) -> { status: 'icerik-bekliyor' | 'elendi', reasons[], sablon }
// Yazilanlar (<veri>/<slug>/):
//   kapi.json                 status + nedenler (kapi surumu)
//   hero-adaylar.json         puanlayicinin ilk 5 adayi (en buyuk surumun adresi ve gercek pikseliyle); SECIM DEGIL, oneridir
//   paket/                    inceleme paketi (veri dalina girmez, yalniz inceleme kutusuna kopyalanir):
//     bilgi.json              isletmenin gercekleri: ad, adres, telefon, saat, siparis/rezervasyon baglantisi, logo, renkler, sablon ve nedeni, on kapi, menu kaynaklari, eski site bulgulari
//     metin.txt               sitenin kendi metni (ana sayfa + okunan alt sayfalar + paragraflar)
//     fotolar.jpg             butun fotograflar, kimlikleriyle
//     hero-adaylar.jpg        ilk 5 aday yan yana (kimlik, gercek piksel, puan)
//     hero-aday/<id>.jpg      her adayin en cok 1600 px onizlemesi (yakindan bakmak icin)
//     menu-kaynak/            menu PDF'leri, menu gorselleri, siparis sitesinin fiyatli satirlari (robots izin verdiyse)
//     once-390.jpg, once-1440.jpg   bugunku sitenin telefon ve masaustu ilk ekrani (mail gozlemi bunlardan dogrulanir)
// On kapi (yerine gelmezse ELENIR; icerik turu ya da son goz zamani harcanmaz): sitenin kendi logosu, en az 5 kullanilabilir fotograf (en buyugu en az 1000 px),
// adres ve telefon, gercek siparis ya da rezervasyon baglantisi, fiyatli menu kaynagi (sayfa, PDF, gorsel ya da siparis sitesi).  Saat eksikse metinden tamamlanir.
import fs from 'node:fs';
import path from 'node:path';
import { sharp, sniff } from './lib/gorsel.mjs';
import { heroSec } from './lib/hero-sec.mjs';
import { sablonSec } from './sablon-sec.mjs';
import { menuFromText } from './lib/menu.mjs';
import { KAPI_SURUM } from './lib/surum.mjs';
import { VERI } from './lib/yol.mjs';
import { platformOf } from './lib/siparis.mjs';
import { kesinStok, kesinUretilmis, kesinAfis } from './lib/foto-topla.mjs';
import { fotoUyum, uyumBaglami } from './lib/foto-uyum.mjs';

const J = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const etiket = (txt, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="26"><rect width="${w}" height="26" rx="4" fill="#000" fill-opacity="0.8"/><text x="7" y="18" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#fff">${String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

// fiyatli satir: £/€/$ ya da TR (₺120, 120 TL, 120,00 ₺)
export const FIYAT_SATIR = /[£€$₺]\s?\d{1,3}(?:[.,]\d{2,3})?\b|\b\d{2,5}(?:[.,]\d{2})?\s?(?:₺|TL)(?!\p{L})/u;
// TR adres (cadde, sokak, bulvar, mahalle, No) ve TR telefon (0242 123 45 67, +90 532 123 4567, 444 1 234)
export const TR_ADRES = /(?<!\p{L})(cad(?:desi)?\.?|cd\.|sok(?:ak|a[ğg][ıi])?\.?|sk\.|bulvar[ıi]?|blv\.|mah(?:allesi)?\.?|mh\.|no\s?[:.]\s?\d+)(?!\p{L})/iu;
export const TR_TEL = /(?:\+90|0)\s?\(?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b|\b444[\s.-]?\d[\s.-]?\d{3}\b/;
// zincir/franchise: sitenin kendi Turkce metni ("subelerimiz", "bayilik", "12 subemizle")
export const TR_ZINCIR_METIN = /(?<!\p{L})(franchise|bayilik|bay[ıi]l[ıi]k ba[şs]vurusu|[şs]ubelerimiz|(?:[4-9]|\d{2,})\s+[şs]ube(?:miz|si|de|yle|mizle)?)(?!\p{L})/iu;

// eski sitenin olculmus bulgularindan mail gozlemi adaylari (son goz son incelemede dogrular; uydurma yok)
// Gozlem metinleri dile gore (TR 11 Kas 2026): ayni olculmus bulgu, dogal Turkce cumle.  Ikisi de isletmenin bugunku sitesi hakkinda, bizim hakkimizda degil.
const GOZLEM = {
  en: {
    'menu-pdf': 'Your menu is a PDF, so on a phone it opens as a tiny page and Google cannot read the prices.',
    'telefonda-tasma': 'On a phone the page is wider than the screen, so it slides sideways as people scroll.',
    'viewport-yok': 'On a phone the site shows the desktop layout shrunk down, so the text is too small to read without zooming.',
    'kucuk-yazi': 'On a phone the body text is small enough that people have to zoom to read it.',
    'https-yok': 'Browsers mark the site as not secure, because it does not use https.',
    yavas: 'On a phone the home page takes a long time to load.',
    'telif-eski': 'The footer still carries an old copyright year, which makes the site look unattended.',
    'rezervasyon-yok': 'There is no booking or ordering button on the home page.',
    'saat-yok': 'Your opening hours are not on the home page.',
  },
  tr: {
    'menu-pdf': 'Menünüz PDF olarak duruyor; telefonda küçücük bir sayfa gibi açılıyor ve Google fiyatları okuyamıyor.',
    'telefonda-tasma': 'Sitenizin ana sayfası telefonda ekrandan geniş açılıyor, kaydırırken sayfa yana kayıyor.',
    'viewport-yok': 'Siteniz telefonda masaüstü düzeninin küçültülmüş hali olarak açılıyor, yazıları okumak için yakınlaştırmak gerekiyor.',
    'kucuk-yazi': 'Sitenizdeki yazılar telefonda küçük kalıyor, okumak için yakınlaştırmak gerekiyor.',
    'https-yok': 'Siteniz https kullanmadığı için tarayıcılar adres çubuğunda "güvenli değil" uyarısı gösteriyor.',
    yavas: 'Sitenizin ana sayfası telefonda geç açılıyor.',
    'telif-eski': 'Sitenizin alt kısmında eski bir telif yılı duruyor; site bakımsız görünebiliyor.',
    'rezervasyon-yok': 'Ana sayfanızda sipariş ya da rezervasyon için bir düğme yok.',
    'saat-yok': 'Çalışma saatleriniz ana sayfada görünmüyor.',
  },
};
// saat satiri var mi (EN am/pm ya da TR gun adi + 24 saat): yanlis "saat yok" gozlemi olmasin
const SAAT_METIN_TEMEL = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b.{0,80}\b\d{1,2}(?:[:.]\d\d)?\s?(?:am|pm|noon)\b|\b\d{1,2}(?:[:.]\d\d)?\s?(?:am|pm)\s?(?:-|–|to)\s?\d{1,2}(?:[:.]\d\d)?\s?(?:am|pm)\b|(?<!\p{L})(pazartesi|sal[ıi]|[çc]ar[şs]amba|per[şs]embe|cuma|cumartesi|pazar|her g[üu]n|hafta i[çc]i|hafta sonu|haftan[ıi]n her g[üu]n[üu])(?!\p{L}).{0,60}?\b\d{1,2}[:.]\d{2}\s?(?:-|–|—|ile|\/)\s?\d{1,2}[:.]\d{2}\b|(?<!\p{L})(a[çc][ıi]l[ıi][şs]|[çc]al[ıi][şs]ma saat(?:leri|lerimiz)?)(?!\p{L}).{0,40}?\b\d{1,2}[:.]\d{2}\b/iu;
// TR denemesi (11 Kas): "12:00 - 24:00 (Her gün)" (gun sozcugu saatten SONRA) ve "Çalışma Saatleri / 7 gün Açık / 10:00 - 00:00" (baslik ile saat ayri satirlarda) kaciyordu
const SAAT_SONRA_GUN = /\b\d{1,2}[:.]\d{2}\s?(?:-|–|—)\s?\d{1,2}[:.]\d{2}\b[^\n]{0,25}?(?<!\p{L})(?:her g[üu]n|7 g[üu]n|haftan[ıi]n her g[üu]n[üu]|hafta i[çc]i|every day|daily)(?!\p{L})/iu;
const SAAT_BASLIK = /(?<!\p{L})(?:[çc]al[ıi][şs]ma saat\p{L}*|a[çc][ıi]l[ıi][şs] saat\p{L}*|7 g[üu]n a[çc][ıi]k|her g[üu]n a[çc][ıi]k|opening hours)(?!\p{L})[\s\S]{0,80}?\b\d{1,2}[:.]\d{2}\s?(?:-|–|—)\s?\d{1,2}[:.]\d{2}\b/iu;
export const SAAT_METIN = new RegExp([SAAT_METIN_TEMEL, SAAT_SONRA_GUN, SAAT_BASLIK].map((r) => r.source).join('|'), 'iu');
export function gozlemAdaylari({ bulgular = [], R, homeText = '' }) {
  const out = []; const k = new Set(bulgular.map((b) => b.k));
  const G = GOZLEM[(R.lead && R.lead.lang) === 'tr' ? 'tr' : 'en'];
  const menuHtml = ((R.menu && R.menu.items) || []).filter((x) => x.p).length;
  const pdf = ((R.menu && R.menu.pdfs) || []).length;
  if (!menuHtml && pdf) out.push({ k: 'menu-pdf', metin: G['menu-pdf'], kanit: R.menu.pdfs[0] });
  if (k.has('telefonda-tasma')) out.push({ k: 'telefonda-tasma', metin: G['telefonda-tasma'], kanit: (bulgular.find((b) => b.k === 'telefonda-tasma') || {}).v });
  if (k.has('viewport-yok')) out.push({ k: 'viewport-yok', metin: G['viewport-yok'], kanit: 'meta viewport yok' });
  if (k.has('kucuk-yazi')) out.push({ k: 'kucuk-yazi', metin: G['kucuk-yazi'], kanit: (bulgular.find((b) => b.k === 'kucuk-yazi') || {}).v });
  if (k.has('https-yok')) out.push({ k: 'https-yok', metin: G['https-yok'], kanit: (bulgular.find((b) => b.k === 'https-yok') || {}).v });
  if (k.has('yavas') || k.has('yavas-yanit')) out.push({ k: 'yavas', metin: G.yavas, kanit: (bulgular.find((b) => /yavas/.test(b.k)) || {}).v });
  if (k.has('telif-eski')) out.push({ k: 'telif-eski', metin: G['telif-eski'], kanit: (bulgular.find((b) => b.k === 'telif-eski') || {}).v });
  if (k.has('rezervasyon-yok')) out.push({ k: 'rezervasyon-yok', metin: G['rezervasyon-yok'], kanit: 'ana sayfada rezervasyon/siparis baglantisi yok' });
  // saat-yok yalniz ana sayfanin metninde hicbir saat satiri yoksa (deneme turu: cikarici bulamadi ama saat sayfada yaziliydi; yanlis gozlem olmasin)
  if (!R.hours && !SAAT_METIN.test(homeText) && !/\b(?:open|hours)\b.{0,40}\b\d{1,2}(?::\d\d)?\s?(?:am|pm)\b/i.test(homeText)) out.push({ k: 'saat-yok', metin: G['saat-yok'], kanit: 'cikarici ana sayfada saat bulamadi' });
  out.push({ k: 'gozle', metin: '', kanit: 'once-390.jpg ve once-1440.jpg: gozle bakilip tek, dogru, isletmeye ozel bir gozlem yazilir' });
  return out;
}

// fiyatli menu kaynaklari: sayfa (cikaricinin okudugu satirlar), PDF, menu gorseli, siparis sitesi.  Indirilen her dosya robots.txt izniyle.
async function menuKaynaklari(R, { pdir, polite, log }) {
  const out = []; const md = path.join(pdir, 'menu-kaynak'); fs.mkdirSync(md, { recursive: true });
  const satir = ((R.menu && R.menu.items) || []).filter((x) => x.n && x.p);
  if (satir.length >= 4) { fs.writeFileSync(path.join(md, 'sayfa.txt'), satir.map((x) => `${x.cat ? `[${x.cat}] ` : ''}${x.n}${x.d ? ` (${x.d})` : ''}: ${x.p}`).join('\n')); out.push({ tur: 'sayfa', url: R.menu.pageUrl || (satir[0] && satir[0].page) || null, dosya: 'menu-kaynak/sayfa.txt', kalem: satir.length, robots: 'izinli (cikarici okudu)' }); }
  // sitenin kendi metninde fiyatli satirlar (cikaricinin satir kurali kacirdiysa): fiyatli her satir bir onceki ve sonraki satirla birlikte; kaynak yine sitenin sayfasi
  else {
    const dir = path.dirname(pdir); const parca = [];
    for (const f of ['_home.txt', '_sayfalar.txt']) {
      if (!fs.existsSync(path.join(dir, f))) continue;
      const L = fs.readFileSync(path.join(dir, f), 'utf8').split('\n'); let url = f === '_home.txt' ? (R.erisim && R.erisim.finalUrl) || R.lead.site : null;
      L.forEach((l, i) => { if (/^## https?:/.test(l)) url = l.slice(3).trim(); if (FIYAT_SATIR.test(l)) parca.push({ url, t: [L[i - 1], l, L[i + 1]].filter((x) => x && !/^## /.test(x)).join(' | ') }); });
    }
    if (parca.length >= 6) {
      fs.writeFileSync(path.join(md, 'sayfa-metin.txt'), parca.map((p) => `${p.t}    <${p.url}>`).join('\n'));
      const urls = [...new Set(parca.map((p) => p.url).filter(Boolean))];
      out.push({ tur: 'sayfa', url: urls[0] || null, dosya: 'menu-kaynak/sayfa-metin.txt', kalem: parca.length, robots: 'izinli (cikarici okudu)', not: 'sitenin metnindeki fiyatli satirlar (onceki/sonraki satirla); ad ve fiyat buradan aynen' });
    }
  }
  let n = 0;
  for (const u of ((R.menu && R.menu.pdfs) || []).slice(0, 3)) {
    if (!polite) { out.push({ tur: 'pdf', url: u, dosya: null, robots: 'denenmedi' }); continue; }
    const r = await polite.get(u, { maxBytes: 15_000_000, accept: 'application/pdf', binary: true });
    if (!r.ok) { out.push({ tur: 'pdf', url: u, dosya: null, robots: /robots/.test(r.why || '') ? 'yasak' : `alinamadi (${r.why})` }); continue; }
    const buf = r.buf || Buffer.from(r.text || '', 'binary');
    if (buf.slice(0, 4).toString() !== '%PDF') { out.push({ tur: 'pdf', url: u, dosya: null, robots: 'izinli', not: 'PDF degil' }); continue; }
    n++; const f = `menu-${n}.pdf`; fs.writeFileSync(path.join(md, f), buf); out.push({ tur: 'pdf', url: u, dosya: `menu-kaynak/${f}`, kb: Math.round(buf.length / 1024), robots: 'izinli' }); log(`   menu pdf ${u.slice(0, 90)}`);
  }
  // menu gorselleri: dosya adi ya da alt yazisi "menu" olan kareler (cikaricinin kopyasi; okunmazsa buyuk surum inceleme turunda istenmez, gozden-gecir olur)
  let g = 0;
  for (const p of R.photos || []) {
    if (g >= 4) break;
    let hint = ''; try { hint = `${decodeURIComponent(path.basename(new URL(p.url).pathname))} ${p.alt || ''}`; } catch { hint = `${p.url} ${p.alt || ''}`; }
    if (!/\bmenu|menus|price ?list|food ?board|specials?\b|men[üu]|fiyat ?listesi|fiyatlar/i.test(hint)) continue;
    const src = path.join(path.dirname(pdir), p.file); if (!fs.existsSync(src)) continue;
    g++; const f = `gorsel-${p.id}.jpg`; await sharp(src).jpeg({ quality: 90 }).toFile(path.join(md, f));
    out.push({ tur: 'gorsel', url: p.url, dosya: `menu-kaynak/${f}`, px: `${p.w}x${p.h}`, robots: 'izinli (sitenin kendi gorseli)' });
  }
  // siparis sitesi: robots izin veriyorsa sayfanin fiyatli satirlari (izin vermiyorsa yalniz kayit; zorlanmaz)
  const o = R.order && R.order.url;
  if (o && polite) {
    const r = await polite.get(o, { maxBytes: 3_000_000, accept: 'text/html' });
    if (r.ok && r.text) {
      const rows = menuFromText(r.text, { max: 80 });
      if (rows.length) fs.writeFileSync(path.join(md, 'siparis.txt'), rows.map((x) => `${x.cat ? `[${x.cat}] ` : ''}${x.n}${x.d ? ` (${x.d})` : ''}: ${x.p}`).join('\n'));
      out.push({ tur: 'siparis-sitesi', url: o, dosya: rows.length ? 'menu-kaynak/siparis.txt' : null, kalem: rows.length, robots: 'izinli', not: rows.length ? '' : 'sayfa betikle ciziliyor; fiyatli satir okunamadi' });
    } else out.push({ tur: 'siparis-sitesi', url: o, dosya: null, robots: /robots/.test(r.why || '') ? 'yasak' : `alinamadi (${r.why})` });
  }
  return out;
}

export async function temasSayfasi(files, { cols, tw, th, etiketler, hedef, q = 78 }) {
  const comps = []; let x = 10; let y = 10; let i = 0;
  for (const f of files) {
    const t = await sharp(f).resize({ width: tw, height: th, fit: 'cover' }).jpeg({ quality: 76 }).toBuffer();
    comps.push({ input: t, left: x, top: y }, { input: etiket(etiketler[i], Math.min(tw - 8, 14 + etiketler[i].length * 8.6)), left: x + 4, top: y + 4 });
    i++; x += tw + 8; if (i % cols === 0) { x = 10; y += th + 8; }
  }
  const W = 10 + cols * (tw + 8) + 2; const H = y + (i % cols ? th + 8 : 0) + 10;
  await sharp({ create: { width: W, height: Math.max(H, th + 20), channels: 3, background: '#262626' } }).composite(comps).jpeg({ quality: q, mozjpeg: true }).toFile(hedef);
  return hedef;
}

// ON KAPI (veri; ag yok): cikarici verisi + sitenin metni -> { why[], eksik[], eylem, fotolar, osmAdres }.  Hazirlik ve olcum ayni islevi kullanir (uyarla/olcum-cikarici.mjs).
// 12 Kas (cikarici guclendirme): stok ve uretilmis gorsel (adres/metadata/dosya adi ile kesin olanlar) ISLETMENIN kendi fotografi sayilmaz; olu siparis baglantisi eylem sayilmaz.
export function onKapi(R, lead, { ham, sec }) {
  const why = []; const eksik = [];
  const tr = lead.region === 'TR';
  if (!R.logo || !R.logo.orig || !R.logo.orig.file) why.push('logo yok (sitenin kendi logo dosyası bulunamadı)');
  // en az 4 kare (onayli burrito demosu 3 kendi karesi + isaretle durdu; sablonlar bolumu karesi yoksa gizler, siki kapi bos bolumu yakalar)
  const hepsi = R.photos || [];
  const kendi = (p) => !kesinStok(p.isaretler || {}) && !kesinUretilmis(p.isaretler || {}) && !kesinAfis(p.isaretler || {});
  // 12 Kas FOTO UYUMU (lib/foto-uyum.mjs): logo, harita, ekran goruntusu, ikon, bulanik ve grafik kareler de isletmenin kullanilabilir fotografi sayilmaz
  const uyum = fotoUyum(hepsi, uyumBaglami(R, { sablon: sec.sablon, kategori: sec.kategori }));
  const kapiEleme = new Set(uyum.elenen.filter((e) => !['stok', 'uretilmis', 'afis'].includes(e.tur)).map((e) => e.id));
  const gecer = (p) => !kapiEleme.has(String(p.id));
  const fotolar = hepsi.filter((p) => p.w >= 800 && !(p.meanS < 0.26 && p.lapVar > 1800) && kendi(p) && gecer(p));
  const sayilmayan = hepsi.filter((p) => p.w >= 800 && !kendi(p)).length;
  const uymayan = hepsi.filter((p) => p.w >= 800 && kendi(p) && !gecer(p)).length;
  const minFoto = sec.sablon === 'v5' ? 4 : 3; // kategori sablonlari 3 kareyle de dolar (onayli Bay City Burrito demosu); v5 en az 4
  if (fotolar.length < minFoto) why.push(`kullanılabilir fotoğraf az (${fotolar.length}; en az ${minFoto}, 800 px+${sayilmayan ? `; ${sayilmayan} stok, üretilmiş görsel ya da afiş sayılmadı` : ''}${uymayan ? `; ${uymayan} logo, harita, ekran görüntüsü, ikon ya da bulanık kare sayılmadı` : ''})`);
  if (!hepsi.some((p) => p.w >= 1000 && p.w / p.h >= 1.1 && kendi(p) && gecer(p))) why.push('1000 px üstünde yatay fotoğraf yok (ana fotoğraf olmaz)');
  // sitenin adresi bulunamadiysa OSM'nin adres etiketleri (sokak + sehir + posta kodu; sokak yoksa sayilmaz)
  let osmAdres = false;
  if (!R.address && lead.osmAdres && /\d/.test(lead.osmAdres) && lead.osmAdres.split(',').length >= 2) { R.address = { text: lead.osmAdres, via: 'osm (addr etiketleri)' }; osmAdres = true; }
  // adres ya da telefon cikaricidan gelmediyse sitenin metninde var mi (icerik turu oradan aynen alir; restoran-icerik denetler, siki kapi ilk ekranda arar)
  if (!R.address) { if (/\b\d{1,5}[A-Za-z]?\s+[A-Z][\w'’.]+(?:\s+[A-Z][\w'’.]+){0,3}\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Quay|Square|Sq|Place|Pl|Terrace|Parade|Drive|Dr|Way|Row|Mall|Court|Ct)\b/.test(ham) || (tr && TR_ADRES.test(ham))) eksik.push('adres (metin.txt icinde)'); else why.push('adres yok'); }
  if (!R.phone) { if (/(?:\+\d{2}[\d\s()-]{7,15}\d|\(0\d\)\s?\d{3,4}\s?\d{3,4}|\b0\d{1,4}[\s-]?\d{3}[\s-]?\d{3,4}\b)/.test(ham) || (tr && TR_TEL.test(ham))) eksik.push('telefon (metin.txt icinde)'); else why.push('telefon yok'); }
  const olu = (x) => x && x.dogrulama && x.dogrulama.durum === 'olu';
  const eylem0 = (R.order && R.order.url && !olu(R.order)) ? { tur: 'siparis', url: R.order.url, platform: R.order.platform, dogrulama: R.order.dogrulama || null } : (R.reservation && R.reservation.external && R.reservation.url && !olu(R.reservation)) ? { tur: 'rezervasyon', url: R.reservation.url, platform: platformOf(R.reservation.url) || R.reservation.platform || new URL(R.reservation.url).host, dogrulama: R.reservation.dogrulama || null }
      // TR: isletmenin kendi sitesindeki AYRI rezervasyon sayfasi (yolunda "rezervasyon") da rezervasyon sistemidir; ana sayfa ya da iletisim sayfasi sayilmaz
      : (tr && R.reservation && R.reservation.url && !olu(R.reservation) && /\/(rezervasyon|reservation|reservations|rezervasyon-yap|online-rezervasyon)(?:[/.?#]|$)/i.test(new URL(R.reservation.url, lead.site).pathname)) ? { tur: 'rezervasyon', url: new URL(R.reservation.url, lead.site).href, platform: 'kendi rezervasyon sayfası', dogrulama: R.reservation.dogrulama || null } : null;
  // TR (11 Kas 2026, TR devam-3; koordinator onayi): Turkiye'de bagimsiz restoranlarin cogu masayi ve paket siparisi TELEFONLA alir; sitede cevrimici baglanti
  // yoksa isletmenin KENDI sitesindeki numarasi gercek eylemdir ("Rezervasyon için arayın" / "Hemen arayın"; demo form yok, uydurma baglanti yok).
  // Yurt disinda kural ayni kalir (gercek cevrimici baglanti sart).  Sitede siparis baglantisi VAR ama olu ise telefon yedegi kullanilmaz: kategori sablonlari o baglantiyi dugme yapardi (#2 kurali korunur).
  const telVar = !!R.phone || TR_TEL.test(ham);
  const eylem = eylem0 || (tr && telVar && !(R.order && R.order.url) ? { tur: 'telefon', url: null, platform: 'telefon', rezervasyonSozu: /rezervasyon|reservation/i.test(ham) } : null);
  if (!eylem) why.push(`gerçek sipariş ya da rezervasyon bağlantısı yok (yalnız telefon${olu(R.order) || olu(R.reservation) ? '; bulunan bağlantı açılmıyor' : ''})`);
  if (eylem && eylem.tur === 'telefon') eksik.push('eylem telefon (sitede çevrimiçi sipariş/rezervasyon bağlantısı yok)');
  // saat ilk ekranin zorunlu parcasi ("simdi acik"): sitenin hicbir sayfasinda saat satiri yoksa icerik turuna gonderilmez (deneme turu: Scugnizzo ve La Tortilleria siki kapida saatten dustu)
  if (!R.hours || !R.hours.tableOk) { if (SAAT_METIN.test(ham)) eksik.push('saat (sitenin metninden tamamlanacak)'); else why.push('çalışma saati yok (sitenin hiçbir sayfasında)'); }
  return { why, eksik, eylem, fotolar, osmAdres, uyum };
}

// HAZIRLIK KAPISI (ag yok): erken elemeler (site, kapali, zincir, hedef disi ulke) + on kapi.  restoranHazirla ve olcum araci (uyarla/olcum-cikarici.mjs) ayni islevi kullanir.
// -> { elendi: string[] | null, sec, eksik, eylem, fotolar, osmAdres, ham0 }
export function hazirlikKapisi(R, lead, dir) {
  if (!R) return { elendi: ['cikarici.json yok'], sec: null };
  if (!R.erisim || !R.erisim.ok) return { elendi: ['site okunamadı'], sec: null };
  if (R.kapali) return { elendi: [`işletme kapanmış (sitenin kendi sözü: ${R.kapali.neden})`], sec: null };
  const sec = sablonSec({ ...R.lead, mutfak: lead.mutfak || R.lead.mutfak }, R);
  // zincir / franchise: sitenin kendi metni soyluyor (deneme turu 11 Kas: Thai Chef "branches all across New Zealand", "7 locations", franchise sayfasi; lead filtresi yakalamamisti)
  const ham0 = ['_home.txt', '_sayfalar.txt'].map((f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : '')).join('\n');
  const zincir = /\bfranchis(?:e|es|ing|ee)\b|\bbranches (?:all )?(?:across|around|throughout)\b|\b(?:[4-9]|\d{2,}|four|five|six|seven|eight|nine|ten|twelve)\s+(?:\w+\s+)?(?:locations|branches|restaurants|stores|outlets|venues)\b/i.exec(ham0);
  if (zincir) return { elendi: [`zincir ya da franchise (sitenin kendi metni: "${zincir[0]}")`], sec };
  const tr = lead.region === 'TR';
  const zincirTr = tr ? TR_ZINCIR_METIN.exec(ham0) : null;
  if (zincirTr) return { elendi: [`zincir ya da franchise (sitenin kendi metni: "${zincirTr[0]}")`], sec };
  // site baska ulkedeki bir isletmenin (deneme turu: OSM'de AU Victoria etiketli MANTU'nun sitesi Victoria BC, Kanada; telefon sahte): hedef disi ulke
  const adr0 = `${(R.address && R.address.text) || ''} ${R.phone || ''}`;
  const disUlke = tr
    ? /\b(Canada|USA|United States|Germany|Deutschland|España|Spain|Italia|Italy|France|Ecuador|United Kingdom|Nederland|Cyprus|KKTC|Kıbrıs)\b|\+(1|49|34|39|33|44|31|357)\d/.exec(adr0)
    : /\b(Canada|USA|United States|Türkiye|Turkey|Germany|Deutschland|España|Spain|Italia|Italy|France|Ecuador)\b|\b(BC|ON|QC|AB)\s+[A-Z]\d[A-Z]\b|\+(1|90|49|34|39|33|593)\d/.exec(adr0);
  if (disUlke) return { elendi: [`site hedef ulkedeki isletmenin degil (adres/telefon: "${disUlke[0]}")`], sec };
  const ok = onKapi(R, lead, { ham: ham0, sec });
  return { elendi: ok.why.length ? ok.why : null, sec, eksik: ok.eksik, eylem: ok.eylem, fotolar: ok.fotolar, osmAdres: ok.osmAdres, ham0, fotoUyum: ok.uyum };
}

export async function restoranHazirla(lead, { veri = VERI, polite = null, log = () => {} } = {}) {
  const slug = lead.slug; const dir = path.join(veri, slug); const R = J(path.join(dir, 'cikarici.json'));
  const kapiYaz = (status, reasons, ek = {}) => { const k = { surum: KAPI_SURUM, slug, name: R && R.name && R.name.n, site: lead.site, region: lead.region, sektor: 'restoran', at: new Date().toISOString(), status, reasons, warnings: [], metrics: {}, ...ek }; fs.writeFileSync(path.join(dir, 'kapi.json'), JSON.stringify(k, null, 1)); return k; };
  const kg = hazirlikKapisi(R, lead, dir);
  if (kg.osmAdres) fs.writeFileSync(path.join(dir, 'cikarici.json'), JSON.stringify(R, null, 1));
  if (kg.elendi) return kapiYaz('elendi', kg.elendi, kg.sec ? { sablon: kg.sec.sablon } : {});
  const { sec, eksik, eylem, ham0, fotoUyum: uyum } = kg;

  // ---- paket ----
  const pdir = path.join(dir, 'paket'); fs.rmSync(pdir, { recursive: true, force: true }); fs.mkdirSync(pdir, { recursive: true });
  const getir = polite ? async (u) => { const r = await polite.get(u, { maxBytes: 40_000_000, accept: 'image/*', binary: true }); return r.ok && r.buf ? r : null; } : null;
  // foto uyumu: elenen kareler, bolum icin kucuk kareler ve (kendi karesi varken) stok kareler ana fotograf adayi olmaz
  const kendiVar = uyum.uygun.some((x) => x.kaynak === 'kendi' && !x.yalnizKart);
  const heroHaric = [...uyum.elenen.map((e) => e.id), ...uyum.uygun.filter((x) => x.yalnizKart || (kendiVar && x.kaynak === 'stok')).map((x) => x.id)];
  const hs = await heroSec(R, { dir, imgDir: null, getir, log, maxFetch: 10, adayDir: path.join(pdir, 'hero-aday'), haric: heroHaric });
  fs.writeFileSync(path.join(dir, 'hero-adaylar.json'), JSON.stringify({ slug, adaylar: hs.adaylar, kural: hs.kural, at: hs.at, not: 'puanlayicinin onerisi; secim inceleme turunda gozle yapilir (Pausa paket kutulari, BoTOWN 09 dersleri)' }, null, 1));
  const onz = hs.adaylar.filter((a) => a.onizleme);
  if (!onz.length) return kapiYaz('elendi', ['ana fotoğraf adayı yok'], { sablon: sec.sablon });
  await temasSayfasi(onz.map((a) => path.join(pdir, 'hero-aday', a.onizleme)), { cols: onz.length > 3 ? 3 : onz.length, tw: 520, th: 346, etiketler: onz.map((a) => `${a.id}  ${a.w}x${a.h}  puan ${a.puan}`), hedef: path.join(pdir, 'hero-adaylar.jpg') });
  // temas sayfasi foto uyumu sirasinda: uygun kareler en iyi once, elenenler sonda "elendi" etiketiyle
  const sirali = [...uyum.sira, ...uyum.elenen.map((e) => e.id)]; const elenenId = new Set(uyum.elenen.map((e) => e.id));
  const tum = sirali.map((id) => (R.photos || []).find((p) => String(p.id) === id)).filter((p) => p && fs.existsSync(path.join(dir, p.file)));
  if (tum.length) await temasSayfasi(tum.map((p) => path.join(dir, p.file)), { cols: 6, tw: 220, th: 150, etiketler: tum.map((p) => `${p.id} ${p.w}${elenenId.has(String(p.id)) ? ' elendi' : ''}`), hedef: path.join(pdir, 'fotolar.jpg'), q: 74 });
  const kaynak = await menuKaynaklari(R, { pdir, polite, log });
  const okunur = kaynak.filter((x) => x.dosya);
  if (!okunur.length) { fs.rmSync(pdir, { recursive: true, force: true }); return kapiYaz('elendi', [`fiyatlı menü kaynağı yok ya da robots.txt izin vermiyor (${kaynak.map((x) => `${x.tur}: ${x.robots}`).join('; ') || 'kaynak bulunamadı'})`], { sablon: sec.sablon }); }
  for (const f of ['once-390.jpg', 'once-1440.jpg']) if (fs.existsSync(path.join(dir, f))) await sharp(path.join(dir, f)).resize({ width: f.includes('390') ? 390 : 1100, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(path.join(pdir, f));
  const metin = [fs.existsSync(path.join(dir, '_home.txt')) ? `## ANA SAYFA ${R.erisim.finalUrl || lead.site}\n${fs.readFileSync(path.join(dir, '_home.txt'), 'utf8')}` : '', fs.existsSync(path.join(dir, '_sayfalar.txt')) ? fs.readFileSync(path.join(dir, '_sayfalar.txt'), 'utf8') : '', ((R.ek && R.ek.paragraflar) || []).length ? `## PARAGRAFLAR\n${R.ek.paragraflar.join('\n\n')}` : ''].filter(Boolean).join('\n\n');
  fs.writeFileSync(path.join(pdir, 'metin.txt'), metin.slice(0, 60000));
  const tarama = lead.bulgular || J(path.join(dir, 'tarama.json'), {}).bulgular || [];
  const bilgi = {
    slug, ad: clean(R.name && R.name.n), site: lead.site, bolge: lead.region, sehir: lead.city, tur: lead.kind, mutfak: lead.mutfak || R.lead.mutfak || null,
    sablon: sec.sablon, sablonNeden: sec.neden, ornek: `inceleme/ornek/${sec.sablon}.json`,
    adres: R.address ? clean(R.address.text) : null, telefon: R.phone || null, saat: R.hours ? { tableOk: R.hours.tableOk, week: R.hours.week, byDay: R.hours.byDay } : null,
    eylem, rezervasyon: R.reservation || null, siparis: R.order || null,
    logo: { dosya: R.logo.orig.file, boyut: `${R.logo.orig.w}x${R.logo.orig.h}`, sha256: R.logo.orig.sha256, kaynak: R.logo.url || null },
    renkler: R.colours && R.colours.computed ? { zemin: R.colours.computed.body && R.colours.computed.body.bg, metin: R.colours.computed.body && R.colours.computed.body.color, nav: R.colours.computed.nav && R.colours.computed.nav.color } : null,
    slogan_ipuclari: { title: R.slogan && R.slogan.title, og: R.slogan && R.slogan.ogTitle, aciklama: R.slogan && R.slogan.desc, tagline: R.tagline || null },
    // foto uyumu (lib/foto-uyum.mjs): uygun kareler en iyi once (kendi kareleri stoktan once), sonra elenenler nedeniyle; yuvalara yalniz uygun kare girer
    fotograflar: (() => { const ph = new Map((R.photos || []).map((p) => [String(p.id), p])); const b = (id) => { const p = ph.get(id) || {}; return { id, w: p.w, h: p.h, alt: p.alt || '' }; }; return [...uyum.uygun.map((u) => ({ ...b(u.id), uyum: 'uygun', kaynak: u.kaynak, konu: u.konu, puan: u.puan, ...(u.yalnizKart ? { yalnizKart: true } : {}) })), ...uyum.elenen.map((e) => ({ ...b(e.id), uyum: 'elendi', neden: e.neden }))]; })(),
    foto_uyum: { tur: uyum.tur, dil: uyum.dil, sira: uyum.sira, uygun: uyum.uygun, elenen: uyum.elenen, ozet: uyum.ozet, kural: 'Yuvalara yalnız uygun kareler girer (sıra en iyi önce; işletmenin kendi kareleri stoktan önce; stok yalnız türle ya da menüyle eşleşirse). Uyan kare yoksa yuva boş bırakılır, şablon bölümü daraltır; uymayan kare seçilirse içerik denetimi HATA verir. Ana fotoğraf işletmenin kendi karesidir.' },
    hero_adaylari: hs.adaylar.map((a) => ({ id: a.id, px: `${a.w}x${a.h}`, puan: a.puan, neden: a.neden, onizleme: a.onizleme ? `hero-aday/${a.onizleme}` : null })),
    menu_kaynaklari: kaynak, menu_cikarici: { via: R.menu && R.menu.via, kalem: ((R.menu && R.menu.items) || []).length, sayfa: R.menu && R.menu.pageUrl },
    eksik, eski_site_bulgulari: tarama, gozlem_adaylari: gozlemAdaylari({ bulgular: tarama, R, homeText: ham0 }),
    // uretilmis gorsel izi (deneme turu: Sofia Burwood'un butun kareleri 1376x768 uretilmis gorseldi): yalniz uyari; karar gozle verilir
    gorsel_uyari: (() => { const G = new Set(['1024x1024', '1344x768', '768x1344', '1376x768', '768x1376', '1536x1024', '1024x1536', '1792x1024', '1024x1792', '1216x832', '832x1216', '1152x896', '896x1152', '896x1195', '1456x816', '1248x832', '832x1248']); const n = (R.photos || []).filter((p) => G.has(`${p.w}x${p.h}`)).length; return n ? `${n}/${(R.photos || []).length} kare uretilmis gorsel olcusunde (1376x768, 1024x1024 ...): gercek fotograf mi, gozle bak` : null; })(),
  };
  fs.writeFileSync(path.join(pdir, 'bilgi.json'), JSON.stringify(bilgi, null, 1));
  return kapiYaz('icerik-bekliyor', [], { sablon: sec.sablon, sablonNeden: sec.neden, eksik, menuKaynak: kaynak.map((x) => `${x.tur}:${x.robots}`), fotoUyum: uyum.ozet });
}
