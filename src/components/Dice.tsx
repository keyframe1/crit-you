"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import {
  SHAPES,
  maxFor,
  animFor,
  faceOpacity,
  DIE_STROKE,
  OUTER_WEIGHT,
  INNER_WEIGHT,
  type DieType,
  type TweenStep,
} from "@/lib/dice";

interface Props {
  dieType: DieType;
  // Fired once the result is revealed, with the rolled value. The parent owns
  // the personality line and share state; the result number lives in here now.
  onRoll: (value: number) => void;
}

// The shared intro for an ordinary (non nat-1, non nat-max) result number:
// spring down from a large scale with a back.out overshoot.
const NUMBER_NORMAL: TweenStep[] = [
  { set: { opacity: 0, scale: 2.8, x: 0, y: 0, rotation: 0 } },
  { to: { opacity: 1, scale: 1 }, duration: 0.4, ease: "back.out(3)" },
];

// Build and play a GSAP timeline from a list of TweenSteps on `el`, calling
// `onDone` when the whole sequence finishes. The generic engine behind every
// die's body flourishes (celebration / failure) and its result-number intro —
// the steps themselves live as data in lib/dice, never as conditionals here.
function playSequence(
  el: Element,
  steps: TweenStep[],
  onDone?: () => void
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
  const numberRef = useRef<SVGTextElement>(null);
  // The shape currently drawn. Lags `dieType` so we can fade the old die out
  // before swapping the SVG and fading the new one in.
  const [shapeType, setShapeType] = useState<DieType>(dieType);
  const [rolling, setRolling] = useState(false);
  const [hovered, setHovered] = useState(false);

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

  // Reveal the result number inside the die, with this die's intimate intro.
  const revealNumber = useCallback(
    (value: number, isMax: boolean, isMin: boolean) => {
      const el = numberRef.current;
      if (!el) return;
      const cfg = animFor(dieType);
      el.textContent = String(value);
      const color = isMax
        ? cfg.numberMaxColor ?? "#c0392b"
        : isMin
        ? "#555555"
        : "#e8e4dc";
      el.style.fill = color;
      el.style.filter = isMax ? `drop-shadow(0 0 10px ${color}99)` : "none";

      const steps = isMax
        ? cfg.numberMax
        : isMin
        ? cfg.numberMin
        : NUMBER_NORMAL;

      gsap.killTweensOf(el);
      playSequence(el, steps, () => {
        // Hold, then fade out, and the die returns to its idle float.
        gsap.to(el, {
          opacity: 0,
          duration: 0.35,
          delay: 0.85,
          ease: "power2.in",
        });
      });
    },
    [dieType]
  );

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
    if (numberRef.current) {
      gsap.killTweensOf(numberRef.current);
      gsap.set(numberRef.current, { opacity: 0 });
    }
    setRolling(false);
    // Current die: fades + scales out (0.25s).
    gsap.to(body, {
      opacity: 0,
      scale: 0.9,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        setShapeType(dieType);
        // 100ms gap, then the new die springs in (0.35s).
        gsap.fromTo(
          body,
          { opacity: 0, scale: 0.9 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.35,
            delay: 0.1,
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

    const body = bodyRef.current;
    const glow = glowRef.current;
    const max = maxFor(dieType);
    const num = Math.floor(Math.random() * max) + 1;
    const cfg = animFor(dieType);
    const { tumble } = cfg;

    // Kill the idle float and hide any lingering number for the roll.
    gsap.killTweensOf(body);
    if (numberRef.current) {
      gsap.killTweensOf(numberRef.current);
      gsap.set(numberRef.current, { opacity: 0 });
    }

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

    // Reveal the result mid-tumble — line to the parent, number inside the die.
    gsap.delayedCall(0.4, () => {
      onRollRef.current(num);
      revealNumber(num, num >= max, num <= 1);
    });

    // Radial glow pulse behind the die on a natural max, intensity per die.
    if (num === max && glow) {
      gsap.fromTo(
        glow,
        { opacity: cfg.glowOpacity, scale: 0.8 },
        { opacity: 0, scale: 1.3, duration: 0.8, ease: "power2.out" }
      );
    }
  }, [rolling, dieType, startIdle, revealNumber]);

  const shape = SHAPES[shapeType];
  const color = animFor(shapeType).color;
  // Hover brightens the fills and is faster to engage (300ms) than to release.
  const hoverBoost = hovered ? 0.05 : 0;
  const hoverMs = hovered ? 300 : 400;

  return (
    <div
      onClick={roll}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={() => setHovered(true)}
      onPointerCancel={() => setHovered(false)}
      className="relative cursor-pointer select-none"
      style={{
        width: "clamp(200px, 55vmin, 320px)",
        height: "clamp(200px, 55vmin, 320px)",
        perspective: "600px",
      }}
    >
      {/* Signature-coloured glow behind the die (tints on a nat max and on swap). */}
      <div
        ref={glowRef}
        className="absolute -inset-8 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}66, transparent 70%)`,
          opacity: 0,
          zIndex: 0,
        }}
      />

      {/* Hover scaler: scale + signature drop-shadow live here, separate from the
          GSAP-driven float/tumble on the SVG inside. */}
      <div
        className="relative h-full w-full"
        style={{
          zIndex: 10,
          transform: hovered ? "scale(1.03)" : "scale(1)",
          filter: hovered
            ? `drop-shadow(0 0 24px ${color}40)`
            : `drop-shadow(0 0 0px ${color}00)`,
          transition: `transform ${hoverMs}ms ease-out, filter ${hoverMs}ms ease-out`,
        }}
      >
        <svg
          ref={bodyRef}
          className="w-full h-full"
          viewBox="0 0 160 160"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Translucent facet fills (bottom — gives the die solidity & depth). */}
          {shape.faces.map((f, i) => (
            <polygon
              key={i}
              points={f.points}
              fill={color}
              stroke="none"
              style={{
                fillOpacity: faceOpacity(f.depth) + hoverBoost,
                transition: `fill-opacity ${hoverMs}ms ease-out`,
              }}
            />
          ))}
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
      </div>

      {/* Result number, centred over the die in the same 160×160 user space so
          it scales with the die. GSAP animates it from its own centre. */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        viewBox="0 0 160 160"
        aria-hidden
        style={{ overflow: "visible", zIndex: 20 }}
      >
        <text
          ref={numberRef}
          x="80"
          y="80"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="52"
          fontWeight="900"
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            opacity: 0,
            transformBox: "fill-box",
            transformOrigin: "center",
          }}
        />
      </svg>
    </div>
  );
}
