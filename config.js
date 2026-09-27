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

const config = {
  botName: process.env.BOT_NAME || 'CyrusBot',
  botAuthor: process.env.BOT_AUTHOR || 'Active X',
  githubUsername: process.env.GITHUB_USERNAME || 'active-X1',

  prefix: process.env.PREFIX || '.',

  ownerNumber: digitsOnly(process.env.OWNER_NUMBER),
  sudoNumbers: parseNumberList(process.env.SUDO_NUMBERS),

  authMethod: (process.env.AUTH_METHOD || 'qr').toLowerCase(), // 'qr' | 'pairing-code'
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
