"use client";

import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
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
        // Soft (variance) shadow maps: a genuinely blurred, grounded shadow that
        // honours each mesh's castShadow flag — DInf's orb stays the sole caster
        // while its ring/halo/stars don't bleed in (a screen-space contact-shadow
        // pass would have ignored those flags and smeared them onto the floor).
        shadows="variance"
        // DPR clamped to 2 so dice + fat-line edges render crisp on retina/mobile
        // without paying for 3x+ framebuffers. Antialias set explicitly (R3F
        // defaults it on, but the crisp silhouette depends on it) and alpha so the
        // cream page shows through the transparent canvas.
        dpr={[1, 2]}
        camera={{ position: [0, 1.5, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Warm ambient base matched to the cream page. */}
        <ambientLight intensity={0.5} color="#f5f3ee" />
        {/* Key light from the upper-left, the only shadow caster. VSM gives it a
            soft, even penumbra (radius + blurSamples); a tight shadow camera keeps
            texel density high so the blur stays smooth, not chunky. */}
        <directionalLight
          position={[-3, 5, 4]}
          intensity={1.2}
          color="#ffffff"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-radius={6}
          shadow-blurSamples={16}
          shadow-camera-near={1}
          shadow-camera-far={16}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />
        {/* Soft warm fill from the lower-right to lift the shadowed faces. */}
        <directionalLight position={[2, -1, 3]} intensity={0.3} color="#ffe8d6" />
        {/* Cool rim/back light skimming the upper-back silhouette so each die
            separates from the similarly-light cream background and its edges
            read. Faintly cool against the warm scene; casts nothing. */}
        <directionalLight position={[0, 2.5, -6]} intensity={0.6} color="#eef2f8" />

        {/* Procedural studio environment: a tiny render-once cubemap (no network,
            no per-frame cost) — a bright warm top key, a warm side, and a cool
            side over a dark surround. It only feeds faint fresnel reflections
            (see the material's low envMapIntensity), so the die reads as a
            premium physical object while the flat-shaded faces keep their
            character. resolution 64 is ample for a rough (0.55) blurred reflection. */}
        <Environment frames={1} resolution={64}>
          <Lightformer
            form="rect"
            intensity={1.4}
            color="#fff6ea"
            position={[0, 4, 1]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[10, 10, 1]}
          />
          <Lightformer
            form="rect"
            intensity={0.7}
            color="#ffe8d6"
            position={[4, 1, 3]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[6, 6, 1]}
          />
          <Lightformer
            form="rect"
            intensity={0.5}
            color="#e7eef8"
            position={[-4, 1, -2]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[6, 6, 1]}
          />
        </Environment>

        {/* Invisible floor that only catches the die's (now soft, VSM-blurred)
            shadow. Raised closer under the die than before so the soft shadow
            reads as a grounded contact/seat rather than a distant floating blob,
            with opacity nudged up just enough to feel present but still subtle. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial transparent opacity={0.16} />
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
