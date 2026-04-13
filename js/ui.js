// ─── FORMATTERS ──────────────────────────────────────────────────────────────
function bin8(v) { return (v & 0xFF).toString(2).padStart(8, '0'); }
function bin4(v) { return (v & 0xF).toString(2).padStart(4, '0'); }
function hex2(v) { return '0x' + (v & 0xFF).toString(16).toUpperCase().padStart(2, '0'); }
function hex1(v) { return '0x' + (v & 0xF).toString(16).toUpperCase(); }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── REGISTER DISPLAY ────────────────────────────────────────────────────────
function updateRegDisplay() {
  const s = cpuState;
  setText('v-pc-bin',  bin4(s.pc));
  setText('v-pc-hex',  hex1(s.pc));
  setText('v-mar-bin', bin4(s.mar));
  setText('v-mar-hex', hex1(s.mar));
  setText('v-ram-bin', bin8(s.ram[s.mar] ?? 0));
  setText('v-ram-hex', hex2(s.ram[s.mar] ?? 0));
  setText('v-ir-bin',  bin8(s.ir));
  setText('v-ir-hex',  hex2(s.ir));
  setText('v-ir-mnem', (MNEM[getOpcode(s.ir)] || '???') + ' ' + getOperand(s.ir));
  setText('v-a-bin',   bin8(s.a));
  setText('v-a-hex',   hex2(s.a));
  setText('v-a-dec',   s.a.toString());

  const aluVal = s.subFlag ? ((s.a - s.b + 256) & 0xFF) : ((s.a + s.b) & 0xFF);
  setText('v-alu-bin', bin8(aluVal));
  setText('v-alu-hex', hex2(aluVal));
  setText('v-b-bin',   bin8(s.b));
  setText('v-b-hex',   hex2(s.b));
  setText('v-out-bin', bin8(s.out));
  setText('v-out-hex', hex2(s.out));
  setText('v-out-dec', s.out.toString());

  const fz = document.getElementById('f-zero');
  const fc = document.getElementById('f-carry');
  if (fz) { fz.textContent = s.flags.z; fz.className = 'flag-val' + (s.flags.z ? ' set' : ''); }
  if (fc) { fc.textContent = s.flags.c; fc.className = 'flag-val' + (s.flags.c ? ' set' : ''); }

  document.getElementById('seven-seg').textContent = s.out.toString().padStart(3, '0');

  const ledsEl = document.getElementById('out-leds');
  ledsEl.innerHTML = '';
  for (let i = 7; i >= 0; i--) {
    const led = document.createElement('div');
    led.className = 'out-led' + ((s.out >> i & 1) ? ' on' : '');
    ledsEl.appendChild(led);
  }

  setText('v-cycles',      s.cycles);
  setText('b-cycles',      s.cycles);
  setText('b-instrs-done', Math.floor(s.cycles / 6));
  setText('b-instr',       MNEM[getOpcode(s.ir)] || '—');
  setText('v-phase',       s.tState === 0 ? 'IDLE' : (s.tState <= 2 ? 'FETCH' : 'EXEC'));
  setText('b-phase',       s.tState === 0 ? 'IDLE' : (s.tState <= 2 ? 'FETCH' : 'EXEC'));
  setText('b-tstate',      s.tState === 0 ? '—' : 'T' + s.tState);

  renderRAM();
}

// ─── ASM OUTPUT ──────────────────────────────────────────────────────────────
function renderAsmOutput(output, errors) {
  const el  = document.getElementById('asm-output');
  let html  = '';
  for (const row of output) {
    const bin = row.val.toString(2).padStart(8, '0');
    const hex = row.val.toString(16).toUpperCase().padStart(2, '0');
    html += `<div class="asm-row">
      <span class="asm-addr">${row.addr.toString(16).toUpperCase()}</span>
      <span class="asm-bin">${bin}</span>
      <span class="asm-hex">${hex}</span>
      <span class="asm-mnem">${escapeHtml(row.mnem)}</span>
    </div>`;
  }
  for (const e of errors) html += `<div class="asm-err">${escapeHtml(e)}</div>`;
  el.innerHTML = html || '<span style="color:var(--text-dim)">Press ASSEMBLE</span>';
}

