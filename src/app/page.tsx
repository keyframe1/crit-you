"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import Personality from "@/components/Personality";
import DiceSelector from "@/components/DiceSelector";
import ShareCard from "@/components/ShareCard";
import ResultNumber from "@/components/ResultNumber";
import DailyButton from "@/components/DailyButton";
import SoundToggle from "@/components/SoundToggle";
import BrandedLoader from "@/components/BrandedLoader";
import { DEFAULT_DIE, maxFor, type DieType, type Roll } from "@/lib/dice";
import { pickLine } from "@/lib/lines";
import {
  playClack,
  playRollResult,
  primeAudio,
  tierForDie,
} from "@/lib/sound";

// The Three.js stage is client-only (WebGL needs the browser) and heavy, so it's
// code-split out of the initial bundle. `ssr: false` is allowed here because
// page.tsx is itself a Client Component.
const DiceCanvas = dynamic(() => import("@/components/DiceCanvas"), {
  ssr: false,
});

export default function Home() {
  const [dieType, setDieType] = useState<DieType>(DEFAULT_DIE);
  const [roll, setRoll] = useState<Roll | null>(null);
  // The result number lives in a CSS overlay (ResultNumber), not the 3D scene.
  // Its visibility is owned here so it can fade out on its own timer — after the
  // hold, or when a new roll begins — while the bubble and share state persist.
  const [numberVisible, setNumberVisible] = useState(false);
  const rollId = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cold-open readiness: hold the branded loader until the 3D scene is created
  // and webfonts have settled, so the first paint is intentional. A short floor
  // keeps the brand from flickering when everything is instant; a hard ceiling
  // guarantees we never trap the user behind the loader if WebGL stalls. ──
  const [sceneReady, setSceneReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [minTimeUp, setMinTimeUp] = useState(false);
  const [forceReady, setForceReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    // Resolve through a promise either way (no API → already-resolved promise),
    // so the flag is only ever set from an async callback, never synchronously.
    (fonts?.ready ?? Promise.resolve())
      .then(() => setFontsReady(true))
      .catch(() => setFontsReady(true));
    const minT = setTimeout(() => setMinTimeUp(true), 650);
    const maxT = setTimeout(() => setForceReady(true), 3000);
    return () => {
      clearTimeout(minT);
      clearTimeout(maxT);
    };
  }, []);

  const appReady = forceReady || (sceneReady && fontsReady && minTimeUp);

  // The die reports its rolled value the instant it lands; we own the line choice
  // so the displayed personality text and the share card always agree. Showing
  // the number kicks off its hold timer: it stamps in immediately (ResultNumber),
  // holds ~1.1s fully visible, then fades cleanly out.
  const handleRoll = useCallback(
    (value: number) => {
      const max = maxFor(dieType);
      setRoll({
        id: ++rollId.current,
        value,
        max,
        dieType,
        line: pickLine(dieType, value),
      });
      setNumberVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setNumberVisible(false), 1300);
      // The landed value is the payoff: a settle tick, a flourish on a nat-max
      // (over the die's own celebration), a sparkle on a near-crit. Tier = the
      // selected die.
      playRollResult(tierForDie(dieType), value, max);
    },
    [dieType]
  );

  // The die signals when a fresh roll begins (the tumble); clear the previous
  // result number so it doesn't hang over the die while it rolls. The bubble is
  // intentionally left up until the new value lands. This is also the "clack" —
  // the die leaving the hand.
  const handleRollStart = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setNumberVisible(false);
    playClack(tierForDie(dieType));
  }, [dieType]);

  // Switching dice clears the stale result so the line doesn't outlive the die
  // it belonged to.
  const handleSelect = useCallback((type: DieType) => {
    setDieType(type);
    setRoll(null);
    setNumberVisible(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  return (
    <>
      <AnimatePresence>
        {!appReady && <BrandedLoader key="cold-open-loader" />}
      </AnimatePresence>
      <main className="flex flex-col h-[100dvh] overflow-hidden select-none">
      <header className="flex items-center justify-between px-5 py-4 shrink-0">
        {/* Wordmark doubles as a reset: click returns to the d20 and clears the
            current roll. The little die spins on hover. */}
        <button
          onClick={() => handleSelect(DEFAULT_DIE)}
          className="group flex items-center gap-2 -m-2 p-2 outline-none"
          aria-label="Reset to d20"
        >
          <svg
            viewBox="0 0 160 160"
            width="16"
            height="16"
            aria-hidden
            className="shrink-0 transition-transform duration-[600ms] ease-out group-hover:rotate-[360deg]"
          >
            <polygon points="80,8 152,44 152,116 80,152 8,116 8,44" fill="var(--accent)" />
            <g stroke="#ffffff" strokeOpacity="0.3" strokeWidth="3.5" fill="none" strokeLinejoin="round">
              <line x1="80" y1="8" x2="80" y2="152" />
              <line x1="8" y1="44" x2="152" y2="116" />
              <line x1="152" y1="44" x2="8" y2="116" />
              <line x1="8" y1="44" x2="152" y2="44" />
              <line x1="8" y1="116" x2="152" y2="116" />
            </g>
          </svg>
          <span className="font-sans font-bold text-[14px] tracking-[0.2em] uppercase text-[var(--ink)] transition-colors duration-200 group-hover:text-[var(--accent)]">
            Crit
          </span>
        </button>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <DailyButton />
          <ShareCard roll={roll} />
        </div>
      </header>

      {/* Die area. `relative` so the speech bubble can float ABSOLUTELY above the
          die without being in the flex flow — a multi-line bubble must never push
          the canvas down (the old layout shift, worst on mobile). */}
      <div
        className="relative flex-1 min-h-0 flex flex-col items-center justify-center"
        // Unlock the AudioContext on the literal tap that starts a roll, so the
        // first clack is allowed under the browser's autoplay policy.
        onPointerDown={() => primeAudio()}
      >

        {/* Speech bubble — absolute, centred, click-through. Its height never
            affects the die's position. */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-full flex justify-center px-4 pointer-events-none">
          <Personality roll={roll} />
        </div>
        {/* Every die is a real 3D object on the shared Three.js stage. */}
        <DiceCanvas
          dieType={dieType}
          onRoll={handleRoll}
          onRollStart={handleRollStart}
          onReady={handleSceneReady}
        />
        {/* The result number is a plain CSS overlay centred over the canvas — a
            sibling of the 3D scene, never rendered inside it. It's a div centred
            on a div, so it can't drift off-side, z-fight, or land on an edge. */}
        <ResultNumber roll={roll} visible={numberVisible} />
      </div>

      {/* Selector tray — a subtle top border + tint separate it from the die
          stage. A minimal wordmark footer sits beneath. */}
      <div className="shrink-0 border-t border-black/[0.06] bg-black/[0.02]">
        <DiceSelector value={dieType} onChange={handleSelect} />
        <footer className="text-center pb-3 -mt-2">
          <span className="font-mono text-[10px] tracking-[0.15em] text-[var(--ink)] opacity-30">
            crit.you
          </span>
        </footer>
      </div>
      </main>
    </>
  );
}
