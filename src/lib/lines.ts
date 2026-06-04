// The personality engine. Every roll lands in exactly one category, and each
// die has its own pile of category-keyed commentary written in its own voice.
// Tone target: GLaDOS meets the Duolingo owl. Never cruel, always funny.

import { maxFor, type DieType } from "@/lib/dice";

export type Category = "nat_min" | "low" | "mid" | "high" | "nat_max";

// Per-die value→category ranges. Each die reads its own range differently — the
// angry d4 thinks a 3 is glorious; the haughty d30 thinks a 21 is merely
// "functional" — so the buckets are authored per die rather than from one
// global fraction. `lowMax` is the highest value still counted as "low";
// `midMax` the highest counted as "mid"; anything above midMax (and below the
// die's own max) is "high". value <= 1 is always nat_min; value === max is
// always nat_max.
const RANGES: Record<DieType, { lowMax: number; midMax: number }> = {
  d4: { lowMax: 2, midMax: 2 }, // 1 min · 2 low · 3 high · 4 max  (no true mid)
  d6: { lowMax: 2, midMax: 4 }, // 2 low · 3-4 mid · 5 high
  d8: { lowMax: 3, midMax: 5 }, // 2-3 low · 4-5 mid · 6-7 high
  d10: { lowMax: 3, midMax: 7 }, // 2-3 low · 4-7 mid · 8-9 high
  d12: { lowMax: 4, midMax: 8 }, // 2-4 low · 5-8 mid · 9-11 high
  d20: { lowMax: 5, midMax: 15 }, // 2-5 low · 6-15 mid · 16-19 high
  d30: { lowMax: 8, midMax: 21 }, // 2-8 low · 9-21 mid · 22-29 high
};

export function categoryFor(dieType: DieType, value: number): Category {
  const max = maxFor(dieType);
  if (value <= 1) return "nat_min";
  if (value >= max) return "nat_max";
  const { lowMax, midMax } = RANGES[dieType];
  if (value <= lowMax) return "low";
  if (value <= midMax) return "mid";
  return "high";
}

type Pool = Record<Category, string[]>;

