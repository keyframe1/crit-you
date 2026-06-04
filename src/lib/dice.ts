// Die definitions, geometry, and the shared roll model.
// Everything in the app keys off the `DieType` union and the `DICE` ordering.

export type DieType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d30";

export interface DieDef {
  type: DieType;
  max: number;
}

// Ordered low → high. This order is the order shown in the selector carousel.
export const DICE: DieDef[] = [
  { type: "d4", max: 4 },
  { type: "d6", max: 6 },
  { type: "d8", max: 8 },
  { type: "d10", max: 10 },
  { type: "d12", max: 12 },
  { type: "d20", max: 20 },
  { type: "d30", max: 30 },
];

export const DEFAULT_DIE: DieType = "d20";

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

// SVG geometry, authored in a 160×160 viewBox centred on (80,80). Each die is a
// SOLID polyhedron: `faces` are opaque, closed facet polygons that together tile
// the silhouette, each shaded a different brightness of the die's signature
// colour to fake 3D lighting (light from the upper-left — `depth` 0 = facing
// away, darkest; 1 = facing toward the light, lightest). There are NO internal
// wireframe edges; the colour difference between adjacent faces reads as the
// edge. `polygons` is just the outer silhouette, stroked faintly so the shape
// reads against the dark background.
export interface Face {
  points: string;
  depth: number;
}

export interface DieShape {
  polygons: string[]; // outer silhouette only (faint stroke, no fill)
  faces: Face[]; // opaque, solid-shaded facets — drawn back-to-front
}

export const SHAPES: Record<DieType, DieShape> = {
  // Tetrahedron: three kite faces meeting at the centroid.
  d4: {
    polygons: ["80,16 144,128 16,128"],
    faces: [
      { points: "16,128 48,72 80,90.7 80,128", depth: 0.42 }, // lower-left, away
      { points: "144,128 112,72 80,90.7 80,128", depth: 0.55 }, // lower-right
      { points: "80,16 112,72 80,90.7 48,72", depth: 0.92 }, // top face, toward
    ],
  },
  // Cube: corner-on isometric — three rhombic faces.
  d6: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    faces: [
      { points: "80,80 152,116 80,152 8,116", depth: 0.4 }, // front-bottom
      { points: "80,80 80,8 152,44 152,116", depth: 0.55 }, // right
      { points: "80,80 8,116 8,44 80,8", depth: 0.88 }, // left, lit
    ],
  },
  // Octahedron: central diamond plus four outer quads.
  d8: {
    polygons: ["80,8 152,80 80,152 8,80"],
    faces: [
      { points: "116,80 152,80 80,152 80,116", depth: 0.4 }, // bottom-right
      { points: "80,116 80,152 8,80 44,80", depth: 0.48 }, // bottom-left
      { points: "80,44 80,8 152,80 116,80", depth: 0.62 }, // top-right
      { points: "80,44 116,80 80,116 44,80", depth: 0.72 }, // central, front
      { points: "44,80 8,80 80,8 80,44", depth: 0.9 }, // top-left, lit
    ],
  },
  // Pentagonal trapezohedron: two top kites, a front kite, two bottom triangles.
  d10: {
    polygons: ["80,8 136,72 80,152 24,72"],
    faces: [
      { points: "80,152 108,88 136,72", depth: 0.38 }, // bottom-right
      { points: "80,152 24,72 52,88", depth: 0.46 }, // bottom-left
      { points: "80,72 108,88 80,152 52,88", depth: 0.56 }, // front-centre kite
      { points: "80,8 80,72 108,88 136,72", depth: 0.64 }, // top-right kite
      { points: "80,8 24,72 52,88 80,72", depth: 0.9 }, // top-left kite, lit
    ],
  },
  // Dodecahedron: central pentagon ringed by five trapezoid faces.
  d12: {
    polygons: ["80,8 148.5,57.8 122.3,138.2 37.7,138.2 11.5,57.8"],
    faces: [
      { points: "122.3,138.2 37.7,138.2 62.4,104.3 97.6,104.3", depth: 0.38 }, // bottom
      { points: "148.5,57.8 122.3,138.2 97.6,104.3 108.5,70.7", depth: 0.5 }, // right
      { points: "37.7,138.2 11.5,57.8 51.5,70.7 62.4,104.3", depth: 0.46 }, // bottom-left
      { points: "80,50 108.5,70.7 97.6,104.3 62.4,104.3 51.5,70.7", depth: 0.62 }, // centre
      { points: "80,8 148.5,57.8 108.5,70.7 80,50", depth: 0.7 }, // top-right
      { points: "11.5,57.8 80,8 80,50 51.5,70.7", depth: 0.9 }, // top-left, lit
    ],
  },
  // Icosahedron: the rerollgaming.com hexagon — a top triangle, a four-facet
  // middle band around the centre, and a bottom triangle.
  d20: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    faces: [
      { points: "80,152 8,116 152,116", depth: 0.32 }, // bottom triangle, darkest
      { points: "152,116 8,116 80,80", depth: 0.42 }, // band-bottom
      { points: "152,44 152,116 80,80", depth: 0.52 }, // band-right
      { points: "8,116 8,44 80,80", depth: 0.64 }, // band-left
      { points: "8,44 152,44 80,80", depth: 0.74 }, // band-top
      { points: "80,8 8,44 152,44", depth: 0.92 }, // top triangle, lightest
    ],
  },
  // Rhombic triacontahedron: six radial facets fanning from the centre (a
  // distinct, star-like facing from the d20's banded one).
  d30: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    faces: [
      { points: "80,80 152,116 80,152", depth: 0.35 }, // bottom-right
      { points: "80,80 80,152 8,116", depth: 0.42 }, // bottom-left
      { points: "80,80 152,44 152,116", depth: 0.5 }, // right
      { points: "80,80 8,116 8,44", depth: 0.68 }, // left
      { points: "80,80 80,8 152,44", depth: 0.74 }, // top-right
      { points: "80,80 8,44 80,8", depth: 0.92 }, // top-left, lit
    ],
  },
};

