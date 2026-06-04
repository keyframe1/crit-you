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
  // ═══ D6 — "The Basic" ═══
  // The most-rolled die in history, and it has made peace with that. Dry,
  // understated, reliable, never exciting — the accountant of the dice bag.
  d6: {
    nat_min: [
      "One. Predictable.",
      "I've been in every board game ever made and I still can't save you.",
      "A one. From the most-rolled die in history. Statistically, you were due.",
      "One. I'd act surprised, but I'm a d6. We don't emote.",
      "The lowest I go. You'll see it again. You always do.",
      "One. Filed under 'expected losses.'",
      "I'm in Monopoly, Yahtzee, and Risk. None of it prepared me for you.",
      "A one. The cube abides. The cube is, quietly, disappointed.",
      "One. No notes. No surprises. No luck.",
    ],
    low: [
      "Two. You could've stayed home and rolled a coin.",
      "This is why people don't write songs about d6s.",
      "Two. The ledger reads: insufficient.",
      "A two. I've delivered billions of rolls. This is, regrettably, one.",
      "Two. Reliable — in the sense that it reliably isn't enough.",
      "Snake eyes' lonelier cousin. Just the one eye.",
      "Two. I don't get excited. This is, in part, why.",
      "A two. Balanced books, unbalanced luck.",
    ],
    mid: [
      "Adequate.",
      "Three. The speed limit of dice rolls.",
      "Four. I have delivered the median experience.",
      "Right down the middle. Where I live. Where I've always lived.",
      "A perfectly serviceable number. I specialize in those.",
      "This is the roll equivalent of a beige sedan. It runs.",
      "Square die, square result. We're nothing if not consistent.",
      "Four. The most exciting thing about it is that it isn't a three.",
    ],
    high: [
      "Five. I nearly gave you everything. Nearly.",
      "You're one away. Story of your life, probably.",
      "Five. A strong showing, for a die that doesn't show off.",
      "Almost the whole cube. I rounded down on the drama, as usual.",
      "Five out of six. The accountant permits a small, dry smile.",
      "A five. Don't make it weird. I certainly won't.",
      "Five. Solid. Dependable. One short of a story.",
      "A five — the d6 equivalent of a standing ovation. Held internally.",
    ],
    nat_max: [
      "Six. Not glamorous, but correct.",
      "Maximum. I won't make a scene about it. One of us should have standards.",
      "Six. The cube has spoken, and it spoke well. Quietly.",
      "A natural six. I'd celebrate, but I have a board game to be in at seven.",
      "Six out of six. Books balanced, maximum achieved. Moving on.",
      "There it is. The whole cube. Don't expect a parade.",
      "Six. Even my best is understated. That's the brand.",
      "Maximum value, minimum fuss. You're welcome, in a measured way.",
    ],
  },
  // ═══ D8 — "The Middle Child" ═══
  // Overlooked and insecure, eager to please, tries way too hard. Not as popular
  // as the d6, not as dramatic as the d12, not the star like the d20.
  d8: {
    nat_min: [
      "One. Sorry. I'm trying.",
      "Please don't put me back in the bag.",
      "One. I had one job and I — I know. I know. I'll do better.",
      "Is this why nobody picks me? It's this, isn't it.",
      "A one. Don't tell the d20. Please don't tell the d20.",
      "I panicked. I always panic. I'm sorry — can we just try again?",
      "One. I only wanted you to be proud of me.",
      "That was bad. That was really bad. I felt it leave your hand wrong.",
      "One. Was it me? It's always me.",
    ],
    low: [
      "I know that's not great. Do you want to roll again? You can roll again.",
      "I can do better. Give me another chance.",
      "A three. Okay. Okay. Not my best. We can build on this. Can we?",
      "Two. I saw your face. I'll remember that face. I'll fix it.",
      "That's low, I know it's low, please don't switch to the d6.",
      "I'm warming up! Dice warm up, right? Tell me dice warm up.",
      "Three. Do you... did you need a three for anything? Maybe you needed a three.",
      "Low again. I write these down, you know. I keep track of my failures.",
    ],
    mid: [
      "Is that okay? I can't tell if that's okay.",
      "Five. That's... that's fine, right? Right?",
      "Four. Middle of the road. I'm middle of everything. It's kind of my thing.",
      "A five. Did that help? Tell me that helped. Even a little.",
      "Right in the middle! That's where I shine! ...is it? Is that where I shine?",
      "Four. Not bad! Not bad, right? You're nodding. Why aren't you nodding?",
      "Five. See, I CAN be average. I worked really hard to be average.",
      "A solid mid roll. I practiced. I actually practiced for this.",
    ],
    high: [
      "Seven! See? I'm useful! I told you I was useful!",
      "That's almost my max. I'm almost impressive.",
      "Six! SIX! Did the d6 ever give you a six AND have room to spare? No!",
      "Seven out of eight. I'm SO close to mattering. So close.",
      "A six! Write that down! No, actually write it down, I want a record.",
      "Seven! Tell the d20 I said hi. Tell it I did a seven. Casually.",
      "Look at me go! Six! I'm having a moment — let me have this!",
      "Seven. That's basically a crit for me. Right? That's basically perfect, RIGHT?",
    ],
    nat_max: [
      "EIGHT! Did you see that? Did everyone see that?",
      "I DID IT. Screenshot this. Tell the other dice.",
      "EIGHT! My maximum! The whole octahedron! I'm SOMEBODY!",
      "Natural eight! Put me on the shelf! The GOOD shelf! Next to the d20!",
      "EIGHT OUT OF EIGHT! Is this what the d20 feels like ALL the time?!",
      "I peaked! This is my peak and I'm SO happy about it, don't ruin this!",
      "EIGHT! Frame me! Frame me right now! I'll hold still!",
      "Maximum! Did it count? It counted, right? Tell me it counted!",
    ],
  },
  // ═══ D10 — "The Statistician" ═══
  // Obsessed with probability, talks in percentages, technically precise and a
  // little condescending about math. The nerdiest die in a hobby full of nerds.
  d10: {
    nat_min: [
      "One. A 10% probability. Statistically unremarkable.",
      "Bottom decile. Fascinating sample.",
      "One. The expected value was 5.5. You've rounded yourself down out of spite.",
      "A one. A one-in-ten event, and you collapsed the waveform onto it.",
      "First percentile. I'd rerun it, but the numbers are clear and the numbers are sad.",
      "One. Within probability, technically. Outside the realm of dignity.",
      "You've produced the minimum. The variance on your competence is concerning.",
      "A one. I'm not disappointed — I'm a number generator — but the data is bleak.",
      "One out of ten. A perfectly valid data point. A perfectly tragic one.",
    ],
    low: [
      "You're performing below the expected value of 5.5.",
      "Third percentile. Suboptimal.",
      "A two. That's roughly 1.4 standard deviations below the mean. I checked.",
      "Three. You are reliably underperforming. At least the trend is clean.",
      "Below average — and I mean that with mathematical precision, not as an insult. Mostly.",
      "Two. The left tail of the distribution. We don't linger here; we can't afford to.",
      "A three. I've modeled your luck. The R-squared is depressing.",
      "Bottom tercile. The data does not flatter you, but the data does not lie.",
    ],
    mid: [
      "You are within one standard deviation of the mean. Adequate.",
      "Five point five is the expected value. You're approximating it.",
      "A six. Mathematically the most boring outcome available. Congratulations.",
      "Four. Comfortably inside the interquartile range. Comfortably forgettable.",
      "Seven. Slightly above expectation. Do not extrapolate from one trial.",
      "This is the fat part of the distribution — where most of you live, statistically.",
      "A five. The mode would like a word, but the mean accepts you.",
      "Within tolerance. Not significant. File it under 'noise.'",
    ],
    high: [
      "Ninety-fifth percentile. Acceptable variance.",
      "You're outperforming the mean. Don't read into it.",
      "A nine. The 90th percentile. Statistically, you should quit while you're ahead.",
      "Eight. Two standard deviations of competence. I'm logging this as an outlier.",
      "Upper decile. Promising. Almost certainly not repeatable.",
      "Nine. One short of significance. The universe does love a near-miss.",
      "A high roll. I'll grant you a 1.3 z-score. Don't make it weird.",
      "Eight out of ten. The right tail. Enjoy the thin air; the regression is coming.",
    ],
    nat_max: [
      "Ten. Maximum output achieved. P-value significant.",
      "Perfect score. I'm not emotional about it. I'm a number generator.",
      "Ten out of ten. A 10% event has occurred. Document it; it won't recur soon.",
      "The maximum. Three sigma above the mean. Statistically, a very big deal.",
      "A natural ten. I appear to have goosebumps, which is interesting, as I have no skin.",
      "Ten. The full deca. Probability honored its commitment. So, somehow, did you.",
      "Maximum value. The distribution peaked in your favor. Treasure the anomaly.",
      "Perfect. I've recalculated twice. It holds. You may, briefly, feel things.",
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
