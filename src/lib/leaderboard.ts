// Per-guild Daily Crit leaderboard — SERVER-ONLY (Upstash + the provenance
// secret). The Discord bot is the only caller. The headline metric is a STREAK,
// not a top score: the daily is deterministic (everyone shares one die + one roll
// sequence), so the best possible score is fixed and gameable — but a long run of
// consecutive, server-validated non-bust days is a real, earned flex.
//
// Trust model. `/crit submit <code>` gives us only the opaque share-grid code. We
// resolve it through the reverse index (lib/provenance#codeKey), then independently
// re-run Bot Prompt 1's checks on the recovered tuple — HMAC match (verifyCodeFor +
// codeMatches), score achievable for the date (validateDailyScore), and a matching
// submission actually on file — before it counts. A forged or unrecorded code never
// touches the board.
//
// Streaks are COMPUTED from history, never incremented. We store one entry per day
// the player submitted; current/best streak are derived by walking those days. So
// re-submitting can't inflate a streak, a missed day breaks it, and a bust day
// breaks it (a bust is not a "non-bust submission").

import { prevYmdUTC, ymdUTC } from "@/lib/daily";
import {
  codeKey,
  codeMatches,
  isProvenanceStatus,
  submissionKey,
  validateDailyScore,
  verifyCodeFor,
  type ProvenanceStatus,
  type StoredSubmission,
} from "@/lib/provenance";
import { getRedis } from "@/lib/redis";

// ─── Redis keys ──────────────────────────────────────────────────────────────

// Roster of players seen in a guild: HASH field=discordUserId → display name.
// Doubles as the member index for rendering the board.
function rosterKey(guildId: string): string {
  return `lb:${guildId}`;
}

// A player's per-guild submission history: HASH field=date(YYYY-MM-DD) → "status|score".
// The source of truth for that player's streak in that guild.
function historyKey(guildId: string, userId: string): string {
  return `lbhist:${guildId}:${userId}`;
}

// ─── History entry encoding ──────────────────────────────────────────────────

interface HistoryEntry {
  status: ProvenanceStatus;
  score: number;
}

// "status|score" — the pipe guarantees the value is never valid JSON, so Upstash's
// auto-deserialization leaves it a string for us to parse deterministically.
function encodeEntry(status: ProvenanceStatus, score: number): string {
  return `${status}|${score}`;
}

function decodeHistory(raw: Record<string, unknown> | null): Record<string, HistoryEntry> {
  const out: Record<string, HistoryEntry> = {};
  if (!raw) return out;
  for (const [date, value] of Object.entries(raw)) {
    const [status, scoreStr] = String(value).split("|");
    const score = Number(scoreStr);
    if (isProvenanceStatus(status) && Number.isInteger(score)) {
      out[date] = { status, score };
    }
  }
  return out;
}

// ─── Date stepping ───────────────────────────────────────────────────────────

// The UTC day after a "YYYY-MM-DD" — the forward partner to lib/daily's prevYmdUTC.
function nextYmdUTC(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return ymdUTC(new Date(Date.UTC(y, m - 1, d) + 86_400_000));
}

// ─── Streak math (pure, from a decoded history) ──────────────────────────────

function isNonBustDay(hist: Record<string, HistoryEntry>, ymd: string): boolean {
  const e = hist[ymd];
  return !!e && e.status !== "bust";
}

// Current streak relative to `today` (UTC). Alive if the player has a non-bust
// day today, OR today is simply UNPLAYED YET and yesterday was non-bust (grace so
// the streak doesn't read as broken before today's run). A bust TODAY is NOT grace
// — it breaks the streak (a 1 resets it), so that case yields 0. From the anchor
// we count consecutive non-bust days backward.
export function currentStreak(
  hist: Record<string, HistoryEntry>,
  today: string
): number {
  let anchor: string | null = null;
  if (isNonBustDay(hist, today)) {
    anchor = today;
  } else if (!hist[today]) {
    // Unplayed today — a streak running through yesterday is still standing.
    const yesterday = prevYmdUTC(today);
    if (isNonBustDay(hist, yesterday)) anchor = yesterday;
  }
  // else: today was played and busted → streak broken.
  if (!anchor) return 0;

  let streak = 0;
  let cursor: string = anchor;
  while (isNonBustDay(hist, cursor)) {
    streak++;
    cursor = prevYmdUTC(cursor);
  }
  return streak;
}

// Longest run of consecutive non-bust days anywhere in the player's history.
export function bestStreak(hist: Record<string, HistoryEntry>): number {
  const days = new Set(
    Object.keys(hist).filter((d) => hist[d].status !== "bust")
  );
  let best = 0;
  for (const day of days) {
    if (days.has(prevYmdUTC(day))) continue; // count each run once, from its start
    let len = 0;
    let cursor = day;
    while (days.has(cursor)) {
      len++;
      cursor = nextYmdUTC(cursor);
    }
    if (len > best) best = len;
  }
  return best;
}

// ─── Recording a submission (`/crit submit <code>`) ──────────────────────────

export interface RecordResult {
  ok: boolean;
  message: string;
}

function describeOutcome(status: ProvenanceStatus, score: number): string {
  switch (status) {
    case "perfect":
      return `**PERFECT** run — survived the whole sequence for **${score}**! 🏆`;
    case "bust":
      return `Busted 💥 — zero points today.`;
    default:
      return `Banked **${score}**.`;
  }
}

