"use client";

import PolyDie from "./PolyDie";
import { celebrateD10, failD10 } from "./reactions";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
  onRollStart?: () => void;
}

// THE STATISTICIAN — precise, mechanical. A dodecahedron stretched taller and
// narrower (scale Y 1.3) so it reads distinct from the d12, with a controlled,
// minimal-overshoot settle.
export default function D10({ rollNonce, onResult, onRollStart }: Props) {
  return (
    <PolyDie
      rollNonce={rollNonce}
      onResult={onResult}
      onRollStart={onRollStart}
      max={10}
      geometry={<dodecahedronGeometry args={[1.3, 0]} />}
      config={{
        color: "#27ae60",
        edgeWidth: 3,
        spinSpeed: 0.12,
        floatY: 0.1,
        floatDuration: 3.2,
        p1Dur: 0.45,
        p2Dur: 0.45,
        p2Ease: "back.out(1.5)",
        meshScale: [1, 1.3, 1],
        // Clinical, precise landing — barely a squash.
        thudScale: 1.015,
        celebrate: celebrateD10,
        fail: failD10,
      }}
    />
  );
}
