// Daily Crit — the deterministic, client-only engine behind the once-a-day,
// press-your-luck mode. EVERYTHING here is a pure function of the date (UTC) plus
// the die's real range read from lib/dice — no network, no randomness at play
// time. The same date always yields the same die and the same roll sequence, so a
// run is reproducible and un-replayable (the store enforces one run per day).

import { DICE, maxFor, type DieType } from "@/lib/dice";

// One run is at most this many rolls. After the cap, banking is the only move.
export const CAP = 8;

// ─── Seeding ─────────────────────────────────────────────────────────────────

// FNV-1a, 32-bit. A small, dependency-free string hash; deterministic across
// engines (all math is on 32-bit unsigned ints via Math.imul / >>> 0).
export function hashString(key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The UTC calendar day as "YYYY-MM-DD". The day boundary is UTC midnight so every
// player rolls over to the next daily at the same instant worldwide.
export function ymdUTC(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The previous UTC day for a "YYYY-MM-DD" string — used to test streak adjacency.
export function prevYmdUTC(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return ymdUTC(new Date(Date.UTC(y, m - 1, d) - 86_400_000));
}

// The 32-bit seed for a date: a hash of its UTC "YYYY-MM-DD".
export function getDailySeed(date: Date = new Date()): number {
  return hashString(ymdUTC(date));
}

// mulberry32 — a tiny, well-distributed 32-bit PRNG. Returns a function that
// yields the next float in [0, 1) and advances its internal state each call.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Today's die + roll sequence ─────────────────────────────────────────────

// The playable dice for the daily, low → high. The celestial d∞ is excluded (it
// is a d100 with bespoke cosmos animations, not a press-your-luck fit).
export const DAILY_DICE: DieType[] = DICE.filter((d) => d.type !== "dinf").map(
  (d) => d.type
);

// Today's die, chosen deterministically from the date seed.
export function getDailyDie(date: Date = new Date()): DieType {
  const rng = mulberry32(getDailySeed(date));
  return DAILY_DICE[Math.floor(rng() * DAILY_DICE.length)];
}

// The full deterministic roll sequence for a date+die: CAP face values in the
// die's ACTUAL range (1..faces, read from lib/dice — never hardcoded). The seed
// mixes the die in so the stream is independent of the die-pick draw. Pre-built
// as an array so a "draw" is pure indexing by roll count — the i-th roll of the
// day is always the same value no matter how the player banks or busts.
export function getDailySequence(
  date: Date = new Date(),
  die: DieType = getDailyDie(date)
): number[] {
  const faces = maxFor(die);
  const rng = mulberry32(hashString(`${ymdUTC(date)}:${die}`));
  const seq: number[] = [];
  for (let i = 0; i < CAP; i++) seq.push(Math.floor(rng() * faces) + 1);
  return seq;
}

// ─── Game reducer ────────────────────────────────────────────────────────────

export type Status = "idle" | "banked" | "busted";

export interface GameState {
  total: number;
  rollCount: number; // successful rolls committed to the total
  rolls: number[]; // every drawn value, in order (includes a busting 1)
  status: Status;
}

export const initialGameState: GameState = {
  total: 0,
  rollCount: 0,
  rolls: [],
  status: "idle",
};

// The value for ROLL is supplied by the caller (drawn from getDailySequence at
// index = rollCount), keeping the reducer pure and deterministic.
export type GameAction = { type: "ROLL"; value: number } | { type: "BANK" };

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.status !== "idle") return state; // finished runs are immutable

  switch (action.type) {
    case "ROLL": {
      if (state.rollCount >= CAP) return state; // no rolls past the cap
      const { value } = action;
      const rolls = [...state.rolls, value];
      // A 1 busts the run: record the roll for display, total is wiped to a
      // score of 0 (see `score`), the run ends.
      if (value === 1) return { ...state, rolls, status: "busted" };
      return {
        total: state.total + value,
        rollCount: state.rollCount + 1,
        rolls,
        status: "idle",
      };
    }
    case "BANK":
      return { ...state, status: "banked" };
    default:
      return state;
  }
}

// A busted run scores 0; a banked (or in-progress) run scores its running total.
export function score(state: GameState): number {
  return state.status === "busted" ? 0 : state.total;
}

// ─── Odds + expected value (the "show the math" readout) ─────────────────────

// P(bust) on any single roll is exactly 1/faces (rolling the lone 1).
export function pBust(faces: number): number {
  return 1 / faces;
}

// The sum 2..faces — the total expected gain across a survival, and the
// break-even total above which pushing turns -EV.
export function breakEvenTotal(faces: number): number {
  return (faces * (faces + 1)) / 2 - 1;
}

// Average value gained when a roll does NOT bust (the mean of 2..faces).
export function avgSurvivor(faces: number): number {
  return (faces + 2) / 2;
}

// Expected change in score from rolling once more at the given total:
//   EV = P(survive)·E[value|survive] − P(bust)·total = (S2 − total)/faces.
// Positive while total < breakEvenTotal(faces); the decision-point note keys off
// its sign ("push" vs "bank").
export function evOfRoll(faces: number, total: number): number {
  return (breakEvenTotal(faces) - total) / faces;
}
