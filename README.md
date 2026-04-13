# SAP-1 CPU Simulator

> **Live Demo:** *(coming soon — Vercel link will be added here)*

A cycle-accurate, browser-based simulator of the SAP-1 (Simple As Possible) 8-bit CPU, built entirely in vanilla HTML, CSS, and JavaScript. No frameworks. No build tools. Just open `index.html`.

---

## What is SAP-1?

**SAP** stands for **Simple As Possible**. The SAP-1 is an educational 8-bit CPU architecture designed by Albert Paul Malvino and Jerald A. Brown in their textbook *Digital Computer Electronics* (1977). It's not a real commercial chip — it was purpose-built to teach how a CPU works from first principles: registers, buses, control signals, clock cycles, and memory, all the way down to the gate level.

The design became widely known through **Ben Eater's YouTube series**, where he built a working SAP-1 on breadboards using 74HC-series logic chips. His videos are one of the clearest explanations of computer architecture I've ever seen, and this simulator is heavily inspired by that work.

---

## Thought Process

I wanted to understand how a CPU *actually* works — not just at the high level of "fetch, decode, execute," but at the level of individual clock cycles. What control signals fire at T2? What's on the data bus when the MAR latches? How does the ALU know when to subtract instead of add?

The SAP-1 is perfect for this because it's small enough to reason about completely, but realistic enough to teach real concepts. Instead of just watching Ben's videos, I decided to build a simulator so I could step through programs one T-state at a time and see every register, flag, and control signal update in real time.

### How it was built

I started with the CPU architecture itself — the state machine, T-states, and ISA — then layered the assembler on top so I could write programs in human-readable assembly instead of raw hex. The UI came last: I wanted it to look like something that *belongs next to a breadboard*, so I went with a terminal/cyberpunk aesthetic — dark background, monospace fonts, glowing cyan and green elements.

The whole thing is split into three JavaScript files with no module system:

- **`js/cpu.js`** — CPU state, T-state execution logic, clock, control signals
- **`js/assembler.js`** — two-pass assembler: text → RAM array, with label support
- **`js/ui.js`** — all DOM rendering: registers, RAM grid, execution log, bus animations

---

## Architecture

The SAP-1 has a minimal but complete architecture:

| Component | Description |
|---|---|
| **8-bit data bus** | Connects all registers and RAM |
| **4-bit PC** | Program counter — addresses 0–15 |
| **4-bit MAR** | Memory address register |
| **16 × 8-bit RAM** | The entire program + data lives here |
| **8-bit IR** | Instruction register (top 4 bits = opcode, bottom 4 = operand) |
| **8-bit A** | Accumulator |
| **8-bit B** | B register (ALU second operand) |
| **8-bit ALU** | Adds or subtracts A and B |
| **Zero / Carry flags** | Set by ADD and SUB, used by JZ and JC |
| **8-bit OUT** | Output register — drives the display |
| **Control logic** | Generates 15 control signals based on opcode + T-state |

Each instruction takes up to **6 T-states**: T1–T2 are always FETCH (load instruction from RAM into IR), T3–T6 are EXECUTE (varies by instruction).

---

## Instruction Set

| Instruction | Encoding | Operation |
|---|---|---|
| `LDA n` | `0000 nnnn` | A ← RAM[n] |
| `ADD n` | `0001 nnnn` | A ← A + RAM[n] — sets Z, C flags |
| `SUB n` | `0010 nnnn` | A ← A − RAM[n] — sets Z, C flags |
| `STA n` | `0011 nnnn` | RAM[n] ← A |
| `LDI n` | `0100 nnnn` | A ← n (immediate, 4-bit) |
| `JMP n` | `0101 nnnn` | PC ← n |
| `JC n` | `0110 nnnn` | if Carry=1: PC ← n |
| `JZ n` | `0111 nnnn` | if Zero=1: PC ← n |
| `OUT` | `1110 0000` | OUT ← A |
| `HLT` | `1111 0000` | Halt the clock |

