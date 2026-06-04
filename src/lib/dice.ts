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

// Which dice have a real Three.js 3D mesh yet. Everything else still renders as
// the legacy flat SVG die. This grows by one entry each time a die is ported to
// 3D; page.tsx uses it to route between <DiceCanvas> (3D) and <Dice> (SVG).
export const DICE_3D: ReadonlySet<DieType> = new Set<DieType>(["d20"]);

export function is3DDie(type: DieType): boolean {
  return DICE_3D.has(type);
}

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

// SVG geometry, authored in a 160×160 viewBox centred on (80,80). This is a
// WIREFRAME-FIRST model (matching the reroll d20): every die is drawn in two
// layers —
//   • `fills`     — translucent signature-colour face polygons drawn BEHIND the
//                   wireframe, at low opacity (~0.12–0.25) so they read as a
//                   subtle depth wash, never hiding the lines. They tile the
//                   silhouette using the wireframe's own vertices.
//   • `outline`   — the outer silhouette, the heavy wire (stroke 2.2, dark ink).
//   • `wireLines` — the internal triangulation, the light wire (stroke 1.0).
// The lines define the shape and are ALWAYS visible on top; the fills only add
// colour personality. The celestial d∞ does not use this model (it renders a
// star sphere instead), so its entry is intentionally empty.
export interface FaceFill {
  points: string;
  opacity: number;
}

export type WireLine = [number, number, number, number];

export interface DieShape {
  outline: string;
  wireLines: WireLine[];
  fills: FaceFill[];
}

// The wireframe ink and its two weights: a heavy outer silhouette and a light
// internal triangulation, both the page's dark ink so they read as drawn lines
// on the cream background.
export const WIRE_COLOR = "#1a1a18";
export const WIRE_OUTER = 2.2;
export const WIRE_INNER = 1.0;

