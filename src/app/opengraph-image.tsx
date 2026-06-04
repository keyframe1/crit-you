import { ImageResponse } from "next/og";

// 1200×630 social share card: a crimson d20 wireframe over a dark ground with the
// CRIT wordmark and tagline. Statically generated at build time.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Crit — Your dice have opinions.";

// A crimson wireframe d20 (outline + internal facet lines, no fill).
const DIE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160' width='260' height='260'>
  <g stroke='#c0392b' fill='none' stroke-linejoin='round' stroke-linecap='round'>
    <polygon points='80,8 152,44 152,116 80,152 8,116 8,44' stroke-width='4'/>
    <g stroke-width='2.5' stroke-opacity='0.85'>
      <line x1='80' y1='8' x2='80' y2='152'/>
      <line x1='8' y1='44' x2='152' y2='116'/>
      <line x1='152' y1='44' x2='8' y2='116'/>
      <line x1='80' y1='8' x2='8' y2='116'/>
      <line x1='80' y1='8' x2='152' y2='116'/>
      <line x1='8' y1='44' x2='80' y2='152'/>
      <line x1='152' y1='44' x2='80' y2='152'/>
      <line x1='8' y1='44' x2='152' y2='44'/>
      <line x1='8' y1='116' x2='152' y2='116'/>
    </g>
  </g>
</svg>`;

export default function OpengraphImage() {
  const die = `data:image/svg+xml,${encodeURIComponent(DIE_SVG)}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#141413",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={die} width={240} height={240} alt="" />
        <div
          style={{
            display: "flex",
            fontSize: 132,
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: "#f5f3ee",
            marginTop: 28,
            paddingLeft: "0.12em",
          }}
        >
          CRIT
        </div>
        <div style={{ display: "flex", fontSize: 38, color: "#9a988f", marginTop: 6 }}>
          Your dice have opinions.
        </div>
      </div>
    ),
    { ...size }
  );
}
