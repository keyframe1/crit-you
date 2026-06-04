"use client";

import PolyDie from "./PolyDie";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
}

// THE MIDDLE CHILD — eager, bouncy. A slightly larger bob and an over-eager
// settle that tries a little too hard.
export default function D8({ rollNonce, onResult }: Props) {
  return (
    <PolyDie
      rollNonce={rollNonce}
      onResult={onResult}
      max={8}
      geometry={<octahedronGeometry args={[1.5, 0]} />}
      config={{
        color: "#2a9d8f",
        edgeWidth: 3,
        spinSpeed: 0.18,
        floatY: 0.14,
        floatDuration: 3.0,
        p1Dur: 0.45,
        p2Dur: 0.5,
        p2Ease: "back.out(3.0)",
      }}
    />
  );
}
