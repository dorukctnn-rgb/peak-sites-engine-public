// LEAD BULUCU (3/3): isletmenin KENDI sitesinde yayimladigi is e-postasi + hukuk kontrolleri.  Tahmin edilmis adres (info@ uydurmak) YOK.
//   - kaynak: ana sayfa + en cok 2 iletisim sayfasi (contact / about / enquiries), robots.txt'e uyularak (Polite)
//   - mailto:, duz metin, Cloudflare e-posta korumasi (data-cfemail) cozulur
//   - tercih: sitenin kendi alan adindaki adres; serbest posta (gmail vb.) GB ve IE'de ALINMAZ (PECR: kisisel abonelik)
//   - GB: yalniz sirket (sitede "X Ltd" / "Limited" / LLP / plc / "Company No" / "Registered in England"); kanit yoksa satir 'sirket-kaniti-yok'
//   - sitede "istenmeyen ticari mesaj / pazarlama maili istemiyoruz" notu varsa satir 'ret-notu'
import { ULKELER } from './sektorler.mjs';

export const SERBEST = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|aol|icloud|me|mac|bigpond|bigpond\.net|xtra\.co|orcon|slingshot|optusnet|iinet|tpg|eircom|btinternet|btopenworld|sky|talktalk|virginmedia|ntlworld|blueyonder|gmx|proton(?:mail)?|mail|zoho|yandex)\.[a-z.]+$/i;
const KOTU_ADRES = /^(no-?reply|donotreply|do-not-reply|postmaster|abuse|webmaster|privacy|gdpr|dpo|unsubscribe|bounce|mailer-daemon|example|test|your|name|email|user)@|@(example|domain|email|sentry|wixpress|sentry-next|godaddy|squarespace|wix)\./i;
const DOSYA = /\.(png|jpe?g|gif|webp|svg|css|js)$/i;

export function cfCoz(hex) {
  try { const k = parseInt(hex.slice(0, 2), 16); let s = ''; for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k); return s; } catch { return ''; }
}

