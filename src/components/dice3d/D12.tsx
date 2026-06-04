"use client";

import PolyDie from "./PolyDie";
import { celebrateD12, failD12 } from "./reactions";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
}

// THE UNDERDOG — dramatic, theatrical. The biggest sweeping bob, a long wind-up,
// and a slow dramatic settle.
export default function D12({ rollNonce, onResult }: Props) {
  return (
    <PolyDie
      rollNonce={rollNonce}
      onResult={onResult}
      dieType="d12"
      max={12}
      geometry={<dodecahedronGeometry args={[1.5, 0]} />}
      config={{
        color: "#d4a843",
        edgeWidth: 3,
        spinSpeed: 0.15,
        floatY: 0.18,
        floatDuration: 3.5,
        p1Dur: 0.55,
        p2Dur: 0.65,
        p2Ease: "back.out(2.5)",
        // The landing is an EVENT: a big squash and a slow, dramatic recovery.
        thudScale: 1.06,
        thudRecover: 0.35,
        celebrate: celebrateD12,
        fail: failD12,
      }}
    />
  );
}
