"use client";

import { useCallback, useEffect, useRef } from "react";
import type * as THREE from "three";
import gsap from "gsap";

interface Props {
  // Bumps each time the user clicks to roll. We watch it (skipping the initial
  // mount value) and run a roll on every change.
  rollNonce: number;
  // Fired ~0.4s into the roll with the value, once it's time to reveal the
  // number and the personality line. The parent owns both of those.
  onResult: (value: number) => void;
}

// The d20 as a real 3D icosahedron. flatShading turns each of the 20 triangular
// faces into a distinct flat facet (lit independently), which is the 3D version
// of the wireframe edges the SVG die used to draw. All motion is GSAP tweening
// the mesh's position / rotation / scale directly; R3F's render loop (frameloop
// "always") picks the mutations up every frame.
export default function D20({ rollNonce, onResult }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  // A point light parked at the die's centre, dark at rest, flashed on a nat 20.
  const flashRef = useRef<THREE.PointLight>(null);
  // The two looping idle tweens (float + sway), kept so we can tear them down
  // cleanly before a roll or a hover takes over the mesh.
  const idleTweens = useRef<gsap.core.Tween[]>([]);
  // True for the whole duration of a roll (tumble → settle → celebration), so
  // clicks and hovers are ignored until the die has fully come to rest.
  const rollingRef = useRef(false);

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // Kill every tween we own on the mesh's transform (idle loops included) so the
  // next phase starts from a clean slate.
  const killIdle = useCallback(() => {
    idleTweens.current.forEach((t) => t.kill());
    idleTweens.current = [];
    const mesh = meshRef.current;
    if (mesh) {
      gsap.killTweensOf(mesh.position);
      gsap.killTweensOf(mesh.rotation);
    }
  }, []);

  // The idle float: ease the mesh back to rest (so we never snap in from a roll
  // or a hover), then loop a gentle vertical bob and a slight tilt/sway forever.
  // Three.js shadow mapping handles the contact shadow automatically — as the
  // die rises its shadow softens and spreads, no manual work needed.
  const startIdle = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    killIdle();
    const loop = () => {
      idleTweens.current.push(
        gsap.to(mesh.position, {
          y: 0.15,
          duration: 3.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        }),
        gsap.to(mesh.rotation, {
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
      gsap.to(mesh.position, { y: 0, duration: 0.5, ease: "sine.out", onComplete: loop }),
      gsap.to(mesh.rotation, { x: 0, y: 0, z: 0, duration: 0.5, ease: "sine.out" })
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
    const mesh = meshRef.current;
    if (!mesh || rollingRef.current) return;
    rollingRef.current = true;
    killIdle();
    gsap.killTweensOf(mesh.scale);

    const value = Math.floor(Math.random() * 20) + 1;
    const isMax = value >= 20;
    const isMin = value <= 1;

    // Phase 1 — tumble: two full rotations with a random offset and a squish,
    // dropping back to the y:0 baseline so celebration / failure have a known
    // rest position to play from.
    gsap.to(mesh.rotation, {
      x: Math.PI * 4 + gsap.utils.random(-1, 1),
      y: Math.PI * 4 + gsap.utils.random(-1, 1),
      z: gsap.utils.random(-0.8, 0.8),
      duration: 0.5,
      ease: "power2.in",
    });
    gsap.to(mesh.position, { y: 0, duration: 0.5, ease: "power2.in" });
    gsap.to(mesh.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 0.5, ease: "power2.in" });

    // Phase 2 — settle: snap rotation back to square with an overshoot, scale
    // back to 1. When it lands, play the per-result flourish, then resume idle.
    gsap.to(mesh.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.55,
      delay: 0.5,
      ease: "back.out(2.0)",
    });
    gsap.to(mesh.rotation, {
      x: 0,
      y: 0,
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
          gsap.to(mesh.scale, {
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
          gsap.to(mesh.position, {
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

    // Reveal the number / personality line partway through the tumble, matching
    // the cadence the SVG die used.
    gsap.delayedCall(0.4, () => onResultRef.current(value));
  }, [rollNonce, killIdle, startIdle]);

  // Hover lifts and grows the die a touch. We stop the idle loop while held and
  // resume it (easing back to rest) on leave. Ignored mid-roll.
  const handlePointerOver = useCallback(() => {
    if (rollingRef.current) return;
    const mesh = meshRef.current;
    if (!mesh) return;
    killIdle();
    gsap.to(mesh.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 0.3 });
    gsap.to(mesh.position, { y: 0.2, duration: 0.3 });
  }, [killIdle]);

  const handlePointerOut = useCallback(() => {
    if (rollingRef.current) return;
    const mesh = meshRef.current;
    if (!mesh) return;
    gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4 });
    startIdle();
  }, [startIdle]);

  return (
    <group>
      <mesh
        ref={meshRef}
        castShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <icosahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial
          color="#c0392b"
          metalness={0.15}
          roughness={0.55}
          flatShading
        />
      </mesh>
      <pointLight ref={flashRef} position={[0, 0, 0]} color="#c0392b" intensity={0} />
    </group>
  );
}
