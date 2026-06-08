// Upstash Redis client — the only place we touch the network in the whole app.
// Backed by the Vercel/Upstash integration's REST env vars (KV_REST_API_URL +
// KV_REST_API_TOKEN). Used solely by the Daily provenance routes
// (/api/daily/submit + /api/daily/verify); the game itself stays client-only.
//
// The client is built LAZILY (first request), never at module load, so that
// `next build` — which loads the route module to read its config but never
// invokes the handler — doesn't need the env vars present and can't throw on a
// machine without them. On Vercel the vars are always set at request time.

import { Redis } from "@upstash/redis";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }
  return client;
}
