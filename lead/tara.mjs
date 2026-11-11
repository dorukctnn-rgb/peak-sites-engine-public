// LEAD TARAMA: OSM lead'leri -> sitenin kendisi (robots'a uyarak) -> kotu site puani + yayimlanmis is e-postasi + hukuk engelleri.
//   node lead/tara.mjs --girdi calisma/lead/GB-konaklama.jsonl [--max 40] [--tarayici] [--es 6] [--devam] [--sure 20] [--cikti calisma/lead/GB-konaklama.tarandi.jsonl] [--ornek 15]
// Cikti satiri: lead + { tarandi, durum: 'aday'|'iyi-site'|'engel'|'erisilemedi'|'elendi', puan, bulgular, email?, engel?, sirket? }.
// E-POSTA ADRESI CIKTI DOSYASINA YAZILIR ama ASLA ekrana/gunluge basilmaz (bulut gunlukleri herkese acik olabilir).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Polite } from '../uyarla/v2lib/polite.mjs';
import { htmlPuan, tarayiciPuan, tarayiciOlc, topla, malzemeOlc } from './puan.mjs';
import { epostaBul } from './eposta.mjs';
import { kapaliMi } from '../uyarla/lib/kapali.mjs';

export async function taraBir(lead, { polite, browser = null }) {
  const o = { ...lead, tarandi: new Date().toISOString() };
  if (lead.elendi) return { ...o, durum: 'elendi' };
  const t0 = Date.now();
  const r = await polite.get(lead.website, { maxBytes: 4_000_000, accept: 'text/html' });
  const ms = Date.now() - t0;
  if (!r.ok) return { ...o, durum: 'erisilemedi', neden: r.why || `http:${r.status}` };
  if (!/html/.test(r.type || 'text/html')) return { ...o, durum: 'erisilemedi', neden: `tur:${r.type}` };
  const html = r.text; const finalUrl = r.finalUrl || lead.website;
  if (html.length < 600 || /domain (is )?for sale|parked free|this domain|buy this domain|account suspended|coming soon/i.test(html.slice(0, 20000))) return { ...o, durum: 'erisilemedi', neden: 'park-ya-da-bos' };
  const kapali = kapaliMi(html.slice(0, 400000).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
  if (kapali) return { ...o, durum: 'erisilemedi', neden: `isletme-kapali:${kapali.neden}` };
  let b = htmlPuan({ html, finalUrl, bytes: r.buf ? r.buf.length : html.length, ms, sektor: lead.sektor });
  if (browser) {
    let ctx;
    try {
      ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 PeakAppsStudioDraftBot/1.0' });
      const page = await ctx.newPage();
      await page.goto(finalUrl, { waitUntil: 'load', timeout: 25000 });
      await page.waitForTimeout(800);
      b = b.concat(tarayiciPuan(await tarayiciOlc(page)));
    } catch { b.push({ k: 'telefonda-acilmadi', v: '25 sn icinde yuklenmedi', p: 2 }); }
    finally { if (ctx) await ctx.close().catch(() => {}); }
  }
  const p = topla(b, lead.sektor);
  const e = await epostaBul({ html, finalUrl, ulke: lead.ulke, polite, osmEmail: lead.email });
  const out = { ...o, finalUrl, puan: p.puan, bulgular: p.bulgular, olculdu: p.olculdu, malzeme: malzemeOlc(html, finalUrl), email: e.email || null, sirket: e.sirket || null };
  if (!p.kotu) return { ...out, durum: 'iyi-site' };
  if (e.engel) return { ...out, durum: 'engel', engel: e.engel };
  return { ...out, durum: 'aday' };
}

// Havuzlu tarama: ayni anda en cok `es` isletme (hepsi FARKLI alan adi), sure dolunca temiz durur; her sonuc cikti dosyasina hemen eklenir (kaldigi yerden surer).
// onceki = daha once taranmis lead kimlikleri (atlanir).  -> { sayac, kalan }
export async function taraHepsi({ leads, cikti, es = 4, polite, browser = null, sureDk = Infinity, onceki = new Set(), log = () => {}, tara = taraBir }) {
  const t0 = Date.now(); const sayac = {}; const kuyruk = leads.filter((l) => !onceki.has(l.id) && !l.elendi); let i = 0; let sureDoldu = false;
  const is = async () => {
    while (i < kuyruk.length) {
      if ((Date.now() - t0) / 60000 > sureDk) { sureDoldu = true; return; }
      const l = kuyruk[i++]; let r;
      try { r = await tara(l, { polite, browser }); } catch (e) { r = { ...l, tarandi: new Date().toISOString(), durum: 'erisilemedi', neden: `hata:${String(e.message).slice(0, 40)}` }; }
      fs.appendFileSync(cikti, `${JSON.stringify(r)}\n`);
      sayac[r.durum] = (sayac[r.durum] || 0) + 1;
      log(`${r.id.padEnd(16)} ${r.durum.padEnd(11)} puan ${String(r.puan ?? '-').padStart(2)} ${(r.bulgular || []).map((x) => x.k).join(',')}${r.engel ? ` [${r.engel}]` : ''}${r.neden ? ` (${r.neden})` : ''}`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, es) }, is));
  return { sayac, kalan: sureDoldu };
}

export const jsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
export const tarananlar = (f) => new Set(jsonl(f).map((x) => x.id));

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const girdi = arg('--girdi'); const max = Number(arg('--max', 0)) || Infinity;
  let leads = jsonl(girdi).filter((l) => !l.elendi);
  const ornek = Number(arg('--ornek', 0));
  if (ornek) { // esit aralikli ornek (listenin basi bir bolgeye yigilmasin)
    const step = Math.max(1, Math.floor(leads.length / ornek)); leads = leads.filter((_, i) => i % step === 0).slice(0, ornek);
  }
  leads = leads.slice(0, max);
  const cikti = arg('--cikti', girdi.replace(/\.jsonl$/, '.tarandi.jsonl'));
  let browser = null;
  if (process.argv.includes('--tarayici')) { const { openBrowser } = await import('../uyarla/lib/ziyaret.mjs'); browser = await openBrowser(); }
  const polite = new Polite({ gapMs: Number(arg('--aralik', 400)), hostGapMs: 1600, timeoutMs: Number(arg('--zaman', 15000)) }); // --zaman 8000: erisilemeyen siteye daha kisa bekleme; --aralik 1000: saniyede en cok 1 istek (yerel TR denemesi)
  const devam = process.argv.includes('--devam');
  if (!devam) fs.writeFileSync(cikti, '');
  const r = await taraHepsi({ leads, cikti, es: Number(arg('--es', 1)), polite, browser, sureDk: Number(arg('--sure', 0)) || Infinity, onceki: devam ? tarananlar(cikti) : new Set(), log: console.log });
  if (browser) await browser.close();
  console.log(`OZET ${JSON.stringify(r.sayac)}${r.kalan ? ' (sure doldu, kalan var)' : ''} -> ${cikti}`);
}
