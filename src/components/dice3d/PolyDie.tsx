"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import type * as THREE from "three";
import { Edges } from "@react-three/drei";
import gsap from "gsap";
import { useIdleFloat } from "./useIdleFloat";
import {
  OnFaceNumber,
  POLY_NUMBER_THEME,
  playNumberReveal,
  hideNumber,
} from "./dieNumber";

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
}

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
  max: number;
  config: PolyDieConfig;
  geometry: ReactNode; // the <xxxGeometry/> element for this die
}

// The shared body for every polyhedral die: a flat-shaded solid with drei Edges
// for bold face lines, the idle float/spin, a two-phase roll tumble, hover, a
// nat-max pulse + colour light flash, a nat-min droop, and the on-face number.
// Per-die character comes entirely from `config` + `geometry`.
export default function PolyDie({ rollNonce, onResult, max, config, geometry }: Props) {
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
  } = config;

  const groupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const rollingRef = useRef(false);

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
    return () => killIdle();
  }, [startIdle, killIdle]);

  // Roll whenever the nonce changes (but not on the initial mount value).
  const firstNonce = useRef(true);
  useEffect(() => {
    if (firstNonce.current) {
      firstNonce.current = false;
      return;
    }
    const g = groupRef.current;
    if (!g || rollingRef.current) return;
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
        // The die has landed: reveal the number on its face and tell the parent.
        playNumberReveal(numRef.current, value, max, POLY_NUMBER_THEME);
        onResultRef.current(value);
        const finish = () => {
          rollingRef.current = false;
          startIdle();
        };
        if (isMax) {
          gsap.to(g.scale, {
            x: 1.12,
            y: 1.12,
            z: 1.12,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: "power2.out",
          });
          const flash = flashRef.current;
          if (flash) {
            flash.intensity = 2;
            gsap.to(flash, { intensity: 0, duration: 0.8, ease: "power2.out", onComplete: finish });
          } else {
            finish();
          }
        } else if (isMin) {
          gsap.to(g.position, { y: -0.1, duration: 0.5, ease: "power2.out", onComplete: finish });
        } else {
          finish();
        }
      },
    });
  }, [rollNonce, killIdle, startIdle, max, p1Dur, p2Dur, p2Ease, squish, tumbleZ]);

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
        <meshStandardMaterial color={color} metalness={0.15} roughness={0.55} flatShading />
        <Edges threshold={1} color="#1a1a18" lineWidth={edgeWidth} transparent opacity={edgeOpacity} />
      </mesh>
      <pointLight ref={flashRef} position={[0, 0, 0]} color={color} intensity={0} />
      <OnFaceNumber ref={numRef} theme={POLY_NUMBER_THEME} />
    </group>
  );
}
