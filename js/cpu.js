// ─── CPU STATE ───────────────────────────────────────────────────────────────
const cpuState = {
  pc: 0, mar: 0, ir: 0, a: 0, b: 0, out: 0,
  flags: { z: 0, c: 0 },
  ram: new Array(16).fill(0),
  running: false, halted: false,
  tState: 0,
  cycles: 0,
  instrCount: 0,
  subFlag: false
};

let clockInterval = null;
let clockHz       = 1;
const HZ_STEPS    = [0.5, 1, 2, 4, 8, 16, 32, 64];
let programAddrs  = new Set();
let perfStart     = null;
let perfEnd       = null;
let lastRunCycles = null;

// ─── OPCODES ─────────────────────────────────────────────────────────────────
const OPCODES = {
  LDA: 0b0000, ADD: 0b0001, SUB: 0b0010, STA: 0b0011,
  LDI: 0b0100, JMP: 0b0101, JC:  0b0110, JZ:  0b0111,
  OUT: 0b1110, HLT: 0b1111
};
const MNEM = Object.fromEntries(Object.entries(OPCODES).map(([k, v]) => [v, k]));

function getOpcode(ir)  { return (ir >> 4) & 0xF; }
function getOperand(ir) { return ir & 0xF; }

// ─── T-STATE EXECUTION ────────────────────────────────────────────────────────
function executeTStateLogic() {
  const s       = cpuState;
  const t       = s.tState;
  const op      = getOpcode(s.ir);
  const operand = getOperand(s.ir);

  setTState(t);

  if (t === 1) {
    setSignals(['CO', 'MI']);
    flashBus(s.pc, 'r-pc', 'r-mar');
    s.mar = s.pc;
    addLog(`[T1] FETCH   MAR ← PC = 0x${s.pc.toString(16).toUpperCase()}`, 'fetch');
    s.cycles++;
    return;
  }

  if (t === 2) {
    setSignals(['RO', 'II', 'CE']);
    const ramVal = s.ram[s.mar] || 0;
    flashBus(ramVal, 'r-ram', 'r-ir');
    s.ir = ramVal;
    s.pc = (s.pc + 1) & 0xF;
    addLog(`[T2] FETCH   IR ← RAM[0x${s.mar.toString(16).toUpperCase()}] = ${bin8(ramVal)}  PC→${s.pc}`, 'fetch');
    s.cycles++;
    return;
  }

  if (t === 3) {
    switch (op) {
      case OPCODES.LDA:
        setSignals(['IO', 'MI']); flashBus(operand, 'r-ir', 'r-mar');
        s.mar = operand;
        addLog(`[T3] LDA     MAR ← ${operand}`, 'exec'); break;
      case OPCODES.ADD:
        setSignals(['IO', 'MI']); flashBus(operand, 'r-ir', 'r-mar');
        s.mar = operand;
        addLog(`[T3] ADD     MAR ← ${operand}`, 'exec'); break;
      case OPCODES.SUB:
        setSignals(['IO', 'MI']); flashBus(operand, 'r-ir', 'r-mar');
        s.mar = operand;
        addLog(`[T3] SUB     MAR ← ${operand}`, 'exec'); break;
      case OPCODES.STA:
        setSignals(['IO', 'MI']); flashBus(operand, 'r-ir', 'r-mar');
        s.mar = operand;
        addLog(`[T3] STA     MAR ← ${operand}`, 'exec'); break;
      case OPCODES.LDI:
        setSignals(['IO', 'AI']); flashBus(operand, 'r-ir', 'r-a');
        s.a = operand & 0xFF;
        addLog(`[T3] LDI     A ← ${operand}`, 'exec'); break;
      case OPCODES.JMP:
        setSignals(['IO', 'J']); flashBus(operand, 'r-ir', 'r-pc');
        s.pc = operand;
        addLog(`[T3] JMP     PC ← ${operand}`, 'exec'); break;
      case OPCODES.JC:
        if (s.flags.c) {
          setSignals(['IO', 'J']); flashBus(operand, 'r-ir', 'r-pc');
          s.pc = operand;
          addLog(`[T3] JC      PC ← ${operand}  (C=1)`, 'exec');
        } else {
          setSignals([]);
          addLog(`[T3] JC      no jump  (C=0)`, 'exec');
        }
        break;
      case OPCODES.JZ:
        if (s.flags.z) {
          setSignals(['IO', 'J']); flashBus(operand, 'r-ir', 'r-pc');
          s.pc = operand;
          addLog(`[T3] JZ      PC ← ${operand}  (Z=1)`, 'exec');
        } else {
          setSignals([]);
          addLog(`[T3] JZ      no jump  (Z=0)`, 'exec');
        }
        break;
      case OPCODES.OUT:
        setSignals(['AO', 'OI']); flashBus(s.a, 'r-a', 'r-out');
        s.out = s.a;
        addLog(`[T3] OUT     OUT ← A = ${s.a}`, 'exec'); break;
      case OPCODES.HLT:
        setSignals(['HLT']);
        s.halted = true;
        perfEnd = performance.now();
        stopClock();
        addLog(`[T3] HLT     *** HALT ***`, 'halt');
        updateStatus('halted');
        lastRunCycles = s.cycles;
        break;
      default: setSignals([]);
    }
    s.cycles++;
    return;
  }

  if (t === 4) {
    switch (op) {
      case OPCODES.LDA: {
        setSignals(['RO', 'AI']);
        const v = s.ram[s.mar] || 0; flashBus(v, 'r-ram', 'r-a');
        s.a = v; addLog(`[T4] LDA     A ← RAM[0x${s.mar.toString(16).toUpperCase()}] = ${v}`, 'exec'); break;
      }
      case OPCODES.ADD: {
        setSignals(['RO', 'BI']);
        const v = s.ram[s.mar] || 0; flashBus(v, 'r-ram', 'r-b');
        s.b = v; addLog(`[T4] ADD     B ← RAM[0x${s.mar.toString(16).toUpperCase()}] = ${v}`, 'exec'); break;
      }
      case OPCODES.SUB: {
        setSignals(['RO', 'BI']);
        const v = s.ram[s.mar] || 0; flashBus(v, 'r-ram', 'r-b');
        s.b = v; addLog(`[T4] SUB     B ← RAM[0x${s.mar.toString(16).toUpperCase()}] = ${v}`, 'exec'); break;
      }
      case OPCODES.STA:
        setSignals(['AO', 'RI']); flashBus(s.a, 'r-a', 'r-ram');
        s.ram[s.mar] = s.a;
        addLog(`[T4] STA     RAM[0x${s.mar.toString(16).toUpperCase()}] ← A = ${s.a}`, 'exec'); break;
      default: setSignals([]);
    }
    s.cycles++;
    return;
  }

  if (t === 5) {
    switch (op) {
      case OPCODES.ADD: {
        setSignals(['EO', 'AI']);
        s.subFlag = false;
        const sum    = s.a + s.b;
        const result = sum & 0xFF;
        s.flags.c = sum > 255 ? 1 : 0;
        s.flags.z = result === 0 ? 1 : 0;
        flashBus(result, 'r-alu', 'r-a');
        addLog(`[T5] ADD     A ← ALU = ${s.a}+${s.b}=${result}  Z=${s.flags.z} C=${s.flags.c}`, 'flag');
        s.a = result; break;
      }
      case OPCODES.SUB: {
        setSignals(['EO', 'AI', 'SU']);
        s.subFlag = true;
        const diff   = s.a - s.b;
        const result = (diff + 256) & 0xFF;
        s.flags.c = diff < 0 ? 0 : 1;
        s.flags.z = result === 0 ? 1 : 0;
        flashBus(result, 'r-alu', 'r-a');
        addLog(`[T5] SUB     A ← ALU = ${s.a}-${s.b}=${result}  Z=${s.flags.z} C=${s.flags.c}`, 'flag');
        s.a = result; break;
      }
      default: setSignals([]);
    }
    s.cycles++;
    return;
  }

  if (t === 6) {
    setSignals([]);
    s.cycles++;
  }
}

