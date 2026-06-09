import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  SHAPES,
  ANIM,
  CELESTIAL_STARS,
  CELESTIAL_LINES,
  type DieType,
} from "@/lib/dice";

// 1200×630 link-unfurl card. The brand on a dark field: the celestial d∞ as the
// hero, the full polyhedral set rendered from the app's own DieGlyph geometry
// (SHAPES + per-die signature colours) below the wordmark, Pip peeking in his
// resting smug, and the CRIT wordmark in real Geist. Generated at build time via
// next/og — no asset files, no 3D render. This is the other half of the share
// loop: the daily grid shares the link; this is what the link unfurls to.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Crit — Your dice have opinions.";

// Brand palette (mirrors globals.css, inverted for the dark card).
const FIELD = "#141413"; // dark ground
const CREAM = "#f5f3ee"; // wordmark / wireframe ink on dark
const MUTED = "#9a988f"; // tagline
const INK = "#1a1a18"; // Pip's features

// A polyhedral die glyph for the dark card: the app's exact SHAPES geometry, but
// with the wireframe drawn in cream (the in-app ink would vanish on dark) and the
// signature-colour fills boosted so each die keeps its character against the dark.
function dieGlyphSVG(die: DieType, px: number): string {
  const shape = SHAPES[die];
  const color = ANIM[die].color;
  const fills = shape.fills
    .map(
      (f) =>
        `<polygon points='${f.points}' fill='${color}' fill-opacity='${Math.min(
          0.6,
          f.opacity * 2.7
        ).toFixed(2)}'/>`
    )
    .join("");
  const wires = shape.wireLines
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='${CREAM}' stroke-opacity='0.5' stroke-width='2.4' stroke-linecap='round'/>`
    )
    .join("");
  const outline = `<polygon points='${shape.outline}' fill='none' stroke='${CREAM}' stroke-width='4.5' stroke-linejoin='round'/>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160' width='${px}' height='${px}'>${fills}${wires}${outline}</svg>`;
}

// The celestial d∞ hero — a deep-space orb (the in-app star sphere, flattened to a
// medallion): a dark gradient sphere, the constellation wires + stars from the
// app's own CELESTIAL_* tables, and a bright hero star.
function celestialSVG(px: number): string {
  const stars = CELESTIAL_STARS.map(
    (s) =>
      `<circle cx='${s.x}' cy='${s.y}' r='${(s.r * 1.25).toFixed(
        2
      )}' fill='#dce8ff' fill-opacity='${s.o}'/>`
  ).join("");
  const lines = CELESTIAL_LINES.map(
    ([x1, y1, x2, y2]) =>
      `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='#9ab4ff' stroke-opacity='0.45' stroke-width='1.3'/>`
  ).join("");
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160' width='${px}' height='${px}'>
    <defs>
      <radialGradient id='orb' cx='40%' cy='36%' r='72%'>
        <stop offset='0%' stop-color='#1b2456'/>
        <stop offset='55%' stop-color='#0a0e25'/>
        <stop offset='100%' stop-color='#05060f'/>
      </radialGradient>
    </defs>
    <circle cx='80' cy='80' r='74' fill='url(#orb)' stroke='#2b3566' stroke-width='1.5'/>
    ${lines}
    ${stars}
    <circle cx='58' cy='58' r='3.4' fill='#ffffff'/>
    <circle cx='58' cy='58' r='7' fill='#ffffff' fill-opacity='0.18'/>
  </svg>`;
}

// Pip's resting (smug) face — the exact markup of Pip.tsx's smug branch.
function pipSmugSVG(px: number): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' width='${px}' height='${px}'>
    <rect x='12' y='12' width='96' height='96' rx='26' fill='#fbf9f3' stroke='${INK}' stroke-width='4.5'/>
    <rect x='22' y='21' width='76' height='30' rx='15' fill='#ffffff' opacity='0.45'/>
    <path d='M36 56 q8 5 16 0' fill='none' stroke='${INK}' stroke-width='5' stroke-linecap='round'/>
    <path d='M68 56 q8 5 16 0' fill='none' stroke='${INK}' stroke-width='5' stroke-linecap='round'/>
    <g fill='${INK}'>
      <circle cx='46' cy='86' r='4'/>
      <circle cx='60' cy='85' r='4.2'/>
      <circle cx='74' cy='80' r='4.2'/>
    </g>
  </svg>`;
}

// The polyhedral set shown in the deck row, low → high (the celestial is the hero
// above, so it's not repeated here).
const ROW: DieType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d30"];

const uri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

export default async function OpengraphImage() {
  // Real Geist, loaded from the installed package (no new asset files).
  const fontDir = "node_modules/geist/dist/fonts/geist-sans";
  const [geistBlack, geistMedium] = await Promise.all([
    readFile(join(process.cwd(), fontDir, "Geist-Black.ttf")),
    readFile(join(process.cwd(), fontDir, "Geist-Medium.ttf")),
  ]);

  const hero = uri(celestialSVG(196));
  const pip = uri(pipSmugSVG(150));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          background: FIELD,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Geist",
        }}
      >
        {/* Soft brand glow behind the hero — cool celestial blue with a warm
            crimson hint at the base, for depth on the flat dark field. */}
        <div
          style={{
            position: "absolute",
            top: 70,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background:
              "radial-gradient(circle, rgba(120,150,255,0.22), rgba(192,57,43,0.06) 45%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Hero — the celestial d∞. */}
        <div style={{ display: "flex", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} width={196} height={196} alt="" />
        </div>

        {/* Wordmark. */}
        <div
          style={{
            display: "flex",
            fontSize: 124,
            fontWeight: 900,
            letterSpacing: "0.1em",
            color: CREAM,
            marginTop: 18,
            paddingLeft: "0.1em",
            lineHeight: 1,
          }}
        >
          CRIT
        </div>

        {/* Tagline. */}
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 500,
            color: MUTED,
            marginTop: 10,
          }}
        >
          Your dice have opinions.
        </div>

        {/* The full polyhedral set, in their signature colours. */}
        <div style={{ display: "flex", gap: 16, marginTop: 34 }}>
          {ROW.map((die) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={die} src={uri(dieGlyphSVG(die, 58))} width={58} height={58} alt="" />
          ))}
        </div>

        {/* Pip peeking from the corner — the brand's resting smug. */}
        <div style={{ position: "absolute", right: 60, bottom: 46, display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pip} width={150} height={150} alt="" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geistBlack, weight: 900, style: "normal" },
        { name: "Geist", data: geistMedium, weight: 500, style: "normal" },
      ],
    }
  );
}
