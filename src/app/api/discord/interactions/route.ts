// POST /api/discord/interactions — Discord's HTTP-interactions endpoint for the
// Crit bot. Discord delivers EVERY slash command (and an endpoint-verification
// PING) here as a signed POST; we must verify the Ed25519 signature on every
// request and reject failures with 401, answer the PING with a PONG, and reply to
// commands within Discord's 3-second window.
//
// We reply synchronously rather than deferring: each handler does at most a couple
// of Upstash REST round trips, comfortably under 3s, so a deferred-then-follow-up
// dance would add a failure surface for no benefit.
//
// Commands are one `/crit` with subcommands `today | submit | leaderboard`.
// Discord doesn't let a parent command run on its own once it has subcommands, so
// the "bare /crit shows today's prompt" intent is the `today` subcommand.

import { getDailyDie } from "@/lib/daily";
import { DAILY_DEEP_LINK } from "@/lib/dailyShare";
import { maxFor } from "@/lib/dice";
import {
  ApplicationCommandOptionType,
  InteractionType,
  messageResponse,
  pongResponse,
  resolveActor,
  verifyDiscordSignature,
  type DiscordInteraction,
  type DiscordInteractionOption,
} from "@/lib/discord";
import { recordSubmission, renderLeaderboard } from "@/lib/leaderboard";
import { CODE_LENGTH } from "@/lib/provenance";

// node:crypto (signature verify) + Upstash, always at request time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  // Read the RAW body — the signature is over the exact bytes, so we verify
  // before any JSON parsing.
  const rawBody = await request.text();

  if (
    !signature ||
    !timestamp ||
    !publicKey ||
    !verifyDiscordSignature({ rawBody, signature, timestamp, publicKey })
  ) {
    return new Response("invalid request signature", { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return new Response("bad request body", { status: 400 });
  }

  // Endpoint verification + Discord's periodic liveness pings.
  if (interaction.type === InteractionType.PING) {
    return pongResponse();
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    return handleCommand(interaction);
  }

  // Nothing else is registered.
  return new Response("unsupported interaction type", { status: 400 });
}

function handleCommand(interaction: DiscordInteraction): Promise<Response> | Response {
  if (interaction.data?.name !== "crit") {
    return messageResponse("Unknown command.", { ephemeral: true });
  }

  // For a subcommand the first option IS the subcommand; default to `today`.
  const sub = interaction.data.options?.[0];
  const subName =
    sub && sub.type === ApplicationCommandOptionType.SUB_COMMAND
      ? sub.name
      : "today";

  switch (subName) {
    case "submit":
      return handleSubmit(interaction, sub);
    case "leaderboard":
      return handleLeaderboard(interaction);
    case "today":
    default:
      return handleToday();
  }
}

// `/crit today` — today's die + the deep link into the Daily. Public so it works
// as a "the daily is live" nudge to the channel.
function handleToday(): Response {
  const faces = maxFor(getDailyDie(new Date()));
  return messageResponse(
    `🎲 Today's Crit is live — d${faces}. Play and post your result.\n${DAILY_DEEP_LINK}`
  );
}

// `/crit submit <code>` — verify a share-grid code and log it to this guild's
// leaderboard. Ephemeral: a private confirmation, the board is the public artifact.
async function handleSubmit(
  interaction: DiscordInteraction,
  sub: DiscordInteractionOption | undefined
): Promise<Response> {
  const guildId = interaction.guild_id;
  if (!guildId) {
    return messageResponse(
      "Run this inside a server to log your streak on its leaderboard.",
      { ephemeral: true }
    );
  }

  const actor = resolveActor(interaction);
  if (!actor) {
    return messageResponse("Couldn't read your Discord account.", {
      ephemeral: true,
    });
  }

  const codeOpt = sub?.options?.find((o) => o.name === "code");
  const raw = typeof codeOpt?.value === "string" ? codeOpt.value : "";
  const code = normalizeCode(raw);
  if (code.length !== CODE_LENGTH) {
    return messageResponse(
      `❌ That doesn't look like a verify code. Paste the ${CODE_LENGTH}-character code from your share grid (the \`verify #…\` line).`,
      { ephemeral: true }
    );
  }

  const result = await recordSubmission({
    guildId,
    userId: actor.user.id,
    displayName: actor.displayName,
    code,
  });
  return messageResponse(result.message, { ephemeral: true });
}

// `/crit leaderboard` — this guild's standings. Public.
async function handleLeaderboard(
  interaction: DiscordInteraction
): Promise<Response> {
  const guildId = interaction.guild_id;
  if (!guildId) {
    return messageResponse("Leaderboards live in servers — run this in one.", {
      ephemeral: true,
    });
  }
  const headerDie = `d${maxFor(getDailyDie(new Date()))}`;
  const board = await renderLeaderboard(guildId, headerDie);
  return messageResponse(board);
}

// Pull the code out of whatever the player pasted. The share footer reads
// "verify #ABC123", so take the text after a trailing '#' if present, then keep
// only base32 characters and uppercase. The caller checks the length.
function normalizeCode(raw: string): string {
  let s = raw.trim().toUpperCase();
  const hash = s.lastIndexOf("#");
  if (hash >= 0) s = s.slice(hash + 1);
  return s.replace(/[^A-Z2-7]/g, "");
}
