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
// SOLID polyhedron:
//   • `faces`  — opaque, closed facets that exactly tile the silhouette, each
//                shaded a different brightness of the signature colour (light
//                from the upper-left: `depth` 0 = darkest/facing away, 1 =
//                lightest/facing the light).
//   • `edges`  — the internal facet boundaries, drawn ONCE each as a clean
//                off-white line (1.5 / 0.4) so the 3D facets read crisply. No
//                edge is drawn twice.
//   • `polygons` — the outer silhouette only, stroked a little bolder (2.0 /
//                0.5) so the shape's outline reads against the dark background.
// Every shared vertex uses the exact same coordinate, so faces and edges meet
// precisely with no gaps or overlaps.
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
  // the centre), split into three kite faces by the medians to the edge
  // midpoints. Top face lightest, bottom two darker.
  d4: {
    polygons: ["80,8 142.35,116 17.65,116"],
    faces: [
      { points: "80,8 111.175,62 80,80 48.825,62", depth: 0.9 }, // top
      { points: "17.65,116 48.825,62 80,80 80,116", depth: 0.5 }, // bottom-left
      { points: "142.35,116 80,116 80,80 111.175,62", depth: 0.4 }, // bottom-right
    ],
    edges: [
      [80, 80, 111.175, 62], // centroid → right edge midpoint
      [80, 80, 48.825, 62], // centroid → left edge midpoint
      [80, 80, 80, 116], // centroid → base midpoint
    ],
  },
  // Cube — a regular hexagon (circumradius 72) with three spokes from the centre
  // at exactly 120° (to the two upper vertices and the bottom vertex), making
  // three rhombic faces: top, left, right. Top lightest, left medium, right
  // darkest.
  d6: {
    polygons: ["80,8 142.35,44 142.35,116 80,152 17.65,116 17.65,44"],
    faces: [
      { points: "80,80 17.65,44 80,8 142.35,44", depth: 0.9 }, // top
      { points: "80,80 17.65,44 17.65,116 80,152", depth: 0.62 }, // left
      { points: "80,80 142.35,44 142.35,116 80,152", depth: 0.42 }, // right
    ],
    edges: [
      [80, 80, 17.65, 44], // centre → upper-left
      [80, 80, 142.35, 44], // centre → upper-right
      [80, 80, 80, 152], // centre → bottom
    ],
  },
  // Octahedron — a diamond split by its two diagonals into four triangles.
  // Top-left lightest (toward the light), bottom-right darkest.
  d8: {
    polygons: ["80,8 152,80 80,152 8,80"],
    faces: [
      { points: "80,8 80,80 8,80", depth: 0.9 }, // top-left (top-back)
      { points: "80,8 152,80 80,80", depth: 0.62 }, // top-right (top-front)
      { points: "80,80 80,152 8,80", depth: 0.5 }, // bottom-left (bottom-back)
      { points: "80,80 152,80 80,152", depth: 0.35 }, // bottom-right (bottom-front)
    ],
    edges: [
      [80, 80, 80, 8], // centre → top
      [80, 80, 152, 80], // centre → right
      [80, 80, 80, 152], // centre → bottom
      [80, 80, 8, 80], // centre → left
    ],
  },
  // Pentagonal trapezohedron — a bilaterally symmetric kite with a zig-zag
  // girdle. Two upper kites, a front kite, and two lower triangles.
  d10: {
    polygons: ["80,8 136,72 80,152 24,72"],
    faces: [
      { points: "80,8 24,72 52,88 80,72", depth: 0.9 }, // top-left kite
      { points: "80,8 80,72 108,88 136,72", depth: 0.64 }, // top-right kite
      { points: "80,72 108,88 80,152 52,88", depth: 0.56 }, // front-centre kite
      { points: "80,152 24,72 52,88", depth: 0.46 }, // bottom-left
      { points: "80,152 108,88 136,72", depth: 0.38 }, // bottom-right
    ],
    edges: [
      [80, 8, 80, 72], // top apex → girdle centre
      [24, 72, 52, 88], // left girdle
      [52, 88, 80, 72],
      [80, 72, 108, 88],
      [136, 72, 108, 88], // right girdle
      [52, 88, 80, 152], // girdle → bottom apex
      [108, 88, 80, 152],
    ],
  },
  // Dodecahedron — a regular pentagon (circumradius 72) with an aligned inner
  // pentagon (radius 30) forming a central face ringed by five trapezoids.
  d12: {
    polygons: ["80,8 148.5,57.8 122.3,138.2 37.7,138.2 11.5,57.8"],
    faces: [
      { points: "80,50 108.5,70.7 97.6,104.3 62.4,104.3 51.5,70.7", depth: 0.6 }, // centre
      { points: "11.5,57.8 80,8 80,50 51.5,70.7", depth: 0.9 }, // top-left
      { points: "80,8 148.5,57.8 108.5,70.7 80,50", depth: 0.7 }, // top-right
      { points: "37.7,138.2 11.5,57.8 51.5,70.7 62.4,104.3", depth: 0.5 }, // bottom-left
      { points: "148.5,57.8 122.3,138.2 97.6,104.3 108.5,70.7", depth: 0.46 }, // right
      { points: "122.3,138.2 37.7,138.2 62.4,104.3 97.6,104.3", depth: 0.36 }, // bottom
    ],
    edges: [
      [80, 50, 108.5, 70.7], // inner pentagon
      [108.5, 70.7, 97.6, 104.3],
      [97.6, 104.3, 62.4, 104.3],
      [62.4, 104.3, 51.5, 70.7],
      [51.5, 70.7, 80, 50],
      [80, 8, 80, 50], // spokes: outer vertex → inner vertex
      [148.5, 57.8, 108.5, 70.7],
      [122.3, 138.2, 97.6, 104.3],
      [37.7, 138.2, 62.4, 104.3],
      [11.5, 57.8, 51.5, 70.7],
    ],
  },
  // Icosahedron — the rerollgaming.com hexagon (exact mandated points): a top
  // triangle, a four-facet middle band around the centre, and a bottom triangle.
  // Top lightest, bottom darkest.
  d20: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    faces: [
      { points: "80,8 8,44 152,44", depth: 0.92 }, // top triangle
      { points: "8,44 152,44 80,80", depth: 0.74 }, // band-top
      { points: "8,116 8,44 80,80", depth: 0.64 }, // band-left
      { points: "152,44 152,116 80,80", depth: 0.52 }, // band-right
      { points: "152,116 8,116 80,80", depth: 0.42 }, // band-bottom
      { points: "80,152 8,116 152,116", depth: 0.32 }, // bottom triangle
    ],
    edges: [
      [8, 44, 152, 44], // top of the band (under the top triangle)
      [8, 116, 152, 116], // bottom of the band (above the bottom triangle)
      [80, 80, 8, 44], // spokes to the four band corners
      [80, 80, 152, 44],
      [80, 80, 152, 116],
      [80, 80, 8, 116],
    ],
  },
  // Rhombic triacontahedron — the same hexagon, but more finely faceted than the
  // d20: an inner hexagon of edge midpoints split into six, ringed by six corner
  // triangles (twelve facets in a star-like facing).
  d30: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    faces: [
      { points: "8,80 8,44 44,26", depth: 0.92 }, // corner: upper-left
      { points: "44,26 80,8 116,26", depth: 0.82 }, // corner: top
      { points: "116,26 152,44 152,80", depth: 0.6 }, // corner: upper-right
      { points: "44,134 8,116 8,80", depth: 0.5 }, // corner: lower-left
      { points: "152,80 152,116 116,134", depth: 0.38 }, // corner: lower-right
      { points: "116,134 80,152 44,134", depth: 0.34 }, // corner: bottom
      { points: "80,80 8,80 44,26", depth: 0.78 }, // inner: upper-left
      { points: "80,80 44,26 116,26", depth: 0.72 }, // inner: top
      { points: "80,80 116,26 152,80", depth: 0.54 }, // inner: upper-right
      { points: "80,80 44,134 8,80", depth: 0.46 }, // inner: lower-left
      { points: "80,80 152,80 116,134", depth: 0.42 }, // inner: lower-right
      { points: "80,80 116,134 44,134", depth: 0.36 }, // inner: bottom
    ],
    edges: [
      [116, 26, 152, 80], // inner hexagon of edge midpoints
      [152, 80, 116, 134],
      [116, 134, 44, 134],
      [44, 134, 8, 80],
      [8, 80, 44, 26],
      [44, 26, 116, 26],
      [80, 80, 116, 26], // spokes to each midpoint
      [80, 80, 152, 80],
      [80, 80, 116, 134],
      [80, 80, 44, 134],
      [80, 80, 8, 80],
      [80, 80, 44, 26],
    ],
  },
};

