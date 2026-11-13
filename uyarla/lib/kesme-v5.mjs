// KESME (v5 restoran imlec izi, 12 Kas 2026): isletmenin KENDI yemek fotografindan temiz tabak kesimi (klasik GrabCut, uyarla/py/kesme.py; model yok) ve izin atlasi.
// Kesim kutulari icerik kararindan gelir (icerik.ust.iz.kesimler: inceleme turu fotografa bakip her tabagin kutusunu yazar); burada yalniz kesilir ve OLCULUR:
//   kenarTemas = false      kesim kare kenarina degmez (kesik tabak yok)
//   doluluk   >= 0.95       maske kendi dis bukesine yakin (tabakta dis kenar duzgun)
//   kenarKontrast >= 45     kenarin ici ile disi arasinda gercek bir renk farki (belirsiz kesim yok)
// En az 4 temiz kesim yoksa iz YOK (stok ya da kotu kesim kullanilmaz).  Python, opencv, numpy ve pillow gerekir: bulutta `pip install -r uyarla/py/gereksinim.txt`
// (opencv-python-headless); PEAK_PYTHON ortam degiskeni yorumlayiciyi gosterir.  Python ya da opencv yoksa iz sessizce kapanir, nedeni raporlanir (durum 'python-yok').
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PY = path.join(HERE, '..', 'py');
export const KESME_ESIK = { kenarKontrast: 45, doluluk: 0.95, enAz: 4, hucre: 288 };
const AD = /^[a-z0-9-]{2,24}$/;

// kutu: [x0, y0, x1, y1] 0..1 goreli, en az %6 genis ve yuksek
export function kesimGecerli(k) {
  if (!k || !AD.test(String(k.ad || ''))) return 'ad (a-z, 0-9, tire)';
  if (!/^\d{2}$/.test(String(k.foto || ''))) return 'foto kimliği (iki hane)';
  const b = k.kutu; if (!Array.isArray(b) || b.length !== 4 || b.some((v) => typeof v !== 'number' || v < 0 || v > 1)) return 'kutu [x0,y0,x1,y1] 0..1';
  if (b[2] - b[0] < 0.06 || b[3] - b[1] < 0.06 || b[2] <= b[0] || b[3] <= b[1]) return 'kutu çok küçük ya da ters';
  return null;
}

export function kesimKalite(r) {
  const neden = [];
  if (!r) return ['kesim raporu yok'];
  if (r.kenarTemas) neden.push('kesim kare kenarına değiyor (kesik tabak)');
  if (!(r.doluluk >= KESME_ESIK.doluluk)) neden.push(`doluluk ${r.doluluk} (en az ${KESME_ESIK.doluluk}: dış kenar tırtıklı)`);
  if (!(r.kenarKontrast >= KESME_ESIK.kenarKontrast)) neden.push(`kenar kontrastı ${r.kenarKontrast} (en az ${KESME_ESIK.kenarKontrast}: kesim belirsiz)`);
  return neden;
}

let _py;
export function pythonBul() {
  if (_py !== undefined) return _py;
  const adaylar = [process.env.PEAK_PYTHON, 'python3', 'python', ...(process.platform === 'win32' ? ['py'] : [])].filter(Boolean);
  for (const p of adaylar) {
    const r = spawnSync(p, ['-I', '-c', 'import cv2, numpy, PIL'], { encoding: 'utf8', timeout: 30000 });
    if (r.status === 0) { _py = p; return p; }
  }
  _py = null; return null;
}
export const pythonSifirla = () => { _py = undefined; };

// kesimler: [{ ad, foto, kutu, elips, ic, ton, haric, ... }]; kaynakDizin: <veri>/<slug> (R.photos dosyalari img/mNN.webp); R: cikarici.json
// -> { durum: 'ok'|'yetersiz'|'python-yok'|'hata'|'kesim-yok', gecen: [{ ad, rapor }], elenen: [{ ad, neden }], atlas: { buf, hucre, n, ad } | null }
export function kesimYap({ kesimler = [], R, kaynakDizin, calisma, log = () => {} }) {
  const liste = (kesimler || []).filter(Boolean);
  if (!liste.length) return { durum: 'kesim-yok', gecen: [], elenen: [], atlas: null };
  const py = pythonBul();
  if (!py) return { durum: 'python-yok', gecen: [], elenen: liste.map((k) => ({ ad: k.ad, neden: 'python/opencv yok' })), atlas: null };
  fs.mkdirSync(calisma, { recursive: true });
  const spec = []; const elenen = [];
  for (const k of liste) {
    const h = kesimGecerli(k); if (h) { elenen.push({ ad: String(k.ad), neden: `kesim tanımı geçersiz: ${h}` }); continue; }
    const p = (R.photos || []).find((x) => String(x.id) === String(k.foto)); const f = p && path.join(kaynakDizin, p.file);
    if (!f || !fs.existsSync(f)) { elenen.push({ ad: k.ad, neden: `fotoğraf ${k.foto} yok` }); continue; }
    const { foto, ...o } = k; spec.push({ ...o, src: f, max: o.max || 480 });
  }
  if (!spec.length) return { durum: 'yetersiz', gecen: [], elenen, atlas: null };
  const sp = path.join(calisma, 'spec.json'); fs.writeFileSync(sp, JSON.stringify(spec));
  const out = path.join(calisma, 'png'); fs.rmSync(out, { recursive: true, force: true });
  const r = spawnSync(py, ['-I', path.join(PY, 'kesme.py'), sp, out, path.join(calisma, 'onizleme.jpg')], { encoding: 'utf8', timeout: 240000 });
  if (r.status !== 0) return { durum: 'hata', gecen: [], elenen: [...elenen, { ad: '*', neden: `kesme.py durdu: ${String(r.stderr || '').split('\n').filter(Boolean).slice(-1)[0] || r.status}` }], atlas: null };
  let rapor = []; try { rapor = JSON.parse(fs.readFileSync(path.join(out, 'kesme-rapor.json'), 'utf8')); } catch { rapor = []; }
  const gecen = [];
  for (const s of spec) {
    const rp = rapor.find((x) => x.ad === s.ad); const sorun = kesimKalite(rp);
    if (sorun.length || !fs.existsSync(path.join(out, `${s.ad}.png`))) elenen.push({ ad: s.ad, neden: sorun.join('; ') || 'kesim boş' }); else gecen.push({ ad: s.ad, rapor: rp, file: path.join(out, `${s.ad}.png`) });
  }
  if (gecen.length < KESME_ESIK.enAz) return { durum: 'yetersiz', gecen, elenen, atlas: null, rapor };
  const ad = `iz-${crypto.createHash('sha1').update(JSON.stringify(gecen.map((g) => [g.ad, g.rapor && g.rapor.kesitPx]))).digest('hex').slice(0, 8)}.webp`;
  const ap = path.join(calisma, ad);
  const a = spawnSync(py, ['-I', path.join(PY, 'iz-atlas.py'), ap, String(KESME_ESIK.hucre), ...gecen.map((g) => g.file)], { encoding: 'utf8', timeout: 120000 });
  if (a.status !== 0 || !fs.existsSync(ap)) return { durum: 'hata', gecen, elenen: [...elenen, { ad: '*', neden: 'iz atlası kurulamadı' }], atlas: null };
  log(`   iz: ${gecen.length} temiz kesim${elenen.length ? `, ${elenen.length} elendi` : ''}`);
  return { durum: 'ok', gecen, elenen, atlas: { file: ap, ad, hucre: KESME_ESIK.hucre, n: gecen.length }, rapor };
}
