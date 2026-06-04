"use client";

import { motion, AnimatePresence } from "framer-motion";
import { isNatMax, type Roll } from "@/lib/dice";
import { BUBBLE_STYLES } from "@/lib/bubbleStyles";

// The die's line, in a speech bubble above the die — it should read as the die
// talking, not as a caption. The line is chosen at roll time (see
// lib/lines.pickLine) so it stays in sync with the share card, and the bubble's
// whole look (colour, corners, type, notch) comes from BUBBLE_STYLES[dieType] so
// each die's personality extends into how it speaks.
//
// Switching dice clears the roll (page.tsx), which exits the current bubble with
// a quick 0.2s fade; the next roll mounts a fresh bubble in the new die's style.
export default function Personality({ roll }: { roll: Roll | null }) {
  const style = roll ? BUBBLE_STYLES[roll.dieType] : null;
  // d8 is always italic; d12 tips into italic only on a nat_max for extra drama.
  const italic =
    !!style &&
    (style.fontStyle === "italic" ||
      (!!style.italicOnNatMax && !!roll && isNatMax(roll)));

  // The parent (page.tsx) positions this absolutely over the die, so we only
  // animate opacity + a small y transform here — both GPU-composited, never
  // triggering a reflow that could move the die. AnimatePresence mode="wait" lets
  // the old bubble fade out before the new one enters.
  //
  // The enter is delayed 0.45s so the bubble follows the result number (which
  // appears 0.15s after the die lands) by ~0.3s — the die "speaks" just after
  // its number surfaces. Exit carries its own (undelayed) transition so the
  // bubble still leaves promptly on a new roll or a die change.
  return (
    <AnimatePresence mode="wait">
      {roll && style && (
        <motion.div
          key={roll.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
          className="relative max-w-[85vw] sm:max-w-[360px]"
          style={{
            background: style.background,
            border: style.border,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
            padding: style.padding,
          }}
        >
          <p
            className="text-center"
            style={{
              margin: 0,
              color: style.color,
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              fontStyle: italic ? "italic" : "normal",
              letterSpacing: style.letterSpacing,
              textTransform: style.textTransform,
              lineHeight: style.lineHeight,
            }}
          >
            {roll.line}
          </p>
          {/* Notch: a small rotated square whose two lower edges carry the
              bubble's border, so it reads as a triangle pointing at the die.
              It mirrors the bubble's fill + edge for every die. */}
          <span
            aria-hidden
            className="absolute left-1/2 -bottom-[5px] h-[10px] w-[10px] -translate-x-1/2 rotate-45"
            style={{
              background: style.notchBg,
              borderBottom: `${style.notchBorderWidth} solid ${style.notchBorderColor}`,
              borderRight: `${style.notchBorderWidth} solid ${style.notchBorderColor}`,
              borderRadius: style.notchRadius,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
