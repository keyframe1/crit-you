"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import {
  SHAPES,
  maxFor,
  animFor,
  faceColor,
  DIE_STROKE,
  SILHOUETTE_WEIGHT,
  SILHOUETTE_OPACITY,
  type DieType,
  type TweenStep,
} from "@/lib/dice";

interface Props {
  dieType: DieType;
  // Fired once the result is revealed, with the rolled value. The parent owns
  // the personality line and share state; the result number lives in here.
  onRoll: (value: number) => void;
}

// The shared intro for an ordinary (non nat-1, non nat-max) result number.
const NUMBER_NORMAL: TweenStep[] = [
  { set: { opacity: 0, scale: 2.8, x: 0, y: 0, rotation: 0 } },
  { to: { opacity: 1, scale: 1 }, duration: 0.4, ease: "back.out(3)" },
];

// Build and play a GSAP timeline from a list of TweenSteps on `el`, calling
// `onDone` when finished. The generic engine behind every die's body flourish
// (celebration / failure) and its result-number intro — the steps themselves
// live as data in lib/dice, never as conditionals here.
function playSequence(el: Element, steps: TweenStep[], onDone?: () => void) {
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
  const shadowRef = useRef<HTMLDivElement>(null);
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

  // The shared idle float, tuned per die: a slow Y bob + slight rotateX/rotateZ
  // sway. The contact shadow runs on the same clock, inverted — when the die
  // floats up the shadow widens and fades, when it sinks the shadow tightens
  // and darkens. That inverse motion is what sells "floating".
  const startIdle = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const { y, rotateX, rotateZ, duration } = animFor(dieRef.current).float;
    gsap.to(body, {
      y,
      rotateX,
      rotateZ,
      duration,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    const shadow = shadowRef.current;
    if (shadow) {
      gsap.set(shadow, { scaleX: 1.15, opacity: 0.12 });
      gsap.to(shadow, {
        scaleX: 0.85,
        opacity: 0.25,
        duration,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    }
  }, []);

  // Kick off the idle float on mount.
  useEffect(() => {
    startIdle();
    const body = bodyRef.current;
    const shadow = shadowRef.current;
    return () => {
      if (body) gsap.killTweensOf(body);
      if (shadow) gsap.killTweensOf(shadow);
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
        // Hold long enough to read, then fade out; the die returns to idle.
        gsap.to(el, {
          opacity: 0,
          duration: 0.35,
          delay: 1.5,
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
    if (shadowRef.current) gsap.killTweensOf(shadowRef.current);
    if (numberRef.current) {
      gsap.killTweensOf(numberRef.current);
      gsap.set(numberRef.current, { opacity: 0 });
    }
    setRolling(false);
    // Current die: fades + scales out (0.35s).
    gsap.to(body, {
      opacity: 0,
      scale: 0.9,
      duration: 0.35,
      ease: "power2.in",
      onComplete: () => {
        setShapeType(dieType);
        // ~100ms gap, then the new die springs in (0.45s).
        gsap.fromTo(
          body,
          { opacity: 0, scale: 0.9 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.45,
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

    // Kill the idle float (body + shadow) and hide any lingering number.
    gsap.killTweensOf(body);
    if (shadowRef.current) gsap.killTweensOf(shadowRef.current);
    if (numberRef.current) {
      gsap.killTweensOf(numberRef.current);
      gsap.set(numberRef.current, { opacity: 0 });
    }

    // Phase 1 — a heavy 3D tumble in.
    gsap.to(body, {
      rotateX: 360,
      rotateY: 360,
      rotateZ: gsap.utils.random(-tumble.rotateZ, tumble.rotateZ),
      scale: tumble.scale,
      duration: tumble.p1Dur,
      ease: tumble.p1Ease,
      onComplete: () => {
        // Phase 2 — let the settle breathe, with this die's overshoot.
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
      {/* Floating contact shadow. The wrapper centres it and carries the hover
          response; the inner element is what GSAP pulses with the float. */}
      <div
        className="absolute left-1/2 bottom-[1%] pointer-events-none"
        style={{
          width: "62%",
          height: "9%",
          zIndex: 0,
          transform: hovered
            ? "translateX(-50%) scaleX(1.12)"
            : "translateX(-50%) scaleX(1)",
          opacity: hovered ? 0.7 : 1,
          transition: `transform ${hoverMs}ms ease-out, opacity ${hoverMs}ms ease-out`,
        }}
      >
        <div
          ref={shadowRef}
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0) 70%)",
            opacity: 0.2,
            transformOrigin: "center",
          }}
        />
      </div>

      {/* Signature-coloured glow behind the die (nat-max pulse + swap tint). */}
      <div
        ref={glowRef}
        className="absolute -inset-8 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}66, transparent 70%)`,
          opacity: 0,
          zIndex: 0,
        }}
      />

      {/* Hover lift + signature drop-shadow live here, separate from the
          GSAP-driven float/tumble on the SVG inside. */}
      <div
        className="relative h-full w-full"
        style={{
          zIndex: 10,
          transform: hovered ? "translateY(-8px)" : "translateY(0px)",
          filter: hovered
            ? `drop-shadow(0 0 20px ${color}33)`
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
          {/* Solid, shaded facets — back-to-front. No internal wireframe; the
              shade difference between faces is what defines the edges. A
              same-colour hairline stroke just covers anti-alias seams. */}
          {shape.faces.map((f, i) => {
            const fc = faceColor(color, f.depth, hovered);
            return (
              <polygon
                key={i}
                points={f.points}
                fill={fc}
                stroke={fc}
                strokeWidth={0.75}
                strokeLinejoin="round"
                style={{
                  transition: `fill ${hoverMs}ms ease-out, stroke ${hoverMs}ms ease-out`,
                }}
              />
            );
          })}
          {/* Outer silhouette — a faint edge against the dark background. */}
          {shape.polygons.map((points, i) => (
            <polygon
              key={`o${i}`}
              points={points}
              fill="none"
              stroke={DIE_STROKE}
              strokeWidth={SILHOUETTE_WEIGHT}
              strokeOpacity={SILHOUETTE_OPACITY}
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
