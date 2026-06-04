"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import gsap from "gsap";
import { maxFor, type DieType } from "@/lib/dice";
import D20 from "./dice3d/D20";

interface Props {
  dieType: DieType;
  // Fired with the rolled value once the die reveals it; the parent owns the
  // personality line and the share state.
  onRoll: (value: number) => void;
}

// The shared Three.js stage: lighting, a shadow-catching floor, and whichever
// die's 3D mesh is currently selected. Only the d20 has a 3D component so far —
// every other die still renders as flat SVG via the legacy <Dice> (page.tsx
// routes between them with is3DDie). As each die is ported it slots in here.
function Die3D({
  dieType,
  rollNonce,
  onResult,
}: {
  dieType: DieType;
  rollNonce: number;
  onResult: (value: number) => void;
}) {
  switch (dieType) {
    case "d20":
      return <D20 rollNonce={rollNonce} onResult={onResult} />;
    default:
      return null;
  }
}

export default function DiceCanvas({ dieType, onRoll }: Props) {
  // Clicking anywhere in the stage bumps this; the die component watches it and
  // rolls (guarding against re-rolls mid-animation itself).
  const [rollNonce, setRollNonce] = useState(0);
  // The result number lives as an HTML overlay above the canvas, not as 3D text.
  const numberRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    setRollNonce((n) => n + 1);
  }, []);

  // Reset the number when the die changes so a stale result never lingers over a
  // freshly mounted die.
  useEffect(() => {
    const el = numberRef.current;
    if (el) {
      gsap.killTweensOf(el);
      gsap.set(el, { opacity: 0 });
    }
  }, [dieType]);

  // The die reports its value partway through the roll; we reveal the number
  // (fade in, hold, fade out) and hand the value up for the personality line.
  const handleResult = useCallback(
    (value: number) => {
      onRoll(value);
      const el = numberRef.current;
      if (!el) return;
      const max = maxFor(dieType);
      const isMax = value >= max;
      const isMin = value <= 1;
      el.textContent = String(value);
      el.style.color = isMax ? "#c0392b" : isMin ? "#aaa8a0" : "#1a1a18";
      gsap.killTweensOf(el);
      const tl = gsap.timeline();
      tl.set(el, { opacity: 0 });
      tl.to(el, { opacity: 1, duration: 0.4, ease: "power2.out" });
      tl.to(el, { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=1.5");
    },
    [dieType, onRoll]
  );

  return (
    <div
      onClick={handleClick}
      className="relative cursor-pointer select-none"
      style={{
        width: "clamp(200px, 55vmin, 320px)",
        height: "clamp(200px, 55vmin, 320px)",
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 2, 6], fov: 45 }}
        gl={{ alpha: true }}
      >
        {/* Warm ambient base matched to the cream page. */}
        <ambientLight intensity={0.5} color="#f5f3ee" />
        {/* Key light from the upper-left, the only shadow caster. */}
        <directionalLight
          position={[-3, 5, 4]}
          intensity={1.2}
          color="#ffffff"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        {/* Soft warm fill from the lower-right to lift the shadowed faces. */}
        <directionalLight position={[2, -1, 3]} intensity={0.3} color="#ffe8d6" />

        {/* Invisible floor that only catches the die's shadow. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial transparent opacity={0.12} />
        </mesh>

        {/* Remounts on die change so each die's animation state starts fresh. */}
        <Die3D
          key={dieType}
          dieType={dieType}
          rollNonce={rollNonce}
          onResult={handleResult}
        />
      </Canvas>

      {/* Result number, centred over the canvas (HTML, not 3D text). */}
      <div
        ref={numberRef}
        aria-hidden
        className="absolute inset-0 flex items-center justify-center pointer-events-none font-sans font-black tabular-nums text-[32px] sm:text-[40px]"
        style={{ opacity: 0, zIndex: 20 }}
      />
    </div>
  );
}
