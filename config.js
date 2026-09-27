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

const config = {
  botName: process.env.BOT_NAME || 'CyrusBot',
  botAuthor: process.env.BOT_AUTHOR || 'Active X',
  githubUsername: process.env.GITHUB_USERNAME || 'active-X1',

  prefix: process.env.PREFIX || '.',

  ownerNumber: digitsOnly(process.env.OWNER_NUMBER),
  sudoNumbers: parseNumberList(process.env.SUDO_NUMBERS),

  // 'qr' | 'pairing-code'. If AUTH_METHOD wasn't set (or wasn't
  // recognized) in .env, this defaults to 'qr' but authMethodExplicit
  // below is false, which lets lib/authSetup.js know it's free to show
  // the interactive setup menu instead of silently assuming QR.
  authMethod: resolvedAuthMethod || 'qr',
  authMethodExplicit: resolvedAuthMethod !== null,
  pairingNumber: digitsOnly(process.env.PAIRING_NUMBER || process.env.OWNER_NUMBER),

  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  aiDailyLimit: Number.parseInt(process.env.AI_DAILY_LIMIT, 10) || 10,

  defaultCipherPassphrase: process.env.DEFAULT_CIPHER_PASSPHRASE || '',

  logLevel: process.env.LOG_LEVEL || 'info',

  paths: {
    sessions: './sessions',
    database: './database',
    logs: './logs',
    downloads: './downloads',
    temp: './temp',
    media: './media',
  },
};

module.exports = config;
