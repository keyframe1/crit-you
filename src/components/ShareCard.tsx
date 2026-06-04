"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { shareCardBlob } from "@/lib/share";
import type { Roll } from "@/lib/dice";

// The top-right share button. Renders the current roll to a 1080×1080 card and
// shares it via the native share sheet (mobile) or copies it to the clipboard
// (desktop), with a download as a last resort.
export default function ShareCard({ roll }: { roll: Roll | null }) {
  const [toast, setToast] = useState(false);

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  const handleShare = async () => {
    if (!roll) return;
    const blob = await shareCardBlob(roll);
    if (!blob) return;
    const file = new File([blob], "crit.png", { type: "image/png" });

    // Native share (mobile), if it can handle files.
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title: "Crit", text: roll.line });
        return;
      } catch {
        // User dismissed the share sheet — nothing more to do.
        return;
      }
    }

    // Desktop fallback: copy the image to the clipboard.
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      showToast();
      return;
    } catch {
      // Last resort: download the PNG.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "crit.png";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <button
        onClick={handleShare}
        disabled={!roll}
        aria-label="Share roll"
        className="p-2 -m-2 text-[var(--light)] hover:text-[var(--accent)] transition-colors duration-200 disabled:opacity-25 disabled:hover:text-[var(--light)]"
      >
        <Share2 size={18} strokeWidth={1.75} />
      </button>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 font-mono text-[12px] tracking-wide px-4 py-2 rounded-lg bg-[#161614] text-[var(--light)] border border-white/10 shadow-lg"
          >
            Copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
