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

// SVG wireframe geometry, authored in a 160×160 viewBox centred on (80,80).
// `polygons` are the closed silhouette outlines (drawn at stroke-width 2.2 so
// the shape reads as solid); `lines` are the interior facet edges (drawn at
// stroke-width 1.0 so they read as structure); `faces` are the closed facet
// polygons that get a translucent signature-colour fill, each with a `depth`
// (0 = facing away → darkest fill, 1 = facing toward → lightest fill) so the
// die reads as a solid, dimensional object rather than a flat wireframe. The
// shared viewBox and the 2.2 : 1.0 stroke ratio are identical across all seven
// dice; only the shape differs.
export interface Face {
  points: string;
  depth: number;
}

export interface DieShape {
  polygons: string[];
  lines: [number, number, number, number][];
  faces: Face[];
}

export const SHAPES: Record<DieType, DieShape> = {
  // Tetrahedron: triangle with a median from each vertex to the opposite edge's
  // midpoint. The three medians meet at the centroid, carving the silhouette
  // into three kite faces that meet in the middle.
  d4: {
    polygons: ["80,16 144,128 16,128"],
    lines: [
      [80, 16, 80, 128], // apex → midpoint of base
      [144, 128, 48, 72], // bottom-right → midpoint of left edge
      [16, 128, 112, 72], // bottom-left → midpoint of right edge
    ],
    faces: [
      { points: "80,16 112,72 80,90.7 48,72", depth: 0.95 }, // top face, toward
      { points: "144,128 112,72 80,90.7 80,128", depth: 0.5 }, // lower-right
      { points: "16,128 48,72 80,90.7 80,128", depth: 0.32 }, // lower-left, away
    ],
  },
  // Cube: isometric projection — a hexagonal silhouette with three internal
  // edges meeting at the centre (the classic corner-on cube), giving three
  // rhombic faces.
  d6: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    lines: [
      [80, 80, 80, 8], // centre → top
      [80, 80, 8, 116], // centre → bottom-left
      [80, 80, 152, 116], // centre → bottom-right
    ],
    faces: [
      { points: "80,80 80,8 152,44 152,116", depth: 0.8 }, // right face, lit
      { points: "80,80 8,116 8,44 80,8", depth: 0.4 }, // left face, away
      { points: "80,80 152,116 80,152 8,116", depth: 0.55 }, // front-bottom
    ],
  },
  // Octahedron: diamond with horizontal + vertical bisectors and an inner
  // diamond (the equatorial square seen edge-on). Faces: the central diamond
  // plus four outer quads.
  d8: {
    polygons: ["80,8 152,80 80,152 8,80"],
    lines: [
      [8, 80, 152, 80], // horizontal bisector
      [80, 8, 80, 152], // vertical bisector
      [80, 44, 116, 80], // inner diamond
      [116, 80, 80, 116],
      [80, 116, 44, 80],
      [44, 80, 80, 44],
    ],
    faces: [
      { points: "80,44 116,80 80,116 44,80", depth: 1.0 }, // central face, front
      { points: "80,44 80,8 152,80 116,80", depth: 0.72 }, // top-right
      { points: "44,80 8,80 80,8 80,44", depth: 0.6 }, // top-left
      { points: "116,80 152,80 80,152 80,116", depth: 0.45 }, // bottom-right
      { points: "80,116 80,152 8,80 44,80", depth: 0.32 }, // bottom-left, away
    ],
  },
  // Pentagonal trapezohedron: kite silhouette with a zig-zag girdle and apex
  // spokes. Faces: eight triangles fanning from the top and bottom apexes.
  d10: {
    polygons: ["80,8 136,72 80,152 24,72"],
    lines: [
      [80, 8, 80, 152], // centre seam
      [24, 72, 52, 88], // girdle zig-zag
      [52, 88, 80, 72],
      [80, 72, 108, 88],
      [108, 88, 136, 72],
      [80, 8, 52, 88], // top apex spokes
      [80, 8, 108, 88],
      [80, 152, 52, 88], // bottom apex spokes
      [80, 152, 108, 88],
    ],
    faces: [
      { points: "80,8 24,72 52,88", depth: 0.5 }, // top-left
      { points: "80,8 52,88 80,72", depth: 0.78 }, // top-mid-left, lit
      { points: "80,8 80,72 108,88", depth: 0.82 }, // top-mid-right, lit
      { points: "80,8 108,88 136,72", depth: 0.55 }, // top-right
      { points: "80,152 24,72 52,88", depth: 0.3 }, // bottom-left, away
      { points: "80,152 52,88 80,72", depth: 0.5 }, // bottom-mid-left
      { points: "80,152 80,72 108,88", depth: 0.55 }, // bottom-mid-right
      { points: "80,152 108,88 136,72", depth: 0.35 }, // bottom-right
    ],
  },
  // Dodecahedron: pentagon silhouette with an internal pentagram. The five
  // diagonals carve it into a central pentagon, five star-point triangles, and
  // five edge triangles (the standard pentagram subdivision).
  d12: {
    polygons: ["80,8 148.5,57.8 122.3,138.2 37.7,138.2 11.5,57.8"],
    lines: [
      [80, 8, 122.3, 138.2],
      [80, 8, 37.7, 138.2],
      [148.5, 57.8, 37.7, 138.2],
      [148.5, 57.8, 11.5, 57.8],
      [122.3, 138.2, 11.5, 57.8],
    ],
    faces: [
      { points: "63.8,57.8 96.2,57.8 106.2,88.5 80,107.5 53.8,88.5", depth: 1.0 }, // centre
      { points: "80,8 63.8,57.8 96.2,57.8", depth: 0.7 }, // star point: top
      { points: "148.5,57.8 96.2,57.8 106.2,88.5", depth: 0.55 }, // star: right
      { points: "122.3,138.2 106.2,88.5 80,107.5", depth: 0.4 }, // star: btm-right
      { points: "37.7,138.2 80,107.5 53.8,88.5", depth: 0.38 }, // star: btm-left
      { points: "11.5,57.8 53.8,88.5 63.8,57.8", depth: 0.5 }, // star: left
      { points: "80,8 148.5,57.8 96.2,57.8", depth: 0.62 }, // edge: top-right
      { points: "148.5,57.8 122.3,138.2 106.2,88.5", depth: 0.45 }, // edge: right
      { points: "122.3,138.2 37.7,138.2 80,107.5", depth: 0.32 }, // edge: bottom
      { points: "37.7,138.2 11.5,57.8 53.8,88.5", depth: 0.34 }, // edge: left
      { points: "11.5,57.8 80,8 63.8,57.8", depth: 0.52 }, // edge: top-left
    ],
  },
  // Icosahedron: the exact rerollgaming.com d20 — hexagonal silhouette with
  // full internal triangulation. Do not change this shape. The fill uses the six
  // radial faces (the three diameters split the hexagon into six triangles).
  d20: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    lines: [
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
    faces: [
      { points: "80,80 80,8 152,44", depth: 0.85 }, // top-right, lit
      { points: "80,80 152,44 152,116", depth: 0.6 }, // right
      { points: "80,80 152,116 80,152", depth: 0.42 }, // bottom-right
      { points: "80,80 80,152 8,116", depth: 0.35 }, // bottom-left, away
      { points: "80,80 8,116 8,44", depth: 0.5 }, // left
      { points: "80,80 8,44 80,8", depth: 0.7 }, // top-left
    ],
  },
  // Rhombic triacontahedron: hexagonal silhouette with radial spokes to every
  // vertex plus an inner hexagon of edge midpoints. The fill uses the six radial
  // faces; the inner hexagon stays as wireframe structure.
  d30: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    lines: [
      [80, 80, 80, 8], // radial spokes to each outer vertex
      [80, 80, 152, 44],
      [80, 80, 152, 116],
      [80, 80, 80, 152],
      [80, 80, 8, 116],
      [80, 80, 8, 44],
      [116, 26, 152, 80], // inner hexagon of edge midpoints
      [152, 80, 116, 134],
      [116, 134, 44, 134],
      [44, 134, 8, 80],
      [8, 80, 44, 26],
      [44, 26, 116, 26],
    ],
    faces: [
      { points: "80,80 80,8 152,44", depth: 0.8 }, // top-right
      { points: "80,80 152,44 152,116", depth: 0.55 }, // right
      { points: "80,80 152,116 80,152", depth: 0.4 }, // bottom-right
      { points: "80,80 80,152 8,116", depth: 0.34 }, // bottom-left, away
      { points: "80,80 8,116 8,44", depth: 0.52 }, // left
      { points: "80,80 8,44 80,8", depth: 0.72 }, // top-left
    ],
  },
};

// Shared stroke values so every die — full size and in the selector — uses the
// same warm off-white and the same 2.2 : 1.0 weight ratio.
export const DIE_STROKE = "#e8e4dc";
export const OUTER_WEIGHT = 2.2;
export const INNER_WEIGHT = 1.0;

// Faces fill between these opacities; `depth` 0 → FILL_MIN (facing away, nearly
// black against the background), 1 → FILL_MAX (facing toward, most colour).
export const FILL_MIN = 0.06;
export const FILL_MAX = 0.18;
export function faceOpacity(depth: number): number {
  return FILL_MIN + (FILL_MAX - FILL_MIN) * depth;
}

// ─── Per-die animation character ────────────────────────────────────────────
// Every die runs the same engine — idle float, two-phase roll tumble, result
// number, nat-max glow — but each one is tuned to read as a character. All the
// timings live here as data; Dice.tsx is a generic interpreter of these configs,
// so there are no per-die conditionals baked into the component.

// One step in a celebration/failure/number sequence, played on an element.
// Exactly one of `to`, `keyframes`, `set`, or `hold` is meaningful per step;
// the sequence runner walks them in order to build a GSAP timeline. Properties
// inside `to`/`keyframes`/`set` are GSAP transform props (scale, x, y, rotation,
// opacity, etc.) in the element's local units.
export interface TweenStep {
  to?: Record<string, number>; // tween to these values
  keyframes?: Record<string, number[]>; // multi-stop keyframe tween on one prop
  set?: Record<string, number>; // instant set, no tween
  hold?: number; // an empty beat (seconds) before the next step — a pause
  duration?: number;
  ease?: string;
  delay?: number; // gap before this step starts (used to "hold" a pose)
}

export interface AnimConfig {
  color: string; // signature colour: face fills, glow, and hover drop-shadow
  // Idle float — sinusoidal Y bob + slight rotateX, forever, killed on roll.
  float: { y: number; rotateX: number; duration: number };
  // Two-phase roll tumble: a tumble-in (p1) then a settle with overshoot (p2).
  tumble: {
    p1Dur: number;
    p1Ease: string;
    rotateZ: number; // random rotateZ amplitude (±this) on the tumble-in
    scale: number; // how far it shrinks at the bottom of the tumble
    p2Dur: number;
    p2Ease: string;
  };
  glowOpacity: number; // peak opacity of the nat-max radial glow
  celebrate: TweenStep[]; // body flourish on a natural max (empty = none)
  fail: TweenStep[]; // body flourish on a natural 1 (empty = none)
  // The result number now lives inside the die, so its reactions are intimate
  // and per-die. `numberMin`/`numberMax` are its intro on a nat 1 / nat max;
  // ordinary rolls use the shared spring in Dice.tsx.
  numberMin: TweenStep[];
  numberMax: TweenStep[];
  numberMaxColor?: string; // override for the nat-max number colour (else accent)
}

// The benchmark — the exact rerollgaming.com d20 feel. Every other die is
// described as a deviation from this.
export const DEFAULT_ANIM: AnimConfig = {
  color: "#c0392b",
  float: { y: 4, rotateX: 2, duration: 2.5 },
  tumble: {
    p1Dur: 0.35,
    p1Ease: "power2.in",
    rotateZ: 40,
    scale: 0.82,
    p2Dur: 0.4,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.7,
  celebrate: [
    { to: { scale: 1.12 }, duration: 0.25, ease: "back.out(3)" },
    { to: { scale: 1 }, duration: 0.35, ease: "power2.out" },
  ],
  fail: [], // the d20's failure lives entirely in the number's shake
  // The benchmark number: spring in (back.out(3)); nat 1 adds the classic shake.
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

// ═══ D4 — "The Caltrop" ═══ angry little triangle, twitchy and fast.
const D4_ANIM: AnimConfig = {
  color: "#c0392b",
  float: { y: 4, rotateX: 2, duration: 2.5 },
  tumble: {
    p1Dur: 0.25,
    p1Ease: "power2.in",
    rotateZ: 60,
    scale: 0.82,
    p2Dur: 0.4,
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
  // nat 1: the number sinks down into the point of the triangle, then fades.
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: -20, rotation: 0 } },
    { to: { opacity: 1, y: 8 }, duration: 0.5, ease: "power2.out" },
  ],
  // nat max: it stabs in hard.
  numberMax: [
    { set: { opacity: 0, scale: 4, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1, scale: 1 }, duration: 0.2, ease: "power4.out" },
  ],
};

// ═══ D6 — "The Basic" ═══ steady, no drama, even the failure is boring.
const D6_ANIM: AnimConfig = {
  color: "#8a8880",
  float: { y: 4, rotateX: 2, duration: 2.5 },
  tumble: {
    p1Dur: 0.35,
    p1Ease: "power2.in",
    rotateZ: 15,
    scale: 0.82,
    p2Dur: 0.4,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.7,
  celebrate: [
    { keyframes: { scale: [1, 1.08, 1] }, duration: 0.4, ease: "power2.inOut" },
  ],
  fail: [],
  // nat 1: just appears, no spring at all.
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.3, ease: "none" },
  ],
  // nat max: one restrained clean pulse.
  numberMax: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.2, ease: "power2.out" },
    { keyframes: { scale: [1, 1.05, 1] }, duration: 0.4, ease: "power2.inOut" },
  ],
};

