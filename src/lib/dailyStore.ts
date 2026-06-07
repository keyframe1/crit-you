// Persistence for Daily Crit — a single schema-versioned localStorage record
// (`crit:daily:v1`) holding the streak, lifetime counters, and a capped run
// history. Client-only: every accessor guards `typeof window` so it's a no-op /
// safe default during SSR and prerender. No network, ever.

import { prevYmdUTC, ymdUTC } from "@/lib/daily";
import type { DieType } from "@/lib/dice";

const KEY = "crit:daily:v1";
const HISTORY_CAP = 60; // keep the last ~2 months of runs

// Separate one-shot flag for the first-open Pip rules walkthrough. Its own key so
// it's independent of the run record (clearing a stuck run never re-triggers it).
const ONBOARD_KEY = "crit:onboarded:daily:v1";

// Has the player already seen the Daily walkthrough? SSR / unavailable storage
// returns true so the coachmark never flashes during prerender or in private mode
// where we couldn't record that it was dismissed.
export function hasOnboardedDaily(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(ONBOARD_KEY) === "1";
  } catch {
    return true;
  }
}

// Mark the walkthrough seen (set once it's completed or skipped).
export function setOnboardedDaily(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARD_KEY, "1");
  } catch {
    // Private mode / storage full: the walkthrough just may show again next time.
  }
}

export interface DailyHistoryEntry {
  date: string; // UTC "YYYY-MM-DD"
  dieType: DieType;
  score: number;
  rollCount: number; // total dice drawn this run (a busting 1 included)
  busted: boolean;
}

export interface DailyStore {
  version: 1;
  lastPlayedDate: string | null;
  currentStreak: number;
  bestStreak: number;
  totalPlayed: number;
  history: DailyHistoryEntry[];
}

export const EMPTY_STORE: DailyStore = {
  version: 1,
  lastPlayedDate: null,
  currentStreak: 0,
  bestStreak: 0,
  totalPlayed: 0,
  history: [],
};

// Read + validate the record. Any malformed / wrong-version payload resets to
// empty rather than throwing, so a corrupt key can never brick the daily.
export function loadStore(): DailyStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<DailyStore>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.history)) {
      return EMPTY_STORE;
    }
    return {
      version: 1,
      lastPlayedDate: parsed.lastPlayedDate ?? null,
      currentStreak: parsed.currentStreak ?? 0,
      bestStreak: parsed.bestStreak ?? 0,
      totalPlayed: parsed.totalPlayed ?? 0,
      history: parsed.history,
    };
  } catch {
    return EMPTY_STORE;
  }
}

function saveStore(store: DailyStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage full or unavailable (private mode): the daily still plays this
    // session, it just won't persist. Nothing actionable here.
  }
}

// Has today's run already been recorded? (One run per day is the scarcity.)
export function hasPlayedToday(today: string = ymdUTC()): boolean {
  return loadStore().lastPlayedDate === today;
}

// The recorded result for a given day, if any — used to render the read-only
// "come back tomorrow" view.
export function getTodayResult(
  today: string = ymdUTC()
): DailyHistoryEntry | null {
  return loadStore().history.find((h) => h.date === today) ?? null;
}

export interface RecordInput {
  date: string;
  dieType: DieType;
  score: number;
  rollCount: number;
  busted: boolean;
}

// Commit a finished run. Idempotent per day: if today is already recorded the
// store is returned unchanged (guards a double-record from re-renders). Streak
// rules: a bust zeroes the streak; otherwise the streak extends only if the last
// played day was yesterday (UTC-adjacent), else it restarts at 1.
export function recordResult(input: RecordInput): DailyStore {
  const store = loadStore();
  if (store.lastPlayedDate === input.date) return store;

  const currentStreak = input.busted
    ? 0
    : store.lastPlayedDate === prevYmdUTC(input.date)
    ? store.currentStreak + 1
    : 1;

  const entry: DailyHistoryEntry = {
    date: input.date,
    dieType: input.dieType,
    score: input.score,
    rollCount: input.rollCount,
    busted: input.busted,
  };

  const next: DailyStore = {
    version: 1,
    lastPlayedDate: input.date,
    currentStreak,
    bestStreak: Math.max(store.bestStreak, currentStreak),
    totalPlayed: store.totalPlayed + 1,
    history: [...store.history, entry].slice(-HISTORY_CAP),
  };
  saveStore(next);
  return next;
}

export interface StreakInfo {
  currentStreak: number;
  bestStreak: number;
  totalPlayed: number;
  lastPlayedDate: string | null;
}

export function getStreakInfo(): StreakInfo {
  const { currentStreak, bestStreak, totalPlayed, lastPlayedDate } = loadStore();
  return { currentStreak, bestStreak, totalPlayed, lastPlayedDate };
}
