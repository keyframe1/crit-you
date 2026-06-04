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
// `polygons` are closed outlines (drawn with the heavier stroke); `lines` are
// the interior facet edges (drawn thin) that give each die its 3D read.
export interface DieShape {
  polygons: string[];
  lines: [number, number, number, number][];
}

export const SHAPES: Record<DieType, DieShape> = {
  // Tetrahedron: upright triangle with medians to the centroid.
  d4: {
    polygons: ["80,16 144,128 16,128"],
    lines: [
      [80, 16, 80, 90.7],
      [144, 128, 80, 90.7],
      [16, 128, 80, 90.7],
    ],
  },
  // Cube: front face + offset back face + connecting edges.
  d6: {
    polygons: ["44,60 108,60 108,124 44,124", "68,36 132,36 132,100 68,100"],
    lines: [
      [44, 60, 68, 36],
      [108, 60, 132, 36],
      [108, 124, 132, 100],
      [44, 124, 68, 100],
    ],
  },
  // Octahedron: outer diamond, inner diamond, both diagonals.
  d8: {
    polygons: ["80,12 140,80 80,148 20,80", "80,40 112,80 80,120 48,80"],
    lines: [
      [20, 80, 140, 80],
      [80, 12, 80, 148],
    ],
  },
  // Pentagonal trapezohedron: kite outline with a zig-zag girdle.
  d10: {
    polygons: ["80,8 136,72 80,152 24,72"],
    lines: [
      [24, 72, 52, 88],
      [52, 88, 80, 72],
      [80, 72, 108, 88],
      [108, 88, 136, 72],
      [80, 8, 52, 88],
      [80, 8, 108, 88],
      [80, 152, 52, 88],
      [80, 152, 108, 88],
    ],
  },
  // Dodecahedron: outer pentagon, rotated inner pentagon, ten spokes.
  d12: {
    polygons: [
      "80,10 146.6,58.4 121.1,136.6 38.9,136.6 13.4,58.4",
      "80,120 42,92.4 56.5,47.6 103.5,47.6 118,92.4",
    ],
    lines: [
      [80, 10, 56.5, 47.6],
      [80, 10, 103.5, 47.6],
      [146.6, 58.4, 103.5, 47.6],
      [146.6, 58.4, 118, 92.4],
      [121.1, 136.6, 118, 92.4],
      [121.1, 136.6, 80, 120],
      [38.9, 136.6, 80, 120],
      [38.9, 136.6, 42, 92.4],
      [13.4, 58.4, 42, 92.4],
      [13.4, 58.4, 56.5, 47.6],
    ],
  },
  // Icosahedron: the original hexagonal wireframe, preserved.
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
  // Rhombic triacontahedron: decagon outline, rotated inner decagon, ten spokes.
  d30: {
    polygons: [
      "80,8 122.3,21.8 148.5,57.8 148.5,102.2 122.3,138.2 80,152 37.7,138.2 11.5,102.2 11.5,57.8 37.7,21.8",
      "91.1,45.8 109.1,58.8 116,80 109.1,101.2 91.1,114.2 68.9,114.2 50.9,101.2 44,80 50.9,58.8 68.9,45.8",
    ],
    lines: [
      [80, 8, 91.1, 45.8],
      [122.3, 21.8, 109.1, 58.8],
      [148.5, 57.8, 116, 80],
      [148.5, 102.2, 109.1, 101.2],
      [122.3, 138.2, 91.1, 114.2],
      [80, 152, 68.9, 114.2],
      [37.7, 138.2, 50.9, 101.2],
      [11.5, 102.2, 44, 80],
      [11.5, 57.8, 50.9, 58.8],
      [37.7, 21.8, 68.9, 45.8],
    ],
  },
};
