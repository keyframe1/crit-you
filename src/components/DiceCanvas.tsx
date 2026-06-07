"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import gsap from "gsap";
import { type DieType } from "@/lib/dice";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
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

// ─── Die-swap transition ─────────────────────────────────────────────────────
// Switching dice is not a hard cut: the outgoing die shrinks + spins away as the
// stage fades out, then the incoming die springs in as it fades back. Timings in
// ms; reduced motion collapses both to a plain opacity fade (no scale/spin).
type SwapPhase = "idle" | "out" | "in";
const SWAP_OUT_MS = 150;
const SWAP_IN_MS = 300;
const REDUCE_FADE_MS = 120;

// Wraps the shown die in a group we animate as a unit so a swap reads as
// dissolve-out / materialize-in. The inner die is keyed by `shownType`, so it
// still remounts fresh per die (each die's animation state resets, as before).
// The wrapper transform is pure presentation — it never touches the die's own
// roll/idle animations, which live on the die's child group; and rolls are gated
// until the swap is at rest (see handleClick), so the face-forward settle always
// runs with the wrapper at identity.
function DieStage({
  shownType,
  phase,
  reduce,
  rollNonce,
  onResult,
  onRollStart,
}: {
  shownType: DieType;
  phase: SwapPhase;
  reduce: boolean;
  rollNonce: number;
  onResult: (value: number) => void;
  onRollStart?: () => void;
}) {
  const wrapRef = useRef<THREE.Group>(null);
  const firstMount = useRef(true);

  // Exit: shrink + spin the outgoing wrapper away. The fade itself is the stage
  // opacity (the cream page shows through the alpha canvas), so this only carries
  // the motion. Skipped under reduced motion.
  useEffect(() => {
    const g = wrapRef.current;
    if (!g || phase !== "out" || reduce) return;
    gsap.killTweensOf(g.scale);
    gsap.killTweensOf(g.rotation);
    gsap.to(g.scale, { x: 0.55, y: 0.55, z: 0.55, duration: SWAP_OUT_MS / 1000, ease: "power2.in" });
    gsap.to(g.rotation, { y: g.rotation.y + Math.PI * 0.75, duration: SWAP_OUT_MS / 1000, ease: "power2.in" });
  }, [phase, reduce]);

  // Enter: when the shown die changes, spring the new one in from a small,
  // slightly-turned pose. Set synchronously (layout effect) so the very first
  // frame is already at the start pose — and it's under the faded-out stage
  // anyway. Skipped on the first mount (page load is not a swap).
  useLayoutEffect(() => {
    const g = wrapRef.current;
    if (!g) return;
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    gsap.killTweensOf(g.scale);
    gsap.killTweensOf(g.rotation);
    if (reduce) {
      g.scale.set(1, 1, 1);
      g.rotation.set(0, 0, 0);
      return;
    }
    g.scale.set(0.7, 0.7, 0.7);
    g.rotation.set(0, -0.5, 0);
    gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: SWAP_IN_MS / 1000, ease: "back.out(1.7)" });
    gsap.to(g.rotation, { y: 0, duration: SWAP_IN_MS / 1000, ease: "back.out(1.5)" });
  }, [shownType, reduce]);

  useEffect(
    () => () => {
      const g = wrapRef.current;
      if (g) {
        gsap.killTweensOf(g.scale);
        gsap.killTweensOf(g.rotation);
      }
    },
    []
  );

  return (
    <group ref={wrapRef}>
      <Die3D
        key={shownType}
        dieType={shownType}
        rollNonce={rollNonce}
        onResult={onResult}
        onRollStart={onRollStart}
      />
    </group>
  );
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

  const reduce = usePrefersReducedMotion();

  // Die-swap transition state. `shownType` is the die actually mounted; it lags
  // the requested `dieType` by the exit duration so the outgoing die can animate
  // away first. `shownRef` mirrors it for the effect's comparison so the effect
  // depends only on the incoming `dieType` (not on its own swap), keeping the
  // phase timeline from being torn down mid-flight.
  const [shownType, setShownType] = useState(dieType);
  const [phase, setPhase] = useState<SwapPhase>("idle");
  const shownRef = useRef(dieType);

  useEffect(() => {
    if (dieType === shownRef.current) return;
    const outMs = reduce ? REDUCE_FADE_MS : SWAP_OUT_MS;
    const inMs = reduce ? REDUCE_FADE_MS : SWAP_IN_MS;
    setPhase("out");
    const swap = setTimeout(() => {
      shownRef.current = dieType;
      setShownType(dieType);
      setPhase("in");
    }, outMs);
    const done = setTimeout(() => setPhase("idle"), outMs + inMs);
    return () => {
      clearTimeout(swap);
      clearTimeout(done);
    };
  }, [dieType, reduce]);

  const handleClick = useCallback(() => {
    // Don't roll during a swap — the wrapper isn't at identity yet, so the
    // face-forward settle would aim at a tilted die.
    if (controlled || !interactive || phase !== "idle") return;
    setInternalNonce((n) => n + 1);
  }, [controlled, interactive, phase]);

  // The stage fades with the swap (the alpha canvas reveals the cream page). One
  // opacity for both phases: 0 while the outgoing die leaves, 1 otherwise; the
  // duration follows whichever phase is active.
  const stageOpacity = phase === "out" ? 0 : 1;
  const fadeMs = reduce ? REDUCE_FADE_MS : phase === "out" ? SWAP_OUT_MS : SWAP_IN_MS;

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
        // Cross-fade the stage across a die swap (and the reduced-motion path's
        // only transition).
        opacity: stageOpacity,
        transition: `opacity ${fadeMs}ms ease-out`,
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

        {/* DieStage wraps the die in an animated group for the swap transition
            and keys the inner die by `shownType`, so each die's animation state
            still starts fresh on change. The control provider lives INSIDE the
            Canvas so PolyDie reads it within the same react-three-fiber reconciler
            (no context bridge). */}
        <DailyControlContext.Provider value={control ?? null}>
          <DieStage
            shownType={shownType}
            phase={phase}
            reduce={reduce}
            rollNonce={rollNonce}
            onResult={onRoll}
            onRollStart={onRollStart}
          />
        </DailyControlContext.Provider>
      </Canvas>
    </div>
  );
}