// ─── TICK ────────────────────────────────────────────────────────────────────
function tick() {
  const s = cpuState;
  if (s.halted) return;
  if (!perfStart) perfStart = performance.now();

  s.tState++;
  if (s.tState > 6) s.tState = 1;

  executeTStateLogic();
  updateRegDisplay();
  updatePerfDisplay();
  flashClockLED();
}

// ─── CLOCK ───────────────────────────────────────────────────────────────────
function scheduleNextTick() {
  clockInterval = setTimeout(() => {
    if (!cpuState.running || cpuState.halted) return;
    tick();
    if (cpuState.running && !cpuState.halted) scheduleNextTick();
  }, 1000 / clockHz);
}

function startClock() {
  clearTimeout(clockInterval);
  cpuState.running = true;
  updateStatus('running');
  document.getElementById('run-btn').textContent = 'PAUSE';
  document.getElementById('run-btn').classList.add('active');
  scheduleNextTick();
}

function stopClock() {
  clearTimeout(clockInterval);
  clockInterval    = null;
  cpuState.running = false;
  if (!cpuState.halted) {
    updateStatus('paused');
    document.getElementById('run-btn').textContent = 'RUN';
    document.getElementById('run-btn').classList.remove('active');
  }
}

function toggleRun() {
  if (cpuState.halted) return;
  cpuState.running ? stopClock() : startClock();
}

