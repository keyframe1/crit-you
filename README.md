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
