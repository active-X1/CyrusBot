// commands/decrypt.js
//
// Usage:
//   .decrypt <passphrase> | <token>
//   .decrypt <token>                (uses DEFAULT_CIPHER_PASSPHRASE from .env)
//
// Reverses the format produced by commands/encrypt.js. Any error (wrong
// passphrase, corrupted token, tampered data) is caught and reported as
// a friendly message rather than a stack trace, since GCM's auth tag
// verification throwing is the *expected* way wrong passphrases surface.

const crypto = require('crypto');
const config = require('../config');
const { SALT_LEN, IV_LEN } = require('./encrypt')._internal;

const KEY_LEN = 32;

function decryptToken(token, passphrase) {
  const buf = Buffer.from(token, 'base64url');
  if (buf.length <= SALT_LEN + IV_LEN + 16) {
    throw new Error('Token is too short to be valid');
  }

  const salt = buf.subarray(0, SALT_LEN);
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const authTag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + 16);
  const ciphertext = buf.subarray(SALT_LEN + IV_LEN + 16);

  const key = crypto.scryptSync(passphrase, salt, KEY_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

function parseArgs(rawArgsText) {
  if (rawArgsText.includes('|')) {
    const [passphrase, ...rest] = rawArgsText.split('|');
    return { passphrase: passphrase.trim(), token: rest.join('|').trim() };
  }
  return { passphrase: config.defaultCipherPassphrase, token: rawArgsText.trim() };
}

module.exports = {
  name: 'decrypt',
  aliases: [],
  description: 'Decrypt a token produced by ".encrypt": ".decrypt <passphrase> | <token>".',
  category: 'utility',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const rawArgsText = args.join(' ').replace(/```/g, '');
    if (!rawArgsText.trim()) {
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: `Usage: ${config.prefix}decrypt <passphrase> | <token>\nOr: ${config.prefix}decrypt <token>  (uses the default passphrase)` },
        { quoted: msg }
      );
    }

    const { passphrase, token } = parseArgs(rawArgsText);

    if (!passphrase) {
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: 'No passphrase was given and DEFAULT_CIPHER_PASSPHRASE is not set.' },
        { quoted: msg }
      );
    }
    if (!token) {
      return ctx.safeSend(sock, ctx.chatId, { text: 'No token to decrypt was provided.' }, { quoted: msg });
    }

    try {
      const plaintext = decryptToken(token, passphrase);
      await ctx.safeSend(sock, ctx.chatId, { text: `🔓 Decrypted:\n${plaintext}` }, { quoted: msg });
    } catch (err) {
      // Wrong passphrase and corrupted input both land here - by design
      // we don't tell the user which one, to avoid leaking information.
      ctx.logger.warn({ err: err.message }, 'Decryption failed');
      await ctx.safeSend(
        sock,
        ctx.chatId,
        { text: '❌ Could not decrypt: wrong passphrase or invalid/corrupted token.' },
        { quoted: msg }
      );
    }
  },
};
