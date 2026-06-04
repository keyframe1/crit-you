"use client";

import type { CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DieType, Roll } from "@/lib/dice";

// Per-die styling for the result number. Every number is bold (800) white text
// with a crisp 4-directional outline in the die's dark signature colour, so it
// punches through against any face shade behind it — no thin or light fonts on
// any die. A natural max adds a warm crit glow; a natural 1 dims to grey with the
// outline only. This is the ONLY place the result number is styled — it is plain
// DOM text, never a Three.js <Html> billboard, so it can't drift, z-fight, or
// land on an edge.
const MONO = "var(--font-geist-mono)";
const SANS = "var(--font-geist-sans)";
const SIZE = "clamp(32px, 8vw, 44px)";
// The warm glow layer every die's number gains on a natural max.
const MAX_GLOW = "0 0 16px rgba(255,220,100,0.5)";

interface NumConfig {
  font: string;
  size: string;
  outlineColor: string; // dark signature colour for the 1px outline
  depth: string; // soft black drop-shadow for depth (dropped on a nat 1)
  glow?: string; // optional signature coloured glow (mid + max)
  maxGlow?: string; // optional extra glow only on a natural max (the d20 crit)
}

const NUM: Record<DieType, NumConfig> = {
  d4: { font: MONO, size: SIZE, outlineColor: "#6b1a14", depth: "0 3px 10px rgba(0,0,0,0.6)" },
  d6: { font: SANS, size: SIZE, outlineColor: "#3a3835", depth: "0 3px 10px rgba(0,0,0,0.5)" },
  d8: { font: SANS, size: SIZE, outlineColor: "#155550", depth: "0 3px 10px rgba(0,0,0,0.5)" },
  d10: {
    font: MONO, size: SIZE, outlineColor: "#145530", depth: "0 3px 10px rgba(0,0,0,0.5)",
    glow: "0 0 10px rgba(39,174,96,0.4)",
  },
  d12: {
    font: SANS, size: "clamp(36px, 9vw, 48px)", outlineColor: "#6b5420", depth: "0 3px 10px rgba(0,0,0,0.5)",
    glow: "0 0 8px rgba(212,168,67,0.3)",
  },
  d20: {
    font: MONO, size: SIZE, outlineColor: "#5a1a14", depth: "0 3px 10px rgba(0,0,0,0.6)",
    maxGlow: "0 0 20px rgba(255,200,100,0.6)",
  },
  d30: { font: SANS, size: SIZE, outlineColor: "#3a1a50", depth: "0 3px 10px rgba(0,0,0,0.5)" },
  dinf: {
    font: SANS, size: SIZE, outlineColor: "#1a2040", depth: "0 3px 10px rgba(0,0,0,0.5)",
    glow: "0 0 16px rgba(148,184,255,0.5)",
  },
};

// A 4-directional 1px text-shadow that crisply outlines the white glyph.
function outline(c: string): string {
  return `-1px -1px 0 ${c}, 1px -1px 0 ${c}, -1px 1px 0 ${c}, 1px 1px 0 ${c}`;
}

function getNumberStyle(dieType: DieType, result: number, max: number): CSSProperties {
  const isMax = result === max;
  const isMin = result === 1;
  const cfg = NUM[dieType] ?? NUM.d20;
  const ol = outline(cfg.outlineColor);

  // nat 1: outline only (no glow, no depth) — diminished. nat max: outline +
  // every glow this die carries + the warm crit glow + depth. otherwise: outline
  // + the die's signature glow (if any) + depth.
  const textShadow = isMin
    ? ol
    : isMax
    ? [ol, cfg.glow, cfg.maxGlow, MAX_GLOW, cfg.depth].filter(Boolean).join(", ")
    : [ol, cfg.glow, cfg.depth].filter(Boolean).join(", ");

  return {
    pointerEvents: "none",
    userSelect: "none",
    lineHeight: 1,
    fontFamily: cfg.font,
    fontWeight: 800,
    fontSize: cfg.size,
    color: isMin ? "#aaaaaa" : "#ffffff",
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
            initial={{ opacity: 0 }}
            animate={{ opacity: glitch ? GLITCH : 1 }}
            // The number appears 0.15s after the die lands, then holds; exit (a
            // 0.4s fade) runs when the hold elapses or a new roll begins.
            transition={{ delay: 0.15, duration: glitch ? 0.45 : 0.3, ease: "easeOut" }}
            exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeIn" } }}
            style={getNumberStyle(roll.dieType, roll.value, roll.max)}
          >
            {roll.value}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
