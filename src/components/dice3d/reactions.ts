"use client";

import * as THREE from "three";
import gsap from "gsap";

// A die's emotional reaction to its own roll — the celebration on a natural max,
// the failure on a natural 1. These run AFTER the landing thud and AFTER the
// number has faded in (so they never fight the reveal), and each owns calling
// `done()` when it finishes, which hands the die back to its idle float.
//
// Per-die character lives entirely in these functions; PolyDie just provides the
// group, its (ref'd) material + point light, and the signature colour. The result
// number is a CSS overlay (components/ResultNumber) and is never touched here.
// The celestial d∞ has its own bespoke cosmos reactions in DInf.tsx and doesn't
// use these.
export interface DieAnimContext {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial | null;
  flash: THREE.PointLight | null;
  baseColor: string;
  done: () => void;
}

export type DieReaction = (ctx: DieAnimContext) => void;

const deg = (d: number) => THREE.MathUtils.degToRad(d);
const BASE_ROUGHNESS = 0.55; // matches PolyDie's material

// ─── Celebrations (natural max) ──────────────────────────────────────────────

// D4 — RAGE SPIKE: three rapid scale pulses + a brief angry red glow from within.
export const celebrateD4: DieReaction = ({ group, material, done }) => {
  const tl = gsap.timeline({ onComplete: done });
  tl.to(
    group.scale,
    {
      keyframes: {
        x: [1, 1.08, 1, 1.06, 1, 1.04, 1],
        y: [1, 1.08, 1, 1.06, 1, 1.04, 1],
        z: [1, 1.08, 1, 1.06, 1, 1.04, 1],
      },
      duration: 0.5,
      ease: "none",
    },
    0
  );
  if (material) {
    material.emissive.set("#ff2200");
    tl.fromTo(
      material,
      { emissiveIntensity: 0 },
      { emissiveIntensity: 1, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" },
      0
    );
  }
};

// D6 — POLITE ACKNOWLEDGMENT: one understated scale tick. It does not celebrate.
export const celebrateD6: DieReaction = ({ group, done }) => {
  gsap.to(group.scale, {
    x: 1.02,
    y: 1.02,
    z: 1.02,
    duration: 0.2,
    yoyo: true,
    repeat: 1,
    ease: "power1.inOut",
    onComplete: done,
  });
};

// D8 — EXCITED BOUNCE: a big hop, then a smaller one. Like a puppy with a ball.
export const celebrateD8: DieReaction = ({ group, done }) => {
  const y0 = group.position.y;
  const tl = gsap.timeline({ onComplete: done });
  tl.to(group.position, { y: y0 + 0.3, duration: 0.15, ease: "power2.out" });
  tl.to(group.position, { y: y0, duration: 0.15, ease: "power2.in" });
  tl.to(group.position, { y: y0 + 0.15, duration: 0.12, ease: "power2.out" });
  tl.to(group.position, { y: y0, duration: 0.18, ease: "power2.in" });
};

// D10 — DATA CONFIRMATION: a clinical green emissive flash. No movement at all.
export const celebrateD10: DieReaction = ({ material, done }) => {
  if (!material) {
    done();
    return;
  }
  material.emissive.set("#27ae60");
  gsap.fromTo(
    material,
    { emissiveIntensity: 0 },
    { emissiveIntensity: 0.8, duration: 0.1, yoyo: true, repeat: 1, ease: "power2.out", onComplete: done }
  );
};

// D12 — FULL THEATER: swell to 1.15, hold (dramatic pause), release with a gold
// glow building through the hold. The biggest celebration of the set.
export const celebrateD12: DieReaction = ({ group, material, done }) => {
  const tl = gsap.timeline({ onComplete: done });
  tl.to(group.scale, { x: 1.15, y: 1.15, z: 1.15, duration: 0.3, ease: "power2.out" }, 0);
  tl.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: "back.out(2)" }, 0.6); // 0.3s hold
  if (material) {
    material.emissive.set("#d4a843");
    tl.to(material, { emissiveIntensity: 0.4, duration: 0.4, ease: "power2.out" }, 0.2);
    tl.to(material, { emissiveIntensity: 0, duration: 0.4, ease: "power2.in" }, 0.6);
  }
};

// D20 — CONFIDENT PULSE: a smooth scale pulse, a crimson emissive flash, and a
// point light flare that lights the floor. Confident but contained.
export const celebrateD20: DieReaction = ({ group, material, flash, done }) => {
  const tl = gsap.timeline({ onComplete: done });
  tl.to(group.scale, { x: 1.08, y: 1.08, z: 1.08, duration: 0.2, yoyo: true, repeat: 1, ease: "power2.inOut" }, 0);
  if (material) {
    material.emissive.set("#c0392b");
    tl.fromTo(
      material,
      { emissiveIntensity: 0 },
      { emissiveIntensity: 0.3, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" },
      0
    );
  }
  if (flash) {
    flash.intensity = 2;
    tl.to(flash, { intensity: 0, duration: 0.6, ease: "power2.out" }, 0);
  }
};

// D30 — REGAL BLOOM: a slow swell and a slow purple glow. Royalty does not rush.
export const celebrateD30: DieReaction = ({ group, material, done }) => {
  const tl = gsap.timeline({ onComplete: done });
  tl.to(group.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.5, ease: "power2.inOut" }, 0);
  tl.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: "power2.inOut" }, 0.5);
  if (material) {
    material.emissive.set("#8e44ad");
    tl.to(material, { emissiveIntensity: 0.3, duration: 0.4, ease: "power2.inOut" }, 0);
    tl.to(material, { emissiveIntensity: 0, duration: 0.5, ease: "power2.inOut" }, 0.5);
  }
};

