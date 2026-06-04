"use client";

import { useCallback, useEffect, useRef } from "react";
import type * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import gsap from "gsap";

interface Props {
  // Bumps each time the user clicks to roll. We watch it (skipping the initial
  // mount value) and run a roll on every change.
  rollNonce: number;
  // Fired ~0.4s into the roll with the value, once it's time to reveal the
  // number and the personality line. The parent owns both of those.
  onResult: (value: number) => void;
}

// The d20 as a real 3D icosahedron. flatShading lights each of the 20 faces as a
// distinct facet, and drei's <Edges> draws crisp dark edge lines over the solid
// crimson — the rerollgaming.com wireframe look, but on a real spinning solid.
//
// Motion is split between two systems on the SAME group:
//   • useFrame adds a slow, never-resetting Y spin while idle, so faces keep
//     turning through the light.
//   • GSAP owns the position bob + X/Z tilt (idle) and the full tumble (roll).
// They never fight because they write different rotation axes; on a roll the Y
// spin pauses and GSAP takes Y over, then resumes from wherever it was left.
export default function D20({ rollNonce, onResult }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  // A point light parked at the die's centre, dark at rest, flashed on a nat 20.
  const flashRef = useRef<THREE.PointLight>(null);
  // The looping idle tweens (float + tilt), kept so we can tear them down before
  // a roll or hover takes over the group.
  const idleTweens = useRef<gsap.core.Tween[]>([]);
  // True for the whole duration of a roll (tumble → settle → flourish), so the
  // idle Y spin, clicks, and hovers are all suppressed until the die rests.
  const rollingRef = useRef(false);

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // Slow perpetual turn while idle. Additive and continuous — it never resets,
  // so it survives across rolls (GSAP just borrows Y during the tumble).
  useFrame((_, delta) => {
    if (!rollingRef.current && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  // Kill the idle tweens (and any stray float/tilt tweens) on the group's
  // transform. Leaves rotation.y alone — that belongs to useFrame.
  const killIdle = useCallback(() => {
    idleTweens.current.forEach((t) => t.kill());
    idleTweens.current = [];
    const group = groupRef.current;
    if (group) {
      gsap.killTweensOf(group.position);
      gsap.killTweensOf(group.rotation);
    }
  }, []);

  // Idle float: ease the bob and tilt back to rest (never a snap), then loop a
  // gentle vertical bob and a slight X/Z tilt forever. Three.js shadow mapping
  // softens / spreads the floor shadow as the die rises, automatically.
  const startIdle = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    killIdle();
    const loop = () => {
      idleTweens.current.push(
        gsap.to(group.position, {
          y: 0.15,
          duration: 3.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        }),
        gsap.to(group.rotation, {
          x: 0.08,
          z: 0.04,
          duration: 3.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        })
      );
    };
    idleTweens.current.push(
      gsap.to(group.position, { y: 0, duration: 0.5, ease: "sine.out", onComplete: loop }),
      gsap.to(group.rotation, { x: 0, z: 0, duration: 0.5, ease: "sine.out" })
    );
  }, [killIdle]);

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
    const group = groupRef.current;
    if (!group || rollingRef.current) return;
    rollingRef.current = true;
    killIdle();
    gsap.killTweensOf(group.scale);

    const value = Math.floor(Math.random() * 20) + 1;
    const isMax = value >= 20;
    const isMin = value <= 1;

    // Phase 1 — tumble: two full turns on X with a random offset and a squish.
    // Y spins RELATIVE (+=) so it always launches forward from the idle spin's
    // current angle; position drops to the y:0 baseline for the flourish.
    gsap.to(group.rotation, {
      x: Math.PI * 4 + gsap.utils.random(-1, 1),
      y: "+=" + (Math.PI * 4 + gsap.utils.random(-1, 1)),
      z: gsap.utils.random(-0.8, 0.8),
      duration: 0.5,
      ease: "power2.in",
    });
    gsap.to(group.position, { y: 0, duration: 0.5, ease: "power2.in" });
    gsap.to(group.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 0.5, ease: "power2.in" });

    // Phase 2 — settle: snap X and Z back to square with an overshoot and scale
    // back to 1. Y is deliberately left where the tumble put it so the idle spin
    // can resume seamlessly from there.
    gsap.to(group.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.55,
      delay: 0.5,
      ease: "back.out(2.0)",
    });
    gsap.to(group.rotation, {
      x: 0,
      z: 0,
      duration: 0.55,
      delay: 0.5,
      ease: "back.out(2.0)",
      onComplete: () => {
        const finish = () => {
          rollingRef.current = false;
          startIdle();
        };
        if (isMax) {
          // Confident pulse + a signature-colour light flash from the die itself.
          gsap.to(group.scale, {
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
            gsap.to(flash, {
              intensity: 0,
              duration: 0.8,
              ease: "power2.out",
              onComplete: finish,
            });
          } else {
            finish();
          }
        } else if (isMin) {
          // A small dejected droop, then a recover back into the idle float.
          gsap.to(group.position, {
            y: -0.1,
            duration: 0.5,
            ease: "power2.out",
            onComplete: finish,
          });
        } else {
          finish();
        }
      },
    });

    // Reveal the number / personality line partway through the tumble.
    gsap.delayedCall(0.4, () => onResultRef.current(value));
  }, [rollNonce, killIdle, startIdle]);

  // Hover lifts and grows the die a touch. We stop the idle bob/tilt while held
  // (the Y spin keeps going) and resume on leave. Ignored mid-roll.
  const handlePointerOver = useCallback(() => {
    if (rollingRef.current) return;
    const group = groupRef.current;
    if (!group) return;
    killIdle();
    gsap.to(group.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 0.3 });
    gsap.to(group.position, { y: 0.2, duration: 0.3 });
  }, [killIdle]);

  const handlePointerOut = useCallback(() => {
    if (rollingRef.current) return;
    const group = groupRef.current;
    if (!group) return;
    gsap.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.4 });
    startIdle();
  }, [startIdle]);

  return (
    <group ref={groupRef}>
      <mesh
        castShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <icosahedronGeometry args={[1.8, 0]} />
        <meshStandardMaterial
          color="#c0392b"
          metalness={0.15}
          roughness={0.55}
          flatShading
        />
        {/* Crisp dark edge lines over the solid faces (drei renders these in
            screen space, so lineWidth holds regardless of the WebGL 1px cap). */}
        <Edges threshold={1} color="#1a1a18" lineWidth={2} transparent opacity={0.65} />
      </mesh>
      <pointLight ref={flashRef} position={[0, 0, 0]} color="#c0392b" intensity={0} />
    </group>
  );
}
