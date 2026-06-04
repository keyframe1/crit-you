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
