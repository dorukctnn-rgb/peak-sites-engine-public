// HAT 5. ADIM, TURKIYE (12 Kas 2026): Turkce restoran mail satiri (peak-outreach kampanyasi websites-demo-tr, METIN V2).  Satir HER ZAMAN bekletilir (_held); gonderime acmayi koordinator yapar.
// V2 (peak-outreach src/websites-demo-tr.mjs): 8 paragraf; ikinci paragraf isletmenin bugunku sitesindeki KANITLI 2-3 eksigi (eksikler: [{ cumle, kanit }]) sayar.  Eksikler burada
// OTOMATIK uretilir: isletmenin canli sitesi ve OpenStreetMap nesnesi okunur, her cumlenin kanitiyla yazilir; 2 kanitli eksik cikmayan isletme icin satir YAZILMAZ ("eksikler:eksik-az").
// Mail metni, eksik cumleleri ve kanit toplayici ozel katmandadir (mail/restoran-tr.mjs, mail/eksikler-tr.mjs; ozel-getir ile gelir).  Bu dosya yalniz bagliyor:
//   - hat/kuyruk.mjs satirlarKur TR satirinda trSatirKur'u cagirir (esitleme: eksikler onceden toplanmis olmali; yoksa isletme tr.bekleyen listesine girer, kuyruk.mjs toplar ve ikinci tur kurar)
//   - mail peak-outreach'in KENDI lintTr denetiminden gecmeden ve parti icinde benzersizlik (distinctTr) saglanmadan satir olusmaz
// tr: { eksik: Map(lead kimligi -> { eksikler, tur, elenme }), bekleyen: [], mail(x), denetle(o), benzersiz(items), onizleme(yol) -> hata | null, gonderen(row) -> bool, parti: [] }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const al = (p) => import(pathToFileURL(p).href);
export const KAMPANYA_TR = 'websites-demo-tr';
export const BEKLET_TR = 'koordinatör kontrolü bekliyor (TR)';
export const SALT_DENEME = 6; // ayni isletmede soyleyis degisince lint ya da benzersizlik duzelebilir

// satirin kimligi: lead kimligi (TR-n123...) ya da satir kimligi
export const trAnahtar = (x, l) => (l && l.id) || x.leadId || x.id;

// is e-postasi olamayacak adresler: kamu kurumu alan adlari (gov/edu/mil/k12/bel/pol/tsk/kep .tr) ve sitelerde kalan sahte/yazim hatali ornek adresler (lead/eposta.mjs KOTU_ADRES'e ek: "exmple.com")
export const EPOSTA_UYGUNSUZ_TR = /@[^@\s]*\.(gov|edu|mil|k12|bel|pol|tsk|kep)\.tr$|@(exmple|exampel|exemple|examle|sitename|siteadi|alanadi|yoursite|yourdomain|mydomain)\./i;

