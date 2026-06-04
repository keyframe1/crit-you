"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Sparkles, Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { useIdleFloat } from "./useIdleFloat";

interface Props {
  rollNonce: number;
  onResult: (value: number) => void; // fired once the orb resolves
  onRollStart?: () => void; // fired when a fresh roll's spin begins
}

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  bright: boolean;
  d20: boolean; // part of the hidden d20 constellation (vertex star)
  twLo: number; // twinkle low opacity
  twHi: number; // twinkle high opacity
  twDur: number; // twinkle period
  twDelay: number; // twinkle phase offset
}

interface DistantStar {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  color: string;
}

// Coloured nebula lights ringing the orb — they cast soft tinted highlights on
// its glossy obsidian surface and breathe slowly between 0.1 and `max`.
const NEBULA = [
  { color: "#1a1a8f", max: 1.2, distance: 5, pos: [1.4, 0.8, 1.2], dur: 5 },
  { color: "#6b2fa0", max: 0.9, distance: 5, pos: [-1.3, 0.6, 1.0], dur: 6.5 },
  { color: "#1a6b6b", max: 0.7, distance: 5, pos: [0.3, -1.4, 1.3], dur: 8 },
] as const;

// Random star field, three brightness tiers. The bright tier is kept SMALL in
// radius — the twinkle comes from opacity, not bulk — so the field reads as
// crisp pinpricks rather than bloomed blobs.
const STAR_TIERS = [
  { n: 60, rMin: 0.01, rMax: 0.02, oMin: 0.2, oMax: 0.5, bright: false },
  { n: 30, rMin: 0.02, rMax: 0.04, oMin: 0.4, oMax: 0.8, bright: false },
  { n: 10, rMin: 0.035, rMax: 0.045, oMin: 0.7, oMax: 1.0, bright: true },
];

const STAR_PALETTE = ["#ffffff", "#c8d8ff", "#fff8e0"];

// THE HIDDEN d20 — six bright stars at the vertices of the reroll d20's hexagon
// projection (scaled to ~0.8 inside the orb), wired into the icosahedron's
// outline + triangulation. An easter egg: a d20 traced in the stars, there if
// you look for it but never obvious.
const D20_VERTS: [number, number, number][] = [
  [0, 0.8, 0], // 0 top
  [0.7, 0.35, 0], // 1 upper-right
  [0.7, -0.35, 0], // 2 lower-right
  [0, -0.8, 0], // 3 bottom
  [-0.7, -0.35, 0], // 4 lower-left
  [-0.7, 0.35, 0], // 5 upper-left
];
const D20_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], // hexagon outline
  [0, 3], // vertical seam
  [5, 2], [1, 4], // long diagonals
  [0, 4], [0, 2], [5, 3], [1, 3], // corner spokes
  [5, 1], [4, 2], // top + bottom horizontals
];
const D20_LINE_POSITIONS = new Float32Array(
  D20_EDGES.flatMap(([a, b]) => [...D20_VERTS[a], ...D20_VERTS[b]])
);

