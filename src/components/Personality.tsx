"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Roll } from "@/lib/dice";

// The die's line, in a speech bubble above the die — it should read as the die
// talking, not as a caption. The line is chosen at roll time (see
// lib/lines.pickLine) so it stays in sync with the share card. The bubble fades
// down into place from just above, and a notch on its underside points down at
// the die below.
export default function Personality({ roll }: { roll: Roll | null }) {
  return (
    <div className="min-h-[76px] flex items-end justify-center px-6">
      <AnimatePresence mode="wait">
        {roll && (
          <motion.div
            key={roll.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-w-[280px] sm:max-w-[340px] rounded-xl border border-white/[0.06] bg-[#161616] px-5 py-3"
          >
            <p className="font-mono text-[13px] leading-relaxed text-[var(--light)] text-center">
              {roll.line}
            </p>
            {/* Notch: a small rotated square whose two lower edges carry the
                bubble's border, so it reads as a triangle pointing at the die. */}
            <span
              aria-hidden
              className="absolute left-1/2 -bottom-[5px] h-[10px] w-[10px] -translate-x-1/2 rotate-45 rounded-[2px] border-b border-r border-white/[0.06] bg-[#161616]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
