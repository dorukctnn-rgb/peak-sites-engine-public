// Kapi surumu: yalniz teknik nedenle gozden-gecir cikmis eski kayitlar yeniden uretilir; veri sorunlari, elendi ve hazir bitmis sayilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KAPI_SURUM, tekrarGerek, kapiBitti } from '../../uyarla/lib/surum.mjs';
import { adaylar } from '../dongu.mjs';
import { gecici } from './gecici.mjs';
import { uretimLead } from '../uretim.mjs';

test('tekrarGerek: eski surum + teknik neden = tekrar; veri sorunu, elendi, hazir, guncel surum = bitti', () => {
  const eski = (status, reasons, surum) => ({ status, reasons, ...(surum ? { surum } : {}) });
  assert.equal(tekrarGerek(eski('gozden-gecir', ['masaüstü: ilk ekranda yazı kontrastı düşük (.eyebrow 1.75 (gerek 4.5))'])), true);
  assert.equal(tekrarGerek(eski('gozden-gecir', ['telefon: taşma (a.btn "See the services" 255..434)'])), true);
  assert.equal(tekrarGerek(eski('gozden-gecir', ["fotoğraf sayısı 3'ten az (1)", 'masaüstü: taşma (x)'])), true, 'bir teknik neden yeter');
  assert.equal(tekrarGerek(eski('gozden-gecir', ["fotoğraf sayısı 3'ten az (1)"])), false);
  assert.equal(tekrarGerek(eski('gozden-gecir', ['oda bilgisi ve rezervasyon bağlantısı yok'])), false);
  assert.equal(tekrarGerek(eski('gozden-gecir', ['hizmet listesi ve randevu bağlantısı yok'])), false);
  assert.equal(tekrarGerek(eski('elendi', ['telefon: taşma (x)'])), false);
  assert.equal(tekrarGerek(eski('hazir', [])), false);
  assert.equal(tekrarGerek(eski('gozden-gecir', ['telefon: taşma (x)'], KAPI_SURUM)), false, 'guncel surumle zaten kosmus');
  assert.equal(tekrarGerek(null), false);
});

test('kapiBitti ve adaylar: dosya yok = bitmedi; teknik gozden-gecir yeniden aday olur', () => {
  const depo = gecici('surum-');
  try {
    const veri = path.join(depo, 'veri'); fs.mkdirSync(path.join(depo, 'lead'), { recursive: true });
    const lead = (i) => ({ id: `IE-n${2000 + i}`, osm: `node/${2000 + i}`, ulke: 'IE', sektor: 'guzellik', name: `Salon ${i}`, website: `http://s${i}.ie/`, tur: 'hair salon', durum: 'aday', email: `a@s${i}.ie`, puan: 5 });
    fs.writeFileSync(path.join(depo, 'lead', 'IE-guzellik.tarandi.jsonl'), [1, 2, 3, 4].map((i) => JSON.stringify(lead(i))).join('\n'));
    const yaz = (i, k) => { const d = path.join(veri, uretimLead(lead(i)).slug); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'kapi.json'), JSON.stringify(k)); return path.join(d, 'kapi.json'); };
    assert.equal(kapiBitti(path.join(veri, 'yok', 'kapi.json')), false);
    yaz(1, { status: 'hazir', reasons: [] });
    yaz(2, { status: 'gozden-gecir', reasons: ['telefon: taşma (x)'] });
    yaz(3, { status: 'gozden-gecir', reasons: ["fotoğraf sayısı 3'ten az (1)"] });
    const f4 = yaz(4, { status: 'gozden-gecir', reasons: ['telefon: taşma (x)'], surum: KAPI_SURUM });
    assert.equal(kapiBitti(f4), true);
    const l = adaylar({ depo, plan: { sira: [['IE', 'guzellik']] }, veri, uretimLead });
    assert.deepEqual(l.map((x) => x.id), ['IE-n2002'], 'yalniz teknik nedenli eski kayit yeniden aday');
  } finally { fs.rmSync(depo, { recursive: true, force: true }); }
});
