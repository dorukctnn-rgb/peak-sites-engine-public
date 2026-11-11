// KATEGORI TAMAMLA (Ajan B): cikariciya girmeyen alanlari (adres, menu, kendi paragraflari, siparis baglantisi, e-posta, kurulus) data/elle/kategori-b.json'daki
// "kategoriEk" kaydindan cikarici.json'a isler.  Ag yok, model yok, tekrar calistirilabilir (idempotent).  Ham cikarma cikarici-ham.json olarak bir kez yedeklenir.
//   node uyarla/kategori-tamamla.mjs <slug,...> [--veri <klasor>]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { groupMenu } from './lib/menu.mjs';
import { parseSaatler } from './lib/saat.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
import { VERI } from './lib/yol.mjs';
import { icerikKategori } from './uret-kategori.mjs';
export const VERI_K = VERI;
export function elleKategori() { try { return JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'kategori-elle.json'), 'utf8')); } catch { return {}; } }

export function tamamla(slug, { veri = VERI_K } = {}) {
  const dir = path.join(veri, slug); const jf = path.join(dir, 'cikarici.json');
  const R = JSON.parse(fs.readFileSync(jf, 'utf8'));
  const E = ((icerikKategori(veri, slug) || elleKategori()[slug]) || {}).kategoriEk; if (!E) return { slug, durum: 'kategoriEk yok' };
  const ham = path.join(dir, 'cikarici-ham.json'); if (!fs.existsSync(ham)) fs.copyFileSync(jf, ham);
  const yapilan = [];
  // elle adres (sitenin iletisim bolumunden, virgullu) her zaman gecerli: cikaricinin bulduguyla ayniysa da bicimi duzeltir
  if (E.adres) { R.address = { text: E.adres, via: 'elle (sitenin iletişim bölümü)', cikarici: (R.address && R.address.text) || null }; yapilan.push('adres'); }
  // ozgun logo yuklemesi (or. Wix'in kucultulmus surumu yerine ozgun dosya): kategori-foto-ekle ile eklenen karenin kendisi, bayt bayt
  if (E.logoFoto) {
    const ph = (R.photos || []).find((x) => x.id === String(E.logoFoto));
    if (ph) { const buf = fs.readFileSync(path.join(dir, ph.file)); R.logo = { ...(R.logo || {}), orig: { file: ph.file, mime: ph.file.endsWith('.png') ? 'image/png' : 'image/jpeg', bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), w: ph.w, h: ph.h, svg: false, note: 'ozgun yukleme' }, url: ph.url, via: 'elle (ozgun logo yuklemesi)' }; yapilan.push('logo (ozgun yukleme)'); }
  }
  if (E.telefon) { R.phone = E.telefon; yapilan.push('telefon (alan koduyla)'); }
  if (E.mail) { R.mail = E.mail; yapilan.push('e-posta (yalnız not; mail atılmaz)'); }
  if (E.siparis) { R.order = { ...E.siparis, via: 'elle (sitenin kendi bağlantısı)' }; yapilan.push('sipariş'); }
  if (E.hediye) R.giftUrl = E.hediye;
  if (E.menu && E.menu.length) {
    const items = E.menu.map((it) => ({ n: it.n, d: it.d || '', p: it.p, cat: it.cat, page: R.lead.site, ek: 'elle' }));
    R.menu = { ...(R.menu || {}), via: 'elle (sitenin kendi menü metni)', items, groups: groupMenu(items).map((g) => ({ name: g.name, n: g.items.length })), pageUrl: R.lead.site.replace(/\/$/, '') + '/#menu', pdfs: [], skipped: [] };
    yapilan.push(`menü ${items.length}`);
  }
  if (E.paragraflar && E.paragraflar.length) { R.ek = { ...(R.ek || {}), paragraflar: E.paragraflar, kaynak: 'elle (sitenin kendi metni)' }; yapilan.push('paragraflar'); }
  if (E.saatSatirlar && E.saatSatirlar.length) { const p = parseSaatler(E.saatSatirlar); if (p && p.tableOk) { R.hours = p; yapilan.push('saat'); } }
  R.kategoriEk = { at: new Date().toISOString(), kurulus: E.kurulus || null, kurulusMetni: E.kurulusMetni || null, sahipler: E.sahipler || null, motto: E.motto || null, hikaye: E.hikaye || null, menuNot: E.menuNot || null };
  fs.writeFileSync(jf, JSON.stringify(R, null, 1));
  return { slug, durum: 'tamam', yapilan };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const which = process.argv[2]; if (!which) { console.error('kullanim: node uyarla/kategori-tamamla.mjs <slug,slug> [--veri klasor]'); process.exit(2); }
  const i = process.argv.indexOf('--veri'); const veri = i > 0 ? process.argv[i + 1] : VERI_K;
  for (const s of which.split(',')) console.log(JSON.stringify(tamamla(s, { veri })));
}
