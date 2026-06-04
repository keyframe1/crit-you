"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import {
  SHAPES,
  maxFor,
  DIE_STROKE,
  OUTER_WEIGHT,
  INNER_WEIGHT,
  type DieType,
} from "@/lib/dice";

interface Props {
  dieType: DieType;
  // Fired once the die settles, with the rolled value. The parent owns the
  // result number, personality line, and share state.
  onRoll: (value: number) => void;
}

export default function Dice({ dieType, onRoll }: Props) {
  const bodyRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  // The shape currently drawn. Lags `dieType` so we can fade the old die out
  // before swapping the SVG and fading the new one in.
  const [shapeType, setShapeType] = useState<DieType>(dieType);
  const [rolling, setRolling] = useState(false);
  const [hinted, setHinted] = useState(true);

  // Keep the latest onRoll without resubscribing the roll handler.
  const onRollRef = useRef(onRoll);
  useEffect(() => {
    onRollRef.current = onRoll;
  }, [onRoll]);

  // The shared idle float: sinusoidal Y (4px) + slight rotateX (2°), forever.
  const startIdle = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    gsap.to(body, {
      y: 4,
      rotateX: 2,
      duration: 2.5,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  }, []);

  // Kick off the idle float on mount.
  useEffect(() => {
    startIdle();
    const body = bodyRef.current;
    return () => {
      if (body) gsap.killTweensOf(body);
    };
  }, [startIdle]);

  // Cross-fade when the selected die changes: fade/scale out, swap the SVG,
  // then spring back in and restart the idle float.
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const body = bodyRef.current;
    if (!body) return;

    gsap.killTweensOf(body);
    setRolling(false);
    gsap.to(body, {
      opacity: 0,
      scale: 0.9,
      duration: 0.2,
      ease: "power2.in",
      onComplete: () => {
        setShapeType(dieType);
        gsap.fromTo(
          body,
          { opacity: 0, scale: 0.9 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.3,
            ease: "back.out(1.5)",
            onComplete: startIdle,
          }
        );
      },
    });
  }, [dieType, startIdle]);

  const roll = useCallback(() => {
    if (rolling || !bodyRef.current) return;
    setRolling(true);
    setHinted(false);

    const body = bodyRef.current;
    const glow = glowRef.current;
    const max = maxFor(dieType);
    const num = Math.floor(Math.random() * max) + 1;

    // Kill the idle float for the duration of the roll.
    gsap.killTweensOf(body);

    // Phase 1 — 3D tumble in.
    gsap.to(body, {
      rotateX: 360,
      rotateY: 360,
      rotateZ: gsap.utils.random(-40, 40),
      scale: 0.82,
      duration: 0.35,
      ease: "power2.in",
      onComplete: () => {
        // Phase 2 — settle with a back.out overshoot.
        gsap.to(body, {
          rotateX: 0,
          rotateY: 0,
          rotateZ: 0,
          scale: 1,
          duration: 0.4,
          ease: "back.out(2.5)",
          onComplete: () => {
            startIdle();
            setRolling(false);
          },
        });
      },
    });

    // Reveal the result mid-tumble (the parent renders the number).
    gsap.delayedCall(0.4, () => onRollRef.current(num));

    // Radial glow pulse behind the die on a natural max.
    if (num === max && glow) {
      gsap.fromTo(
        glow,
        { opacity: 0.7, scale: 0.8 },
        { opacity: 0, scale: 1.3, duration: 0.8, ease: "power2.out" }
      );
    }
  }, [rolling, dieType, startIdle]);

  const shape = SHAPES[shapeType];

  return (
    <div className="flex flex-col items-center">
      <div
        onClick={roll}
        className="relative cursor-pointer select-none group"
        style={{
          width: "clamp(220px, 56vmin, 440px)",
          height: "clamp(220px, 56vmin, 440px)",
          perspective: "600px",
        }}
      >
        <svg
          ref={bodyRef}
          className="w-full h-full transition-[filter] duration-[400ms] group-hover:drop-shadow-[0_4px_24px_rgba(192,57,43,0.15)]"
          viewBox="0 0 160 160"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Interior facet edges (thin — structure). */}
          {shape.lines.map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={DIE_STROKE}
              strokeWidth={INNER_WEIGHT}
            />
          ))}
          {/* Silhouette outlines (heavy — solid). Drawn last, on top. */}
          {shape.polygons.map((points, i) => (
            <polygon
              key={i}
              points={points}
              fill="none"
              stroke={DIE_STROKE}
              strokeWidth={OUTER_WEIGHT}
              strokeLinejoin="round"
            />
          ))}
        </svg>
        <div
          ref={glowRef}
          className="absolute -inset-8 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(192,57,43,.4), transparent 70%)",
            opacity: 0,
          }}
        />
      </div>
      <p
        className={`font-mono text-[11px] tracking-[.12em] text-[var(--mid)] mt-3 transition-all duration-500 ${
          hinted ? "opacity-100" : "opacity-0 -translate-y-2"
        }`}
      >
        Tap the die
      </p>
    </div>
  );
}