export const SHAPES: Record<DieType, DieShape> = {
  // Tetrahedron — a centred equilateral triangle (centroid at 80,80) with the
  // three medians (each vertex → opposite edge midpoint), meeting at the centre.
  // Three faces fanned from the centroid.
  d4: {
    outline: "80,8 142.35,116 17.65,116",
    wireLines: [
      [80, 8, 80, 116],
      [142.35, 116, 48.825, 62],
      [17.65, 116, 111.175, 62],
    ],
    fills: [
      { points: "17.65,116 80,8 80,80", opacity: 0.14 }, // upper-left (lit)
      { points: "80,8 142.35,116 80,80", opacity: 0.18 }, // right
      { points: "142.35,116 17.65,116 80,80", opacity: 0.22 }, // bottom
    ],
  },
  // Isometric cube — a pointy-top hexagon with three spokes from the centre to
  // the top / lower-left / lower-right vertices, giving three rhombic faces.
  d6: {
    outline: "80,8 142.35,44 142.35,116 80,152 17.65,116 17.65,44",
    wireLines: [
      [80, 80, 142.35, 44],
      [80, 80, 17.65, 44],
      [80, 80, 80, 152],
    ],
    fills: [
      { points: "80,8 142.35,44 80,80 17.65,44", opacity: 0.13 }, // top (lit)
      { points: "142.35,44 142.35,116 80,152 80,80", opacity: 0.2 }, // right
      { points: "17.65,44 80,80 80,152 17.65,116", opacity: 0.25 }, // left
    ],
  },
  // Octahedron from above — a diamond split by its two diagonals into four
  // triangles meeting at the centre.
  d8: {
    outline: "80,8 152,80 80,152 8,80",
    wireLines: [
      [80, 8, 80, 152],
      [8, 80, 152, 80],
    ],
    fills: [
      { points: "8,80 80,8 80,80", opacity: 0.13 }, // top-left (lit)
      { points: "80,8 152,80 80,80", opacity: 0.17 }, // top-right
      { points: "152,80 80,152 80,80", opacity: 0.24 }, // bottom-right
      { points: "80,152 8,80 80,80", opacity: 0.2 }, // bottom-left
    ],
  },
  // Pentagonal trapezohedron — a bilaterally symmetric kite with a zig-zag girdle
  // (top apex, two girdle points, a front-centre vertex) and five faces.
  d10: {
    outline: "80,8 136,72 80,152 24,72",
    wireLines: [
      [80, 8, 80, 72],
      [24, 72, 52, 88],
      [52, 88, 80, 72],
      [80, 72, 108, 88],
      [136, 72, 108, 88],
      [52, 88, 80, 152],
      [108, 88, 80, 152],
    ],
    fills: [
      { points: "80,8 24,72 52,88 80,72", opacity: 0.14 }, // top-left (lit)
      { points: "80,8 80,72 108,88 136,72", opacity: 0.18 }, // top-right
      { points: "80,72 108,88 80,152 52,88", opacity: 0.16 }, // front-centre
      { points: "24,72 52,88 80,152", opacity: 0.22 }, // lower-left
      { points: "136,72 108,88 80,152", opacity: 0.24 }, // lower-right
    ],
  },
  // Dodecahedron — a regular pentagon (point up) with the full pentagram drawn
  // inside. The colour wash is a five-blade pinwheel from the centre so the whole
  // face is covered; the star reads through the wireframe lines on top.
  d12: {
    outline: "80,8 148.5,57.8 122.3,138.2 37.7,138.2 11.5,57.8",
    wireLines: [
      [80, 8, 122.3, 138.2],
      [80, 8, 37.7, 138.2],
      [148.5, 57.8, 37.7, 138.2],
      [148.5, 57.8, 11.5, 57.8],
      [122.3, 138.2, 11.5, 57.8],
    ],
    fills: [
      { points: "80,80 80,8 148.5,57.8", opacity: 0.15 }, // top-right blade (lit)
      { points: "80,80 148.5,57.8 122.3,138.2", opacity: 0.2 }, // right blade
      { points: "80,80 122.3,138.2 37.7,138.2", opacity: 0.24 }, // bottom blade
      { points: "80,80 37.7,138.2 11.5,57.8", opacity: 0.2 }, // left blade
      { points: "80,80 11.5,57.8 80,8", opacity: 0.16 }, // top-left blade
    ],
  },
  // Icosahedron — the exact reroll hexagon and its verbatim internal lines: a
  // vertical seam, two long diagonals, four corner spokes, and the top/bottom
  // horizontals. Fills wash top → bottom (lightest → darkest), with two central
  // wedges filling the spine the corner faces leave open.
  d20: {
    outline: "80,8 152,44 152,116 80,152 8,116 8,44",
    wireLines: [
      [80, 8, 80, 152],
      [8, 44, 152, 116],
      [152, 44, 8, 116],
      [80, 8, 8, 116],
      [80, 8, 152, 116],
      [8, 44, 80, 152],
      [152, 44, 80, 152],
      [8, 44, 152, 44],
      [8, 116, 152, 116],
    ],
    fills: [
      { points: "80,8 152,44 8,44", opacity: 0.15 }, // top triangle (lit)
      { points: "152,44 152,116 80,8", opacity: 0.2 }, // upper-right
      { points: "8,44 80,8 8,116", opacity: 0.18 }, // upper-left
      { points: "80,8 8,116 152,116", opacity: 0.1 }, // centre wedge (down)
      { points: "80,152 8,44 152,44", opacity: 0.12 }, // centre wedge (up)
      { points: "152,44 152,116 80,152", opacity: 0.22 }, // centre-right
      { points: "8,44 8,116 80,152", opacity: 0.2 }, // centre-left
      { points: "8,116 152,116 80,152", opacity: 0.25 }, // bottom triangle (darkest)
    ],
  },
  // Rhombic triacontahedron — the same hexagon as the d20, but finely subdivided:
  // an inner hexagon, six spokes out to the corners, a diagonal across each rim
  // trapezoid, and three diagonals splitting the core. Many more, smaller facets.
  d30: {
    outline: "80,8 152,44 152,116 80,152 8,116 8,44",
    wireLines: [
      // inner hexagon
      [80, 44, 116, 62],
      [116, 62, 116, 98],
      [116, 98, 80, 116],
      [80, 116, 44, 98],
      [44, 98, 44, 62],
      [44, 62, 80, 44],
      // inner → outer spokes
      [80, 44, 80, 8],
      [116, 62, 152, 44],
      [116, 98, 152, 116],
      [80, 116, 80, 152],
      [44, 98, 8, 116],
      [44, 62, 8, 44],
      // rim-trapezoid diagonals
      [80, 44, 152, 44],
      [116, 62, 152, 116],
      [116, 98, 80, 152],
      [80, 116, 8, 116],
      [44, 98, 8, 44],
      [44, 62, 80, 8],
      // core diagonals
      [80, 44, 80, 116],
      [116, 62, 44, 98],
      [44, 62, 116, 98],
    ],
    fills: [
      { points: "80,8 152,44 116,62 80,44", opacity: 0.15 }, // rim top (lit)
      { points: "152,44 152,116 116,98 116,62", opacity: 0.2 }, // rim upper-right
      { points: "152,116 80,152 80,116 116,98", opacity: 0.24 }, // rim lower-right
      { points: "80,152 8,116 44,98 80,116", opacity: 0.22 }, // rim bottom-left
      { points: "8,116 8,44 44,62 44,98", opacity: 0.18 }, // rim upper-left
      { points: "8,44 80,8 80,44 44,62", opacity: 0.16 }, // rim top-left
      { points: "80,44 116,62 116,98 80,116 44,98 44,62", opacity: 0.14 }, // core
    ],
  },
  // The celestial d∞ renders a star sphere, not a polyhedron — no wire/fills.
  dinf: {
    outline: "",
    wireLines: [],
    fills: [],
  },
};

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

// d20 — THE benchmark (the rerollgaming.com feel). These float + tumble values
// are the EXACT reroll-site numbers and must not be "improved": idle y 4 / rotateX
// 2 / 2.5s; tumble launch 360/360, rotateZ ±25, scale 0.82, 0.35s power2.in; settle
// back to 0 / scale 1, 0.4s back.out(2.5). A confident scale overshoot + radial
// glow on a 20; the classic number shake on a 1.
const D20_ANIM: AnimConfig = {
  color: "#c0392b",
  float: { y: 4, duration: 2.5, rotateX: 2 },
  tumble: { p1Dur: 0.35, p1Ease: "power2.in", rotateZ: 25, scale: 0.82, p2Dur: 0.4, p2Ease: "back.out(2.5)" },
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
