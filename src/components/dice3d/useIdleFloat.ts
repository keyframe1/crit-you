"use client";

import { useCallback, useRef } from "react";
import type * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";

export interface IdleOpts {
  spinSpeed: number; // continuous idle Y spin, radians/sec
  floatY: number; // vertical bob amplitude, world units
  floatDuration: number; // bob period, seconds
}

// Shared idle behaviour for every 3D die. Two layers on the same group:
//   • a continuous slow Y spin via useFrame — additive, never resets, and paused
//     while rolling so GSAP can borrow Y for the tumble and hand it back;
//   • a GSAP vertical bob + slight X/Z tilt that eases to rest (never a snap)
//     and then loops.
// Returns start/kill so the die can surrender the group to a roll or hover and
// reclaim it afterwards. Refs are taken structurally to stay version-agnostic.
export function useIdleFloat(
  groupRef: { current: THREE.Group | null },
  rollingRef: { current: boolean },
  { spinSpeed, floatY, floatDuration }: IdleOpts
) {
  const tweens = useRef<gsap.core.Tween[]>([]);

  useFrame((_, delta) => {
    if (!rollingRef.current && groupRef.current) {
      groupRef.current.rotation.y += delta * spinSpeed;
    }
  });

  const killIdle = useCallback(() => {
    tweens.current.forEach((t) => t.kill());
    tweens.current = [];
    const g = groupRef.current;
    if (g) {
      gsap.killTweensOf(g.position);
      gsap.killTweensOf(g.rotation);
    }
  }, [groupRef]);

  const startIdle = useCallback(() => {
    const g = groupRef.current;
    if (!g) return;
    killIdle();
    const loop = () => {
      tweens.current.push(
        gsap.to(g.position, {
          y: floatY,
          duration: floatDuration,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        }),
        gsap.to(g.rotation, {
          x: 0.08,
          z: 0.04,
          duration: floatDuration,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        })
      );
    };
    tweens.current.push(
      gsap.to(g.position, { y: 0, duration: 0.5, ease: "sine.out", onComplete: loop }),
      gsap.to(g.rotation, { x: 0, z: 0, duration: 0.5, ease: "sine.out" })
    );
  }, [groupRef, killIdle, floatY, floatDuration]);

  return { startIdle, killIdle };
}
