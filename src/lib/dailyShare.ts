// Daily Crit share text — a spoiler-light, plain-text grid built for pasting into
// Discord, iMessage, WhatsApp, or Twitter. NO markdown (so it renders identically
// everywhere), the deep link on its own line (so it stays clickable), and NEVER
// the face values — only the bead run (count) + outcome.
//
// Build 2 will append a server-issued verification code as a 4th line; the builder
// is structured (a line array) so that's a one-line addition. We deliberately
// generate NO client-side hash now — a client hash proves nothing.

import { CAP } from "@/lib/daily";

export type DailyOutcome = "clean" | "perfect" | "bust";

export interface DailyShareResult {
  date: Date;
  faces: number; // die size, e.g. 20
  rollCount: number; // beads = draws taken (a busting draw included)
  outcome: DailyOutcome;
  score: number;
  streak: number; // current streak; 0 = none (suffix omitted)
}

// Tunable glyphs. A survived roll vs. the bust on the final roll.
const BEAD_SURVIVED = "🎲";
const BEAD_BUST = "💥";

// The deep link that drops the recipient straight into today's Daily (the page
// auto-opens the Daily view when it sees ?daily=1), not free-play.
export const DAILY_DEEP_LINK = "https://crit.you/?daily=1";

function monthDay(date: Date): string {
  // UTC to match the daily's UTC calendar day. e.g. "Jun 4".
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// One glyph per roll taken. A bust replaces the final glyph with 💥.
function beadRun(rollCount: number, outcome: DailyOutcome): string {
  const n = Math.max(1, rollCount);
  if (outcome === "bust") {
    return BEAD_SURVIVED.repeat(Math.max(0, n - 1)) + BEAD_BUST;
  }
  return BEAD_SURVIVED.repeat(n);
}

function outcomeText(outcome: DailyOutcome, score: number): string {
  switch (outcome) {
    case "perfect":
      return `PERFECT · ${score}`;
    case "bust":
      return `busted · kept ${score}`;
    default:
      return `banked ${score}`;
  }
}

// Classify a finished run. "perfect" = survived every roll up to the cap and
// banked; "bust" = hit the 1; otherwise a "clean" early bank.
export function outcomeFor(busted: boolean, rollCount: number): DailyOutcome {
  if (busted) return "bust";
  return rollCount >= CAP ? "perfect" : "clean";
}

export function buildDailyShareText(r: DailyShareResult): string {
  const line1 = `Crit · ${monthDay(r.date)} · d${r.faces}`;
  const streakSuffix = r.streak > 0 ? ` · 🔥${r.streak}` : "";
  const line2 = `${beadRun(r.rollCount, r.outcome)} ${outcomeText(
    r.outcome,
    r.score
  )}${streakSuffix}`;

  // Build 2 will push a verification-code line here.
  const lines = [line1, line2, DAILY_DEEP_LINK];
  return lines.join("\n");
}
