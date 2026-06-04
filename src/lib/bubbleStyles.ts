// Per-die speech-bubble styling. Each die's bubble is a visual extension of its
// personality (see lib/lines.ts for the voice): the angry caltrop gets sharp
// crimson corners, the basic d6 a beige corporate panel, the celestial d∞ a
// glowing window into deep space. Personality.tsx reads BUBBLE_STYLES[dieType]
// and applies the matching look; the notch (the little triangle pointing down at
// the die) inherits each bubble's fill + border so it always matches.

import type { CSSProperties } from "react";
import type { DieType } from "@/lib/dice";

// Font stacks mirror globals.css (--font-sans / --font-mono); spelled out here so
// a bubble can pick mono or sans independently of the page default.
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const SANS = "var(--font-geist-sans), system-ui, sans-serif";

export interface BubbleStyle {
  // Bubble body
  background: string;
  border: string; // CSS border shorthand
  borderRadius: string;
  boxShadow: string; // "none" when the die wants a flat bubble
  padding: string;
  // Text
  color: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  fontStyle: CSSProperties["fontStyle"];
  letterSpacing: string;
  textTransform: CSSProperties["textTransform"];
  lineHeight: number;
  // d12 only: a nat_max line goes italic for extra theatrical drama.
  italicOnNatMax?: boolean;
  // Notch — a rotated square whose two lower edges carry the border, reading as a
  // triangle aimed at the die. It mirrors the bubble's fill + edge.
  notchBg: string;
  notchBorderColor: string;
  notchBorderWidth: string;
  notchRadius: string;
}

export const BUBBLE_STYLES: Record<DieType, BubbleStyle> = {
  // D4 — THE CALTROP. Sharp, angular, aggressive; terse military-briefing red.
  d4: {
    background: "#1a0a0a",
    border: "1px solid #c0392b",
    borderRadius: "2px",
    boxShadow: "none",
    padding: "11px 18px",
    color: "#e84c3d",
    fontFamily: MONO,
    fontSize: "13px",
    fontWeight: 400,
    fontStyle: "normal",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    lineHeight: 1.5,
    notchBg: "#1a0a0a",
    notchBorderColor: "#c0392b",
    notchBorderWidth: "1px",
    notchRadius: "0px",
  },
  // D6 — THE BASIC. Standard rounded beige panel. The corporate-email die.
  d6: {
    background: "#f5f5f0",
    border: "1px solid #ddd",
    borderRadius: "8px",
    boxShadow: "none",
    padding: "12px 20px",
    color: "#555555",
    fontFamily: SANS,
    fontSize: "14px",
    fontWeight: 400,
    fontStyle: "normal",
    letterSpacing: "normal",
    textTransform: "none",
    lineHeight: 1.5,
    notchBg: "#f5f5f0",
    notchBorderColor: "#ddd",
    notchBorderWidth: "1px",
    notchRadius: "2px",
  },
  // D8 — THE MIDDLE CHILD. Over-rounded, light teal, italic (earnest/insecure).
  d8: {
    background: "#f0fafa",
    border: "1px solid #2a9d8f40",
    borderRadius: "16px",
    boxShadow: "none",
    padding: "12px 20px",
    color: "#1a6b62",
    fontFamily: SANS,
    fontSize: "14px",
    fontWeight: 400,
    fontStyle: "italic",
    letterSpacing: "normal",
    textTransform: "none",
    lineHeight: 1.5,
    notchBg: "#f0fafa",
    notchBorderColor: "#2a9d8f40",
    notchBorderWidth: "1px",
    notchRadius: "3px",
  },
  // D10 — THE STATISTICIAN. Zero-radius terminal readout; mandatory monospace.
  d10: {
    background: "#0a1a0a",
    border: "1px solid #27ae6060",
    borderRadius: "0px",
    boxShadow: "none",
    padding: "11px 18px",
    color: "#27ae60",
    fontFamily: MONO,
    fontSize: "13px",
    fontWeight: 400,
    fontStyle: "normal",
    letterSpacing: "normal",
    textTransform: "none",
    lineHeight: 1.5,
    notchBg: "#0a1a0a",
    notchBorderColor: "#27ae6060",
    notchBorderWidth: "1px",
    notchRadius: "0px",
  },
  // D12 — THE UNDERDOG. Thicker gold border (DRAMA), larger text + padding, bold;
  // a nat_max line tips into italic. Theater-marquee energy.
  d12: {
    background: "#1a1508",
    border: "2px solid #d4a843",
    borderRadius: "12px",
    boxShadow: "none",
    padding: "14px 24px",
    color: "#f0d878",
    fontFamily: SANS,
    fontSize: "15px",
    fontWeight: 700,
    fontStyle: "normal",
    letterSpacing: "normal",
    textTransform: "none",
    lineHeight: 1.45,
    italicOnNatMax: true,
    notchBg: "#1a1508",
    notchBorderColor: "#d4a843",
    notchBorderWidth: "2px",
    notchRadius: "2px",
  },
  // D20 — THE MAIN CHARACTER. The benchmark: clean white, soft shadow, dry mono.
  d20: {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: "10px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    padding: "12px 20px",
    color: "#1a1a18",
    fontFamily: MONO,
    fontSize: "14px",
    fontWeight: 400,
    fontStyle: "normal",
    letterSpacing: "normal",
    textTransform: "none",
    lineHeight: 1.5,
    notchBg: "#ffffff",
    notchBorderColor: "rgba(0,0,0,0.08)",
    notchBorderWidth: "1px",
    notchRadius: "2px",
  },
  // D30 — THE EXOTIC. Deep purple-black, light (300) airy type. Gallery placard.
  d30: {
    background: "#150a20",
    border: "1px solid #8e44ad50",
    borderRadius: "12px",
    boxShadow: "none",
    padding: "12px 20px",
    color: "#c89eec",
    fontFamily: SANS,
    fontSize: "14px",
    fontWeight: 300,
    fontStyle: "normal",
    letterSpacing: "0.03em",
    textTransform: "none",
    lineHeight: 1.55,
    notchBg: "#150a20",
    notchBorderColor: "#8e44ad50",
    notchBorderWidth: "1px",
    notchRadius: "2px",
  },
  // D∞ — THE CELESTIAL. Deep-space blue-black with an outer ice-blue glow; soft,
  // ethereal, light type. A transmission from far away.
  dinf: {
    background: "#080818",
    border: "1px solid rgba(148,184,255,0.2)",
    borderRadius: "20px",
    boxShadow: "0 0 20px rgba(148,184,255,0.08)",
    padding: "12px 22px",
    color: "#94b8ff",
    fontFamily: SANS,
    fontSize: "14px",
    fontWeight: 300,
    fontStyle: "normal",
    letterSpacing: "0.04em",
    textTransform: "none",
    lineHeight: 1.55,
    notchBg: "#080818",
    notchBorderColor: "rgba(148,184,255,0.2)",
    notchBorderWidth: "1px",
    notchRadius: "3px",
  },
};

