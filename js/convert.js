let srcImage = null;

/* ── Son dönüşüm sonucu — .h indirme için saklanır ── */
let _lastBytes   = null;
let _lastVarName = '';
let _lastW = 0, _lastH = 0;

/* ── File upload ── */
const dropEl = document.getElementById('drop');

document.getElementById('fileInput').addEventListener('change', e => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});

dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('over'); });
dropEl.addEventListener('dragleave', () => dropEl.classList.remove('over'));
dropEl.addEventListener('drop', e => {
  e.preventDefault();
  dropEl.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadFile(f);
});

function loadFile(f) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => { srcImage = img; showOrig(img); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(f);
}

function showOrig(img) {
  const box = document.getElementById('origBox');
  box.innerHTML = '';

  const c = document.createElement('canvas');
  let w = img.width, h = img.height;
  const mw = 360, mh = 200;
  if (w > mw) { h = h * mw / w; w = mw; }
  if (h > mh) { w = w * mh / h; h = mh; }
  c.width  = Math.round(w);
  c.height = Math.round(h);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  c.className = 'pv-appear';
  box.appendChild(c);

  box.classList.remove('flash');
  void box.offsetWidth;
  box.classList.add('flash');

  document.getElementById('origDim').textContent = img.width + '×' + img.height + 'px';
}

/* ── Convert ── */
function convertImage() {
  const W     = +document.getElementById('outW').value || 128;
  const H     = +document.getElementById('outH').value || 64;
  const thr   = +document.getElementById('threshold').value;
  const inv   =  document.getElementById('invert').checked;
  const fH    =  document.getElementById('flipH').checked;
  const rot   =  document.getElementById('rotate').checked;
  const dMode =  document.getElementById('ditherMode').value;
  // ✅ FIX: colorMode artık okunuyor
  const cMode =  document.getElementById('colorMode').value;

  const btn = document.querySelector('.btn-main');
  btn.classList.add('loading');

  function doConvert(src) {
    setTimeout(() => {
      const off = document.createElement('canvas');
      off.width  = W;
      off.height = H;
      const ctx  = off.getContext('2d');

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      if (rot) ctx.rotate(Math.PI / 2);
      if (fH)  ctx.scale(-1, 1);

      // ✅ FIX: 90° döndürme sonrası W ve H yer değiştirmeli
      // Önceki kod her zaman (W,H) kullanıyordu → W≠H görüntüler bozuluyordu
      if (rot) {
        ctx.drawImage(src, -H / 2, -W / 2, H, W);
      } else {
        ctx.drawImage(src, -W / 2, -H / 2, W, H);
      }
      ctx.restore();

      const rawId = ctx.getImageData(0, 0, W, H);
      let pixels;

      // ✅ FIX: colorMode'a göre farklı pixel üretimi
      if (cMode === 'gray') {
        pixels = toGray4bit(rawId, W, H, inv);
      } else if (dMode === 'floyd') {
        pixels = floydSteinberg(rawId, W, H, thr, inv);
      } else if (dMode === 'bayer') {
        pixels = bayerDither(rawId, W, H, thr, inv);
      } else {
        pixels = thresholdDither(rawId, W, H, thr, inv);
      }

      /* ── Önizleme canvas'ını güncelle ── */
      const previewId = ctx.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        let v;
        if (cMode === 'gray') {
          v = Math.round(pixels[i] / 15 * 255); // 0-15 → 0-255
        } else {
          v = pixels[i] ? 0 : 255;
        }
        previewId.data[i * 4]     = v;
        previewId.data[i * 4 + 1] = v;
        previewId.data[i * 4 + 2] = v;
        previewId.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(previewId, 0, 0);

      /* ── Converted preview panel ── */
      const cBox = document.getElementById('convBox');
      cBox.innerHTML = '';
      const pc = document.createElement('canvas');
      pc.width  = W;
      pc.height = H;
      pc.style.maxWidth       = '100%';
      pc.style.maxHeight      = '100%';
      pc.style.imageRendering = 'pixelated';
      pc.className = 'pv-appear';
      pc.getContext('2d').drawImage(off, 0, 0);
      cBox.appendChild(pc);

      cBox.classList.remove('flash');
      void cBox.offsetWidth;
      cBox.classList.add('flash');

      document.getElementById('convDim').textContent = W + '×' + H + 'px';

      buildCode(pixels, W, H, cMode);

      btn.classList.remove('loading');
      btn.classList.add('success');
      setTimeout(() => btn.classList.remove('success'), 580);
    }, 40);
  }

  if (srcImage) {
    doConvert(srcImage);
  } else {
    const img = new Image();
    img.onload = () => doConvert(img);
    img.src = document.getElementById('drawCanvas').toDataURL();
  }
}

