"use client";

// Pip — Crit's mascot die. A friendly cream die whose face is drawn from its own
// pips: two pip "eyes" and a little pip "mouth", with eyebrows/cheeks/blush added
// per expression. Pure inline SVG so it paints instantly (no WebGL, no images) —
// used in the cold-open loader and the Daily rules walkthrough.

export type PipExpression =
  | "happy" // default, warm
  | "smug" // half-lidded, knowing smirk
  | "wink" // one eye closed
  | "worried" // raised brows + frown + sweat drop (the bust beat)
  | "proud"; // big grin + blush (the perfect-run beat)

const INK = "#1a1a18";
const ACCENT = "#c0392b";

export default function Pip({
  expression = "happy",
  size = 72,
  className,
}: {
  expression?: PipExpression;
  size?: number;
  className?: string;
}) {
  const blush = expression === "happy" || expression === "proud";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Pip the dice mascot"
    >
      {/* Body — a rounded die with a soft top highlight. */}
      <rect x="12" y="12" width="96" height="96" rx="26" fill="#fbf9f3" stroke={INK} strokeWidth="4.5" />
      <rect x="22" y="21" width="76" height="30" rx="15" fill="#ffffff" opacity="0.45" />

      {/* Blush — rosy cheeks for the warm expressions. */}
      {blush && (
        <>
          <circle cx="34" cy="74" r="8" fill={ACCENT} opacity="0.22" />
          <circle cx="86" cy="74" r="8" fill={ACCENT} opacity="0.22" />
        </>
      )}

      {/* ── Eyes ── */}
      {expression === "happy" && (
        <>
          <circle cx="44" cy="56" r="8" fill={INK} />
          <circle cx="76" cy="56" r="8" fill={INK} />
          <circle cx="41" cy="53" r="2.4" fill="#fff" />
          <circle cx="73" cy="53" r="2.4" fill="#fff" />
        </>
      )}
      {expression === "proud" && (
        <>
          <circle cx="44" cy="55" r="8.5" fill={INK} />
          <circle cx="76" cy="55" r="8.5" fill={INK} />
          <circle cx="41" cy="52" r="2.6" fill="#fff" />
          <circle cx="73" cy="52" r="2.6" fill="#fff" />
        </>
      )}
      {expression === "smug" && (
        <>
          {/* Half-lidded lids — relaxed, knowing. */}
          <path d="M36 56 q8 5 16 0" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path d="M68 56 q8 5 16 0" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {expression === "wink" && (
        <>
          <circle cx="44" cy="56" r="8" fill={INK} />
          <circle cx="41" cy="53" r="2.4" fill="#fff" />
          {/* Closed/winking eye. */}
          <path d="M68 58 q8 -6 16 0" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {expression === "worried" && (
        <>
          <circle cx="45" cy="58" r="6.5" fill={INK} />
          <circle cx="75" cy="58" r="6.5" fill={INK} />
          {/* Up-slanted, anxious brows. */}
          <line x1="36" y1="44" x2="52" y2="49" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <line x1="84" y1="44" x2="68" y2="49" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </>
      )}

      {/* ── Mouth — built from pips (a dotted smile / smirk / frown) ── */}
      {(expression === "happy" || expression === "wink") && (
        <g fill={INK}>
          <circle cx="45" cy="82" r="4" />
          <circle cx="60" cy="86" r="4.4" />
          <circle cx="75" cy="82" r="4" />
        </g>
      )}
      {expression === "proud" && (
        <g fill={INK}>
          <circle cx="40" cy="80" r="3.8" />
          <circle cx="50" cy="86" r="4.4" />
          <circle cx="60" cy="88" r="4.6" />
          <circle cx="70" cy="86" r="4.4" />
          <circle cx="80" cy="80" r="3.8" />
        </g>
      )}
      {expression === "smug" && (
        <g fill={INK}>
          {/* Asymmetric — a pip smirk pulling up to one side. */}
          <circle cx="46" cy="86" r="4" />
          <circle cx="60" cy="85" r="4.2" />
          <circle cx="74" cy="80" r="4.2" />
        </g>
      )}
      {expression === "worried" && (
        <>
          <g fill={INK}>
            {/* Down-turned — corners drop. */}
            <circle cx="45" cy="86" r="4" />
            <circle cx="60" cy="82" r="4.4" />
            <circle cx="75" cy="86" r="4" />
          </g>
          {/* A nervous bead of sweat. */}
          <path d="M95 40 q5 8 0 12 q-5 -4 0 -12 Z" fill="#5b9bd5" opacity="0.85" />
        </>
      )}
    </svg>
  );
}
