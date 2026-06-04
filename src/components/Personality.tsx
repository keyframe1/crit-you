"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Roll } from "@/lib/dice";

// The snarky line under the result. The line itself is chosen at roll time
// (see lib/lines.pickLine) so it stays in sync with the share card. It enters
// with a fade-up and lingers until the next roll replaces it.
export default function Personality({ roll }: { roll: Roll | null }) {
  return (
    <div className="min-h-[2.5rem] flex items-start justify-center px-6">
      <AnimatePresence mode="wait">
        {roll && (
          <motion.p
            key={roll.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="font-mono text-[13px] leading-relaxed text-[var(--mid)] text-center max-w-[34ch]"
          >
            {roll.line}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