function stepOne() {
  if (cpuState.halted) return;
  stopClock();
  tick();
}

function resetCPU() {
  stopClock();
  Object.assign(cpuState, {
    pc: 0, mar: 0, ir: 0, a: 0, b: 0, out: 0,
    flags: { z: 0, c: 0 },
    running: false, halted: false,
    tState: 0, cycles: 0, instrCount: 0, subFlag: false
  });
  perfStart     = null;
  perfEnd       = null;
  lastRunCycles = null;
  setSignals([]);
  setTState(0);
  updateStatus('idle');
  const runBtn = document.getElementById('run-btn');
  runBtn.textContent = 'RUN';
  runBtn.classList.remove('active');
  document.getElementById('exec-log').innerHTML = '';
  assemble();
  updateRegDisplay();
  updatePerfDisplay();
}

// ─── STATUS / PERF ───────────────────────────────────────────────────────────
function updateStatus(state) {
  document.getElementById('status-led').className   = 'status-led ' + state;
  document.getElementById('status-text').textContent = state.toUpperCase();
  setText('v-phase', state === 'idle' ? 'IDLE' : state.toUpperCase());
  setText('b-phase', state === 'idle' ? 'IDLE' : state.toUpperCase());
}

function updateSpeed(idx) {
  clockHz = HZ_STEPS[parseInt(idx)] || 1;
  const hzText = clockHz < 1 ? '0.5 Hz' : clockHz + ' Hz';
  ['hz-display', 'hz-display-bottom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = hzText;
  });
  if (cpuState.running) startClock();
  updatePerfDisplay();
}

function flashClockLED() {
  const led = document.getElementById('clock-indicator');
  led.classList.remove('off');
  clearTimeout(window._clockOffTimer);
  window._clockOffTimer = setTimeout(() => led.classList.add('off'), 80);
}

function updatePerfDisplay() {
  const periodMs  = clockHz < 1 ? 2000 : Math.round(1000 / clockHz);
  const periodTxt = periodMs >= 1000 ? (periodMs / 1000).toFixed(1) + ' s' : periodMs + ' ms';
  setText('b-period', periodTxt);
  const ips = (clockHz / 6).toFixed(2);
  setText('b-throughput', ips + ' inst/s');
  if (!perfStart) { setText('b-elapsed', '—'); return; }
  const endT = perfEnd || performance.now();
  const ms   = endT - perfStart;
  const txt  = ms < 1000 ? ms.toFixed(0) + ' ms' : (ms / 1000).toFixed(2) + ' s';
  setText('b-elapsed', perfEnd ? txt + ' ✓' : txt);
}
