// The Celestial d∞ — a weighted d1000 with rare "impossible" specials.
//
// THIS is the celestial die's single source of truth for a roll. One draw selects
// the result; everything the rest of the app shows — the number/glyph overlay,
// the reference line, the cosmic animation tier — is DERIVED from that one result,
// so the displayed value and its line can never desync (the cardinal rule for the
// line layer; see lib/lines).
//
// Free-play ONLY: the d∞ is excluded from the Daily rotation (see lib/daily's
// DAILY_DICE), so nothing here touches the deterministic daily sequence or its
// server validator.

import { maxFor } from "@/lib/dice";

// The ceiling of the base range, kept in lock-step with the die's declared max in
// lib/dice (DICE.dinf) so the two never drift.
export const CELESTIAL_MAX = maxFor("dinf"); // 1000

// Loaded in-range values the die is "drawn to" — they surface noticeably more
// often than a flat 1/1000, as a treat. Their reference lines live in lib/lines'
// CELESTIAL_LINES, keyed by the same value.
const LOADED = [7, 42, 88, 300, 404, 420, 666, 777, 1000];

// Rare integer specials that transcend the range but still read as a number.
const INTEGER_SPECIALS = [9001, 1337];

// Rare symbolic specials — FLAVOR ONLY. They have no numeric magnitude, so they
// show as their glyph and are deliberately scored as a maximal celestial roll
// (for the glow + fanfare) while carrying their glyph as both display and line
// key. They must be excluded from any numeric stat aggregate — there is none in
// free-play today, but this is the contract if one is ever added.
export const CELESTIAL_SYMBOLS = ["∞", "π", "e", "φ"] as const;
export type CelestialSymbol = (typeof CELESTIAL_SYMBOLS)[number];

// What DInf hands back to the page on a landed roll, alongside the numeric value:
// the presentation glyph and the exact reference-line key. For ordinary numbers
// display === lineKey === the number; for the symbolic specials both are the glyph.
export interface CelestialMeta {
  display: string; // overlay text: the number, or the symbol glyph
  lineKey: string; // exact key into lib/lines' CELESTIAL_LINES
}

export interface CelestialResult extends CelestialMeta {
  value: number; // numeric magnitude (symbolic specials are scored as the max)
  cosmic: "min" | "max" | "normal"; // DInf's animation tier
}

function numberResult(n: number): CelestialResult {
  return {
    value: n,
    display: String(n),
    lineKey: String(n),
    cosmic: n <= 1 ? "min" : n >= CELESTIAL_MAX ? "max" : "normal",
  };
}

// Tuning: specials are a delightful surprise, the loaded values a treat, the rest
// a flat 1..1000. Cumulative bands over a single [0,1) draw:
//   symbolic specials  0.3%   — the rarest, most impossible flourish
//   integer specials   0.9%   — 9001 / 1337, rare but reachable
//   loaded values     10%     — ~1.1% each, ~11x a flat 1/1000
//   uniform 1..1000   ~87.8%  — the honest base range
const P_SYMBOLIC = 0.003;
const P_INTEGER = 0.012; // cumulative: symbolic + integer
const P_LOADED = 0.112; // cumulative: + loaded

// Roll the Celestial. `rand` is the single randomness source (Math.random in the
// app); it may be drawn more than once to pick a band, then a value within it,
// but the RESULT is ONE value that drives display, line, and animation alike — no
// separate random ever competes with it for the displayed number or its line.
export function rollCelestial(rand: () => number): CelestialResult {
  const r = rand();
  if (r < P_SYMBOLIC) {
    const sym = CELESTIAL_SYMBOLS[Math.floor(rand() * CELESTIAL_SYMBOLS.length)];
    return { value: CELESTIAL_MAX, display: sym, lineKey: sym, cosmic: "max" };
  }
  if (r < P_INTEGER) {
    return numberResult(INTEGER_SPECIALS[Math.floor(rand() * INTEGER_SPECIALS.length)]);
  }
  if (r < P_LOADED) {
    return numberResult(LOADED[Math.floor(rand() * LOADED.length)]);
  }
  return numberResult(Math.floor(rand() * CELESTIAL_MAX) + 1);
}