// Barely-there coloured fog inside the orb — interior depth you feel more than
// see. If a blob is clearly visible, the opacity is too high.
const NEBULA_FOG = [
  { pos: [0.4, 0.3, -0.2], radius: 0.45, color: "#1a2a6b", opacity: 0.05 }, // deep blue
  { pos: [-0.5, -0.2, 0.3], radius: 0.4, color: "#3a1a5a", opacity: 0.045 }, // violet
  { pos: [0.1, -0.45, -0.3], radius: 0.35, color: "#1a4a5a", opacity: 0.04 }, // teal
] as const;

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
// and breathes a faint nebula emissive. Over it: ~100 twinkling stars in three
// tiers, a layer of tiny static "distant" stars for volume, a hidden d20
// constellation, cross-flare sparkles on the brightest stars, faint coloured
// nebula fog, nebula lights tinting the gloss, a slow Saturn-like orbital ring,
// an ice halo, and drifting sparkles. All depth-test-off layers read through the
// solid orb. It turns with a majestic spin rather than a tumble.
export default function DInf({ rollNonce, onResult, onRollStart }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const orbMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const starRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sparkleMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const nebRefs = useRef<(THREE.PointLight | null)[]>([]);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);
  const atmosMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null); // slow independent orbital ring
  const haloRef = useRef<THREE.Mesh>(null); // nat-100 celebration halo ring
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const rollingRef = useRef(false); // gates the idle spin
  const lockRef = useRef(false); // gates input through the whole roll + reveal
  const rollGenRef = useRef(0); // increments each roll; stale reactions bail
  const boostRef = useRef(true); // exaggerated idle float until the first roll

  const onResultRef = useRef(onResult);
  const onRollStartRef = useRef(onRollStart);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(() => {
    onRollStartRef.current = onRollStart;
  }, [onRollStart]);

  const { startIdle, killIdle } = useIdleFloat(
    groupRef,
    rollingRef,
    { spinSpeed: 0.04, floatY: 0.2, floatDuration: 5.0 },
    boostRef
  );

  // The cosmos, generated once and seeded so it's pure during render: the random
  // tiers, the random constellation web (linked before the d20 stars join so the
  // easter egg stays a clean shape), the hidden d20 stars, the static distant
  // depth field, and which bright stars wear cross-flares.
  const { stars, linePositions, distantStars, sparkleStars } = useMemo(() => {
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
          d20: false,
          twLo: base * 0.4,
          twHi: base,
          twDur: 1.0 + rand() * 2.0,
          twDelay: rand() * 2.0,
        });
      }
    }
    // Constellations link only the RANDOM bright stars — each to its two nearest
    // bright neighbours, deduped.
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
    // Cross-flares ride the random bright tier only (the d20 stars get their
    // identity from the constellation lines). Captured before the d20 stars join.
    const spk = s.filter((st) => st.bright && !st.d20);
    // The hidden d20: six prominent, brightest stars at the wireframe vertices.
    for (const [x, y, z] of D20_VERTS) {
      s.push({
        x,
        y,
        z,
        size: 0.05,
        color: "#ffffff",
        bright: true,
        d20: true,
        twLo: 0.7,
        twHi: 0.9,
        twDur: 2.5 + rand() * 1.5,
        twDelay: rand() * 2.0,
      });
    }
    // Distant depth stars — many, tiny, dim, STATIC (no twinkle): texture that
    // turns a flat dot-field into a volume you look INTO.
    const distant: DistantStar[] = [];
    for (let i = 0; i < 45; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = 1.35 * Math.cbrt(rand());
      distant.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        size: 0.008 + rand() * 0.004,
        opacity: 0.1 + rand() * 0.15,
        color: STAR_PALETTE[Math.floor(rand() * STAR_PALETTE.length)],
      });
    }
    return { stars: s, linePositions: new Float32Array(pts), distantStars: distant, sparkleStars: spk };
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
    // Cross-flares twinkle in sync with their star but at half amplitude (star
    // 1.0 → flare 0.4, star 0.3 → flare ~0.1).
    sparkleStars.forEach((st, bi) => {
      [sparkleMatRefs.current[bi * 2], sparkleMatRefs.current[bi * 2 + 1]].forEach((mat) => {
        if (!mat) return;
        gsap.set(mat, { opacity: st.twLo * 0.4 });
        twinkleTweens.current.push(
          gsap.to(mat, {
            opacity: st.twHi * 0.4,
            duration: st.twDur,
            delay: st.twDelay,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          })
        );
      });
    });
  }, [stars, sparkleStars]);

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
    const grp = groupRef.current;
    const atmos = atmosMatRef.current;
    const halo = haloRef.current;
    const haloMat = haloMatRef.current;
    return () => {
      killIdle();
      killAmbient();
      if (grp) gsap.killTweensOf(grp.scale);
      if (atmos) gsap.killTweensOf(atmos);
      if (halo) gsap.killTweensOf(halo.scale);
      if (haloMat) gsap.killTweensOf(haloMat);
    };
  }, [startIdle, killIdle, restoreAmbient, killAmbient]);

  // The orbital ring turns on its own slow clock (opposite the orb's idle spin),
  // so the celestial die always has a little independent motion.
  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.z -= delta * 0.03;
  });

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
    boostRef.current = false; // first roll calms the exaggerated idle float
    // Generation token: the cosmic nat-1 recovery runs longer than the input
    // lock, so a stale resume from a previous roll must not resume idle once a
    // newer roll has taken over.
    const myGen = ++rollGenRef.current;
    killIdle();
    killAmbient();
    // A fresh roll has begun: let the page clear the previous result number.
    onRollStartRef.current?.();

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
        // The celestial die doesn't "thud" — it RESOLVES. A gentle scale pulse
        // (no impact), and only then is the value reported: the page fades the
        // CSS-overlay number in and raises the bubble. The input lock is held
        // until the cosmos recovery finishes (see resume).
        const reveal = () => {
          onResultRef.current(value);
          resolveCosmos();
        };
        // Ethereal resolve pulse: scale 1 → 1.02 → 1 over 0.4s, then reveal.
        if (g) {
          gsap.to(g.scale, {
            x: 1.02,
            y: 1.02,
            z: 1.02,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: "sine.inOut",
            onComplete: reveal,
          });
        } else {
          reveal();
        }

        const resume = () => {
          if (rollGenRef.current !== myGen) return; // a newer roll owns the die
          rollingRef.current = false;
          startIdle();
          lockRef.current = false;
        };

        function resolveCosmos() {
        if (isMax) {
          // COSMIC EVENT: every star blazes, constellations flare, the nebula
          // lights triple, the orb glows, the atmosphere pulses outward, and a
          // halo ring blooms and fades.
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
              { opacity: 0.15, duration: 0.5, yoyo: true, repeat: 1, ease: "power2.inOut" }
            );
          }
          // Halo ring: blooms from the orb's edge outward (radius ~1.6 → ~2.5)
          // while fading, over 0.8s.
          const halo = haloRef.current;
          const haloMat = haloMatRef.current;
          if (halo && haloMat) {
            gsap.killTweensOf(halo.scale);
            gsap.killTweensOf(haloMat);
            gsap.fromTo(halo.scale, { x: 1, y: 1, z: 1 }, { x: 1.55, y: 1.55, z: 1.55, duration: 0.8, ease: "power2.out" });
            gsap.fromTo(haloMat, { opacity: 0.4 }, { opacity: 0, duration: 0.8, ease: "power2.out" });
          }
          // The overlay already brightens the d∞ number's glow on a nat-100 (see
          // getNumberStyle), so the cosmos only needs to settle the field back.
          gsap.delayedCall(1.0, () => {
            restoreAmbient();
            resume();
          });
        } else if (isMin) {
          // COSMIC DARKNESS: stars gutter to near-black, constellations vanish,
          // the nebula lights die and the orb goes dark. Hold the void, then let
          // the stars twinkle back one by one (staggered) before ambient resumes.
          starRefs.current.forEach((m) => {
            if (m) gsap.to(m.material as THREE.MeshBasicMaterial, { opacity: 0.03, duration: 0.5 });
          });
          if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0, duration: 0.5 });
          nebRefs.current.forEach((l) => {
            if (l) gsap.to(l, { intensity: 0, duration: 0.5 });
          });
          if (orbMatRef.current) gsap.to(orbMatRef.current, { emissiveIntensity: 0.02, duration: 0.5 });
          gsap.delayedCall(1.5, () => {
            // Staggered revival: each star fades back on its own slight delay.
            starRefs.current.forEach((m, i) => {
              if (m)
                gsap.to(m.material as THREE.MeshBasicMaterial, {
                  opacity: stars[i].twHi,
                  duration: 1.0,
                  delay: i * 0.01,
                  ease: "sine.out",
                });
            });
            if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0.3, duration: 1.0 });
            nebRefs.current.forEach((l, i) => {
              if (l) gsap.to(l, { intensity: NEBULA[i].max * 0.5, duration: 1.0 });
            });
            if (orbMatRef.current) gsap.to(orbMatRef.current, { emissiveIntensity: 0.5, duration: 1.0 });
            // Once the field is back, hand control to the looping ambient + idle.
            gsap.delayedCall(1.0, () => {
              restoreAmbient();
              resume();
            });
          });
        } else {
          restoreAmbient();
          resume();
        }
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

      {/* Faint coloured nebula fog — interior depth that drifts as the orb turns.
          depth-test off so it reads through the opaque orb. */}
      {NEBULA_FOG.map((f, i) => (
        <mesh key={`fog-${i}`} position={[f.pos[0], f.pos[1], f.pos[2]]}>
          <sphereGeometry args={[f.radius, 16, 16]} />
          <meshBasicMaterial
            color={f.color}
            transparent
            opacity={f.opacity}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}

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

      {/* Distant depth stars — tiny, dim, static (no twinkle). */}
      {distantStars.map((s, i) => (
        <mesh key={`dist-${i}`} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[s.size, 6, 6]} />
          <meshBasicMaterial
            color={s.color}
            transparent
            opacity={s.opacity}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Random constellation lines (bright stars), drawn over the opaque orb. */}
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

      {/* The hidden d20 constellation — its wireframe traced in the brightest
          stars, a touch brighter than the random web. An easter egg. */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[D20_LINE_POSITIONS, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#a9c4ff"
          transparent
          opacity={0.35}
          depthTest={false}
          depthWrite={false}
        />
      </lineSegments>

      {/* Twinkling, multi-coloured stars (random field + hidden d20 vertices) —
          depth-test off so they read through the solid orb as a deep-space
          field. */}
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

      {/* Cross-flares on the brightest stars — two crossed planes billboarded to
          the camera, so each reads as a 4-point sparkle instead of a round dot. */}
      {sparkleStars.map((s, bi) => (
        <Billboard key={`spk-${bi}`} position={[s.x, s.y, s.z]}>
          <mesh>
            <planeGeometry args={[0.12, 0.01]} />
            <meshBasicMaterial
              ref={(el) => {
                sparkleMatRefs.current[bi * 2] = el;
              }}
              color="#ffffff"
              transparent
              opacity={0.3}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[0.12, 0.01]} />
            <meshBasicMaterial
              ref={(el) => {
                sparkleMatRefs.current[bi * 2 + 1] = el;
              }}
              color="#ffffff"
              transparent
              opacity={0.3}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      ))}

      {/* Drifting particle ring around the orb. */}
      <Sparkles count={40} size={1.5} scale={[4, 4, 4]} speed={0.3} opacity={0.3} color="#94b8ff" />

      {/* Saturn-like orbital ring — tilted off-horizontal, occluded by the orb
          where it passes behind, turning on its own slow clock (see useFrame). */}
      <group rotation={[THREE.MathUtils.degToRad(15), 0, 0]}>
        <mesh ref={ringRef}>
          <torusGeometry args={[1.6, 0.008, 8, 64]} />
          <meshBasicMaterial color="#94b8ff" transparent opacity={0.15} depthWrite={false} />
        </mesh>
      </group>

      {/* Nat-100 celebration halo — billboarded so it always faces the camera,
          invisible (opacity 0) until a cosmic event blooms it outward. */}
      <Billboard>
        <mesh ref={haloRef}>
          <ringGeometry args={[1.5, 1.62, 64]} />
          <meshBasicMaterial
            ref={haloMatRef}
            color="#94b8ff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

function dist2(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}
