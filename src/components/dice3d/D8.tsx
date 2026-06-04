"use client";

import PolyDie from "./PolyDie";
import { celebrateD8, failD8 } from "./reactions";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
  onRollStart?: () => void;
}

// THE MIDDLE CHILD — eager, bouncy. A slightly larger bob and an over-eager
// settle that tries a little too hard.
export default function D8({ rollNonce, onResult, onRollStart }: Props) {
  return (
    <PolyDie
      rollNonce={rollNonce}
      onResult={onResult}
      onRollStart={onRollStart}
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
        // Eager: drops a touch harder, then bounces back up before settling.
        thudDrop: 0.1,
        thudBounce: true,
        celebrate: celebrateD8,
        fail: failD8,
      }}
    />
  );
}
