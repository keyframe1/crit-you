"use client";

import PolyDie from "./PolyDie";
import { celebrateD6, failD6 } from "./reactions";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
}

// THE BASIC — slow, steady, reliable. The slowest spin and a minimal bob.
export default function D6({ rollNonce, onResult }: Props) {
  return (
    <PolyDie
      rollNonce={rollNonce}
      onResult={onResult}
      dieType="d6"
      max={6}
      geometry={<boxGeometry args={[1.8, 1.8, 1.8]} />}
      config={{
        color: "#8a8880",
        edgeWidth: 3,
        spinSpeed: 0.08,
        floatY: 0.08,
        floatDuration: 4.0,
        p1Dur: 0.5,
        p2Dur: 0.5,
        p2Ease: "back.out(1.5)",
        // Standard, reliable landing. Nothing fancy.
        thudScale: 1.02,
        celebrate: celebrateD6,
        fail: failD6,
      }}
    />
  );
}
