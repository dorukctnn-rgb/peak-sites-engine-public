// HAT 1. ADIM: URETIM.  Taranmis lead'lerden (durum 'aday') her isletme icin: cikar -> uret -> kapi -> inceleme paketi.  Model yok, kota yok, e-posta yok.
//   node hat/uretim.mjs --leads calisma/lead/IE-konaklama.tarandi.jsonl [--limit 20] [--sure 300] [--only <lead id,...>]
// Kaldigi yerden surer: kapi.json'u olan isletme atlanir.  Her isletmeye en cok 6 dk.  Toplam sure siniri --sure (dk) dolunca temiz biter (cikis 10 = kalan var).
// Cikti (UYARLA_VERI): <slug>/{cikarici.json, uret.json, kapi.json, inceleme/sheet.jpg, inceleme/bilgi.json}; sayfalar UYARLA_DEMO/r/<slug>-<kod>/.
// E-POSTA ADRESI bu adimda OKUNMAZ (lead satirindaki email alani atilir); gunluk yalniz id + durum yazar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Polite } from '../uyarla/v2lib/polite.mjs';
import { openBrowser } from '../uyarla/lib/ziyaret.mjs';
import { sunucu } from '../uyarla/lib/sunucu.mjs';
import { slugOf } from '../uyarla/lib/leads.mjs';
import { cikar } from '../uyarla/cikar.mjs';
import { ek } from '../uyarla/ek.mjs';
import { uret, VERI, DEMO } from '../uyarla/uret.mjs';
import { kapi } from '../uyarla/kapi.mjs';
import { hazirla } from '../uyarla/inceleme-hazirla.mjs';
import { kapiBitti } from '../uyarla/lib/surum.mjs';
import { restoranHazirla } from '../uyarla/restoran-hazirla.mjs';
import { sablonSec } from '../uyarla/sablon-sec.mjs';
import { ULKELER } from '../lead/sektorler.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// lead (lead/tara.mjs ciktisi) -> uretecinin lead bicimi.  slug kalici: ad + ulke + osm kimliginin son 4 hanesi (ayni adli iki isletme karismaz)
export function uretimLead(l) {
  const tail = String(l.osm || l.id).replace(/\D/g, '').slice(-4);
  return { id: l.id, slug: `${slugOf(l.name).slice(0, 34)}-${String(l.ulke).toLowerCase()}${tail}`, name: l.name, site: l.finalUrl || l.website, kind: l.tur, category: l.tur, lang: (ULKELER[l.ulke] && ULKELER[l.ulke].dil) || 'en', region: l.ulke, city: l.city, phone: l.phone || '', sektor: l.sektor, mutfak: l.mutfak || null, bulgular: l.bulgular || [], osmAdres: [l.street, l.city, l.postcode].filter(Boolean).join(', ') || null, rating: null, reviews: null };
}

async function zamanli(p, ms, ad) {
  let t; const lim = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`zaman asimi (${ad})`)), ms); });
  try { return await Promise.race([p, lim]); } finally { clearTimeout(t); }
}

export async function uretimCalis({ leads, limit = Infinity, sureDk = 300, veri = VERI, out = DEMO, log = console.log }) {
  const t0 = Date.now(); const polite = new Polite({ gapMs: 1100, hostGapMs: 1800 });
  const srv = await sunucu(out); let browser = null; let n = 0; const sonuc = [];
  try {
    for (const l of leads) {
      if (n >= limit) break;
      if ((Date.now() - t0) / 60000 > sureDk) { log(`sure doldu (${sureDk} dk), kalan sonraki turda`); return { sonuc, kalan: true }; }
      const L = uretimLead(l); const dir = path.join(veri, L.slug);
      if (kapiBitti(path.join(dir, 'kapi.json'))) continue;
      fs.rmSync(path.join(dir, 'kapi.json'), { force: true }); // yalniz teknik nedenle gozden-gecir cikmis eski surum kaydi yeniden kosar
      n++;
      if (!browser || n % 20 === 1) { if (browser) await browser.close().catch(() => {}); browser = await openBrowser(); }
      const t1 = Date.now();
      try {
        const k = await zamanli((async () => {
          const R = await cikar(L, { browser, polite, out: veri, log: () => {} });
          if (R.erisim && R.erisim.ok) await ek(L.slug, { polite, log: () => {} });
          // restoran ailesi (v5, burger, burrito, pizza): sayfa burada URETILMEZ; malzeme + inceleme paketi (icerik turu icerik turu, goz turu son goz)
          if (sablonSec(L).sablon !== 'eski') { const kr = await restoranHazirla(L, { veri, polite, log: () => {} }); return { ...kr, page: null }; }
          await uret(L.slug, { veri, out, log: () => {} });
          const kk = await kapi(L.slug, { browser, base: srv.url, out, veri, log: () => {} });
          if (kk.status === 'hazir') await hazirla(L.slug, { veri, out });
          return kk;
        })(), 6 * 60 * 1000, L.slug);
        sonuc.push({ id: l.id, slug: L.slug, sektor: l.sektor, ulke: l.ulke, status: k.status, reasons: k.reasons.slice(0, 3), page: k.page || null, sn: Math.round((Date.now() - t1) / 1000) });
        log(`${String(n).padStart(3)} ${L.slug.padEnd(44)} ${l.ulke} ${l.sektor.padEnd(10)} ${k.status.padEnd(12)} ${Math.round((Date.now() - t1) / 1000)}s${k.reasons.length ? '  <- ' + k.reasons.slice(0, 2).join(' ; ').slice(0, 140) : ''}`);
      } catch (e) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'kapi.json'), JSON.stringify({ slug: L.slug, name: l.name, site: L.site, region: l.ulke, at: new Date().toISOString(), status: 'elendi', reasons: [`islem hatasi: ${String(e.message).slice(0, 120)}`], warnings: [], metrics: {} }, null, 1));
        sonuc.push({ id: l.id, slug: L.slug, sektor: l.sektor, ulke: l.ulke, status: 'elendi', reasons: [String(e.message).slice(0, 120)] });
        log(`${L.slug}: HATA ${String(e.message).slice(0, 140)}`);
        if (/zaman asimi/.test(String(e.message))) { try { await browser.close(); } catch { /* yok */ } browser = null; await sleep(500); }
      }
    }
  } finally { if (browser) await browser.close().catch(() => {}); await srv.close(); }
  return { sonuc, kalan: false };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const files = String(arg('--leads', '')).split(',').filter(Boolean);
  let leads = files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))).filter((l) => l.durum === 'aday');
  for (const l of leads) delete l.email; // bu adim adres gormez
  if (arg('--only')) { const o = arg('--only').split(','); leads = leads.filter((l) => o.includes(l.id)); }
  const r = await uretimCalis({ leads, limit: Number(arg('--limit', 0)) || Infinity, sureDk: Number(arg('--sure', 300)) });
  const by = r.sonuc.reduce((m, x) => { m[x.status] = (m[x.status] || 0) + 1; return m; }, {});
  console.log(`URETIM BITTI ${JSON.stringify(by)}${r.kalan ? ' (kalan var)' : ''}`);
  process.exit(r.kalan ? 10 : 0);
}
