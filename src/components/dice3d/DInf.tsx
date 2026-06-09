"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Sparkles, Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { useIdleFloat } from "./useIdleFloat";
import { rollCelestial, type CelestialMeta } from "@/lib/celestial";

interface Props {
  rollNonce: number;
  // Fired once the orb resolves: the numeric magnitude plus the celestial meta
  // (the glyph/number to show and the exact reference-line key).
  onResult: (value: number, meta?: CelestialMeta) => void;
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
// outline + triangulation. The only constellation inside the sphere, so it reads
// clearly: a d20 traced in the stars, an easter egg there if you look for it.
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

// Barely-there coloured fog INSIDE the orb — interior depth that shows as subtle
// colour shifts as the orb turns.
const NEBULA_FOG = [
  { pos: [0.4, 0.3, -0.2], radius: 0.45, color: "#1a2a6b", opacity: 0.1 }, // deep blue
  { pos: [-0.5, -0.2, 0.3], radius: 0.4, color: "#3a1a5a", opacity: 0.085 }, // violet
  { pos: [0.1, -0.45, -0.3], radius: 0.35, color: "#1a4a5a", opacity: 0.07 }, // teal
] as const;

// The comet's tail — eight spheres, each smaller and fainter than the last,
// fading in colour from icy white-blue to the deep-space blue.
const TRAIL_SIZES = [0.035, 0.03, 0.025, 0.02, 0.018, 0.015, 0.012, 0.01];
const TRAIL_OPACITIES = [0.7, 0.5, 0.35, 0.25, 0.18, 0.12, 0.08, 0.04];
const TRAIL_COLOR_A = new THREE.Color("#b0c8ff");
const TRAIL_COLOR_B = new THREE.Color("#94b8ff");
const TRAIL_COLORS = TRAIL_SIZES.map((_, i) =>
  new THREE.Color().lerpColors(TRAIL_COLOR_A, TRAIL_COLOR_B, i / (TRAIL_SIZES.length - 1)).getStyle()
);
const COMET_RADIUS = 1.65; // matches the orbital ring
const COMET_BASE_SPEED = 0.8; // ~one orbit every 8s

// The hero star — the luminous heart of the cosmos, upper-left of centre where
// the bright glow already sits.
const HERO_POS: [number, number, number] = [-0.25, 0.35, 0.1];

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

// A soft radial-gradient texture on an offscreen canvas — the basis for the hero
// star's glow. The feathered alpha falloff dissolves with no hard edge to clip.
function radialTexture(stops: [number, string][], size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// A soft 4-point diffraction spike (a blurred plus/cross with tapering arms and a
// bright core) for the hero star — the "pop".
function spikeTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  ctx.filter = "blur(2px)";
  // Long thin arms, brightest at centre, tapering to transparent at the ends.
  const arm = (horizontal: boolean) => {
    const g = horizontal
      ? ctx.createLinearGradient(0, 0, size, 0)
      : ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "rgba(210,230,255,0)");
    g.addColorStop(0.5, "rgba(220,235,255,0.85)");
    g.addColorStop(1, "rgba(210,230,255,0)");
    ctx.fillStyle = g;
    if (horizontal) ctx.fillRect(0, c - 1.5, size, 3);
    else ctx.fillRect(c - 1.5, 0, 3, size);
  };
  arm(true);
  arm(false);
  ctx.filter = "none";
  // A soft bright core where the arms meet.
  const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.1);
  core.addColorStop(0, "rgba(255,255,255,0.95)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// THE CELESTIAL (weighted d1000) — a polished obsidian orb that is a window into deep
// space, sitting on the clean cream background with only its natural floor
// shadow (no exterior atmosphere). Over the orb: ~100 twinkling stars + a static
// "distant" depth field, the hidden d20 constellation, cross-flare sparkles, a
// brilliant hero star, faint interior nebula fog, nebula lights, and a tilted
// Saturn-like ring with a comet + trail. All depth-test-off layers read through
// the solid orb. It RESOLVES with a majestic spin rather than a tumble.
export default function DInf({ rollNonce, onResult, onRollStart }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const orbMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const starRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sparkleMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const nebRefs = useRef<(THREE.PointLight | null)[]>([]);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null); // the d20 constellation
  const atmosMatRef = useRef<THREE.MeshBasicMaterial>(null); // ice halo (hover)
  const heroCoreMatRef = useRef<THREE.MeshBasicMaterial>(null); // hero star core
  const heroGlowRef = useRef<THREE.Sprite>(null);
  const heroGlowMatRef = useRef<THREE.SpriteMaterial>(null);
  const heroSpikeRef = useRef<THREE.Sprite>(null);
  const heroSpikeMatRef = useRef<THREE.SpriteMaterial>(null);
  const ringSysRef = useRef<THREE.Group>(null); // ring + comet + trail, counter-spins
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const cometRef = useRef<THREE.Mesh>(null);
  const trailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trailMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const cometAngle = useRef(0);
  const cometSpeed = useRef(COMET_BASE_SPEED);
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

  // Soft canvas textures for the hero star's glow + diffraction spike, built once
  // (client-only; this die is dynamically imported with ssr:false).
  const { heroGlowTex, heroSpikeTex } = useMemo(
    () => ({
      heroGlowTex: radialTexture([
        [0, "rgba(255,255,255,0.90)"],
        [0.25, "rgba(200,224,255,0.60)"],
        [0.6, "rgba(148,184,255,0.15)"],
        [1, "rgba(148,184,255,0.0)"],
      ]),
      heroSpikeTex: spikeTexture(),
    }),
    []
  );
  useEffect(
    () => () => {
      heroGlowTex.dispose();
      heroSpikeTex.dispose();
    },
    [heroGlowTex, heroSpikeTex]
  );

  // The cosmos, generated once and seeded so it's pure during render: the random
  // tiers, the hidden d20 stars, the static distant depth field, and which bright
  // stars wear cross-flares.
  const { stars, distantStars, sparkleStars } = useMemo(() => {
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
    // Cross-flares ride the random bright tier only. Captured before the d20
    // stars join.
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
    return { stars: s, distantStars: distant, sparkleStars: spk };
  }, []);

  // ── Ambient loops: twinkle / nebula / line / emissive / halo / hero ─────────
  const twinkleTweens = useRef<gsap.core.Tween[]>([]);
  const nebulaTweens = useRef<gsap.core.Tween[]>([]);
  const lineTween = useRef<gsap.core.Tween | null>(null);
  const emissiveTween = useRef<gsap.core.Tween | null>(null);
  const heroTweens = useRef<gsap.core.Tween[]>([]);

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

  // The d20 constellation breathes gently around a clearly-readable level.
  const startLinePulse = useCallback(() => {
    lineTween.current?.kill();
    if (!lineMatRef.current) return;
    lineTween.current = gsap.fromTo(
      lineMatRef.current,
      { opacity: 0.3 },
      { opacity: 0.45, duration: 4, yoyo: true, repeat: -1, ease: "sine.inOut" }
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

  // The hero star shimmers: its glow swells and its diffraction spike breathes.
  const startHero = useCallback(() => {
    heroTweens.current.forEach((t) => t.kill());
    heroTweens.current = [];
    if (heroCoreMatRef.current) gsap.set(heroCoreMatRef.current, { opacity: 1 });
    if (heroGlowMatRef.current) gsap.set(heroGlowMatRef.current, { opacity: 1 });
    if (heroGlowRef.current) {
      gsap.set(heroGlowRef.current.scale, { x: 1.0, y: 1.0 });
      heroTweens.current.push(
        gsap.to(heroGlowRef.current.scale, { x: 1.15, y: 1.15, duration: 3.5, yoyo: true, repeat: -1, ease: "sine.inOut" })
      );
    }
    if (heroSpikeMatRef.current) {
      gsap.set(heroSpikeMatRef.current, { opacity: 0.6 });
      heroTweens.current.push(
        gsap.to(heroSpikeMatRef.current, { opacity: 0.85, duration: 3.5, yoyo: true, repeat: -1, ease: "sine.inOut" })
      );
    }
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
    heroTweens.current.forEach((t) => t.kill());
    heroTweens.current = [];
  }, []);

  const restoreAmbient = useCallback(() => {
    startTwinkle();
    startNebula();
    startLinePulse();
    startEmissive();
    startHero();
  }, [startTwinkle, startNebula, startLinePulse, startEmissive, startHero]);

  useEffect(() => {
    startIdle();
    restoreAmbient();
    // Capture refs now (stable for this die's lifetime) for unmount teardown.
    const grp = groupRef.current;
    const atmos = atmosMatRef.current;
    const cHalo = haloRef.current;
    const cHaloMat = haloMatRef.current;
    return () => {
      killIdle();
      killAmbient();
      if (grp) gsap.killTweensOf(grp.scale);
      if (atmos) gsap.killTweensOf(atmos);
      if (cHalo) gsap.killTweensOf(cHalo.scale);
      if (cHaloMat) gsap.killTweensOf(cHaloMat);
    };
  }, [startIdle, killIdle, restoreAmbient, killAmbient]);

  // Per-frame motion that runs regardless of state: the ring system slowly
  // counter-rotates in its tilted plane, the comet orbits the ring path and the
  // trail follows it.
  useFrame((_, delta) => {
    if (ringSysRef.current) ringSysRef.current.rotation.z -= delta * 0.03;
    const comet = cometRef.current;
    if (comet) {
      cometAngle.current += delta * cometSpeed.current;
      comet.position.set(
        Math.cos(cometAngle.current) * COMET_RADIUS,
        0,
        Math.sin(cometAngle.current) * COMET_RADIUS
      );
      // Each trail sphere takes the previous-frame position of the one ahead.
      for (let i = trailRefs.current.length - 1; i > 0; i--) {
        const cur = trailRefs.current[i];
        const ahead = trailRefs.current[i - 1];
        if (cur && ahead) cur.position.copy(ahead.position);
      }
      const first = trailRefs.current[0];
      if (first) first.position.copy(comet.position);
    }
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

    // ONE celestial draw drives everything: the number/glyph shown, its reference
    // line (via the meta below), and the cosmic tier of this animation. A weighted
    // d1000 with rare impossible specials — see lib/celestial.
    const result = rollCelestial(Math.random);
    const value = result.value;
    const isMax = result.cosmic === "max";
    const isMin = result.cosmic === "min";

    // Flash every star bright, double the nebula lights, brighten the orb's own
    // glow and the d20 constellation during the spin.
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
          onResultRef.current(value, {
            display: result.display,
            lineKey: result.lineKey,
          });
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
          // COSMIC EVENT: every star blazes, the d20 constellation flares, the
          // nebula lights triple, the orb glows, the ring + comet flare and the
          // comet sprints, the hero star goes supernova, a halo blooms.
          starRefs.current.forEach((m) => {
            if (m) gsap.to(m.material as THREE.MeshBasicMaterial, { opacity: 1, duration: 0.2 });
          });
          if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0.9, duration: 0.2 });
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
          // The hero star goes supernova: glow + spike bloom huge, then settle.
          if (heroGlowRef.current) {
            gsap.fromTo(
              heroGlowRef.current.scale,
              { x: 1.1, y: 1.1 },
              { x: 2.2, y: 2.2, duration: 0.3, yoyo: true, repeat: 1, ease: "power2.out" }
            );
          }
          if (heroSpikeRef.current) {
            gsap.fromTo(
              heroSpikeRef.current.scale,
              { x: 1.6, y: 1.6 },
              { x: 2.8, y: 2.8, duration: 0.3, yoyo: true, repeat: 1, ease: "power2.out" }
            );
          }
          if (heroSpikeMatRef.current) {
            gsap.fromTo(
              heroSpikeMatRef.current,
              { opacity: 0.7 },
              { opacity: 1.0, duration: 0.3, yoyo: true, repeat: 1, ease: "power2.out" }
            );
          }
          // The ring briefly brightens (0.35 → 0.7 → back over 0.5s).
          if (ringMatRef.current) {
            gsap.fromTo(
              ringMatRef.current,
              { opacity: 0.35 },
              { opacity: 0.7, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.inOut" }
            );
          }
          // The comet sprints (triple speed for 1s), its trail flashing full.
          cometSpeed.current = COMET_BASE_SPEED * 3;
          gsap.delayedCall(1.0, () => {
            cometSpeed.current = COMET_BASE_SPEED;
          });
          trailMatRefs.current.forEach((m, i) => {
            if (!m) return;
            gsap.to(m, { opacity: 1.0, duration: 0.2 });
            gsap.to(m, { opacity: TRAIL_OPACITIES[i], duration: 0.8, delay: 0.6 });
          });
          // Halo ring: blooms from the orb's edge outward while fading, over 0.8s.
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
          // COSMIC DARKNESS: stars gutter to near-black, the d20 constellation
          // fades out too, the nebula lights die, the orb goes dark, the comet
          // crawls + its trail vanishes, and the hero star dims with everything.
          // Hold the void, then let it all recover.
          starRefs.current.forEach((m) => {
            if (m) gsap.to(m.material as THREE.MeshBasicMaterial, { opacity: 0.03, duration: 0.5 });
          });
          if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0, duration: 0.5 });
          nebRefs.current.forEach((l) => {
            if (l) gsap.to(l, { intensity: 0, duration: 0.5 });
          });
          if (orbMatRef.current) gsap.to(orbMatRef.current, { emissiveIntensity: 0.02, duration: 0.5 });
          [heroCoreMatRef, heroGlowMatRef, heroSpikeMatRef].forEach((r) => {
            if (r.current) gsap.to(r.current, { opacity: 0.1, duration: 0.5 });
          });
          cometSpeed.current = COMET_BASE_SPEED * 0.1;
          trailMatRefs.current.forEach((m) => {
            if (m) gsap.to(m, { opacity: 0, duration: 0.5 });
          });
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
            if (lineMatRef.current) gsap.to(lineMatRef.current, { opacity: 0.35, duration: 1.0 });
            nebRefs.current.forEach((l, i) => {
              if (l) gsap.to(l, { intensity: NEBULA[i].max * 0.5, duration: 1.0 });
            });
            if (orbMatRef.current) gsap.to(orbMatRef.current, { emissiveIntensity: 0.5, duration: 1.0 });
            // The hero star recovers with the field.
            if (heroCoreMatRef.current) gsap.to(heroCoreMatRef.current, { opacity: 1, duration: 1.0 });
            if (heroGlowMatRef.current) gsap.to(heroGlowMatRef.current, { opacity: 1, duration: 1.0 });
            if (heroSpikeMatRef.current) gsap.to(heroSpikeMatRef.current, { opacity: 0.7, duration: 1.0 });
            // The comet accelerates back; its trail fades back in.
            cometSpeed.current = COMET_BASE_SPEED;
            trailMatRefs.current.forEach((m, i) => {
              if (m) gsap.to(m, { opacity: TRAIL_OPACITIES[i], duration: 1.0 });
            });
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
      {/* Opaque obsidian orb with a faint nebula emissive — the ONLY shadow
          caster, casting a clean floor shadow (no bleed-through). */}
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

      {/* Ice-blue atmospheric halo (brightens on hover). */}
      <mesh castShadow={false}>
        <sphereGeometry args={[1.58, 48, 48]} />
        <meshBasicMaterial
          ref={atmosMatRef}
          color="#94b8ff"
          transparent
          opacity={0.04}
          depthWrite={false}
        />
      </mesh>

      {/* Faint coloured nebula fog INSIDE the orb — interior depth, visible as
          subtle colour shifts as the orb turns. depth-test off so it reads
          through the orb. */}
      {NEBULA_FOG.map((f, i) => (
        <mesh key={`fog-${i}`} position={[f.pos[0], f.pos[1], f.pos[2]]} castShadow={false}>
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
        <mesh key={`dist-${i}`} position={[s.x, s.y, s.z]} castShadow={false}>
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

      {/* The hidden d20 constellation — its wireframe traced in the brightest
          stars, the only constellation inside the orb. An easter egg. */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[D20_LINE_POSITIONS, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={lineMatRef}
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

      {/* THE HERO STAR — the brilliant focal heart of the cosmos: a crisp white
          core, an ice-blue additive glow, and a 4-point diffraction spike. Drawn
          in front of the constellation (high renderOrder, depth-test off) so the
          wireframe never occludes its glow. Shimmers via startHero. */}
      <group position={HERO_POS}>
        <sprite ref={heroGlowRef} scale={[1.1, 1.1, 1]} renderOrder={11}>
          <spriteMaterial
            ref={heroGlowMatRef}
            map={heroGlowTex}
            transparent
            depthTest={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite ref={heroSpikeRef} scale={[1.6, 1.6, 1]} renderOrder={12}>
          <spriteMaterial
            ref={heroSpikeMatRef}
            map={heroSpikeTex}
            transparent
            opacity={0.7}
            depthTest={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <mesh renderOrder={13}>
          <sphereGeometry args={[0.06, 24, 24]} />
          <meshBasicMaterial ref={heroCoreMatRef} color="#ffffff" transparent depthTest={false} depthWrite={false} />
        </mesh>
      </group>

      {/* Drifting particle ring around the orb. */}
      <Sparkles count={40} size={1.5} scale={[4, 4, 4]} speed={0.3} opacity={0.3} color="#94b8ff" />

      {/* Saturn-like ring system — tilted off-horizontal, slowly counter-rotating
          (see useFrame). It carries the ring itself plus a comet + trail that
          orbit it like a tiny shooting star circling a planet. None cast a
          shadow; all are occluded by the orb where they pass behind it. */}
      <group rotation={[THREE.MathUtils.degToRad(15), 0, 0]}>
        <group ref={ringSysRef}>
          <mesh castShadow={false}>
            <torusGeometry args={[1.65, 0.012, 8, 128]} />
            <meshBasicMaterial ref={ringMatRef} color="#b0c8ff" transparent opacity={0.35} depthWrite={false} />
          </mesh>

          {/* The comet — a small bright sphere orbiting the ring path. */}
          <mesh ref={cometRef} castShadow={false}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>

          {/* The comet's tail — follow-the-leader spheres, shrinking + fading. */}
          {TRAIL_SIZES.map((sz, i) => (
            <mesh
              key={`trail-${i}`}
              ref={(el) => {
                trailRefs.current[i] = el;
              }}
              castShadow={false}
            >
              <sphereGeometry args={[sz, 12, 12]} />
              <meshBasicMaterial
                ref={(el) => {
                  trailMatRefs.current[i] = el;
                }}
                color={TRAIL_COLORS[i]}
                transparent
                opacity={TRAIL_OPACITIES[i]}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* Nat-100 celebration halo — billboarded so it always faces the camera,
          invisible (opacity 0) until a cosmic event blooms it outward. */}
      <Billboard>
        <mesh ref={haloRef} castShadow={false}>
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
