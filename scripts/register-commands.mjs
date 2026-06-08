// Registers the Crit bot's slash commands with Discord. Run ONCE (and again only
// when the command shapes below change) — Discord persists the registration.
//
//   node --env-file=.env.local scripts/register-commands.mjs        # global
//   node --env-file=.env.local scripts/register-commands.mjs --guild=<GUILD_ID>
//
// (No --env-file? This script also auto-loads .env.local / .env itself.)
//
// Needs DISCORD_APP_ID and DISCORD_BOT_TOKEN — the same values set on the Vercel
// project. Pull them locally with `vercel env pull .env.local`, or set them inline.
//
// Global commands can take up to ~1 hour to appear in every client; registering to
// a single test guild with --guild=<id> (or DISCORD_GUILD_ID) is INSTANT and ideal
// while iterating. Per Discord's model, a parent command with subcommands can't be
// invoked bare, so "today's prompt" is the `today` subcommand.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Minimal .env loader (only fills vars not already in the environment) ─────
function loadEnvFile(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return; // file absent — fine
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env"));

const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error(
    "Missing DISCORD_APP_ID and/or DISCORD_BOT_TOKEN.\n" +
      "Provide them via .env.local (`vercel env pull .env.local`) or inline:\n" +
      "  DISCORD_APP_ID=… DISCORD_BOT_TOKEN=… node scripts/register-commands.mjs"
  );
  process.exit(1);
}

// Optional guild target: --guild=<id> flag or DISCORD_GUILD_ID env.
const guildArg = process.argv
  .find((a) => a.startsWith("--guild="))
  ?.split("=")[1];
const GUILD_ID = guildArg || process.env.DISCORD_GUILD_ID || null;

// Discord application-command option types.
const SUB_COMMAND = 1;
const STRING = 3;

// One `/crit` command, three subcommands.
const commands = [
  {
    name: "crit",
    description: "Today's Daily Crit, code submission, and the streak leaderboard.",
    options: [
      {
        type: SUB_COMMAND,
        name: "today",
        description: "Show today's Daily Crit and the play link.",
      },
      {
        type: SUB_COMMAND,
        name: "submit",
        description: "Log your Daily Crit result and update your streak.",
        options: [
          {
            type: STRING,
            name: "code",
            description: "The 6-character verify code from your share grid.",
            required: true,
            min_length: 6,
            max_length: 32,
          },
        ],
      },
      {
        type: SUB_COMMAND,
        name: "leaderboard",
        description: "Show this server's Crit streak leaderboard.",
      },
    ],
  },
];

const url = GUILD_ID
  ? `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${APP_ID}/commands`;

const res = await fetch(url, {
  method: "PUT", // bulk-overwrite: this set becomes the full command list
  headers: {
    Authorization: `Bot ${BOT_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Discord API ${res.status} ${res.statusText}\n${text}`);
  process.exit(1);
}

const scope = GUILD_ID ? `guild ${GUILD_ID} (instant)` : "global (~1h to propagate)";
console.log(`Registered /crit (today, submit, leaderboard) — ${scope}.`);
