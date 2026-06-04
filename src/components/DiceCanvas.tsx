"use client";

import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { type DieType } from "@/lib/dice";
import { DailyControlContext, type DailyControl } from "./dice3d/dailyControl";
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
  // ─── Controlled mode (Daily Crit) — all optional; the main app uses none ───
  // When provided, the parent owns the roll trigger: bump this nonce to roll.
  // (The internal click-to-roll is then disabled.)
  rollNonce?: number;
  // Whether clicking the stage rolls the die. Default true; the daily passes
  // false and drives rolls from its own ROLL button instead.
  interactive?: boolean;
  // Forced-value + bank-celebrate channel handed down to the die (see PolyDie).
  control?: DailyControl;
  // CSS size override for the square stage (the daily uses a smaller die in its
  // modal). Defaults to the full-page clamp.
  size?: string;
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
export default function DiceCanvas({
  dieType,
  onRoll,
  onRollStart,
  rollNonce: controlledNonce,
  interactive = true,
  control,
  size = "clamp(280px, min(82vmin, 62vh), 560px)",
}: Props) {
  // Clicking anywhere in the stage bumps this; the die component watches it and
  // rolls (guarding against re-rolls mid-animation itself). In controlled mode
  // (the daily) the parent owns the nonce and this internal one is ignored.
  const [internalNonce, setInternalNonce] = useState(0);
  const controlled = controlledNonce !== undefined;
  const rollNonce = controlled ? controlledNonce : internalNonce;

  const handleClick = useCallback(() => {
    if (controlled || !interactive) return;
    setInternalNonce((n) => n + 1);
  }, [controlled, interactive]);

  return (
    <div
      onClick={handleClick}
      className={
        interactive && !controlled
          ? "relative cursor-pointer select-none"
          : "relative select-none"
      }
      style={{
        // A big square stage so the die genuinely dominates the page. Bounded by
        // height in landscape (62vh) and by width on tall/mobile screens (82vmin)
        // so it never crowds out the bubble above or the selector below.
        width: size,
        height: size,
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

        {/* Remounts on die change so each die's animation state starts fresh.
            The control provider lives INSIDE the Canvas so PolyDie reads it
            within the same react-three-fiber reconciler (no context bridge). */}
        <DailyControlContext.Provider value={control ?? null}>
          <Die3D
            key={dieType}
            dieType={dieType}
            rollNonce={rollNonce}
            onResult={onRoll}
            onRollStart={onRollStart}
          />
        </DailyControlContext.Provider>
      </Canvas>
    </div>
  );
}
