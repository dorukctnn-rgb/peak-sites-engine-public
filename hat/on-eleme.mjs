// ON ELEME (12 Kas 2026, kapi verimi).  Restoran hazirligi pahalidir (tarayici + alt sayfalar + fotograflar, aday basina ~1 dk) ve son goz kotasina baglidir
// (plan.json limitler.restoranHerTur).  Turdaki hazirlik hakki gecme ihtimali yuksek adaylara gitsin diye, hazirliktan ONCE ucuz bir bakis:
//   - ana sayfanin HTML'i (tarama zaten indiriyor: lead/tara.mjs satira `on` yazar; eski satirlar icin turda tek, kibar bir GET, robots.txt'e uyulur),
//   - OSM kaydinin saat ve adres etiketleri (lead/osm.mjs osmEk; eski listelerde yoktu, kimlikle tek sorgu).
// Sinyaller: zincir isareti (hazirlik kapisinin AYNI deseni), fotograf sayisi ve galeri, menu sayfasi / menu PDF'i / fiyatli satir / siparis baglantisi, saat, telefon, adres.
// ATLA (bu turda hazirlanmaz, ilerleme dosyasinda kalir): ana sayfada zincir/franchise yaziyor; ya da hicbir menu izi yok (menu baglantisi, menu PDF'i, fiyatli satir, siparis
// sitesi yok).  Digerleri gecme olasiligi puanina gore siralanir.  Karar KALICI eleme degildir (kapi.json yazilmaz): yalniz siralama ve tur hakkidir.
// Ag yalniz Polite ile; e-posta adresi okunmaz ve yazilmaz.  Cikti yalniz sayilar.
import fs from 'node:fs';
import path from 'node:path';
import { SEKTORLER } from '../lead/sektorler.mjs';
import { malzemeOlc } from '../lead/puan.mjs';
import { osmEk as osmEkVarsayilan, osmEkUygula, osmAdresKur } from '../lead/osm.mjs';
import { SAAT_METIN, ZINCIR_METIN, TR_ZINCIR_METIN, TR_ADRES, TR_TEL, TEL_METIN, FIYAT_SATIR } from '../uyarla/restoran-hazirla.mjs';
import { kategoriOf, oncelik } from '../uyarla/sablon-sec.mjs';

// lead'in sayfa kategorisi (sablon-sec ile ayni kanit sirasi: OSM cuisine > ad > sitenin metni): pizza ve burger once (12 Kas 2026, Doruk), sonra burrito, sonra digerleri
export function leadKategori(l = {}) {
  const k = kategoriOf({ cuisine: l.mutfak || l.cuisine || '', ad: l.name || '', tur: l.tur || '' }).kategori;
  return ['pizza', 'burger', 'burrito'].includes(k) ? k : (l.on && ['pizza', 'burger', 'burrito'].includes(l.on.kategori) ? l.on.kategori : null);
}
export const leadOncelik = (l) => oncelik(leadKategori(l));

