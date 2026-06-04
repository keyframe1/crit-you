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
  bright: boolean;
  twLo: number; // twinkle low opacity
  twHi: number; // twinkle high opacity
  twDur: number; // twinkle period
  twDelay: number; // twinkle phase offset
}

// Coloured nebula lights ringing the orb — they cast soft tinted highlights on
// its glossy obsidian surface and breathe slowly between 0.1 and `max`.
const NEBULA = [
  { color: "#1a1a8f", max: 1.2, distance: 5, pos: [1.4, 0.8, 1.2], dur: 5 },
  { color: "#6b2fa0", max: 0.9, distance: 5, pos: [-1.3, 0.6, 1.0], dur: 6.5 },
  { color: "#1a6b6b", max: 0.7, distance: 5, pos: [0.3, -1.4, 1.3], dur: 8 },
] as const;

const STAR_TIERS = [
  { n: 60, rMin: 0.01, rMax: 0.02, oMin: 0.2, oMax: 0.5, bright: false },
  { n: 30, rMin: 0.02, rMax: 0.04, oMin: 0.4, oMax: 0.8, bright: false },
  { n: 10, rMin: 0.04, rMax: 0.07, oMin: 0.7, oMax: 1.0, bright: true },
];

const STAR_PALETTE = ["#ffffff", "#c8d8ff", "#fff8e0"];

