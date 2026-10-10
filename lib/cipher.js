// lib/cipher.js
//
// Encryption used by .encrypt / .decrypt. You never create a key:
// the bot generates a random 256-bit key the first time it's needed
// and stores it in database/cipher-key.json (gitignored, file mode 600).
//
// Optional override: set CIPHER_KEY in .env to pin the key yourself.
// Do this on hosts with an ephemeral disk (e.g. Render without a
// persistent disk) - otherwise a redeploy wipes database/ and old
// tokens could no longer be decrypted.
//
// Token layout (base64url):  [1 byte version][12 byte IV][16 byte auth tag][ciphertext]
//   - AES-256-GCM: confidentiality AND tamper detection.
//   - A fresh random IV for every message, so the same text never
//     produces the same token twice.
//
// IMPORTANT: the key lives with the bot, so anyone who can run
// .decrypt on THIS bot can decrypt its tokens. It protects text
// "in transit/at rest in chats", not against people using your bot.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_FILE = path.resolve(config.paths.database, 'cipher-key.json');

let cachedKey = null;

function loadOrCreateKey() {
  if (cachedKey) return cachedKey;

  if (config.cipherKey) {
    // Any string in .env is stretched to a proper 32-byte key.
    cachedKey = crypto.createHash('sha256').update(config.cipherKey, 'utf8').digest();
    return cachedKey;
  }

  try {
    const stored = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
    const key = Buffer.from(stored.key, 'base64');
    if (key.length === 32) {
      cachedKey = key;
      return cachedKey;
    }
  } catch {
    // missing or unreadable -> generate a new one below
  }

  const key = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify({ key: key.toString('base64') }), { mode: 0o600 });
  cachedKey = key;
  return cachedKey;
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', loadOrCreateKey(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, data]).toString('base64url');
}

/** Throws if the token is malformed, was tampered with, or used another key. */
function decrypt(token) {
  const buf = Buffer.from(token, 'base64url');
  if (buf.length < 1 + IV_LEN + TAG_LEN + 1 || buf[0] !== VERSION) {
    throw new Error('Not a valid token');
  }
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const data = buf.subarray(1 + IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv('aes-256-gcm', loadOrCreateKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
