// World News poster for Friday 20 November 2026 (Node 22, stdlib only).
//
// main.ts draws the day's front page in code and writes it to
// /output/entry.png: a 1024x1024 newspaper poster with five stories from
// 20 November 2026, each checked against live news the same morning.
// The output is fully deterministic: two runs write byte-identical PNGs.
// PNG encoding is done by hand (zlib deflate, no filtering) and all text
// is set in a 5x7 pixel font whose glyphs are stored as bit rows, so no
// headline can ever come out garbled.
//
// The five stories:
//  1. The International Court of Justice rules Myanmar committed
//     genocide against the Rohingya, the first time a state is held
//     responsible for genocide; about 10,000 killed in 2017.
//  2. Trump says there is no rush on Iran: the decision waits until
//     2027, he will "see what happens" after 1 January.
//  3. A Houthi missile hits Riyadh's tallest tower, the PIF Tower:
//     windows blown out across seven or eight floors, no one hurt.
//  4. Cyclone Akvan makes landfall near Gopalpur in Odisha, winds
//     90-100 km/h, tens of thousands evacuated to shelters.
//  5. NASA confirms Voyager 1 is now a light-day from Earth: a radio
//     signal takes a full day to reach the 1977 probe.
//
// Local run (same as the grader):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ------------------------------------------------------------ colours ---

type RGB = [number, number, number];

const PAPER: RGB = [242, 231, 201];
const INK: RGB = [27, 42, 74];
const GOLD: RGB = [232, 168, 28];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [16, 16, 20];
const SKY: RGB = [214, 228, 240];
const NAVY2: RGB = [34, 53, 94];
const NAVY3: RGB = [46, 74, 122];

// ------------------------------------------------------------ canvas ----

const px = new Uint8Array(W * H * 3);

function put(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fill(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function frame(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  fill(x, y, w, t, c);
  fill(x, y + h - t, w, t, c);
  fill(x, y, t, h, c);
  fill(x + w - t, y, t, h, c);
}

function hline(x: number, y: number, len: number, c: RGB): void {
  fill(x, y, len, 1, c);
}

function vline(x: number, y: number, len: number, c: RGB): void {
  fill(x, y, 1, len, c);
}

// Bresenham line, any slope.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    put(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Filled disc centred on (cx, cy).
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy += 1) {
    const span = Math.floor(Math.sqrt(r * r - dy * dy));
    fill(cx - span, cy + dy, span * 2 + 1, 1, c);
  }
}

// Upper half of a filled disc (dome shape).
function dome(cx: number, baseY: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= 0; dy += 1) {
    const span = Math.floor(Math.sqrt(r * r - dy * dy));
    fill(cx - span, baseY + dy, span * 2 + 1, 1, c);
  }
}

// Filled triangle through three points, scanline by scanline.
function triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB): void {
  const minY = Math.min(ay, by, cy);
  const maxY = Math.max(ay, by, cy);
  for (let y = minY; y <= maxY; y += 1) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [
      [ax, ay, bx, by],
      [bx, by, cx, cy],
      [cx, cy, ax, ay],
    ];
    for (const [x1, y1, x2, y2] of edges) {
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.floor(Math.min(...xs));
      const hi = Math.ceil(Math.max(...xs));
      fill(lo, y, hi - lo + 1, 1, c);
    }
  }
}

// ------------------------------------------------------------ PNG out ---

function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let v = n;
    for (let k = 0; k < 8; k += 1) {
      v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    }
    table[n] = v >>> 0;
  }
  return table;
}

const CRC = crcTable();

function crc32(data: Buffer): number {
  let v = 0xffffffff;
  for (const byte of data) v = CRC[(v ^ byte) & 0xff] ^ (v >>> 8);
  return (v ^ 0xffffffff) >>> 0;
}

function chunk(tag: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(payload.length, 0);
  head.write(tag, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tag, "ascii"), payload])), 0);
  return Buffer.concat([head, payload, tail]);
}