// A tiny deterministic PRNG (mulberry32) so the cosmos is generated purely
// during render — same field every mount, no impure Math.random.
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
// space. The orb surface is OPAQUE (so the floor shadow can't bleed through it)
// and breathes a faint nebula emissive; 100 multi-coloured stars in three
// brightness tiers twinkle over it (drawn depth-test-off so they read through
// the solid orb), bright stars wear constellation lines, nebula lights tint the
// gloss, and an ice halo + drifting sparkles wrap it. It turns with a majestic
// spin rather than a tumble.
export default function DInf({ rollNonce, onResult }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const orbMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const starRefs = useRef<(THREE.Mesh | null)[]>([]);
  const nebRefs = useRef<(THREE.PointLight | null)[]>([]);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);
  const atmosMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const rollingRef = useRef(false); // gates the idle spin
  const lockRef = useRef(false); // gates input through the whole roll + reveal

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const { startIdle, killIdle } = useIdleFloat(groupRef, rollingRef, {
    spinSpeed: 0.04,
    floatY: 0.2,
    floatDuration: 5.0,
  });

  // Stars (3 tiers) + constellation segments between bright stars, generated
  // once. All randomness is seeded so this stays pure during render.
  const { stars, linePositions } = useMemo(() => {
    const rand = mulberry32(0x5eed);
    const s: Star[] = [];
    for (const tier of STAR_TIERS) {
      for (let i = 0; i < tier.n; i++) {
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        const r = 1.3 * Math.cbrt(rand());
        const base = tier.oMin + rand() * (tier.oMax - tier.oMin);
        s.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
          size: tier.rMin + rand() * (tier.rMax - tier.rMin),
          color: STAR_PALETTE[Math.floor(rand() * STAR_PALETTE.length)],
          bright: tier.bright,
          twLo: base * 0.4,
          twHi: base,
          twDur: 1.0 + rand() * 2.0,
          twDelay: rand() * 2.0,
        });
      }
    }
    // Constellations link only bright stars (cleaner patterns) — each to its two
    // nearest bright neighbours, deduped.
    const bright = s.map((st, i) => ({ st, i })).filter((e) => e.st.bright);
    const pts: number[] = [];
    const used = new Set<string>();
    for (const { st, i } of bright) {
      const near = bright
        .filter((e) => e.i !== i)
        .sort((a, b) => dist2(st, a.st) - dist2(st, b.st))
        .slice(0, 2);
      for (const { st: other, i: j } of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (used.has(key)) continue;
        used.add(key);
        pts.push(st.x, st.y, st.z, other.x, other.y, other.z);
      }
    }
    return { stars: s, linePositions: new Float32Array(pts) };
  }, []);

  // ── Ambient loops: twinkle / nebula breathing / line pulse / emissive glow ──
  const twinkleTweens = useRef<gsap.core.Tween[]>([]);
  const nebulaTweens = useRef<gsap.core.Tween[]>([]);
  const lineTween = useRef<gsap.core.Tween | null>(null);
  const emissiveTween = useRef<gsap.core.Tween | null>(null);

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
          { intensity: 0.1 },
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

  const startEmissive = useCallback(() => {
    emissiveTween.current?.kill();
    if (!orbMatRef.current) return;
    emissiveTween.current = gsap.fromTo(
      orbMatRef.current,
      { emissiveIntensity: 0.3 },
      { emissiveIntensity: 0.7, duration: 8, yoyo: true, repeat: -1, ease: "sine.inOut" }
    );
  }, []);

  const killAmbient = useCallback(() => {
    twinkleTweens.current.forEach((t) => t.kill());
    twinkleTweens.current = [];
    nebulaTweens.current.forEach((t) => t.kill());
    nebulaTweens.current = [];
    lineTween.current?.kill();
    lineTween.current = null;
    emissiveTween.current?.kill();
    emissiveTween.current = null;
  }, []);

  const restoreAmbient = useCallback(() => {
    startTwinkle();
    startNebula();
    startLinePulse();
    startEmissive();
  }, [startTwinkle, startNebula, startLinePulse, startEmissive]);

  useEffect(() => {
    startIdle();
    restoreAmbient();
    // Capture refs now (stable for this die's lifetime) for unmount teardown.
    const num = numRef.current;
    const grp = groupRef.current;
    const atmos = atmosMatRef.current;
    return () => {
      killIdle();
      killAmbient();
      gsap.killTweensOf(num);
      if (grp) gsap.killTweensOf(grp.scale);
      if (atmos) gsap.killTweensOf(atmos);
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
    if (!g || lockRef.current) return;
    lockRef.current = true;
    rollingRef.current = true;
    killIdle();
    killAmbient();
    hideNumber(numRef.current);

    const value = Math.floor(Math.random() * 100) + 1;
    const isMax = value >= 100;
    const isMin = value <= 1;

    // Flash every star bright, double the nebula lights, and brighten the orb's
    // own glow during the spin.
    starRefs.current.forEach((m) => {
      if (m) gsap.to(m.material as THREE.MeshBasicMaterial, { opacity: 1, duration: 0.3 });
    });
    nebRefs.current.forEach((l, i) => {
      if (l) gsap.to(l, { intensity: NEBULA[i].max * 2, duration: 0.3 });
    });
    if (orbMatRef.current) gsap.to(orbMatRef.current, { emissiveIntensity: 1.0, duration: 0.3 });
    if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0.5, duration: 0.3 });

    gsap.to(g.rotation, {
      y: "+=" + Math.PI * 6,
      duration: 1.6,
      ease: "power2.inOut",
      onComplete: () => {
        // Reveal the number; the bubble waits for the fade-in (onShown), the
        // input lock releases when the whole reveal finishes (onComplete).
        playNumberReveal(
          numRef.current,
          value,
          100,
          CELESTIAL_NUMBER_THEME,
          () => onResultRef.current(value),
          () => {
            lockRef.current = false;
          }
        );
        const resume = () => {
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
          if (orbMatRef.current) gsap.to(orbMatRef.current, { emissiveIntensity: 1.4, duration: 0.2 });
          if (atmosMatRef.current) {
            gsap.fromTo(
              atmosMatRef.current,
              { opacity: 0.04 },
              { opacity: 0.2, duration: 0.5, yoyo: true, repeat: 1, ease: "power2.inOut" }
            );
          }
          gsap.delayedCall(1.0, () => {
            restoreAmbient();
            resume();
          });
        } else if (isMin) {
          // The cosmos dies: stars dim, lines vanish, the orb goes dark.
          starRefs.current.forEach((m) => {
            if (m) gsap.to(m.material as THREE.MeshBasicMaterial, { opacity: 0.05, duration: 0.5 });
          });
          if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0, duration: 0.5 });
          nebRefs.current.forEach((l) => {
            if (l) gsap.to(l, { intensity: 0, duration: 0.5 });
          });
          if (orbMatRef.current) gsap.to(orbMatRef.current, { emissiveIntensity: 0.05, duration: 0.5 });
          // Hold the dark, then let everything fade back as the twinkle resumes.
          gsap.delayedCall(2.0, () => {
            restoreAmbient();
            resume();
          });
        } else {
          restoreAmbient();
          resume();
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
      {/* Opaque obsidian orb with a faint nebula emissive — casts a clean floor
          shadow (no bleed-through) and catches the nebula lights' gloss. */}
      <mesh castShadow receiveShadow={false} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <sphereGeometry args={[1.5, 64, 64]} />
        <meshPhysicalMaterial
          ref={orbMatRef}
          color="#050510"
          metalness={0.1}
          roughness={0.3}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          emissive="#10082a"
          emissiveIntensity={0.3}
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

      {/* Nebula lights ringing the orb. */}
      {NEBULA.map((n, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            nebRefs.current[i] = el;
          }}
          color={n.color}
          intensity={n.max}
          distance={n.distance}
          position={[n.pos[0], n.pos[1], n.pos[2]]}
        />
      ))}

      {/* Constellation lines (bright stars), drawn over the opaque orb. */}
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
            depthTest={false}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {/* Twinkling, multi-coloured stars — depth-test off so they read through
          the solid orb as a deep-space field. */}
      {stars.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, s.y, s.z]}
          ref={(el) => {
            starRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[s.size, 8, 8]} />
          <meshBasicMaterial
            color={s.color}
            transparent
            opacity={s.twHi}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Drifting particle ring around the orb. */}
      <Sparkles count={40} size={1.5} scale={[4, 4, 4]} speed={0.3} opacity={0.3} color="#94b8ff" />

      <OnFaceNumber ref={numRef} theme={CELESTIAL_NUMBER_THEME} />
    </group>
  );
}

function dist2(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}
