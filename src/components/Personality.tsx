"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Roll } from "@/lib/dice";

// The die's line, in a speech bubble — it should read as the die talking, not
// as a caption. The line itself is chosen at roll time (see lib/lines.pickLine)
// so it stays in sync with the share card. The bubble fades up on entrance and
// lingers until the next roll replaces it. A small notch points up toward the
// die above.
export default function Personality({ roll }: { roll: Roll | null }) {
  return (
    <div className="min-h-[72px] flex items-start justify-center px-6">
      <AnimatePresence mode="wait">
        {roll && (
          <motion.div
            key={roll.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-w-[300px] rounded-xl border border-white/[0.06] bg-[#161616] px-5 py-3"
          >
            {/* Notch: a small rotated square whose two upper edges carry the
                bubble's border, so it reads as a triangle pointing at the die. */}
            <span
              aria-hidden
              className="absolute left-1/2 -top-[5px] h-[10px] w-[10px] -translate-x-1/2 rotate-45 rounded-[2px] border-l border-t border-white/[0.06] bg-[#161616]"
            />
            <p className="font-mono text-[13px] leading-relaxed text-[var(--light)] text-center">
              {roll.line}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
