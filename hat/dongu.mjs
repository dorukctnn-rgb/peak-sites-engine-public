// HAT: BIR BULUT TURU.  lead topla (OSM) -> tara (kotu site + yayimlanmis e-posta) -> uret + kapi (model yok) -> inceleme kutusu.
//   node hat/dongu.mjs --depo <veri deposu klonu> --kutu <inceleme kutusu klasoru> [--po <peak-outreach klonu>] [--sure 40] [--parti <id>]
// Ortam: UYARLA_VERI (isletme verisi, <depo>/veri), UYARLA_DEMO (sayfalar), SAYFA_TUZU (gizli sayfa tuzu).  Her asama kaldigi yerden surer ve sure butcesine uyar.
// Depo duzeni: lead/<ULKE>-<sektor>.jsonl (OSM), lead/<ULKE>-<sektor>.tarandi.jsonl (tarama; e-posta burada), veri/<slug>/ (uretim), durum/ (onay, dongu, gunluk).
// Ekrana ve gunluge ASLA e-posta adresi basilmaz; yalniz sayilar ve kimlikler.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kapiBitti } from '../uyarla/lib/surum.mjs';
import { uretimPuani } from '../lead/puan.mjs';
import { ULKELER, TEMEL_ULKE, kapaliUlke } from '../lead/sektorler.mjs';
import { leadKategori, leadOncelik } from './on-eleme.mjs';

const jsonOku = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const jsonYaz = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
const jsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const gun = (d = new Date()) => d.toISOString().slice(0, 10);
const zamanli = (p, ms, ad) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`zaman asimi: ${ad}`)), ms); })]).finally(() => clearTimeout(t)); };

export function planOku(dosya) {
  const p = jsonOku(dosya, null); if (!p) throw new Error(`plan okunamadi: ${dosya}`);
  const aktif = (s) => p.sektorler && p.sektorler[s] && p.sektorler[s].aktif;
  // Temel dort ulke (AU NZ IE GB) her zaman.  Diger ulkeler (TR 11 Kas, SG 11 Kas) yalniz plan.ulkeler.<kod>.aktif=true ve listelenen sektorler icin;
  // ULKELER'de olmayan ya da YASAK/BEKLE listesindeki ulke (HK, US, CA ...) plan ne derse desin girmez.  TR mail satiri ayrica TR_KUYRUK + onay.json "TR" ister (hat/kuyruk.mjs).
  const ulkeOk = (u, s) => {
    const U = ULKELER[u]; if (!U || kapaliUlke(u)) return false;
    if (U.yalnizSektor && !U.yalnizSektor.includes(s)) return false;
    if (TEMEL_ULKE.has(u)) return true;
    const P = p.ulkeler && p.ulkeler[u];
    return !!P && P.aktif === true && (P.sektorler || U.yalnizSektor || []).includes(s);
  };
  return { ...p, sira: (p.sira || []).filter(([u, s]) => aktif(s) && ulkeOk(u, s)) };
}

// Yeme-icme odagi (12 Kas 2026): restoran listesi eski etiketlerle (yalniz restaurant, fast_food, bar, pub) cekildiyse yenileme gunu beklenmeden yeniden cekilir; yeni listede kafe, pastane,
// firin, dondurma ve tatlici da olur.  Ayirt etme: yeni lead satirlarinda "dukkan" alani vardir (bos olsa da null), eski satirlarda hic yoktur.  Tarama ve uretim sonuclari lead kimligine bagli, kaybolmaz.
export function listeEtiketEski(dosya, sektor) {
  if (sektor !== 'restoran') return false;
  try { const ilk = fs.readFileSync(dosya, 'utf8').split('\n').find(Boolean); return !!ilk && !('dukkan' in JSON.parse(ilk)); } catch { return false; }
}

