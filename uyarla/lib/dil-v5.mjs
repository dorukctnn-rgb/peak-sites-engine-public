// v5 REFERANS DILI SECIMI + FONT ON AYARLARI (Ajan A).  Kaynak: REFERANS-A.md (amritpalace, khufus, ballenacabo olcumleri).
// Uc dil: mekan (fine dining / mekan, amritpalace grameri), sicak (akdeniz / sicak, khufus grameri), sahil (sahil / bar / manzara, ballenacabo grameri).
// Isletmenin kendi paleti, logosu, fotograflari ve metni degismez; dil yalniz sayfa gramerini (bolum sirasi, tipografi tavri, hareket teknigi) ve fontlari belirler.
// Fontlar referans sitenin hesaplanmis fontlaridir: ucretsizse aynisi, ticariyse en yakin acik lisansli es (gerekce REFERANS-A.md tablosunda). Hepsi OFL, fontsource'tan.
import { KATALOG } from './font.mjs';

export const DILLER = {
  mekan: {
    referans: 'amritpalace.com', ozet: 'fine dining / mekân: koyu zemin, ortalı büyük harf ince serif, bej ve tek sıcak vurgu, ekran ekran bölümler, yorum şeridi',
    display: { id: 'noto-serif-display', weight: 300, italic: false, upper: true, ls: -0.035, lh: 0.86, orig: 'TT Ramillas Variable 300 (ticari, TypeType)' },
    text: { id: 'albert-sans', weight: 400, strong: 600, orig: 'Satoshi 500 (Fontshare lisansı)' },
    ekstra: [{ id: 'noto-serif-display', weight: 300, italic: true }],
  },
  sicak: {
    referans: 'khufus.com', ozet: 'akdeniz / sıcak: açık kum ve krem, cümle düzeninde hafif serif + italik vurgu, çok boşluk, dik fotoğraf kartları, el yazısı alt başlık',
    display: { id: 'cormorant-garamond', weight: 300, italic: false, upper: false, ls: 0.01, lh: 1.03, em: { weight: 600, italic: true }, orig: 'IvyOra Display 300 (ticari, Ivy Foundry)' },
    text: { id: 'bricolage-grotesque', weight: 400, strong: 600, light: 300, orig: 'Bricolage Grotesque 300/400 (Google Fonts, OFL; aynısı)' },
    script: { id: 'sacramento', weight: 400, orig: 'Golden Hopes (kişisel kullanım lisansı)' },
    ekstra: [{ id: 'cormorant-garamond', weight: 600, italic: true }, { id: 'cormorant-garamond', weight: 400, italic: false }, { id: 'bricolage-grotesque', weight: 300, italic: false }, { id: 'sacramento', weight: 400, italic: false }],
  },
  sahil: {
    referans: 'ballenacabo.com', ozet: 'sahil / bar / manzara: krem ve koyu, tamamı büyük harf geometrik sans + artı harf aralığı, sola yaslı üç satır başlık, yarım foto yarım renk paneli, video/foto ölçek paralaksı',
    display: { id: 'jost', weight: 400, italic: false, upper: true, ls: 0.025, lh: 0.9, orig: 'Sweet Sans Pro 400 (ticari, MVB Fonts)' },
    text: { id: 'jost', weight: 400, strong: 500, orig: 'Sweet Sans Pro 400/500 (aynı aile)' },
    ekstra: [{ id: 'jost', weight: 300, italic: false }],
  },
};

// yalniz guclu ipuclari: su kiyisi, cati, havuz, bar/brewery (teras, bahce gibi zayif sozcukler sayilmaz; Italyan bir restoranin terasi onu sahil yapmaz)
const VENUE = /\b(river|riverside|riverbar|riverfront|sea|seaside|seafront|beach|beachside|beachfront|marina|harbou?r|waterfront|lake|lakeside|lakefront|bay|bayside|rooftop|roof[- ]top|pool|poolside|beer garden|brewery|taproom|tavern|esplanade|boardwalk|pier|coast|coastal|island|surf|yacht|wharf|quay|foreshore|sahil|deniz|nehir|iskele|liman|kordon)\b/i;
const MED = /(italian|italiano|sardinia|sicil|tuscan|napoli|roman|pizza|pasta|trattoria|osteria|pastelaria|portug|lisbon|spanish|tapas|greek|lebanese|mezze|mezza|turkish|middle east|egypt|moroccan|cafe|café|coffee|bakery|deli|pranzo|cucina|ristorante|espresso|brunch|panetteria|focaccia|akdeniz|kahve|firin)/i;

