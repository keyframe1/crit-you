"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { Line } from "@react-three/drei";
import gsap from "gsap";
import { useIdleFloat } from "./useIdleFloat";
import {
  OnFaceNumber,
  CELESTIAL_NUMBER_THEME,
  playNumberReveal,
  hideNumber,
} from "./dieNumber";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void;
}

interface Star {
  x: number;
  y: number;
  z: number;
  o: number; // base opacity
}

// A tiny deterministic PRNG (mulberry32) so the star field is generated purely
// during render — same constellation every mount, no impure Math.random.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// THE CELESTIAL (d100) — a dark, semi-transparent globe scattered with twinkling
// stars and faint constellation lines, wrapped in a soft ice-blue halo. It does
// not tumble: it turns with a slow majestic spin. Stars sit just outside the
// core so the near hemisphere reads clearly and the far side is hidden by the
// globe, like a real star sphere.
export default function DInf({ rollNonce, onResult }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const starRefs = useRef<(THREE.Mesh | null)[]>([]);
  const numRef = useRef<HTMLDivElement>(null);
  const rollingRef = useRef(false);

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const { startIdle, killIdle } = useIdleFloat(groupRef, rollingRef, {
    spinSpeed: 0.04,
    floatY: 0.2,
    floatDuration: 5.0,
  });

  // Stars on a sphere just outside the core, generated once.
  const stars = useMemo<Star[]>(() => {
    const rand = mulberry32(0x5eed);
    const out: Star[] = [];
    const R = 1.52;
    for (let i = 0; i < 24; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      out.push({
        x: R * Math.sin(phi) * Math.cos(theta),
        y: R * Math.sin(phi) * Math.sin(theta),
        z: R * Math.cos(phi),
        o: 0.4 + rand() * 0.5,
      });
    }
    return out;
  }, []);

  // Constellation segments: each star links to its nearest neighbour (deduped).
  const linePoints = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    const used = new Set<string>();
    stars.forEach((s, i) => {
      let best = -1;
      let bestD = Infinity;
      stars.forEach((t, j) => {
        if (i === j) return;
        const d = (s.x - t.x) ** 2 + (s.y - t.y) ** 2 + (s.z - t.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      if (best < 0) return;
      const key = i < best ? `${i}-${best}` : `${best}-${i}`;
      if (used.has(key)) return;
      used.add(key);
      pts.push([s.x, s.y, s.z], [stars[best].x, stars[best].y, stars[best].z]);
    });
    return pts;
  }, [stars]);

  useEffect(() => {
    startIdle();
    return () => killIdle();
  }, [startIdle, killIdle]);

  // Independent per-star twinkle on each star's material opacity.
  useEffect(() => {
    const tweens: gsap.core.Tween[] = [];
    starRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const base = stars[i].o;
      const hi = Math.min(1, base + 0.3);
      const lo = Math.max(0.2, base - 0.2);
      gsap.set(mat, { opacity: lo });
      tweens.push(
        gsap.to(mat, {
          opacity: hi,
          duration: 1.5 + Math.random() * 1.5,
          delay: Math.random() * 2,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        })
      );
    });
    return () => tweens.forEach((t) => t.kill());
  }, [stars]);

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
    hideNumber(numRef.current);

    const value = Math.floor(Math.random() * 100) + 1;
    const isMax = value >= 100;

    // No chaotic tumble — a slow, majestic two-turn spin.
    gsap.to(g.rotation, {
      y: "+=" + Math.PI * 4,
      duration: 1.4,
      ease: "power2.inOut",
      onComplete: () => {
        playNumberReveal(numRef.current, value, 100, CELESTIAL_NUMBER_THEME);
        onResultRef.current(value);
        if (isMax && glowMatRef.current) {
          // A cosmic flare from the halo on a perfect 100.
          gsap.fromTo(
            glowMatRef.current,
            { opacity: 0.4 },
            { opacity: 0.05, duration: 1.2, ease: "power2.out" }
          );
        }
        rollingRef.current = false;
        startIdle();
      },
    });
  }, [rollNonce, killIdle, startIdle]);

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
      {/* Dark core globe. */}
      <mesh castShadow onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshStandardMaterial
          color="#0a0a18"
          metalness={0.3}
          roughness={0.7}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Soft atmospheric halo. */}
      <mesh>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial
          ref={glowMatRef}
          color="#94b8ff"
          transparent
          opacity={0.05}
          depthWrite={false}
        />
      </mesh>

      {/* Constellation lines between nearby stars. */}
      {linePoints.length >= 2 && (
        <Line points={linePoints} segments color="#94b8ff" transparent opacity={0.25} lineWidth={1} />
      )}

      {/* Twinkling stars on the globe surface. */}
      {stars.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, s.y, s.z]}
          ref={(el) => {
            starRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={s.o} />
        </mesh>
      ))}

      <OnFaceNumber ref={numRef} theme={CELESTIAL_NUMBER_THEME} />
    </group>
  );
}
