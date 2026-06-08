// Daily Crit provenance — the SERVER-side trust core shared by /api/daily/submit
// and /api/daily/verify. SERVER-ONLY: it imports node:crypto and reads the
// signing secret, so it must never be pulled into a client bundle (the routes are
// its only importers).
//
// Two jobs:
//   1. Re-derive the day's die + roll sequence with the EXACT hash from lib/daily
//      and prove a submitted (status, score, rollCount) is actually achievable for
//      that date — a real prefix-sum ending in a bank, or 0 for a genuine bust.
//      A score the day's sequence can't produce is rejected.
//   2. Mint / check the short verification code: a truncated base32 HMAC-SHA256
//      over `${date}|${anonId}|${status}|${score}`. Only the holder of
//      CRIT_SIGNING_SECRET can produce it, so the opaque code in the share grid is
//      unforgeable provenance.

import { createHmac, timingSafeEqual } from "node:crypto";
import { CAP, getDailyDie, getDailySequence } from "@/lib/daily";

// The outcome buckets the client reports — identical to lib/dailyShare's
// DailyOutcome and analytics' DailyStatus. The code is signed over this exact
// string, so submit and verify must agree on the spelling.
export type ProvenanceStatus = "clean" | "perfect" | "bust";

export function isProvenanceStatus(v: unknown): v is ProvenanceStatus {
  return v === "clean" || v === "perfect" || v === "bust";
}

// ─── Date parsing ────────────────────────────────────────────────────────────

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Parse a strict UTC "YYYY-MM-DD" into the midnight-UTC Date whose ymdUTC() (used
// internally by getDailyDie/getDailySequence) round-trips back to that string.
// Rejects malformed strings and impossible calendar dates (e.g. 2026-02-30).
export function dateFromYmd(ymd: string): Date | null {
  const m = YMD_RE.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

// ─── Score validation ────────────────────────────────────────────────────────

export type ValidationResult = { ok: true } | { ok: false; reason: string };

// Is (status, score, rollCount) a result the date's deterministic sequence can
// actually produce? The only player freedom in a daily run is WHEN to bank (or
// busting on the lone 1), so for a given date the achievable results are fully
// enumerable from the sequence.
export function validateDailyScore(args: {
  date: string;
  status: ProvenanceStatus;
  score: number;
  rollCount: number;
}): ValidationResult {
  const { date, status, score, rollCount } = args;

  const d = dateFromYmd(date);
  if (!d) return { ok: false, reason: "bad_date" };
  if (!Number.isInteger(rollCount) || rollCount < 1 || rollCount > CAP) {
    return { ok: false, reason: "bad_roll_count" };
  }
  if (!Number.isInteger(score) || score < 0) {
    return { ok: false, reason: "bad_score" };
  }

  // The same die + sequence the client played, re-derived from the date alone.
  const die = getDailyDie(d);
  const seq = getDailySequence(d, die); // length CAP, values 1..faces

  if (status === "bust") {
    // A bust = kept rolling and hit the lone 1. The busting draw is the
    // rollCount-th (1-indexed), so seq[rollCount-1] must be 1, with no earlier 1
    // (the player would have busted sooner). A bust always scores 0.
    if (score !== 0) return { ok: false, reason: "bust_score_nonzero" };
    if (seq[rollCount - 1] !== 1) return { ok: false, reason: "bust_not_at_one" };
    for (let i = 0; i < rollCount - 1; i++) {
      if (seq[i] === 1) return { ok: false, reason: "bust_premature" };
    }
    return { ok: true };
  }

  // Banked ("clean") or survived-to-cap ("perfect"): rollCount successful, non-1
  // draws, then banked. A "perfect" run is exactly a bank at the cap; a "clean"
  // bank is strictly before it (mirrors lib/dailyShare's outcomeFor).
  if (status === "perfect" && rollCount !== CAP) {
    return { ok: false, reason: "perfect_not_capped" };
  }
  if (status === "clean" && rollCount >= CAP) {
    return { ok: false, reason: "clean_at_cap" };
  }

  let sum = 0;
  for (let i = 0; i < rollCount; i++) {
    // A 1 anywhere in the banked prefix is impossible — it would have busted.
    if (seq[i] === 1) return { ok: false, reason: "bank_after_one" };
    sum += seq[i];
  }
  if (sum !== score) return { ok: false, reason: "score_mismatch" };
  return { ok: true };
}

// ─── Verification code ───────────────────────────────────────────────────────

// RFC 4648 base32 (already uppercase, digits 2–7) — yields opaque codes like
// "7F3A2K" with no ambiguous 0/1/O/I characters.
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// The visible length of the share-grid code. ~30 bits of a SHA-256 HMAC — plenty
// to make blind forgery hopeless while staying short enough to read/type.
export const CODE_LENGTH = 6;

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function getSecret(): string {
  const secret = process.env.CRIT_SIGNING_SECRET;
  if (!secret) throw new Error("CRIT_SIGNING_SECRET is not set");
  return secret;
}

// The signed, truncated code for a result. Deterministic in its inputs, so submit
// (minting) and verify (checking) agree, and a re-submit of the same run always
// yields the same code.
export function verifyCodeFor(args: {
  date: string;
  anonId: string;
  status: ProvenanceStatus;
  score: number;
}): string {
  const message = `${args.date}|${args.anonId}|${args.status}|${args.score}`;
  const digest = createHmac("sha256", getSecret()).update(message).digest();
  return base32Encode(digest).slice(0, CODE_LENGTH);
}

// Constant-time, case-insensitive compare of a supplied code against the expected
// one (both already fixed-length).
export function codeMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided.toUpperCase());
  const b = Buffer.from(expected.toUpperCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// The stored submission record (what we write to Redis, keyed sub:{date}:{anonId}).
export interface StoredSubmission {
  date: string;
  anonId: string;
  status: ProvenanceStatus;
  score: number;
  rollCount: number;
}

export function submissionKey(date: string, anonId: string): string {
  return `sub:${date}:${anonId}`;
}

// Reverse index: the share-grid code → its StoredSubmission. The verification
// code is a ONE-WAY HMAC over (date, anonId, status, score) — given only a code
// (all the Discord bot's `/crit submit <code>` ever receives), there is no way to
// recover the result without this lookup. /api/daily/submit writes it alongside
// the submission; the bot reads it, then re-runs verifyCodeFor + validateDailyScore
// over the recovered tuple as a second, independent check.
//
// Codes are ~30-bit truncated HMACs, so a collision between two DISTINCT results
// is ~1-in-a-billion; if one ever happened the later submit would overwrite the
// index entry, and the loser's code would resolve to the winner's tuple. That's
// acceptable for a dice game's social leaderboard and not worth widening the code.
export function codeKey(code: string): string {
  return `code:${code.toUpperCase()}`;
}
