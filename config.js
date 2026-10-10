// config.js
// Single place where every piece of runtime configuration is read from
// environment variables (via .env) and exposed to the rest of the bot.
// No secrets ever live in this file itself - only fallback defaults that
// are safe to be public (e.g. the default command prefix).

require('dotenv').config();

function parseNumberList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((n) => n.trim().replace(/[^0-9]/g, ''))
    .filter(Boolean);
}

function digitsOnly(value) {
  return (value || '').replace(/[^0-9]/g, '');
}

// Accepts a few human-friendly spellings for the same two methods so
// ".env" examples like "AUTH_METHOD=pairing" and "AUTH_METHOD=pairing-code"
// both work, without introducing a new environment variable name.
function normalizeAuthMethod(raw) {
  const v = (raw || '').trim().toLowerCase();
  if (['pairing', 'pairing-code', 'phone', 'phone-number'].includes(v)) return 'pairing-code';
  if (['qr', 'qr-code'].includes(v)) return 'qr';
  return null; // not set, or not recognized -> caller decides the default
}

const resolvedAuthMethod = normalizeAuthMethod(process.env.AUTH_METHOD);

// The primary prefix (PREFIX, default ".") plus any extra prefixes
// (EXTRA_PREFIXES, a comma-separated list, default "!") that should
// ALSO trigger every command. New variable, old PREFIX untouched, so
// anyone already relying on PREFIX keeps working unchanged.
const extraPrefixes = (process.env.EXTRA_PREFIXES ?? '!')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

const primaryPrefix = process.env.PREFIX || '.';

// Render only sets RENDER_EXTERNAL_URL for services deployed as a "Web
// Service" (not a "Background Worker"). PUBLIC_URL lets you override it
// manually for any other host. Empty string means "no public URL is
// available" - callers (lib/gameServer.js, commands/*game.js) must
// handle that by falling back gracefully, never by crashing.
const publicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');

const config = {
  botName: process.env.BOT_NAME || 'activeX',
  botAuthor: process.env.BOT_AUTHOR || 'Cyrus Akacha Cyprian',
  githubUsername: process.env.GITHUB_USERNAME || 'active-X1',

  prefix: primaryPrefix, // kept for anything that still wants "the" prefix (e.g. example text)
  prefixes: [...new Set([primaryPrefix, ...extraPrefixes])], // what message parsing actually uses

  ownerNumber: digitsOnly(process.env.OWNER_NUMBER),
  sudoNumbers: parseNumberList(process.env.SUDO_NUMBERS),

  // 'qr' | 'pairing-code'. If AUTH_METHOD wasn't set (or wasn't
  // recognized) in .env, this defaults to 'qr' but authMethodExplicit
  // below is false, which lets lib/authSetup.js know it's free to show
  // the interactive setup menu instead of silently assuming QR.
  authMethod: resolvedAuthMethod || 'qr',
  authMethodExplicit: resolvedAuthMethod !== null,
  pairingNumber: digitsOnly(process.env.PAIRING_NUMBER || process.env.OWNER_NUMBER),

  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  // "openrouter/free" = OpenRouter's router that picks an available free model.
  openrouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
  aiDailyLimit: Number.parseInt(process.env.AI_DAILY_LIMIT, 10) || 10,

  // .imagine: OpenRouter's "Nano Banana" (Gemini 2.5 Flash Image). It is a
  // PAID model, so it has its own, smaller per-chat daily limit.
  openrouterImageModel: process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image',
  imagineDailyLimit: Number.parseInt(process.env.IMAGINE_DAILY_LIMIT, 10) || 5,

  // Optional: pin the .encrypt/.decrypt key (see lib/cipher.js). Empty = auto-generated.
  cipherKey: process.env.CIPHER_KEY || '',

  logLevel: process.env.LOG_LEVEL || 'info',

  // Used by lib/gameServer.js (.snakegame / .aimgame). publicUrl is ''
  // when no public URL could be determined - commands must fall back
  // to sending the game as a file instead of a link in that case.
  publicUrl,
  port: Number.parseInt(process.env.PORT, 10) || 3000,

  paths: {
    sessions: './sessions',
    database: './database',
    logs: './logs',
    downloads: './downloads',
    temp: './temp',
    media: './media',
    games: './games',
  },
};

module.exports = config;