// Warm off-white used for the faint silhouette stroke that defines the die's
// outer edge against the dark background.
export const DIE_STROKE = "#e8e4dc";
export const SILHOUETTE_WEIGHT = 1.5;
export const SILHOUETTE_OPACITY = 0.3;

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

// ─── Per-die animation character ────────────────────────────────────────────
// Every die runs the same engine — idle float, two-phase roll tumble, result
// number, nat-max glow, floating contact shadow — but each one is tuned to read
// as a character. All the timings live here as data; Dice.tsx is a generic
// interpreter of these configs, so there are no per-die conditionals baked in.

// One step in a celebration/failure/number sequence, played on an element.
// Exactly one of `to`, `keyframes`, `set`, or `hold` is meaningful per step;
// the sequence runner walks them in order to build a GSAP timeline.
export interface TweenStep {
  to?: Record<string, number>;
  keyframes?: Record<string, number[]>;
  set?: Record<string, number>;
  hold?: number;
  duration?: number;
  ease?: string;
  delay?: number;
}

export interface AnimConfig {
  color: string; // signature colour: face shades, glow, hover drop-shadow
  // Idle float — slow sinusoidal Y bob + slight rotateX and a side-to-side
  // rotateZ sway, forever, killed on roll.
  float: { y: number; rotateX: number; rotateZ: number; duration: number };
  // Two-phase roll tumble: a heavy tumble-in (p1) then a settle with overshoot.
  tumble: {
    p1Dur: number;
    p1Ease: string;
    rotateZ: number; // random rotateZ amplitude (±this) on the tumble-in
    scale: number;
    p2Dur: number;
    p2Ease: string;
  };
  glowOpacity: number; // peak opacity of the nat-max radial glow
  celebrate: TweenStep[]; // body flourish on a natural max (empty = none)
  fail: TweenStep[]; // body flourish on a natural 1 (empty = none)
  // The result number lives inside the die; these are its intimate intros on a
  // nat 1 / nat max. Ordinary rolls use the shared spring in Dice.tsx.
  numberMin: TweenStep[];
  numberMax: TweenStep[];
  numberMaxColor?: string; // override for the nat-max number colour (else accent)
}

