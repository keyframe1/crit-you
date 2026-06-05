"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { Share2, Copy, Flame, X } from "lucide-react";
import {
  CAP,
  gameReducer,
  initialGameState,
  getDailyDie,
  getDailySequence,
  ymdUTC,
  score,
  evOfRoll,
  breakEvenTotal,
  avgSurvivor,
} from "@/lib/daily";
import {
  maxFor,
  labelFor,
  animFor,
  SHAPES,
  type DieType,
  type Roll,
} from "@/lib/dice";
import { pickDailyLine } from "@/lib/dailyLines";
import {
  hasPlayedToday,
  getTodayResult,
  recordResult,
  getStreakInfo,
} from "@/lib/dailyStore";
import { buildDailyShareText, outcomeFor } from "@/lib/dailyShare";
import { copyText } from "@/lib/clipboard";
import type { DailyControl } from "@/components/dice3d/dailyControl";
import ResultNumber from "@/components/ResultNumber";
import Personality from "@/components/Personality";

// The 3D stage is client-only + heavy; code-split it exactly like the main page.
const DiceCanvas = dynamic(() => import("@/components/DiceCanvas"), {
  ssr: false,
});

interface Props {
  onClose: () => void;
}

// ─── Small reusable bits ─────────────────────────────────────────────────────

