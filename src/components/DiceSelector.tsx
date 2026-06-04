"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { DICE, SHAPES, DIE_STROKE, animFor, type DieType } from "@/lib/dice";

interface Props {
  value: DieType;
  onChange: (type: DieType) => void;
}

// Miniature of the exact same wireframe used full-size — same warm off-white
// (the die's signature colour when selected) and the same 2.2 : 1.0 weight
// ratio, scaled up so the strokes stay visible at chip size.
const MINI_OUTER = 5.5;
const MINI_INNER = 2.5;

function MiniDie({ type, active }: { type: DieType; active: boolean }) {
  const color = active ? animFor(type).color : DIE_STROKE;
  const shape = SHAPES[type];
  return (
    <svg
      viewBox="0 0 160 160"
      className="w-full h-full transition-colors duration-200"
      style={{ overflow: "visible" }}
    >
      {shape.lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={MINI_INNER}
        />
      ))}
      {shape.polygons.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={MINI_OUTER}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

// Horizontal carousel of all seven dice. Drag to scroll, snap to the nearest
// chip on release; tap to select. The selected chip is centred and highlighted.
export default function DiceSelector({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const x = useMotionValue(0);
  // Tighter chip sizes on small screens so the row stays comfortably in frame.
  const [compact, setCompact] = useState(false);

  // Centre a given chip in the viewport.
  const center = (index: number, withAnim = true) => {
    const c = containerRef.current;
    const it = itemRefs.current[index];
    if (!c || !it) return;
    const target = c.clientWidth / 2 - (it.offsetLeft + it.offsetWidth / 2);
    if (withAnim) {
      animate(x, target, { type: "spring", stiffness: 420, damping: 42 });
    } else {
      x.set(target);
    }
  };

  // Snap to whichever chip is closest to centre after a drag.
  const handleDragEnd = () => {
    const c = containerRef.current;
    if (!c) return;
    const cx = c.clientWidth / 2;
    const cur = x.get();
    let best = 0;
    let bestDist = Infinity;
    itemRefs.current.forEach((it, i) => {
      if (!it) return;
      const itemCenter = it.offsetLeft + it.offsetWidth / 2 + cur;
      const dist = Math.abs(itemCenter - cx);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    const type = DICE[best].type;
    if (type !== value) onChange(type);
    else center(best);
  };

  // Track the compact breakpoint (< 640px).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Recenter whenever the selection changes, on mount, and on resize.
  const index = DICE.findIndex((d) => d.type === value);
  useEffect(() => {
    center(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    center(index, false);
    const onResize = () => center(index, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  const activeSize = compact ? 48 : 64;
  const inactiveSize = compact ? 40 : 48;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden py-5"
      style={{ touchAction: "pan-y" }}
    >
      <motion.div
        className="flex items-end gap-4 w-max px-[50vw] cursor-grab active:cursor-grabbing"
        style={{ x }}
        drag="x"
        dragElastic={0.18}
        onDragEnd={handleDragEnd}
      >
        {DICE.map((d, i) => {
          const active = d.type === value;
          const sig = animFor(d.type).color;
          return (
            <button
              key={d.type}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              onClick={() => (active ? center(i) : onChange(d.type))}
              className="flex flex-col items-center justify-end shrink-0 transition-all duration-300 outline-none"
              style={{ opacity: active ? 1 : 0.4 }}
              aria-label={`Select ${d.type.toUpperCase()}`}
              aria-pressed={active}
            >
              <div
                className="transition-all duration-300"
                style={{
                  width: active ? activeSize : inactiveSize,
                  height: active ? activeSize : inactiveSize,
                  transform: active ? "scale(1)" : "scale(0.92)",
                  filter: active
                    ? `drop-shadow(0 4px 16px ${sig}59)`
                    : "none",
                }}
              >
                <MiniDie type={d.type} active={active} />
              </div>
              <span
                className="font-mono text-[9px] tracking-[0.18em] mt-2"
                style={{ color: active ? sig : "var(--light)" }}
              >
                {d.type.toUpperCase()}
              </span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
