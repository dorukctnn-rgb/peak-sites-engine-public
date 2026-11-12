// Imlec izi atlasi (pastane, 12 Kas 2026): izde yalniz isletmenin KENDI urunleri; kaynak sirasi elle > kesmeler > kendi karelerinden yuvarlak kesit > hic.
// Atlas olculeri (satir = urun, sutun = donus karesi) ve kart kirpma orani.  Ag yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sharp } from '../lib/gorsel.mjs';
import { izPlan, izAtlas, yuvarlakKesit, donusKareleri, IZ_HUCRE, IZ_KARE } from '../lib/iz-atlas.mjs';
import { kartKirp, ORAN } from '../lib/kart-foto.mjs';

const R = { kesme: [{ id: 'k01', ad: 'croissant', file: 'kesme/k01.png', kaynakFoto: '03' }, { id: 'k02', ad: 'tart', file: 'kesme/k02.png', kaynakFoto: '11' }, { id: 'k03', ad: 'quiche', file: 'kesme/k03.png', kaynakFoto: '12' }] };
const kare = (w, h, renk) => sharp({ create: { width: w, height: h, channels: 4, background: renk } }).png().toBuffer();

test('izPlan: elle secim yalniz var olan kesmeleri alir, sira korunur', () => {
  const p = izPlan({ iz: { zincir: ['k02', 'k01', 'yok'], parcalar: ['k01', 'k02', 'k03'] } }, R, null);
  assert.equal(p.yontem, 'elle');
  assert.deepEqual(p.zincir, ['k02', 'k01']);
  assert.deepEqual(p.parcalar, ['k01', 'k02', 'k03']);
  assert.deepEqual(p.liste.map((x) => x.id), ['k02', 'k01', 'k03']);
  assert.match(p.liste[0].kaynak, /kare 11/);
});

test('izPlan: elle secim karsiliksizsa (bulutta kesme yok) kendi karelerinden yuvarlak kesite gecer', () => {
  const uyum = { uygun: [{ id: '05', kaynak: 'kendi', konu: 'yemek' }, { id: '07', kaynak: 'kendi', konu: 'yemek' }] };
  const p = izPlan({ iz: { zincir: ['k01', 'k02'] } }, {}, uyum);
  assert.equal(p.yontem, 'yuvarlak'); assert.deepEqual(p.liste.map((x) => x.foto), ['05', '07']);
});

test('izPlan: elle secim yoksa butun kesmeler; kesme de yoksa yalniz KENDI yemek kareleri (stok ve mekan yok)', () => {
  const k = izPlan({}, R, null); assert.equal(k.yontem, 'kesme'); assert.equal(k.liste.length, 3);
  const uyum = { uygun: [{ id: '01', kaynak: 'kendi', konu: 'yemek' }, { id: '02', kaynak: 'stok', konu: 'yemek' }, { id: '03', kaynak: 'kendi', konu: 'mekan' }, { id: '04', kaynak: 'kendi', konu: 'yemek' }] };
  const y = izPlan({}, {}, uyum);
  assert.equal(y.yontem, 'yuvarlak');
  assert.deepEqual(y.liste.map((x) => x.foto), ['01', '04']);
  assert.ok(y.liste.every((x) => x.yuvarlak));
  const bos = izPlan({}, {}, null);
  assert.equal(bos.yontem, 'yok'); assert.equal(bos.liste.length, 0);
});

test('izAtlas: satir = urun, sutun = donus karesi; saydam zemin', async () => {
  const at = await izAtlas([{ ad: 'a', buf: await kare(300, 200, '#c08040') }, { ad: 'b', buf: await kare(120, 240, '#e0a0b0') }]);
  assert.equal(at.cell, IZ_HUCRE); assert.equal(at.frames, IZ_KARE);
  assert.deepEqual([at.w, at.h], [IZ_HUCRE * IZ_KARE, IZ_HUCRE * 2]);
  const md = await sharp(at.webp).metadata();
  assert.equal(md.format, 'webp'); assert.deepEqual([md.width, md.height], [at.w, at.h]); assert.ok(md.hasAlpha);
  // hucre koseleri saydam (urun hucrenin ortasinda, en cok %88)
  const { data, info } = await sharp(at.webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, 'sol ust kose saydam');
  const orta = ((IZ_HUCRE / 2) * info.width + IZ_HUCRE / 2) * 4; assert.ok(data[orta + 3] > 200, 'ilk karenin ortasi dolu');
});

test('donusKareleri: kenar karesi bile gorunur (en az %10 genislik), arka yuz aynali', async () => {
  const urun = { buf: await kare(100, 80, '#806040'), w: 100, h: 80 };
  const k = await donusKareleri(urun, IZ_HUCRE, IZ_KARE);
  assert.equal(k.length, IZ_KARE);
  for (const x of k) { const md = await sharp(x.input).metadata(); assert.ok(md.width >= 10); assert.ok(x.left >= 0 && x.top >= 0); }
});

test('yuvarlakKesit: kare cikti, koseler saydam, orta dolu', async () => {
  const b = await yuvarlakKesit(await kare(900, 600, '#d0a060'));
  const { data, info } = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, info.height); assert.equal(info.channels, 4);
  assert.equal(data[3], 0);
  const o = ((info.height >> 1) * info.width + (info.width >> 1)) * 4; assert.ok(data[o + 3] > 240);
});

test('kartKirp: sablon orani verirse (pastane 4:5 dik) o oranda, yoksa ORAN; buyutme yok', () => {
  const dik = kartKirp({ width: 1200, height: 1600 }, { oran: 4 / 5 });
  assert.equal(dik.width, 1200); assert.equal(dik.height, 1500);
  const varsayilan = kartKirp({ width: 1200, height: 1600 }, {});
  assert.equal(varsayilan.width, 1200); assert.equal(varsayilan.height, Math.round(1200 / ORAN));
  const dar = kartKirp({ width: 900, height: 1600 }, { oran: 4 / 5, odak: { x: 0.5, y: 0.9 } });
  assert.ok(dar.top + dar.height <= 1600 && dar.width <= 900);
});