// A tiny wireframe die glyph (reuses SHAPES) for the per-roll history row.
function DieGlyph({ die, dim }: { die: DieType; dim?: boolean }) {
  const shape = SHAPES[die];
  const color = animFor(die).color;
  return (
    <svg
      viewBox="0 0 160 160"
      className="h-full w-full"
      style={{ overflow: "visible", opacity: dim ? 0.5 : 1 }}
      aria-hidden
    >
      {shape.fills.map((f, i) => (
        <polygon
          key={`f${i}`}
          points={f.points}
          fill={color}
          fillOpacity={f.opacity}
          stroke="none"
        />
      ))}
      {shape.wireLines.map(([x1, y1, x2, y2], i) => (
        <line
          key={`w${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#1a1a18"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      <polygon
        points={shape.outline}
        fill="none"
        stroke="#1a1a18"
        strokeWidth={4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The CAP-slot run history: a filled glyph per roll (a 💥 on the busting roll),
// faint empty slots for the rolls not yet taken. Shows the running shape of the
// run; the cap is implied by the total slot count.
function RunRow({
  die,
  rolls,
  busted,
}: {
  die: DieType;
  rolls: number[];
  busted: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {Array.from({ length: CAP }).map((_, i) => {
        const filled = i < rolls.length;
        const isBust = busted && i === rolls.length - 1;
        return (
          <div
            key={i}
            className="flex items-center justify-center rounded-md"
            style={{
              width: 26,
              height: 26,
              border: filled
                ? "1px solid transparent"
                : "1px dashed rgba(0,0,0,0.14)",
              background: filled ? "rgba(0,0,0,0.03)" : "transparent",
            }}
          >
            {filled ? (
              isBust ? (
                <span className="text-[15px] leading-none">💥</span>
              ) : (
                <div className="h-[20px] w-[20px]">
                  <DieGlyph die={die} />
                </div>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function msUntilNextUTCDay(d: Date): number {
  const next = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1
  );
  return Math.max(0, next - d.getTime());
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

// Live ticking countdown to the next UTC daily.
function Countdown() {
  const [ms, setMs] = useState(() => msUntilNextUTCDay(new Date()));
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilNextUTCDay(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-[var(--mid)]">
      Next daily in{" "}
      <span className="text-[var(--ink)] tabular-nums">{fmtDuration(ms)}</span>
    </p>
  );
}

// The daily share: a copyable, spoiler-light TEXT grid (Discord-first). Copy is
// the primary, universally-supported action so it never greys out; a native
// TEXT-share is offered as a secondary where the platform supports it. No images,
// no markdown. (This whole modal is client-only — dynamic ssr:false — so a
// render-time capability check is hydration-safe.)
function DailyShareButton({ text }: { text: string }) {
  const [toast, setToast] = useState(false);
  const ping = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2200);
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleCopy = async () => {
    await copyText(text);
    ping();
  };

  const handleShare = async () => {
    // Feature-detect at click; fall back to a copy if the sheet isn't there.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch {
        return; // user dismissed the sheet
      }
    }
    await copyText(text);
    ping();
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
      >
        <Copy size={16} strokeWidth={2} />
        Copy result
      </button>
      {canNativeShare && (
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-full border border-[var(--ink)]/15 bg-black/[0.03] px-4 py-2.5 text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-black/[0.06]"
        >
          <Share2 size={15} strokeWidth={2} />
          Share…
        </button>
      )}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-1.5 font-mono text-[11px] tracking-wide text-[var(--ink)]"
            style={{
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}
          >
            Copied — paste it in Discord.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The odds + EV readout with a "show the math" expander.
function OddsReadout({
  faces,
  decisionTotal,
}: {
  faces: number;
  decisionTotal: number | null;
}) {
  const [open, setOpen] = useState(false);
  const pct = (100 / faces).toFixed(1);
  const s2 = breakEvenTotal(faces);
  const avg = avgSurvivor(faces);
  const ev = decisionTotal != null ? evOfRoll(faces, decisionTotal) : null;

  return (
    <div className="w-full rounded-xl bg-black/[0.03] px-4 py-3 text-left">
      <p className="font-mono text-[12px] leading-relaxed text-[var(--mid)]">
        <span className="text-[var(--ink)]">P(bust)</span> = 1/{faces} ({pct}%)
        {ev != null && (
          <>
            {" · "}
            <span className="text-[var(--ink)]">next-roll EV</span>{" "}
            <span
              className="tabular-nums"
              style={{ color: ev >= 0 ? "#27ae60" : "#c0392b" }}
            >
              {ev >= 0 ? "+" : ""}
              {ev.toFixed(1)}
            </span>{" "}
            — math said {ev >= 0 ? "push" : "bank"}.
          </>
        )}
      </p>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-1 font-mono text-[11px] tracking-wide text-[var(--accent)] hover:underline"
        aria-expanded={open}
      >
        {open ? "hide the math" : "show the math"}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed text-[var(--mid)]">
              <li>• {faces} faces — only the lone 1 busts you.</li>
              <li>
                • Survive ({faces - 1}/{faces}): gain 2–{faces}, average +
                {avg.toFixed(1)}.
              </li>
              <li>
                • EV(roll) = (S₂ − total) / {faces}, S₂ = 2+…+{faces} = {s2}.
              </li>
              <li>
                • Break-even total = {s2}. Below it, pushing is +EV; above it,
                bank.
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── The modal ───────────────────────────────────────────────────────────────

export default function DailyCrit({ onClose }: Props) {
  const reduce = useReducedMotion();

  // Pin "now" for this run so the seed, die, and date stay stable across renders.
  const now = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => ymdUTC(now), [now]);
  const die = useMemo(() => getDailyDie(now), [now]);
  const faces = maxFor(die);
  const sequence = useMemo(() => getDailySequence(now, die), [now, die]);

  // Already-played check is taken once on open — the scarcity gate.
  const priorResult = useMemo(
    () => (hasPlayedToday(todayYmd) ? getTodayResult(todayYmd) : null),
    [todayYmd]
  );
  const readOnly = priorResult !== null;

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    [now]
  );

  // ── Game state ──
  const [game, dispatch] = useReducer(gameReducer, initialGameState);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  });

  const [rollNonce, setRollNonce] = useState(0);
  const [celebrateSignal, setCelebrateSignal] = useState(0);
  const [rolling, setRolling] = useState(false);
  const rollingRef = useRef(false);
  const pendingValueRef = useRef(0);

  // Result number + personality bubble (reused from the main app).
  const [roll, setRoll] = useState<Roll | null>(null);
  const [numberVisible, setNumberVisible] = useState(false);
  const idRef = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Finish bookkeeping.
  const recordedRef = useRef(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [streakNow, setStreakNow] = useState<number | null>(null);

  // The forced value the die must land on, exposed to the 3D die via context.
  const getRollValue = useCallback(() => pendingValueRef.current, []);
  const control = useMemo<DailyControl>(
    () => ({ getRollValue, celebrateSignal }),
    [getRollValue, celebrateSignal]
  );

  const handleRollStart = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setNumberVisible(false);
  }, []);

  // Fired when the die lands on its (forced) value: commit to the reducer, raise
  // the result number, and set the decision-snark bubble.
  const handleResult = useCallback(
    (value: number) => {
      const busted = value === 1;
      const rollNumber = gameRef.current.rollCount + 1;
      const line = pickDailyLine(
        busted
          ? { kind: "bust", rollCount: rollNumber }
          : { kind: "roll", rollNumber, cap: CAP }
      );
      setRoll({ id: ++idRef.current, value, max: faces, dieType: die, line });
      setNumberVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setNumberVisible(false), 2150);

      dispatch({ type: "ROLL", value });
      rollingRef.current = false;
      setRolling(false);
    },
    [die, faces]
  );

  const handleRoll = useCallback(() => {
    const g = gameRef.current;
    if (rollingRef.current || g.status !== "idle" || g.rollCount >= CAP) return;
    pendingValueRef.current = sequence[g.rollCount];
    rollingRef.current = true;
    setRolling(true);
    setRollNonce((n) => n + 1);
  }, [sequence]);

  const handleBank = useCallback(() => {
    const g = gameRef.current;
    if (rollingRef.current || g.status !== "idle" || g.rollCount < 1) return;
    const line = pickDailyLine({ kind: "bank", rollCount: g.rollCount });
    // Bank shows the snark bubble but no number flash.
    setRoll((prev) => ({
      id: ++idRef.current,
      value: prev?.value ?? 0,
      max: faces,
      dieType: die,
      line,
    }));
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setNumberVisible(false);
    dispatch({ type: "BANK" });
    setCelebrateSignal((s) => s + 1); // the die celebrates the cash-out
  }, [die, faces]);

  // Record the finished run exactly once, then reveal the results panel after the
  // die's reaction has had a beat to play.
  useEffect(() => {
    if (readOnly || game.status === "idle" || recordedRef.current) return;
    recordedRef.current = true;
    const busted = game.status === "busted";
    const updated = recordResult({
      date: todayYmd,
      dieType: die,
      score: score(game),
      rollCount: game.rolls.length,
      busted,
    });
    setStreakNow(updated.currentStreak);
    const t = setTimeout(() => setResultsVisible(true), reduce ? 0 : 850);
    return () => clearTimeout(t);
  }, [readOnly, game, todayYmd, die, reduce]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  // ── Modal plumbing: body scroll lock, focus trap, ESC, restore focus ──
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];

    (focusables()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);

  // Outcome derived for the finish / read-only panels.
  const finished = readOnly || game.status !== "idle";
  const busted = readOnly ? priorResult!.busted : game.status === "busted";
  const finalScore = readOnly ? priorResult!.score : score(game);
  const runRolls = readOnly
    ? // Reconstruct a spoiler-safe placeholder row for the read-only view: we
      // never stored the values (and don't want them), so render neutral filled
      // slots — a busting final slot if it busted.
      Array.from({ length: priorResult!.rollCount }, (_, i) =>
        busted && i === priorResult!.rollCount - 1 ? 1 : 2
      )
    : game.rolls;
  const rollCountForShare = readOnly
    ? priorResult!.rollCount
    : game.rolls.length;
  // The total at the last decision point — for the EV readout. On a bust it's
  // the pre-bust total; banked, it's the banked total. (Unknown in read-only.)
  const decisionTotal = readOnly ? null : game.total;

  // The spoiler-light text grid for sharing. Streak resolves to the just-recorded
  // value during a fresh run, or the stored value in the read-only view.
  const shareStreak = streakNow ?? getStreakInfo().currentStreak;
  const shareText = buildDailyShareText({
    date: now,
    faces,
    rollCount: Math.max(1, rollCountForShare),
    outcome: outcomeFor(busted, rollCountForShare),
    score: finalScore,
    streak: shareStreak,
  });

  const showResultsPanel = readOnly || (finished && resultsVisible);
  const atCap = game.rollCount >= CAP;
  const liveEv = evOfRoll(faces, game.total);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — bottom sheet on mobile, centred card on desktop. */}
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Daily Crit"
        tabIndex={-1}
        initial={
          reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: reduce ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex max-h-[94dvh] w-full flex-col overflow-y-auto rounded-t-3xl bg-[var(--bg)] px-5 pb-7 pt-5 outline-none sm:w-[440px] sm:max-w-[92vw] sm:rounded-3xl"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--ink)]">
              Daily
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--mid)]">
              {labelFor(die)} · {dateLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close daily"
            className="-m-2 rounded-full p-2 text-[var(--mid)] hover:text-[var(--ink)] transition-colors"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Die stage — relative so the bubble + number overlay anchor to it. */}
        <div className="relative mt-1 flex flex-col items-center justify-center">
          <div className="pointer-events-none absolute top-0 left-1/2 z-10 flex w-full -translate-x-1/2 justify-center px-2">
            <Personality roll={roll} />
          </div>
          <DiceCanvas
            dieType={die}
            onRoll={handleResult}
            onRollStart={handleRollStart}
            rollNonce={readOnly ? undefined : rollNonce}
            interactive={false}
            control={readOnly ? undefined : control}
            size="clamp(200px, 44vmin, 300px)"
          />
          <ResultNumber roll={roll} visible={numberVisible} />
        </div>

        {/* Running total (during play) or final score (finished). */}
        {!showResultsPanel ? (
          <div className="-mt-2 flex flex-col items-center gap-3">
            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--mid)]">
                Total
              </p>
              <p className="font-sans text-[44px] font-black leading-none tabular-nums text-[var(--ink)]">
                {game.total}
              </p>
            </div>

            <RunRow die={die} rolls={game.rolls} busted={busted} />

            {/* Decision-point EV hint, once a roll is on the board. */}
            {game.status === "idle" && game.rollCount >= 1 && !atCap && (
              <p className="font-mono text-[11px] text-[var(--mid)]">
                1-in-{faces} bust · risking{" "}
                <span className="text-[var(--ink)] tabular-nums">
                  {game.total}
                </span>{" "}
                ·{" "}
                <span
                  className="tabular-nums"
                  style={{ color: liveEv >= 0 ? "#27ae60" : "#c0392b" }}
                >
                  EV {liveEv >= 0 ? "+" : ""}
                  {liveEv.toFixed(1)}
                </span>
              </p>
            )}

            {/* Controls */}
            <div className="mt-1 flex w-full items-center justify-center gap-3">
              {game.rollCount === 0 ? (
                <button
                  onClick={handleRoll}
                  disabled={rolling}
                  className="rounded-full bg-[var(--accent)] px-10 py-3 text-[16px] font-bold uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Roll
                </button>
              ) : atCap ? (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleBank}
                    disabled={rolling}
                    className="rounded-full bg-[var(--accent)] px-10 py-3 text-[16px] font-bold uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Bank {game.total}
                  </button>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mid)]">
                    Max rolls — cash it in
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleBank}
                    disabled={rolling}
                    className="rounded-full border border-[var(--ink)]/15 bg-black/[0.03] px-7 py-3 text-[15px] font-bold uppercase tracking-[0.08em] text-[var(--ink)] transition-colors hover:bg-black/[0.06] disabled:opacity-40"
                  >
                    Bank {game.total}
                  </button>
                  <button
                    onClick={handleRoll}
                    disabled={rolling}
                    className="rounded-full bg-[var(--accent)] px-7 py-3 text-[15px] font-bold uppercase tracking-[0.08em] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Roll again
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          // ── Finish / read-only results panel ──
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="-mt-2 flex flex-col items-center gap-4"
          >
            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--mid)]">
                {busted ? "Busted" : "Banked"}
              </p>
              <p
                className="font-sans text-[52px] font-black leading-none tabular-nums"
                style={{ color: busted ? "var(--mid)" : "var(--ink)" }}
              >
                {finalScore}
              </p>
            </div>

            <RunRow die={die} rolls={runRolls} busted={busted} />

            <OddsReadout faces={faces} decisionTotal={decisionTotal} />

            {/* Streak */}
            <div className="flex items-center gap-2">
              <Flame
                size={16}
                strokeWidth={2}
                style={{ color: busted ? "var(--light)" : "var(--accent)" }}
              />
              <span className="font-mono text-[12px] text-[var(--ink)]">
                {(() => {
                  const s = streakNow ?? getStreakInfo().currentStreak;
                  return s > 0
                    ? `${s}-day streak`
                    : busted
                    ? "Streak reset"
                    : "No streak yet";
                })()}
              </span>
            </div>

            <DailyShareButton text={shareText} />

            {readOnly && (
              <p className="text-center font-mono text-[11px] leading-relaxed text-[var(--mid)]">
                You&apos;ve played today. One run per day — that&apos;s the
                point.
              </p>
            )}

            <Countdown />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
