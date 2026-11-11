// CIKARICI OLCUMU (12 Kas 2026): ayni isletmeleri ESKI veri (deneme turu cikarici.json) ve YENI cikarici ile hazirlik kapisindan gecirir; paket URETMEZ.
//   node uyarla/olcum-cikarici.mjs --hedefler <hedefler.json> --grup A[,B,C] --cikti <klasor> [--onceki-veri <veri klasoru>] [--onbellek <klasor>] [--max N] [--sil] [--kalici <klasor>]
// hedefler.json: [{ grup, lead: <uretimLead>, onceki?: { status, kural, reasons } }].  Her satir <cikti>/sonuc.jsonl'a eklenir (kaldigi yerden surer; biten satir yeniden olculmez).
// Kapi ayni islevdir (restoran-hazirla.mjs hazirlikKapisi): once = eski veri + bugunku kapi (yalniz cikarici farki olculur), sonra = yeni cikarici + bugunku kapi.
// Yeni gecen adaylar icin heroSec ilk 5 fotograf adayini (gercek piksel, puan, isaret) hero-adaylar.json'a ve onizlemeleri --kalici klasore yazar (sonraki tur gozle bakar).
// Ag: Polite (robots.txt, saniyede en cok 1 istek); --onbellek ile ayni adres iki kez cekilmez.  Tek headless tarayici.  E-posta yok, kuyruk yok.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Polite } from './v2lib/polite.mjs';
import { openBrowser, ziyaret } from './lib/ziyaret.mjs';
import { cikar } from './cikar.mjs';
import { hazirlikKapisi } from './restoran-hazirla.mjs';
import { heroSec } from './lib/hero-sec.mjs';
import { OnbellekPolite, ziyaretOnbellek } from './lib/onbellek.mjs';

const J = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const FIYAT = /[£€$]\s?\d{1,3}(?:[.,]\d{2})?\b/;

// fiyatli menu kaynagi VAR MI (ag yok; indirilebilirlik ve robots izni hazirlikta denenir): sayfa satirlari, PDF baglantisi, "menu" adli gorsel, siparis sitesi, metindeki fiyatli satirlar
export function menuKaynakVar(R, ham = '') {
  const satir = ((R.menu && R.menu.items) || []).filter((x) => x.n && x.p).length;
  if (satir >= 4) return 'sayfa';
  if (((R.menu && R.menu.pdfs) || []).length) return 'pdf';
  if ((R.photos || []).some((p) => /\bmenu|menus|price ?list|food ?board|specials?\b/i.test(`${decodeURIComponent(String(p.url || '').split('?')[0].split('/').pop() || '')} ${p.alt || ''}`))) return 'gorsel';
  if (ham.split('\n').filter((l) => FIYAT.test(l)).length >= 6) return 'metin';
  if (R.order && R.order.url) return 'siparis-sitesi';
  return null;
}
const anahtar = (r) => String(r).replace(/\s*\(.*$/, '').replace(/:.*$/, '').trim();

export function ozetle(satirlar) {
  const sayac = (alan) => { const t = {}; for (const s of satirlar) for (const r of (s[alan].reasons || [])) { const k = anahtar(r); t[k] = (t[k] || 0) + 1; } return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1])); };
  const gec = (alan) => satirlar.filter((s) => s[alan].gecer).length;
  return { n: satirlar.length, once: { gecen: gec('once'), nedenler: sayac('once') }, sonra: { gecen: gec('sonra'), nedenler: sayac('sonra') }, yeniGecen: satirlar.filter((s) => !s.once.gecer && s.sonra.gecer).map((s) => s.slug), dusen: satirlar.filter((s) => s.once.gecer && !s.sonra.gecer).map((s) => s.slug) };
}

async function zamanli(p, ms, ad) { let t; const lim = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`zaman asimi (${ad})`)), ms); }); try { return await Promise.race([p, lim]); } finally { clearTimeout(t); } }