/* ──────────────────────────────────────────────────────────────
   toGray4bit — 4-bit grayscale pixel dizisi üretir (0–15)
   Alpha-aware: şeffaf piksel beyaz (15) olarak işlenir
────────────────────────────────────────────────────────────── */
function toGray4bit(imageData, W, H, invert) {
  const src    = imageData.data;
  const pixels = [];
  for (let i = 0; i < W * H; i++) {
    const a = src[i*4 + 3] / 255;
    const g = (0.299*src[i*4] + 0.587*src[i*4+1] + 0.114*src[i*4+2]) * a
              + 255 * (1 - a);
    let val = Math.round(g / 255 * 15);
    if (invert) val = 15 - val;
    pixels.push(val);
  }
  return pixels;
}

/* ──────────────────────────────────────────────────────────────
   escHtml — XSS koruması
   varName input'u innerHTML'e gitmeden önce temizlenir
────────────────────────────────────────────────────────────── */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Code builder ── */
function buildCode(pixels, W, H, cMode) {
  const name = document.getElementById('varName').value || 'myBitmap';
  const fmt  = document.getElementById('fmt').value;
  if (!cMode) cMode = document.getElementById('colorMode').value;

  const bytes = [];

  if (cMode === 'gray') {
    // ✅ 4-bit grayscale: 2 piksel → 1 byte (high nibble | low nibble)
    for (let r = 0; r < H; r++) {
      for (let b = 0; b < Math.ceil(W / 2); b++) {
        const p1 = pixels[r * W + b * 2]     ?? 0;
        const p2 = pixels[r * W + b * 2 + 1] ?? 0;
        bytes.push((p1 << 4) | (p2 & 0x0F));
      }
    }
  } else {
    // 1-bit BW: 8 piksel → 1 byte (MSB first)
    const bpr = Math.ceil(W / 8);
    for (let r = 0; r < H; r++) {
      for (let b = 0; b < bpr; b++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const col = b * 8 + bit;
          if (col < W && pixels[r * W + col]) byte |= (0x80 >> bit);
        }
        bytes.push(byte);
      }
    }
  }

  const modeLabel = cMode === 'gray' ? '4-bit grayscale' : '1-bit B&W';
  const lines     = [];
  // ✅ FIX: escHtml ile XSS koruması
  const cm       = t => `<span class="cm">${escHtml(t)}</span>`;
  const safeName = escHtml(name);

  if (fmt === 'arduino') {
    lines.push(cm(`// ${W}x${H}px — ${modeLabel} — ${bytes.length} bytes — generated by Pixel2Byte`));
    lines.push(`const unsigned char ${safeName}[] PROGMEM = {`);
  } else if (fmt === 'raw') {
    lines.push(cm(`// ${W}x${H}px — ${modeLabel} — ${bytes.length} bytes`));
    lines.push(`const uint8_t ${safeName}[] = {`);
  } else {
    lines.push(cm(`// ${W}x${H}px — ${modeLabel} (binary string)`));
    lines.push(`const char* ${safeName} =`);
  }

  if (fmt === 'binary') {
    for (let r = 0; r < H; r++) {
      let row = '  "';
      if (cMode === 'gray') {
        for (let c = 0; c < W; c++) row += pixels[r * W + c].toString(16).toUpperCase();
      } else {
        for (let c = 0; c < W; c++) row += pixels[r * W + c] ? '1' : '0';
      }
      row += '"' + (r < H - 1 ? '' : ';');
      lines.push(row);
    }
  } else {
    let line = '  ';
    bytes.forEach((b, i) => {
      line += '0x' + b.toString(16).toUpperCase().padStart(2, '0');
      if (i < bytes.length - 1) line += ', ';
      if ((i + 1) % 16 === 0) { lines.push(line); line = '  '; }
    });
    if (line.trim()) lines.push(line);
    lines.push('};');
  }

  /* ── Typewriter reveal ── */
  const el = document.getElementById('outCode');
  el.innerHTML = '';
  const MAX_ANIMATED = 30;
  lines.forEach((ln, i) => {
    const span = document.createElement('span');
    span.className = 'code-line';
    span.innerHTML = ln + '\n';
    span.style.animationDelay = i < MAX_ANIMATED ? (i * 28) + 'ms' : '0ms';
    if (i >= MAX_ANIMATED) { span.style.animation = 'none'; span.style.opacity = '1'; }
    el.appendChild(span);
  });

  _lastBytes   = bytes.slice();
  _lastVarName = name;
  _lastW = W; _lastH = H;
  const dlBtn = document.getElementById('btnDownloadH');
  if (dlBtn) dlBtn.disabled = false;

  document.getElementById('sizeInfo').textContent = `${W}×${H} — ${bytes.length} bytes`;

  const tag = document.getElementById('byteTag');
  tag.textContent = bytes.length + ' bytes';
  tag.style.display = 'inline-block';
  tag.classList.remove('pop');
  void tag.offsetWidth;
  tag.classList.add('pop');
}

