// commands/encrypt.js
//
// Usage:
//   .encrypt <passphrase> | <text>
//   .encrypt <text>                (uses DEFAULT_CIPHER_PASSPHRASE from .env)
//
// Implementation notes (uses only Node's built-in "crypto" module, no
// extra dependency, no external "encryption API"):
//   - A random 16-byte salt + scrypt derives a 32-byte key from the
//     passphrase (so the same passphrase never produces the same key
//     twice, and brute-forcing is slowed down).
//   - AES-256-GCM provides both confidentiality and integrity (the
//     auth tag lets .decrypt detect a wrong passphrase or tampering).
//   - Output is a single base64url token: salt + iv + authTag + ciphertext,
//     so it's easy to paste back into .decrypt.

const crypto = require('crypto');
const config = require('../config');

const SALT_LEN = 16;
const IV_LEN = 12; // recommended IV length for GCM
const KEY_LEN = 32; // AES-256

function encryptText(plaintext, passphrase) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = crypto.scryptSync(passphrase, salt, KEY_LEN);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, ciphertext]).toString('base64url');
}

function parseArgs(rawArgsText) {
  // Supports "passphrase | text" or just "text" (falls back to the
  // configured default passphrase).
  if (rawArgsText.includes('|')) {
    const [passphrase, ...rest] = rawArgsText.split('|');
    return { passphrase: passphrase.trim(), text: rest.join('|').trim() };
  }
  return { passphrase: config.defaultCipherPassphrase, text: rawArgsText.trim() };
}

module.exports = {
  name: 'encrypt',
  aliases: [],
  description: 'Encrypt text: ".encrypt <passphrase> | <text>" or ".encrypt <text>" to use the default passphrase.',
  category: 'utility',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const rawArgsText = args.join(' ');
    if (!rawArgsText.trim()) {
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: `Usage: ${config.prefix}encrypt <passphrase> | <text>\nOr: ${config.prefix}encrypt <text>  (uses the default passphrase)` },
        { quoted: msg }
      );
    }

    const { passphrase, text } = parseArgs(rawArgsText);

    if (!passphrase) {
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: 'No passphrase was given and DEFAULT_CIPHER_PASSPHRASE is not set. Provide one with ".encrypt <passphrase> | <text>".' },
        { quoted: msg }
      );
    }
    if (!text) {
      return ctx.safeSend(sock, ctx.chatId, { text: 'No text to encrypt was provided.' }, { quoted: msg });
    }

    try {
      const token = encryptText(text, passphrase);
      await ctx.safeSend(
        sock,
        ctx.chatId,
        { text: `🔒 Encrypted:\n\`\`\`${token}\`\`\`` },
        { quoted: msg }
      );
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'Encryption failed');
      await ctx.safeSend(sock, ctx.chatId, { text: '❌ Encryption failed. Please try again.' }, { quoted: msg });
    }
  },
  // exported for decrypt.js and tests, keeps the crypto logic in one place
  _internal: { encryptText, SALT_LEN, IV_LEN, KEY_LEN },
};