function writePng(path: string): void {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y += 1) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

// ------------------------------------------------------------ the font ---
//
// A 5x7 pixel font, drawn from scratch for this poster. Each glyph is
// seven rows of five bits, "#" set and "." clear. All copy on the poster
// is set in capitals, so only capitals, digits and a few marks are cut.

const GLYPHS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", ".#...", "#...."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
};

function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * scale - scale;
}

function drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of text) {
    const glyph = GLYPHS[ch] ?? GLYPHS["?"];
    for (let row = 0; row < 7; row += 1) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col += 1) {
        if (bits[col] === "#") fill(cx + col * scale, y + row * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function drawCentred(cx: number, y: number, text: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}

// Greedy word wrap: returns lines that fit maxW pixels at this scale.
function wrap(text: string, maxW: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur === "" ? word : cur + " " + word;
    if (textWidth(next, scale) <= maxW || cur === "") {
      cur = next;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ------------------------------------------------------------ scenes ----
//
// Each story gets one small drawn scene. All coordinates are relative
// to the panel the scene fills.

// Lead scene: scales of justice between two courthouse columns.
function sceneJustice(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, Math.floor(h * 0.38), [30, 44, 80]);
  fill(x, y + Math.floor(h * 0.38), w, Math.floor(h * 0.34), [39, 64, 110]);
  fill(x, y + Math.floor(h * 0.72), w, h - Math.floor(h * 0.72), [46, 74, 122]);
  const cx = x + Math.floor(w / 2);
  const ground = y + h - 12;
  const stone: RGB = [216, 205, 178];
  const stoneDark: RGB = [178, 164, 132];
  // Flanking columns.
  for (const colX of [x + 96, x + w - 96 - 30]) {
    fill(colX - 5, y + 34, 40, 8, stone);
    fill(colX, y + 42, 30, ground - y - 42 - 10, stone);
    fill(colX - 5, ground - 10, 40, 10, stoneDark);
  }
  // The scales.
  const postTop = y + 16;
  fill(cx - 3, postTop + 8, 6, ground - postTop - 8, GOLD);
  disc(cx, postTop, 6, GOLD);
  fill(cx - 132, postTop + 12, 264, 6, GOLD);
  for (const side of [-1, 1]) {
    const beamX = cx + side * 120;
    line(beamX, postTop + 18, beamX - 26, postTop + 52, GOLD);
    line(beamX, postTop + 18, beamX + 26, postTop + 52, GOLD);
    triangle(beamX - 40, postTop + 52, beamX + 40, postTop + 52, beamX, postTop + 84, GOLD);
    hline(beamX - 40, postTop + 52, 81, GOLD);
  }
  fill(x, ground, w, 12, [24, 34, 62]);
}

// Capitol dome on a pale sky, for the Washington story.
function sceneDome(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, SKY);
  const cx = x + Math.floor(w / 2);
  const baseY = y + h - 10;
  fill(x, baseY, w, 10, [138, 151, 163]);
  fill(cx - 150, baseY - 16, 300, 16, INK);
  fill(cx - 70, baseY - 34, 140, 18, INK);
  dome(cx, baseY - 34, 58, INK);
  fill(cx - 3, baseY - 34 - 58 - 14, 6, 14, INK);
  disc(cx, baseY - 34 - 58 - 16, 3, INK);
  fill(cx - 96, baseY - 34, 12, 34, [120, 134, 150]);
  fill(cx + 84, baseY - 34, 12, 34, [120, 134, 150]);
}

// Dusk skyline with the tall tower, smoke curling from its top.
function sceneTower(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, 30, [242, 178, 94]);
  fill(x, y + 30, w, 30, [217, 123, 63]);
  fill(x, y + 60, w, h - 60, [138, 74, 94]);
  const cx = x + Math.floor(w / 2);
  const ground = y + h;
  const block: RGB = [42, 47, 69];
  fill(x + 8, ground - 34, 52, 34, block);
  fill(x + 70, ground - 22, 44, 22, block);
  fill(x + w - 118, ground - 28, 48, 28, block);
  fill(x + w - 62, ground - 18, 54, 18, block);
  // The tower itself.
  const top = y + 24;
  fill(cx - 22, top, 44, ground - top, [35, 40, 56]);
  fill(cx - 26, top - 6, 52, 6, [35, 40, 56]);
  // Lit windows in a grid, three left dark where they blew out.
  const lit: RGB = [255, 217, 122];
  const broken = new Set(["1,2", "2,4", "0,5"]);
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if (broken.has(c + "," + r)) continue;
      fill(cx - 15 + c * 11, top + 10 + r * 9, 5, 4, lit);
    }
  }
  // Smoke drifting up and right from the roof.
  disc(cx + 26, y + 12, 7, [185, 179, 168]);
  disc(cx + 40, y + 6, 9, [168, 162, 148]);
  disc(cx + 56, y + 10, 6, [151, 145, 127]);
  fill(x, ground - 4, w, 4, [24, 28, 46]);
}

