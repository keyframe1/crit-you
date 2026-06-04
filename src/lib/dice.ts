// Die definitions, geometry, and the shared roll model.
// Everything in the app keys off the `DieType` union and the `DICE` ordering.

export type DieType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d30" | "dinf";

export interface DieDef {
  type: DieType;
  max: number;
}

// Ordered low → high. This order is the order shown in the selector carousel.
// d∞ ("The Celestial") is a d100 rendered as a star sphere; it sits at the end.
export const DICE: DieDef[] = [
  { type: "d4", max: 4 },
  { type: "d6", max: 6 },
  { type: "d8", max: 8 },
  { type: "d10", max: 10 },
  { type: "d12", max: 12 },
  { type: "d20", max: 20 },
  { type: "d30", max: 30 },
  { type: "dinf", max: 100 },
];

export const DEFAULT_DIE: DieType = "d20";

// Display label (the celestial die shows the infinity glyph, not "DINF").
export function labelFor(type: DieType): string {
  return type === "dinf" ? "D∞" : type.toUpperCase();
}

export function maxFor(type: DieType): number {
  return DICE.find((d) => d.type === type)!.max;
}

// One roll, with everything downstream UI (result number, personality line,
// share card) needs. `line` is chosen once at roll time so the displayed
// personality text and the shared image always agree.
export interface Roll {
  id: number;
  value: number;
  max: number;
  dieType: DieType;
  line: string;
}

export function isNatMax(roll: Roll): boolean {
  return roll.value >= roll.max;
}

export function isNatMin(roll: Roll): boolean {
  return roll.value <= 1;
}

// SVG geometry, authored in a 160×160 viewBox centred on (80,80). Each polyhedral
// die is a SOLID object:
//   • `faces`  — opaque, closed facets that exactly tile the silhouette, each
//                shaded a different brightness of the signature colour (light
//                from the upper-left: `depth` 0 = darkest/facing away, 1 =
//                lightest/facing the light). Authored back-to-front (darkest
//                first) so nothing shows through.
//   • `edges`  — the internal facet boundaries, each drawn ONCE as a subtle
//                off-white line so the facets read without looking like a
//                wireframe. No die has a single hub where many edges converge.
//   • `polygons` — the outer silhouette only.
// The celestial d∞ does not use this model (it renders a star sphere instead),
// so its entry is intentionally empty.
export interface Face {
  points: string;
  depth: number;
}

export interface DieShape {
  polygons: string[];
  faces: Face[];
  edges: [number, number, number, number][];
}

