"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import {
  DICE,
  SHAPES,
  WIRE_COLOR,
  animFor,
  labelFor,
  type DieType,
} from "@/lib/dice";

interface Props {
  value: DieType;
  onChange: (type: DieType) => void;
}

// Miniature of the exact same wireframe-first die used full-size: translucent
// signature-colour fills behind a dark ink wireframe, scaled down. The strokes
// are bumped up a touch so the lines hold at chip size. Selected chips show the
// fills at slightly higher opacity; unselected chips are dimmed by the button.
const MINI_OUTER = 4;
const MINI_INNER = 2;

function MiniDie({ type, active }: { type: DieType; active: boolean }) {
  const shape = SHAPES[type];
  const color = animFor(type).color;

  // The celestial die has no facets — a tiny constellation instead.
  if (type === "dinf") {
    const c = active ? color : WIRE_COLOR;
    return (
      <svg viewBox="0 0 160 160" className="w-full h-full" style={{ overflow: "visible" }}>
        <circle
          cx="80"
          cy="80"
          r="66"
          fill="#0a0a14"
          fillOpacity={0.9}
          stroke={c}
          strokeWidth={3}
          strokeOpacity={0.45}
        />
        <circle cx="58" cy="58" r="6" fill={c} />
        <circle cx="104" cy="70" r="5" fill={c} />
        <circle cx="74" cy="106" r="6" fill={c} />
        <circle cx="110" cy="108" r="4" fill={c} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" style={{ overflow: "visible" }}>
      {shape.fills.map((f, i) => (
        <polygon
          key={`f${i}`}
          points={f.points}
          fill={color}
          fillOpacity={active ? Math.min(f.opacity * 1.4, 0.6) : f.opacity}
          stroke="none"
        />
      ))}
      {shape.wireLines.map(([x1, y1, x2, y2], i) => (
        <line
          key={`w${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={WIRE_COLOR}
          strokeWidth={MINI_INNER}
          strokeLinecap="round"
        />
      ))}
      <polygon
        points={shape.outline}
        fill="none"
        stroke={WIRE_COLOR}
        strokeWidth={MINI_OUTER}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Horizontal carousel of all eight dice. Drag to scroll, snap to the nearest
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

  // Uniform icon size: 44px desktop / 36px mobile. Selection is conveyed by a
  // 2px signature border + a 1.1 scale + a signature glow, not a size change.
  const iconSize = compact ? 36 : 44;
  const gap = compact ? 8 : 12;

  return (
    <div
      ref={containerRef}
      className="no-scrollbar relative overflow-hidden py-5"
      style={{ touchAction: "pan-y" }}
    >
      {/* A draggable row whose selected chip is JS-centred in the viewport (the
          50vw padding gives the end chips room to reach centre). Dragging /
          scrolling horizontally reaches the rest — important on narrow screens
          where all 8 chips can't sit on-screen at once. */}
      <motion.div
        className="flex items-end w-max px-[50vw] cursor-grab active:cursor-grabbing"
        style={{ x, gap }}
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
              className="flex flex-col items-center justify-end shrink-0 outline-none"
              style={{
                opacity: active ? 1 : 0.3,
                transition: "opacity 250ms ease-out",
              }}
              aria-label={`Select ${labelFor(d.type)}`}
              aria-pressed={active}
            >
              <div
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: iconSize,
                  height: iconSize,
                  padding: 3,
                  border: `2px solid ${active ? sig : "transparent"}`,
                  transform: active ? "scale(1.1)" : "scale(1)",
                  filter: active ? `drop-shadow(0 0 10px ${sig}4D)` : "none",
                  transition: "transform 250ms ease-out, border-color 250ms ease-out, filter 250ms ease-out",
                }}
              >
                <MiniDie type={d.type} active={active} />
              </div>
              <span
                className="font-mono text-[9px] tracking-[0.18em] uppercase mt-2"
                style={{
                  color: active ? sig : "var(--light)",
                  transition: "color 250ms ease-out",
                }}
              >
                {labelFor(d.type)}
              </span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
