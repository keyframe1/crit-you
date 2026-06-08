"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { copyText } from "@/lib/clipboard";
import { analytics } from "@/lib/analytics";
import type { Roll } from "@/lib/dice";

// A low-key secondary affordance for free-play: copy the die's personality line +
// crit.you as plain text. (The static result-card PNG was retired — a picture of a
// number added nothing; the animated roll WebM is the only image worth shipping,
// and that's a separate build.)
export default function ShareCard({ roll }: { roll: Roll | null }) {
  const [toast, setToast] = useState(false);

  const handleCopy = async () => {
    if (!roll) return;
    analytics.shareCopied("free");
    await copyText(`${roll.line}\n\ncrit.you`);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  return (
    <>
      <button
        onClick={handleCopy}
        disabled={!roll}
        aria-label="Copy roll line"
        className="flex items-center gap-1.5 rounded-[20px] px-[14px] py-1.5 text-[13px] font-medium text-[var(--ink)] bg-black/5 hover:bg-black/[0.08] transition-colors duration-200 disabled:opacity-30 disabled:bg-black/5 disabled:cursor-default"
      >
        <Copy size={15} strokeWidth={2} />
        <span className="hidden sm:inline tracking-wide">Copy</span>
      </button>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 font-mono text-[12px] tracking-wide px-4 py-2 rounded-lg text-[var(--ink)]"
            style={{
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}
          >
            Copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
