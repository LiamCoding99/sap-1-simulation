// ─── EXAMPLES ────────────────────────────────────────────────────────────────
const EXAMPLES = {
  add: [
    'LDA 14      ; A ← RAM[14] = 28',
    'ADD 15      ; A ← A + RAM[15] = 28 + 14 = 42',
    'OUT         ; OUT register ← A (display shows 42)',
    'HLT         ; stop the clock',
    '.data 14: 28 ; store 28 at address 14',
    '.data 15: 14 ; store 14 at address 15',
  ].join('\n'),

  sub: [
    'LDA 14      ; A ← RAM[14] = 30',
    'SUB 15      ; A ← A - RAM[15] = 30 - 12 = 18',
    'OUT         ; OUT register ← A (display shows 18)',
    'HLT         ; stop the clock',
    '.data 14: 30 ; minuend: 30',
    '.data 15: 12 ; subtrahend: 12',
  ].join('\n'),

  count: [
    'LDI 0       ; A ← 0  (start counter at zero)',
    'loop: OUT   ; OUT ← A  (display current count)',
    '      ADD 15 ; A ← A + 1  (increment)',
    '      JMP loop ; jump back — counts up forever',
    '.data 15: 1  ; increment step = 1',
  ].join('\n'),

  countdown: [
    'LDA 14      ; A ← RAM[14] = 10  (start value)',
    'loop: OUT   ; OUT ← A  (display current value)',
    '      SUB 15 ; A ← A - 1  (decrement)',
    '      JZ end ; zero flag set? → jump to end',
    '      JMP loop ; not zero yet → loop back',
    'end:  OUT   ; OUT ← 0  (display final zero)',
    '      HLT   ; stop the clock',
    '.data 14: 10 ; countdown start = 10',
    '.data 15: 1  ; decrement step = 1',
  ].join('\n'),

  store: [
    'LDI 42      ; A ← 42  (load immediate value)',
    'STA 15      ; RAM[15] ← A  (save 42 to memory)',
    'LDI 0       ; A ← 0  (clear the accumulator)',
    'LDA 15      ; A ← RAM[15] = 42  (reload from memory)',
    'OUT         ; OUT ← A  (display shows 42)',
    'HLT         ; stop the clock',
  ].join('\n'),
};

// ─── CORE ASSEMBLER (pure — no DOM access) ───────────────────────────────────
function assembleCode(src) {
  const lines  = src.split('\n');
  const ram    = new Array(16).fill(0);
  const errors = [], output = [], labels = {}, passes = [];
  const localProgramAddrs = new Set();
  let addr = 0;

  // First pass — collect labels, queue instructions
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/;.*/, '').trim();
    if (!line) continue;

    if (line.startsWith('.data')) {
      const m = line.match(/\.data\s+(\d+)\s*:\s*(\d+)/);
      if (m) passes.push({ type: 'data', addr: parseInt(m[1]), val: parseInt(m[2]), lineNo: i });
      continue;
    }

    if (line.includes(':')) {
      const colonIdx = line.indexOf(':');
      const lbl  = line.slice(0, colonIdx).trim();
      labels[lbl] = addr;
      line = line.slice(colonIdx + 1).trim();
      if (!line) continue;
    }

    passes.push({ type: 'instr', line, lineNo: i, addr: addr++ });
  }

  // Second pass — encode
  for (const p of passes) {
    if (p.type === 'data') {
      if (p.addr > 15) { errors.push(`Line ${p.lineNo + 1}: Address ${p.addr} out of range`); continue; }
      ram[p.addr] = p.val & 0xFF;
      output.push({ addr: p.addr, val: ram[p.addr], mnem: `.data ${p.val}`, isData: true });
      continue;
    }

    const parts  = p.line.split(/\s+/);
    const mnem   = parts[0].toUpperCase();
    const opcode = OPCODES[mnem];
    if (opcode === undefined) { errors.push(`Line ${p.lineNo + 1}: Unknown instruction '${mnem}'`); continue; }

    let operand = 0;
    if (parts[1]) {
      const raw = parts[1].trim();
      operand = labels[raw] !== undefined ? labels[raw] : (parseInt(raw, 10) || 0);
      if (operand > 15) errors.push(`Line ${p.lineNo + 1}: Operand ${operand} out of range (0–15)`);
    }

    const byte = ((opcode & 0xF) << 4) | (operand & 0xF);
    if (p.addr <= 15) {
      ram[p.addr] = byte;
      localProgramAddrs.add(p.addr);
      output.push({ addr: p.addr, val: byte, mnem: `${mnem} ${parts[1] || ''}`.trim(), isData: false });
    }
  }

  return { ram, errors, output, programAddrs: localProgramAddrs };
}

// ─── DOM-BOUND ASSEMBLER ──────────────────────────────────────────────────────
function assemble() {
  const src = document.getElementById('code-editor').value;
  const { ram, errors, output, programAddrs: pa } = assembleCode(src);
  cpuState.ram = ram;
  programAddrs = pa;
  renderAsmOutput(output, errors);
  renderRAM();
  return { ram, errors };
}
