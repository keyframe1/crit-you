// POST /api/daily/submit — record a finished Daily run and mint its verification
// code. The server is the trust boundary: it re-derives the day's sequence and
// rejects any score the date can't actually produce (see lib/provenance). One
// submission per (anonId, date) wins — re-submits are idempotent and return the
// same code, so a cheat can't overwrite an earlier honest result.

import {
  isProvenanceStatus,
  submissionKey,
  validateDailyScore,
  verifyCodeFor,
  type StoredSubmission,
} from "@/lib/provenance";
import { getRedis } from "@/lib/redis";

// Never cached, always run at request time (Redis + the secret are request-only).
export const dynamic = "force-dynamic";

// Bound the id we key Redis on — it's attacker-supplied, so keep it to a sane,
// filename-safe shape and length.
const ANON_RE = /^[A-Za-z0-9_-]{8,64}$/;

function badRequest(reason: string): Response {
  return Response.json({ error: reason }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("bad_json");
  }
  if (!body || typeof body !== "object") return badRequest("bad_body");

  const { anonId, date, status, score, rollCount } = body as Record<
    string,
    unknown
  >;

  if (typeof anonId !== "string" || !ANON_RE.test(anonId)) {
    return badRequest("bad_anon_id");
  }
  if (typeof date !== "string") return badRequest("bad_date");
  if (!isProvenanceStatus(status)) return badRequest("bad_status");
  if (typeof score !== "number" || !Number.isInteger(score)) {
    return badRequest("bad_score");
  }
  if (typeof rollCount !== "number" || !Number.isInteger(rollCount)) {
    return badRequest("bad_roll_count");
  }

  // The core check: is this result achievable for that date?
  const check = validateDailyScore({ date, status, score, rollCount });
  if (!check.ok) return badRequest(check.reason);

  const key = submissionKey(date, anonId);
  const record: StoredSubmission = { date, anonId, status, score, rollCount };

  let stored = record;
  try {
    const redis = getRedis();
    // SET NX: first honest write wins; a later submit can't clobber it.
    const created = await redis.set(key, record, { nx: true });
    if (!created) {
      const existing = await redis.get<StoredSubmission>(key);
      if (existing) stored = existing;
    }
    const code = verifyCodeFor({
      date: stored.date,
      anonId: stored.anonId,
      status: stored.status,
      score: stored.score,
    });
    return Response.json({
      code,
      date: stored.date,
      status: stored.status,
      score: stored.score,
      rollCount: stored.rollCount,
      idempotent: !created,
    });
  } catch {
    // Redis / config failure — don't fail the client's run; it shares without a
    // code (the client treats a non-OK response as "no code").
    return Response.json({ error: "store_unavailable" }, { status: 503 });
  }
}
