import { isNatMax, isNatMin, labelFor, type Roll } from "@/lib/dice";

const SIZE = 1080;

// Reliable system stacks — canvas can't easily reference next/font's hashed
// family names, so we use widely-available faces that match the app's vibe.
const SANS =
  '900 SANSPX system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO =
  'MONOPX ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace';

function sans(px: number) {
  return SANS.replace("SANSPX", `${px}px`);
}
function mono(px: number, weight = "400") {
  return MONO.replace("MONOPX", `${weight} ${px}px`);
}

// Greedy word-wrap against a max width, returning lines.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatDate(d: Date) {
  return d
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}

// Render a 1080×1080 share card to an offscreen canvas and return it.
export function renderShareCard(roll: Roll, now: Date = new Date()): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  const max = isNatMax(roll);
  const min = isNatMin(roll);
  const numberColor = max ? "#c0392b" : min ? "#888884" : "#ecebe6";

  // Background.
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Soft radial glow behind the number — accent on a crit, neutral otherwise.
  const glow = ctx.createRadialGradient(
    SIZE / 2,
    SIZE / 2,
    0,
    SIZE / 2,
    SIZE / 2,
    SIZE / 2
  );
  glow.addColorStop(0, max ? "rgba(192,57,43,0.20)" : "rgba(255,255,255,0.05)");
  glow.addColorStop(1, "rgba(10,10,10,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Die-type label, top-left.
  ctx.fillStyle = "#666660";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = mono(34, "500");
  ctx.fillText(labelFor(roll.dieType), 80, 80);

  // The number, large and centred.
  ctx.fillStyle = numberColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = sans(360);
  if (max) {
    ctx.shadowColor = "rgba(192,57,43,0.55)";
    ctx.shadowBlur = 60;
  }
  ctx.fillText(String(roll.value), SIZE / 2, SIZE / 2 - 40);
  ctx.shadowBlur = 0;

  // Personality line, wrapped, below the number.
  ctx.fillStyle = "#888884";
  ctx.font = mono(32);
  const lines = wrap(ctx, roll.line, SIZE - 220);
  const lineHeight = 46;
  let ly = SIZE / 2 + 230;
  for (const line of lines) {
    ctx.fillText(line, SIZE / 2, ly);
    ly += lineHeight;
  }

  // Footer: date bottom-left, watermark bottom-right.
  ctx.fillStyle = "#555550";
  ctx.textBaseline = "alphabetic";
  ctx.font = mono(26);
  ctx.textAlign = "left";
  ctx.fillText(formatDate(now), 80, SIZE - 70);
  ctx.textAlign = "right";
  ctx.fillText("crit.you", SIZE - 80, SIZE - 70);

  return canvas;
}

// Convert the rendered card to a PNG blob.
export function shareCardBlob(roll: Roll): Promise<Blob | null> {
  const canvas = renderShareCard(roll);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