// Cyclone spiral over the coast, with rain and two small houses.
function sceneCyclone(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, [199, 211, 222]);
  const cx = x + Math.floor(w / 2) - 40;
  const cy = y + 46;
  for (let t = 0; t < 4.6 * Math.PI; t += 0.12) {
    const r = 4 + 2.1 * t;
    const px2 = Math.round(cx + r * Math.cos(t));
    const py2 = Math.round(cy + r * Math.sin(t) * 0.72);
    fill(px2 - 1, py2 - 1, 3, 3, WHITE);
  }
  disc(cx, cy, 5, [31, 122, 109]);
  const rain: RGB = [125, 148, 168];
  for (let i = 0; i < 10; i += 1) {
    const rx = x + 300 + i * 16;
    const ry = y + 8 + (i % 3) * 22;
    line(rx, ry, rx - 6, ry + 12, rain);
  }
  // Coastline and houses at the bottom right.
  fill(x, y + h - 16, w, 16, [90, 107, 125]);
  fill(x + w - 120, y + h - 34, 26, 18, [70, 84, 100]);
  triangle(x + w - 124, y + h - 34, x + w - 90, y + h - 34, x + w - 107, y + h - 46, [70, 84, 100]);
  fill(x + w - 76, y + h - 30, 20, 14, [70, 84, 100]);
  triangle(x + w - 79, y + h - 30, x + w - 53, y + h - 30, x + w - 66, y + h - 40, [70, 84, 100]);
}

// Voyager 1 in a starfield, its signal running back to Earth.
function sceneVoyager(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, [10, 14, 26]);
  // Fixed-seed stars, so both runs draw the same sky.
  let seed = 20261120;
  const next = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 48; i += 1) {
    const sx = x + 6 + Math.floor(next() * (w - 12));
    const sy = y + 4 + Math.floor(next() * (h - 12));
    const s = next() > 0.85 ? 2 : 1;
    fill(sx, sy, s, s, next() > 0.8 ? GOLD : WHITE);
  }
  // Earth, bottom left.
  const ex = x + 42;
  const ey = y + h - 22;
  disc(ex, ey, 10, [63, 111, 181]);
  disc(ex - 3, ey - 3, 3, [120, 170, 220]);
  // Signal line to the probe.
  const probeX = x + w - 96;
  const probeY = y + 30;
  line(ex + 8, ey - 6, probeX - 14, probeY + 6, GOLD);
  // The probe: dish, body, boom.
  fill(probeX - 10, probeY, 22, 12, [216, 178, 94]);
  triangle(probeX - 30, probeY - 6, probeX - 30, probeY + 18, probeX - 10, probeY + 6, [216, 178, 94]);
  line(probeX + 12, probeY + 6, probeX + 30, probeY + 2, [216, 178, 94]);
  disc(probeX + 32, probeY + 2, 2, [216, 178, 94]);
}

