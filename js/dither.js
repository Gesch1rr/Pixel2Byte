const BAYER4 = [
  [  0, 136,  34, 170],
  [204,  68, 238, 102],
  [ 51, 187,  17, 153],
  [255, 119, 221,  85],
];

function floydSteinberg(imageData, W, H, threshold, invert) {
  const gray = new Float32Array(W * H);
  const src  = imageData.data;
  for (let i = 0; i < W * H; i++) {
    gray[i] = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
  }

  const pixels = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx    = y * W + x;
      const oldVal = gray[idx];
      const newVal = oldVal < threshold ? 0 : 255;
      const err    = oldVal - newVal;

      let px = newVal === 0 ? 1 : 0;
      if (invert) px = 1 - px;
      pixels.push(px);

      if (x + 1 < W)
        gray[idx + 1]     = clamp(gray[idx + 1]     + err * 7 / 16);
      if (y + 1 < H && x - 1 >= 0)
        gray[idx + W - 1] = clamp(gray[idx + W - 1] + err * 3 / 16);
      if (y + 1 < H)
        gray[idx + W]     = clamp(gray[idx + W]     + err * 5 / 16);
      if (y + 1 < H && x + 1 < W)
        gray[idx + W + 1] = clamp(gray[idx + W + 1] + err * 1 / 16);
    }
  }

  return pixels;
}

function bayerDither(imageData, W, H, threshold, invert) {
  const src    = imageData.data;
  const pixels = [];
  const bias = threshold - 128;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i   = (y * W + x) * 4;
      const g   = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      const bv  = BAYER4[y & 3][x & 3];
      let   px  = (g + bias) < bv ? 1 : 0;
      if (invert) px = 1 - px;
      pixels.push(px);
    }
  }

  return pixels;
}

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

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
