"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import { SHAPES, maxFor, type DieType } from "@/lib/dice";

interface Props {
  dieType: DieType;
  // Fired once the die settles, with the rolled value. The parent owns the
  // result number, personality line, and share state.
  onRoll: (value: number) => void;
}

export default function Dice({ dieType, onRoll }: Props) {
  const bodyRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rolling, setRolling] = useState(false);
  const [hinted, setHinted] = useState(true);

  // Keep the latest onRoll without resubscribing the roll handler.
  const onRollRef = useRef(onRoll);
  useEffect(() => {
    onRollRef.current = onRoll;
  }, [onRoll]);

  // Idle float — runs whenever the die is at rest. Restarted after each roll.
  useEffect(() => {
    if (!bodyRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(bodyRef.current, {
        y: 4,
        rotateX: 2,
        duration: 2.5,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    });
    return () => ctx.revert();
  }, []);

  const roll = useCallback(() => {
    if (rolling || !bodyRef.current) return;
    setRolling(true);
    setHinted(false);

    const body = bodyRef.current;
    const glow = glowRef.current;
    const max = maxFor(dieType);
    const num = Math.floor(Math.random() * max) + 1;

    // Kill idle float during roll.
    gsap.killTweensOf(body);

    // 3D tumble.
    gsap.to(body, {
      rotateX: 360,
      rotateY: 360,
      rotateZ: gsap.utils.random(-40, 40),
      scale: 0.82,
      duration: 0.35,
      ease: "power2.in",
      onComplete: () => {
        // Settle with spring.
        gsap.to(body, {
          rotateX: 0,
          rotateY: 0,
          rotateZ: 0,
          scale: 1,
          duration: 0.4,
          ease: "back.out(2.5)",
          onComplete: () => {
            // Restart idle float.
            gsap.to(body, {
              y: 4,
              rotateX: 2,
              duration: 2.5,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            });
            setRolling(false);
          },
        });
      },
    });

    // Reveal the result as the die begins to settle (parent renders the number).
    gsap.delayedCall(0.4, () => onRollRef.current(num));

    // Radial glow pulse behind the die on a natural max.
    if (num === max && glow) {
      gsap.fromTo(
        glow,
        { opacity: 0.6, scale: 0.8 },
        { opacity: 0, scale: 1.3, duration: 0.8, ease: "power2.out" }
      );
    }
  }, [rolling, dieType]);

  const shape = SHAPES[dieType];

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        onClick={roll}
        className="relative cursor-pointer select-none group"
        style={{
          width: "clamp(220px, 56vmin, 440px)",
          height: "clamp(220px, 56vmin, 440px)",
          perspective: "900px",
        }}
      >
        <svg
          ref={bodyRef}
          className="w-full h-full transition-[filter] duration-300 group-hover:drop-shadow-[0_8px_40px_rgba(192,57,43,.22)]"
          viewBox="0 0 160 160"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Interior facet edges (thin). */}
          {shape.lines.map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#3a3833"
              strokeWidth="1"
            />
          ))}
          {/* Outlines (heavier). Drawn last so they sit on top. */}
          {shape.polygons.map((points, i) => (
            <polygon
              key={i}
              points={points}
              fill="none"
              stroke="#8a8780"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          ))}
        </svg>
        <div
          ref={glowRef}
          className="absolute -inset-8 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(192,57,43,.45), transparent 70%)",
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
