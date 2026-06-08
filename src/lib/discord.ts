// Discord HTTP-interactions plumbing — SERVER-ONLY (imports node:crypto). The
// one job here that isn't a constant is verifying the Ed25519 request signature:
// Discord signs every interaction (and the endpoint-verification PING) with its
// app key, and an HTTP-interactions endpoint MUST reject anything that doesn't
// verify with 401, or Discord refuses to accept the endpoint at all.

import { createPublicKey, verify as edVerify, type KeyObject } from "node:crypto";

// ─── Wire-protocol constants (Discord interactions API v10) ──────────────────

// Interaction `type` on the inbound payload.
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
} as const;

// `type` on our response payload.
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
} as const;

// Application-command option `type` (only the two shapes we use).
export const ApplicationCommandOptionType = {
  SUB_COMMAND: 1,
  STRING: 3,
} as const;

// Message flags. EPHEMERAL (1 << 6) makes a reply visible only to the caller.
export const MessageFlags = {
  EPHEMERAL: 1 << 6,
} as const;

// ─── Inbound payload shapes (only the fields we read) ────────────────────────

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
}

export interface DiscordInteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordInteractionOption[];
}

export interface DiscordInteraction {
  type: number;
  guild_id?: string;
  // Present for interactions used inside a guild…
  member?: { user: DiscordUser; nick?: string | null };
  // …and this is set instead for DM interactions.
  user?: DiscordUser;
  data?: {
    name: string;
    options?: DiscordInteractionOption[];
  };
}

// ─── Ed25519 signature verification ──────────────────────────────────────────

// Discord hands us the public key as 32 raw bytes, hex-encoded. Node's
// createPublicKey wants SPKI DER, so we prepend the fixed 12-byte Ed25519 SPKI
// header (RFC 8410) to the raw key. Cached per hex string — the key never
// changes across requests in a deployment.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const keyCache = new Map<string, KeyObject>();

function publicKeyFromHex(hex: string): KeyObject {
  const cached = keyCache.get(hex);
  if (cached) return cached;
  const raw = Buffer.from(hex, "hex");
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  const key = createPublicKey({ key: der, format: "der", type: "spki" });
  keyCache.set(hex, key);
  return key;
}

// True iff `signature` (hex) is a valid Ed25519 signature, by `publicKey` (hex),
// over `timestamp + rawBody` — exactly the bytes Discord signs. Any malformed
// input (bad hex, wrong length, parse failure) safely returns false.
export function verifyDiscordSignature(args: {
  rawBody: string;
  signature: string;
  timestamp: string;
  publicKey: string;
}): boolean {
  try {
    const key = publicKeyFromHex(args.publicKey);
    const sig = Buffer.from(args.signature, "hex");
    const message = Buffer.from(args.timestamp + args.rawBody);
    return edVerify(null, message, key, sig);
  } catch {
    return false;
  }
}

// ─── Response helpers ────────────────────────────────────────────────────────

// A plain message reply. allowed_mentions is locked to nothing so a crafted
// username/nick in our content can never ping @everyone or a role.
export function messageResponse(
  content: string,
  opts: { ephemeral?: boolean } = {}
): Response {
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      allowed_mentions: { parse: [] },
      ...(opts.ephemeral ? { flags: MessageFlags.EPHEMERAL } : {}),
    },
  });
}

export function pongResponse(): Response {
  return Response.json({ type: InteractionResponseType.PONG });
}

// Resolve the acting user from either the guild (`member.user`) or DM (`user`)
// shape, and pick the friendliest display name available.
export function resolveActor(
  interaction: DiscordInteraction
): { user: DiscordUser; displayName: string } | null {
  const user = interaction.member?.user ?? interaction.user;
  if (!user) return null;
  const displayName =
    interaction.member?.nick || user.global_name || user.username || "Player";
  return { user, displayName };
}