// Off-white edge colour and the two edge weights: a faint internal facet line
// and a slightly bolder outer silhouette.
export const DIE_STROKE = "#e8e4dc";
export const EDGE_WEIGHT = 1.5;
export const EDGE_OPACITY = 0.4;
export const SILHOUETTE_WEIGHT = 2.0;
export const SILHOUETTE_OPACITY = 0.5;

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

// One step in a celebration/failure sequence, played on an element.
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
  // Idle float — a slow, visible Y bob plus slight rotateX, a side-to-side
  // rotateZ sway, and a rotateY tilt that shifts the facets in perspective.
  // `y` is the full peak-to-peak travel (the die bobs ±y/2 around rest).
  float: { y: number; rotateX: number; rotateZ: number; rotateY: number; duration: number };
  // Two-phase roll tumble: a heavy tumble-in (p1) then a settle with overshoot.
  tumble: {
    p1Dur: number;
    p1Ease: string;
    rotateZ: number;
    scale: number;
    p2Dur: number;
    p2Ease: string;
  };
  glowOpacity: number; // peak opacity of the nat-max radial glow
  celebrate: TweenStep[]; // body flourish on a natural max (empty = none)
  fail: TweenStep[]; // body flourish on a natural 1 (empty = none)
}

// Shared idle-float values — slow and graceful, with a clearly visible bob,
// sway, and perspective tilt.
const FLOAT = { y: 10, rotateX: 3, rotateZ: 1.5, rotateY: 2, duration: 3.5 };

// The benchmark — the rerollgaming.com d20 feel: heavy and slow.
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
};

// ═══ D4 — "The Caltrop" ═══ a touch quicker than the others (twitchy).
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
};

// ═══ D10 — "The Statistician" ═══ precise, controlled.
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
};

// ═══ D30 — "The Exotic" ═══ grandest and slowest of all.
const D30_ANIM: AnimConfig = {
  color: "#8e44ad",
  float: { y: 10, rotateX: 3, rotateZ: 1.5, rotateY: 2, duration: 4.2 },
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
