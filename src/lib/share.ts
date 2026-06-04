import {
  isNatMax,
  isNatMin,
  labelFor,
  animFor,
  SHAPES,
  type DieType,
  type Roll,
} from "@/lib/dice";

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

// ─── Daily Crit share card ───────────────────────────────────────────────────
// A different layout on the same 1080×1080 infra. SPOILER-LIGHT by design: it
// reveals the die, the date, how many rolls happened, and whether the run banked
// or busted — but NEVER the individual face values, so sharing can't ruin the
// run for anyone who hasn't played today.

export interface DailyShareData {
  dieType: DieType;
  date: Date;
  rollCount: number; // dice drawn this run (a busting roll included)
  busted: boolean;
  score: number;
}

// Draw a small wireframe die silhouette (reusing the SHAPES geometry, authored in
// a 160×160 box) centred at (cx, cy) within a `size`-px square. No numbers — the
// silhouette alone keeps the card spoiler-light.
function drawDieGlyph(
  ctx: CanvasRenderingContext2D,
  dieType: DieType,
  cx: number,
  cy: number,
  size: number
) {
  const shape = SHAPES[dieType];
  if (!shape.outline) return;
  const color = animFor(dieType).color;
  const scale = size / 160;
  const tx = cx - 80 * scale;
  const ty = cy - 80 * scale;
  const map = (x: number, y: number): [number, number] => [
    tx + x * scale,
    ty + y * scale,
  ];

  // Filled silhouette (faint signature wash) + bold cream outline.
  const pts = shape.outline.split(" ").map((p) => p.split(",").map(Number));
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const [X, Y] = map(x, y);
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.closePath();
  ctx.fillStyle = `${color}33`;
  ctx.fill();
  ctx.strokeStyle = "#ecebe6";
  ctx.lineWidth = Math.max(1.5, size * 0.045);
  ctx.lineJoin = "round";
  ctx.stroke();

  // A few inner wires so the facets read at small size.
  ctx.strokeStyle = "rgba(236,235,230,0.45)";
  ctx.lineWidth = Math.max(1, size * 0.022);
  for (const [x1, y1, x2, y2] of shape.wireLines.slice(0, 4)) {
    const [X1, Y1] = map(x1, y1);
    const [X2, Y2] = map(x2, y2);
    ctx.beginPath();
    ctx.moveTo(X1, Y1);
    ctx.lineTo(X2, Y2);
    ctx.stroke();
  }
}

export function renderDailyCard(data: DailyShareData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  const accent = animFor(data.dieType).color;

  // Background + a soft glow tinted by the outcome.
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const glow = ctx.createRadialGradient(
    SIZE / 2,
    SIZE / 2,
    0,
    SIZE / 2,
    SIZE / 2,
    SIZE / 2
  );
  glow.addColorStop(
    0,
    data.busted ? "rgba(120,120,120,0.06)" : `${accent}26`
  );
  glow.addColorStop(1, "rgba(10,10,10,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Header: "DAILY · D20", top-left.
  ctx.fillStyle = "#666660";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = mono(34, "500");
  ctx.fillText(`DAILY · ${labelFor(data.dieType)}`, 80, 80);

  // The dice row, centred high. One glyph per roll; the final glyph becomes a 💥
  // on a bust. Sized to fit the run width with comfortable gaps.
  const n = Math.max(1, data.rollCount);
  const maxRowWidth = SIZE - 240;
  const glyphSize = Math.min(110, maxRowWidth / n - 14);
  const gap = glyphSize * 0.32;
  const rowWidth = n * glyphSize + (n - 1) * gap;
  const rowY = SIZE / 2 - 150;
  let gx = SIZE / 2 - rowWidth / 2 + glyphSize / 2;
  for (let i = 0; i < n; i++) {
    const isBustGlyph = data.busted && i === n - 1;
    if (isBustGlyph) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = sans(glyphSize * 0.95);
      ctx.fillText("💥", gx, rowY);
    } else {
      drawDieGlyph(ctx, data.dieType, gx, rowY, glyphSize);
    }
    gx += glyphSize + gap;
  }

  // The outcome, large and centred.
  const headline = data.busted ? "BUSTED" : `BANKED ${data.score}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = data.busted ? "#8a8884" : "#ecebe6";
  ctx.font = sans(data.busted ? 150 : 170);
  if (!data.busted) {
    ctx.shadowColor = `${accent}8c`;
    ctx.shadowBlur = 50;
  }
  ctx.fillText(headline, SIZE / 2, SIZE / 2 + 120);
  ctx.shadowBlur = 0;

  // Sub-line: the run length (count + outcome only — never the values).
  ctx.fillStyle = "#888884";
  ctx.font = mono(34);
  const rollWord = n === 1 ? "roll" : "rolls";
  ctx.fillText(
    data.busted
      ? `busted on roll ${n}`
      : `${n} ${rollWord} · cashed out`,
    SIZE / 2,
    SIZE / 2 + 250
  );

  // Footer: date bottom-left, watermark bottom-right.
  ctx.fillStyle = "#555550";
  ctx.textBaseline = "alphabetic";
  ctx.font = mono(26);
  ctx.textAlign = "left";
  ctx.fillText(formatDate(data.date), 80, SIZE - 70);
  ctx.textAlign = "right";
  ctx.fillText("crit.you", SIZE - 80, SIZE - 70);

  return canvas;
}

export function dailyCardBlob(data: DailyShareData): Promise<Blob | null> {
  const canvas = renderDailyCard(data);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
