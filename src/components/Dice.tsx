"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import {
  SHAPES,
  maxFor,
  animFor,
  faceColor,
  CELESTIAL_STARS,
  CELESTIAL_LINES,
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
// `onDone` when finished. The generic engine behind every die's body flourish.
function playSequence(el: Element, steps: TweenStep[], onDone?: () => void) {
  const tl = gsap.timeline({ onComplete: onDone });
  for (const s of steps) {
    if (s.set) {
      tl.set(el, s.set);
    } else if (s.hold != null) {
      tl.to({}, { duration: s.hold });
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
  const flareRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<SVGTextElement>(null);
  const twitchRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<SVGGElement>(null);
  const linesRef = useRef<SVGGElement>(null);
  const twinkles = useRef<gsap.core.Tween[]>([]);
  // The idle float timeline (body + contact shadow, perfectly in sync) and its
  // independent off-phase jitter tween, kept so we can tear both down cleanly.
  const idleTl = useRef<gsap.core.Timeline | null>(null);
  const jitterTween = useRef<gsap.core.Tween | null>(null);
  // The shape currently drawn. Lags `dieType` so we can fade the old die out
  // before swapping the SVG and fading the new one in.
  const [shapeType, setShapeType] = useState<DieType>(dieType);
  const [rolling, setRolling] = useState(false);
  const [hovered, setHovered] = useState(false);

  const onRollRef = useRef(onRoll);
  useEffect(() => {
    onRollRef.current = onRoll;
  }, [onRoll]);

  const dieRef = useRef(dieType);
  useEffect(() => {
    dieRef.current = dieType;
  }, [dieType]);

  // Tear down every idle animation (float timeline, jitter, and any stray
  // tweens) on the body and the contact shadow.
  const killIdle = useCallback(() => {
    idleTl.current?.kill();
    idleTl.current = null;
    jitterTween.current?.kill();
    jitterTween.current = null;
    if (bodyRef.current) gsap.killTweensOf(bodyRef.current);
    if (shadowRef.current) gsap.killTweensOf(shadowRef.current);
  }, []);

  // The idle float, fully per-die: a Y bob (±y/2 around rest) plus the die's own
  // primary rotations, easing up from wherever it is (no snap) and then looping.
  // The contact shadow rides the SAME timeline, inverted — wide+faint when the
  // die is high, tight+dark when it's low — so the two are perfectly in sync. An
  // optional off-phase jitter runs as its own independent tween on top.
  const startIdle = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    killIdle();
    const f = animFor(dieRef.current).float;
    const shadow = shadowRef.current;
    if (shadow) gsap.set(shadow, { scaleX: 1.25, opacity: 0.06 });
    gsap.to(body, {
      y: -f.y / 2,
      rotateX: 0,
      rotateZ: 0,
      rotateY: 0,
      duration: 0.6,
      ease: "sine.out",
      onComplete: () => {
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        const bodyTo: gsap.TweenVars = {
          y: f.y / 2,
          duration: f.duration,
          ease: "sine.inOut",
        };
        if (f.rotateX != null) bodyTo.rotateX = f.rotateX;
        if (f.rotateY != null) bodyTo.rotateY = f.rotateY;
        if (f.rotateZ != null) bodyTo.rotateZ = f.rotateZ;
        tl.to(body, bodyTo, 0);
        if (shadow) {
          tl.to(
            shadow,
            { scaleX: 0.75, opacity: 0.18, duration: f.duration, ease: "sine.inOut" },
            0
          );
        }
        idleTl.current = tl;
        if (f.jitter) {
          jitterTween.current = gsap.to(body, {
            [f.jitter.prop]: f.jitter.amount,
            duration: f.jitter.duration,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: f.jitter.delay ?? 0,
          });
        }
      },
    });
  }, [killIdle]);

  useEffect(() => {
    startIdle();
    return () => killIdle();
  }, [startIdle, killIdle]);

  // Constant asynchronous star twinkle + a slow constellation-line pulse, for
  // the celestial die only. Restartable so the celebration/failure can take
  // over and then resume it.
  const startTwinkle = useCallback(() => {
    twinkles.current.forEach((t) => t.kill());
    twinkles.current = [];
    const starsEl = starsRef.current;
    const linesEl = linesRef.current;
    if (starsEl) {
      Array.from(starsEl.children).forEach((star) => {
        const dur = 1.5 + Math.random() * 1.5;
        const delay = Math.random() * 2;
        const hi = 0.6 + Math.random() * 0.4;
        twinkles.current.push(
          gsap.fromTo(
            star,
            { opacity: 0.3 },
            {
              opacity: hi,
              duration: dur,
              delay,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
            }
          )
        );
      });
    }
    if (linesEl) {
      gsap.set(linesEl, { opacity: 0.15 });
      twinkles.current.push(
        gsap.to(linesEl, {
          opacity: 0.35,
          duration: 4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
      );
    }
  }, []);

  useEffect(() => {
    if (shapeType === "dinf") startTwinkle();
    return () => {
      twinkles.current.forEach((t) => t.kill());
      twinkles.current = [];
    };
  }, [shapeType, startTwinkle]);

  // Reveal the result number inside the die — it fades in at its final size,
  // never scaling from larger. Nat max pulses once; nat min fades slower/dimmer.
  const revealNumber = useCallback(
    (
      value: number,
      isMax: boolean,
      isMin: boolean,
      accent: string,
      normalColor: string
    ) => {
      const el = numberRef.current;
      if (!el) return;
      el.textContent = String(value);
      // On the cream page the number is dark ink; nat max takes the signature
      // accent, nat min a faint warm grey. The celestial die passes a light
      // normal colour since its number sits on a dark sphere.
      el.style.fill = isMax ? accent : isMin ? "#aaa8a0" : normalColor;
      el.style.filter = isMax ? `drop-shadow(0 0 8px ${accent}99)` : "none";

      gsap.killTweensOf(el);
      const tl = gsap.timeline();
      tl.set(el, { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 });
      if (isMin) {
        tl.to(el, { opacity: 0.7, duration: 0.7, ease: "power2.out" });
      } else if (isMax) {
        tl.to(el, { opacity: 1, duration: 0.4, ease: "power2.out" });
        tl.to(el, {
          keyframes: { scale: [1, 1.08, 1] },
          duration: 0.3,
          ease: "power2.inOut",
        });
      } else {
        tl.to(el, { opacity: 1, duration: 0.4, ease: "power2.out" });
      }
      tl.to(el, { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=1.5");
    },
    []
  );

  // Cross-fade when the selected die changes.
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const body = bodyRef.current;
    if (!body) return;

    killIdle();
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
  }, [dieType, startIdle, killIdle]);

  // The celestial die rolls with a slow majestic spin instead of a tumble.
  const rollCelestial = useCallback(
    (num: number, max: number, accent: string) => {
      const body = bodyRef.current;
      if (!body) return;
      body.style.filter = "blur(1px)"; // stars blur during the spin
      gsap.to(body, {
        rotateZ: "+=720",
        duration: 1.4,
        ease: "power2.inOut",
        onComplete: () => {
          body.style.filter = "";
          gsap.set(body, { rotateZ: 0 });
          const finish = () => {
            startIdle();
            setRolling(false);
          };
          const stars = starsRef.current
            ? Array.from(starsRef.current.children)
            : [];
          if (num >= max) {
            // Cosmic event: all stars flash to max, constellations flare, and a
            // ring of light expands outward from the die.
            twinkles.current.forEach((t) => t.kill());
            twinkles.current = [];
            gsap.to(stars, { opacity: 1, duration: 0.2, ease: "power2.out" });
            if (linesRef.current)
              gsap.to(linesRef.current, { opacity: 0.8, duration: 0.2 });
            if (flareRef.current)
              gsap.fromTo(
                flareRef.current,
                { opacity: 0.4, scale: 0.5 },
                { opacity: 0, scale: 2.0, duration: 1.0, ease: "power2.out" }
              );
            gsap.delayedCall(1.0, () => {
              startTwinkle();
              finish();
            });
          } else if (num <= 1) {
            // The cosmos goes dark: stars dim, constellations disappear.
            twinkles.current.forEach((t) => t.kill());
            twinkles.current = [];
            gsap.to(stars, { opacity: 0.1, duration: 0.4, ease: "power2.out" });
            if (linesRef.current)
              gsap.to(linesRef.current, { opacity: 0, duration: 0.4 });
            gsap.delayedCall(1.2, () => {
              startTwinkle();
              finish();
            });
          } else {
            finish();
          }
        },
      });
      gsap.delayedCall(0.7, () => {
        onRollRef.current(num);
        revealNumber(num, num >= max, num <= 1, accent, "#e8e4dc");
      });
    },
    [startIdle, startTwinkle, revealNumber]
  );

  const roll = useCallback(() => {
    if (rolling || !bodyRef.current) return;
    setRolling(true);

    const body = bodyRef.current;
    const glow = glowRef.current;
    const num = numberRef.current;
    const max = maxFor(dieType);
    const value = Math.floor(Math.random() * max) + 1;
    const cfg = animFor(dieType);
    const accent = "#c0392b";
    const isMax = value >= max;
    const isMin = value <= 1;

    killIdle();
    if (num) {
      gsap.killTweensOf(num);
      gsap.set(num, { opacity: 0 });
    }

    if (dieType === "dinf") {
      rollCelestial(value, max, "#94b8ff");
      return;
    }

    const { tumble } = cfg;
    // Phase 1 — a weighted launch: one full spin + a gentle squish (and a reset
    // of the resting Y so the celebration/failure starts from a known baseline).
    gsap.to(body, {
      rotateX: 360,
      rotateY: 360,
      rotateZ: gsap.utils.random(-tumble.rotateZ, tumble.rotateZ),
      scale: tumble.scale,
      y: 0,
      duration: tumble.p1Dur,
      ease: tumble.p1Ease,
      onComplete: () => {
        // The full spins (360 ≡ 0) are reset instantly so the settle doesn't
        // unwind them — there's no jump, and phase 2 just eases the squish and
        // twist out with a gentle overshoot.
        gsap.set(body, { rotateX: 0, rotateY: 0 });
        gsap.to(body, {
          scale: 1,
          rotateZ: 0,
          duration: tumble.p2Dur,
          ease: tumble.p2Ease,
          onComplete: () => {
            const finish = () => {
              startIdle();
              setRolling(false);
            };
            // Per-die celebration / failure, played once the tumble has settled.
            if (isMax) {
              // Radial glow (d12 doubled, d20 confident); d10 tints its number.
              if ((dieType === "d12" || dieType === "d20") && glow) {
                gsap.fromTo(
                  glow,
                  { opacity: cfg.glowOpacity, scale: 0.8 },
                  { opacity: 0, scale: cfg.glowScale, duration: 0.8, ease: "power2.out" }
                );
              }
              if (dieType === "d10" && num) {
                num.style.fill = "#27ae60"; // clinical green acknowledgment
                gsap.delayedCall(0.5, () => {
                  if (numberRef.current) numberRef.current.style.fill = accent;
                });
              }
              if (cfg.celebrate.length) playSequence(body, cfg.celebrate, finish);
              else finish();
            } else if (isMin) {
              if (dieType === "d10" && num) {
                // Glitching calculator: the number stutters opacity five times.
                gsap.to(num, {
                  keyframes: { opacity: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1] },
                  duration: 0.4,
                  ease: "none",
                });
              }
              if (dieType === "d20" && num) {
                // The classic shake: the result number jitters in X, 3 cycles.
                gsap.fromTo(
                  num,
                  { x: 0 },
                  { keyframes: { x: [0, -4, 4, -4, 4, -4, 4, 0] }, duration: 0.4, ease: "none" }
                );
              }
              if (cfg.fail.length) playSequence(body, cfg.fail, finish);
              else finish();
            } else {
              finish();
            }
          },
        });
      },
    });

    gsap.delayedCall(0.4, () => {
      onRollRef.current(value);
      revealNumber(value, isMax, isMin, accent, "#1a1a18");
    });
  }, [rolling, dieType, startIdle, killIdle, revealNumber, rollCelestial]);

  // Hover enter: set state, fire the d4 twitch, pulse the celestial constellations.
  const onEnter = useCallback(() => {
    setHovered(true);
    const hv = animFor(dieRef.current).hover;
    if (hv.twitch && twitchRef.current) {
      gsap.fromTo(
        twitchRef.current,
        { rotation: -3 },
        {
          rotation: 3,
          duration: 0.05,
          repeat: 3,
          yoyo: true,
          ease: "sine.inOut",
          onComplete: () => {
            if (twitchRef.current)
              gsap.to(twitchRef.current, { rotation: 0, duration: 0.05 });
          },
        }
      );
    }
    if (dieRef.current === "dinf" && linesRef.current) {
      gsap.fromTo(
        linesRef.current,
        { opacity: 0.4 },
        {
          opacity: 0.8,
          duration: 0.35,
          yoyo: true,
          repeat: 1,
          ease: "sine.inOut",
        }
      );
    }
  }, []);

  const shape = SHAPES[shapeType];
  const cfg = animFor(shapeType);
  const color = cfg.color;
  const hv = cfg.hover;
  const isCelestial = shapeType === "dinf";
  const hoverColor = hv.shadowColor ?? color;
  const baseFilter = isCelestial
    ? "drop-shadow(0 0 10px rgba(150,180,255,0.35))"
    : `drop-shadow(0 0 0px ${color}00)`;
  const hoverFilter = isCelestial
    ? "drop-shadow(0 0 22px rgba(150,180,255,0.6))"
    : `drop-shadow(0 0 20px ${hoverColor}${hv.glowAlpha})`;
  const transMs = hovered ? hv.ms : 400;

  return (
    <div
      onClick={roll}
      onPointerEnter={onEnter}
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
      {/* Floating contact shadow — an ellipse 45% of the die's width, sitting
          ~15px below it, that the idle-float timeline widens/fades as the die
          rises and tightens/darkens as it falls. */}
      <div
        className="absolute left-1/2 pointer-events-none"
        style={{
          bottom: "-15px",
          width: "45%",
          height: "12px",
          zIndex: 0,
          transform: hovered
            ? "translateX(-50%) scaleX(1.15)"
            : "translateX(-50%) scaleX(1)",
          opacity: hovered ? 0.8 : 1,
          transition: `transform ${transMs}ms ease-out, opacity ${transMs}ms ease-out`,
        }}
      >
        <div
          ref={shadowRef}
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
            opacity: 0.12,
            transformOrigin: "center",
          }}
        />
      </div>

      {/* Signature-coloured glow behind the die (polyhedron nat-max pulse). */}
      <div
        ref={glowRef}
        className="absolute -inset-8 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}66, transparent 70%)`,
          opacity: 0,
          zIndex: 0,
        }}
      />

      {/* Lens flare (celestial nat-100 only). */}
      <div
        ref={flareRef}
        className="absolute -inset-10 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(200,220,255,0.9), rgba(148,184,255,0.2) 40%, transparent 70%)",
          opacity: 0,
          zIndex: 15,
        }}
      />

      {/* Per-die hover scale + signature drop-shadow. */}
      <div
        className="relative h-full w-full"
        style={{
          zIndex: 10,
          transform: hovered ? `scale(${hv.scale})` : "scale(1)",
          filter: hovered ? hoverFilter : baseFilter,
          transition: `transform ${transMs}ms ${hv.ease}, filter ${transMs}ms ${hv.ease}`,
        }}
      >
        {/* Twitch wrapper — only the d4 rotates this; it's identity otherwise. */}
        <div ref={twitchRef} className="h-full w-full">
          <svg
            ref={bodyRef}
            className="w-full h-full"
            viewBox="0 0 160 160"
            style={{ transformStyle: "preserve-3d" }}
          >
            {isCelestial ? (
              <>
                {/* A dark window into space, so the stars read against the
                    cream page — the celestial die is space on a light surface. */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="#0a0a14"
                  fillOpacity={0.9}
                />
                <g ref={linesRef} style={{ opacity: 0.2 }}>
                  {CELESTIAL_LINES.map(([x1, y1, x2, y2], i) => (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#94b8ff"
                      strokeWidth={0.5}
                    />
                  ))}
                </g>
                <g ref={starsRef}>
                  {CELESTIAL_STARS.map((s, i) => (
                    <circle
                      key={i}
                      cx={s.x}
                      cy={s.y}
                      r={s.r}
                      fill="#ffffff"
                      style={{ opacity: s.o }}
                    />
                  ))}
                </g>
              </>
            ) : (
              <>
                {/* Solid, shaded facets (a same-colour hairline kills seams). */}
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
                        transition: `fill ${transMs}ms ease-out, stroke ${transMs}ms ease-out`,
                      }}
                    />
                  );
                })}
                {/* Internal facet edges — subtle, each drawn once. */}
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
                {/* Outer silhouette. */}
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
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Result number, centred over the die. */}
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