// ─── RAM GRID ────────────────────────────────────────────────────────────────
function renderRAM() {
  const grid = document.getElementById('ram-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const v   = cpuState.ram[i];
    const bin = v.toString(2).padStart(8, '0');
    const hex = v.toString(16).toUpperCase().padStart(2, '0');
    const cell = document.createElement('div');
    cell.className = 'ram-cell'
      + (i === cpuState.mar           ? ' active'    : '')
      + (programAddrs.has(i)          ? ' prog'      : '')
      + (!programAddrs.has(i) && v !== 0 ? ' data-cell' : '');
    cell.id = `ram-cell-${i}`;
    cell.innerHTML = `
      <div class="rc-addr">${i.toString(16).toUpperCase()}</div>
      <div class="rc-hex">${hex}</div>
      <div class="rc-bin">${bin.slice(0, 4)} ${bin.slice(4)}</div>`;
    cell.onclick = () => startEditRAM(i, cell);
    grid.appendChild(cell);
  }
}

function startEditRAM(i, cell) {
  const inp = document.createElement('input');
  inp.className = 'ram-cell-edit';
  inp.value     = cpuState.ram[i].toString(16).toUpperCase().padStart(2, '0');
  inp.maxLength = 2;
  cell.appendChild(inp);
  inp.focus(); inp.select();
  inp.onblur = inp.onkeydown = (e) => {
    if (e.type === 'keydown' && e.key !== 'Enter') return;
    const v = parseInt(inp.value, 16);
    if (!isNaN(v) && v >= 0 && v <= 255) cpuState.ram[i] = v;
    inp.onblur = inp.onkeydown = null;
    inp.remove();
    renderRAM();
    updateRegDisplay();
  };
}

// ─── CONTROL SIGNALS ─────────────────────────────────────────────────────────
const ALL_SIGS = ['CO','MI','RO','II','CE','IO','AI','AO','BI','EO','SU','OI','RI','J','HLT'];

function buildControlSignals() {
  document.getElementById('ctrl-signals').innerHTML = ALL_SIGS.map(s =>
    `<div class="sig-led">
      <div class="sig-dot" id="sig-${s}"></div>
      <div class="sig-name">${s}</div>
    </div>`
  ).join('');
}

function setSignals(active) {
  for (const s of ALL_SIGS) {
    const el = document.getElementById('sig-' + s);
    if (el) el.className = 'sig-dot' + (active.includes(s) ? ' active' : '');
  }
  const ctrlEl = document.getElementById('v-ctrl-signals');
  if (ctrlEl) ctrlEl.textContent = active.join('|') || '—';
}

// ─── T-STATE DISPLAY ─────────────────────────────────────────────────────────
function buildTStates() {
  document.getElementById('tstates').innerHTML = [1, 2, 3, 4, 5, 6].map(t =>
    `<div class="tstate-box" id="ts-${t}">T${t}</div>`
  ).join('');
}

function setTState(t) {
  for (let i = 1; i <= 6; i++) {
    const el = document.getElementById('ts-' + i);
    if (el) el.className = 'tstate-box' + (i === t ? ' active' : '');
  }
  setText('b-tstate', t ? 'T' + t : '—');
}

// ─── BUS ANIMATION ───────────────────────────────────────────────────────────
let busAnimTimeout = null;

function flashBus(value, srcId, dstId) {
  updateBusDisplay(value);
  if (srcId) flashReg(srcId);
  if (dstId) flashReg(dstId);
  const svg = document.getElementById('bus-svg');
  if (svg) svg.classList.add('bus-active');
  clearTimeout(busAnimTimeout);
  busAnimTimeout = setTimeout(() => { if (svg) svg.classList.remove('bus-active'); },
    Math.max(100, 600 / clockHz));
}

function flashReg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('reg-flash');
  void el.offsetWidth;
  el.classList.add('reg-flash', 'active');
  setTimeout(() => { if (el) el.classList.remove('active'); }, 400);
}

function updateBusDisplay(val) {
  const el = document.getElementById('bus-val-display');
  if (el) el.textContent = `BUS: ${bin8(val)} | ${hex2(val)}`;
}

