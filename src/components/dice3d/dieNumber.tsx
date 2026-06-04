"use client";

import { forwardRef, type CSSProperties } from "react";
import { Html } from "@react-three/drei";
import gsap from "gsap";
import type { NumberStyle } from "@/lib/bubbleStyles";

// Only STATIC styling lives in the JSX `style` (font, padding, shadow). The
// dynamic bits — text, colour, background, opacity — are set imperatively on the
// forwarded ref so drei's per-render re-paint of the panel can't clobber them.
function staticStyle(s: NumberStyle): CSSProperties {
  return {
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    fontStyle: s.fontStyle,
    fontSize: s.fontSize,
    lineHeight: 1,
    padding: "6px 14px",
    borderRadius: "8px",
    whiteSpace: "nowrap",
    textShadow: s.textShadow,
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  };
}

// The result number: a drei <Html> panel anchored dead-centre on the die group
// ([0,0,0]) and billboarded (no `transform`), so it always faces the camera and
// stays centred no matter how the die rotates. Forwards a ref to the panel div.
export const OnFaceNumber = forwardRef<HTMLDivElement, { style: NumberStyle }>(
  function OnFaceNumber({ style }, ref) {
    return (
      <Html
        ref={ref}
        center
        position={[0, 0, 0]}
        zIndexRange={[10, 0]}
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
  // Crit colours: a die may theme its own nat max / nat min (only the d20 does).
  // Any die that doesn't keeps its normal, well-contrasted themed look on a crit
  // — the celebration is carried by the die's body animation, not the number.
  const maxColor = style.maxColor ?? style.color;
  const maxBg = style.maxBackground ?? style.background;
  const minColor = style.minColor ?? style.color;
  const minBg = style.minBackground ?? style.background;

  el.textContent = String(value);
  el.style.color = isMax ? maxColor : isMin ? minColor : style.color;
  el.style.background = isMax ? maxBg : isMin ? minBg : style.background;
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
