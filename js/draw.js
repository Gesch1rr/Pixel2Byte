let tool    = 'pen';
let brushSz = 2;
let zoom    = 4;
let drawing = false;
let lx = 0, ly = 0;
let sx = 0, sy = 0;
let snapshot  = null;
let undoStack = [];
const MAX_UNDO = 30;

const dc   = document.getElementById('drawCanvas');
const dctx = dc.getContext('2d');

/* ── Init ── */
function initDraw(keep) {
  const w = +document.getElementById('outW').value || 128;
  const h = +document.getElementById('outH').value || 64;

  let saved = null;
  if (keep && dc.width > 0 && dc.height > 0) {
    try { saved = dctx.getImageData(0, 0, dc.width, dc.height); } catch(e) {}
  }

  dc.width  = w;
  dc.height = h;
  dc.style.width  = (w * zoom) + 'px';
  dc.style.height = (h * zoom) + 'px';

  dctx.fillStyle = '#ffffff';
  dctx.fillRect(0, 0, w, h);
  if (saved) dctx.putImageData(saved, 0, 0);

  document.getElementById('sbCanvas').textContent = w + '×' + h;

  const dw = document.getElementById('drawW');
  const dh = document.getElementById('drawH');
  if (dw) dw.value = w;
  if (dh) dh.value = h;
}

function setZoom(z) {
  zoom = z;
  dc.style.width  = (dc.width  * zoom) + 'px';
  dc.style.height = (dc.height * zoom) + 'px';
}

function syncSize() {
  const w = Math.max(1, Math.min(512, +document.getElementById('drawW').value || 128));
  const h = Math.max(1, Math.min(512, +document.getElementById('drawH').value || 64));
  document.getElementById('outW').value = w;
  document.getElementById('outH').value = h;
  document.getElementById('drawW').value = w;
  document.getElementById('drawH').value = h;
  initDraw(true);
}

/* ── Undo ── */
function saveUndo() {
  if (undoStack.length >= MAX_UNDO) undoStack.shift();
  undoStack.push(dctx.getImageData(0, 0, dc.width, dc.height));
}

function undoDraw() {
  if (!undoStack.length) return;
  dctx.putImageData(undoStack.pop(), 0, 0);
}

/* ── Position helper ── */
function getPos(e) {
  const r   = dc.getBoundingClientRect();
  const scX = dc.width  / r.width;
  const scY = dc.height / r.height;
  const src = e.touches ? e.touches[0] : e;
  return [
    Math.max(0, Math.min(dc.width  - 1, Math.floor((src.clientX - r.left) * scX))),
    Math.max(0, Math.min(dc.height - 1, Math.floor((src.clientY - r.top)  * scY)))
  ];
}

/* ── Paint primitives ── */
function paintPx(x, y) {
  dctx.fillStyle = tool === 'eraser' ? '#ffffff' : '#000000';
  const s = brushSz;
  dctx.fillRect(x - Math.floor(s / 2), y - Math.floor(s / 2), s, s);
}

function paintLine(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let stepX = x0 < x1 ? 1 : -1, stepY = y0 < y1 ? 1 : -1, err = dx - dy;
  while (true) {
    paintPx(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += stepX; }
    if (e2 <  dx) { err += dx; y0 += stepY; }
  }
}

function pixelRect(x0, y0, x1, y1) {
  const lx = Math.min(x0, x1), rx = Math.max(x0, x1);
  const ty = Math.min(y0, y1), by = Math.max(y0, y1);
  const s  = Math.max(1, brushSz);
  dctx.fillStyle = '#000000';
  dctx.fillRect(lx,       ty,       rx - lx + 1, s);
  dctx.fillRect(lx,       by-s+1,   rx - lx + 1, s);
  dctx.fillRect(lx,       ty,       s,            by - ty + 1);
  dctx.fillRect(rx - s+1, ty,       s,            by - ty + 1);
}

