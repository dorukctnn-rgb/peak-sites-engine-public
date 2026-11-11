// Testlerin gecici klasorleri: yalniz KENDI olusturdugu klasorler, test sureci bitince silinir (Temp'te birikmesin; C: diski dar).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dirs = [];
process.on('exit', () => { for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* yoksay */ } } });
export function gecici(prefix = 'peak-test-') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); dirs.push(d); return d;
}
