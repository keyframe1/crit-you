"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import {
  SHAPES,
  maxFor,
  animFor,
  faceColor,
  DIE_STROKE,
  EDGE_WEIGHT,
  EDGE_OPACITY,
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

// Build and play a GSAP timeline from a list of TweenSteps on `el`, calling
// `onDone` when finished. The generic engine behind every die's body flourish
// (celebration / failure) — the steps themselves live as data in lib/dice.
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

  // The idle float, tuned per die: a slow, visible Y bob (±y/2 around rest)
  // plus a slight rotateX, a rotateZ sway, and a rotateY tilt that shifts the
  // facets in perspective. The contact shadow runs on the SAME clock, inverted
  // — widest & faintest when the die is at the top of its bob, tight & dark at
  // the bottom. That inverse motion is what sells "floating".
  const startIdle = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const { y, rotateX, rotateZ, rotateY, duration } = animFor(
      dieRef.current
    ).float;
    gsap.set(body, { y: -y / 2 });
    gsap.to(body, {
      y: y / 2,
      rotateX,
      rotateZ,
      rotateY,
      duration,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    const shadow = shadowRef.current;
    if (shadow) {
      gsap.set(shadow, { scaleX: 1.2, opacity: 0.15 });
      gsap.to(shadow, {
        scaleX: 0.8,
        opacity: 0.35,
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

  // Reveal the result number inside the die. It is already at its final size —
  // it simply materialises with a fade, never scaling in from a larger size.
  // Nat max pulses once after appearing; nat min fades in slower and dimmer.
  const revealNumber = useCallback(
    (value: number, isMax: boolean, isMin: boolean) => {
      const el = numberRef.current;
      if (!el) return;
      el.textContent = String(value);
      el.style.fill = isMax ? "#c0392b" : isMin ? "#555555" : "#e8e4dc";
      el.style.filter = isMax
        ? "drop-shadow(0 0 8px rgba(192,57,43,0.6))"
        : "none";

      gsap.killTweensOf(el);
      const tl = gsap.timeline();
      tl.set(el, { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 });
      if (isMin) {
        // Dejected: a slow fade-in to a reduced opacity.
        tl.to(el, { opacity: 0.7, duration: 0.7, ease: "power2.out" });
      } else if (isMax) {
        tl.to(el, { opacity: 1, duration: 0.4, ease: "power2.out" });
        // A single subtle pulse once it's there.
        tl.to(el, {
          keyframes: { scale: [1, 1.08, 1] },
          duration: 0.3,
          ease: "power2.inOut",
        });
      } else {
        tl.to(el, { opacity: 1, duration: 0.4, ease: "power2.out" });
      }
      // Hold long enough to read, then simply fade out — no movement, no scale.
      tl.to(el, { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=1.5");
    },
    []
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
    gsap.to(body, {
      opacity: 0,
      scale: 0.9,
      duration: 0.35,
      ease: "power2.in",
      onComplete: () => {
        setShapeType(dieType);
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
      {/* Floating contact shadow, ~20px below the die. The wrapper centres it
          and carries the hover response; the inner element is what GSAP pulses
          inversely with the float. */}
      <div
        className="absolute left-1/2 pointer-events-none"
        style={{
          bottom: "-6%",
          width: "50%",
          height: "8%",
          zIndex: 0,
          transform: hovered
            ? "translateX(-50%) scaleX(1.15)"
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
              "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
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
          {/* Solid, shaded facets (a same-colour hairline kills anti-alias
              seams between adjacent faces). */}
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
          {/* Internal facet edges — each drawn once, off-white, miter-sharp. */}
          {shape.edges.map(([x1, y1, x2, y2], i) => (
            <line
              key={`e${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={DIE_STROKE}
              strokeWidth={EDGE_WEIGHT}
              strokeOpacity={EDGE_OPACITY}
              strokeLinecap="round"
            />
          ))}
          {/* Outer silhouette — a slightly bolder edge against the background. */}
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
          it scales with the die. It fades in at its final size. */}
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
          fontSize="36"
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
