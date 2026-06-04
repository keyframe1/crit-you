"use client";

import PolyDie from "./PolyDie";
import { celebrateD4, failD4 } from "./reactions";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
  onRollStart?: () => void;
}

// THE CALTROP — small, light, twitchy. Fast spin and a nervous quick bob.
export default function D4({ rollNonce, onResult, onRollStart }: Props) {
  return (
    <PolyDie
      rollNonce={rollNonce}
      onResult={onResult}
      onRollStart={onRollStart}
      max={4}
      geometry={<tetrahedronGeometry args={[1.5, 0]} />}
      config={{
        color: "#a83228",
        edgeWidth: 3,
        spinSpeed: 0.25,
        floatY: 0.12,
        floatDuration: 2.5,
        p1Dur: 0.3,
        p2Dur: 0.35,
        p2Ease: "back.out(2.5)",
        // Sharp, aggressive landing.
        thudScale: 1.05,
        celebrate: celebrateD4,
        fail: failD4,
      }}
    />
  );
}
