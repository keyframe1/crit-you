"use client";

import PolyDie from "./PolyDie";
import { celebrateD20, failD20 } from "./reactions";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
}

// THE BENCHMARK — the confident centrepiece. Balanced float, bold crimson faces,
// the original two-phase tumble every other die is tuned against.
export default function D20({ rollNonce, onResult }: Props) {
  return (
    <PolyDie
      rollNonce={rollNonce}
      onResult={onResult}
      dieType="d20"
      max={20}
      geometry={<icosahedronGeometry args={[1.5, 0]} />}
      config={{
        color: "#c0392b",
        edgeWidth: 3,
        spinSpeed: 0.15,
        floatY: 0.15,
        floatDuration: 3.5,
        p1Dur: 0.5,
        p2Dur: 0.55,
        p2Ease: "back.out(2.0)",
        // The benchmark landing: a clean, confident thud.
        thudScale: 1.03,
        celebrate: celebrateD20,
        fail: failD20,
      }}
    />
  );
}
