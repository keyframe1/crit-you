"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { Sparkles } from "@react-three/drei";
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
  size: number;
  color: string;
  twLo: number; // twinkle low opacity
  twHi: number; // twinkle high opacity
  twDur: number; // twinkle period
  twDelay: number; // twinkle phase offset
}

// Coloured nebula lights drifting inside the orb — they tint the obsidian
// interior like distant gas clouds. Breathe slowly between 0.05 and `max`.
const NEBULA = [
  { color: "#1a1a8f", max: 0.3, distance: 2, pos: [0.5, 0.3, 0.4], dur: 5 },
  { color: "#6b2fa0", max: 0.2, distance: 1.5, pos: [-0.4, 0.5, -0.3], dur: 6.5 },
  { color: "#1a6b6b", max: 0.15, distance: 1.5, pos: [0.2, -0.5, 0.5], dur: 8 },
] as const;

// A tiny deterministic PRNG (mulberry32) so the star field is generated purely
// during render — same cosmos every mount, no impure Math.random.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// THE CELESTIAL (d100) — a polished obsidian orb that is a window into deep
// space: dozens of twinkling, multi-coloured stars within, faint constellation
// lines, slow-breathing nebula lights, an ice-blue atmosphere, and drifting
// sparkles. It does not tumble; it turns with a majestic spin.
export default function DInf({ rollNonce, onResult }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const starRefs = useRef<(THREE.Mesh | null)[]>([]);
  const nebRefs = useRef<(THREE.PointLight | null)[]>([]);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);
  const atmosMatRef = useRef<THREE.MeshBasicMaterial>(null);
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

  // Stars (in the orb's volume) + constellation segments, generated once. All
  // randomness is seeded so this stays pure during render.
  const { stars, linePositions } = useMemo(() => {
    const rand = mulberry32(0x5eed);
    const palette = ["#ffffff", "#c8d8ff", "#fff8e0"];
    const s: Star[] = [];
    for (let i = 0; i < 70; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = 1.3 * Math.cbrt(rand());
      const bright = i < 14;
      s.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        size: bright ? 0.04 + rand() * 0.02 : 0.015 + rand() * 0.025,
        color: palette[Math.floor(rand() * 3)],
        twLo: 0.2,
        twHi: 0.6 + rand() * 0.4,
        twDur: 1.0 + rand() * 2.0,
        twDelay: rand() * 2.0,
      });
    }
    // Constellation: link nearest-neighbour pairs (deduped), capped at 16.
    const pts: number[] = [];
    const used = new Set<string>();
    for (let i = 0; i < s.length && pts.length / 6 < 16; i++) {
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < s.length; j++) {
        if (i === j) continue;
        const d = (s[i].x - s[j].x) ** 2 + (s[i].y - s[j].y) ** 2 + (s[i].z - s[j].z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      if (best < 0) continue;
      const key = i < best ? `${i}-${best}` : `${best}-${i}`;
      if (used.has(key)) continue;
      used.add(key);
      pts.push(s[i].x, s[i].y, s[i].z, s[best].x, s[best].y, s[best].z);
    }
    return { stars: s, linePositions: new Float32Array(pts) };
  }, []);

  // ── Ambient loops (twinkle / nebula breathing / line pulse) ────────────────
  const twinkleTweens = useRef<gsap.core.Tween[]>([]);
  const nebulaTweens = useRef<gsap.core.Tween[]>([]);
  const lineTween = useRef<gsap.core.Tween | null>(null);

  const startTwinkle = useCallback(() => {
    twinkleTweens.current.forEach((t) => t.kill());
    twinkleTweens.current = [];
    starRefs.current.forEach((m, i) => {
      if (!m) return;
      const st = stars[i];
      const mat = m.material as THREE.MeshBasicMaterial;
      gsap.set(mat, { opacity: st.twLo });
      twinkleTweens.current.push(
        gsap.to(mat, {
          opacity: st.twHi,
          duration: st.twDur,
          delay: st.twDelay,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        })
      );
    });
  }, [stars]);

  const startNebula = useCallback(() => {
    nebulaTweens.current.forEach((t) => t.kill());
    nebulaTweens.current = [];
    nebRefs.current.forEach((l, i) => {
      if (!l) return;
      nebulaTweens.current.push(
        gsap.fromTo(
          l,
          { intensity: 0.05 },
          { intensity: NEBULA[i].max, duration: NEBULA[i].dur, yoyo: true, repeat: -1, ease: "sine.inOut" }
        )
      );
    });
  }, []);

  const startLinePulse = useCallback(() => {
    lineTween.current?.kill();
    if (!lineMatRef.current) return;
    lineTween.current = gsap.fromTo(
      lineMatRef.current,
      { opacity: 0.15 },
      { opacity: 0.4, duration: 4, yoyo: true, repeat: -1, ease: "sine.inOut" }
    );
  }, []);

  const killAmbient = useCallback(() => {
    twinkleTweens.current.forEach((t) => t.kill());
    twinkleTweens.current = [];
    nebulaTweens.current.forEach((t) => t.kill());
    nebulaTweens.current = [];
    lineTween.current?.kill();
    lineTween.current = null;
  }, []);

  const restoreAmbient = useCallback(() => {
    startTwinkle();
    startNebula();
    startLinePulse();
  }, [startTwinkle, startNebula, startLinePulse]);

  useEffect(() => {
    startIdle();
    restoreAmbient();
    return () => {
      killIdle();
      killAmbient();
    };
  }, [startIdle, killIdle, restoreAmbient, killAmbient]);

  // ── Roll: a majestic 3-turn spin, with the cosmos flaring during it ────────
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
    killAmbient();
    hideNumber(numRef.current);

    const value = Math.floor(Math.random() * 100) + 1;
    const isMax = value >= 100;
    const isMin = value <= 1;

    // Flash every star bright and double the nebula lights during the spin.
    starRefs.current.forEach((m) => {
      if (m) gsap.to(m.material as THREE.MeshBasicMaterial, { opacity: 1, duration: 0.3 });
    });
    nebRefs.current.forEach((l, i) => {
      if (l) gsap.to(l, { intensity: NEBULA[i].max * 2, duration: 0.3 });
    });
    if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0.5, duration: 0.3 });

    gsap.to(g.rotation, {
      y: "+=" + Math.PI * 6,
      duration: 1.6,
      ease: "power2.inOut",
      onComplete: () => {
        playNumberReveal(numRef.current, value, 100, CELESTIAL_NUMBER_THEME);
        onResultRef.current(value);
        const finish = () => {
          rollingRef.current = false;
          startIdle();
        };

        if (isMax) {
          // Cosmic event: everything blazes, the atmosphere pulses outward.
          starRefs.current.forEach((m) => {
            if (m) gsap.to(m.material as THREE.MeshBasicMaterial, { opacity: 1, duration: 0.2 });
          });
          if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0.8, duration: 0.2 });
          nebRefs.current.forEach((l, i) => {
            if (l) gsap.to(l, { intensity: NEBULA[i].max * 3, duration: 0.2 });
          });
          if (atmosMatRef.current) {
            gsap.fromTo(
              atmosMatRef.current,
              { opacity: 0.04 },
              { opacity: 0.2, duration: 0.5, yoyo: true, repeat: 1, ease: "power2.inOut" }
            );
          }
          gsap.delayedCall(1.0, () => {
            restoreAmbient();
            finish();
          });
        } else if (isMin) {
          // The cosmos dies: stars dim, lines vanish, lights fade out.
          starRefs.current.forEach((m) => {
            if (m) gsap.to(m.material as THREE.MeshBasicMaterial, { opacity: 0.05, duration: 0.5 });
          });
          if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0, duration: 0.5 });
          nebRefs.current.forEach((l) => {
            if (l) gsap.to(l, { intensity: 0, duration: 0.5 });
          });
          // Hold the dark, then let everything fade back as the twinkle resumes.
          gsap.delayedCall(2.0, () => {
            restoreAmbient();
            finish();
          });
        } else {
          restoreAmbient();
          finish();
        }
      },
    });
  }, [rollNonce, killIdle, killAmbient, startIdle, restoreAmbient]);

  const handlePointerOver = useCallback(() => {
    if (rollingRef.current) return;
    const g = groupRef.current;
    if (!g) return;
    killIdle();
    gsap.to(g.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 0.3 });
    gsap.to(g.position, { y: 0.2, duration: 0.3 });
    if (atmosMatRef.current) gsap.to(atmosMatRef.current, { opacity: 0.08, duration: 0.3 });
  }, [killIdle]);

  const handlePointerOut = useCallback(() => {
    if (rollingRef.current) return;
    const g = groupRef.current;
    if (!g) return;
    gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.4 });
    if (atmosMatRef.current) gsap.to(atmosMatRef.current, { opacity: 0.04, duration: 0.3 });
    startIdle();
  }, [startIdle]);

  return (
    <group ref={groupRef}>
      {/* Polished obsidian orb — depthWrite off so the inner stars read through
          the glassy front; double-sided so the nebula lights tint the interior. */}
      <mesh castShadow onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <sphereGeometry args={[1.5, 64, 64]} />
        <meshPhysicalMaterial
          color="#0a0a1a"
          metalness={0.1}
          roughness={0.3}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          transparent
          opacity={0.6}
          side={2}
          depthWrite={false}
        />
      </mesh>

      {/* Ice-blue atmospheric halo. */}
      <mesh>
        <sphereGeometry args={[1.58, 48, 48]} />
        <meshBasicMaterial
          ref={atmosMatRef}
          color="#94b8ff"
          transparent
          opacity={0.04}
          depthWrite={false}
        />
      </mesh>

      {/* Nebula lights inside the orb. */}
      {NEBULA.map((n, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            nebRefs.current[i] = el;
          }}
          color={n.color}
          intensity={n.max}
          distance={n.distance}
          position={n.pos as unknown as [number, number, number]}
        />
      ))}

      {/* Constellation lines. */}
      {linePositions.length >= 6 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            ref={lineMatRef}
            color="#94b8ff"
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {/* Twinkling, multi-coloured stars inside the orb. */}
      {stars.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, s.y, s.z]}
          ref={(el) => {
            starRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[s.size, 8, 8]} />
          <meshBasicMaterial color={s.color} transparent opacity={s.twHi} depthWrite={false} />
        </mesh>
      ))}

      {/* Drifting particle ring around the orb. */}
      <Sparkles count={40} size={1.5} scale={[4, 4, 4]} speed={0.3} opacity={0.3} color="#94b8ff" />

      <OnFaceNumber ref={numRef} theme={CELESTIAL_NUMBER_THEME} />
    </group>
  );
}