export async function olc({ hedefler, cikti, ncikti = null, onceki = null, onbellek = null, max = Infinity, sil = false, kalici = null, log = console.log }) {
  fs.mkdirSync(cikti, { recursive: true });
  const sf = path.join(cikti, 'sonuc.jsonl'); const bitti = new Set(fs.existsSync(sf) ? fs.readFileSync(sf, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).slug) : []);
  const veri = path.join(cikti, 'veri'); fs.mkdirSync(veri, { recursive: true });
  const cd = (slug) => (sil ? path.join(onbellek, slug) : onbellek); // --sil: isletme basina onbellek (bitince silinir; disk); aksi halde ortak onbellek (gelistirme)
  let browser = await openBrowser(); let n = 0;
  try {
    for (const h of hedefler) {
      const L = h.lead; if (bitti.has(L.slug)) continue; if (n >= max) break; n++;
      if (n % 20 === 0) { await browser.close(); browser = await openBrowser(); }
      const t0 = Date.now(); const dir = path.join(veri, L.slug);
      // ---- once (eski veri + bugunku kapi) ----
      let once = { gecer: false, reasons: ['eski veri yok'], foto: null, logo: null, eylem: null };
      const od = onceki && path.join(onceki, L.slug); const R0 = od && J(path.join(od, 'cikarici.json'));
      if (R0) {
        const kg0 = hazirlikKapisi(R0, L, od); const mk0 = kg0.elendi ? null : menuKaynakVar(R0, kg0.ham0);
        const reasons0 = kg0.elendi || (mk0 ? [] : ['fiyatlı menü kaynağı yok (olası kaynak bulunamadı)']);
        once = { gecer: !reasons0.length, reasons: reasons0, foto: (R0.photos || []).length, logo: !!(R0.logo && R0.logo.orig), eylem: !!(R0.order && R0.order.url) || !!(R0.reservation && R0.reservation.external), menu: mk0 };
      }
      // ---- sonra (yeni cikarici) ----
      let sonra; let R1 = null;
      try {
        const polite = onbellek ? new OnbellekPolite(cd(L.slug), { gapMs: 1100, hostGapMs: 1800 }) : new Polite({ gapMs: 1100, hostGapMs: 1800 });
        const ziyaretFn = onbellek ? (b, u, o) => ziyaretOnbellek(cd(L.slug), b, u, o) : ziyaret;
        fs.rmSync(dir, { recursive: true, force: true });
        R1 = await zamanli(cikar(L, { browser, polite, out: veri, force: true, log: () => {}, olcum: true, ziyaretFn }), 6 * 60 * 1000, L.slug);
        const kg = hazirlikKapisi(R1, L, dir); const mk = kg.elendi ? null : menuKaynakVar(R1, kg.ham0);
        const reasons = kg.elendi || (mk ? [] : ['fiyatlı menü kaynağı yok (olası kaynak bulunamadı)']);
        const ph = R1.photos || []; const say = (k) => ph.filter((p) => p.isaretler && p.isaretler[k]).length;
        sonra = { gecer: !reasons.length, reasons, foto: ph.length, w800: ph.filter((p) => p.w >= 800).length, w1000: ph.filter((p) => p.w >= 1000).length, buyukSurum: ph.filter((p) => p.buyukSurum).length, stok: say('stok'), uretilmis: say('uretilmis'), afis: say('afis'), altSayfa: R1.fotoRapor && R1.fotoRapor.altSayfaSayisi, kaynaklar: R1.fotoRapor && R1.fotoRapor.kaynaklar, logo: R1.logo ? { via: R1.logo.via, svg: !!(R1.logo.orig && R1.logo.orig.svg), url: R1.logo.url } : null, eylem: kg.eylem ? { tur: kg.eylem.tur, platform: kg.eylem.platform, url: kg.eylem.url, dogrulama: kg.eylem.dogrulama && kg.eylem.dogrulama.durum } : null, menu: mk, istek: R1.requests };
      } catch (e) { sonra = { gecer: false, reasons: [`işlem hatası: ${String(e.message).slice(0, 100)}`], hata: true }; }
      // ---- yeni gecen: ilk 5 fotograf adayi (sonraki tur icerik turu/Son gozle bakar) ----
      let adaylar = null;
      if (sonra.gecer && !once.gecer && R1) {
        try {
          const polite2 = onbellek ? new OnbellekPolite(cd(L.slug), { gapMs: 1100, hostGapMs: 1800 }) : new Polite({ gapMs: 1100, hostGapMs: 1800 });
          const getir = async (u) => { const r = await polite2.get(u, { maxBytes: 40_000_000, accept: 'image/*', binary: true }); return r.ok && r.buf ? r : null; };
          const adayDir = path.join(kalici || cikti, 'hero-aday', L.slug);
          const hs = await heroSec(R1, { dir, imgDir: null, getir, maxFetch: 10, adayDir });
          adaylar = hs.adaylar.map((a) => ({ id: a.id, gercekPiksel: `${a.w}x${a.h}`, puan: a.puan, kaynak: a.kaynak, url: a.url, onizleme: a.onizleme ? path.join('hero-aday', L.slug, a.onizleme) : null, neden: a.neden, isaretler: ((R1.photos || []).find((p) => p.id === a.id) || {}).isaretler || null }));
          fs.writeFileSync(path.join(kalici || cikti, 'hero-aday', L.slug, 'hero-adaylar.json'), JSON.stringify({ slug: L.slug, ad: L.name, site: L.site, adaylar, logo: R1.logo && { via: R1.logo.via, dosya: R1.logo.orig.file }, eylem: sonra.eylem, not: 'puanlayicinin onerisi; secim gozle (Pausa paket kutulari, BoTOWN 09 dersleri)' }, null, 1));
        } catch (e) { adaylar = [{ hata: String(e.message).slice(0, 80) }]; }
      }
      const satir = { slug: L.slug, grup: h.grup, ad: L.name, site: L.site, ulke: L.region, tarama: h.tarama || null, onceki: h.onceki || null, once, sonra, heroAdaylari: adaylar, sn: Math.round((Date.now() - t0) / 1000) };
      fs.appendFileSync(sf, `${JSON.stringify(satir)}\n`);
      log(`${String(n).padStart(3)} ${h.grup} ${L.slug.padEnd(40)} once ${once.gecer ? 'GEC ' : 'ELE '} sonra ${sonra.gecer ? 'GEC ' : 'ELE '} foto ${once.foto ?? '-'}->${sonra.foto ?? '-'} ${sonra.gecer ? '' : (sonra.reasons || []).slice(0, 2).map(anahtar).join(' ; ')}  ${satir.sn}s`);
      if (sil) { fs.rmSync(dir, { recursive: true, force: true }); if (onbellek) fs.rmSync(path.join(onbellek, L.slug), { recursive: true, force: true }); }
    }
  } finally { await browser.close().catch(() => {}); }
  const tum = fs.readFileSync(sf, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return ozetle(tum);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const gruplar = String(arg('--grup', 'A')).split(',');
  const hedefler = J(arg('--hedefler'), []).filter((h) => gruplar.includes(h.grup));
  const o = await olc({ hedefler, cikti: arg('--cikti'), onceki: arg('--onceki-veri'), onbellek: arg('--onbellek'), max: Number(arg('--max', 0)) || Infinity, sil: process.argv.includes('--sil'), kalici: arg('--kalici') });
  fs.writeFileSync(path.join(arg('--cikti'), 'OZET.json'), JSON.stringify(o, null, 1));
  console.log(JSON.stringify(o, null, 1));
}