// Shared idle-float values — slow and graceful, with a visible bob and sway.
const FLOAT = { y: 6, rotateX: 3, rotateZ: 1.5, duration: 3.5 };

// The benchmark — the rerollgaming.com d20 feel, now heavier and slower.
export const DEFAULT_ANIM: AnimConfig = {
  color: "#c0392b",
  float: { ...FLOAT },
  tumble: {
    p1Dur: 0.5,
    p1Ease: "power2.in",
    rotateZ: 40,
    scale: 0.82,
    p2Dur: 0.55,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.7,
  celebrate: [
    { to: { scale: 1.12 }, duration: 0.3, ease: "back.out(3)" },
    { to: { scale: 1 }, duration: 0.4, ease: "power2.out" },
  ],
  fail: [],
  numberMin: [
    { set: { opacity: 0, scale: 2.8, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1, scale: 1 }, duration: 0.4, ease: "back.out(3)" },
    {
      keyframes: { x: [0, -4, 4, -4, 4, -4, 4, 0] },
      duration: 0.4,
      delay: 0.05,
      ease: "power1.inOut",
    },
  ],
  numberMax: [
    { set: { opacity: 0, scale: 2.8, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1, scale: 1 }, duration: 0.4, ease: "back.out(3)" },
  ],
};

// ═══ D4 — "The Caltrop" ═══ still a touch quicker than the others (twitchy),
// but heavier than before.
const D4_ANIM: AnimConfig = {
  color: "#c0392b",
  float: { ...FLOAT },
  tumble: {
    p1Dur: 0.42,
    p1Ease: "power2.in",
    rotateZ: 60,
    scale: 0.82,
    p2Dur: 0.5,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.7,
  celebrate: [
    {
      keyframes: { scale: [1, 1.15, 1, 1.1, 1] },
      duration: 0.6,
      ease: "power1.inOut",
    },
  ],
  fail: [
    { to: { rotateZ: 15 }, duration: 0.6, ease: "elastic.out(1, 0.4)" },
    { to: { rotateZ: 0 }, duration: 0.4, delay: 1, ease: "power2.inOut" },
  ],
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: -20, rotation: 0 } },
    { to: { opacity: 1, y: 8 }, duration: 0.5, ease: "power2.out" },
  ],
  numberMax: [
    { set: { opacity: 0, scale: 4, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1, scale: 1 }, duration: 0.2, ease: "power4.out" },
  ],
};

// ═══ D6 — "The Basic" ═══ steady, no drama.
const D6_ANIM: AnimConfig = {
  color: "#8a8880",
  float: { ...FLOAT },
  tumble: {
    p1Dur: 0.5,
    p1Ease: "power2.in",
    rotateZ: 15,
    scale: 0.82,
    p2Dur: 0.55,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.7,
  celebrate: [
    { keyframes: { scale: [1, 1.08, 1] }, duration: 0.4, ease: "power2.inOut" },
  ],
  fail: [],
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.3, ease: "none" },
  ],
  numberMax: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.2, ease: "power2.out" },
    { keyframes: { scale: [1, 1.05, 1] }, duration: 0.4, ease: "power2.inOut" },
  ],
};

