/* ══════════════════════════════════════════════════════════════
   dither.js  —  Pixel2Byte için dithering modülü
   Kullanım: <script src="js/dither.js"></script> olarak ekle,
             convert.js'den önce yüklenmelidir.
══════════════════════════════════════════════════════════════ */

/* ── Bayer 4×4 threshold matrisi (normalize edilmiş, 0-255) ── */
const BAYER4 = [
  [  0, 136,  34, 170],
  [204,  68, 238, 102],
  [ 51, 187,  17, 153],
  [255, 119, 221,  85],
];

/* ──────────────────────────────────────────────────────────────
   floydSteinberg(imageData, W, H, threshold, invert)
   → pixel[]  (1 = siyah nokta, 0 = beyaz)

   Nasıl çalışır:
     Her piksel için en yakın 1-bit renge yuvarlanır (siyah/beyaz).
     Oluşan hata (oldVal − newVal) komşu piksellere dağıtılır:
       sağ         : +7/16
       sol-alt     : +3/16
       alt         : +5/16
       sağ-alt     : +1/16
     Toplam 16/16 → hata kaybolmaz, görsel parlaklık korunur.
────────────────────────────────────────────────────────────── */
function floydSteinberg(imageData, W, H, threshold, invert) {
  /* Float32 kopyası: orijinal imageData'ya dokunmuyoruz */
  const gray = new Float32Array(W * H);
  const src  = imageData.data;
  for (let i = 0; i < W * H; i++) {
    /* Ağırlıklı luma dönüşümü (BT.601) */
    gray[i] = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
  }

  const pixels = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx    = y * W + x;
      const oldVal = gray[idx];
      const newVal = oldVal < threshold ? 0 : 255;
      const err    = oldVal - newVal;          /* yuvarlama hatası */

      let px = newVal === 0 ? 1 : 0;          /* 1 = siyah piksel */
      if (invert) px = 1 - px;
      pixels.push(px);

      /* ── Hata yayılımı ── */
      /* Sağ */
      if (x + 1 < W)
        gray[idx + 1]     = clamp(gray[idx + 1]     + err * 7 / 16);
      /* Sol-alt */
      if (y + 1 < H && x - 1 >= 0)
        gray[idx + W - 1] = clamp(gray[idx + W - 1] + err * 3 / 16);
      /* Alt */
      if (y + 1 < H)
        gray[idx + W]     = clamp(gray[idx + W]     + err * 5 / 16);
      /* Sağ-alt */
      if (y + 1 < H && x + 1 < W)
        gray[idx + W + 1] = clamp(gray[idx + W + 1] + err * 1 / 16);
    }
  }

  return pixels;
}

/* ──────────────────────────────────────────────────────────────
   bayerDither(imageData, W, H, threshold, invert)
   → pixel[]

   Nasıl çalışır:
     Her pikselin gri değeri, konumuna göre sabit bir Bayer
     matris değeriyle karşılaştırılır.  Hata yayılımı yoktur;
     her piksel bağımsız hesaplanır → çok hızlı, tekrar eden
     pattern görünümü verir.  Fotoğraflar yerine ikon/sprite
     tarzı görseller için genellikle daha temiz sonuç verir.
────────────────────────────────────────────────────────────── */
function bayerDither(imageData, W, H, threshold, invert) {
  const src    = imageData.data;
  const pixels = [];
  /* Threshold 128 varsayılanından bağımsız olarak Bayer kendi
     eşiğini matrix'ten alır; dışarıdan gelen threshold sadece
     genel parlaklık kaymasını ayarlar (bias).                */
  const bias = threshold - 128;          /* -128 … +127 */

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i   = (y * W + x) * 4;
      const g   = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      const bv  = BAYER4[y & 3][x & 3];       /* 0-255 matrix değeri */
      let   px  = (g + bias) < bv ? 1 : 0;    /* 1 = siyah piksel */
      if (invert) px = 1 - px;
      pixels.push(px);
    }
  }

  return pixels;
}

/* ──────────────────────────────────────────────────────────────
   threshold (sade, mevcut yöntem — referans için korundu)
────────────────────────────────────────────────────────────── */
function thresholdDither(imageData, W, H, threshold, invert) {
  const src    = imageData.data;
  const pixels = [];
  for (let i = 0; i < W * H; i++) {
    const g  = 0.299 * src[i*4] + 0.587 * src[i*4+1] + 0.114 * src[i*4+2];
    let   px = g < threshold ? 1 : 0;
    if (invert) px = 1 - px;
    pixels.push(px);
  }
  return pixels;
}

/* ── yardımcı ── */
function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }