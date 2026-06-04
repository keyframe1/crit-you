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
// stroke-width 1.0 so they read as structure). This weight hierarchy — and the
// shared viewBox — is identical across all seven dice; only the shape differs.
export interface DieShape {
  polygons: string[];
  lines: [number, number, number, number][];
}

export const SHAPES: Record<DieType, DieShape> = {
  // Tetrahedron: triangle with a median from each vertex to the opposite edge's
  // midpoint.
  d4: {
    polygons: ["80,16 144,128 16,128"],
    lines: [
      [80, 16, 80, 128], // apex → midpoint of base
      [144, 128, 48, 72], // bottom-right → midpoint of left edge
      [16, 128, 112, 72], // bottom-left → midpoint of right edge
    ],
  },
  // Cube: isometric projection — a hexagonal silhouette with three internal
  // edges meeting at the centre (the classic corner-on cube).
  d6: {
    polygons: ["80,8 152,44 152,116 80,152 8,116 8,44"],
    lines: [
      [80, 80, 80, 8], // centre → top
      [80, 80, 8, 116], // centre → bottom-left
      [80, 80, 152, 116], // centre → bottom-right
    ],
  },
  // Octahedron: diamond with horizontal + vertical bisectors and an inner
  // diamond (the equatorial square seen edge-on) for the diagonals.
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
  },
  // Pentagonal trapezohedron: kite silhouette with a zig-zag girdle and apex
  // spokes suggesting the ten faces.
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
  },
  // Dodecahedron: pentagon silhouette with an internal pentagram (each vertex
  // joined to its two non-adjacent vertices).
  d12: {
    polygons: ["80,8 148.5,57.8 122.3,138.2 37.7,138.2 11.5,57.8"],
    lines: [
      [80, 8, 122.3, 138.2],
      [80, 8, 37.7, 138.2],
      [148.5, 57.8, 37.7, 138.2],
      [148.5, 57.8, 11.5, 57.8],
      [122.3, 138.2, 11.5, 57.8],
    ],
  },
  // Icosahedron: the exact rerollgaming.com d20 — hexagonal silhouette with
  // full internal triangulation. Do not change this shape.
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
  },
  // Rhombic triacontahedron: hexagonal silhouette with a denser facet pattern —
  // radial spokes to every vertex plus an inner hexagon of edge midpoints —
  // suggesting its many faces.
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
  },
};

// Shared stroke values so every die — full size and in the selector — uses the
// same warm off-white and the same 2.2 : 1.0 weight ratio.
export const DIE_STROKE = "#e8e4dc";
export const OUTER_WEIGHT = 2.2;
export const INNER_WEIGHT = 1.0;

// ─── Per-die animation character ────────────────────────────────────────────
// Every die runs the same engine — idle float, two-phase roll tumble, result
// number, nat-max glow — but each one is tuned to read as a character. All the
// timings live here as data; Dice.tsx and RollResult.tsx are generic
// interpreters of these configs, so there are no per-die conditionals baked
// into the components.

// One step in a celebration/failure sequence played on the die's SVG body.
// Exactly one of `to`, `keyframes`, `set`, or `hold` is meaningful per step;
// the sequence runner walks them in order to build a GSAP timeline.
export interface TweenStep {
  to?: Record<string, number>; // tween to these transform values
  keyframes?: Record<string, number[]>; // multi-stop keyframe tween on one prop
  set?: Record<string, number>; // instant set, no tween
  hold?: number; // an empty beat (seconds) before the next step — a pause
  duration?: number;
  ease?: string;
  delay?: number; // gap before this step starts (used to "hold" a pose)
}

// How the big result number reacts to a natural 1. The number lives in its own
// component, so its failure flavour is named here and interpreted there.
export type NumberFail =
  | "shake" // spring in, then a disappointed side-to-side shake (the d20)
  | "spring" // spring in cleanly — the die's body does the reacting instead
  | "flat" // no spring at all; it just appears (the d6's pure boredom)
  | "flicker" // spring in, then flicker like a glitching calculator (the d10)
  | "delay-slow"; // a beat of silence, then a slow fade-in (the d12's tragedy)

export interface AnimConfig {
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
  numberFail: NumberFail; // how the result number reacts on a natural 1
}

// The benchmark — the exact rerollgaming.com d20 feel. Every other die is
// described as a deviation from this, so it doubles as the default each die
// starts from before its own character is dialled in.
export const DEFAULT_ANIM: AnimConfig = {
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
  // The gold-standard celebration: the glow pulse (fired separately) plus a
  // confident scale overshoot.
  celebrate: [
    { to: { scale: 1.12 }, duration: 0.25, ease: "back.out(3)" },
    { to: { scale: 1 }, duration: 0.35, ease: "power2.out" },
  ],
  fail: [], // the d20's failure lives entirely in the number's shake
  numberFail: "shake",
};

// ═══ D4 — "The Caltrop" ═══
// Angry little triangle. Smallest die, biggest attitude. Its tumble is sharper
// and twitchier than the benchmark; it celebrates by vibrating with rage-joy
// and sulks by tilting over and refusing to get up for a second.
const D4_ANIM: AnimConfig = {
  float: { y: 4, rotateX: 2, duration: 2.5 },
  tumble: {
    p1Dur: 0.25, // snappier than the 0.35 standard — twitchy and fast
    p1Ease: "power2.in",
    rotateZ: 60, // wider, more aggressive spin
    scale: 0.82,
    p2Dur: 0.4,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.7,
  // Rapid triple-pulse — vibrating with rage-joy.
  celebrate: [
    {
      keyframes: { scale: [1, 1.15, 1, 1.1, 1] },
      duration: 0.6,
      ease: "power1.inOut",
    },
  ],
  // Tilts to one side and stays tilted for a full second, sulking.
  fail: [
    { to: { rotateZ: 15 }, duration: 0.6, ease: "elastic.out(1, 0.4)" },
    { to: { rotateZ: 0 }, duration: 0.4, delay: 1, ease: "power2.inOut" },
  ],
  numberFail: "spring", // the body does the sulking; the number stays clean
};

// ═══ D6 — "The Basic" ═══
// The most common die, and it has made peace with that. Dry, understated, the
// accountant of the dice bag. Its tumble is steady with almost no spin variation
// — it doesn't show off — its celebration is a single clean pulse, and even its
// failure is boring: the number just appears, no spring.
const D6_ANIM: AnimConfig = {
  float: { y: 4, rotateX: 2, duration: 2.5 },
  tumble: {
    p1Dur: 0.35,
    p1Ease: "power2.in",
    rotateZ: 15, // minimal variation — no drama, no showing off
    scale: 0.82,
    p2Dur: 0.4,
    p2Ease: "back.out(2.5)",
  },
  glowOpacity: 0.7,
  // A single clean, professional pulse.
  celebrate: [
    { keyframes: { scale: [1, 1.08, 1] }, duration: 0.4, ease: "power2.inOut" },
  ],
  fail: [], // it barely reacts — the boredom lives in the number
  numberFail: "flat", // the number just appears: no spring, no fuss
};

// ═══ D8 — "The Middle Child" ═══
// Overlooked and eager to please — not as popular as the d6, not as dramatic as
// the d12, not the star like the d20. It overcompensates: its settle overshoots
// harder than the benchmark, it double-bounces with joy when noticed, and it
// visibly deflates on a failure.
const D8_ANIM: AnimConfig = {
  float: { y: 4, rotateX: 2, duration: 2.5 },
  tumble: {
    p1Dur: 0.35,
    p1Ease: "power2.in",
    rotateZ: 40,
    scale: 0.82,
    p2Dur: 0.4,
    p2Ease: "back.out(3.5)", // overshoots more than 2.5 — overcompensating
  },
  glowOpacity: 0.7,
  // Double bounce — excited that someone finally noticed.
  celebrate: [
    {
      keyframes: { y: [0, -20, 0, -10, 0] },
      duration: 0.6,
      ease: "power2.out",
    },
  ],
  // Shrinks slightly, then recovers. Deflating.
  fail: [
    { to: { scale: 0.95 }, duration: 0.3, ease: "power2.out" },
    { to: { scale: 1 }, duration: 0.3, ease: "power2.out" },
  ],
  numberFail: "spring",
};

// Each die starts as the benchmark; its own commit dials in its character.
export const ANIM: Record<DieType, AnimConfig> = {
  d4: D4_ANIM,
  d6: D6_ANIM,
  d8: D8_ANIM,
  d10: DEFAULT_ANIM,
  d12: DEFAULT_ANIM,
  d20: DEFAULT_ANIM, // d20 IS the benchmark — do not change it
  d30: DEFAULT_ANIM,
};

export function animFor(type: DieType): AnimConfig {
  return ANIM[type];
}