// ─── Failures (natural 1) ────────────────────────────────────────────────────

// D4 — ANGRY TILT: snap to a 15° tilt, hold, slowly right itself, darkening.
export const failD4: DieReaction = ({ group, material, baseColor, done }) => {
  const tl = gsap.timeline({ onComplete: done });
  tl.to(group.rotation, { z: deg(15), duration: 0.15, ease: "power3.out" }, 0);
  tl.to(group.rotation, { z: 0, duration: 0.4, ease: "power2.inOut" }, 0.75); // 0.6s hold
  if (material) {
    const dark = new THREE.Color(baseColor).multiplyScalar(0.7);
    const base = new THREE.Color(baseColor);
    tl.to(material.color, { r: dark.r, g: dark.g, b: dark.b, duration: 0.3 }, 0);
    tl.to(material.color, { r: base.r, g: base.g, b: base.b, duration: 0.4 }, 0.7);
  }
};

// D6 — NOTHING: the absence of a reaction IS the personality. Resume idle.
export const failD6: DieReaction = ({ done }) => {
  done();
};

// D8 — NERVOUS WOBBLE: an anxious rotateZ jitter while shrinking and recovering.
export const failD8: DieReaction = ({ group, done }) => {
  const tl = gsap.timeline({ onComplete: done });
  tl.to(
    group.rotation,
    {
      keyframes: { z: [deg(-4), deg(4), deg(-3), deg(3), deg(-2), deg(2), 0] },
      duration: 0.6,
      ease: "none",
    },
    0
  );
  tl.to(group.scale, { x: 0.97, y: 0.97, z: 0.97, duration: 0.3, ease: "power2.out" }, 0);
  tl.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: "power2.out" }, 0.3);
};

// D10 — GLITCH: the body throws one red error frame. System malfunction. The
// number's matching stutter (it flickers in instead of fading) is rendered by the
// CSS overlay, ResultNumber, keyed to this die's nat-1 — so the glitch reads on
// both the body and the readout without the scene touching any text.
export const failD10: DieReaction = ({ material, done }) => {
  const tl = gsap.timeline({ onComplete: done });
  // Hold ~0.4s (the length of the overlay's glitch) so the malfunction reads even
  // when the body has no material to flash.
  tl.to({}, { duration: 0.4 }, 0);
  if (material) {
    material.emissive.set("#ff0000");
    tl.set(material, { emissiveIntensity: 1 }, 0.1);
    tl.set(material, { emissiveIntensity: 0 }, 0.15);
  }
};

// D12 — DRAMATIC COLLAPSE: sink and shrink with despair, hold at the bottom, then
// slowly recover. The longest failure — the tragedy needs time (~1.8s).
export const failD12: DieReaction = ({ group, material, baseColor, done }) => {
  const y0 = group.position.y;
  const tl = gsap.timeline({ onComplete: done });
  tl.to(group.position, { y: y0 - 0.15, duration: 0.8, ease: "power2.in" }, 0);
  tl.to(group.scale, { x: 0.96, y: 0.96, z: 0.96, duration: 0.8, ease: "power2.in" }, 0);
  if (material) {
    const dark = new THREE.Color(baseColor).multiplyScalar(0.5);
    const base = new THREE.Color(baseColor);
    tl.to(material.color, { r: dark.r, g: dark.g, b: dark.b, duration: 0.8 }, 0);
    tl.to(material.color, { r: base.r, g: base.g, b: base.b, duration: 0.6 }, 1.2); // 0.4s hold then recover
  }
  tl.to(group.position, { y: y0, duration: 0.6, ease: "power2.out" }, 1.2);
  tl.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "power2.out" }, 1.2);
};

// D20 — CLASSIC SHAKE: a quick, sharp horizontal shake while the surface briefly
// goes matte. The benchmark failure.
export const failD20: DieReaction = ({ group, material, done }) => {
  const x0 = group.position.x;
  const a = 0.04;
  const tl = gsap.timeline({ onComplete: done });
  tl.to(
    group.position,
    {
      keyframes: { x: [x0 + a, x0 - a, x0 + a * 0.75, x0 - a * 0.75, x0 + a * 0.5, x0 - a * 0.5, x0] },
      duration: 0.4,
      ease: "none",
    },
    0
  );
  if (material) {
    tl.to(material, { roughness: 0.9, duration: 0.05 }, 0);
    tl.to(material, { roughness: BASE_ROUGHNESS, duration: 0.25 }, 0.3);
  }
};

// D30 — STUNNED FREEZE: everything stops dead for 1.2s, the surface going faintly
// cold, before slowly resuming. Shocked. Insulted. Processing.
export const failD30: DieReaction = ({ material, done }) => {
  const tl = gsap.timeline({ onComplete: done });
  if (material) {
    material.emissive.set("#1a1a3a");
    tl.to(material, { emissiveIntensity: 0.05, duration: 0.1 }, 0);
    tl.to(material, { emissiveIntensity: 0, duration: 0.5 }, 1.2); // hold the freeze, then fade
  } else {
    tl.to({}, { duration: 1.7 });
  }
};
