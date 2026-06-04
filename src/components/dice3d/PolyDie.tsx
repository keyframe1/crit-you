"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import type * as THREE from "three";
import { Edges } from "@react-three/drei";
import gsap from "gsap";
import { useIdleFloat } from "./useIdleFloat";
import { OnFaceNumber, playNumberReveal, hideNumber } from "./dieNumber";
import { NUMBER_STYLES } from "@/lib/bubbleStyles";
import type { DieType } from "@/lib/dice";
import type { DieReaction } from "./reactions";

export interface PolyDieConfig {
  color: string; // signature colour: faces, edge flash, point light
  edgeWidth: number; // drei Edges screen-space line width
  edgeOpacity?: number; // default 0.65
  spinSpeed: number; // idle Y spin, radians/sec
  floatY: number; // idle bob amplitude
  floatDuration: number; // idle bob period
  p1Dur: number; // roll launch duration
  p2Dur: number; // roll settle duration
  p2Ease: string; // settle ease, e.g. "back.out(2.5)"
  squish?: number; // scale at the bottom of the launch (default 0.85)
  tumbleZ?: number; // ± random twist during the launch (default 0.8)
  meshScale?: [number, number, number]; // non-uniform shape stretch (d10)
  // Phase 3/4 landing — after the settle the die physically "lands" on its face,
  // and ONLY THEN does the number reveal. Per-die character lives here:
  thudScale?: number; // squash peak on impact (default 1.03)
  thudDrop?: number; // downward dip on impact, world units (default 0.08)
  thudRecover?: number; // recovery duration back to the idle baseline (default 0.25)
  thudBounce?: boolean; // d8: a small bounce up after the drop
  thudRotateCorrect?: boolean; // d30: a regal rotateZ correction to finish
  // The die's reaction to its own roll, played after the number appears (see
  // reactions.ts). Each owns calling its `done()` to resume the idle float.
  celebrate?: DieReaction; // natural max
  fail?: DieReaction; // natural 1
}

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
  dieType: DieType; // selects this die's on-face number style
  max: number;
  config: PolyDieConfig;
  geometry: ReactNode; // the <xxxGeometry/> element for this die
}

