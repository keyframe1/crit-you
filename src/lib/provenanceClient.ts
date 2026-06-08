// Daily Crit provenance — the CLIENT half. A stable anonymous id (so the server
// can keep one submission per player per day) plus a best-effort POST of a
// finished run that returns the share-grid verification code. Everything here is
// non-load-bearing: any failure (no storage, offline, server error) just means
// the share grid ships without a code — the run still plays and shares fine.

import type { ProvenanceStatus } from "@/lib/provenance";

// Our own anonymous id, independent of PostHog's analytics distinct_id. Kept in
// localStorage so the same browser maps to the same daily submissions.
const ANON_KEY = "crit:anon:v1";

function mintAnonId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    // fall through to the Math.random fallback
  }
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  );
}

// The persistent anonymous id, created on first use. Returns "" during SSR (the
// caller is client-only, but this stays safe). In private mode where storage
// throws, returns a fresh ephemeral id so the submit still works this session.
export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id = mintAnonId();
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return mintAnonId();
  }
}

export interface SubmitArgs {
  date: string; // UTC "YYYY-MM-DD"
  status: ProvenanceStatus;
  score: number;
  rollCount: number;
  signal?: AbortSignal;
}

// POST a finished run; resolve to its verification code, or null on any failure.
// The server is idempotent per (anonId, date), so re-opening a completed daily
// returns the same code rather than a new one.
export async function submitDailyResult(args: SubmitArgs): Promise<string | null> {
  const anonId = getAnonId();
  if (!anonId) return null;
  try {
    const res = await fetch("/api/daily/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonId,
        date: args.date,
        status: args.status,
        score: args.score,
        rollCount: args.rollCount,
      }),
      signal: args.signal,
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (
      data &&
      typeof data === "object" &&
      typeof (data as { code?: unknown }).code === "string"
    ) {
      return (data as { code: string }).code;
    }
    return null;
  } catch {
    // Network error, abort, or malformed response — share without a code.
    return null;
  }
}