export const ON_SURUM = 1;
const ENT = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', pound: '£', euro: '€' };
export function gorunurMetin(html) {
  return String(html || '').slice(0, 600000)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section|\/header|\/footer|\/a)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, k) => (k[0] === '#' ? String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : Number(k.slice(1))) : ENT[k.toLowerCase()] ?? ' '))
    .replace(/[ \t\r\f\v]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
const EN_ADRES = /\b\d{1,5}[A-Za-z]?\s+[A-Z][\w'’.]+(?:\s+[A-Z][\w'’.]+){0,3}\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Quay|Square|Sq|Place|Pl|Terrace|Parade|Drive|Dr|Way|Row|Mall|Court|Ct)\b/;
const MENU_HREF = /<a\b[^>]*\bhref\s*=\s*["']([^"']*(?:menu|menü|menus|carta|food-?and-?drink|our-?food|yemek|fiyat)[^"']*)["']/gi;
const MENU_YAZI = /<a\b[^>]*>(?:\s|<[^>]+>)*(?:our\s+|the\s+|food\s+|view\s+(?:the\s+|our\s+)?|see\s+(?:the\s+|our\s+)?)?(?:menus?|men[üu]|menümüz|yemeklerimiz|food(?:\s*(?:&|and)\s*drinks?)?|fiyat\s?listesi)(?:\s|<[^>]+>)*<\/a>/i;

// ana sayfa HTML'i -> sinyaller (ag yok)
export function onSinyal({ html = '', finalUrl = '', ulke = '' } = {}) {
  const h = String(html || ''); const metin = gorunurMetin(h); const tr = ulke === 'TR';
  const z = ZINCIR_METIN.exec(metin) || (tr ? TR_ZINCIR_METIN.exec(metin) : null);
  const m = malzemeOlc(h, finalUrl);
  const menuHref = [...h.matchAll(MENU_HREF)].map((x) => x[1]).filter((u) => !/^(mailto|tel|javascript):/i.test(u));
  const pdf = /<a\b[^>]*href\s*=\s*["'][^"']*\.pdf(?:[?#][^"']*)?["']/i.test(h) && /menu|men[üu]|food|yemek|fiyat|drinks|lunch|dinner/i.test(h.match(/href\s*=\s*["'][^"']*\.pdf[^"']*["'][^>]*>[\s\S]{0,120}/gi)?.join(' ') || '');
  const fiyat = (metin.match(new RegExp(FIYAT_SATIR.source, 'gu')) || []).length;
  const siparis = !!(SEKTORLER.restoran.rezervasyon && SEKTORLER.restoran.rezervasyon.test(h));
  // menu sayfasi: ayni sitedeki ilk menu baglantisi (PDF degil); fiyat ana sayfada yoksa on hazirlik bu sayfaya bir kez bakar (menuSinyal)
  let menuUrl = null;
  for (const u of menuHref) {
    try {
      const x = new URL(u.replace(/&amp;/g, '&'), finalUrl || undefined);
      if (/^https?:$/.test(x.protocol) && !/\.pdf$/i.test(x.pathname) && (!finalUrl || x.host.replace(/^www\./, '') === new URL(finalUrl).host.replace(/^www\./, ''))) { x.hash = ''; menuUrl = x.href; break; }
    } catch { /* gecersiz adres */ }
  }
  return {
    v: ON_SURUM,
    zincir: z ? z[0].slice(0, 60) : null,
    foto: m.foto, galeri: m.galeri, logo: m.logo,
    menu: menuHref.length > 0 || MENU_YAZI.test(h), menuUrl, menuPdf: pdf, fiyat: Math.min(fiyat, 99), siparis,
    saat: SAAT_METIN.test(metin),
    tel: /href\s*=\s*["']tel:/i.test(h) || (tr ? TR_TEL.test(metin) : TEL_METIN.test(metin)),
    adres: tr ? TR_ADRES.test(metin) : EN_ADRES.test(metin),
    // menu ve metin ipucu (pizza / burger / burrito): sablon-sec metin kurali (en az 6 kez, ikincinin iki katindan fazla)
    kategori: kategoriOf({ metin }).kategori,
  };
}

// menu sayfasinin HTML'i -> { fiyat, pdf, gorsel, uzunluk } (fiyatli satir sayisi, PDF baglantisi, adi ya da alt yazisi menu/fiyat olan gorsel, gorunur metin uzunlugu)
export function menuSinyal(html = '') {
  const h = String(html || ''); const metin = gorunurMetin(h);
  return {
    fiyat: Math.min((metin.match(new RegExp(FIYAT_SATIR.source, 'gu')) || []).length, 99),
    pdf: /<a\b[^>]*href\s*=\s*["'][^"']*\.pdf(?:[?#][^"']*)?["']/i.test(h),
    gorsel: /<img\b[^>]*(?:src|alt)\s*=\s*["'][^"']*(?:menu|men[üu]|fiyat|price)[^"']*["']/i.test(h),
    uzunluk: metin.length,
  };
}

// sinyaller + lead -> { atla: neden | null, puan }.  Puan yalniz siralama icindir (gecme olasiligi tahmini, 0..~10).
export function onPuan(on, l = {}) {
  if (!on) return { atla: null, puan: null };
  if (on.zincir) return { atla: `zincir ya da franchise (ana sayfa: "${on.zincir}")`, puan: 0 };
  const menuIzi = on.menu || on.menuPdf || on.fiyat >= 4 || on.siparis;
  if (!menuIzi) return { atla: 'menü izi yok (ana sayfada menü bağlantısı, menü PDF\'i, fiyatlı satır ya da sipariş sitesi yok)', puan: 0 };
  // menu sayfasi okundu, metni dolu (betikle cizilen bos sayfa degil) ama fiyat, PDF ya da menu gorseli yok: hazirlik "fiyatli menu kaynagi yok" diye elerdi
  // (12 Kas olcumu: saat/adres/telefon duzeltmesinden sonra hazirligi gecen 15 adayin 12'si bu nedenle dustu)
  const ms = on.menuSayfa;
  if (ms && ms.uzunluk >= 400 && ms.fiyat < 2 && !ms.pdf && !ms.gorsel && !on.menuPdf && !on.siparis && on.fiyat < 4) return { atla: 'menü sayfasında fiyat yok (fiyatlı satır, menü PDF\'i ya da menü görseli yok)', puan: 0 };
  const osmSaat = !!(l.saat && String(l.saat).trim());
  const osmAdres = !!osmAdresKur(l);
  let p = 0;
  p += on.saat ? 2 : osmSaat ? 1.6 : 0; // saat: sitenin metni ya da OSM (ikisi de yoksa hazirlik eler, ama alt sayfada olabilir)
  p += on.menu || on.menuPdf ? 2 : 0; p += on.fiyat >= 4 || (ms && ms.fiyat >= 4) ? 1.5 : 0; p += on.siparis ? 0.5 : 0;
  p += Math.min(on.foto || 0, 12) / 6 + (on.galeri ? 0.7 : 0); // fotograf: ana sayfa HTML'inde sayilan (JS ile yuklenenler gorunmez; zayif sinyal)
  p += on.tel ? 0.8 : 0; p += on.adres || osmAdres ? 0.8 : 0; p += on.logo ? 0.4 : 0;
  return { atla: null, puan: +p.toFixed(2) };
}

const jsonOku = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
export const ON_DOSYA = 'on-kontrol.json';

// ulkeler arasi dengeli kisa liste (her ulkeden sirayla; liste zaten uretimPuani sirali).  12 Kas 2026: once pizza ve burger, sonra burrito, sonra digerleri
export function kisaListe(liste, adet) {
  const out = [];
  for (const p of [0, 1, 2]) {
    const grup = new Map(); for (const l of liste) { if (leadOncelik(l) !== p) continue; if (!grup.has(l.ulke)) grup.set(l.ulke, []); grup.get(l.ulke).push(l); }
    const gs = [...grup.values()];
    for (let i = 0; out.length < adet && gs.some((g) => g.length > i); i++) for (const g of gs) { if (out.length >= adet) break; if (g[i]) out.push(g[i]); }
  }
  return out;
}

// Tur oncesi: restoran adaylarinin kisa listesine on bakis (onbellek <depo>/lead/on-kontrol.json), OSM ek etiketleri, siralama.
//   liste: adaylar() ciktisi (uretimPuani sirali).  -> { liste: yeni sira (atlananlar cikarilmis), sayac }
export async function onHazirla({ liste, depo, adet = 45, bitis = Date.now() + 150000, polite = null, es = 6, osmEk = osmEkVarsayilan, log = () => {}, simdi = new Date() }) {
  const restoran = liste.filter((l) => l.sektor === 'restoran'); const diger = liste.filter((l) => l.sektor !== 'restoran');
  const sayac = { bakilan: 0, indirilen: 0, osmEk: 0, atla: 0, zincir: 0, menuYok: 0, puanli: 0, pizzaBurger: 0 };
  if (!restoran.length) return { liste, sayac };
  const dosya = path.join(depo, 'lead', ON_DOSYA); const ob = jsonOku(dosya, {});
  const kisa = kisaListe(restoran, adet); sayac.bakilan = kisa.length; sayac.pizzaBurger = kisa.filter((l) => leadOncelik(l) === 0).length;
  // 1. OSM ek etiketleri (eski listeler: lead'de `saat` alani hic yok)
  const osmGerek = kisa.filter((l) => !('saat' in l) && !(ob[l.id] && ob[l.id].osm !== undefined) && l.osm);
  if (osmGerek.length && Date.now() < bitis - 30000) {
    try { const m = await osmEk(osmGerek, { log }); for (const l of osmGerek) { const e = m.get(l.osm) || null; ob[l.id] = { ...(ob[l.id] || {}), osm: e, at: simdi.toISOString() }; } sayac.osmEk = osmGerek.length; }
    catch (e) { log(`on eleme: osm ek sorgusu olmadi (${String(e.message).slice(0, 60)})`); }
  }
  // 2. ana sayfa sinyalleri (taramada yazilmadiysa)
  const indir = kisa.filter((l) => !(l.on && l.on.v === ON_SURUM) && !(ob[l.id] && ob[l.id].on && ob[l.id].on.v === ON_SURUM));
  if (indir.length && polite) {
    let i = 0;
    const is = async () => {
      while (i < indir.length && Date.now() < bitis) {
        const l = indir[i++];
        let on = null;
        try { const r = await polite.get(l.finalUrl || l.website, { maxBytes: 4_000_000, accept: 'text/html' }); if (r.ok && r.text) on = onSinyal({ html: r.text, finalUrl: r.finalUrl || l.finalUrl || l.website, ulke: l.ulke }); }
        catch { on = null; }
        if (on) { ob[l.id] = { ...(ob[l.id] || {}), on, at: simdi.toISOString() }; sayac.indirilen++; }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, es) }, is));
  }
  // 2b. menu sayfasi (ana sayfada fiyat, menu PDF'i ya da siparis sitesi yoksa): tek GET, fiyatli satir sayisi
  const onOf = (l) => (l.on && l.on.v === ON_SURUM ? l.on : null) || (ob[l.id] && ob[l.id].on) || null;
  const menuGerek = kisa.filter((l) => { const on = onOf(l); return on && on.menuUrl && !on.zincir && on.fiyat < 4 && !on.menuPdf && !on.siparis && !(ob[l.id] && ob[l.id].menuSayfa); });
  if (menuGerek.length && polite) {
    let i = 0;
    const is = async () => {
      while (i < menuGerek.length && Date.now() < bitis) {
        const l = menuGerek[i++];
        try { const r = await polite.get(onOf(l).menuUrl, { maxBytes: 4_000_000, accept: 'text/html' }); ob[l.id] = { ...(ob[l.id] || {}), menuSayfa: r.ok && r.text ? menuSinyal(r.text) : { hata: String(r.why || r.status || 'alinamadi').slice(0, 30) }, at: simdi.toISOString() }; sayac.menuSayfa = (sayac.menuSayfa || 0) + 1; } catch { /* okunamadi: karar verilmez */ }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, es) }, is));
  }
  // 3. birlestir, puanla, sirala
  const eski = Date.now() - 120 * 864e5; for (const [k, v] of Object.entries(ob)) if (!v || Date.parse(v.at || 0) < eski) delete ob[k];
  try { fs.mkdirSync(path.dirname(dosya), { recursive: true }); fs.writeFileSync(dosya, JSON.stringify(ob)); } catch { /* onbellek yazilamadiysa tur bozulmaz */ }
  const zengin = new Map();
  for (const l of restoran) {
    const c = ob[l.id] || {};
    let x = c.osm !== undefined && !('saat' in l) ? osmEkUygula(l, c.osm) : l;
    const on0 = (l.on && l.on.v === ON_SURUM ? l.on : null) || c.on || null;
    const on = on0 && c.menuSayfa ? { ...on0, menuSayfa: c.menuSayfa } : on0;
    if (on) x = { ...x, on };
    zengin.set(l.id, { l: x, ...onPuan(on, x) });
  }
  const puanli = []; const puansiz = [];
  for (const l of restoran) {
    const z = zengin.get(l.id);
    if (z.atla) { sayac.atla++; if (/zincir/.test(z.atla)) sayac.zincir++; else if (/fiyat yok/.test(z.atla)) sayac.fiyatYok = (sayac.fiyatYok || 0) + 1; else sayac.menuYok++; continue; }
    if (z.puan === null) puansiz.push(z.l); else { puanli.push(z); sayac.puanli++; }
  }
  // sira: kategori onceligi (pizza+burger, burrito, digerleri), ayni oncelikte puanli once (puan buyukten), sonra puansiz (uretimPuani sirasi)
  const sirali = [...puanli.map((z) => ({ l: z.l, p: z.puan })), ...puansiz.map((x) => ({ l: x, p: null }))].map((x, i) => ({ ...x, i, o: leadOncelik(x.l) }));
  sirali.sort((a, b) => a.o - b.o || (a.p === null) - (b.p === null) || (b.p ?? 0) - (a.p ?? 0) || a.i - b.i);
  return { liste: [...sirali.map((x) => x.l), ...diger], sayac, atlanan: restoran.filter((l) => zengin.get(l.id).atla).map((l) => ({ id: l.id, neden: zengin.get(l.id).atla })) };
}
