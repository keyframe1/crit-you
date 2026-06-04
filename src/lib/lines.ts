// The personality engine. Every roll lands in exactly one category, and each
// category has its own pile of dry, faintly affectionate commentary.
// Tone target: GLaDOS meets the Duolingo owl. Never cruel, always funny.

export type Category = "nat_min" | "low" | "mid" | "high" | "nat_max";

// value === 1  → nat_min   (the lowest a die can do)
// value === max → nat_max  (perfection)
// otherwise bucketed by fraction of the range, with 1 already claimed above.
export function categoryFor(value: number, max: number): Category {
  if (value <= 1) return "nat_min";
  if (value >= max) return "nat_max";
  const fraction = value / max;
  if (fraction <= 0.25) return "low";
  if (fraction >= 0.75) return "high";
  return "mid";
}

export const LINES: Record<Category, string[]> = {
  nat_min: [
    "Incredible. You found a new low.",
    "The die considered your feelings and then chose violence.",
    "Have you considered a different hobby?",
    "A one. Bold. Wrong, but bold.",
    "Statistically possible. Spiritually devastating.",
    "The die has spoken, and it said 'no.'",
    "That's not a roll, that's a cry for help.",
    "Rock bottom called. You're subletting.",
    "I would say it can't get worse, but I don't want to lie to you.",
    "Flawless execution of complete failure.",
    "Even gravity is embarrassed for you.",
    "You rolled. The universe declined.",
  ],
  low: [
    "Below average, but you wear it well.",
    "A modest result for a modest soul.",
    "Not the floor. Adjacent to the floor.",
    "Effort: noted. Outcome: regrettable.",
    "The die is rationing your luck.",
    "Small number, big disappointment.",
    "You're building character. Slowly.",
    "Technically a number. Barely a result.",
    "Low, but with potential. Unrealized potential.",
    "That'll do almost nothing, nicely.",
    "A gentle reminder that hope is not a strategy.",
    "Could be worse. Was, earlier. Probably will be again.",
  ],
  mid: [
    "Aggressively average.",
    "The beige of dice rolls.",
    "Not great, not terrible. Just... there.",
    "A perfectly cromulent result.",
    "The participation trophy of numbers.",
    "Right down the middle. How brave.",
    "Neither a triumph nor a tragedy. A Tuesday.",
    "You have achieved adequacy.",
    "Mediocrity, but make it confident.",
    "The roll equivalent of a shrug.",
    "Solidly fine. Devastatingly fine.",
    "It's a number. It exists. We move on.",
    "Comfortably forgettable.",
  ],
  high: [
    "Ooh, look at you. Almost.",
    "So close to greatness you can taste it.",
    "High roller. Not the highest, but we don't gatekeep.",
    "Respectable. The die is mildly impressed.",
    "Strong. Borderline competent, even.",
    "That's a good number and you should feel good.",
    "Nearly perfect, which is just perfect's understudy.",
    "Excellent work. The bar was low, but still.",
    "You're peaking. Enjoy it before regression to the mean.",
    "Big number energy.",
    "The die respects the hustle.",
    "Just shy of bragging rights, but go ahead and brag.",
  ],
  nat_max: [
    "Perfect. I hate you a little.",
    "The table erupts. You peaked. It's downhill from here.",
    "Critical hit. You're welcome.",
    "Maximum value. Minimum humility, going forward.",
    "Flawless. Now do it again. You won't.",
    "The die has chosen you. Briefly. Don't get attached.",
    "Absolute unit of a roll.",
    "Screenshot it. No one will believe you.",
    "Perfection. Frame it. Touch grass after.",
    "The dice gods are watching, and they approve.",
    "You rolled the ceiling. The ceiling rolled back.",
    "Nailed it. Statistically, this is your apology in advance for next time.",
  ],
};

// Pick a line for a roll. Deterministic category, random line within it.
export function pickLine(value: number, max: number): string {
  const pool = LINES[categoryFor(value, max)];
  return pool[Math.floor(Math.random() * pool.length)];
}