// ─── SVG BUS LINES ───────────────────────────────────────────────────────────
function drawBusLines() {
  const svg  = document.getElementById('bus-svg');
  if (!svg) return;
  const diag = document.getElementById('cpu-diagram');
  const W = diag.clientWidth, H = diag.clientHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  function box(id) {
    const el = document.getElementById(id);
    if (!el) return { cx: 0, cy: 0, left: 0, right: 0, top: 0, bottom: 0 };
    const r = el.getBoundingClientRect(), dr = diag.getBoundingClientRect();
    const left = r.left - dr.left, top = r.top - dr.top;
    return { cx: (left + r.width / 2), cy: (top + r.height / 2),
             left, right: left + r.width, top, bottom: top + r.height };
  }

  const busX = W * 0.72;
  function wire(id, side) {
    const b = box(id);
    const x1 = side === 'right' ? b.right : b.left;
    return `<line x1="${x1}" y1="${b.cy}" x2="${busX}" y2="${b.cy}"
      stroke="rgba(0,212,255,0.25)" stroke-width="1.5"/>`;
  }

  svg.innerHTML = `
    <line x1="${busX}" y1="35" x2="${busX}" y2="${H - 20}"
      stroke="rgba(0,212,255,0.18)" stroke-width="2.5" stroke-dasharray="5,4"/>
    ${wire('r-pc','right')} ${wire('r-mar','right')} ${wire('r-ram','right')}
    ${wire('r-ir','right')} ${wire('r-ctrl','right')}
    ${wire('r-a','right')}  ${wire('r-alu','right')} ${wire('r-b','right')}
    ${wire('r-out','right')}`;
}

// ─── EXECUTION LOG ───────────────────────────────────────────────────────────
function addLog(msg, type) {
  const log = document.getElementById('exec-log');
  const div = document.createElement('div');
  const cls = 'log-entry log-' + (
    type === 'halt'  ? 'halt'  :
    type === 'flag'  ? 'flag'  :
    type === 'fetch' ? 'fetch' : 'exec'
  );
  div.className   = cls;
  div.textContent = msg;
  log.insertBefore(div, log.firstChild);
  if (log.children.length > 200) log.removeChild(log.lastChild);
}

// ─── INFO MODAL ──────────────────────────────────────────────────────────────
function openInfoModal() {
  document.getElementById('info-modal-backdrop').classList.add('open');
}

function closeInfoModal(e) {
  if (!e || e.target === document.getElementById('info-modal-backdrop')
         || e.currentTarget === document.getElementById('info-modal-close')) {
    document.getElementById('info-modal-backdrop').classList.remove('open');
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeInfoModal();
});

// ─── SYNTAX HIGHLIGHT ────────────────────────────────────────────────────────
function highlightCode(text) {
  return text.split('\n').map(line => {
    const semi = line.indexOf(';');
    if (semi === -1) return escapeHtml(line);
    return escapeHtml(line.slice(0, semi)) +
           '<span class="comment">' + escapeHtml(line.slice(semi)) + '</span>';
  }).join('\n');
}

function syncHighlight() {
  const editor    = document.getElementById('code-editor');
  const highlight = document.getElementById('code-highlight');
  if (!editor || !highlight) return;
  highlight.innerHTML = highlightCode(editor.value) + '\n';
  highlight.scrollTop  = editor.scrollTop;
  highlight.scrollLeft = editor.scrollLeft;
}

// ─── INIT ────────────────────────────────────────────────────────────────────
window.onload = () => {
  buildControlSignals();
  buildTStates();
  assemble();
  updateRegDisplay();
  setTimeout(drawBusLines, 100);
  updateStatus('idle');

  const editor = document.getElementById('code-editor');
  editor.addEventListener('input',  syncHighlight);
  editor.addEventListener('scroll', syncHighlight);
  syncHighlight();

  document.getElementById('example-select').onchange = function () {
    if (this.value && EXAMPLES[this.value]) {
      editor.value = EXAMPLES[this.value];
      syncHighlight();
    }
  };
};

window.onresize = () => drawBusLines();
