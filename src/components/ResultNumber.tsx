"use client";

import type { CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DieType, Roll } from "@/lib/dice";

// Per-die styling for the result number. Each die's number echoes its speech-
// bubble voice (font family, weight, colour); a natural max brightens it and a
// natural 1 dims it. This is the ONLY place the result number is styled — it is
// plain DOM text, never a Three.js <Html> billboard, so it can't drift, z-fight,
// or land on an edge.
function getNumberStyle(dieType: DieType, result: number, max: number): CSSProperties {
  const isMax = result === max;
  const isMin = result === 1;

  const base: CSSProperties = {
    pointerEvents: "none",
    userSelect: "none",
    lineHeight: 1,
  };

  const styles: Record<DieType, CSSProperties> = {
    d4: {
      ...base,
      fontFamily: "var(--font-geist-mono)",
      fontWeight: 700,
      fontSize: "clamp(32px, 8vw, 44px)",
      color: isMax ? "#ff4444" : isMin ? "#666" : "#e84c3d",
      textShadow: "0 2px 8px rgba(0,0,0,0.5)",
    },
    d6: {
      ...base,
      fontFamily: "var(--font-geist-sans)",
      fontWeight: 400,
      fontSize: "clamp(32px, 8vw, 44px)",
      color: isMax ? "#555" : isMin ? "#bbb" : "#888",
      textShadow: "0 1px 4px rgba(0,0,0,0.3)",
    },
    d8: {
      ...base,
      fontFamily: "var(--font-geist-sans)",
      fontWeight: 700,
      fontStyle: "italic",
      fontSize: "clamp(32px, 8vw, 44px)",
      color: isMax ? "#1fe0cc" : isMin ? "#666" : "#2a9d8f",
      textShadow: "0 2px 6px rgba(0,0,0,0.4)",
    },
    d10: {
      ...base,
      fontFamily: "var(--font-geist-mono)",
      fontWeight: 400,
      fontSize: "clamp(32px, 8vw, 44px)",
      color: isMax ? "#33ff66" : isMin ? "#666" : "#27ae60",
      textShadow: "0 0 8px rgba(39,174,96,0.4)",
    },
    d12: {
      ...base,
      fontFamily: "var(--font-geist-sans)",
      fontWeight: 700,
      fontSize: "clamp(36px, 9vw, 48px)",
      color: isMax ? "#ffe066" : isMin ? "#666" : "#f0d878",
      textShadow: "0 2px 8px rgba(0,0,0,0.5)",
    },
    d20: {
      ...base,
      fontFamily: "var(--font-geist-mono)",
      fontWeight: 700,
      fontSize: "clamp(32px, 8vw, 44px)",
      color: isMax ? "#ffffff" : isMin ? "#888" : "#e8e4dc",
      textShadow: isMax
        ? "0 0 20px rgba(192,57,43,0.8), 0 2px 8px rgba(0,0,0,0.5)"
        : "0 2px 8px rgba(0,0,0,0.5)",
    },
    d30: {
      ...base,
      fontFamily: "var(--font-geist-sans)",
      fontWeight: 300,
      fontSize: "clamp(32px, 8vw, 44px)",
      color: isMax ? "#e0b0ff" : isMin ? "#666" : "#c89eec",
      textShadow: "0 2px 6px rgba(0,0,0,0.4)",
    },
    dinf: {
      ...base,
      fontFamily: "var(--font-geist-sans)",
      fontWeight: 300,
      fontSize: "clamp(32px, 8vw, 44px)",
      color: isMax ? "#c0d8ff" : isMin ? "#445" : "#94b8ff",
      textShadow: isMax
        ? "0 0 16px rgba(148,184,255,0.6), 0 2px 6px rgba(0,0,0,0.4)"
        : "0 2px 6px rgba(0,0,0,0.4)",
    },
  };

  return styles[dieType] || styles.d20;
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