// The shared body for every polyhedral die: a flat-shaded solid with drei Edges
// for bold face lines, the idle float/spin, a two-phase roll tumble, a landing
// thud, hover, a nat-max pulse + colour light flash, a nat-min droop, and the
// on-face number. Per-die character comes entirely from `config` + `geometry`.
export default function PolyDie({ rollNonce, onResult, dieType, max, config, geometry }: Props) {
  const {
    color,
    edgeWidth,
    edgeOpacity = 0.65,
    spinSpeed,
    floatY,
    floatDuration,
    p1Dur,
    p2Dur,
    p2Ease,
    squish = 0.85,
    tumbleZ = 0.8,
    meshScale,
    thudScale = 1.03,
    thudDrop = 0.08,
    thudRecover = 0.25,
    thudBounce = false,
    thudRotateCorrect = false,
    celebrate,
    fail,
  } = config;

  const numberStyle = NUMBER_STYLES[dieType];

  const groupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const numRef = useRef<HTMLDivElement>(null);
  // `rollingRef` gates the idle Y-spin (paused while the dice tumbles). `lockRef`
  // gates input: it stays held from the click through the full tumble, settle,
  // landing, and result display, so a rapid click can't interrupt or restart it.
  const rollingRef = useRef(false);
  const lockRef = useRef(false);

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const { startIdle, killIdle } = useIdleFloat(groupRef, rollingRef, {
    spinSpeed,
    floatY,
    floatDuration,
  });

  useEffect(() => {
    startIdle();
    // On unmount (e.g. switching dice) tear down every tween this die owns so
    // nothing keeps animating a detached object. Capture the refs now; they're
    // stable for this die's lifetime.
    const num = numRef.current;
    const grp = groupRef.current;
    const flash = flashRef.current;
    const mat = matRef.current;
    return () => {
      killIdle();
      gsap.killTweensOf(num);
      if (grp) {
        gsap.killTweensOf(grp.scale);
        gsap.killTweensOf(grp.position);
        gsap.killTweensOf(grp.rotation);
      }
      if (flash) gsap.killTweensOf(flash);
      if (mat) {
        gsap.killTweensOf(mat);
        gsap.killTweensOf(mat.color);
      }
    };
  }, [startIdle, killIdle]);

  // Roll whenever the nonce changes (but not on the initial mount value).
  const firstNonce = useRef(true);
  useEffect(() => {
    if (firstNonce.current) {
      firstNonce.current = false;
      return;
    }
    const g = groupRef.current;
    if (!g || lockRef.current) return;
    lockRef.current = true;
    rollingRef.current = true;
    killIdle();
    gsap.killTweensOf(g.scale);
    hideNumber(numRef.current);

    const value = Math.floor(Math.random() * max) + 1;
    const isMax = value >= max;
    const isMin = value <= 1;

    // Phase 1 — tumble: two turns on X with a squish; Y spins RELATIVE so it
    // launches forward from the idle spin's current angle; position drops to the
    // y:0 baseline so the flourish has a known rest.
    gsap.to(g.rotation, {
      x: Math.PI * 4 + gsap.utils.random(-1, 1),
      y: "+=" + (Math.PI * 4 + gsap.utils.random(-1, 1)),
      z: gsap.utils.random(-tumbleZ, tumbleZ),
      duration: p1Dur,
      ease: "power2.in",
    });
    gsap.to(g.position, { y: 0, duration: p1Dur, ease: "power2.in" });
    gsap.to(g.scale, { x: squish, y: squish, z: squish, duration: p1Dur, ease: "power2.in" });

    // Phase 2 — settle: X and Z snap square with an overshoot, scale back to 1.
    // Y is left where the tumble put it so the idle spin resumes seamlessly.
    gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: p2Dur, delay: p1Dur, ease: p2Ease });
    gsap.to(g.rotation, {
      x: 0,
      z: 0,
      duration: p2Dur,
      delay: p1Dur,
      ease: p2Ease,
      onComplete: () => {
        // The die has settled square. Reveal happens AFTER the landing, so the
        // number is the payoff of a physical action rather than an overlay.
        const revealAndFinish = () => {
          // Resume the idle float/spin once any reaction is done.
          const resume = () => {
            rollingRef.current = false;
            startIdle();
          };
          // Once the number has faded in (onShown): raise the bubble AND play
          // this die's emotional reaction to its roll. The reaction owns calling
          // `resume`; a plain roll resumes immediately.
          const react = () => {
            onResultRef.current(value);
            const ctx = {
              group: g,
              material: matRef.current,
              flash: flashRef.current,
              numberEl: numRef.current,
              baseColor: color,
              done: resume,
            };
            if (isMax && celebrate) celebrate(ctx);
            else if (isMin && fail) fail(ctx);
            else resume();
          };
          playNumberReveal(
            numRef.current,
            value,
            max,
            NUMBER_STYLES[dieType],
            react,
            () => {
              lockRef.current = false;
            }
          );
        };

        // Phase 3 — landing thud (0.15s): a sharp downward dip + a squash pulse.
        // power4.out reads as the die clicking onto a surface. Phase 4 —
        // recovery: ease back up to the idle baseline (y:0). d8 adds a small
        // bounce; d30 a regal rotateZ correction. Then the number reveals.
        const tl = gsap.timeline({ onComplete: revealAndFinish });
        tl.to(g.position, { y: -thudDrop, duration: 0.15, ease: "power4.out" }, 0);
        tl.to(g.scale, { x: thudScale, y: thudScale, z: thudScale, duration: 0.075, ease: "power4.out" }, 0);
        tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.075, ease: "power2.out" }, 0.075);
        if (thudBounce) {
          tl.to(g.position, { y: 0.03, duration: 0.12, ease: "power2.out" }, 0.15);
          tl.to(g.position, { y: 0, duration: thudRecover, ease: "power2.out" });
        } else {
          tl.to(g.position, { y: 0, duration: thudRecover, ease: "power2.out" }, 0.15);
        }
        if (thudRotateCorrect) {
          tl.to(g.rotation, { z: 0.035, duration: 0.12, ease: "power2.out" }, 0.15);
          tl.to(g.rotation, { z: 0, duration: 0.18, ease: "power2.inOut" }, 0.27);
        }
      },
    });
  }, [
    rollNonce,
    killIdle,
    startIdle,
    dieType,
    max,
    p1Dur,
    p2Dur,
    p2Ease,
    squish,
    tumbleZ,
    thudScale,
    thudDrop,
    thudRecover,
    thudBounce,
    thudRotateCorrect,
    celebrate,
    fail,
    color,
  ]);

  const handlePointerOver = useCallback(() => {
    if (rollingRef.current) return;
    const g = groupRef.current;
    if (!g) return;
    killIdle();
    gsap.to(g.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 0.3 });
    gsap.to(g.position, { y: 0.2, duration: 0.3 });
  }, [killIdle]);

  const handlePointerOut = useCallback(() => {
    if (rollingRef.current) return;
    const g = groupRef.current;
    if (!g) return;
    gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.4 });
    startIdle();
  }, [startIdle]);

  return (
    <group ref={groupRef}>
      <mesh
        castShadow
        scale={meshScale}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {geometry}
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive="#000000"
          emissiveIntensity={0}
          metalness={0.15}
          roughness={0.55}
          flatShading
        />
        <Edges threshold={1} color="#1a1a18" lineWidth={edgeWidth} transparent opacity={edgeOpacity} />
      </mesh>
      <pointLight ref={flashRef} position={[0, 0, 0]} color={color} intensity={0} />
      <OnFaceNumber ref={numRef} style={numberStyle} />
    </group>
  );
}
