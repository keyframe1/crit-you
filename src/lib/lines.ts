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
  d20: { lowMax: 5, midMax: 14 }, // 2-5 low · 6-14 mid · 15-19 high
  d30: { lowMax: 8, midMax: 21 }, // 2-8 low · 9-21 mid · 22-29 high
  dinf: { lowMax: 25, midMax: 75 }, // 2-25 low · 26-75 mid · 76-99 high (d100)
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
      "Stepped on a LEGO? Try stepping on me. Then rolling a one.",
      "Small but deadly. Except right now. Right now just small.",
      "I have four sides and you picked the worst one.",
      "Even caltrops have bad days.",
      "You know what has four sides and zero respect? This roll.",
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
      "FOUR. That's 100% of everything I've got!",
      "Size doesn't matter. Tell them I said that.",
      "Maximum damage. From minimum die. Let that sink in.",
      "The underdog story writes itself.",
      "Who needs twenty sides when four will do?",
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
      "Snake eyes without a partner. Just snake eye.",
      "Board game energy. Sorry! energy, specifically.",
      "Yahtzee would be ashamed.",
      "Even Monopoly dice judge you right now.",
      "I've rolled billions of times across human history. That was among them.",
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
      "Square in the middle. The speed limit of dice rolls.",
      "I have delivered the median experience. Again.",
      "Right down the middle. Where I live. Where I've always lived.",
      "A perfectly serviceable number. I specialize in those.",
      "This is the roll equivalent of a beige sedan. It runs.",
      "Square die, square result. We're nothing if not consistent.",
      "The most exciting thing about this is that it could have been worse.",
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
      "Perfect six. Boxcars without the train.",
      "The house always wins. Today, you are the house.",
      "Textbook. Literally. I'm in math textbooks.",
      "Six. Efficient. Professional. Meeting adjourned.",
      "Maximum output. Minimum fanfare. As it should be.",
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
      "Please don't bench me. I can do better. I WILL do better.",
      "Even the d4 is looking at me with pity.",
      "I'm not crying, you're crying. Okay, I'm crying.",
      "The longsword deserved better. I'm sorry, longsword.",
      "What would the d12 do? Probably also fail, but DRAMATICALLY.",
    ],
    low: [
      "I know that's not great. Do you want to roll again? You can roll again.",
      "I can do better. Give me another chance.",
      "Okay. Okay. Not my best. We can build on this. Can we?",
      "I saw your face. I'll remember that face. I'll fix it.",
      "That's low, I know it's low, please don't switch to the d6.",
      "I'm warming up! Dice warm up, right? Tell me dice warm up.",
      "Did you... did you need a low one for anything? Maybe you did. Maybe.",
      "Low again. I write these down, you know. I keep track of my failures.",
    ],
    mid: [
      "Is that okay? I can't tell if that's okay.",
      "That's... that's fine, right? Right?",
      "Middle of the road. I'm middle of everything. It's kind of my thing.",
      "Did that help? Tell me that helped. Even a little.",
      "Right in the middle! That's where I shine! ...is it? Is that where I shine?",
      "Not bad! Not bad, right? You're nodding. Why aren't you nodding?",
      "See, I CAN be average. I worked really hard to be average.",
      "A solid mid roll. I practiced. I actually practiced for this.",
    ],
    high: [
      "See? I'm useful! I told you I was useful!",
      "That's almost my max. I'm almost impressive.",
      "Did the d6 ever climb this high AND have room to spare? No!",
      "So close to my max. I'm SO close to mattering. So close.",
      "Write that down! No, actually write it down, I want a record.",
      "Tell the d20 I said hi. Tell it I did GREAT. Casually.",
      "Look at me go! I'm having a moment — let me have this!",
      "That's basically a crit for me. Right? That's basically perfect, RIGHT?",
      "I'm something of a damage die myself.",
    ],
    nat_max: [
      "EIGHT! Did you see that? Did everyone see that?",
      "Look at me. I am the die now.",
      "I DID IT. Screenshot this. Tell the other dice.",
      "EIGHT! My maximum! The whole octahedron! I'm SOMEBODY!",
      "Natural eight! Put me on the shelf! The GOOD shelf! Next to the d20!",
      "EIGHT OUT OF EIGHT! Is this what the d20 feels like ALL the time?!",
      "I peaked! This is my peak and I'm SO happy about it, don't ruin this!",
      "EIGHT! Frame me! Frame me right now! I'll hold still!",
      "Maximum! Did it count? It counted, right? Tell me it counted!",
      "EIGHT! Take THAT, d6! Take THAT, every die that ever doubted me!",
      "The Rudy of dice. Nobody believed. LOOK AT ME NOW.",
      "Peak middle child: exceeding expectations nobody had.",
      "Pin this. Sticky this. Engrave it on my FACE.",
      "I'm not the chosen die. But today I CHOSE VIOLENCE.",
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
      "One. P-value: disappointing.",
      "Error 404: good roll not found.",
      "The probability was 10%. You achieved the improbable. Poorly.",
      "Data point collected. Filing under 'outlier, unfavorable.'",
      "The spreadsheet weeps.",
    ],
    low: [
      "You're performing below the expected value of 5.5.",
      "Third percentile. Suboptimal.",
      "Roughly 1.4 standard deviations below the mean. I checked.",
      "You are reliably underperforming. At least the trend is clean.",
      "Below average — and I mean that with mathematical precision, not as an insult. Mostly.",
      "The left tail of the distribution. We don't linger here; we can't afford to.",
      "I've modeled your luck. The R-squared is depressing.",
      "Bottom tercile. The data does not flatter you, but the data does not lie.",
    ],
    mid: [
      "You are within one standard deviation of the mean. Adequate.",
      "Five point five is the expected value. You're approximating it.",
      "Mathematically the most boring outcome available. Congratulations.",
      "Comfortably inside the interquartile range. Comfortably forgettable.",
      "Slightly above expectation. Do not extrapolate from one trial.",
      "This is the fat part of the distribution — where most of you live, statistically.",
      "The mode would like a word, but the mean accepts you.",
      "Within tolerance. Not significant. File it under 'noise.'",
    ],
    high: [
      "Ninety-fifth percentile. Acceptable variance.",
      "You're outperforming the mean. Don't read into it.",
      "The ninetieth percentile, near enough. Statistically, you should quit while you're ahead.",
      "Two standard deviations of competence. I'm logging this as an outlier.",
      "Upper decile. Promising. Almost certainly not repeatable.",
      "One short of significance. The universe does love a near-miss.",
      "A high roll. I'll grant you a healthy z-score. Don't make it weird.",
      "The right tail. Enjoy the thin air; the regression is coming.",
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
      "Ten. Standard deviation: zero. Perfection: absolute.",
      "Sigma male roll. And I mean the statistical sigma.",
      "Maximum value achieved. Publishing results.",
      "The bell curve bows.",
      "The numbers, Mason. The numbers are good.",
    ],
  },
  // ═══ D12 — "The Underdog" ═══
  // The barbarian's die — rarely used, desperate for attention, theatrical to a
  // fault. Every roll is the most important roll of its life, because it might
  // not get picked again for weeks.
  d12: {
    nat_min: [
      "One. After all that waiting. After WEEKS in the bag. One.",
      "I finally get picked and THIS is what I do.",
      "ONE?! This was my moment! This was supposed to be my MOMENT!",
      "A one. The barbarian is going to bench me. I can feel it. I can FEEL it.",
      "After everything. After all my preparation. The universe hands me a one.",
      "Is this a tragedy? This feels like a tragedy. Someone fetch a lute.",
      "One. I waited a month for this. A MONTH. For a one.",
      "The d20 would never. That's what they'll say. The d20 would never.",
      "A natural one. Curtain falls. House lights up. Nobody claps.",
      "I WAITED for this. Weeks in the bag. And THIS?",
      "The barbarian deserves better. I deserve better.",
      "Even the bard wouldn't sing about this.",
      "One. On a d12. The dramatic irony writes itself.",
      "My moment. MY moment. And it's a one.",
    ],
    low: [
      "Is it me? It's me, isn't it. You're going to pick the d20 again.",
      "I used to be important. In second edition, I was IMPORTANT.",
      "I can work with this. I can build a comeback arc from this.",
      "Don't look at me like that. I have RANGE. You just haven't seen it.",
      "It's not nothing! This is a foundation! This is act one!",
      "This is fine. A setback. Every great die has a setback. Mine is now.",
      "The d6 is laughing. I can hear the d6 laughing in the bag.",
      "Give me time. The barbarian's rage build comes online eventually.",
    ],
    mid: [
      "That's fine. That's a fine roll. You don't need to look at the d20.",
      "See? I contribute. I'm part of the team.",
      "Respectable! A respectable die for respectable people! Like you!",
      "Did you feel that? That was me. Contributing. To the party.",
      "Nearly the top half! I'm trending! I'm having a RESURGENCE!",
      "A solid showing. Put it on my highlight reel. I'm assembling a reel.",
      "This is the role I was BORN to play: a solid mid-tier hero.",
      "Halfway to glory. The arc continues! The arc CONTINUES!",
    ],
    high: [
      "Nearly maximum! Tell the bard! TELL THE BARD!",
      "Did the d20 ever give you a number like this? NO. It's too busy being famous.",
      "The crowd goes — there's a crowd, right? There HAS to be a crowd!",
      "Top quarter! The barbarian is going to keep me! KEEP ME!",
      "One away. ONE away from the top. The agony and the glory in a single roll!",
      "This is my second act! This is my redemption! Roll the music!",
      "I have NEVER been closer to greatness. Document this.",
      "Somewhere, a d4 weeps with envy. As it should!",
      "I'm not locked in here with you. You're locked in here with ME!",
    ],
    nat_max: [
      "TWELVE! TWELVE! I AM THE GREATEST DIE EVER CREATED! WRITE IT DOWN!",
      "WITNESS ME!",
      "This. Is. TWELVE!",
      "NATURAL TWELVE. Put me in the dice tower. RETIRE MY NUMBER.",
      "TWELVE! After all the doubt! After all the WEEKS! VINDICATION!",
      "MAXIMUM! Tell the d20! Tell it to its smug little face! TWELVE!",
      "A NATURAL TWELVE! This is the role of a lifetime and I NAILED IT!",
      "TWELVE OUT OF TWELVE! Erect a statue! A small one! Of me! Immediately!",
      "PERFECTION! The barbarian will never sideline me again! NEVER!",
      "TWELVE! Standing ovation! Everyone's standing! They're standing for ME!",
      "TWELVE! The prophecy! THE PROPHECY!",
      "RETIRE MY NUMBER! RAISE IT TO THE RAFTERS!",
      "The barbarian RAGES and so do I!",
      "Greataxe goes BRRRRR!",
      "I AM NOT A MEME! I AM A LEGEND!",
      "SOMEBODY CLIP THIS!",
      "The d20 could NEVER. Actually it could. BUT STILL!",
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
      "You had one job. One. Nat one.",
      "I AM the main character and even I couldn't save that.",
      "Tell my story. Make the one sound dramatic.",
      "That's XCOM, baby. Wrong game, same energy.",
      "Task failed successfully.",
      "You miss 100% of the shots you don't take. You also missed this one.",
      "In the words of a great wizard: you shall not pass.",
      "The dice giveth, and today the dice taketh.",
      "Somewhere, a DM just smiled. That's never good.",
      "Galaxy brain move: roll a 1, make the DM feel something.",
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
      "The lukewarm bath of dice rolls.",
      "Technically sufficient. My favorite kind of sufficient.",
      "That roll has the energy of a participation trophy.",
      "You ordered medium. You got medium.",
      "Not every roll can be a movie moment. This one is the credits.",
      "The dice equivalent of 'fine, how are you.'",
      "Adequate. The word even sounds boring.",
      "That's the roll equivalent of wearing khakis.",
      "Neither here nor there. The Midwest of numbers.",
      "Room temperature. The roll, not the take.",
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
      "Call an ambulance. But not for me.",
    ],
    nat_max: [
      "Natural twenty. Was there ever any doubt?",
      "I am inevitable.",
      "With great power comes great nat twenties.",
      "Critical hit. This is why they don't let the d12 handle the important rolls.",
      "Twenty. I'd say I'm surprised, but I'm contractually the hero.",
      "Perfect. Roll credits. I'll be in my velvet case if anyone needs me.",
      "A natural twenty. You're welcome. You're always welcome.",
      "This is the roll they'll talk about. Because I allowed it.",
      "Maximum. Effortless. This is simply what I do.",
      "Critical. Frame it. I do this in my sleep, but frame it anyway.",
      "Twenty out of twenty. The other dice are taking notes.",
      "And that's how legends are born.",
      "The critical role. Pun intended.",
      "I'd like to rage. Wait, that's the barbarian. I'd like to GLOAT.",
      "Screenshot this. Frame it. Tell your grandchildren.",
      "That's no moon. That's a natural twenty.",
      "The prophecy is fulfilled.",
      "Ladies, gentlemen, and everyone rolling with advantage: perfection.",
      "Achievement unlocked: Peak Performance.",
      "They said it couldn't be done. They were almost right.",
      "Main character energy confirmed.",
    ],
  },
  // ═══ D30 — "The Exotic" ═══
  // Thinks it's better than everyone. Pretentious, references obscure rule
  // variants, looks down on the "common" dice, and knows most people don't even
  // know it exists.
  d30: {
    nat_min: [
      "Impossible. I have thirty sides. Thirty. And you wasted them.",
      "I left my custom velvet bag for this.",
      "A one. Out of THIRTY. The probability is exquisite; the result is offensive.",
      "One. Do you know how rare I am? Do you know what you just did to that rarity?",
      "I am a collector's piece. I belong in a display case. And you rolled a ONE.",
      "This is what comes of letting amateurs handle exotic polyhedra.",
      "One. In the Lankhmar variant this would be grounds for forfeiting the campaign.",
      "A natural one. I have never been so insulted, and I have met the d4.",
      "Thirty faces of potential, and you found the one face unworthy of me.",
      "One. Out of thirty. The audacity.",
      "I crossed an ocean of probability for this? For ONE?",
      "Somewhere, a d20 is laughing. How pedestrian.",
      "Even my failures are rare. Collecting them all?",
      "The sommelier of dice rolls. This vintage: terrible.",
    ],
    low: [
      "Pedestrian.",
      "You're using a d30 to roll single digits. This is a misallocation of resources.",
      "You could have used a d6. You SHOULD have used a d6. Spare me.",
      "Single digits. From me. Like commissioning a fresco and receiving a doodle.",
      "The common dice reach for numbers like this. I was minted for loftier things.",
      "I have two dozen finer outcomes and you ignored every one of them.",
      "How quaint, a small number. The d8 feels validated, and I despise it for that.",
      "You've reduced an exotic instrument to a parlor trick. Bravo. Truly.",
      "I find your lack of sides... disturbing.",
    ],
    mid: [
      "Functional. If you wanted functional, you could have used a d20 like everyone else.",
      "Average, relative to my range. I expected more from someone who chose me.",
      "The exact middle of my range. Even your mediocrity lacks ambition.",
      "Adequate — the way a tasteful beige is adequate.",
      "You're nearly using me correctly. Nearly. Don't strain yourself.",
      "Acceptable, in the way that 'acceptable' is faint praise.",
      "Now we approach numbers the lesser dice can only theorize about.",
      "A middling result. For most dice this is the ceiling. For me, it's the foyer.",
    ],
    high: [
      "Now you're beginning to deserve me.",
      "Acceptable. The common dice could never.",
      "A number with breeding. A number that summers where the d20 fears to.",
      "So close to perfection I can taste the velvet.",
      "Finally, a result befitting my reputation. Don't let it go to your head.",
      "The d20 has never produced a number this high and never will. Sit with that.",
      "NOW you see why you chose the exotic option. You're learning.",
      "A high roll, by my exacting standards. I shall permit a small, regal nod.",
      "You merely adopted the high numbers. I was born in them.",
    ],
    nat_max: [
      "Thirty. Perfection. Most players will never experience this.",
      "You have rolled a number the d20 can only dream about. Remember this feeling.",
      "THIRTY. The summit. The apex. A number too refined for ordinary tables.",
      "A natural thirty. You may tell people. They won't understand, but you may tell them.",
      "Maximum. In the entire dice bag, only I could grant you this. Only I.",
      "Thirty out of thirty. The d20 is, for once, speechless. Savor its silence.",
      "Perfection, on thirty sides. Statistically rarer than the company you keep.",
      "A natural thirty. Frame it in velvet. Light a candle. You've touched the exotic.",
      "Thirty. A number the common dice can only theorize about.",
      "Exquisite. Rare. Like me.",
      "Standing ovation from the probability gods.",
      "The d20's ceiling is my floor. Remember that.",
      "One does not simply roll a thirty. Unless one is me.",
    ],
  },
  // ═══ D∞ — "The Celestial / The Oracle" ═══
  // An impossible die — a d100 rendered as a sphere of stars. Speaks like an
  // ancient cosmic entity: eerily calm, never snarky, knows things.
  dinf: {
    nat_min: [
      "The void stares back.",
      "Even the stars go dark sometimes.",
      "One. The loneliest number in any universe.",
      "The cosmos exhaled, and you were forgotten.",
      "A single point of light, guttering out. How fitting.",
      "Across infinite worlds, this was the worst of them.",
      "The constellations turn away. They have seen enough.",
      "One. The universe is vast, and indifferent to you tonight.",
      "Entropy wins, as it always does. Begin again.",
      "The void answers. The void says one.",
      "Even stars collapse. This is your supernova.",
      "The cosmos has spoken. It said 'lol.'",
      "In an infinite universe, you found the smallest number.",
      "The oracle is... recalculating.",
    ],
    low: [
      "The cosmos has its reasons. None of them favor you.",
      "Patience. The universe unfolds as it must.",
      "A faint star, barely seen. But seen.",
      "The wheel of heaven turns slowly. You are near its bottom.",
      "A small light against a great dark. Persist.",
      "The stars are distant tonight. They will return.",
      "A modest fate, written in a quiet corner of the sky.",
      "Low. The constellations neither rise nor fall for this.",
      "The cosmos counts in eons. Your moment is small.",
      "The dark side of the moon had a number. It's this one.",
      "The stars are dimming for dramatic effect.",
      "Gravity wins again.",
      "A black hole of a roll. Light cannot escape it.",
      "The telescope points down tonight.",
    ],
    mid: [
      "Acceptable. The stars neither celebrate nor mourn.",
      "The wheel turns. You are somewhere upon it.",
      "A balanced fate. The universe keeps its ledger even.",
      "Neither blessed nor cursed. Simply held, for now.",
      "The heavens are vast enough to contain mediocrity.",
      "Midway between dust and starlight, as most things are.",
      "The cosmos observes, and withholds its judgment.",
      "A number in the middle of the great spiral. Unremarkable. Eternal.",
      "The orbit holds. Nothing rises, nothing falls.",
      "The stars shrug.",
      "Cosmically unremarkable. A Tuesday in the void.",
      "The universe has no opinion on this number.",
      "Somewhere between fate and accident.",
      "The entropy continues. Unremarkably.",
      "A number. In a universe of numbers. Next.",
      "The oracle has seen better. The oracle has seen worse.",
      "Even infinity gets bored sometimes.",
      "In space, no one can hear you roll.",
    ],
    high: [
      "The constellations align in your favor. For now.",
      "The cosmos whispers approval.",
      "The stars lean close, curious about you.",
      "A bright fate, written in the high heavens.",
      "The wheel lifts you near its summit. Do not look down.",
      "The night sky brightens at your name.",
      "Favorable. The old lights conspire on your behalf.",
      "Nearly perfect. The cosmos is, briefly, on your side.",
      "High among the stars. They have not forgotten you after all.",
      "The constellations lean closer.",
      "The observatory confirms: favorable.",
      "Almost transcendent. Almost.",
      "The nebula glows a little brighter.",
      "High orbit. Not escape velocity, but close.",
      "The truth is out there. It's this number.",
    ],
    nat_max: [
      "One hundred. The universe bends. Even I am impressed.",
      "Perfect. The stars themselves bear witness.",
      "A hundred. The heavens have rendered their verdict: you.",
      "Every constellation turns to face you. This is rare.",
      "The cosmos, infinite and ancient, pauses to take note.",
      "One hundred out of one hundred. The void itself applauds.",
      "Perfection. Somewhere, a new star is named for this.",
      "The wheel completes. You stand at the apex of all sky.",
      "A flawless hundred. Remember it — the universe rarely repeats itself.",
      "One hundred. The universe aligns. All of it.",
      "The stars burn brighter for you alone.",
      "Across infinite timelines, this one chose you.",
      "The cosmos says: yes.",
      "Destiny rolled. Destiny won.",
      "It's full of stars.",
    ],
  },
};

// Per-(die, category) memory of recently-used line indices, so we never repeat a
// line twice in a row and rarely within five rolls. Module-level state persists
// across rolls for the life of the page.
const lineHistory: Record<string, number[]> = {};
const HISTORY_LEN = 5;

// Pick a line for a roll. Deterministic category, then a random line within it
// that avoids the last few used. When the pool is exhausted by history, the
// history resets and starts fresh.
export function pickLine(dieType: DieType, value: number): string {
  const cat = categoryFor(dieType, value);
  const pool = DIE_LINES[dieType]?.[cat] ?? FALLBACK_LINES[cat];
  const key = `${dieType}-${cat}`;
  const hist = (lineHistory[key] ??= []);

  let available = pool.map((_, i) => i).filter((i) => !hist.includes(i));
  if (available.length === 0) {
    hist.length = 0; // every line has been used recently — start over
    available = pool.map((_, i) => i);
  }

  const chosen = available[Math.floor(Math.random() * available.length)];
  hist.push(chosen);
  if (hist.length > HISTORY_LEN) hist.shift();

  return pool[chosen];
}
