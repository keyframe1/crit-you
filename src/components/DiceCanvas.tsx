"use client";

import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { type DieType } from "@/lib/dice";
import D4 from "./dice3d/D4";
import D6 from "./dice3d/D6";
import D8 from "./dice3d/D8";
import D10 from "./dice3d/D10";
import D12 from "./dice3d/D12";
import D20 from "./dice3d/D20";
import D30 from "./dice3d/D30";
import DInf from "./dice3d/DInf";

interface Props {
  dieType: DieType;
  // Fired with the rolled value once the die has landed; the parent owns the
  // personality line, the CSS-overlay result number, and the share state.
  onRoll: (value: number) => void;
  // Fired when a fresh roll's tumble begins, so the parent can clear the stale
  // result number before the new value lands.
  onRollStart?: () => void;
}

// Pick the 3D component for the selected die. Dice render only their 3D mesh and
// animations now — the result number is a CSS overlay drawn by the page over the
// top of this canvas, never inside the scene.
function Die3D({
  dieType,
  rollNonce,
  onResult,
  onRollStart,
}: {
  dieType: DieType;
  rollNonce: number;
  onResult: (value: number) => void;
  onRollStart?: () => void;
}) {
  switch (dieType) {
    case "d4":
      return <D4 rollNonce={rollNonce} onResult={onResult} onRollStart={onRollStart} />;
    case "d6":
      return <D6 rollNonce={rollNonce} onResult={onResult} onRollStart={onRollStart} />;
    case "d8":
      return <D8 rollNonce={rollNonce} onResult={onResult} onRollStart={onRollStart} />;
    case "d10":
      return <D10 rollNonce={rollNonce} onResult={onResult} onRollStart={onRollStart} />;
    case "d12":
      return <D12 rollNonce={rollNonce} onResult={onResult} onRollStart={onRollStart} />;
    case "d20":
      return <D20 rollNonce={rollNonce} onResult={onResult} onRollStart={onRollStart} />;
    case "d30":
      return <D30 rollNonce={rollNonce} onResult={onResult} onRollStart={onRollStart} />;
    case "dinf":
      return <DInf rollNonce={rollNonce} onResult={onResult} onRollStart={onRollStart} />;
    default:
      return null;
  }
}

// The shared Three.js stage: one Canvas, lighting, and a shadow-catching floor,
// hosting whichever die is selected.
export default function DiceCanvas({ dieType, onRoll, onRollStart }: Props) {
  // Clicking anywhere in the stage bumps this; the die component watches it and
  // rolls (guarding against re-rolls mid-animation itself).
  const [rollNonce, setRollNonce] = useState(0);

  const handleClick = useCallback(() => {
    setRollNonce((n) => n + 1);
  }, []);

  return (
    <div
      onClick={handleClick}
      className="relative cursor-pointer select-none"
      style={{
        // A big square stage so the die genuinely dominates the page. Bounded by
        // height in landscape (62vh) and by width on tall/mobile screens (82vmin)
        // so it never crowds out the bubble above or the selector below.
        width: "clamp(280px, min(82vmin, 62vh), 560px)",
        height: "clamp(280px, min(82vmin, 62vh), 560px)",
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.5, 5], fov: 45 }}
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

        {/* Invisible floor that only catches the die's shadow — sits well below
            the die so the shadow reads as a soft floating contact. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial transparent opacity={0.12} />
        </mesh>

        {/* Remounts on die change so each die's animation state starts fresh. */}
        <Die3D
          key={dieType}
          dieType={dieType}
          rollNonce={rollNonce}
          onResult={onRoll}
          onRollStart={onRollStart}
        />
      </Canvas>
    </div>
  );
}