// -> { dil, neden[], ipucu }
export function dilSec(R, pal) {
  const lead = R.lead || {};
  const blob = `${lead.name || ''} ${(R.name && R.name.n) || ''} ${lead.category || ''} ${lead.kind || ''} ${R.tagline || ''} ${(R.address && R.address.text) || ''} ${((R.ek && R.ek.paragraflar) || []).slice(0, 2).join(' ')}`;
  const neden = []; const dark = pal && pal.mode === 'dark';
  const venue = VENUE.exec(blob); const med = MED.exec(blob);
  if (venue) { neden.push(`adında/metninde su kıyısı-çatı-bar ipucu ("${venue[0]}") → sahil dili (ballenacabo grameri)`); if (dark) neden.push('palet koyu: dil grameri kalır, renkler işletmenin kendi koyu paleti'); return { dil: 'sahil', neden, ipucu: venue[0] }; }
  if (dark) { neden.push('palet koyu, mekân vurgusu → mekân dili (amritpalace grameri)'); if (med) neden.push(`Akdeniz ipucu ("${med[0]}") var ama koyu palet önde`); return { dil: 'mekan', neden, ipucu: med ? med[0] : null }; }
  if (med) neden.push(`açık palet + Akdeniz/kafe ipucu ("${med[0]}") → sıcak dil (khufus grameri)`); else neden.push('açık palet, sıcak/kafe varsayılanı → sıcak dil (khufus grameri)');
  return { dil: 'sicak', neden, ipucu: med ? med[0] : null };
}

// fontEslestir ciktisi bicimine uygun fe nesnesi (uret/fontDosyalari/fontFaceCss ayni sekilde kullanir)
export function dilFontlari(dil) {
  const D = DILLER[dil]; if (!D) throw new Error(`bilinmeyen dil: ${dil}`);
  const spec = (id) => { const k = KATALOG[id]; if (!k) throw new Error(`katalogda yok: ${id}`); return k; };
  const ds = spec(D.display.id); const ts = spec(D.text.id);
  const fe = {
    display: { id: D.display.id, family: ds.family, cls: ds.cls, w: ds.w, weight: D.display.weight, italic: !!D.display.italic, via: /aynısı/.test(D.display.orig) ? 'ayni' : 'esdeger', orig: D.display.orig, mood: ds.mood, license: ds.license, styles: ds.styles, subsets: ds.subsets, upper: !!D.display.upper, ls: D.display.ls, lh: D.display.lh, em: D.display.em || null },
    text: { id: D.text.id, family: ts.family, cls: ts.cls, weight: D.text.weight, strong: D.text.strong, light: D.text.light || null, via: /aynısı/.test(D.text.orig) ? 'ayni' : 'esdeger', orig: D.text.orig, license: ts.license, styles: ts.styles, subsets: ts.subsets },
    script: D.script ? { id: D.script.id, family: spec(D.script.id).family, weight: D.script.weight, orig: D.script.orig, license: spec(D.script.id).license, subsets: spec(D.script.id).subsets } : null,
    ekstra: (D.ekstra || []).map((e) => ({ ...e, family: spec(e.id).family, subsets: spec(e.id).subsets })),
    notes: [`başlık fontu: ${D.display.orig} → ${ds.family} (${ds.license})`, `metin fontu: ${D.text.orig} → ${ts.family} (${ts.license})`].concat(D.script ? [`el yazısı: ${D.script.orig} → ${spec(D.script.id).family}`] : []),
  };
  return fe;
}
