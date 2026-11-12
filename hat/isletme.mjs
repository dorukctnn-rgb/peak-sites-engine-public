// ISLETME KIMLIGI: ayni isletmeye, baska bir adresle de olsa, ikinci kez mail yazma.
//
// Neden: yazilanlar() (hat/kuyruk.mjs) yalniz ADRESE ve is adresinin ALAN ADINA bakiyordu.  Ortak e-posta saglayicilarinda (lead/eposta.mjs SERBEST: gmail vb.) alan adi
// isletmeyi anlatmaz; ayni isletme baska bir adresle yeniden gecebiliyordu (bir haritadaki ilanin adresiyle yazilmis isletme, kendi sitesinde yayimlanan ikinci adresle "yeni" sayilirdi).
//
// Ayni isletme: su dort anahtardan HERHANGI BIRI eslesirse
//   - ayni web sitesi (isletmenin KENDI sitesi; mail alan adi degil; sosyal ve liste sayfalari sayfa basina sayilir, harita ve kendi sayfalarimiz hic sayilmaz),
//   - ayni telefon (rakamlar, son 9 hane),
//   - ayni OpenStreetMap nesnesi (node/way/relation kimligi),
//   - ayni normallestirilmis ad + ayni sehir (sehri bilinmeyen eski kuyruk satiri icin: sehir yalniz bir tarafta biliniyorsa ayni bolge icinde ad eslesmesi; iki tarafta da sehir yoksa
//     ad karsilastirilmaz).
// Kimlik nereden: kuyruk satirinin kendi alanlari (_biz, _city, evidence.site / evidence.phone, _email_source, name, region ve WH- kimliginden OSM nesnesi) ve sent.jsonl'de yalniz
// kimlik + adres tutuldugu icin satirin kuyruktaki karsiligi (ayni kimlik).  Bu kurallar peak-outreach'in importers'indaki kuralla aynidir (src/business.mjs); iki taraf ayni `_biz` alanini
// yazar ve okur: { site, phone, osm, city } (her biri metin ya da dizi).
// Engelleyenler: sent.jsonl'de giden mail (sent, uncertain, pending, rejected) ve SERBEST kuyruk satiri; websites-demo ve websites-demo-tr'nin BEKLETILEN satiri da (hat bunlari kendisi
// birakir).  Eski `websites` kampanyasinin bekleyen satirlari hic engellemez.  Saf islevler: dosya, ag, e-posta adresi yok.
export const SEBEP = 'isletme-daha-once';
export const AILE = Object.freeze(['websites', 'websites-demo', 'websites-demo-tr']);
export const BEKLEYEN_IZLENEN = Object.freeze(['websites-demo', 'websites-demo-tr']);
const GIDEN = ['sent', 'uncertain', 'pending', 'rejected'];