function pixelOval(x0, y0, x1, y1) {
  const ecx = (x0 + x1) / 2, ecy = (y0 + y1) / 2;
  const erx = Math.abs(x1 - x0) / 2, ery = Math.abs(y1 - y0) / 2;
  if (erx < 1 && ery < 1) { paintPx(Math.round(ecx), Math.round(ecy)); return; }

  const s = Math.max(1, brushSz), o = Math.floor(s / 2);
  dctx.fillStyle = '#000000';

  function plot4(px, py) {
    dctx.fillRect(Math.round(ecx+px)-o, Math.round(ecy+py)-o, s, s);
    dctx.fillRect(Math.round(ecx-px)-o, Math.round(ecy+py)-o, s, s);
    dctx.fillRect(Math.round(ecx+px)-o, Math.round(ecy-py)-o, s, s);
    dctx.fillRect(Math.round(ecx-px)-o, Math.round(ecy-py)-o, s, s);
  }

  let ex = 0, ey = Math.round(ery);
  const rx2 = erx * erx, ry2 = ery * ery;
  let dx = 0, dy = 2 * rx2 * ey;
  let p = Math.round(ry2 - rx2 * ery + 0.25 * rx2);

  while (dx < dy) {
    plot4(ex, ey);
    ex++; dx += 2 * ry2;
    if (p < 0) { p += ry2 + dx; }
    else { ey--; dy -= 2 * rx2; p += ry2 + dx - dy; }
  }

  p = Math.round(ry2 * (ex+0.5) * (ex+0.5) + rx2 * (ey-1) * (ey-1) - rx2 * ry2);
  while (ey >= 0) {
    plot4(ex, ey);
    ey--; dy -= 2 * rx2;
    if (p > 0) { p += rx2 - dy; }
    else { ex++; dx += 2 * ry2; p += rx2 - dy + dx; }
  }
}

/* Flood fill */
function floodFill(x, y) {
  const id = dctx.getImageData(0, 0, dc.width, dc.height);
  const px = id.data;
  const i0 = (y * dc.width + x) * 4;
  const [tr, tg, tb, ta] = [px[i0], px[i0+1], px[i0+2], px[i0+3]];
  const [fr, fg, fb] = [0, 0, 0];
  if (tr === fr && tg === fg && tb === fb) return;

  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= dc.width || cy >= dc.height) continue;
    const i = (cy * dc.width + cx) * 4;
    if (px[i] !== tr || px[i+1] !== tg || px[i+2] !== tb || px[i+3] !== ta) continue;
    px[i] = fr; px[i+1] = fg; px[i+2] = fb; px[i+3] = 255;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  dctx.putImageData(id, 0, 0);
}

/* ── Canvas events ── */
function onDown(e) {
  e.preventDefault();
  saveUndo();
  drawing = true;
  [lx, ly] = getPos(e);
  [sx, sy] = [lx, ly];
  snapshot = dctx.getImageData(0, 0, dc.width, dc.height);
  if (tool === 'fill') { floodFill(lx, ly); drawing = false; return; }
  if (tool === 'pen' || tool === 'eraser') paintPx(lx, ly);
}

function onMove(e) {
  e.preventDefault();
  const [cx, cy] = getPos(e);

  // ✅ Sadece sağ alt coordTip güncelleniyor, sbPos kaldırıldı
  document.getElementById('coordTip').textContent = cx + ' : ' + cy;

  if (!drawing) return;

  if (tool === 'pen' || tool === 'eraser') {
    paintLine(lx, ly, cx, cy);
    lx = cx; ly = cy;
  } else if (snapshot) {
    dctx.putImageData(snapshot, 0, 0);
    if      (tool === 'line') paintLine(sx, sy, cx, cy);
    else if (tool === 'rect') pixelRect(sx, sy, cx, cy);
    else if (tool === 'oval') pixelOval(sx, sy, cx, cy);
  }
}

function onUp() { drawing = false; snapshot = null; }

dc.addEventListener('mousedown', onDown);
dc.addEventListener('mousemove', onMove);
dc.addEventListener('mouseup',   onUp);
dc.addEventListener('mouseleave', () => {
  onUp();
  document.getElementById('coordTip').textContent = '─ : ─';
});
dc.addEventListener('touchstart', onDown, { passive: false });
dc.addEventListener('touchmove',  onMove, { passive: false });
dc.addEventListener('touchend',   onUp);

/* ── Tool controls ── */
function setTool(t, btn) {
  tool = t;
  document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('sbTool').textContent = t;
}

function clearDraw() {
  saveUndo();
  dctx.fillStyle = '#ffffff';
  dctx.fillRect(0, 0, dc.width, dc.height);
}

function useDrawing() {
  const img = new Image();
  img.onload = () => {
    srcImage = img;
    showOrig(img);
    document.querySelectorAll('.htab')[0].click();
  };
  img.src = dc.toDataURL();
}

function updateBrush(val) {
  document.getElementById('szDsp').textContent = val;
  const dot  = document.getElementById('brushDot');
  const size = Math.max(2, Math.min(20, +val));
  dot.style.width  = size + 'px';
  dot.style.height = size + 'px';
}

/* ── Init on load ── */
document.querySelectorAll('.sz-inp').forEach(inp => {
  inp.addEventListener('wheel', e => e.preventDefault(), { passive: false });
});

initDraw(false);
document.getElementById('outW').addEventListener('change', () => initDraw(true));
document.getElementById('outH').addEventListener('change', () => initDraw(true));