---

## Assembly Language

The assembler supports labels, inline comments, and a `.data` directive for initialising memory:

```asm
LDA 14      ; A ← RAM[14] = 28
ADD 15      ; A ← A + RAM[15] = 28 + 14 = 42
OUT         ; OUT register ← A  (display shows 42)
HLT         ; stop the clock
.data 14: 28
.data 15: 14
```

```asm
LDA 14
loop: SUB 15    ; A ← A - 1
      JZ end    ; if zero, jump to end
      JMP loop  ; otherwise loop
end:  OUT
      HLT
.data 14: 3
.data 15: 1
```

---

## How to Use

1. Write or paste assembly into the editor, or pick one of the built-in examples from the dropdown
2. Click **ASSEMBLE & LOAD** — the code compiles and loads into RAM (shown in the grid)
3. Use **STEP** to advance one T-state at a time — watch every register update live
4. Use **RUN** to execute automatically at the selected speed
5. Drag the speed slider to go from 0.5 Hz up to 64 Hz
6. Click any RAM cell to edit its value directly
7. Click **RESET** to reload the assembled program and start over
8. Click **?** in the header for a full in-app guide

Comments after `;` are stripped by the assembler and never affect execution.

---

## Design & CSS Inspiration

The aesthetic is deliberately **retro-terminal / cyberpunk** — the kind of thing that looks like it belongs on a monitor next to a breadboard.

Key design decisions and where they came from:

- **Color palette** — cyan (`#00d4ff`), green (`#39ff14`), amber (`#ffaa00`), orange (`#ff7700`), red (`#ff2244`) against a near-black background (`#080c10`). This maps directly to old CRT monitor phosphor colors: green and amber were the two dominant monochrome phosphors of 1970s–80s terminals. Cyan is the color of choice in a lot of retro-computing and hacker aesthetics (think *WarGames*, *Tron*, old Motorola datasheets).

- **Fonts** — [`Share Tech Mono`](https://fonts.google.com/specimen/Share+Tech+Mono) for data and code (a clean, readable monospace with a slightly military feel) and [`Orbitron`](https://fonts.google.com/specimen/Orbitron) for labels and headers (a geometric sans-serif that reads as "sci-fi hardware" without being unreadable). Both from Google Fonts.

- **Glow effects** — `text-shadow` and `box-shadow` layered with the accent color to simulate neon/phosphor glow. A thin sharp shadow at 8px plus a wide soft shadow at 20px gives a convincing bloom effect without being garish.

- **Grid background** — a CSS `linear-gradient` grid on the `<body>` at 40×40px gives the "engineering graph paper" texture that reads as technical without being distracting.

- **General aesthetic** — inspired by a mix of: Ben Eater's clean hardware aesthetic, cyberpunk game UIs (*Deus Ex*, *Cyberpunk 2077* terminal screens), old oscilloscope and logic analyser displays, and NASA/JPL mission control readout panels.

---

## Resources

- **Ben Eater's SAP-1 series** — [youtube.com/@BenEater](https://www.youtube.com/@BenEater) — the breadboard build that started all of this
- ***Digital Computer Electronics*** — Malvino & Brown, 1977 — the original SAP-1 textbook
- **Google Fonts** — [fonts.google.com](https://fonts.google.com) — Share Tech Mono, Orbitron
- **MDN Web Docs** — [developer.mozilla.org](https://developer.mozilla.org) — reference for CSS custom properties, webkit scrollbar styling, SVG

---

## Project Structure

```
index.html          HTML shell — all markup, links scripts and styles
css/
  styles.css        All styles — theme variables, layout, animations
js/
  cpu.js            CPU state machine, T-state logic, clock, control signals
  assembler.js      Two-pass assembler: source text → 16-byte RAM array
  ui.js             DOM rendering, register display, bus animation, event wiring
```

---

*Built to learn. If you're here because you also watched Ben's videos and fell down the rabbit hole — welcome.*