// ---- normallestirme ---------------------------------------------------------------------------------------------------------
const HARF = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ç': 'c', 'Ç': 'c', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u', 'ß': 'ss', 'æ': 'ae', 'ø': 'o', 'œ': 'oe', 'ł': 'l', 'đ': 'd' };
export function normYazi(s) {
  return String(s ?? '').replace(/[İıŞşĞğÇçÖöÜüßæøœłđ]/g, (c) => HARF[c]).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
const DOLGU = new Set(['the', 'restaurant', 'restaurants', 'restoran', 'restorant', 'cafe', 'kafe', 'bar', 'pub']);
// "Ornek Lokanta Restaurant" ve "ORNEKLOKANTA" -> "orneklokanta"; yalniz dolgu sozcuklerinden olusan ad onlari korur; uc harften kisa ad ad degildir
export function normAd(ad) {
  const hepsi = normYazi(ad).split(' ').filter(Boolean);
  const kalan = hepsi.filter((w) => !DOLGU.has(w));
  const s = (kalan.length ? kalan : hepsi).join('');
  return s.length >= 3 ? s : '';
}
const liste = (v) => (Array.isArray(v) ? v : [v]).flat().filter((x) => x !== undefined && x !== null && String(x).trim() !== '');

// metindeki her telefonun son 9 hanesi; 9 haneden kisa ya da tek rakamin tekrari numara degildir
export function telAnahtarlari(v) {
  const out = new Set();
  for (const parca of String(Array.isArray(v) ? v.join(';') : v ?? '').split(/[;|\n/]|,\s|\s(?:ve|or|and)\s/i)) {
    const d = parca.replace(/\D+/g, '');
    if (d.length < 9) continue;
    const k = d.slice(-9);
    if (/^(\d)\1+$/.test(k)) continue;
    out.add(k);
  }
  return out;
}

// metinde gecen OpenStreetMap nesneleri ("https://www.openstreetmap.org/node/123", "node/123")
export function osmAnahtarlari(v) {
  const out = new Set();
  for (const m of String(Array.isArray(v) ? v.join(' ') : v ?? '').matchAll(/\b(node|way|relation)\/(\d{3,})\b/gi)) out.add(`${m[1].toLowerCase()}/${m[2]}`);
  return out;
}

// ---- web sitesi -------------------------------------------------------------------------------------------------------------
const IKINCI_SEVIYE = /^(co|com|org|net|gov|ac|edu|gen|web|bel|k12|biz|info)\.(uk|au|nz|tr|ie|za|sg|hk)$/;
function kokAlan(host) {
  const p = host.split('.');
  if (p.length <= 2) return host;
  return IKINCI_SEVIYE.test(p.slice(-2).join('.')) ? p.slice(-3).join('.') : p.slice(-2).join('.');
}
const KIMSENIN_DEGIL = new Set(['openstreetmap.org', 'peakappsstudio.com', 'google.com', 'goo.gl', 'g.page', 'wikipedia.org', 'schema.org', 'w3.org', 'wa.me', 'api.whatsapp.com', 'whatsapp.com', 'maps.apple.com']);
const YOL_PLATFORMU = /^(facebook\.com|fb\.com|fb\.me|instagram\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|linkedin\.com|linktr\.ee|t\.me|pinterest\.com|tripadvisor\.[a-z.]+|yelp\.[a-z.]+|foursquare\.com|zomato\.com|ubereats\.com|doordash\.com|grubhub\.com|deliveroo\.[a-z.]+|menulog\.com\.au|opentable\.[a-z.]+|thefork\.[a-z.]+|booking\.com|airbnb\.[a-z.]+|expedia\.[a-z.]+|yemeksepeti\.com|getir\.com|trendyol\.com|tgoyemek\.com|eventbrite\.[a-z.]+|bio\.site)$/;
const ALT_ALAN_PLATFORMU = /(^|\.)(wixsite\.com|business\.site|weebly\.com|blogspot\.com|wordpress\.com|squarespace\.com|myshopify\.com|godaddysites\.com|carrd\.co|netlify\.app|vercel\.app|github\.io|webflow\.io|site123\.me|jimdofree\.com|square\.site|ueniweb\.com|mystrikingly\.com|tumblr\.com|my\.canva\.site|framer\.website|pages\.dev|web\.app|firebaseapp\.com)$/;
const GENEL_YOL = /^(pages|p|profile\.php|people|groups|explore|share|sharer|hashtag|watch|channel|user|company|biz|restaurant_review.*|restaurants?|places?)$/i;

// "https://www.Ornek.com/menu" -> "ornek.com"; "facebook.com/ornek.lokanta" -> "facebook.com/ornek.lokanta"; alan adi yoksa ya da ortak bir sayfaysa ''
export function siteAnahtari(u) {
  let s = String(u ?? '').trim().split(/[\s;,]/)[0];
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `http://${s}`;
  let x; try { x = new URL(s); } catch { return ''; }
  const host = x.hostname.toLowerCase().replace(/^(www|m|mobile|amp)\./, '');
  if (!/^[a-z0-9.-]+\.[a-z0-9-]{2,}$/.test(host) || /\.(png|jpe?g|gif|webp|svg|css|js|txt|json|md|csv)$/.test(host)) return '';
  const kok = kokAlan(host);
  if (KIMSENIN_DEGIL.has(kok) || KIMSENIN_DEGIL.has(host)) return '';
  if (YOL_PLATFORMU.test(kok)) {
    let seg = ''; try { seg = decodeURIComponent(x.pathname.split('/').filter(Boolean)[0] || '').toLowerCase(); } catch { seg = ''; }
    return seg && !GENEL_YOL.test(seg) ? `${kok}/${seg}` : '';
  }
  if (ALT_ALAN_PLATFORMU.test(host)) return host;
  return kok;
}
// serbest metinde gecen siteler: her http(s) adresi ve metni acan alan adi ("ornek.ie ana sayfa, iletisim bolumu")
export function metindekiSiteler(v) {
  const out = new Set();
  for (const t of Array.isArray(v) ? v : [v]) {
    const s = String(t ?? '');
    for (const m of s.matchAll(/https?:\/\/[^\s)'"<>\]]+/gi)) { const k = siteAnahtari(m[0]); if (k) out.add(k); }
    const bas = /^\s*((?:[a-z0-9-]+\.)+[a-z]{2,})(?=[\s/,;:)]|$)/i.exec(s);
    if (bas) { const k = siteAnahtari(bas[1]); if (k) out.add(k); }
  }
  return out;
}

// ---- bir isletme anahtarlar olarak ----------------------------------------------------------------------------------------------
// kaynaklar: { ad, bolge, sehir, site, tel, osm, metin } nesneleri (her alan deger ya da dizi) -> { site, tel, osm, adlar, sehirler, bolge }
export function kimlik(...kaynaklar) {
  const k = { site: new Set(), tel: new Set(), osm: new Set(), adlar: new Set(), sehirler: new Set(), bolge: '' };
  for (const s of kaynaklar) {
    if (!s || typeof s !== 'object') continue;
    for (const a of liste(s.ad)) { const n = normAd(a); if (n) k.adlar.add(n); }
    for (const c of liste(s.sehir)) { const n = normYazi(c); if (n) k.sehirler.add(n); }
    if (s.bolge && !k.bolge) k.bolge = String(s.bolge).trim().toUpperCase();
    for (const w of liste(s.site)) { const n = siteAnahtari(w); if (n) k.site.add(n); }
    for (const t of liste(s.metin)) { for (const n of metindekiSiteler(t)) k.site.add(n); for (const n of osmAnahtarlari(t)) k.osm.add(n); }
    for (const o of liste(s.osm)) for (const n of osmAnahtarlari(o)) k.osm.add(n);
    for (const n of telAnahtarlari(liste(s.tel))) k.tel.add(n);
  }
  return k;
}

// hattin kendi lead'i (lead/osm.mjs leadOf + taramadan sonra): { name, ulke, city, ilce, website, finalUrl, phone, osm }
export const leadKimligi = (l) => (l ? kimlik({ ad: l.name, bolge: l.ulke, sehir: [l.city, l.ilce], site: [l.website, l.finalUrl], tel: l.phone, osm: l.osm }) : kimlik());

// kuyruk satiri: kendi alanlari; WH-<ULKE>-<n|w|r><sayi> kimliginden OSM nesnesi
const OSM_TUR = { n: 'node', w: 'way', r: 'relation' };
export function satirKimligi(row) {
  const r = row || {};
  const ev = r.evidence && typeof r.evidence === 'object' ? r.evidence : {};
  const biz = r._biz && typeof r._biz === 'object' ? r._biz : {};
  const m = /^WH-[A-Z]{2}-([nwr])(\d+)$/.exec(String(r.id || ''));
  return kimlik({
    ad: r.name, bolge: r.region, sehir: [biz.city, r._city], site: [biz.site, r._site, ev.site], tel: [biz.phone, r._phone, ev.phone],
    osm: [biz.osm, r._osm, m ? `${OSM_TUR[m[1]]}/${m[2]}` : ''], metin: [r._email_source],
  });
}

// ---- indeks -------------------------------------------------------------------------------------------------------------------------
function adEslesir(a, b) {
  if (a.bolge && b.bolge && a.bolge !== b.bolge) return false;
  if (!a.sehirler.size && !b.sehirler.size) return false;
  for (const n of a.adlar) {
    if (!b.adlar.has(n)) continue;
    if (a.sehirler.size && b.sehirler.size && ![...a.sehirler].some((c) => b.sehirler.has(c))) continue;
    return true;
  }
  return false;
}

// kayitlar: { id, kampanya, durum: 'giden' | 'kuyrukta' | 'bekleyen' | 'parti', kimlik }
export function indeksOlustur() {
  const kayitlar = []; const anahtar = new Map(); const adlar = new Map();
  const ekle = (m, k, e) => { if (!m.has(k)) m.set(k, []); m.get(k).push(e); };
  return {
    kayitlar,
    ekle(kim, bilgi) {
      const e = { ...bilgi, kimlik: kim }; kayitlar.push(e);
      for (const k of kim.osm) ekle(anahtar, `osm:${k}`, e);
      for (const k of kim.site) ekle(anahtar, `site:${k}`, e);
      for (const k of kim.tel) ekle(anahtar, `tel:${k}`, e);
      for (const n of kim.adlar) ekle(adlar, n, e);
      return e;
    },
    // -> null | { neden: 'osm' | 'site' | 'telefon' | 'ad+sehir' | 'ad', id, kampanya, durum }; sira: osm, site, telefon, ad
    bul(kim, { yoksay = null, durumlar = null } = {}) {
      const uygun = (e) => !(yoksay && yoksay.has(e.id)) && (!durumlar || durumlar.includes(e.durum));
      const bulgu = (neden, e) => ({ neden, id: e.id, kampanya: e.kampanya, durum: e.durum });
      for (const k of kim.osm) for (const e of anahtar.get(`osm:${k}`) || []) if (uygun(e)) return bulgu('osm', e);
      for (const k of kim.site) for (const e of anahtar.get(`site:${k}`) || []) if (uygun(e)) return bulgu('site', e);
      for (const k of kim.tel) for (const e of anahtar.get(`tel:${k}`) || []) if (uygun(e)) return bulgu('telefon', e);
      for (const n of kim.adlar) for (const e of adlar.get(n) || []) if (uygun(e) && adEslesir(kim, e.kimlik)) return bulgu(kim.sehirler.size && e.kimlik.sehirler.size ? 'ad+sehir' : 'ad', e);
      return null;
    },
  };
}

const SIRA = { giden: 3, kuyrukta: 2, bekleyen: 1 };
// peak-outreach'in sent.jsonl ve queue.jsonl satirlarindan: yazilmis ya da yazilacak isletmeler
export function isletmeIndeksi({ sent = [], queue = [], aile = AILE, izlenen = BEKLEYEN_IZLENEN }) {
  const idx = indeksOlustur();
  const kuyrukta = new Map(queue.map((r) => [r.id, r]));
  const gorulen = new Map();
  const al = (id, kampanya, durum, satir) => { const o = gorulen.get(id); if (o && SIRA[o.durum] >= SIRA[durum]) return; gorulen.set(id, { id, kampanya, durum, satir }); };
  for (const r of sent) if (aile.includes(r.campaign) && GIDEN.includes(r.status)) al(r.id, r.campaign, 'giden', kuyrukta.get(r.id) || { id: r.id, campaign: r.campaign, region: r.region });
  for (const r of queue) {
    if (!aile.includes(r.campaign)) continue;
    if (!r._held) al(r.id, r.campaign, 'kuyrukta', r);
    else if (izlenen.includes(r.campaign)) al(r.id, r.campaign, 'bekleyen', r);
  }
  for (const e of gorulen.values()) idx.ekle(satirKimligi(e.satir), { id: e.id, kampanya: e.kampanya, durum: e.durum });
  return idx;
}

// satira yazilacak _biz: kimlikten (bir deger metin, birden cok deger dizi); bos alan yazilmaz
export function bizAlani(kim, sehir = '') {
  const bir = (set) => { const a = [...set]; return a.length > 1 ? a : a[0]; };
  const out = {};
  if (kim.site.size) out.site = bir(kim.site);
  if (kim.tel.size) out.phone = bir(kim.tel);
  if (kim.osm.size) out.osm = bir(kim.osm);
  const c = String(sehir || '').trim(); if (c) out.city = c;
  return Object.keys(out).length ? out : null;
}
