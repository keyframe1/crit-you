import { ImageResponse } from "next/og";

// 180×180 Apple touch icon: Pip's face on the cream brand ground. Same crimson
// die + minimal smug face as the favicon (icon.svg), generated larger here with a
// little cream margin so it reads as Pip sitting on the brand background. The face
// geometry is kept identical to icon.svg so the two never drift apart.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Pip's resting (smug) face — a bold crimson die with a soft top highlight, two
// cream eyes, and an asymmetric cream smirk. Mirrors icon.svg's geometry.
const PIP_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='140' height='140'>
  <rect x='4' y='4' width='92' height='92' rx='26' fill='#c0392b'/>
  <rect x='16' y='13' width='68' height='24' rx='12' fill='#ffffff' fill-opacity='0.16'/>
  <circle cx='37' cy='45' r='9.5' fill='#f6f1e7'/>
  <circle cx='63' cy='45' r='9.5' fill='#f6f1e7'/>
  <path d='M32 66 Q49 79 68 60' fill='none' stroke='#f6f1e7' stroke-width='8' stroke-linecap='round'/>
</svg>`;

export default function AppleIcon() {
  const pip = `data:image/svg+xml,${encodeURIComponent(PIP_SVG)}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f5f3ee",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pip} width={140} height={140} alt="" />
      </div>
    ),
    { ...size }
  );
}
