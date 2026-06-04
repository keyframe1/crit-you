"use client";

import { createContext } from "react";

// An optional control channel for the shared 3D dice, used ONLY by Daily Crit to
// drive a die deterministically. The main app never provides it, so the value is
// null there and every die falls back to its own internal random roll.
//
// The provider is rendered INSIDE <Canvas> (wrapping the die), so provider and
// consumer (PolyDie) live in the same react-three-fiber reconciler — no context
// bridge is required.
export interface DailyControl {
  // Returns the value the next roll must land on (1..faces). When present,
  // PolyDie uses it instead of Math.random; absent → normal random roll.
  getRollValue?: () => number;
  // A monotonically increasing signal. Each increment plays the die's nat-max
  // celebration in place (no tumble) — used when the player BANKS.
  celebrateSignal?: number;
}

export const DailyControlContext = createContext<DailyControl | null>(null);
