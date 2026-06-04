"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Personality from "@/components/Personality";
import DiceSelector from "@/components/DiceSelector";
import ShareCard from "@/components/ShareCard";
import { DEFAULT_DIE, maxFor, type DieType, type Roll } from "@/lib/dice";
import { pickLine } from "@/lib/lines";

// The Three.js stage is client-only (WebGL needs the browser) and heavy, so it's
// code-split out of the initial bundle. `ssr: false` is allowed here because
// page.tsx is itself a Client Component.
const DiceCanvas = dynamic(() => import("@/components/DiceCanvas"), {
  ssr: false,
});

export default function Home() {
  const [dieType, setDieType] = useState<DieType>(DEFAULT_DIE);
  const [roll, setRoll] = useState<Roll | null>(null);
  const rollId = useRef(0);

  // The die reports its rolled value; we own the line choice so the displayed
  // personality text and the share card always agree. The result number itself
  // now renders inside the die.
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
    },
    [dieType]
  );

  // Switching dice clears the stale result so the line doesn't outlive the die
  // it belonged to.
  const handleSelect = useCallback((type: DieType) => {
    setDieType(type);
    setRoll(null);
  }, []);

  return (
    <main className="flex flex-col h-[100dvh] overflow-hidden select-none">
      <header className="flex items-center justify-between px-5 py-4 shrink-0">
        <span className="font-sans font-bold text-[14px] tracking-[0.2em] uppercase text-[var(--ink)]">
          Crit
        </span>
        <ShareCard roll={roll} />
      </header>

      {/* Die area. `relative` so the speech bubble can float ABSOLUTELY above the
          die without being in the flex flow — a multi-line bubble must never push
          the canvas down (the old layout shift, worst on mobile). */}
      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center">
        {/* Speech bubble — absolute, centred, click-through. Its height never
            affects the die's position. */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-full flex justify-center px-4 pointer-events-none">
          <Personality roll={roll} />
        </div>
        {/* Every die is a real 3D object on the shared Three.js stage. */}
        <DiceCanvas dieType={dieType} onRoll={handleRoll} />
      </div>

      <div className="shrink-0">
        <DiceSelector value={dieType} onChange={handleSelect} />
      </div>
    </main>
  );
}