// ─── On-face result number styling ───────────────────────────────────────────
// The number that fades in on the die after it lands. It mirrors each die's
// speech-bubble voice (same font family, weight, colour family) so the number
// and the line read as one personality. Rendered by components/dice3d/dieNumber.
// Crit overrides (maxColor/maxBackground/minColor/minBackground) are optional: a
// die that omits them keeps its normal themed look on a nat max/min, leaning on
// its body animation for the celebration. Only the d20 recolours its number.
export interface NumberStyle {
  fontFamily: string;
  fontWeight: number;
  fontStyle: CSSProperties["fontStyle"];
  fontSize: string;
  color: string;
  textShadow: string;
  background: string;
  maxColor?: string;
  maxBackground?: string;
  minColor?: string;
  minBackground?: string;
}

export const NUMBER_STYLES: Record<DieType, NumberStyle> = {
  // D4 — bold crimson mono, like the caltrop's terse red briefing.
  d4: {
    fontFamily: MONO,
    fontWeight: 700,
    fontStyle: "normal",
    fontSize: "clamp(28px, 7.5vw, 36px)",
    color: "#e84c3d",
    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
    background: "rgba(26,10,10,0.5)",
  },
  // D6 — plain grey sans, normal weight. It's boring, on purpose.
  d6: {
    fontFamily: SANS,
    fontWeight: 400,
    fontStyle: "normal",
    fontSize: "clamp(28px, 7.5vw, 36px)",
    color: "#888888",
    textShadow: "0 1px 2px rgba(0,0,0,0.3)",
    background: "rgba(245,245,240,0.4)",
  },
  // D8 — italic bold teal, matching the anxious-earnest bubble.
  d8: {
    fontFamily: SANS,
    fontWeight: 700,
    fontStyle: "italic",
    fontSize: "clamp(28px, 7.5vw, 36px)",
    color: "#2a9d8f",
    textShadow: "0 1px 2px rgba(0,0,0,0.4)",
    background: "rgba(240,250,250,0.4)",
  },
  // D10 — terminal-green mono with a faint glow. Data readout.
  d10: {
    fontFamily: MONO,
    fontWeight: 400,
    fontStyle: "normal",
    fontSize: "clamp(28px, 7.5vw, 36px)",
    color: "#27ae60",
    textShadow: "0 0 6px rgba(39,174,96,0.4)",
    background: "rgba(10,26,10,0.5)",
  },
  // D12 — bold gold, a touch larger than the rest. Theatrical.
  d12: {
    fontFamily: SANS,
    fontWeight: 700,
    fontStyle: "normal",
    fontSize: "clamp(30px, 8vw, 40px)",
    color: "#f0d878",
    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
    background: "rgba(26,21,8,0.5)",
  },
  // D20 — the benchmark: bold cream mono. Recolours on a crit (crimson nat 20,
  // dim grey nat 1) — the only die that themes its number for max/min.
  d20: {
    fontFamily: MONO,
    fontWeight: 700,
    fontStyle: "normal",
    fontSize: "clamp(28px, 7.5vw, 36px)",
    color: "#e8e4dc",
    textShadow: "0 2px 4px rgba(0,0,0,0.5)",
    background: "rgba(0,0,0,0.3)",
    maxColor: "#ffffff",
    maxBackground: "rgba(192,57,43,0.4)",
    minColor: "#888888",
    minBackground: "rgba(0,0,0,0.15)",
  },
  // D30 — light (300) lavender sans. Elegant, exotic.
  d30: {
    fontFamily: SANS,
    fontWeight: 300,
    fontStyle: "normal",
    fontSize: "clamp(28px, 7.5vw, 36px)",
    color: "#c89eec",
    textShadow: "0 1px 2px rgba(0,0,0,0.4)",
    background: "rgba(21,10,32,0.5)",
  },
  // D∞ — light ice-blue sans with a cosmic glow.
  dinf: {
    fontFamily: SANS,
    fontWeight: 300,
    fontStyle: "normal",
    fontSize: "clamp(28px, 7.5vw, 36px)",
    color: "#94b8ff",
    textShadow: "0 0 12px rgba(148,184,255,0.5)",
    background: "rgba(8,8,24,0.4)",
  },
};
