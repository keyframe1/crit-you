import { ImageResponse } from "next/og";

// 180×180 Apple touch icon: a crimson d20 silhouette on the cream brand ground.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The d20 hex with faint internal facet lines (matches the in-app wireframe).
const DIE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160' width='118' height='118'>
  <polygon points='80,8 152,44 152,116 80,152 8,116 8,44' fill='#c0392b'/>
  <g stroke='#1a1a18' stroke-opacity='0.5' stroke-width='3' fill='none' stroke-linejoin='round'>
    <line x1='80' y1='8' x2='80' y2='152'/>
    <line x1='8' y1='44' x2='152' y2='116'/>
    <line x1='152' y1='44' x2='8' y2='116'/>
    <line x1='8' y1='44' x2='152' y2='44'/>
    <line x1='8' y1='116' x2='152' y2='116'/>
  </g>
</svg>`;

export default function AppleIcon() {
  const die = `data:image/svg+xml,${encodeURIComponent(DIE_SVG)}`;
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
        <img src={die} width={118} height={118} alt="" />
      </div>
    ),
    { ...size }
  );
}
