"use client";

import { type ReactNode, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import Pip, { type PipExpression } from "./Pip";
import DieGlyph from "./DieGlyph";
import { CAP } from "@/lib/daily";
import { labelFor, type DieType } from "@/lib/dice";
import { analytics } from "@/lib/analytics";

// Pip's first-open rules walkthrough for the Daily. Six pointed beats — Pip's
// snark, but each mechanic exact and unmistakable — every beat tied to its UI
// element by depicting that element inline (a mini Total, the real BANK/ROLL
// chips, a bust row), so it reads identically on mobile with no fragile pixel-
// pinning to a live, possibly-not-yet-rendered button. Skippable; the parent
// flag-gates it to show once and re-opens it from the "?".

interface Beat {
  pip: PipExpression;
  cue: string; // the element this beat points at
  line: ReactNode; // Pip's voice
  rule: string; // the exact mechanic, plainly
  illo: ReactNode; // inline depiction of the element
}

// A 30px die glyph cell.
function GlyphCell({ die, size = 30 }: { die: DieType; size?: number }) {
  return (
    <div style={{ width: size, height: size }}>
      <DieGlyph die={die} />
    </div>
  );
}

function buildBeats(die: DieType): Beat[] {
  return [
    {
      pip: "smug",
      cue: "Today's dice",
      line: (
        <>
          Everyone gets the <strong>same</strong> dice today: same rolls, same
          order. No do-overs.
        </>
      ),
      rule: `Today's ${labelFor(die)} is identical for every player.`,
      illo: (
        <div className="flex items-center justify-center gap-2 text-[var(--mid)]">
          <GlyphCell die={die} />
          <span className="font-mono text-[13px]">=</span>
          <GlyphCell die={die} />
          <span className="font-mono text-[13px]">=</span>
          <GlyphCell die={die} />
        </div>
      ),
    },
    {
      pip: "happy",
      cue: "Your Total",
      line: (
        <>
          Every roll piles onto your <strong>Total</strong>. Number go up. Good
          number.
        </>
      ),
      rule: "Each roll adds its value to your running total.",
      illo: (
        <div className="flex items-end justify-center gap-3">
          <div className="text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--mid)]">
              Total
            </p>
            <p className="font-sans text-[28px] font-black leading-none tabular-nums text-[var(--ink)]">
              17
            </p>
          </div>
          <span className="pb-1 font-mono text-[15px] font-bold tabular-nums text-[#27ae60]">
            +6
          </span>
        </div>
      ),
    },
    {
      pip: "smug",
      cue: "The BANK button",
      line: (
        <>
          Hit <strong>BANK</strong> to lock those points in for keeps, and keep
          your streak alive.
        </>
      ),
      rule: "BANK = lock your points in + keep your streak.",
      illo: (
        <div className="flex items-center justify-center">
          <span className="rounded-full border border-[var(--ink)]/15 bg-black/[0.03] px-6 py-2.5 text-[14px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">
            🔒 Bank 17
          </span>
        </div>
      ),
    },
    {
      pip: "wink",
      cue: "The ROLL AGAIN button",
      line: (
        <>
          Feeling lucky? <strong>ROLL AGAIN</strong> to push for a fatter total.
          Bold.
        </>
      ),
      rule: "ROLL AGAIN = push for a bigger total.",
      illo: (
        <div className="flex items-center justify-center">
          <span className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-[14px] font-bold uppercase tracking-[0.08em] text-white">
            Roll again 🎲
          </span>
        </div>
      ),
    },
    {
      pip: "worried",
      cue: "The 1: read this twice",
      line: (
        <>
          Your <strong>first roll</strong> is always safe. After that, a{" "}
          <strong>1</strong> ends the run: <strong>0 points</strong> and your
          streak resets. So bank before you get greedy.
        </>
      ),
      rule: "First roll is safe. After that, a 1 busts you: this run → 0 points AND your streak resets.",
      illo: (
        <div className="flex items-center justify-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg font-sans text-[16px] font-black text-[var(--accent)]"
            style={{ border: "2px solid var(--accent)" }}
          >
            1
          </span>
          <span className="text-[15px]">💥</span>
          <span className="font-mono text-[13px] font-bold text-[var(--accent)]">
            points → 0
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[12px] text-[var(--mid)] line-through">
            <Flame size={13} strokeWidth={2} />
            streak
          </span>
        </div>
      ),
    },
    {
      pip: "proud",
      cue: "A perfect run",
      line: (
        <>
          Dodge the 1 all the way to the cap? That&apos;s a{" "}
          <strong>perfect run</strong>. Insufferable. I love it.
        </>
      ),
      rule: `Survive all ${CAP} rolls with no 1 = a perfect run.`,
      illo: (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {Array.from({ length: CAP }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-center rounded-md"
              style={{
                width: 22,
                height: 22,
                background: "rgba(0,0,0,0.03)",
                border: "1px solid transparent",
              }}
            >
              <div className="h-[16px] w-[16px]">
                <DieGlyph die={die} />
              </div>
            </div>
          ))}
          <span className="ml-1 text-[15px]">★</span>
        </div>
      ),
    },
  ];
}

export default function DailyWalkthrough({
  die,
  onDone,
}: {
  die: DieType;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const beats = buildBeats(die);
  const [i, setI] = useState(0);
  const beat = beats[i];
  const last = i === beats.length - 1;
  // Reaching the end (the final "Let's roll") is a completion; the Skip button
  // is a skip. Both still resolve through onDone.
  const next = () => {
    if (last) {
      analytics.walkthroughCompleted();
      onDone();
    } else {
      setI((n) => n + 1);
    }
  };
  const skip = () => {
    analytics.walkthroughSkipped();
    onDone();
  };
  const back = () => setI((n) => Math.max(0, n - 1));

  return (
    <motion.div
      className="absolute inset-0 z-[60] flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
    >
      {/* Scrim — dims the daily behind it. Deliberately non-dismissing (an easy
          accidental tap shouldn't kill the one teaching moment); use Skip. */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="How the Daily works"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 m-3 w-full max-w-[380px] rounded-3xl bg-white px-5 pb-5 pt-5"
        style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.28)" }}
      >
        {/* Pip + the snark, swapped per beat. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                <Pip expression={beat.pip} size={64} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: "var(--accent)" }}
                >
                  {beat.cue}
                </p>
                <p className="mt-1 font-sans text-[15px] leading-snug text-[var(--ink)]">
                  {beat.line}
                </p>
              </div>
            </div>

            {/* The element this beat points at, drawn inline. */}
            <div className="mt-4 flex min-h-[52px] items-center justify-center rounded-2xl bg-black/[0.03] px-3 py-3">
              {beat.illo}
            </div>

            {/* The exact mechanic, plainly. */}
            <p className="mt-3 text-center font-mono text-[11px] leading-relaxed text-[var(--mid)]">
              {beat.rule}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Footer: skip · progress dots · back/next. */}
        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={skip}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--mid)] transition-colors hover:text-[var(--ink)]"
          >
            Skip
          </button>

          <div className="flex items-center gap-1.5" aria-hidden>
            {beats.map((_, n) => (
              <span
                key={n}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: n === i ? 16 : 6,
                  background: n === i ? "var(--accent)" : "rgba(0,0,0,0.16)",
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            {i > 0 && (
              <button
                onClick={back}
                className="rounded-full px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--mid)] transition-colors hover:text-[var(--ink)]"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-[13px] font-bold uppercase tracking-[0.08em] text-white transition-opacity hover:opacity-90"
            >
              {last ? "Let's roll" : "Next"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
