"use client";

import { forwardRef, type CSSProperties } from "react";
import { Html } from "@react-three/drei";
import gsap from "gsap";

// The look of the result number for a family of dice.
export interface NumberTheme {
  normal: string; // text colour for an ordinary roll
  bg: string; // panel background for an ordinary roll
  shadow: string; // text-shadow (kept across all results)
}

export const POLY_NUMBER_THEME: NumberTheme = {
  normal: "#e8e4dc",
  bg: "rgba(0,0,0,0.25)",
  shadow: "0 1px 3px rgba(0,0,0,0.4)",
};

export const CELESTIAL_NUMBER_THEME: NumberTheme = {
  normal: "#94b8ff",
  bg: "rgba(148,184,255,0.15)",
  shadow: "0 0 8px rgba(148,184,255,0.5)",
};

// Crit feedback layered on top of any theme: a natural max glows gold, a natural
// 1 goes dim grey.
const MAX = { color: "#ffffff", bg: "rgba(255,215,0,0.3)" };
const MIN = { color: "#888888", bg: "rgba(0,0,0,0.15)" };

const baseStyle: CSSProperties = {
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  fontWeight: 900,
  fontSize: "36px",
  lineHeight: 1,
  padding: "8px 16px",
  borderRadius: "8px",
  whiteSpace: "nowrap",
  // Centre the panel on its 3D anchor (drei's `center` is a no-op in transform
  // mode, so we do it here).
  transform: "translate(-50%, -50%)",
  opacity: 0,
  userSelect: "none",
  WebkitUserSelect: "none",
};

// The result number, drawn as a drei <Html transform> panel parked just in front
// of the die centre. `transform` makes it inherit the die group's full world
// matrix, so it reads as printed on the front face and turns with the die as it
// slowly spins. Forwards a ref to the panel div so the die can fade it in/out.
// We intentionally skip `occlude` — at this z the panel would otherwise be
// hidden behind the die's own front face, and during its brief on-screen life
// the die barely rotates, so it never needs hiding.
export const OnFaceNumber = forwardRef<HTMLDivElement, { theme: NumberTheme; z?: number }>(
  function OnFaceNumber({ theme, z = 0.9 }, ref) {
    return (
      <Html transform position={[0, 0, z]} pointerEvents="none">
        <div
          ref={ref}
          style={{
            ...baseStyle,
            color: theme.normal,
            background: theme.bg,
            textShadow: theme.shadow,
          }}
        />
      </Html>
    );
  }
);

// Fade the number in at its landed value, hold, then fade out — recolouring the
// panel for a nat max / nat min. Mutates the portaled DOM node directly.
export function playNumberReveal(
  el: HTMLDivElement | null,
  value: number,
  max: number,
  theme: NumberTheme
) {
  if (!el) return;
  const isMax = value >= max;
  const isMin = value <= 1;
  el.textContent = String(value);
  el.style.color = isMax ? MAX.color : isMin ? MIN.color : theme.normal;
  el.style.background = isMax ? MAX.bg : isMin ? MIN.bg : theme.bg;
  gsap.killTweensOf(el);
  const tl = gsap.timeline();
  tl.set(el, { opacity: 0 });
  tl.to(el, { opacity: 1, duration: 0.4, ease: "power2.out" });
  tl.to(el, { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=1.5");
}

// Snap the number out of view at the start of a roll (before the tumble).
export function hideNumber(el: HTMLDivElement | null) {
  if (!el) return;
  gsap.killTweensOf(el);
  gsap.to(el, { opacity: 0, duration: 0.15 });
}
