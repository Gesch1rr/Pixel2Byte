/* ── Terminal-style processing helpers ── */

function cmdSel(opt, hiddenId, labelId) {
  opt.closest('.cmd-opts').querySelectorAll('.cmd-opt').forEach(o => o.classList.remove('sel'));
  opt.classList.add('sel');
  document.getElementById(hiddenId).value = opt.dataset.val;
  document.getElementById(labelId).textContent = opt.dataset.val;
}

function updateSliderFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min) * 100).toFixed(1) + '%';
  input.style.setProperty('--fill', pct);
}

/* ── Tab switching ── */
document.querySelectorAll('.htab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.htab').forEach(x => x.classList.remove('on'));
    document.querySelectorAll('.pane').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    document.getElementById('pane-' + t.dataset.pane).classList.add('on');
    document.querySelector('.app').classList.toggle('draw-mode', t.dataset.pane === 'draw');
  });
});

/* ── Convert button ripple ── */
document.querySelector('.btn-main').addEventListener('click', function(e) {
  const btn  = this;
  const r    = btn.getBoundingClientRect();
  const size = Math.max(btn.clientWidth || 80, btn.clientHeight || 40) * 2;
  const rip  = document.createElement('span');
  rip.className = 'ripple';
  rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size/2}px;top:${e.clientY - r.top - size/2}px`;
  btn.appendChild(rip);
  setTimeout(() => rip.remove(), 650);
});

/* ── Button click bounce ── */
document.querySelectorAll('.tbtn, .tb-act, .tb-cta').forEach(btn => {
  btn.addEventListener('mousedown', () => {
    btn.classList.remove('clicked');
    void btn.offsetWidth;
    btn.classList.add('clicked');
    setTimeout(() => btn.classList.remove('clicked'), 220);
  });
});

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', e => {
  const isDrawPane = document.getElementById('pane-draw').classList.contains('on');

  if (e.ctrlKey && e.key === 'z') {
    if (isDrawPane) { e.preventDefault(); undoDraw(); }
    return;
  }
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    convertImage();
    return;
  }

  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

  const toolMap = { p:'pen', e:'eraser', l:'line', r:'rect', o:'oval', f:'fill' };
  const idMap   = { pen:'tPen', eraser:'tErase', line:'tLine', rect:'tRect', oval:'tOval', fill:'tFill' };
  const k = e.key.toLowerCase();

  if (toolMap[k] && isDrawPane) {
    const btn = document.getElementById(idMap[toolMap[k]]);
    if (btn) setTool(toolMap[k], btn);
  }
});

/* ── Slider init ── */
document.addEventListener('DOMContentLoaded', () => {
  const th = document.getElementById('threshold');
  if (th) updateSliderFill(th);
});