// ═══ D8 — "The Middle Child" ═══ overcompensates; bounces when noticed.
const D8_ANIM: AnimConfig = {
  color: "#2a9d8f",
  float: { y: 4, rotateX: 2, duration: 2.5 },
  tumble: {
    p1Dur: 0.35,
    p1Ease: "power2.in",
    rotateZ: 40,
    scale: 0.82,
    p2Dur: 0.4,
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
  // nat 1: the number wobbles in nervously.
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.2, ease: "power2.out" },
    {
      keyframes: { rotation: [0, -5, 5, -5, 5, -5, 5, 0] },
      duration: 0.4,
      ease: "power1.inOut",
    },
  ],
  // nat max: extra-bouncy overshoot, because it's so excited.
  numberMax: [
    { set: { opacity: 0, scale: 2.8, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1, scale: 1 }, duration: 0.45, ease: "back.out(4)" },
  ],
};

// ═══ D10 — "The Statistician" ═══ precise, clinical, glitchy on failure.
const D10_ANIM: AnimConfig = {
  color: "#27ae60",
  float: { y: 4, rotateX: 2, duration: 2.5 },
  tumble: {
    p1Dur: 0.35,
    p1Ease: "power2.in",
    rotateZ: 10,
    scale: 0.82,
    p2Dur: 0.4,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.7,
  celebrate: [
    { keyframes: { scale: [1, 1.12, 1] }, duration: 0.8, ease: "power2.inOut" },
  ],
  fail: [],
  // nat 1: the number flickers in like a glitching display, then holds.
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { keyframes: { opacity: [0, 1, 0, 1, 0, 1] }, duration: 0.3, ease: "none" },
  ],
  // nat max: a clean fade-in with a slight green tint, no drama.
  numberMax: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.4, ease: "power2.out" },
  ],
  numberMaxColor: "#27ae60",
};

// ═══ D12 — "The Underdog" ═══ theatrical; the tragedy needs time.
const D12_ANIM: AnimConfig = {
  color: "#d4a843",
  float: { y: 4, rotateX: 2, duration: 2.5 },
  tumble: {
    p1Dur: 0.45,
    p1Ease: "power2.in",
    rotateZ: 50,
    scale: 0.82,
    p2Dur: 0.4,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.9,
  celebrate: [
    { to: { scale: 1.2 }, duration: 0.2, ease: "power2.out" },
    { to: { scale: 1 }, duration: 0.5, delay: 0.2, ease: "back.out(2)" },
  ],
  fail: [],
  // nat 1: the number fades in extremely slowly, after a dramatic pause.
  numberMin: [
    { set: { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 1.2, delay: 0.2, ease: "power2.out" },
  ],
  // nat max: it BURSTS in, holds big, then settles.
  numberMax: [
    { set: { opacity: 0, scale: 5, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1, scale: 1.2 }, duration: 0.25, ease: "power3.out" },
    { to: { scale: 1 }, duration: 0.4, delay: 0.2, ease: "back.out(2)" },
  ],
};

// ═══ D30 — "The Exotic" ═══ unhurried; everything takes a little longer.
const D30_ANIM: AnimConfig = {
  color: "#8e44ad",
  float: { y: 4, rotateX: 2, duration: 3.5 },
  tumble: {
    p1Dur: 0.5,
    p1Ease: "power2.in",
    rotateZ: 30,
    scale: 0.82,
    p2Dur: 0.45,
    p2Ease: "back.out(2)",
  },
  glowOpacity: 0.7,
  celebrate: [
    { to: { scale: 1.15 }, duration: 0.4, ease: "power2.inOut" },
    { to: { scale: 1 }, duration: 0.6, delay: 0.4, ease: "power2.inOut" },
  ],
  fail: [{ hold: 0.5 }],
  // nat 1: the number materialises slowly from low opacity. Stunned silence.
  numberMin: [
    { set: { opacity: 0.2, scale: 1, x: 0, y: 0, rotation: 0 } },
    { to: { opacity: 1 }, duration: 0.8, ease: "power2.out" },
  ],
  // nat max: a slow, regal scale up. No rush.
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
  d20: DEFAULT_ANIM, // d20 IS the benchmark — do not change it
  d30: D30_ANIM,
};

export function animFor(type: DieType): AnimConfig {
  return ANIM[type];
}
