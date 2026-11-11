// hat/sizinti-kontrol.mjs testleri: sir kalibi, yasak yol, izinsiz e-posta, yasak terim.  Sahte sir degerleri calisma aninda birlestirilir (depoda sir benzeri duz metin kalmasin).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(HERE, '..', 'sizinti-kontrol.mjs');

function kos(dosyalar, env = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sizinti-test-'));
  try {
    fs.mkdirSync(path.join(d, 'hat'), { recursive: true });
    fs.writeFileSync(path.join(d, 'hat', 'sizinti-izin.json'), JSON.stringify({ eposta_alanlari: ['example.com'], eposta_tam: ['info' + '@peakappsstudio.com'] }));
    for (const [f, t] of Object.entries(dosyalar)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), t); }
    const r = spawnSync(process.execPath, [SCRIPT, '--kok', d], { encoding: 'utf8', env: { ...process.env, SIZINTI_YASAK_TERIMLER: '', ...env } });
    return { kod: r.status, cikti: r.stdout + r.stderr };
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

test('sizinti: temiz kod gecer, izinli e-postalar sorun degil', () => {
  const r = kos({ 'a.mjs': "export const x = 1; // yazi: info" + '@peakappsstudio.com ve kim' + '@example.com\n' });
  assert.equal(r.kod, 0, r.cikti);
});

test('sizinti: sir kalibi yakalanir ve DEGER yazdirilmaz', () => {
  const sahte = 'ghp' + '_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8';
  const r = kos({ 'b.mjs': `const t = '${sahte}';\n` });
  assert.equal(r.kod, 1);
  assert.match(r.cikti, /github-token b\.mjs:1/);
  assert.ok(!r.cikti.includes(sahte), 'deger gunluge basilmaz');
});

test('sizinti: izinsiz e-posta, yasak yol ve jsonl yakalanir', () => {
  const r = kos({ 'c.mjs': "const e = 'kim" + "@baska-isletme.ie';\n", 'veri/x.json': '{}', 'lead/liste.jsonl': '{}\n' });
  assert.equal(r.kod, 1);
  assert.match(r.cikti, /izinsiz-eposta c\.mjs:1/);
  assert.match(r.cikti, /yasak-klasor veri\/x\.json/);
  assert.match(r.cikti, /yasak-dosya-turu\(jsonl\) lead\/liste\.jsonl/);
});

test('sizinti: ortamdan verilen yasak terim yakalanir (buyuk/kucuk harf duyarsiz)', () => {
  const r = kos({ 'd.md': 'burada GizliTerim geciyor\n' }, { SIZINTI_YASAK_TERIMLER: 'gizliterim' });
  assert.equal(r.kod, 1);
  assert.match(r.cikti, /yasak-terim d\.md:1/);
  assert.ok(!r.cikti.toLowerCase().includes('gizliterim'), 'terim gunluge basilmaz');
});

test('sizinti: url icinde parola yakalanir, ortam degiskeni referansi yakalanmaz', () => {
  const adres = 'https://kullanici:' + 'gizlisifre123' + '@ornek-sunucu.com/x';
  const r1 = kos({ 'e.sh': `git clone ${adres}\n` });
  assert.equal(r1.kod, 1); assert.match(r1.cikti, /url-icinde-parola e\.sh:1/);
  const r2 = kos({ 'f.yml': 'run: git clone https://x-access-token:${' + 'HAT_PAT}@github.com/x/y.git\n' });
  assert.equal(r2.kod, 0, r2.cikti);
});

test('sizinti: duzenli ifade terimleri (re: duyarli, rei: duyarsiz), satir satir liste ve yorum satiri', () => {
  const terim = '# yorum\nre:(?<![\\p{L}])ZQ(?![\\p{L}])\nrei:gizli[- ]?kelime\n';
  const r1 = kos({ 'g.md': 'temiz satir\nburada ZQ var\nzq kucuk harfle sayilmaz\nGizli-Kelime burada\n' }, { SIZINTI_YASAK_TERIMLER: terim });
  assert.equal(r1.kod, 1);
  assert.match(r1.cikti, /yasak-terim g\.md:2/); assert.match(r1.cikti, /yasak-terim g\.md:4/); assert.ok(!/g\.md:3/.test(r1.cikti), 'duyarli kalip kucuk harfi saymaz');
  assert.ok(!r1.cikti.includes('ZQ') && !r1.cikti.toLowerCase().includes('kelime'), 'terim gunluge basilmaz');
  const r2 = kos({ 'h.md': 'ZQX bitisik sayilmaz\n' }, { SIZINTI_YASAK_TERIMLER: terim });
  assert.equal(r2.kod, 0, r2.cikti);
});

test('sizinti: ozel varlik yollari depoya girmez', () => {
  const r = kos({ 'mail/sablon.mjs': 'x\n', 'uyarla/sablon-pizza/site.css': 'x\n', 'uyarla/data/v5-elle.json': '{}', 'inceleme/ornek/v5.json': '{}', 'hat/ozel-sozluk.json': '{}', 'uyarla/test/ozel-v5.test.mjs': 'x\n', 'uyarla/sablon-sec.mjs': 'x\n' });
  assert.equal(r.kod, 1);
  assert.equal((r.cikti.match(/ozel-varlik /g) || []).length, 6, r.cikti);
  assert.ok(!/sablon-sec/.test(r.cikti), 'sablon secici kod acik kalir');
});