export function trSatirKur({ x, l, id, ad, sayfa, e, simdi, tr, kaynak }) {
  if (EPOSTA_UYGUNSUZ_TR.test(String(e || ''))) return { atla: 'eposta-uygunsuz' }; // eksik toplamaya (ag) bile girmez
  const ek = tr.eksik.get(trAnahtar(x, l));
  if (!ek) { if (tr.bekleyen) tr.bekleyen.push({ x, l }); return { atla: 'tr-eksik-bekliyor' }; }
  if (!Array.isArray(ek.eksikler) || !ek.eksikler.length) return { atla: `eksikler:${String(ek.elenme || 'yok').slice(0, 60)}` };
  if (!x.onizleme) return { atla: 'no-preview' };
  const pe = tr.onizleme(x.onizleme); if (pe) return { atla: `preview:${String(pe).slice(0, 60)}` };
  let m = null; let son = null;
  for (let salt = 0; salt < SALT_DENEME && !m; salt++) {
    const eksikler = salt && tr.soyle ? tr.soyle(ek, salt, x.slug || trAnahtar(x, l)) : ek.eksikler; // ayni eksikler baska soyleyisle
    const c = tr.mail({ ad, sayfa, slug: x.slug, eksikler, turler: ek.tur || [], salt });
    const sorun = tr.denetle({ id, subject: c.konu, body: c.govde, name: ad, pageUrl: sayfa, eksikler });
    if (sorun.length) { son = `lint:${String(sorun[0]).slice(0, 80)}`; continue; }
    const oge = { id, subject: c.konu, eksik: eksikler.map((z) => z.cumle).join(' '), benefit: c.fayda };
    const ayni = tr.benzersiz([...tr.parti, oge]);
    if (ayni.length) { son = `ayni-metin:${String(ayni[0]).slice(0, 80)}`; continue; }
    m = { c, oge, eksikler };
  }
  if (!m) return { atla: son || 'lint' };
  const rel = `attachments/${KAMPANYA_TR}/${id}.jpg`;
  const row = {
    id, to: e, name: ad, campaign: KAMPANYA_TR, region: 'TR', lang: 'tr', segment: 'demo', subject: m.c.konu, body: m.c.govde,
    notBefore: new Date(simdi.getTime() + 864e5).toISOString().slice(0, 10) + 'T00:00:00Z',
    preview: { path: rel, href: sayfa, alt: `${ad} için yeni ana sayfa, telefonda`.replace(/[<>"&]/g, '') },
  };
  Object.assign(row, {
    _held: BEKLET_TR, _ab: 'tr', _slug: x.slug, _page: sayfa, _template: x.sablon || 'v5', _city: (l && l.city) || null,
    _eksikler: m.eksikler.map((z) => ({ cumle: z.cumle.trim(), kanit: z.kanit.trim().slice(0, 300) })), _evidence: m.eksikler.map((z) => z.kanit.trim().slice(0, 300)).join(' | '),
    _email_source: String(kaynak || '').slice(0, 200), _hat: { sektor: 'restoran', parti: x.parti, eklendi: simdi.toISOString(), ulke: 'TR' },
  });
  if (tr.gonderen && !tr.gonderen(row)) return { atla: 'sender-name' };
  tr.parti.push(m.oge);
  return { row, kopya: { from: x.onizleme, to: rel } };
}

// ---- canli kanit toplama (ag): bekleyen TR isletmeleri icin eksikler uretilir ----
// E: ozel katman mail/eksikler-tr.mjs; getir/osmGetir enjekte edilebilir (testte), yoksa Polite (robots.txt'e uyan, sirali) kullanilir
export async function trEksikTopla({ tr, E, getir, osmGetir, simdi = new Date(), log = () => {} }) {
  const liste = tr.bekleyen.splice(0, tr.bekleyen.length);
  for (const { x, l } of liste) {
    const anahtar = trAnahtar(x, l);
    if (tr.eksik.has(anahtar)) continue;
    let sonuc;
    try {
      const girdi = await E.eksiklerTopla({ lead: l, getir, osmGetir, simdi });
      sonuc = E.eksiklerUret(girdi, { anahtar: x.slug || anahtar, ad: x.ad || l.name });
    } catch (er) { sonuc = { eksikler: [], tur: [], elenme: `okunamadi:${String(er && er.message).slice(0, 40)}` }; }
    tr.eksik.set(anahtar, sonuc);
    log(`tr eksik: ${x.slug || anahtar}: ${sonuc.eksikler.length ? sonuc.tur.join(',') : sonuc.elenme}`);
  }
  return liste.length;
}

// po: peak-outreach klonu (calisma/po); ozel katman ve peak-outreach modulleri yoksa null doner (TR satiri yazilmaz)
export async function trHazirla({ poDir, rd }) {
  try {
    const W = await al(path.join(poDir, 'src', 'websites-demo-tr.mjs'));
    const F = await al(path.join(poDir, 'src', 'facts.mjs'));
    const M = await al(path.join(poDir, 'src', 'mail.mjs'));
    const R = await al(path.join(HERE, '..', 'mail', 'restoran-tr.mjs'));
    const E = await al(path.join(HERE, '..', 'mail', 'eksikler-tr.mjs'));
    const facts = F.parseFacts(rd('campaigns/websites-demo/facts.json')).facts;
    return {
      E, eksik: new Map(), bekleyen: [], parti: [],
      mail: R.mailYazRestoranTr,
      soyle: (ek, salt, anahtar) => E.eksiklerYenidenSoyle(ek.secilen, { anahtar, salt }),
      denetle: (o) => W.lintTr({ ...o, facts }),
      benzersiz: (items) => W.distinctTr(items),
      onizleme: (p) => { try { const b = fs.readFileSync(p); const ok = M.checkAttachment(b, 'jpeg'); if (ok && ok.error) return ok.error; const kb = b.length / 1024; return kb < 60 || kb > 120 ? `${Math.round(kb)}KB (60-120)` : null; } catch { return 'dosya-yok'; } },
      gonderen: (row) => M.fromNameFor({ campaign: row.campaign, lang: row.lang, body: row.body }) === W.FROM_NAME_TR,
    };
  } catch (er) { return { hata: String(er && er.message).slice(0, 120) }; }
}
