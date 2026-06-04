"use client";

import { forwardRef, type CSSProperties } from "react";
import { Html } from "@react-three/drei";
import gsap from "gsap";
import type { NumberStyle } from "@/lib/bubbleStyles";

// Only STATIC styling lives in the JSX `style` (font, shadow). The dynamic bits
// — text, colour, opacity — are set imperatively on the forwarded ref so drei's
// per-render re-paint can't clobber them. There is NO background box: the number
// is raw text whose double shadow keeps it readable over any die.
function staticStyle(s: NumberStyle): CSSProperties {
  return {
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    fontStyle: s.fontStyle,
    fontSize: s.fontSize,
    lineHeight: 1,
    whiteSpace: "nowrap",
    textAlign: "center",
    textShadow: s.textShadow,
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  };
}

// The result number: a drei <Html> billboard floating IN FRONT of the die.
// `position={[0,0,2.5]}` pushes it 2.5 units toward the camera from the group's
// centre, so it reads as a clean overlay that never intersects an edge or face.
// `center` keeps it anchored on the die's centre; `transform={false}` + `sprite`
// keep it flat and facing the camera no matter how the die rotates. Forwards a
// ref to the text node.
export const OnFaceNumber = forwardRef<HTMLDivElement, { style: NumberStyle }>(
  function OnFaceNumber({ style }, ref) {
    return (
      <Html
        ref={ref}
        center
        sprite
        transform={false}
        position={[0, 0, 2.5]}
        zIndexRange={[20, 0]}
        pointerEvents="none"
        style={staticStyle(style)}
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
  style: NumberStyle,
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
  // Crit colour: a die may theme its own nat max / nat min (only the d20 does);
  // any die that doesn't keeps its normal themed colour, leaning on its body
  // animation for the celebration. No background — readability is the shadow.
  const maxColor = style.maxColor ?? style.color;
  const minColor = style.minColor ?? style.color;

  el.textContent = String(value);
  el.style.color = isMax ? maxColor : isMin ? minColor : style.color;
  gsap.killTweensOf(el);
  // Number fades in over 0.3s AFTER the die has landed; the bubble follows once
  // it's shown.
  const tl = gsap.timeline({ onComplete });
  tl.set(el, { opacity: 0 });
  tl.to(el, { opacity: 1, duration: 0.3, ease: "power2.out", onComplete: onShown });
  tl.to(el, { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=1.5");
}

// Snap the number out of view at the start of a roll (before the tumble).
export function hideNumber(el: HTMLDivElement | null) {
  if (!el) return;
  gsap.killTweensOf(el);
  gsap.to(el, { opacity: 0, duration: 0.15 });
}