export function adresler(html) {
  const h = String(html || '').replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, '@').replace(/&#46;|\[dot\]|\(dot\)/gi, '.');
  const set = new Set();
  for (const m of h.matchAll(/mailto:([^"'?>\s]+)/gi)) set.add(decodeURIComponent(m[1]));
  for (const m of h.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) set.add(cfCoz(m[1]));
  for (const m of h.replace(/<[^>]+>/g, ' ').matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) set.add(m[0]);
  return [...set].map((e) => e.trim().toLowerCase().replace(/^[.]+|[.]+$/g, '')).filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && !DOSYA.test(e) && !KOTU_ADRES.test(e) && e.length <= 80);
}

const kok = (host) => { const p = String(host).toLowerCase().replace(/^www\./, '').split('.'); const n = /\.(co|com|org|net|ac|gov)\.(uk|au|nz)$|\.(com|net|org)\.(au)$/.test(`.${p.slice(-2).join('.')}`) || ['co.uk', 'org.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'org.nz', 'net.nz', 'com.tr', 'net.tr', 'org.tr', 'gen.tr', 'web.tr', 'biz.tr', 'info.tr', 'tel.tr', 'name.tr'].includes(p.slice(-2).join('.')) ? 3 : 2; return p.slice(-n).join('.'); };
export const alanKoku = kok;

// sayfa metinlerinden en iyi adres: kendi alan adindaki > rol adresi (info/stay/bookings/hello/enquiries/reservations) > diger
export function enIyi(liste, host, ulke) {
  const site = kok(host); const U = ULKELER[ulke] || {};
  const ok = liste.filter((e) => !(U.serbestPostaYok && SERBEST.test(e)));
  const rol = /^(info|hello|stay|bookings?|enquir(y|ies)|reservations?|contact|office|reception|admin|mail|team|studio|salon|clinic|frontdesk|accounts|iletisim|rezervasyon|siparis|bilgi|merhaba|restoran|restaurant)@/;
  const sira = (e) => (kok(e.split('@')[1]) === site ? 0 : 2) + (rol.test(e) ? 0 : 1);
  return ok.sort((a, b) => sira(a) - sira(b))[0] || null;
}

// GB sirket kaniti: sirket ADI + hukuki bicim ya da numara (cip "Limited" tek basina kanit degil: "limited time")
export function sirketKaniti(text) {
  const t = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const m = /\b([A-Z][A-Za-z0-9&'.-]+(?:\s+[A-Z][A-Za-z0-9&'.-]+){0,5})\s+(Ltd\.?|Limited|LLP|PLC|plc)\b(?!\s+(?:time|offer|edition|availability|number of|period|places|spaces))/.exec(t);
  if (m) return `${m[1]} ${m[2]}`.slice(0, 80);
  const n = /\b(?:company|reg(?:istered)?)\.?\s*(?:no|number|reg(?:istration)?)\.?:?\s*((?:SC|NI|OC)?\d{6,8})\b/i.exec(t); if (n) return `sirket no ${n[1]}`;
  const r = /registered in (england|scotland|wales|northern ireland)/i.exec(t); if (r) return r[0];
  return null;
}

export const RET_NOTU = /\b(no (?:unsolicited|marketing|sales|cold|commercial|promotional)(?:\s+(?:sales|marketing|commercial|promotional|business))*\s*(?:e-?mails?|calls|approaches|solicitations?|offers|messages|communications?)|we do not accept (?:unsolicited|marketing|sales)|unsolicited (?:\w+\s+)?(?:e-?mails?|marketing|offers) (?:will be|are) (?:ignored|not|deleted)|no sales calls|please do not contact us with (?:marketing|sales)|no solicitors?|no soliciting|no spam)\b|(?:reklam|tan[ıi]t[ıi]m|pazarlama|ticari)\s+(?:ama[çc]l[ıi]\s+)?(?:e-?posta|mail|ileti|mesaj)[a-zçğıöşü]*\s+(?:g[öo]ndermeyin|kabul etmiyoruz|istemiyoruz|yan[ıi]tlanmaz)|ticari elektronik ileti\s+(?:istemiyoruz|kabul etmiyoruz)|spam\s+g[öo]ndermeyin/iu;

export function iletisimLinkleri(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const txt = m[2].replace(/<[^>]+>/g, ' ').toLowerCase();
    if (!/contact|enquir|get in touch|about|find us|book|ileti[şs]im|bize ula[şs][ıi]n|hakk[ıi]m[ıi]zda|rezervasyon|ula[şs][ıi]m/.test(`${m[1].toLowerCase()} ${txt}`)) continue;
    try { const u = new URL(m[1], base); if (u.host === new URL(base).host && !out.includes(u.href) && !/\.(pdf|jpg|png)$/i.test(u.pathname)) out.push(u.href); } catch { /* bozuk link */ }
  }
  return out.sort((a, b) => (/contact|enquir|iletisim|ileti%c5%9fim/i.test(b) ? 1 : 0) - (/contact|enquir|iletisim|ileti%c5%9fim/i.test(a) ? 1 : 0)).slice(0, 2);
}

// ana sayfa html'i zaten okunmus; iletisim sayfalari polite ile okunur
export async function epostaBul({ html, finalUrl, ulke, polite, osmEmail }) {
  const host = new URL(finalUrl).host; const metin = [html];
  let liste = adresler(html);
  for (const u of iletisimLinkleri(html, finalUrl)) {
    if (liste.some((e) => kok(e.split('@')[1]) === kok(host))) break;
    const r = await polite.get(u, { maxBytes: 1_500_000, accept: 'text/html' });
    if (r.ok && /html/.test(r.type || 'text/html')) { metin.push(r.text); liste = liste.concat(adresler(r.text)); }
  }
  // OSM e-posta etiketi tek basina alinmaz: adres isletmenin KENDI sitesinde yayimlanmis olmali (hukuk: gorunur bicimde yayimlanmis is adresi)
  const hepsi = metin.join('\n');
  const email = enIyi([...new Set(liste)], host, ulke);
  const out = { email, kaynak: email ? 'site' : null, osmAyni: !!(osmEmail && email && osmEmail.toLowerCase() === email) };
  if (RET_NOTU.test(hepsi.replace(/<[^>]+>/g, ' '))) out.engel = 'ret-notu';
  if (ULKELER[ulke] && ULKELER[ulke].sirketSart) { out.sirket = sirketKaniti(hepsi); if (!out.sirket) out.engel = out.engel || 'sirket-kaniti-yok'; }
  if (!email) out.engel = out.engel || 'eposta-yok';
  return out;
}
