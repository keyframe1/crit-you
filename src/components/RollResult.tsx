"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { isNatMax, isNatMin, type Roll } from "@/lib/dice";

// The big number below the die. Springs in (back.out), holds, then fades after
// 2s. A natural min gives it a small disappointed shake.
export default function RollResult({ roll }: { roll: Roll | null }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !roll) return;

    const max = isNatMax(roll);
    const min = isNatMin(roll);

    el.textContent = String(roll.value);
    el.style.color = min ? "var(--light)" : "var(--accent)";
    el.style.filter = max
      ? "drop-shadow(0 0 24px rgba(192,57,43,.6))"
      : "none";

    gsap.killTweensOf(el);
    gsap.set(el, { opacity: 0, scale: 0, x: 0, y: 0 });

    // Spring entrance.
    gsap.to(el, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(3)" });

    // Disappointed shake on a natural 1: 3 cycles, 4px amplitude.
    if (min) {
      gsap.to(el, {
        keyframes: { x: [0, -4, 4, -4, 4, -4, 4, 0] },
        duration: 0.4,
        delay: 0.5,
        ease: "power1.inOut",
      });
    }

    // Fade out after holding for 2s.
    gsap.to(el, {
      opacity: 0,
      y: -12,
      scale: 0.7,
      duration: 0.4,
      delay: 2,
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
