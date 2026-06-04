"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import {
  SHAPES,
  maxFor,
  animFor,
  DIE_STROKE,
  OUTER_WEIGHT,
  INNER_WEIGHT,
  type DieType,
  type TweenStep,
} from "@/lib/dice";

interface Props {
  dieType: DieType;
  // Fired once the result is revealed, with the rolled value. The parent owns
  // the result number, personality line, and share state.
  onRoll: (value: number) => void;
}

// Build and play a GSAP timeline from a list of TweenSteps on `el`, calling
// `onDone` when the whole sequence finishes. This is the generic engine behind
// every die's celebration (nat max) and failure (nat 1) flourish — the steps
// themselves live as data in lib/dice's AnimConfig, never as conditionals here.
function playSequence(
  el: SVGSVGElement,
  steps: TweenStep[],
  onDone: () => void
) {
  const tl = gsap.timeline({ onComplete: onDone });
  for (const s of steps) {
    if (s.set) {
      tl.set(el, s.set);
    } else if (s.hold != null) {
      tl.to({}, { duration: s.hold }); // an empty beat — a deliberate pause
    } else if (s.keyframes) {
      tl.to(el, {
        keyframes: s.keyframes,
        duration: s.duration ?? 0.3,
        ease: s.ease ?? "power2.out",
        delay: s.delay ?? 0,
      });
    } else if (s.to) {
      tl.to(el, {
        ...s.to,
        duration: s.duration ?? 0.3,
        ease: s.ease ?? "power2.out",
        delay: s.delay ?? 0,
      });
    }
  }
  return tl;
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

  // Latest selected die, readable from the stable idle callback so the float
  // picks up the right per-die timing (e.g. the d30's slower, grander drift).
  const dieRef = useRef(dieType);
  useEffect(() => {
    dieRef.current = dieType;
  }, [dieType]);

  // The shared idle float, tuned per die: sinusoidal Y + slight rotateX, forever.
  const startIdle = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const { y, rotateX, duration } = animFor(dieRef.current).float;
    gsap.to(body, {
      y,
      rotateX,
      duration,
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
  // then spring back in and restart the (now per-die) idle float.
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
    const cfg = animFor(dieType);
    const { tumble } = cfg;

    // Kill the idle float for the duration of the roll.
    gsap.killTweensOf(body);

    // Phase 1 — 3D tumble in, with this die's snap, spread, and squash.
    gsap.to(body, {
      rotateX: 360,
      rotateY: 360,
      rotateZ: gsap.utils.random(-tumble.rotateZ, tumble.rotateZ),
      scale: tumble.scale,
      duration: tumble.p1Dur,
      ease: tumble.p1Ease,
      onComplete: () => {
        // Phase 2 — settle with this die's overshoot.
        gsap.to(body, {
          rotateX: 0,
          rotateY: 0,
          rotateZ: 0,
          scale: 1,
          duration: tumble.p2Dur,
          ease: tumble.p2Ease,
          onComplete: () => {
            // Once settled, the die reacts to its own result, then resumes idle.
            const finish = () => {
              startIdle();
              setRolling(false);
            };
            if (num >= max && cfg.celebrate.length) {
              playSequence(body, cfg.celebrate, finish);
            } else if (num <= 1 && cfg.fail.length) {
              playSequence(body, cfg.fail, finish);
            } else {
              finish();
            }
          },
        });
      },
    });

    // Reveal the result mid-tumble (the parent renders the number).
    gsap.delayedCall(0.4, () => onRollRef.current(num));

    // Radial glow pulse behind the die on a natural max, intensity per die.
    if (num === max && glow) {
      gsap.fromTo(
        glow,
        { opacity: cfg.glowOpacity, scale: 0.8 },
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