// ---- MAKSIMUM HAT (12 Kas 2026) ----
// HAT_TUR_ADAY: tur basina uretilecek aday sayisi (varsayilan 20; ortam degiskeni, plan.json limitler.uretimHerTur yedek).  Ust sinir 200.
export const TUR_ADAY_VARSAYILAN = 20;
// restoran ailesi tur hakki (plan.json limitler.restoranHerTur yoksa).  12 Kas 2026: 6 -> 15 (on eleme + OSM saat/adres ile gecme orani artti; sure hesabi hat/plan.json notunda)
export const RESTORAN_HER_TUR = 15;
// pizza ve burger (12 Kas 2026): ulke basina taranmis pizza+burger adayi bunun altindaysa hedefli tarama; restoran listesinde pizza+burger bundan azsa hedefli OSM sorgusu
export const PB_HAVUZ = 8;
export const PB_LISTE_ESIK = 50;
export function turAdayOku(env = process.env, L = {}) {
  const n = Math.floor(Number(env.HAT_TUR_ADAY));
  if (Number.isFinite(n) && n >= 1) return Math.min(n, 200);
  const y = Math.floor(Number(L.uretimHerTur)); return Number.isFinite(y) && y >= 1 ? y : TUR_ADAY_VARSAYILAN;
}
// HAT_ULKELER: virgulle ayrilmis ulke kodlari ("IE,GB,AU,NZ,TR"); bos = plandaki hepsi.  Yalniz KISAR: planOku'nun kapisindan gecmemis ulke (ornegin kapali TR) bununla acilmaz.
export function ulkeFiltre(sira, listeMetni = '') {
  const L = String(listeMetni || '').split(/[\s,]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  return L.length ? sira.filter(([u]) => L.includes(u)) : sira;
}
// Bolge donusu: sira [ulke, sektor] ciftleri sektor-major ve ulkeler DONEREK dizilir (ayni sektorun tum ulkeleri once, sonra siradaki sektor; baslangic ulkesi her tur ofset kadar kayar).
// Boylece OSM sorgusu ve tarama ayni ulkede yiginlanmaz.  ofset = tur sayaci (durum/dongu.json turlar).
export function siraDondur(sira, ofset = 0) {
  const ulkeler = []; const grup = new Map();
  for (const [u, s] of sira) { if (!grup.has(u)) { grup.set(u, []); ulkeler.push(u); } grup.get(u).push([u, s]); }
  if (ulkeler.length < 2) return sira.slice();
  const k = ((Math.floor(ofset) % ulkeler.length) + ulkeler.length) % ulkeler.length;
  const sirali = [...ulkeler.slice(k), ...ulkeler.slice(0, k)]; const out = [];
  for (let i = 0; Math.max(...[...grup.values()].map((g) => g.length)) > i; i++) for (const u of sirali) if (grup.get(u)[i]) out.push(grup.get(u)[i]);
  return out;
}
// Dengeli secim: liste (uretimPuani sirali) ulkelere bolunur, ulkeler sirayla birer aday verir (baslangic ulkesi ofsetle kayar); bir ulkede aday biterse digerleri tamamlar.
// Restoran ailesi icin tur sinirli (son goz kutusu kotasi): sinira ulasinca restoran adaylari atlanir, sira diger adaylara gecer.
export function adayDengele(liste, { adet = TUR_ADAY_VARSAYILAN, restoranSiniri = Infinity, ofset = 0 } = {}) {
  const grup = new Map();
  for (const l of liste) { if (!grup.has(l.ulke)) grup.set(l.ulke, []); grup.get(l.ulke).push(l); }
  const ulkeler = [...grup.keys()].sort(); if (!ulkeler.length) return [];
  const k = ((Math.floor(ofset) % ulkeler.length) + ulkeler.length) % ulkeler.length; const sirali = [...ulkeler.slice(k), ...ulkeler.slice(0, k)];
  const out = []; let restoran = 0; const imlec = new Map(sirali.map((u) => [u, 0]));
  while (out.length < adet) {
    let ilerledi = false;
    for (const u of sirali) {
      if (out.length >= adet) break;
      const g = grup.get(u); let i = imlec.get(u);
      while (i < g.length) { const l = g[i++]; if (l.sektor === 'restoran') { if (restoran >= restoranSiniri) continue; restoran++; } out.push(l); ilerledi = true; break; }
      imlec.set(u, i);
    }
    if (!ilerledi) break;
  }
  return out;
}

// PIZZA VE BURGER ONCELIGI (12 Kas 2026, Doruk: "pizzacı ve hamburgercilere çok ağırlık ver, o şablonlar çok iyi!"): restoran adaylari kategori onceligine gore
// secilir (pizza + burger, sonra burrito/taco, sonra digerleri: hat/on-eleme.mjs leadOncelik); her oncelik grubunda ulkeler dengeli (adayDengele).  Pizza ve burger adayi
// varken tur hakkinin tamami once onlara gider (en az ~2/3 sarti boylece kendiliginden saglanir); yetmezse siradaki grup tamamlar.
export function restoranSec(liste, { adet = RESTORAN_HER_TUR, ofset = 0, oncelikOf = leadOncelik } = {}) {
  const out = [];
  for (const p of [0, 1, 2]) { if (out.length >= adet) break; out.push(...adayDengele(liste.filter((l) => oncelikOf(l) === p), { adet: adet - out.length, ofset })); }
  return out;
}
export function havuzKategori(liste) {
  const m = { restoran: 0, pizza: 0, burger: 0, burrito: 0 };
  for (const l of liste) { if (l.sektor !== 'restoran') continue; m.restoran++; const k = leadKategori(l); if (k) m[k]++; }
  return m;
}

// uretilecek adaylar: taranmis, durum aday, uretilmemis, daha once yazilmamis/susturulmamis; sira: lead/puan.mjs uretimPuani (kotu ama malzemesi olan siteler once)
export function adaylar({ depo, plan, veri, yazilan = null, uretimLead }) {
  const out = [];
  for (const [ulke, sektor] of plan.sira) {
    for (const l of jsonl(path.join(depo, 'lead', `${ulke}-${sektor}.tarandi.jsonl`))) {
      if (l.durum !== 'aday' || !l.email) continue;
      if (kapiBitti(path.join(veri, uretimLead(l).slug, 'kapi.json'))) continue;
      if (yazilan && yazilan.neden(l.email, l)) continue;
      out.push(l);
    }
  }
  return out.sort((a, b) => uretimPuani(b) - uretimPuani(a));
}

export async function dongu({ depo, kutu, po = null, sureDk = 40, parti = `p${Date.now().toString(36)}`, planDosya, veri, araclar, log = console.log, simdi = new Date(), env = process.env }) {
  const t0 = Date.now(); const kalanDk = () => sureDk - (Date.now() - t0) / 60000;
  const plan = planOku(planDosya); const L = plan.limitler || {};
  const onceki = jsonOku(path.join(depo, 'durum', 'dongu.json'), { turlar: 0 }); const ofset = onceki.turlar || 0;
  plan.sira = siraDondur(ulkeFiltre(plan.sira, env.HAT_ULKELER), ofset); // her tur baska ulkeyle baslar
  const turAday = turAdayOku(env, L);
  const A = araclar; const sonuc = { parti, osm: [], tarandi: {}, uretim: {}, kutuya: 0, adaySayisi: 0, turAday, ulkeler: {}, hata: [] };
  const okuPo = (f) => (po && fs.existsSync(path.join(po, f)) ? fs.readFileSync(path.join(po, f), 'utf8') : '');
  let yazilan = null;
  if (po) {
    const jl = (t) => String(t || '').split(/\r?\n/).filter(Boolean).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
    yazilan = A.yazilanlar({ sent: jl(okuPo('data/sent.jsonl')), queue: jl(okuPo('data/queue.jsonl')), suppress: okuPo('suppress.txt'), replied: okuPo('data/replied.txt') });
  }

  // 1. lead topla: yeni ya da eskimis liste icin en cok osmSorguHerTur sorgu
  // 12 Kas 2026: buyuk ulkeler PARCALI (lead/osm.mjs bulParcali): ulke kutusu parcalara bolunur, her turda butce kadar parca cekilir, ilerleme
  // lead/<ULKE>-<sektor>.parca.json'da turlar arasi tasinir (bitmemis liste varken eski liste kullanilmaya devam eder).  OSM butcesi en cok 6 dk.
  let osmKota = L.osmSorguHerTur ?? 1;
  for (const [ulke, sektor] of plan.sira) {
    if (osmKota <= 0 || kalanDk() < 8) break;
    const f = path.join(depo, 'lead', `${ulke}-${sektor}.jsonl`); const yenile = L.leadYenilemeGun ?? 120;
    const ilerleme = path.join(depo, 'lead', `${ulke}-${sektor}.parca.json`); const devam = fs.existsSync(ilerleme);
    const eski = fs.existsSync(f) && !listeEtiketEski(f, sektor) ? (Date.now() - fs.statSync(f).mtimeMs) / 864e5 : Infinity;
    if (eski < yenile && !devam) continue;
    osmKota--;
    if (A.bulParcali) {
      const butceDk = Math.max(1, Math.min(6, kalanDk() - 8));
      try {
        const r = await zamanli(A.bulParcali(ulke, sektor, { ilerleme, bitis: Date.now() + butceDk * 60000, log: () => {} }), (butceDk + 2.5) * 60000, `osm ${ulke}-${sektor}`);
        if (r.tamam && r.leads.length) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${r.leads.map((x) => JSON.stringify(x)).join('\n')}\n`); }
        sonuc.osm.push(`${ulke}-${sektor}: ${r.tamam ? r.leads.length : `parca ${r.parca}`}`); log(`osm ${ulke}-${sektor}: ${r.tamam ? `${r.leads.length} lead (${r.parca} parca)` : `parca ${r.parca}, sonraki turda surer`}`);
        if (r.hata) sonuc.hata.push(`osm ${ulke}-${sektor}: ${r.hata}`);
      } catch (e) { sonuc.hata.push(`osm ${ulke}-${sektor}: ${String(e.message).slice(0, 80)}`); log(`osm ${ulke}-${sektor} hata: ${String(e.message).slice(0, 80)}`); }
      continue;
    }
    try {
      const leads = await zamanli(A.bul(ulke, sektor, { log: () => {} }), Math.min(8, kalanDk() - 2) * 60000, `osm ${ulke}-${sektor}`);
      if (leads.length) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${leads.map((x) => JSON.stringify(x)).join('\n')}\n`); }
      sonuc.osm.push(`${ulke}-${sektor}: ${leads.length}`); log(`osm ${ulke}-${sektor}: ${leads.length} lead`);
    } catch (e) { sonuc.hata.push(`osm ${ulke}-${sektor}: ${String(e.message).slice(0, 80)}`); log(`osm ${ulke}-${sektor} hata: ${String(e.message).slice(0, 80)}`); }
  }

  // 1b. HEDEFLI PIZZA + BURGER SORGUSU (12 Kas 2026, Doruk): restoran listesi yoksa, eski etiketliyse ya da icinde pizza+burger PB_LISTE_ESIK'ten azsa
  // amenity=restaurant|fast_food + (cuisine~pizza|burger ya da adinda pizza/burger) + (website ya da contact:website) tek, hafif sorgu (lead/osm.mjs sorguPB; parcali, TR'de zaman asimina dusmez).
  // Sonuc <ULKE>-restoran.pb.jsonl (tarama ana listeyle birlikte okur).  Turda en cok osmHedefliHerTur (1) ulke, en cok 3 dk.
  let pbKota = L.osmHedefliHerTur ?? 1;
  for (const [ulke, sektor] of plan.sira) {
    if (sektor !== 'restoran' || !A.bulParcali) continue;
    if (pbKota <= 0 || kalanDk() < 10) break;
    const pbF = path.join(depo, 'lead', `${ulke}-${sektor}.pb.jsonl`); const pbIl = path.join(depo, 'lead', `${ulke}-${sektor}.pb.parca.json`); const devam = fs.existsSync(pbIl);
    const yenile = L.leadYenilemeGun ?? 120; const pbYas = fs.existsSync(pbF) ? (Date.now() - fs.statSync(pbF).mtimeMs) / 864e5 : Infinity;
    if (!devam && pbYas < yenile) continue;
    const ana = path.join(depo, 'lead', `${ulke}-${sektor}.jsonl`);
    const anaPB = fs.existsSync(ana) ? jsonl(ana).filter((l) => !l.elendi && leadOncelik(l) === 0).length : 0; // eski etiketli liste de sayilir (restaurant ve fast_food eski etiketlerde de vardi)
    if (!devam && anaPB >= PB_LISTE_ESIK) continue; // ana liste pizza ve burger acisindan zengin
    pbKota--;
    const butceDk = Math.max(1, Math.min(3, kalanDk() - 10));
    try {
      const r = await zamanli(A.bulParcali(ulke, sektor, { ilerleme: pbIl, hedef: 'pizza-burger', bitis: Date.now() + butceDk * 60000, log: () => {} }), (butceDk + 2.5) * 60000, `osm ${ulke} pizza-burger`);
      if (r.tamam) { fs.mkdirSync(path.dirname(pbF), { recursive: true }); fs.writeFileSync(pbF, r.leads.length ? `${r.leads.map((x) => JSON.stringify({ ...x, hedefli: 'pizza-burger' })).join('\n')}\n` : ''); }
      sonuc.osm.push(`${ulke}-pizza-burger: ${r.tamam ? r.leads.length : `parca ${r.parca}`}`); log(`osm ${ulke} pizza-burger: ${r.tamam ? `${r.leads.length} lead (ana listede ${anaPB})` : `parca ${r.parca}`}`);
      if (r.hata) sonuc.hata.push(`osm ${ulke} pizza-burger: ${r.hata}`);
    } catch (e) { sonuc.hata.push(`osm ${ulke} pizza-burger: ${String(e.message).slice(0, 80)}`); }
  }

  // 2. tara: uretilmemis aday havuzu hedefin altindaysa yeni lead tara (sure butcesinin ~%40'i)
  const hedef = Math.max(L.havuzHedef ?? 40, turAday); const taraBitis = Date.now() + Math.max(0, kalanDk()) * 0.4 * 60000;
  const ulkeler = [...new Set(plan.sira.map(([u]) => u))]; const ulkeHedef = Math.ceil(hedef / Math.max(1, ulkeler.length));
  // pizza ve burger (12 Kas 2026): ulkenin genel havuzu dolu olsa da pizza+burger havuzu PB_HAVUZ'un altindaysa yalniz pizza/burger lead'leri taranir;
  // restoran listesi taranirken pizza/burger lead'leri once (hedefli liste <ULKE>-restoran.pb.jsonl de girdi).
  const PBH = L.pizzaBurgerHavuz ?? PB_HAVUZ; const pbBitti = new Set();
  const havuz = () => { const m = {}; const pb = {}; for (const l of adaylar({ depo, plan, veri, yazilan, uretimLead: A.uretimLead })) { m[l.ulke] = (m[l.ulke] || 0) + 1; if (l.sektor === 'restoran' && leadOncelik(l) === 0) pb[l.ulke] = (pb[l.ulke] || 0) + 1; } return { m, pb }; };
  let polite = null; let browser = null;
  for (const [ulke, sektor] of plan.sira) {
    if (Date.now() > taraBitis - 30000) break;
    const { m: say, pb } = havuz(); const pbGerek = (u, sk) => sk === 'restoran' && (pb[u] || 0) < PBH && !pbBitti.has(u);
    if (plan.sira.every(([u, sk]) => (say[u] || 0) >= ulkeHedef && !pbGerek(u, sk))) break;
    const tam = (say[ulke] || 0) < ulkeHedef; const yalnizPB = !tam && pbGerek(ulke, sektor);
    if (!tam && !yalnizPB) continue; // bu ulkenin havuzu dolu: siradaki ulkeye gec (ayni ulkede yiginlanma yok)
    const girdiler = [`${ulke}-${sektor}.jsonl`, ...(sektor === 'restoran' ? [`${ulke}-${sektor}.pb.jsonl`] : [])].map((f) => path.join(depo, 'lead', f)).filter((f) => fs.existsSync(f));
    if (!girdiler.length) { if (yalnizPB) pbBitti.add(ulke); continue; }
    const cikti = path.join(depo, 'lead', `${ulke}-${sektor}.tarandi.jsonl`); const onceki = A.tarananlar(cikti);
    const gor = new Set(); let leads = girdiler.flatMap((f) => jsonl(f)).filter((l) => !l.elendi && !onceki.has(l.id) && !gor.has(l.id) && gor.add(l.id));
    if (sektor === 'restoran') leads = [...leads.filter((l) => leadOncelik(l) === 0), ...leads.filter((l) => leadOncelik(l) !== 0)];
    if (yalnizPB) leads = leads.filter((l) => leadOncelik(l) === 0);
    if (!leads.length) { if (yalnizPB) pbBitti.add(ulke); continue; }
    if (!polite) { polite = new A.Polite({ gapMs: 400, hostGapMs: 1600, timeoutMs: 15000 }); browser = await A.openBrowser(); }
    const r = await A.taraHepsi({ leads, cikti, es: L.tarayiciEs ?? 6, polite, browser, sureDk: (taraBitis - Date.now()) / 60000, onceki, log: () => {} });
    sonuc.tarandi[`${ulke}-${sektor}${yalnizPB ? '-pb' : ''}`] = r.sayac; log(`tara ${ulke}-${sektor}${yalnizPB ? ' (yalniz pizza+burger)' : ''}: ${JSON.stringify(r.sayac)}`);
    if (yalnizPB) pbBitti.add(ulke); // bir turda bir kez
  }
  if (browser) await browser.close().catch(() => {});

  // 3. uret + kapi + inceleme paketi
  let liste = adaylar({ depo, plan, veri, yazilan, uretimLead: A.uretimLead }); sonuc.adaySayisi = liste.length;
  sonuc.havuz = havuzKategori(liste); log(`havuz: ${JSON.stringify(sonuc.havuz)}`);
  // restoran ailesi son goz kutusu kotasina bagli: turda en cok restoranHerTur isletme hazirlanir; secim ulkeler arasi dengeli (HAT_TUR_ADAY adet)
  const RH = L.restoranHerTur ?? RESTORAN_HER_TUR;
  // 3a. ON ELEME (12 Kas 2026, hat/on-eleme.mjs): hazirliktan once ucuz bakis (ana sayfa sinyalleri + OSM saat/adres etiketleri); zincir ve menusuz adaylar bu turda atlanir,
  // digerleri gecme olasiligina gore siralanir.  Sure: en cok ~2,5 dk ya da kalan surenin %10'u.
  if (A.onHazirla && liste.some((l) => l.sektor === 'restoran') && kalanDk() > 6) {
    try {
      const pol = A.Polite ? new A.Polite({ gapMs: 300, hostGapMs: 1600, timeoutMs: 12000 }) : null;
      const r = await A.onHazirla({ liste, depo, adet: Math.max(RH * 3, 30), bitis: Date.now() + Math.min(2.5, kalanDk() * 0.1) * 60000, polite: pol, es: L.tarayiciEs ?? 6, log: () => {} });
      liste = r.liste; sonuc.onEleme = r.sayac; log(`on eleme: ${JSON.stringify(r.sayac)}`);
    } catch (e) { sonuc.hata.push(`on eleme: ${String(e.message).slice(0, 80)}`); }
  }
  if (liste.length && kalanDk() > 3) {
    // restoran ailesi: pizza + burger once (restoranSec), sonra diger sektorler ulkeler arasi dengeli
    const rSec = restoranSec(liste.filter((l) => l.sektor === 'restoran'), { adet: Math.min(RH, turAday), ofset });
    const secilen = [...rSec, ...adayDengele(liste.filter((l) => l.sektor !== 'restoran'), { adet: turAday - rSec.length, restoranSiniri: 0, ofset })];
    sonuc.secilenKategori = havuzKategori(rSec);
    for (const l of secilen) sonuc.ulkeler[l.ulke] = (sonuc.ulkeler[l.ulke] || 0) + 1;
    const leads = secilen.map((l) => { const c = { ...l }; delete c.email; return c; });
    const r = await A.uretimCalis({ leads, limit: leads.length, sureDk: kalanDk() - 2, log: (s) => log(s.slice(0, 160)) });
    for (const x of r.sonuc) sonuc.uretim[x.status] = (sonuc.uretim[x.status] || 0) + 1;
    log(`uretim: ${JSON.stringify(sonuc.uretim)}`);
  }

  // 4. inceleme kutusu: kapidan hazir cikanlar, daha once kutuya girmemis olanlar
  if (kutu) {
    const gecmisF = path.join(depo, 'durum', 'kutu-gecmis.json'); const gecmis = new Set(jsonOku(gecmisF, []));
    const yeni = A.hazirlar(veri).filter((s) => !gecmis.has(s));
    if (yeni.length) { sonuc.kutuya = A.kutuEkle({ kutu, parti, slugs: yeni, veri }); for (const s of yeni) gecmis.add(s); jsonYaz(gecmisF, [...gecmis].sort()); }
    // restoran ailesi: icerik bekleyen paketler (icerik turu icerik turu); gecmiste 'i:<slug>' olarak tutulur
    const yeniI = A.icerikHazir ? A.icerikHazir(veri).filter((s) => !gecmis.has(`i:${s}`)) : [];
    if (yeniI.length) { sonuc.kutuya += A.kutuEkle({ kutu, parti, slugs: yeniI, veri, tur: 'icerik' }); for (const s of yeniI) gecmis.add(`i:${s}`); jsonYaz(gecmisF, [...gecmis].sort()); }
    log(`kutu: ${sonuc.kutuya} yeni, ${A.kutuOku(kutu).length} bekliyor`);
  }

  // 5. durum
  const d = jsonOku(path.join(depo, 'durum', 'dongu.json'), { turlar: 0 });
  jsonYaz(path.join(depo, 'durum', 'dongu.json'), { ...d, turlar: (d.turlar || 0) + 1, son: simdi.toISOString(), sonSonuc: sonuc, dakika: Math.round((Date.now() - t0) / 600) / 100 });
  jsonYaz(path.join(depo, 'durum', 'gunluk', `${gun(simdi)}.json`), (() => { const g = jsonOku(path.join(depo, 'durum', 'gunluk', `${gun(simdi)}.json`), { turlar: [] }); g.turlar.push({ parti, ...sonuc }); return g; })());
  try { const { kanit, tablo } = await import('./sektor-kanit.mjs'); const b = jsonOku(path.join(depo, 'durum', 'birak.json'), null); const ds = jsonOku(path.join(depo, 'durum', 'dongu.json'), {});
    fs.writeFileSync(path.join(depo, 'durum', 'DURUM.md'), `# Hat durumu (${simdi.toISOString()})

Tur sayisi ${ds.turlar}; son tur: aday havuzu ${sonuc.adaySayisi}, uretim ${JSON.stringify(sonuc.uretim)}, kutuya ${sonuc.kutuya}, hata ${JSON.stringify(sonuc.hata)}

Serbest birakma: ${b ? `hedef ${b.hedef}/gun, ${b.durak ? 'DURAK: ' + b.durak : 'acik'}` : 'henuz calismadi'}

## Sektor ve ulke hunisi

${tablo(kanit(path.join(depo, 'lead')))}
`); } catch { /* rapor yazilamadiysa tur bozulmaz */ }
  return sonuc;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const depo = path.resolve(arg('--depo', 'calisma/veri-depo'));
  if (!process.env.UYARLA_VERI) process.env.UYARLA_VERI = path.join(depo, 'veri');
  if (!process.env.UYARLA_DEMO) process.env.UYARLA_DEMO = path.resolve('calisma/demo');
  const [{ bul, bulParcali }, tara, { Polite }, { openBrowser }, { uretimCalis, uretimLead }, kutuM, { yazilanlar }, { onHazirla }] = await Promise.all([import('../lead/osm.mjs'), import('../lead/tara.mjs'), import('../uyarla/v2lib/polite.mjs'), import('../uyarla/lib/ziyaret.mjs'), import('./uretim.mjs'), import('./kutu.mjs'), import('./kuyruk.mjs'), import('./on-eleme.mjs')]);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = await dongu({
    depo, kutu: arg('--kutu') ? path.resolve(arg('--kutu')) : null, po: arg('--po') ? path.resolve(arg('--po')) : null, sureDk: Number(arg('--sure', 40)), parti: arg('--parti') || undefined,
    planDosya: path.join(root, 'hat', 'plan.json'), veri: process.env.UYARLA_VERI,
    araclar: { bul, bulParcali, onHazirla, taraHepsi: tara.taraHepsi, tarananlar: tara.tarananlar, Polite, openBrowser, uretimCalis, uretimLead, hazirlar: kutuM.hazirlar, icerikHazir: kutuM.icerikHazir, kutuEkle: kutuM.ekle, kutuOku: kutuM.kutuOku, yazilanlar },
  });
  console.log(`DONGU BITTI ${JSON.stringify({ osm: r.osm, tarandi: r.tarandi, adaySayisi: r.adaySayisi, uretim: r.uretim, turAday: r.turAday, ulkeler: r.ulkeler, kutuya: r.kutuya, hata: r.hata })}`);
  process.exit(0);
}