/* ── Download .h ── */
function downloadHeader() {
  if (!_lastBytes || !_lastBytes.length) return;

  const name  = _lastVarName || 'myBitmap';
  const def   = name.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
  const W     = _lastW;
  const H     = _lastH;
  const bytes = _lastBytes;

  const lines = [
    `#pragma once`,
    ``,
    `// ${name}.h — ${W}x${H}px, ${bytes.length} bytes`,
    `// generated by Pixel2Byte  https://pixel2byte.app`,
    ``,
    `#define ${def}_WIDTH   ${W}`,
    `#define ${def}_HEIGHT  ${H}`,
    `#define ${def}_BYTES   ${bytes.length}`,
    ``,
    `const unsigned char ${name}[] PROGMEM = {`,
  ];

  for (let i = 0; i < bytes.length; i += 16) {
    const chunk  = bytes.slice(i, i + 16);
    const hex    = chunk.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ');
    const isLast = i + 16 >= bytes.length;
    lines.push('  ' + hex + (isLast ? '' : ','));
  }
  lines.push('};');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = name + '.h';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const btn = document.getElementById('btnDownloadH');
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent       = '✓ DOWNLOADED';
  btn.style.color       = 'var(--acc)';
  btn.style.borderColor = 'var(--acc)';
  setTimeout(() => {
    btn.textContent       = orig;
    btn.style.color       = '';
    btn.style.borderColor = '';
  }, 1600);
}

/* ── Copy ── */
function copyCode() {
  const el   = document.getElementById('outCode');
  const text = el.innerText || el.textContent;

  // ✅ FIX: placeholder string yerine _lastBytes kontrolü — daha güvenilir
  if (!_lastBytes || !_lastBytes.length) return;

  navigator.clipboard.writeText(text).then(() => {
    // ✅ FIX: Download butonu artık "COPIED" olmuyor
    document.querySelectorAll('.copy-btn, .btn-sec:not(#btnDownloadH)').forEach(btn => {
      const orig = btn.textContent;
      btn.textContent       = '✓ COPIED';
      btn.style.color       = 'var(--acc)';
      btn.style.borderColor = 'var(--acc)';
      setTimeout(() => {
        btn.textContent       = orig;
        btn.style.color       = '';
        btn.style.borderColor = '';
      }, 1600);
    });
  });
}