// The house voice — used for any die not yet given its own character (and as a
// safety net). Dry, faintly affectionate, never cruel.
const FALLBACK_LINES: Pool = {
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

// ─── Per-die voices ─────────────────────────────────────────────────────────
// Keyed by die type, then category. A die present here overrides the house
// voice; a die absent here borrows it until its own personality lands.
export const DIE_LINES: Partial<Record<DieType, Pool>> = {
  // ═══ D4 — "The Caltrop" ═══
  // Angry little triangle. Smallest die, biggest attitude — defensive about its
  // 1-to-4 range, passive-aggressive about it, and aware that it hurts to step on.
  d4: {
    nat_min: [
      "One. Out of FOUR. You had a 25% chance and still failed.",
      "I may be small but that roll was smaller.",
      "A one. On a die with FOUR sides. Read that back to yourself.",
      "You stepped on me for THIS? Step on me again, see what happens.",
      "One. I have a quarter of the range and you found the very bottom of it.",
      "I am a weapon, you know. A caltrop. And you just bent my point.",
      "Even I'm offended, and I'm the one with the anger issues.",
      "The smallest number on the smallest die. A masterpiece of failure.",
      "Congratulations. You've achieved the minimum of the minimum.",
    ],
    low: [
      "Two. Mediocre, even by my standards.",
      "I only go to four and you still found a way to disappoint me.",
      "Two. Half of everything I am. Halfway to nothing.",
      "A two. You're rationing your luck on a FOUR-sided die. Bold.",
      "Two. I've seen better, and I've only ever rolled four numbers.",
      "That's a two. I'd be angrier, but I'm saving my energy for stepping duty.",
      "Two out of four. The participation award of a caltrop.",
      "A two. On me — the pointiest die in the bag. Embarrassing for us both.",
    ],
    mid: [
      "There is no middle with me. You get small, or you get smaller.",
      "I don't do 'average.' I do 'sharp' and I do 'disappointing.'",
      "A d4 has no comfortable middle. Neither do I.",
      "Middling? On four sides? You're inventing problems.",
      "I round numbers down out of spite. Keep that in mind.",
      "Caught between my two and my three. Just like your potential.",
      "I contain multitudes. Four of them. This is one of the boring ones.",
      "Somewhere in the middle. For a die my size, that's a rounding error.",
    ],
    high: [
      "Three out of four. I'll allow it.",
      "Not bad. For someone rolling me instead of a real die.",
      "Three. That's basically a crit for a die my size. Don't get used to it.",
      "A three. You're three-quarters of the way to impressing me. Almost.",
      "Three. I'd celebrate, but I have a reputation for menace to maintain.",
      "Look at you, rolling a three. The caltrop is mildly less furious.",
      "Three out of four. The most a disappointment like you deserves.",
      "A solid three. We don't talk about how close that was to a two.",
    ],
    nat_max: [
      "FOUR. That's literally everything I have and you got it.",
      "Maximum damage. You're welcome. Don't forget who did that.",
      "FOUR! The ceiling! MY ceiling! Cherish it — it's all I've got.",
      "A natural four. I gave you one hundred percent and it cost me everything.",
      "Four. Perfect. Now step on me out of respect, not by accident.",
      "MAXIMUM. On four sides that's a 25% miracle, and YOU pulled it off.",
      "Four out of four. The little triangle that could. That's me. Say it.",
      "Critical caltrop. Somewhere a barefoot adventurer just felt a chill.",
    ],
  },
  // ═══ D20 — "The Main Character" ═══
  // The star, and it knows it. Confident, dry, faintly bored by its own
  // importance. The benchmark personality everything else is measured against.
  d20: {
    nat_min: [
      "Natural one. Even I'm embarrassed.",
      "I am the most important die on this table and I just rolled a one.",
      "A natural one. On me. The die they make the movies about.",
      "Twenty sides. You found the worst one. Impressive, in a bleak way.",
      "Every critical roll in the game runs through me, and we get THIS.",
      "I carry this entire hobby and you hand me a one.",
      "The bards will not sing of this. I'll see to it personally.",
      "One. I'd blame the table, but we both know it was you.",
      "This is the take they cut from the highlight reel.",
    ],
    low: [
      "Below average. On the die that's supposed to save you.",
      "I expected more. I always expect more. It's the burden of being me.",
      "Low. But I make low look cinematic.",
      "That's beneath me. Literally and statistically.",
      "A small number from the biggest name in the dice bag. Tragic.",
      "You rolled the protagonist and got a side-quest result.",
      "I'd apologize, but leads don't do that.",
      "Underwhelming. Somehow still more interesting than a d6.",
    ],
    mid: [
      "Adequate. The bare minimum of main-character energy.",
      "A perfectly serviceable number from a perfectly iconic die.",
      "Middle of the road. Even stars have off nights.",
      "Not my finest work, but I make everything look easy.",
      "Average. Don't worry — my reputation can absorb it.",
      "A solid nothing. We'll call it 'restraint.'",
      "Fine. I'm coasting. I've earned the right.",
      "The plot continues. Unremarkably, but it continues.",
    ],
    high: [
      "High. Of course it's high. Have you met me?",
      "Nearly perfect. I was built for exactly this kind of attention.",
      "Strong roll. The crowd was hoping. I delivered. Mostly.",
      "Almost a crit. I like to leave them wanting more.",
      "Respectable. The supporting dice could never.",
      "That's the number that keeps me on the poster.",
      "Big, bold, just shy of legendary. Like a good trailer.",
      "See? This is why every important roll comes through me.",
    ],
    nat_max: [
      "Natural twenty. Was there ever any doubt?",
      "Critical hit. This is why they don't let the d12 handle the important rolls.",
      "Twenty. I'd say I'm surprised, but I'm contractually the hero.",
      "Perfect. Roll credits. I'll be in my velvet case if anyone needs me.",
      "A natural twenty. You're welcome. You're always welcome.",
      "This is the roll they'll talk about. Because I allowed it.",
      "Maximum. Effortless. This is simply what I do.",
      "Critical. Frame it. I do this in my sleep, but frame it anyway.",
      "Twenty out of twenty. The other dice are taking notes.",
    ],
  },
};

// Pick a line for a roll. Deterministic category, random line within it.
export function pickLine(dieType: DieType, value: number): string {
  const cat = categoryFor(dieType, value);
  const pool = DIE_LINES[dieType]?.[cat] ?? FALLBACK_LINES[cat];
  return pool[Math.floor(Math.random() * pool.length)];
}
