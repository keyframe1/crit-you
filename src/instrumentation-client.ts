// Client instrumentation — runs after the HTML loads but BEFORE React hydration
// (Next.js convention; see node_modules/next/dist/docs/.../instrumentation-client.md).
//
// We boot PostHog here so the initial pageview is captured at the earliest safe
// point, and we read the landing URL for attribution (?daily=1 / ref / utm_*)
// before the app strips those params on mount — that's what makes the
// shared-link → play loop measurable.

import { initAnalytics, captureReferralLanding } from "@/lib/analytics";

initAnalytics();
captureReferralLanding();