export const SHAPES: Record<DieType, DieShape> = {
  // Tetrahedron — a precise equilateral triangle (circumradius 72, centroid at
  // the centre), three kite faces meeting at the centroid.
  d4: {
    polygons: ["80,8 142.35,116 17.65,116"],
    faces: [
      { points: "142.35,116 80,116 80,80 111.175,62", depth: 0.4 }, // bottom-right
      { points: "17.65,116 48.825,62 80,80 80,116", depth: 0.5 }, // bottom-left
      { points: "80,8 111.175,62 80,80 48.825,62", depth: 0.9 }, // top (lit)
    ],
    edges: [
      [80, 80, 111.175, 62],
      [80, 80, 48.825, 62],
      [80, 80, 80, 116],
    ],
  },
  // Cube — a regular hexagon with three spokes from the centre at exactly 120°
  // (top / left / right rhombic faces).
  d6: {
    polygons: ["80,8 142.35,44 142.35,116 80,152 17.65,116 17.65,44"],
    faces: [
      { points: "80,80 142.35,44 142.35,116 80,152", depth: 0.42 }, // right
      { points: "80,80 17.65,44 17.65,116 80,152", depth: 0.62 }, // left
      { points: "80,80 17.65,44 80,8 142.35,44", depth: 0.9 }, // top (lit)
    ],
    edges: [
      [80, 80, 17.65, 44],
      [80, 80, 142.35, 44],
      [80, 80, 80, 152],
    ],
  },
  // Octahedron — a diamond split by its two diagonals into four triangles.
  d8: {
    polygons: ["80,8 152,80 80,152 8,80"],
    faces: [
      { points: "80,80 152,80 80,152", depth: 0.35 }, // bottom-right
      { points: "80,80 80,152 8,80", depth: 0.5 }, // bottom-left
      { points: "80,8 152,80 80,80", depth: 0.62 }, // top-right
      { points: "80,8 80,80 8,80", depth: 0.9 }, // top-left (lit)
    ],
    edges: [
      [80, 80, 80, 8],
      [80, 80, 152, 80],
      [80, 80, 80, 152],
      [80, 80, 8, 80],
    ],
  },
  // Pentagonal trapezohedron — a bilaterally symmetric kite with a zig-zag girdle.
  d10: {
    polygons: ["80,8 136,72 80,152 24,72"],
    faces: [
      { points: "80,152 108,88 136,72", depth: 0.38 }, // bottom-right
      { points: "80,152 24,72 52,88", depth: 0.46 }, // bottom-left
      { points: "80,72 108,88 80,152 52,88", depth: 0.56 }, // front-centre
      { points: "80,8 80,72 108,88 136,72", depth: 0.64 }, // top-right
      { points: "80,8 24,72 52,88 80,72", depth: 0.9 }, // top-left (lit)
    ],
    edges: [
      [80, 8, 80, 72],
      [24, 72, 52, 88],
      [52, 88, 80, 72],
      [80, 72, 108, 88],
      [136, 72, 108, 88],
      [52, 88, 80, 152],
      [108, 88, 80, 152],
    ],
  },
  // Dodecahedron — a regular pentagon with an aligned inner pentagon: a central
  // face ringed by five trapezoids.
  d12: {
    polygons: ["80,8 148.5,57.8 122.3,138.2 37.7,138.2 11.5,57.8"],
    faces: [
      { points: "122.3,138.2 37.7,138.2 62.4,104.3 97.6,104.3", depth: 0.36 }, // bottom
      { points: "148.5,57.8 122.3,138.2 97.6,104.3 108.5,70.7", depth: 0.46 }, // right
      { points: "37.7,138.2 11.5,57.8 51.5,70.7 62.4,104.3", depth: 0.5 }, // bottom-left
      { points: "80,50 108.5,70.7 97.6,104.3 62.4,104.3 51.5,70.7", depth: 0.6 }, // centre
      { points: "80,8 148.5,57.8 108.5,70.7 80,50", depth: 0.7 }, // top-right
      { points: "11.5,57.8 80,8 80,50 51.5,70.7", depth: 0.9 }, // top-left (lit)
    ],
    edges: [
      [80, 50, 108.5, 70.7],
      [108.5, 70.7, 97.6, 104.3],
      [97.6, 104.3, 62.4, 104.3],
      [62.4, 104.3, 51.5, 70.7],
      [51.5, 70.7, 80, 50],
      [80, 8, 80, 50],
      [148.5, 57.8, 108.5, 70.7],
      [122.3, 138.2, 97.6, 104.3],
      [37.7, 138.2, 62.4, 104.3],
      [11.5, 57.8, 51.5, 70.7],
    ],
  },
  // Icosahedron — the rerollgaming.com hexagon (exact mandated points): a top
  // triangle, a four-facet equator band, and a bottom triangle. Faces above the
  // equator face up (lighter), below face down (darker). No central hub.
  d20: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    faces: [
      { points: "80,152 80,116 152,116", depth: 0.28 }, // floor-right
      { points: "80,152 8,116 80,116", depth: 0.32 }, // floor-left
      { points: "8,80 152,116 8,116", depth: 0.4 }, // band lower-left
      { points: "8,80 152,80 152,116", depth: 0.46 }, // band lower-right
      { points: "8,44 152,80 8,80", depth: 0.58 }, // band upper-left
      { points: "8,44 152,44 152,80", depth: 0.7 }, // band upper-right
      { points: "80,8 80,44 152,44", depth: 0.84 }, // roof-right
      { points: "80,8 8,44 80,44", depth: 0.92 }, // roof-left (lit)
    ],
    edges: [
      [80, 8, 80, 44], // roof seam
      [8, 44, 152, 44], // top of band
      [8, 44, 152, 80], // upper diagonal
      [8, 80, 152, 80], // equator
      [8, 80, 152, 116], // lower diagonal
      [8, 116, 152, 116], // bottom of band
      [80, 152, 80, 116], // floor seam
    ],
  },
  // Rhombic triacontahedron — the same hexagon, more finely faceted than the d20:
  // an inner hexagon of edge midpoints (split into two central faces by the
  // equator) ringed by six corner triangles. No central hub.
  d30: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    faces: [
      { points: "116,134 80,152 44,134", depth: 0.34 }, // corner bottom
      { points: "152,80 152,116 116,134", depth: 0.38 }, // corner lower-right
      { points: "8,80 152,80 116,134 44,134", depth: 0.42 }, // central lower
      { points: "44,134 8,116 8,80", depth: 0.5 }, // corner lower-left
      { points: "116,26 152,44 152,80", depth: 0.6 }, // corner upper-right
      { points: "8,80 44,26 116,26 152,80", depth: 0.7 }, // central upper
      { points: "44,26 80,8 116,26", depth: 0.82 }, // corner top
      { points: "8,80 8,44 44,26", depth: 0.92 }, // corner upper-left (lit)
    ],
    edges: [
      [8, 80, 44, 26],
      [44, 26, 116, 26],
      [116, 26, 152, 80],
      [152, 80, 116, 134],
      [116, 134, 44, 134],
      [44, 134, 8, 80],
      [8, 80, 152, 80], // equator
    ],
  },
  // The celestial d∞ renders a star sphere, not a polyhedron — no faces/edges.
  dinf: {
    polygons: [],
    faces: [],
    edges: [],
  },
};