// ------------------------------------------------------------ layout ----

function mustFit(line: string, scale: number, maxW: number): void {
  if (textWidth(line, scale) > maxW) {
    throw new Error("line too wide: " + line);
  }
}

interface Cell {
  kicker: string;
  kickerColor: RGB;
  headline: string[];
  deck: string[];
  scene: (x: number, y: number, w: number, h: number) => void;
}

function drawCell(x0: number, y0: number, cell: Cell): void {
  const w = 476;
  const h = 220;
  frame(x0, y0, w, h, 3, INK);
  fill(x0 + 3, y0 + 3, w - 6, 30, cell.kickerColor);
  drawText(x0 + 14, y0 + 11, cell.kicker, 2, WHITE);
  cell.scene(x0 + 3, y0 + 33, w - 6, 88);
  let ty = y0 + 131;
  for (const line of cell.headline) {
    mustFit(line, 3, 446);
    drawText(x0 + 15, ty, line, 3, INK);
    ty += 25;
  }
  ty += 6;
  for (const line of cell.deck) {
    mustFit(line, 2, 446);
    drawText(x0 + 15, ty, line, 2, [70, 70, 70]);
    ty += 17;
  }
}

function drawPage(): void {
  fill(0, 0, W, H, PAPER);

  // Masthead.
  fill(0, 0, W, 148, INK);
  drawCentred(512, 16, "WORLD NEWS", 10, WHITE);
  fill(120, 100, 784, 4, GOLD);
  drawCentred(512, 112, "FRIDAY - 20 NOVEMBER 2026", 4, GOLD);

  // Lead story: the world court ruling.
  frame(24, 164, 976, 340, 4, INK);
  sceneJustice(28, 168, 968, 224);
  fill(28, 392, 968, 108, INK);
  drawCentred(512, 406, "MYANMAR GUILTY OF GENOCIDE", 5, WHITE);
  drawCentred(512, 458, "WORLD COURT: FIRST STATE HELD RESPONSIBLE - 10,000 KILLED IN 2017", 2, GOLD);

  // Four more stories in a grid.
  const cells: Cell[] = [
    {
      kicker: "WASHINGTON",
      kickerColor: [47, 93, 138],
      headline: ["TRUMP: NO RUSH ON IRAN"],
      deck: ["DECISION WAITS UNTIL 2027"],
      scene: sceneDome,
    },
    {
      kicker: "RIYADH",
      kickerColor: [179, 64, 42],
      headline: ["MISSILE HITS RIYADH'S", "TALLEST TOWER"],
      deck: ["HOUTHI STRIKE DAMAGES PIF TOWER", "WINDOWS BLOWN OUT, NO ONE HURT"],
      scene: sceneTower,
    },
    {
      kicker: "ODISHA",
      kickerColor: [31, 122, 109],
      headline: ["CYCLONE AKVAN", "HITS ODISHA"],
      deck: ["LANDFALL NEAR GOPALPUR AT NOON", "TENS OF THOUSANDS EVACUATED"],
      scene: sceneCyclone,
    },
    {
      kicker: "SPACE",
      kickerColor: [91, 58, 140],
      headline: ["VOYAGER 1", "A LIGHT-DAY AWAY"],
      deck: ["NASA: A SIGNAL NOW TAKES A DAY", "TO REACH THE 1977 PROBE"],
      scene: sceneVoyager,
    },
  ];
  drawCell(24, 520, cells[0]);
  drawCell(524, 520, cells[1]);
  drawCell(24, 756, cells[2]);
  drawCell(524, 756, cells[3]);

  // Footer.
  drawCentred(512, 988, "WORLD NEWS - FRIDAY 20 NOVEMBER 2026 - FIVE STORIES, ONE DAY", 2, INK);
}

// ------------------------------------------------------------ main ------

function main(): void {
  drawPage();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writePng(join(outDir, "entry.png"));
}

main();
