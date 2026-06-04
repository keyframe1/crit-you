"use client";

import PolyDie from "./PolyDie";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
}

// THE CALTROP — small, light, twitchy. Fast spin and a nervous quick bob.
export default function D4({ rollNonce, onResult }: Props) {
  return (
    <PolyDie
      rollNonce={rollNonce}
      onResult={onResult}
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
      }}
    />
  );
}