// Off-white edge colour and weights: a subtle internal facet line and a slightly
// bolder outer silhouette.
export const DIE_STROKE = "#e8e4dc";
export const EDGE_WEIGHT = 1.5;
export const EDGE_OPACITY = 0.32;
export const SILHOUETTE_WEIGHT = 2.0;
export const SILHOUETTE_OPACITY = 0.45;

// Resolve a face's solid colour: a shade of the signature colour between 40%
// (darkest, facing away) and 90% (lightest, facing the light) brightness.
// `bright` lifts it ~10% for the hover state.
export function faceColor(hex: string, depth: number, bright = false): string {
  const base = 0.4 + 0.5 * depth;
  const f = bright ? base * 1.1 : base;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const c = (v: number) => Math.min(255, Math.round(v * f));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

// ─── Celestial d∞ geometry ──────────────────────────────────────────────────
// Stars and constellation lines for the celestial sphere, in the 160×160 viewBox
// (centred on (80,80), all within radius ~60). `o` is each star's base opacity.
export interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

export const CELESTIAL_STARS: Star[] = [
  { x: 80, y: 22, r: 1.6, o: 0.9 },
  { x: 50, y: 34, r: 1.0, o: 0.6 },
  { x: 110, y: 40, r: 1.5, o: 0.85 },
  { x: 35, y: 60, r: 1.0, o: 0.5 },
  { x: 65, y: 55, r: 2.0, o: 1.0 },
  { x: 95, y: 62, r: 1.1, o: 0.7 },
  { x: 124, y: 66, r: 1.4, o: 0.6 },
  { x: 45, y: 86, r: 1.6, o: 0.9 },
  { x: 80, y: 80, r: 1.0, o: 0.5 },
  { x: 115, y: 88, r: 1.5, o: 0.8 },
  { x: 31, y: 100, r: 1.0, o: 0.6 },
  { x: 60, y: 106, r: 1.5, o: 0.75 },
  { x: 95, y: 110, r: 1.1, o: 0.9 },
  { x: 128, y: 104, r: 1.0, o: 0.5 },
  { x: 50, y: 126, r: 1.5, o: 0.7 },
  { x: 84, y: 134, r: 1.0, o: 0.6 },
  { x: 110, y: 128, r: 1.4, o: 0.8 },
  { x: 72, y: 44, r: 1.0, o: 0.6 },
];

export const CELESTIAL_LINES: [number, number, number, number][] = [
  [80, 22, 65, 55],
  [65, 55, 95, 62],
  [65, 55, 45, 86],
  [95, 62, 115, 88],
  [110, 40, 95, 62],
  [45, 86, 60, 106],
  [60, 106, 95, 110],
  [95, 110, 110, 128],
  [115, 88, 95, 110],
  [45, 86, 31, 100],
  [50, 34, 65, 55],
  [95, 110, 84, 134],
];

// ─── Per-die animation character ────────────────────────────────────────────
// Every die is its OWN complete character. There is no shared FLOAT/TUMBLE base
// any more — each config below is written out in full so a die's float, tumble,
// celebration, and failure can be read (and tuned) as one self-contained
// personality. Dice.tsx is the generic interpreter that plays these configs.

export interface TweenStep {
  to?: Record<string, number>;
  keyframes?: Record<string, number[]>;
  set?: Record<string, number>;
  hold?: number;
  duration?: number;
  ease?: string;
  delay?: number;
}

// Idle float. The main timeline bobs Y (between -y/2 and +y/2) and eases the
// listed primary rotations from 0 → peak; the contact shadow rides the SAME
// timeline inverted. `jitter` is an independent, off-phase secondary oscillation
// (the d4's nervous twitch, the d20's offset sway) on a single axis.
export interface FloatConfig {
  y: number;
  duration: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  jitter?: {
    prop: "rotateZ" | "rotateX";
    amount: number;
    duration: number;
    delay?: number;
  };
}

// Two-phase roll tumble: a launch (p1) then a settle with a gentle overshoot.
export interface TumbleConfig {
  p1Dur: number;
  p1Ease: string;
  rotateZ: number; // ± random twist range during the launch
  scale: number; // squish at the bottom of the launch
  p2Dur: number;
  p2Ease: string;
}

// A distinct hover response per die (desktop hover / touch-hold).
export interface HoverConfig {
  scale: number; // CSS scale on hover
  ms: number; // transition duration in
  ease: string; // CSS timing function (e.g. "ease-out", "linear")
  glowAlpha: string; // hex alpha for the hover drop-shadow ("33" = ~20%)
  shadowColor?: string; // override the drop-shadow colour (else the signature)
  twitch?: boolean; // a quick nervous rotateZ wobble on hover-enter (d4)
}

export interface AnimConfig {
  color: string; // signature colour: face shades, glow, hover drop-shadow
  float: FloatConfig;
  tumble: TumbleConfig;
  glowOpacity: number; // peak opacity of the nat-max radial glow (d12/d20)
  glowScale: number; // end scale of that glow's expand
  celebrate: TweenStep[]; // body flourish on a natural max (empty = none)
  fail: TweenStep[]; // body flourish on a natural 1 (empty = none)
  hover: HoverConfig;
}

// d4 — fast, twitchy, nervous. Quick float with an off-rhythm rotateZ jitter; a
// sharp caltrop snap; a triple-vibrate celebration; a sulking tilt on a 1.
const D4_ANIM: AnimConfig = {
  color: "#c0392b",
  float: { y: 8, duration: 2.2, jitter: { prop: "rotateZ", amount: 0.5, duration: 1.1 } },
  tumble: { p1Dur: 0.3, p1Ease: "power3.in", rotateZ: 35, scale: 0.85, p2Dur: 0.35, p2Ease: "back.out(2)" },
  glowOpacity: 0,
  glowScale: 1.3,
  celebrate: [
    { keyframes: { scale: [1, 1.06, 1, 1.04, 1] }, duration: 0.5, ease: "power1.inOut" },
  ],
  fail: [
    { to: { rotateZ: 12 }, duration: 0.25, ease: "power3.out" },
    { to: { rotateZ: 0 }, duration: 0.4, delay: 0.8, ease: "power2.inOut" },
  ],
  hover: { scale: 1.04, ms: 300, ease: "ease-out", glowAlpha: "33", twitch: true },
};

// d6 — slow, steady, boring and reliable. No rotation at all; an even tumble; a
// restrained golf-clap on a 6; and on a 1, nothing whatsoever.
const D6_ANIM: AnimConfig = {
  color: "#8a8880",
  float: { y: 5, duration: 4.0 },
  tumble: { p1Dur: 0.5, p1Ease: "power1.in", rotateZ: 10, scale: 0.85, p2Dur: 0.5, p2Ease: "power2.out" },
  glowOpacity: 0,
  glowScale: 1.3,
  celebrate: [
    { keyframes: { scale: [1, 1.03, 1] }, duration: 0.3, ease: "power2.inOut" },
  ],
  fail: [],
  hover: { scale: 1.02, ms: 300, ease: "ease-out", glowAlpha: "22" },
};

// d8 — eager, bouncy, friendly. A medium float with an eager rotateX lean; an
// over-bouncing tumble; a happy-puppy double hop on an 8; a nervous wobble on a 1.
const D8_ANIM: AnimConfig = {
  color: "#2a9d8f",
  float: { y: 7, duration: 3.0, rotateX: 2 },
  tumble: { p1Dur: 0.45, p1Ease: "power2.in", rotateZ: 20, scale: 0.85, p2Dur: 0.5, p2Ease: "back.out(3)" },
  glowOpacity: 0,
  glowScale: 1.3,
  celebrate: [
    { keyframes: { y: [0, -15, 0, -15, 0] }, duration: 0.5, ease: "power2.out" },
  ],
  fail: [
    { keyframes: { rotateZ: [0, -4, 4, -4, 4, -4, 4, -4, 4, 0] }, duration: 0.5, ease: "sine.inOut" },
  ],
  hover: { scale: 1.05, ms: 200, ease: "ease-out", glowAlpha: "33" },
};

// d10 — precise, mechanical, clinical. Clean Y-only bob; a controlled tumble with
// minimal overshoot. Its celebration and failure live on the result NUMBER (a
// green tint / a glitchy flicker), so the body steps here are intentionally empty.
const D10_ANIM: AnimConfig = {
  color: "#27ae60",
  float: { y: 6, duration: 3.2 },
  tumble: { p1Dur: 0.45, p1Ease: "power2.in", rotateZ: 8, scale: 0.88, p2Dur: 0.45, p2Ease: "back.out(1.5)" },
  glowOpacity: 0,
  glowScale: 1.3,
  celebrate: [],
  fail: [],
  hover: { scale: 1.04, ms: 250, ease: "linear", glowAlpha: "33" },
};

// d12 — dramatic, attention-seeking. A big sweeping float with a rotateZ sway; a
// theatrical, slow tumble with a deep squish; a huge held pulse + doubled glow on
// a 12; a deflated freeze-then-sink on a 1.
const D12_ANIM: AnimConfig = {
  color: "#d4a843",
  float: { y: 10, duration: 3.5, rotateZ: 2 },
  tumble: { p1Dur: 0.55, p1Ease: "power2.in", rotateZ: 30, scale: 0.8, p2Dur: 0.65, p2Ease: "back.out(2.5)" },
  glowOpacity: 0.9,
  glowScale: 1.5,
  celebrate: [
    { to: { scale: 1.15 }, duration: 0.2, ease: "power2.out" },
    { to: { scale: 1 }, duration: 0.5, delay: 0.2, ease: "back.out(2)" },
  ],
  fail: [
    { hold: 0.6 },
    { to: { y: 5 }, duration: 0.8, ease: "power2.out" },
  ],
  hover: { scale: 1.08, ms: 300, ease: "ease-out", glowAlpha: "66" },
};

// d20 — THE benchmark (the rerollgaming.com feel). A balanced float: rotateX with
// an off-phase rotateZ jitter. A smooth, weighted, satisfying tumble. A confident
// scale overshoot + radial glow on a 20; the classic number shake on a 1.
const D20_ANIM: AnimConfig = {
  color: "#c0392b",
  float: { y: 8, duration: 3.5, rotateX: 2, jitter: { prop: "rotateZ", amount: 1, duration: 3.5, delay: 1.75 } },
  tumble: { p1Dur: 0.5, p1Ease: "power2.in", rotateZ: 20, scale: 0.85, p2Dur: 0.55, p2Ease: "back.out(2)" },
  glowOpacity: 0.5,
  glowScale: 1.4,
  celebrate: [
    { keyframes: { scale: [1, 1.08, 1] }, duration: 0.5, ease: "power2.inOut" },
  ],
  fail: [],
  hover: { scale: 1.03, ms: 400, ease: "ease-out", glowAlpha: "40", shadowColor: "#e74c3c" },
};

// d30 — slow and regal. Everything unhurried: a slow float with a gentle rotateY;
// a grand, slow tumble; a slow held pulse on a 30; a stunned, motionless freeze on
// a 1 (the idle simply pauses, then resumes).
const D30_ANIM: AnimConfig = {
  color: "#8e44ad",
  float: { y: 6, duration: 4.5, rotateY: 1.5 },
  tumble: { p1Dur: 0.6, p1Ease: "power2.in", rotateZ: 15, scale: 0.85, p2Dur: 0.7, p2Ease: "back.out(1.8)" },
  glowOpacity: 0,
  glowScale: 1.3,
  celebrate: [
    { to: { scale: 1.1 }, duration: 0.4, ease: "power2.inOut" },
    { to: { scale: 1 }, duration: 0.5, delay: 0.3, ease: "power2.inOut" },
  ],
  fail: [{ hold: 1.5 }],
  hover: { scale: 1.04, ms: 500, ease: "ease-out", glowAlpha: "33" },
};

// The celestial d∞. Its roll, celebration, and failure are special-cased in
// Dice.tsx (a slow majestic spin; stars flash / dim), so the tumble and
// celebrate/fail steps here are unused placeholders. Its float is ethereal and
// very slow; the stars twinkle on their own clocks.
const DINF_ANIM: AnimConfig = {
  color: "#94b8ff",
  float: { y: 12, duration: 5.0, rotateY: 1 },
  tumble: { p1Dur: 0.5, p1Ease: "power2.in", rotateZ: 0, scale: 0.85, p2Dur: 0.55, p2Ease: "back.out(2)" },
  glowOpacity: 0,
  glowScale: 1.3,
  celebrate: [],
  fail: [],
  hover: { scale: 1.03, ms: 400, ease: "ease-out", glowAlpha: "40" },
};

// d20 is the benchmark every other die is tuned against.
export const DEFAULT_ANIM: AnimConfig = D20_ANIM;

export const ANIM: Record<DieType, AnimConfig> = {
  d4: D4_ANIM,
  d6: D6_ANIM,
  d8: D8_ANIM,
  d10: D10_ANIM,
  d12: D12_ANIM,
  d20: D20_ANIM,
  d30: D30_ANIM,
  dinf: DINF_ANIM,
};

export function animFor(type: DieType): AnimConfig {
  return ANIM[type];
}
