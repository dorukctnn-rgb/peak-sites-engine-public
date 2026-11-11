// Fotograftan KURAL TABANLI derinlik haritasi (2.5D paralaks icin).  Model yok: uc ipucu harmanlanir.
//   - zemin duzlemi: karenin alti yakindir, ustu uzaktir (yemek ve mekan fotograflarinin cogu boyle cekilir)
//   - netlik: keskin bolge (odaktaki konu) one gelir, bulanik arka plan geriye gider
//   - doygunluk: canli renkli konu hafifce one gelir
// Cikti: 256 px genis gri tonlu WebP (beyaz = yakin).  Hata verirse cagiran duz gri harita kullanir.
import { sharp } from './gorsel.mjs';

export async function derinlik(buf, { w = 256 } = {}) {
  const base = sharp(buf, { limitInputPixels: 80e6 }).rotate().resize({ width: w }).removeAlpha();
  const { data: rgb, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  const W = info.width; const H = info.height; const n = W * H; const ch = info.channels;
  const lap = await base.clone().greyscale().convolve({ width: 3, height: 3, kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0], scale: 1, offset: 128 }).raw().toBuffer();
  const sharpness = new Float32Array(n); const sat = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sharpness[i] = Math.abs(lap[i] - 128);
    const r = rgb[i * ch]; const g = rgb[i * ch + 1]; const b = rgb[i * ch + 2]; const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
    sat[i] = mx ? (mx - mn) / mx : 0;
  }
  const blur = async (arr, sigma) => {
    const srt = Float32Array.from(arr).sort(); const hi = srt[Math.floor(n * 0.98)] || 1;
    const u8 = Buffer.alloc(n); for (let i = 0; i < n; i++) u8[i] = Math.max(0, Math.min(255, Math.round((arr[i] / hi) * 255)));
    return sharp(u8, { raw: { width: W, height: H, channels: 1 } }).blur(sigma).raw().toBuffer();
  };
  const F = await blur(sharpness, Math.max(3, W / 28)); const S = await blur(sat, Math.max(3, W / 36));
  const d = new Float32Array(n); let lo = 1e9; let hi = -1e9;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // odaktaki konu (keskin + canli) zemin duzlemine gore daha one gelsin: paralaksta tabak/bardak oynar, bulanik fon geride kalir
      const i = y * W + x; const v = 0.42 * (y / (H - 1)) + 0.44 * (F[i] / 255) + 0.14 * (S[i] / 255);
      d[i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
    }
  }
  const out = Buffer.alloc(n); for (let i = 0; i < n; i++) out[i] = Math.round(((d[i] - lo) / Math.max(1e-6, hi - lo)) * 255);
  return sharp(out, { raw: { width: W, height: H, channels: 1 } }).blur(Math.max(2, W / 64)).webp({ quality: 82 }).toBuffer();
}
