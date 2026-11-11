// Turkiye siparis/rezervasyon baglantilari (11 Kas 2026, TR pazari).  Ortak siparis.mjs'e DOKUNULMAZ (cikarici-guclendir dali onu yeniden kuruyor);
// TR saglayicilari burada.  Gercek eylem: Yemeksepeti, Getir Yemek, Trendyol Yemek, Migros Yemek, isletmenin kendi siparis sayfasi, kendi WhatsApp hatti
// (wa.me bicimi gercek eylem sayilir) ya da rezervasyon sistemi.
// 12 Kas (cikarici-guclendir #2 birlesti): Yemeksepeti/Getir/Trendyol/Migros siparis.mjs PLATFORMLAR listesinde (iframe/betik taramasi da bulur); burada
// yalniz TR'ye ozel olan WhatsApp hatti ve TR yolunun siparis secimi ile eylem adaylari (eylemAdaylariTr) kalir.  Tek yonlu import: siparis.mjs bu dosyayi almaz.
import { siparisBul, platformOf, eylemAdaylari, PLATFORMLAR } from './siparis.mjs';

const TR_ADLAR = new Set(['Yemeksepeti', 'Getir Yemek', 'Trendyol Yemek', 'Migros Yemek']);
export const TR_PLATFORMLAR = [
  ...PLATFORMLAR.filter((p) => TR_ADLAR.has(p[0])),
  ['WhatsApp', 'siparis', /^https?:\/\/(?:wa\.me\/\d|api\.whatsapp\.com\/send|(?:web\.)?whatsapp\.com\/send)/i],
];
export const whatsappMi = (url) => /^https?:\/\/(?:wa\.me\/\d|api\.whatsapp\.com\/send|(?:web\.)?whatsapp\.com\/send)/i.test(String(url || ''));
export function platformTr(url) { for (const [n, , re] of TR_PLATFORMLAR) if (re.test(String(url || ''))) return n; return null; }
// TR once, sonra ortak liste
export const platformHepsi = (url) => platformTr(url) || platformOf(url);

const SIPARIS_YAZI = /(?<!\p{L})(sipari[şs] ver|online sipari[şs]|hemen sipari[şs]|sipari[şs]|paket servis|eve servis)(?!\p{L})/iu;
const SIPARIS_YOL = /\/(siparis|online-siparis|siparis-ver|paket-servis|eve-servis)(\/|$|\?)/i;
const RED = /(hediye|kariyer|i[şs] ba[şs]vuru|franchise|bayilik|facebook|instagram|tiktok|mailto:|tel:)/i;

// links: [{href, text}], base -> { url, platform, text, external, siparis? } | null
// Sira: siparis yazili platform baglantisi > platform > kendi siparis sayfasi > WhatsApp hatti > ortak siparisBul (yurt disi saglayicilari)
export function siparisBulTr(links, base) {
  const host = (() => { try { return new URL(base).host.replace(/^www\./, ''); } catch { return ''; } })();
  const cands = [];
  for (const l of links || []) {
    let u; try { u = new URL(l.href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const text = String(l.text || '').replace(/\s+/g, ' ').trim();
    const plat = platformTr(u.href);
    if (!plat && RED.test(`${u.href} ${text}`)) continue;
    const ext = u.host.replace(/^www\./, '') !== host;
    let score = 0;
    if (plat === 'WhatsApp') score += 3; else if (plat) score += 6;
    if (SIPARIS_YAZI.test(text)) score += 3;
    if (!ext && SIPARIS_YOL.test(u.pathname)) score += 4;
    if (!score) continue;
    cands.push({ url: u.href, platform: plat || (ext ? u.host.replace(/^www\./, '') : 'own'), text: text.slice(0, 40), external: ext, siparis: SIPARIS_YAZI.test(text) || undefined, score });
  }
  cands.sort((a, b) => b.score - a.score);
  if (cands[0]) { const { score, ...c } = cands[0]; return c; }
  return siparisBul(links, base);
}

// TR yolu: ortak eylemAdaylari ile ayni cikti ({ siparis, rezervasyon }); siparis once TR secimi (TR saglayicilari, WhatsApp hatti, kendi siparis sayfasi), yoksa ortak sonuc
export function eylemAdaylariTr(k) {
  const e = eylemAdaylari(k);
  const s = siparisBulTr(k.links, k.base);
  if (!s) return e;
  if (!s.kanit) s.kanit = 'baglanti';
  return { ...e, siparis: s };
}
