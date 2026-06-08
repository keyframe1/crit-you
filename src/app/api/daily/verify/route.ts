// GET /api/daily/verify?code&date&anonId&status&score — confirm a share-grid code
// is genuine. We recompute the HMAC over the supplied tuple and require BOTH that
// it matches the supplied code (proves it was signed with our secret) AND that a
// matching submission is actually on file (proves the run was really recorded).
// Either failing reads as not-found.

import {
  codeMatches,
  isProvenanceStatus,
  submissionKey,
  verifyCodeFor,
  type StoredSubmission,
} from "@/lib/provenance";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const date = searchParams.get("date");
  const anonId = searchParams.get("anonId");
  const status = searchParams.get("status");
  const scoreStr = searchParams.get("score");

  if (!code || !date || !anonId || !status || scoreStr === null) {
    return Response.json({ verified: false, error: "missing_params" }, {
      status: 400,
    });
  }
  if (!isProvenanceStatus(status)) {
    return Response.json({ verified: false, error: "bad_status" }, {
      status: 400,
    });
  }
  const score = Number(scoreStr);
  if (!Number.isInteger(score)) {
    return Response.json({ verified: false, error: "bad_score" }, {
      status: 400,
    });
  }

  // 1) Does the code match what our secret would sign for this tuple?
  const expected = verifyCodeFor({ date, anonId, status, score });
  if (!codeMatches(code, expected)) {
    return Response.json({ verified: false }, { status: 404 });
  }

  // 2) Is there a stored submission whose recorded result matches the tuple?
  try {
    const stored = await getRedis().get<StoredSubmission>(
      submissionKey(date, anonId)
    );
    if (!stored || stored.status !== status || stored.score !== score) {
      return Response.json({ verified: false }, { status: 404 });
    }
    return Response.json({
      verified: true,
      date: stored.date,
      status: stored.status,
      score: stored.score,
      rollCount: stored.rollCount,
    });
  } catch {
    return Response.json({ verified: false, error: "store_unavailable" }, {
      status: 503,
    });
  }
}
