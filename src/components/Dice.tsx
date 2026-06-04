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

  // The idle float, tuned per die: a slow Y bob (±y/2 around rest), slight
  // rotateX, a rotateZ sway, and a rotateY tilt. It eases up from wherever the
  // die currently is (no snap), then loops. The contact shadow runs on the same
  // clock, inverted, so it widens/fades as the die rises.
  const startIdle = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const { y, rotateX, rotateZ, rotateY, duration } = animFor(
      dieRef.current
    ).float;
    gsap.to(body, {
      y: -y / 2,
      rotateX: 0,
      rotateZ: 0,
      rotateY: 0,
      duration: 0.6,
      ease: "sine.out",
      onComplete: () => {
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
      },
    });
  }, []);

  useEffect(() => {
    startIdle();
    const body = bodyRef.current;
    const shadow = shadowRef.current;
    return () => {
      if (body) gsap.killTweensOf(body);
      if (shadow) gsap.killTweensOf(shadow);
    };
  }, [startIdle]);

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
    (value: number, isMax: boolean, isMin: boolean, accent: string) => {
      const el = numberRef.current;
      if (!el) return;
      el.textContent = String(value);
      el.style.fill = isMax ? accent : isMin ? "#555555" : "#e8e4dc";
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

  // The celestial die rolls with a slow majestic spin instead of a tumble.
  const rollCelestial = useCallback(
    (num: number, max: number, accent: string) => {
      const body = bodyRef.current;
      if (!body) return;
      body.style.filter = "blur(1px)"; // stars blur during the spin
      gsap.to(body, {
        rotateZ: "+=720",
        duration: 1.2,
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
            // All stars flash, constellations flare, a lens-flare pulses out.
            twinkles.current.forEach((t) => t.kill());
            twinkles.current = [];
            gsap.to(stars, { opacity: 1, duration: 0.2, ease: "power2.out" });
            if (linesRef.current)
              gsap.to(linesRef.current, { opacity: 0.8, duration: 0.2 });
            if (flareRef.current)
              gsap.fromTo(
                flareRef.current,
                { opacity: 0.7, scale: 0.5 },
                { opacity: 0, scale: 1.7, duration: 0.6, ease: "power2.out" }
              );
            gsap.delayedCall(0.5, () => {
              startTwinkle();
              finish();
            });
          } else if (num <= 1) {
            // The universe gives up: stars dim, constellations go dark.
            twinkles.current.forEach((t) => t.kill());
            twinkles.current = [];
            gsap.to(stars, { opacity: 0.15, duration: 0.4, ease: "power2.out" });
            if (linesRef.current)
              gsap.to(linesRef.current, { opacity: 0.04, duration: 0.4 });
            gsap.delayedCall(1, () => {
              startTwinkle();
              finish();
            });
          } else {
            finish();
          }
        },
      });
      gsap.delayedCall(0.6, () => {
        onRollRef.current(num);
        revealNumber(num, num >= max, num <= 1, accent);
      });
    },
    [startIdle, startTwinkle, revealNumber]
  );

  const roll = useCallback(() => {
    if (rolling || !bodyRef.current) return;
    setRolling(true);

    const body = bodyRef.current;
    const glow = glowRef.current;
    const max = maxFor(dieType);
    const num = Math.floor(Math.random() * max) + 1;
    const cfg = animFor(dieType);
    const accent = dieType === "dinf" ? "#94b8ff" : "#c0392b";

    gsap.killTweensOf(body);
    if (shadowRef.current) gsap.killTweensOf(shadowRef.current);
    if (numberRef.current) {
      gsap.killTweensOf(numberRef.current);
      gsap.set(numberRef.current, { opacity: 0 });
    }

    if (dieType === "dinf") {
      rollCelestial(num, max, accent);
      return;
    }

    const { tumble } = cfg;
    // Phase 1 — a weighted launch: one full spin + a gentle squish.
    gsap.to(body, {
      rotateX: 360,
      rotateY: 360,
      rotateZ: gsap.utils.random(-tumble.rotateZ, tumble.rotateZ),
      scale: tumble.scale,
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

    gsap.delayedCall(0.4, () => {
      onRollRef.current(num);
      revealNumber(num, num >= max, num <= 1, accent);
    });

    if (num === max && glow) {
      gsap.fromTo(
        glow,
        { opacity: cfg.glowOpacity, scale: 0.8 },
        { opacity: 0, scale: 1.3, duration: 0.8, ease: "power2.out" }
      );
    }
  }, [rolling, dieType, startIdle, revealNumber, rollCelestial]);

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
      {/* Floating contact shadow, ~20px below the die. */}
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
          transition: `transform ${transMs}ms ease-out, opacity ${transMs}ms ease-out`,
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
                {/* Transparent celestial sphere with constellations inside. */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="#080818"
                  fillOpacity={0.7}
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