// Resolve a code, re-verify it from scratch, then fold the result into this
// guild's leaderboard and report the player's standing. Every failure path returns
// ok:false with a player-facing message (the route relays it verbatim).
export async function recordSubmission(args: {
  guildId: string;
  userId: string;
  displayName: string;
  code: string;
}): Promise<RecordResult> {
  const redis = getRedis();

  // 1) Resolve the opaque code → the result it was minted for.
  const stored = await redis.get<StoredSubmission>(codeKey(args.code));
  if (!stored) {
    return {
      ok: false,
      message:
        "❌ I don't recognize that code. Finish today's Crit at <https://crit.you/?daily=1>, then paste the code from your share grid.",
    };
  }

  // 2) Re-run Bot Prompt 1's verification on the recovered tuple, independently of
  // how it got into the index: HMAC must match, and the score must be achievable.
  const expected = verifyCodeFor({
    date: stored.date,
    anonId: stored.anonId,
    status: stored.status,
    score: stored.score,
  });
  const achievable = validateDailyScore({
    date: stored.date,
    status: stored.status,
    score: stored.score,
    rollCount: stored.rollCount,
  });
  if (!codeMatches(args.code, expected) || !achievable.ok) {
    return { ok: false, message: "❌ That code didn't check out." };
  }

  // 3) And confirm a matching submission is genuinely on file (mirrors the
  // verify route — proves the run was actually recorded, not just well-formed).
  const onFile = await redis.get<StoredSubmission>(
    submissionKey(stored.date, stored.anonId)
  );
  if (!onFile || onFile.status !== stored.status || onFile.score !== stored.score) {
    return { ok: false, message: "❌ That code didn't check out." };
  }

  // 4) Record into the guild — first submission per day wins (idempotent; a later
  // different code for the same day can't overwrite it), and refresh the roster name.
  const hk = historyKey(args.guildId, args.userId);
  const created = await redis.hsetnx(
    hk,
    stored.date,
    encodeEntry(stored.status, stored.score)
  );
  await redis.hset(rosterKey(args.guildId), { [args.userId]: args.displayName });

  // 5) Recompute the player's streak from their (now-updated) history.
  const hist = decodeHistory(
    await redis.hgetall<Record<string, unknown>>(hk)
  );
  const today = ymdUTC(new Date());
  const current = currentStreak(hist, today);
  const best = bestStreak(hist);

  // 6) Report what's actually ON FILE for that day (a duplicate keeps the first
  // result, so echo that, not the just-pasted code), plus the freshly computed
  // streak — accurate even if an older code was submitted.
  const effective = hist[stored.date] ?? {
    status: stored.status,
    score: stored.score,
  };
  const outcome = describeOutcome(effective.status, effective.score);
  const streakLine =
    `🔥 Current streak: **${current}** day${current === 1 ? "" : "s"}` +
    (best > current ? ` · best **${best}**` : "");
  const note = created
    ? ""
    : `\n_(already logged for ${stored.date} — keeping your first result)_`;

  return { ok: true, message: `✅ ${outcome}\n${streakLine}${note}` };
}

// ─── Rendering the board (`/crit leaderboard`) ───────────────────────────────

const MEDALS = ["🥇", "🥈", "🥉"];
const MAX_ROWS = 20;

// Escape the markdown characters Discord acts on so a crafted name can't break
// formatting (mentions are already neutralized via allowed_mentions on the reply).
function cleanName(name: unknown): string {
  return (
    String(name)
      .replace(/[\\*_~`|]/g, "\\$&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40) || "Player"
  );
}

function monthDayUTC(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function renderLeaderboard(
  guildId: string,
  headerDie: string
): Promise<string> {
  const redis = getRedis();
  const roster = await redis.hgetall<Record<string, unknown>>(rosterKey(guildId));
  const userIds = roster ? Object.keys(roster) : [];

  const today = ymdUTC(new Date());
  const header = `🎲 **Crit Daily — Leaderboard** · ${headerDie} · ${monthDayUTC(today)}`;

  if (userIds.length === 0) {
    return `${header}\n\nNo Crits logged here yet. Play today's at <https://crit.you/?daily=1>, then \`/crit submit\` your code to start a streak.`;
  }

  // One round trip for every player's history.
  const pipe = redis.pipeline();
  for (const id of userIds) pipe.hgetall(historyKey(guildId, id));
  const histories = await pipe.exec<(Record<string, unknown> | null)[]>();

  const rows = userIds.map((id, i) => {
    const hist = decodeHistory(histories[i] ?? null);
    const todayEntry = hist[today];
    return {
      name: cleanName(roster?.[id]),
      current: currentStreak(hist, today),
      best: bestStreak(hist),
      // Today's banked score (0 if unplayed or busted) — the streak tiebreak.
      todayScore: todayEntry && todayEntry.status !== "bust" ? todayEntry.score : 0,
      playedToday: !!todayEntry,
      bustedToday: !!todayEntry && todayEntry.status === "bust",
    };
  });

  // Streak-first, today's score as the tiebreak; then best streak, then name.
  rows.sort(
    (a, b) =>
      b.current - a.current ||
      b.todayScore - a.todayScore ||
      b.best - a.best ||
      a.name.localeCompare(b.name)
  );

  const lines = rows.slice(0, MAX_ROWS).map((r, i) => {
    const rank = i < MEDALS.length ? MEDALS[i] : `${i + 1}.`;
    const todayCell = r.bustedToday
      ? "today 💥"
      : r.playedToday
        ? `today ${r.todayScore}`
        : "today —";
    const bestSuffix = r.best > r.current ? ` · best ${r.best}` : "";
    return `${rank} **${r.name}** — 🔥 ${r.current}${bestSuffix} · ${todayCell}`;
  });

  const overflow =
    rows.length > MAX_ROWS ? `\n_…and ${rows.length - MAX_ROWS} more_` : "";
  return `${header}\n${lines.join("\n")}${overflow}`;
}
