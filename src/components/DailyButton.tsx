"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { getStreakInfo, hasPlayedToday } from "@/lib/dailyStore";

// The daily modal is heavy (it pulls in the 3D stage), so it's code-split and
// only loaded when the pill is first opened.
const DailyCrit = dynamic(() => import("@/components/DailyCrit"), {
  ssr: false,
});

// ── A tiny external store over the daily localStorage record ──
// useSyncExternalStore reads client-only state without an SSR hydration mismatch
// (server uses the snapshot below; the client re-reads after hydration). We
// notify manually after a run records, since same-tab writes don't fire the
// cross-tab "storage" event.
const listeners = new Set<() => void>();
function notifyDailyChange() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
// Snapshot is a primitive string ("<streak>|<played>") so equal values compare
// equal (Object.is) and never loop.
function getSnapshot(): string {
  return `${getStreakInfo().currentStreak}|${hasPlayedToday() ? 1 : 0}`;
}
// Server default: no streak, treat as played (no attention dot) until the client
// reads the real record.
function getServerSnapshot(): string {
  return "0|1";
}

// The entry point in the top controls: a "Daily" pill that shows a flame + streak
// count once a streak is going, and a small dot when today's run is still
// unplayed. Opening it mounts the daily takeover.
export default function DailyButton() {
  const [open, setOpen] = useState(false);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [streakStr, playedStr] = snap.split("|");
  const streak = Number(streakStr);
  const played = playedStr === "1";

  // Deep link: arriving at crit.you/?daily=1 (a shared result link) opens the
  // Daily straight away, so the recipient lands IN today's game rather than
  // free-play. Done in a post-mount effect (not initial state) so the server and
  // client hydrate identically; the param is then stripped so refreshes and
  // back-nav don't keep re-opening it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("daily") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot deep-link open after hydration
    setOpen(true);
    params.delete("daily");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
    );
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    notifyDailyChange(); // a run may have changed the streak / played state
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Daily Crit"
        className="relative flex items-center gap-1.5 rounded-[20px] px-[14px] py-1.5 text-[13px] font-medium text-[var(--ink)] bg-black/5 hover:bg-black/[0.08] transition-colors duration-200"
      >
        {streak > 0 ? (
          <>
            <Flame size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
            <span className="tabular-nums tracking-wide">{streak}</span>
          </>
        ) : (
          <span className="tracking-wide">Daily</span>
        )}
        {/* Unplayed indicator: a small accent dot when today's run is available. */}
        {!played && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
            style={{ background: "var(--accent)" }}
          />
        )}
      </button>

      <AnimatePresence>
        {open && <DailyCrit onClose={handleClose} />}
      </AnimatePresence>
    </>
  );
}
