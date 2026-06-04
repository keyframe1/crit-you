"use client";

import { useCallback, useRef, useState } from "react";
import Dice from "@/components/Dice";
import RollResult from "@/components/RollResult";
import Personality from "@/components/Personality";
import DiceSelector from "@/components/DiceSelector";
import ShareCard from "@/components/ShareCard";
import { DEFAULT_DIE, maxFor, type DieType, type Roll } from "@/lib/dice";
import { pickLine } from "@/lib/lines";

export default function Home() {
  const [dieType, setDieType] = useState<DieType>(DEFAULT_DIE);
  const [roll, setRoll] = useState<Roll | null>(null);
  const rollId = useRef(0);

  // The die reports its rolled value; we own the line choice so the displayed
  // personality text and the share card always agree.
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

  // Switching dice clears the stale result so the number/line don't outlive
  // the die they belonged to.
  const handleSelect = useCallback((type: DieType) => {
    setDieType(type);
    setRoll(null);
  }, []);

  return (
    <main className="flex flex-col h-[100dvh] overflow-hidden select-none">
      <header className="flex items-center justify-between px-5 py-4 shrink-0">
        <span className="font-sans font-bold text-[14px] tracking-[0.2em] uppercase text-[var(--light)]">
          Crit
        </span>
        <ShareCard roll={roll} />
      </header>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
        <Dice dieType={dieType} onRoll={handleRoll} />
        <RollResult roll={roll} />
        <Personality roll={roll} />
      </div>

      <div className="shrink-0">
        <DiceSelector value={dieType} onChange={handleSelect} />
      </div>
    </main>
  );
}
