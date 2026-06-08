# Crit

Premium dice roller PWA with personality. Roll, get roasted, share. [crit.you](https://crit.you)

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS · Framer Motion · GSAP · Geist

## Development

```bash
npm install
npm run dev
```

Runs on [localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

## Structure

```
src/
├── app/
│   ├── layout.tsx        # Root layout, Geist fonts, metadata, PWA tags
│   ├── page.tsx          # The single page — wires the die, result, line, selector
│   └── globals.css       # Tailwind + dark-theme custom properties
├── components/
│   ├── Dice.tsx          # Multi-die SVG wireframe with GSAP tumble + idle float
│   ├── RollResult.tsx    # Result number: back.out spring, nat-min shake, auto-fade
│   ├── Personality.tsx   # Snarky line, Framer Motion fade-up
│   ├── DiceSelector.tsx  # Swipeable d4–d30 carousel (Framer drag + snap)
│   ├── ShareCard.tsx     # Share button: native share / clipboard / download
│   └── Reveal.tsx        # Framer Motion scroll reveal wrapper (utility)
└── lib/
    ├── dice.ts           # Die definitions, SVG geometry, the Roll model
    ├── lines.ts          # Personality lines by category + picker
    └── share.ts          # 1080×1080 share card renderer (offscreen canvas)
scripts/
└── gen-icons.mjs         # Generates public/icon-{192,512}.png (no deps)
public/
└── manifest.json         # PWA manifest
```

## Dice

Seven types — d4, d6, d8, d10, d12, d20, d30 — each a hand-authored SVG
wireframe. The active type drives the result range and the shape on screen.

## Animations

- **Dice**: GSAP 3D tumble (`rotateX/Y/Z`) with a `back.out(2.5)` spring settle,
  sine idle float, and an accent glow pulse on a natural max.
- **Result**: `back.out(3)` spring entrance, a 3-cycle shake on a natural 1,
  auto-fade after 2s.
- **Personality / toast**: Framer Motion fade-up with `[0.16, 1, 0.3, 1]` easing.
- **Selector**: Framer Motion drag with snap-to-nearest on release.

## PWA

Installable via `public/manifest.json`, dark theme color `#0a0a0a`, and Apple
web-app meta tags. Regenerate icons with `node scripts/gen-icons.mjs`.

## Discord bot

An HTTP-interactions bot exposes the Daily Crit in any server it's added to:

- `/crit today` — today's die + the play link (Discord can't run a parent
  command bare once it has subcommands, so this is the "today's prompt" command).
- `/crit submit <code>` — verifies the share-grid `verify #…` code server-side
  and logs it to this server's leaderboard.
- `/crit leaderboard` — the server's standings, **ordered by current streak**
  (today's score breaks ties). The daily is deterministic, so a sustained,
  server-validated streak — not a raw top score — is the real flex.

**Endpoint:** `POST /api/discord/interactions` verifies the Ed25519 signature on
every request, answers Discord's PING, and replies within the 3s window.

**Env (set on Vercel):** `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`,
`DISCORD_BOT_TOKEN` — plus the existing Upstash (`KV_REST_API_URL`,
`KV_REST_API_TOKEN`) and `CRIT_SIGNING_SECRET` used by the Daily provenance API.

**One-time setup after deploy:**

1. In the Discord Developer Portal → your app → **Interactions Endpoint URL**,
   set `https://crit.you/api/discord/interactions` and save (Discord sends a
   verification PING — it passes once deployed).
2. Register the commands once:

   ```bash
   vercel env pull .env.local                              # gets APP_ID + BOT_TOKEN
   node --env-file=.env.local scripts/register-commands.mjs
   ```

   Add `--guild=<GUILD_ID>` for instant registration in a single test server
   (global commands take up to ~1h to propagate). Re-run only if the command
   shapes change.
