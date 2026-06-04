// The daily die's running commentary. Unlike lib/lines.ts (which reacts to a
// roll's VALUE), these react to the player's DECISIONS in the press-your-luck
// run — pushing deeper, banking early or late, or busting. Same house voice:
// GLaDOS meets the Duolingo owl. Snarky, never cruel.

export type DailyEvent =
  | { kind: "roll"; rollNumber: number; cap: number } // a surviving roll
  | { kind: "bank"; rollCount: number } // cashed out after N rolls
  | { kind: "bust"; rollCount: number }; // hit the 1

// Push commentary, bucketed by how deep the run is. Greed escalates; so does the
// die's alarm.
const PUSH_SHALLOW = [
  "Warming up, are we?",
  "One roll. Bold start. Don't get cocky.",
  "A respectable beginning. Now quit while you're behind.",
  "Off we go. The cliff is that way.",
  "Sure. Push your luck. What could go wrong.",
];
const PUSH_MID = [
  "Greedy. I like it. I worry about it, but I like it.",
  "Still here? Interesting choices being made.",
  "The pot grows. So does the risk. Math is funny that way.",
  "You're building something. Probably a cautionary tale.",
  "Tempting fate, one roll at a time. Classic.",
];
const PUSH_DEEP = [
  "This is reckless. Continue.",
  "We're deep now. The 1 can smell fear.",
  "I'd say bank it, but you clearly don't listen.",
  "Every roll from here is a dare to the universe.",
  "Heroic. Or stupid. History will decide.",
];
const PUSH_RECKLESS = [
  "Unhinged. Genuinely unhinged.",
  "You're not even rolling anymore. You're negotiating with chaos.",
  "The cap is right there. So is the abyss.",
  "Respect, you absolute maniac. Don't blow it now.",
  "One more? You have a problem. I admire it.",
];

// Banking. The earlier you fold, the more the die judges you.
const BANK_EARLY = [
  "Coward.",
  "Banked already? The die is unimpressed.",
  "Playing it safe. How thrilling for everyone.",
  "A cautious soul. Yawn.",
  "You folded. The pot was just getting warm.",
];
const BANK_MID = [
  "Sensible. Boringly sensible.",
  "A measured exit. The accountants approve.",
  "Banked. Not greedy, not brave — just fine.",
  "You took the money. Reasonable. Forgettable.",
  "A clean getaway. Adequate.",
];
const BANK_DEEP = [
  "Respect. You pushed and you walked.",
  "Now THAT is how you read a table. Banked like a legend.",
  "Deep run, clean exit. The die salutes you.",
  "You stared down the 1 and took the cash. Magnificent.",
  "Greed AND discipline. Rare. Banked beautifully.",
];

const BUST = [
  "A one. After all that. Devastating.",
  "The 1. The whole run, gone. I'm so sorry. (I'm not.)",
  "Busted. Everything you built, returned to dust.",
  "And there it is. Zero. The press-your-luck classic.",
  "You pushed. The 1 pushed back. Harder.",
  "Greed has a price. The price is everything.",
  "Catastrophic. A masterclass in not stopping.",
  "The die giveth, and the die just took it ALL back.",
];

// Per-(kind/bucket) recent-index memory so a line never repeats back-to-back.
const history: Record<string, number[]> = {};
const HISTORY_LEN = 4;

function pick(key: string, pool: string[]): string {
  const hist = (history[key] ??= []);
  let avail = pool.map((_, i) => i).filter((i) => !hist.includes(i));
  if (avail.length === 0) {
    hist.length = 0;
    avail = pool.map((_, i) => i);
  }
  const chosen = avail[Math.floor(Math.random() * avail.length)];
  hist.push(chosen);
  if (hist.length > HISTORY_LEN) hist.shift();
  return pool[chosen];
}

export function pickDailyLine(e: DailyEvent): string {
  if (e.kind === "bust") return pick("bust", BUST);

  if (e.kind === "bank") {
    if (e.rollCount <= 2) return pick("bank-early", BANK_EARLY);
    if (e.rollCount <= 4) return pick("bank-mid", BANK_MID);
    return pick("bank-deep", BANK_DEEP);
  }

  // A surviving roll — escalate snark with depth toward the cap.
  if (e.rollNumber <= 1) return pick("push-shallow", PUSH_SHALLOW);
  if (e.rollNumber <= 3) return pick("push-mid", PUSH_MID);
  if (e.rollNumber <= 5) return pick("push-deep", PUSH_DEEP);
  return pick("push-reckless", PUSH_RECKLESS);
}
