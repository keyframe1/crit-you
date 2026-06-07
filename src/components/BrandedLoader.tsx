"use client";

import { motion, useReducedMotion } from "framer-motion";
import Pip from "./Pip";
import DieGlyph from "./DieGlyph";
import type { DieType } from "@/lib/dice";

// The dice that orbit Pip — a spread of the set, low → high around the ring.
const ORBIT: DieType[] = ["d4", "d8", "d12", "d20", "d10", "d6"];
const RING = 96; // orbit radius (px)
const DIE = 40; // orbiting die size (px)

// The cold-open loader. A clean, branded cream screen — the CRIT wordmark plus a
// Pip-with-the-big-dice-around motif — shown over everything while the 3D scene
// and fonts initialize, so the first paint is intentional rather than a flash of
// empty or half-built canvas. The parent fades it out (AnimatePresence) once the
// app is ready. Static under reduced motion.
export default function BrandedLoader() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: "var(--bg)" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Motif — Pip centred, the set orbiting around it. */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: RING * 2 + DIE, height: RING * 2 + DIE }}
      >
        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={
            reduce ? undefined : { duration: 18, ease: "linear", repeat: Infinity }
          }
        >
          {ORBIT.map((die, i) => {
            const a = (i / ORBIT.length) * Math.PI * 2 - Math.PI / 2;
            const cx = Math.cos(a) * RING;
            const cy = Math.sin(a) * RING;
            return (
              <div
                key={die}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: DIE,
                  height: DIE,
                  transform: `translate(-50%, -50%) translate(${cx}px, ${cy}px)`,
                  opacity: 0.5,
                }}
              >
                {/* Counter-rotate so each die stays upright as the ring turns. */}
                <motion.div
                  className="h-full w-full"
                  animate={reduce ? undefined : { rotate: -360 }}
                  transition={
                    reduce
                      ? undefined
                      : { duration: 18, ease: "linear", repeat: Infinity }
                  }
                >
                  <DieGlyph die={die} />
                </motion.div>
              </div>
            );
          })}
        </motion.div>

        {/* Pip — a gentle breathing pulse so the cold open feels alive. */}
        <motion.div
          animate={reduce ? undefined : { scale: [1, 1.06, 1], y: [0, -3, 0] }}
          transition={
            reduce ? undefined : { duration: 2.6, ease: "easeInOut", repeat: Infinity }
          }
        >
          <Pip expression="happy" size={92} />
        </motion.div>
      </div>

      {/* Wordmark — the d20 logo + CRIT, matching the header lockup. */}
      <div className="mt-7 flex items-center gap-2.5">
        <svg viewBox="0 0 160 160" width="22" height="22" aria-hidden className="shrink-0">
          <polygon points="80,8 152,44 152,116 80,152 8,116 8,44" fill="var(--accent)" />
          <g stroke="#ffffff" strokeOpacity="0.3" strokeWidth="3.5" fill="none" strokeLinejoin="round">
            <line x1="80" y1="8" x2="80" y2="152" />
            <line x1="8" y1="44" x2="152" y2="116" />
            <line x1="152" y1="44" x2="8" y2="116" />
            <line x1="8" y1="44" x2="152" y2="44" />
            <line x1="8" y1="116" x2="152" y2="116" />
          </g>
        </svg>
        <span className="font-sans text-[20px] font-bold uppercase tracking-[0.28em] text-[var(--ink)]">
          Crit
        </span>
      </div>

      {/* A quiet "settling" line of three dots. */}
      <div className="mt-4 flex items-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--mid)" }}
            animate={reduce ? undefined : { opacity: [0.25, 1, 0.25] }}
            transition={
              reduce
                ? undefined
                : { duration: 1.2, ease: "easeInOut", repeat: Infinity, delay: i * 0.18 }
            }
          />
        ))}
      </div>

      <span className="sr-only">Loading Crit…</span>
    </motion.div>
  );
}
