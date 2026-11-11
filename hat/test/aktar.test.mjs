// Yerel uretimin bulut verisine aktarimi: bulutta olana dokunulmaz, kapisizlar atlanir, hazirlar kutuya girer, ekran goruntuleri tasinmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aktar } from '../yerel-aktar.mjs';
import { kutuOku } from '../kutu.mjs';

import { gecici } from './gecici.mjs';
const tmp = () => gecici('aktar-');
const yaz = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof s === 'string' ? s : JSON.stringify(s)); };
function isletme(kok, slug, status, { sheet = false } = {}) {
  yaz(path.join(kok, slug, 'cikarici.json'), { lead: { id: slug } });
  if (status) yaz(path.join(kok, slug, 'kapi.json'), { status });
  yaz(path.join(kok, slug, 'uret.json'), {}); yaz(path.join(kok, slug, 'img', 'm01.webp'), 'x');
  yaz(path.join(kok, slug, 'sonra-1440.jpg'), 'x'); yaz(path.join(kok, slug, 'once-390.jpg'), 'x');
  if (sheet) { yaz(path.join(kok, slug, 'inceleme', 'sheet.jpg'), 'x'); yaz(path.join(kok, slug, 'inceleme', 'bilgi.json'), { slug }); }
}

test('aktar: kuru calisma yazmaz; --yaz kopyalar, kutu-gecmise ekler, hazirlari kutuya koyar; bulutta olan ve kapisiz atlanir', () => {
  const kaynak = tmp(); const depo = tmp(); const kutu = tmp();
  isletme(kaynak, 'a-ie1111', 'hazir', { sheet: true }); isletme(kaynak, 'b-ie2222', 'gozden-gecir'); isletme(kaynak, 'c-ie3333', null); isletme(kaynak, 'd-ie4444', 'hazir', { sheet: true });
  isletme(path.join(depo, 'veri'), 'd-ie4444', 'hazir', { sheet: true }); // bulutta zaten var
  yaz(path.join(depo, 'durum', 'kutu-gecmis.json'), ['d-ie4444']);
  const kuru = aktar({ kaynak, depo, kutu });
  assert.deepEqual(kuru.kopyalandi.sort(), ['a-ie1111', 'b-ie2222']); assert.deepEqual(kuru.vardi, ['d-ie4444']); assert.deepEqual(kuru.atlandi, ['c-ie3333']);
  assert.equal(fs.existsSync(path.join(depo, 'veri', 'a-ie1111')), false, 'kuru calisma yazmaz');
  const r = aktar({ kaynak, depo, kutu, parti: 'yerel-test', yaz: true });
  assert.equal(r.kutuya, 1);
  assert.ok(fs.existsSync(path.join(depo, 'veri', 'a-ie1111', 'img', 'm01.webp')));
  assert.equal(fs.existsSync(path.join(depo, 'veri', 'a-ie1111', 'sonra-1440.jpg')), false, 'ekran goruntuleri tasinmaz');
  assert.equal(fs.existsSync(path.join(depo, 'veri', 'a-ie1111', 'once-390.jpg')), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(depo, 'durum', 'kutu-gecmis.json'), 'utf8')), ['a-ie1111', 'b-ie2222', 'd-ie4444']);
  assert.deepEqual(kutuOku(kutu).map((x) => [x.slug, x.parti]), [['a-ie1111', 'yerel-test']]);
  assert.ok(fs.existsSync(path.join(kutu, 'a-ie1111', 'sheet.jpg')));
  const ikinci = aktar({ kaynak, depo, kutu, yaz: true }); assert.deepEqual(ikinci.kopyalandi, []); assert.equal(ikinci.kutuya, 0, 'ikinci calistirma bir sey eklemez');
});

test('liste-birlestir: yeni sonuc eskisinin yerine gecer, eskiler kalir', async () => {
  const { birlestir } = await import('../liste-birlestir.mjs');
  const r = birlestir([{ slug: 'a', durum: 'gozden-gecir' }, { slug: 'b', durum: 'hazir' }], [{ slug: 'a', durum: 'hazir' }, { slug: 'c', durum: 'elendi' }]);
  assert.deepEqual(r.map((x) => `${x.slug}:${x.durum}`), ['a:hazir', 'b:hazir', 'c:elendi']);
  assert.deepEqual(birlestir(null, [{ slug: 'x', durum: 'hazir' }]).length, 1);
});
