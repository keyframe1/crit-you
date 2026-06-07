"use client";

import type { CSSProperties } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { isHighRoll, type DieType, type Roll } from "@/lib/dice";

// Per-die styling for the result number. Every number is the SAME bold (800)
// near-white glyph in ONE typeface (the brand sans) — the type is consistent
// across the whole set so it always reads. Per-die identity is carried entirely
// by a PROMINENT signature-colour glow/halo, with a crisp dark outline + a soft
// depth shadow beneath so the white fill stays legible on any face shade (the
// neutral d4/d6 included). A natural max adds a warm crit bloom over the halo; a
// natural 1 dims to grey with no identity halo (a failed roll shouldn't glow).
// This is the ONLY place the result number is styled — it is plain DOM text,
// never a Three.js <Html> billboard, so it can't drift, z-fight, or land on an
// edge.
const FONT = "var(--font-geist-sans)";
const SIZE = "clamp(32px, 8vw, 44px)";
const SIZE_LG = "clamp(36px, 9vw, 48px)"; // only the d12's roomy pentagon face
// The warm glow layer every die's number gains on a natural max.
const MAX_GLOW = "0 0 16px rgba(255,220,100,0.5)";
// A lighter version of that warm glow for a "high roll" (top of the range, short
// of a nat-max) — the visual half of the near-crit sparkle. Tasteful, not a crit.
const HIGH_GLOW = "0 0 10px rgba(255,225,150,0.35)";
// A soft black drop-shadow for depth + contrast, kept under a nat 1 too so the
// grey glyph never washes out.
const DEPTH = "0 3px 8px rgba(0,0,0,0.55)";

interface NumConfig {
  glow: string; // bright signature colour as "r,g,b" — the halo around the glyph
  edge: string; // dark signature colour for the crisp 1px legibility outline
  size?: string; // optional size override (only the d12 differs)
}

// The per-die palette: a luminous tint of each die's signature colour for the
// halo (so it blooms above the shaded 3D face) paired with a dark edge of the
// same hue for the outline. Mirrors the 3D dice' signature colours — d20 crimson,
// d∞ ice-blue, d10 green, d12 gold, d30 purple, d8 teal, d4 red, d6 neutral.
const NUM: Record<DieType, NumConfig> = {
  d4: { glow: "235,90,75", edge: "#5a1410" },
  d6: { glow: "214,209,194", edge: "#2e2c29" },
  d8: { glow: "70,210,193", edge: "#0f3b37" },
  d10: { glow: "70,225,130", edge: "#0f4a28" },
  d12: { glow: "255,210,110", edge: "#6b5420", size: SIZE_LG },
  d20: { glow: "240,95,80", edge: "#4a1410" },
  d30: { glow: "190,110,225", edge: "#3a1a50" },
  dinf: { glow: "175,205,255", edge: "#1a2040" },
};

// A 4-directional 1px text-shadow that crisply outlines the white glyph.
function outline(c: string): string {
  return `-1px -1px 0 ${c}, 1px -1px 0 ${c}, -1px 1px 0 ${c}, 1px 1px 0 ${c}`;
}

// The signature-colour halo: a tight bright ring fading out to a wide soft bloom.
function halo(rgb: string): string {
  return `0 0 6px rgba(${rgb},0.9), 0 0 13px rgba(${rgb},0.6), 0 0 24px rgba(${rgb},0.4)`;
}

function getNumberStyle(dieType: DieType, result: number, max: number): CSSProperties {
  const isMax = result === max;
  const isMin = result === 1;
  const isHigh = isHighRoll(result, max);
  const cfg = NUM[dieType] ?? NUM.d20;
  const ol = outline(cfg.edge);

  // nat 1: diminished — the dark outline + depth only, no identity halo. nat max:
  // outline + the signature halo + the warm crit bloom + depth. high roll:
  // outline + halo + a light warm glow + depth. otherwise: outline + the
  // signature halo + depth. The crisp outline is listed FIRST so it paints on top
  // of the soft glow, keeping the glyph edge sharp.
  const textShadow = isMin
    ? [ol, DEPTH].join(", ")
    : isMax
    ? [ol, halo(cfg.glow), MAX_GLOW, DEPTH].join(", ")
    : isHigh
    ? [ol, halo(cfg.glow), HIGH_GLOW, DEPTH].join(", ")
    : [ol, halo(cfg.glow), DEPTH].join(", ");

  return {
    pointerEvents: "none",
    userSelect: "none",
    lineHeight: 1,
    fontFamily: FONT,
    fontWeight: 800,
    fontSize: cfg.size ?? SIZE,
    color: isMin ? "#cfcfcf" : "#ffffff",
    textShadow,
  };
}

// The d10's failure is a data-glitch: on a natural 1 its number stutters in
// instead of fading cleanly (the body's red error frame lives in reactions.ts).
const GLITCH = [0, 1, 0, 1, 0, 1, 1];

// The result number, as a plain HTML overlay centred over the canvas. It is a
// SIBLING of <DiceCanvas> (positioned by its parent's `relative` + this `absolute
// inset-0`), so it always sits dead-centre of the stage — which is always where
// the die is. The slight top padding drops it onto the die's visual centre of
// mass (a touch above geometric centre, given the camera angle).
//
// `visible` is owned by the page: it turns true when a roll lands and false when
// the number's hold elapses or a fresh roll begins — letting the number fade out
// while the speech bubble and share state persist.
export default function ResultNumber({
  roll,
  visible,
}: {
  roll: Roll | null;
  visible: boolean;
}) {
  const reduce = useReducedMotion();
  const show = !!roll && visible;
  const glitch = !!roll && roll.dieType === "d10" && roll.value <= 1;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
      style={{ paddingTop: "5%" }}
    >
      <AnimatePresence>
        {show && roll && (
          <motion.span
            // Keyed by roll id so a new result swaps in cleanly.
            key={roll.id}
            // STAMP entrance: a quick scale-punch (1.3 → 1.0 with a back.out
            // overshoot) + fade, NO delay — the page reveals on the landing-impact
            // beat, so the number reads as struck by the die hitting the floor.
            // The d10 nat-1 keeps its data-glitch stutter (no punch); reduced
            // motion is a plain fade in.
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: glitch ? 1 : 1.3 }}
            animate={reduce ? { opacity: 1 } : { opacity: glitch ? GLITCH : 1, scale: 1 }}
            transition={
              reduce
                ? { duration: 0.3, ease: "easeOut" }
                : {
                    opacity: { duration: glitch ? 0.45 : 0.16, ease: "easeOut" },
                    scale: { duration: 0.18, ease: [0.34, 1.56, 0.64, 1] },
                  }
            }
            // Exit: a clean, deliberate fade-out with a slight upward drift —
            // clearly visible, never abrupt. Reduced motion drops the drift. Runs
            // when the hold elapses or a new roll begins.
            exit={{
              opacity: 0,
              y: reduce ? 0 : -10,
              transition: { duration: 0.5, ease: "easeOut" },
            }}
            style={getNumberStyle(roll.dieType, roll.value, roll.max)}
          >
            {roll.value}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
