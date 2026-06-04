"use client";

import { forwardRef, type CSSProperties } from "react";
import { Html } from "@react-three/drei";
import gsap from "gsap";

// The look of the result number for a family of dice.
export interface NumberTheme {
  normal: string; // text colour for an ordinary roll
  bg: string; // panel background for an ordinary roll
  shadow: string; // text-shadow (stays constant across results)
}

export const POLY_NUMBER_THEME: NumberTheme = {
  normal: "#e8e4dc",
  bg: "rgba(0,0,0,0.3)",
  shadow: "0 2px 4px rgba(0,0,0,0.5)",
};

export const CELESTIAL_NUMBER_THEME: NumberTheme = {
  normal: "#94b8ff",
  bg: "rgba(148,184,255,0.1)",
  shadow: "0 0 12px rgba(148,184,255,0.6)",
};

// Crit feedback layered on top of any theme: a natural max glows gold, a natural
// 1 goes dim grey.
const MAX = { color: "#ffffff", bg: "rgba(255,215,0,0.3)" };
const MIN = { color: "#888888", bg: "rgba(0,0,0,0.15)" };

// Only STATIC styling lives in the JSX `style` (font, padding, shadow). The
// dynamic bits — text, colour, background, opacity — are set imperatively on the
// forwarded ref so drei's per-render re-paint of the panel can't clobber them.
function staticStyle(theme: NumberTheme): CSSProperties {
  return {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    fontWeight: 900,
    fontSize: "36px",
    lineHeight: 1,
    padding: "6px 14px",
    borderRadius: "8px",
    whiteSpace: "nowrap",
    textShadow: theme.shadow,
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  };
}

// The result number: a drei <Html> panel anchored dead-centre on the die group
// ([0,0,0]) and billboarded (no `transform`), so it always faces the camera and
// stays centred no matter how the die rotates. Forwards a ref to the panel div.
export const OnFaceNumber = forwardRef<HTMLDivElement, { theme: NumberTheme }>(
  function OnFaceNumber({ theme }, ref) {
    return (
      <Html
        ref={ref}
        center
        position={[0, 0, 0]}
        zIndexRange={[10, 0]}
        pointerEvents="none"
        style={staticStyle(theme)}
      />
    );
  }
);

// Fade the number in at its landed value, hold, then fade out — recolouring the
// panel for a nat max / nat min. Mutates the portaled DOM node directly.
//   • `onShown` fires once the number has fully faded in (the die uses this to
//     raise the speech bubble, so the bubble never beats the number).
//   • `onComplete` fires once the whole reveal has run (the die uses this to
//     release its input lock, so a rapid click can't cut the display short).
// Both are part of the timeline, so killing the tween on unmount cancels them.
export function playNumberReveal(
  el: HTMLDivElement | null,
  value: number,
  max: number,
  theme: NumberTheme,
  onShown?: () => void,
  onComplete?: () => void
) {
  if (!el) {
    onShown?.();
    onComplete?.();
    return;
  }
  const isMax = value >= max;
  const isMin = value <= 1;
  el.textContent = String(value);
  el.style.color = isMax ? MAX.color : isMin ? MIN.color : theme.normal;
  el.style.background = isMax ? MAX.bg : isMin ? MIN.bg : theme.bg;
  gsap.killTweensOf(el);
  const tl = gsap.timeline({ onComplete });
  tl.set(el, { opacity: 0 });
  tl.to(el, { opacity: 1, duration: 0.4, ease: "power2.out", onComplete: onShown });
  tl.to(el, { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=1.5");
}

// Snap the number out of view at the start of a roll (before the tumble).
export function hideNumber(el: HTMLDivElement | null) {
  if (!el) return;
  gsap.killTweensOf(el);
  gsap.to(el, { opacity: 0, duration: 0.15 });
}
