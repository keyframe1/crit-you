"use client";

import { useEffect, useState } from "react";

// Tracks the user's `prefers-reduced-motion` setting (mirrors the matchMedia
// pattern DiceSelector uses for its breakpoint). Returns false during SSR and
// until the first effect runs, so the default is full motion. Used by the GSAP/
// WebGL animations (the swap transition + the weighty landing settle), which the
// CSS `prefers-reduced-motion` block can't reach.
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduce;
}
