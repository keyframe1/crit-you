// Product analytics — a thin, privacy-light wrapper over PostHog.
//
// Privacy posture (matches the on-screen copy):
//   • Cookieless: `persistence: 'localStorage'` — no cookies, no banner needed.
//     PostHog mints an anonymous distinct_id and keeps it in localStorage so
//     retention / D1·D7·D30 / streak-continuation are measurable per visitor.
//     There is no pre-existing app anon id to tie to (the only keys are the
//     daily/sound records), so PostHog's own anonymous id is the identity.
//   • No PII is ever sent. We never call `identify`; no names, no emails.
//   • Do Not Track is honoured (`respect_dnt`) — DNT users send nothing.
//   • No session recording, no autocapture — only the explicit funnel events
//     below, plus pageviews.
//
// Everything here is a safe no-op when the key is absent (e.g. local builds with
// no env), during SSR/prerender, or when DNT/opt-out is in effect, so call sites
// never have to guard.

import posthog from "posthog-js";
import type { DieType } from "@/lib/dice";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let started = false; // init attempted (guards re-entry)
let initialized = false; // init succeeded → safe to capture

// Init PostHog exactly once, client-side, when a key is configured. Called from
// instrumentation-client.ts (before hydration). Wrapped so a failure here can
// never take down app boot.
export function initAnalytics(): void {
  if (started) return;
  if (typeof window === "undefined" || !KEY) return;
  started = true;
  try {
    posthog.init(KEY, {
      api_host: HOST,
      // Cookieless: keep the anonymous distinct_id in localStorage only.
      persistence: "localStorage",
      // Honour the browser's Do Not Track signal — those users send nothing.
      respect_dnt: true,
      // Capture the initial pageview (and SPA route changes); this app is a
      // single route, so this is effectively the load event that powers
      // daily-active + retention.
      capture_pageview: true,
      capture_pageleave: true,
      // Privacy-light: no rage/click autocapture, no session replay. We only
      // send the named funnel events declared below.
      autocapture: false,
      disable_session_recording: true,
      // Anonymous visitors still get a (PII-free) person profile so retention
      // cohorts and streak-continuation analyses work off the stable id.
      person_profiles: "always",
    });
    initialized = true;
  } catch {
    // Analytics must never be load-bearing. If init throws, the app runs fine
    // without it.
  }
}

// Was PostHog successfully initialised this session? (False when no key, SSR, or
// init failed.) After a successful init, posthog.capture handles its own
// queueing if the remote config hasn't loaded yet, so this is the only gate
// call sites need.
function ready(): boolean {
  return initialized;
}

type Props = Record<string, string | number | boolean | null | undefined>;

function capture(event: string, props?: Props): void {
  if (!ready()) return;
  try {
    posthog.capture(event, props);
  } catch {
    // Swallow — a dropped event is never worth a thrown render.
  }
}

// ─── The funnel + the metrics that matter ───────────────────────────────────
// One named helper per event so property shapes stay consistent across call
// sites and the event surface is greppable in one place.

export type DailyStatus = "clean" | "perfect" | "bust";

export const analytics = {
  // Free-play roll.
  roll(dieType: DieType): void {
    capture("roll", { dieType, mode: "free" });
  },

  // First roll of today's Daily run — the genuine "started playing" signal.
  dailyStarted(date: string, dieType: DieType): void {
    capture("daily_started", { date, dieType });
  },

  // A finished Daily run (banked / perfect / busted).
  dailyResult(args: {
    date: string;
    dieType: DieType;
    status: DailyStatus;
    score: number;
    rollCount: number;
  }): void {
    capture("daily_result", args);
  },

  // A share/copy action — the top of the viral loop (share → ?daily=1 click →
  // play). `status` is the run's outcome where known.
  shareCopied(surface: "daily" | "free", status?: DailyStatus): void {
    capture("share_copied", { surface, status });
  },

  walkthroughCompleted(): void {
    capture("walkthrough_completed");
  },
  walkthroughSkipped(): void {
    capture("walkthrough_skipped");
  },

  // Fired once on load when the visitor arrived via a shared/attributed link
  // (?daily=1, ref, or any utm_*). This is what makes "shared-link clicks →
  // plays" measurable. Props are passed pre-parsed by the caller.
  referralLanding(props: {
    source: string;
    daily: boolean;
    ref?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  }): void {
    capture("referral_landing", props);
  },
};

// Inspect the landing URL and, if it carries any attribution, fire
// referral_landing. Reads `window.location.search` directly so it can run from
// instrumentation-client BEFORE the app strips ?daily=1 from the URL.
export function captureReferralLanding(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const daily = params.get("daily") === "1";
    const ref = params.get("ref") ?? undefined;
    const utm_source = params.get("utm_source") ?? undefined;
    const utm_medium = params.get("utm_medium") ?? undefined;
    const utm_campaign = params.get("utm_campaign") ?? undefined;

    // Only fire when the link actually carries attribution — a plain direct
    // visit should not look like a referral.
    if (!daily && !ref && !utm_source && !utm_medium && !utm_campaign) return;

    // Best-effort single source label for at-a-glance funnels.
    const source = utm_source ?? ref ?? (daily ? "shared_link" : "unknown");

    analytics.referralLanding({
      source,
      daily,
      ref,
      utm_source,
      utm_medium,
      utm_campaign,
    });
  } catch {
    // No attribution captured — not worth surfacing.
  }
}