// ═══ D8 — "The Middle Child" ═══ overcompensates with a big overshoot.
const D8_ANIM: AnimConfig = {
  color: "#2a9d8f",
  float: { ...FLOAT },
  tumble: {
    p1Dur: 0.5,
    p1Ease: "power2.in",
    rotateZ: 40,
    scale: 0.82,
    p2Dur: 0.55,
    p2Ease: "back.out(3.5)",
  },
  glowOpacity: 0.7,
  celebrate: [
    { keyframes: { y: [0, -20, 0, -10, 0] }, duration: 0.6, ease: "power2.out" },
  ],
  fail: [
    { to: { scale: 0.95 }, duration: 0.3, ease: "power2.out" },
    { to: { scale: 1 }, duration: 0.3, ease: "power2.out" },
  ],
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.2, ease: "power2.out" },
    {
      keyframes: { rotation: [0, -5, 5, -5, 5, -5, 5, 0] },
      duration: 0.4,
      ease: "power1.inOut",
    },
  ],
  numberMax: [
    { set: { opacity: 0, scale: 2.8, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1, scale: 1 }, duration: 0.45, ease: "back.out(4)" },
  ],
};

// ═══ D10 — "The Statistician" ═══ precise, glitchy on failure.
const D10_ANIM: AnimConfig = {
  color: "#27ae60",
  float: { ...FLOAT },
  tumble: {
    p1Dur: 0.5,
    p1Ease: "power2.in",
    rotateZ: 10,
    scale: 0.82,
    p2Dur: 0.55,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.7,
  celebrate: [
    { keyframes: { scale: [1, 1.12, 1] }, duration: 0.8, ease: "power2.inOut" },
  ],
  fail: [],
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { keyframes: { opacity: [0, 1, 0, 1, 0, 1] }, duration: 0.3, ease: "none" },
  ],
  numberMax: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.4, ease: "power2.out" },
  ],
  numberMaxColor: "#27ae60",
};

// ═══ D12 — "The Underdog" ═══ theatrical; the tumble takes its time.
const D12_ANIM: AnimConfig = {
  color: "#d4a843",
  float: { ...FLOAT },
  tumble: {
    p1Dur: 0.6,
    p1Ease: "power2.in",
    rotateZ: 50,
    scale: 0.82,
    p2Dur: 0.58,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.9,
  celebrate: [
    { to: { scale: 1.2 }, duration: 0.2, ease: "power2.out" },
    { to: { scale: 1 }, duration: 0.5, delay: 0.2, ease: "back.out(2)" },
  ],
  fail: [],
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 1.2, delay: 0.2, ease: "power2.out" },
  ],
  numberMax: [
    { set: { opacity: 0, scale: 5, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1, scale: 1.2 }, duration: 0.25, ease: "power3.out" },
    { to: { scale: 1 }, duration: 0.4, delay: 0.2, ease: "back.out(2)" },
  ],
};

// ═══ D30 — "The Exotic" ═══ grandest and slowest of all.
const D30_ANIM: AnimConfig = {
  color: "#8e44ad",
  float: { y: 6, rotateX: 3, rotateZ: 1.5, duration: 4.2 },
  tumble: {
    p1Dur: 0.65,
    p1Ease: "power2.in",
    rotateZ: 30,
    scale: 0.82,
    p2Dur: 0.6,
    p2Ease: "back.out(2)",
  },
  glowOpacity: 0.7,
  celebrate: [
    { to: { scale: 1.15 }, duration: 0.4, ease: "power2.inOut" },
    { to: { scale: 1 }, duration: 0.6, delay: 0.4, ease: "power2.inOut" },
  ],
  fail: [{ hold: 0.5 }],
  numberMin: [
    { set: { opacity: 0.2, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.8, ease: "power2.out" },
  ],
  numberMax: [
    { set: { opacity: 0, scale: 0.5, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1, scale: 1 }, duration: 0.6, ease: "power2.out" },
  ],
};

export const ANIM: Record<DieType, AnimConfig> = {
  d4: D4_ANIM,
  d6: D6_ANIM,
  d8: D8_ANIM,
  d10: D10_ANIM,
  d12: D12_ANIM,
  d20: DEFAULT_ANIM, // d20 IS the benchmark
  d30: D30_ANIM,
};

export function animFor(type: DieType): AnimConfig {
  return ANIM[type];
}
