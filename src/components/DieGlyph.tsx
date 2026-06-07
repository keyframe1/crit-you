"use client";

import { SHAPES, animFor, type DieType } from "@/lib/dice";

// A tiny wireframe die glyph: translucent signature-colour fills behind a dark
// ink wireframe (the app's wireframe-first die language), reused at small sizes
// in the Daily history row, the cold-open loader, and the Pip walkthrough.
export default function DieGlyph({ die, dim }: { die: DieType; dim?: boolean }) {
  const shape = SHAPES[die];
  const color = animFor(die).color;
  return (
    <svg
      viewBox="0 0 160 160"
      className="h-full w-full"
      style={{ overflow: "visible", opacity: dim ? 0.5 : 1 }}
      aria-hidden
    >
      {shape.fills.map((f, i) => (
        <polygon
          key={`f${i}`}
          points={f.points}
          fill={color}
          fillOpacity={f.opacity}
          stroke="none"
        />
      ))}
      {shape.wireLines.map(([x1, y1, x2, y2], i) => (
        <line
          key={`w${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#1a1a18"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      <polygon
        points={shape.outline}
        fill="none"
        stroke="#1a1a18"
        strokeWidth={4}
        strokeLinejoin="round"
      />
    </svg>
  );
}
