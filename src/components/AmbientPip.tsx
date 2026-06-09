"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Pip from "./Pip";

// Ambient "Pip rolls by". On the free-play screen, after a long idle stretch with
// no interaction, Pip occasionally tumbles across the very bottom edge of the
// viewport — rolls in from one side, bounces across, exits the other — then a long
// cooldown. A rare, deliberate delight, not a companion.
//
// The bar is restraint, so it is hemmed in on every side:
//   • Peripheral only — a thin lane pinned to the bottom edge, behind everything,
//     pointer-events-none. Never over the centred die / play area.
//   • Rare + brief — a long idle gate before it may appear, one short pass, then a
//     long cooldown before it could happen again.
//   • Yields to the core interaction — the `active` prop (false during a roll) and
//     any real interaction end an in-flight pass instantly; a body scroll-lock
//     (the Daily / walkthrough modals) suppresses it entirely.
//   • Disabled outright under prefers-reduced-motion.

const IDLE_MS = 20_000; // no interaction this long before Pip may roll by
const COOLDOWN_MS = 90_000; // minimum gap between passes (err rarer)
const TICK_MS = 1_500; // how often the gate re-checks
const PASS_MS = 5_600; // duration of one roll-across pass
const PIP_SIZE = 36;
const PX_PER_TURN = 300; // distance Pip rolls per full rotation (rolling feel)

interface Pass {
  id: number;
  width: number;
}

export default function AmbientPip({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [pass, setPass] = useState<Pass | null>(null);

  const lastActivity = useRef(0);
  const lastPassEnd = useRef(0);
  const passingRef = useRef(false);
  const seqRef = useRef(0);
  const activeRef = useRef(active);

  // End an in-flight pass the instant the screen turns active-busy (a roll begins,
  // the app un-readies). `active` already excludes those moments.
  useEffect(() => {
    activeRef.current = active;
    if (!active && passingRef.current) {
      passingRef.current = false;
      setPass(null);
    }
  }, [active]);

  // Any real interaction means the user is present: reset the idle clock and clear
  // any pass in flight so Pip gets out of the way.
  useEffect(() => {
    if (reduce) return;
    lastActivity.current = Date.now();
    const bump = () => {
      lastActivity.current = Date.now();
      if (passingRef.current) {
        passingRef.current = false;
        setPass(null);
      }
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", bump, opts);
    window.addEventListener("keydown", bump);
    window.addEventListener("wheel", bump, opts);
    window.addEventListener("touchstart", bump, opts);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("wheel", bump);
      window.removeEventListener("touchstart", bump);
    };
  }, [reduce]);

  // The gate: periodically decide whether it's time to send Pip across.
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      if (passingRef.current || !activeRef.current) return;
      const t = Date.now();
      if (t - lastActivity.current < IDLE_MS) return;
      if (lastPassEnd.current && t - lastPassEnd.current < COOLDOWN_MS) return;
      // A modal (Daily / walkthrough) locks body scroll — never roll behind it.
      if (document.body.style.overflow === "hidden") return;
      // Don't spend a pass on a hidden tab.
      if (document.hidden) return;
      passingRef.current = true;
      seqRef.current += 1;
      setPass({ id: seqRef.current, width: window.innerWidth });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [reduce]);

  if (reduce || !pass) return null;

  const endPass = () => {
    passingRef.current = false;
    lastPassEnd.current = Date.now();
    setPass(null);
  };

  const startX = -PIP_SIZE - 12;
  const endX = pass.width + 12;
  const travel = endX - startX;
  const turns = (travel / PX_PER_TURN) * 360;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 overflow-hidden"
      style={{ height: PIP_SIZE + 14 }}
    >
      <motion.div
        key={pass.id}
        className="absolute bottom-1.5 left-0"
        initial={{ x: startX, rotate: 0, y: 0 }}
        animate={{
          x: endX,
          rotate: turns, // rolls clockwise as it travels right
          y: [0, -7, 0, -7, 0, -7, 0], // gentle tumbling hops
        }}
        transition={{
          x: { duration: PASS_MS / 1000, ease: "linear" },
          rotate: { duration: PASS_MS / 1000, ease: "linear" },
          y: { duration: PASS_MS / 1000, ease: "easeInOut" },
        }}
        onAnimationComplete={endPass}
        style={{ width: PIP_SIZE, height: PIP_SIZE, opacity: 0.92 }}
      >
        <Pip expression="smug" size={PIP_SIZE} />
      </motion.div>
    </div>
  );
}
