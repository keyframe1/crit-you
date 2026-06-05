"use client";

import { useSyncExternalStore } from "react";
import {
  getSoundServerSnapshot,
  getSoundSnapshot,
  subscribeSound,
  toggleSound,
} from "@/lib/sound";

// The control behind the chiptune engine: a speaker that mutes/unmutes the whole
// sound feature. State lives in lib/sound (localStorage `crit:sound:v1`, default
// OFF — sound is opt-in) and is read through useSyncExternalStore so the server
// and the first client paint agree (no hydration flash), then the real stored
// value settles in.
//
// The icon is inline SVG — like the wordmark die — so it carries no icon-pack
// dependency. Clicking toggles AND primes the AudioContext (toggleSound → set
// SoundEnabled(true) → primeAudio), so enabling sound during the gesture unlocks
// audio immediately under the browser's autoplay policy.
export default function SoundToggle({ size = 16 }: { size?: number }) {
  const on = useSyncExternalStore(
    subscribeSound,
    getSoundSnapshot,
    getSoundServerSnapshot
  );

  return (
    <button
      onClick={() => toggleSound()}
      aria-label={on ? "Mute sound" : "Unmute sound"}
      aria-pressed={on}
      title={on ? "Sound on" : "Sound off"}
      className="flex items-center justify-center rounded-full p-2 -m-0.5 text-[var(--mid)] hover:text-[var(--ink)] transition-colors duration-200"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Speaker body — common to both states. */}
        <path d="M11 5 6 9H2v6h4l5 4z" />
        {on ? (
          // Sound waves.
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          // Muted — an X where the waves were.
          <>
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </>
        )}
      </svg>
    </button>
  );
}
