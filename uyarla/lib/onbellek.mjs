// DISK ONBELLEGI (yalniz OLCUM ve gelistirme araci; uretim hatti kullanmaz).  Ayni adres iki kez ag acmasin: cikaricinin kuralini degistirip yeniden olcerken
// siteler yeniden yorulmaz ve politika (saniyede en cok 1 istek, robots.txt) yalniz ILK getirmede devreye girer.
//   OnbellekPolite  : Polite ile ayni arayuz; GET/HEAD yanitlari <dir>/ag/<sha1>.{json,bin} olarak saklanir (robots.txt dahil).
//   ziyaretOnbellek : tarayici ziyareti (sayfa okuma + tarayicinin indirdigi gorseller) onbellekli surum.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Polite } from '../v2lib/polite.mjs';
import { ziyaret } from './ziyaret.mjs';

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

export class OnbellekPolite extends Polite {
  constructor(dir, opts = {}) { super(opts); this.dir = path.join(dir, 'ag'); fs.mkdirSync(this.dir, { recursive: true }); this.isabet = 0; this.ucret = 0; }
  async raw(url, opts = {}) {
    const k = sha(`GET ${url}`); const meta = path.join(this.dir, `${k}.json`); const bin = path.join(this.dir, `${k}.bin`);
    const m = J(meta);
    if (m) { this.isabet++; const r = { ...m }; if (m.ok) { const buf = fs.readFileSync(bin); r.buf = buf; r.text = opts.binary ? undefined : buf.toString('utf8'); } return r; }
    this.ucret++;
    const r = await super.raw(url, opts);
    // gecici ag hatalari (zaman asimi, baglanti) saklanmaz; kesin yanitlar (2xx, 4xx, too-big) saklanir
    const kesin = r.ok || (r.status && r.status < 500) || r.error === 'too-big';
    if (kesin) { const { buf, text, ...rest } = r; fs.writeFileSync(meta, JSON.stringify(rest)); if (r.ok) fs.writeFileSync(bin, r.buf); }
    return r;
  }
  async head(url, opts = {}) {
    const k = sha(`HEAD2 ${url}`); const meta = path.join(this.dir, `${k}.json`); const m = J(meta);
    if (m) { this.isabet++; return m; }
    this.ucret++;
    const r = await super.head(url, opts);
    if (r && r.status) fs.writeFileSync(meta, JSON.stringify(r)); // yalniz gercek HTTP yaniti saklanir
    return r;
  }
}

// -> ziyaret() ile ayni sonuc.  imgBodies tarayicinin indirdigi gorseller (dosya olarak saklanir).
export async function ziyaretOnbellek(dir, browser, url, opts = {}) {
  const k = sha(`ZIYARET ${url} ${opts.mobile ? 'm' : 'd'}`); const base = path.join(dir, 'ziyaret'); fs.mkdirSync(path.join(base, k), { recursive: true });
  const jf = path.join(base, `${k}.json`);
  const c = J(jf);
  if (c) {
    const imgBodies = new Map();
    for (const [u, f, type] of c.__img || []) { try { imgBodies.set(u, { buf: fs.readFileSync(path.join(base, k, f)), type }); } catch { /* yok */ } }
    const { __img, ...rest } = c; return { ...rest, imgBodies, onbellekten: true };
  }
  const o = await ziyaret(browser, url, opts);
  if (!o.ok) return o; // basarisiz ziyaret (zaman asimi, gecici ag hatasi) saklanmaz
  const { imgBodies, ...rest } = o; const list = [];
  if (imgBodies) { let i = 0; for (const [u, b] of imgBodies) { const f = `${i++}.bin`; fs.writeFileSync(path.join(base, k, f), b.buf); list.push([u, f, b.type]); } }
  fs.writeFileSync(jf, JSON.stringify({ ...rest, __img: list }));
  return o;
}
