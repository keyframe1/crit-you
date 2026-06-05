"use client";

import PolyDie from "./PolyDie";
import { celebrateD30, failD30 } from "./reactions";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
  onRollStart?: () => void;
}

// THE EXOTIC — slow and regal. A subdivided icosahedron (detail 1 → 80 facets)
// reads as "more complex than the d20"; thinner edges keep the dense facets
// clean. The slowest, grandest motion of the set.
export default function D30({ rollNonce, onResult, onRollStart }: Props) {
  return (
    <PolyDie
      rollNonce={rollNonce}
      onResult={onResult}
      onRollStart={onRollStart}
      max={30}
      geometry={<icosahedronGeometry args={[1.5, 1]} />}
      config={{
        color: "#8e44ad",
        edgeWidth: 2,
        spinSpeed: 0.06,
        floatY: 0.1,
        floatDuration: 4.5,
        p1Dur: 0.6,
        p2Dur: 0.7,
        p2Ease: "back.out(1.8)",
        // The face-forward settle (PolyDie Phase 2) now owns the final pose, so
        // the old regal rotateZ thud-correction is dropped — it would fight the
        // settle slerp and knock the die back off its flat face.
        celebrate: celebrateD30,
        fail: failD30,
      }}
    />
  );
}
