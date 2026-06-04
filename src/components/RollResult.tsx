"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { isNatMax, isNatMin, animFor, type Roll } from "@/lib/dice";

// The big number below the die. By default it springs in (back.out), holds,
// then fades. A natural 1 is where the dice differ: each die names its own
// `numberFail` flavour in lib/dice and this component interprets it — a
// disappointed shake (d20), a flat no-spring appearance (d6), a glitchy
// flicker (d10), or a delayed, mournful fade-in (d12).
export default function RollResult({ roll }: { roll: Roll | null }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !roll) return;

    const max = isNatMax(roll);
    const min = isNatMin(roll);
    const fail = animFor(roll.dieType).numberFail;

    el.textContent = String(roll.value);
    // Natural min reads in the muted off-white; everything else in the accent.
    el.style.color = min ? "var(--light)" : "var(--accent)";
    el.style.filter = max
      ? "drop-shadow(0 0 24px rgba(192,57,43,.6))"
      : "none";

    gsap.killTweensOf(el);

    // How long the number holds before it fades. "delay-slow" pushes this back
    // so the number has time to even appear before it leaves.
    let holdDelay = 1.1;

    if (min && fail === "flat") {
      // d6: even the failure is boring. It just appears — no spring, no drama.
      gsap.set(el, { opacity: 1, scale: 1, x: 0, y: 0 });
    } else if (min && fail === "delay-slow") {
      // d12: a beat of silence, then a slow, mournful fade-in. Tragedy needs time.
      gsap.set(el, { opacity: 0, scale: 1, x: 0, y: 0 });
      gsap.to(el, { opacity: 1, duration: 1, delay: 0.3, ease: "power2.out" });
      holdDelay = 2.1;
    } else {
      // Everyone else: spring down from a large scale (2.8 → 1) with overshoot.
      gsap.set(el, { opacity: 0, scale: 2.8, x: 0, y: 0 });
      gsap.to(el, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(3)" });
    }

    if (min && fail === "shake") {
      // d20: a disappointed side-to-side shake. 3 cycles, 4px amplitude.
      gsap.to(el, {
        keyframes: { x: [0, -4, 4, -4, 4, -4, 4, 0] },
        duration: 0.4,
        delay: 0.45,
        ease: "power1.inOut",
      });
    } else if (min && fail === "flicker") {
      // d10: flicker twice like a glitching calculator.
      gsap.to(el, {
        keyframes: { opacity: [1, 0.3, 1, 0.3, 1] },
        duration: 0.4,
        delay: 0.45,
        ease: "none",
      });
    }

    // Hold, then fade out.
    gsap.to(el, {
      opacity: 0,
      y: -12,
      scale: 0.7,
      duration: 0.35,
      delay: holdDelay,
      ease: "power2.in",
    });

    return () => {
      gsap.killTweensOf(el);
    };
  }, [roll]);

  return (
    <div className="h-[56px] flex items-center justify-center">
      <span
        ref={ref}
        className="font-black text-[48px] leading-none tabular-nums pointer-events-none select-none"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
