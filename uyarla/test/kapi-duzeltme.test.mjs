// Kapi otomatik duzeltmeleri (tarayicisiz): ust etiket (eyebrow) rengi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eyebrowNotr } from '../kapi.mjs';
import { gecici } from '../../hat/test/gecici.mjs';

test('eyebrowNotr: etiket yazi rengine cekilir, ikinci cagri bir sey eklemez', () => {
  const dir = gecici('kapi-');
  try {
    const f = path.join(dir, 'theme.css');
    fs.writeFileSync(f, ':root{--hero-ink:#fff;--hero-accent:#8b0000;}\n');
    assert.equal(eyebrowNotr(f), true);
    const css = fs.readFileSync(f, 'utf8');
    assert.match(css, /\.hero \.eyebrow\{color:var\(--hero-ink\)\}/);
    assert.equal(eyebrowNotr(f), false);
    assert.equal(fs.readFileSync(f, 'utf8'), css);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

import { golgeArtir } from '../kapi.mjs';

test('golgeArtir: alt gradyan artar ve sayfaya ozel orta bant eklenir, her cagri bandi bir basamak koyulastirir (en cok .62)', () => {
  const dir = gecici('kapi-');
  try {
    const f = path.join(dir, 'theme.css');
    fs.writeFileSync(f, ':root{--shade-m:0.720;--shade-a:0.940;}\n');
    golgeArtir(f);
    let css = fs.readFileSync(f, 'utf8');
    assert.match(css, /--shade-m:0\.810;/);
    assert.match(css, /bant-u:0\.26\*\/\.hero-shade::after/);
    golgeArtir(f);
    css = fs.readFileSync(f, 'utf8');
    assert.match(css, /bant-u:0\.38/);
    assert.equal((css.match(/bant-u:/g) || []).length, 1, 'tek bant kurali kalir');
    for (let i = 0; i < 6; i++) golgeArtir(f);
    css = fs.readFileSync(f, 'utf8');
    assert.match(css, /bant-u:0\.62/);
    assert.equal((css.match(/bant-u:/g) || []).length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
