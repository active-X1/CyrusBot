// lib/authSetup.js
//
// Decides HOW to log in to WhatsApp (phone-number pairing code or QR).
// Called from index.js whenever a login is needed:
//
//   1. A saved, completed login exists in sessions/  -> nothing to ask.
//   2. No saved login + interactive terminal          -> ALWAYS ask
//      (even on the very first run), and keep asking until the answer
//      is valid. AUTH_METHOD in .env does not skip the question.
//   3. No saved login + no keyboard (e.g. Render)     -> can't ask, so:
//      AUTH_METHOD if set, else phone pairing if PAIRING_NUMBER is set,
//      else QR.
//
// Phone numbers are never written to the logs (only masked).

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../config');
const logger = require('./logger');

const SESSIONS_DIR = path.resolve(config.paths.sessions);

/** Never let a real phone number reach the logs, even partially. */
function maskNumber(number) {
  if (!number) return '(not set)';
  if (number.length <= 4) return '*'.repeat(number.length);
  return `${number.slice(0, 3)}${'*'.repeat(number.length - 5)}${number.slice(-2)}`;
}

/**
 * Is there a COMPLETED login in sessions/? `account` is only written when
 * WhatsApp confirms pairing; creds.me alone isn't proof, because Baileys
 * writes a placeholder `me` as soon as a pairing code is requested.
 */
function hasSavedSession() {
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, 'creds.json'), 'utf8'));
    return Boolean(creds.registered || creds.account);
  } catch {
    return false;
  }
}

/** Delete a dead session so the next login starts clean (keeps .gitkeep). */
function resetSession() {
  try {
    for (const name of fs.readdirSync(SESSIONS_DIR)) {
      if (name === '.gitkeep') continue;
      fs.rmSync(path.join(SESSIONS_DIR, name), { recursive: true, force: true });
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not clear the old session');
  }
}

function printMenu() {
  console.log(`
╭────────────────────────────╮
│      🔐 CYRUSBOT SETUP     │
╰────────────────────────────╯

[1] 📱 Pair with Phone Number
[2] 🖼️  Pair with QR Code
`);
}

/** Headless default (no keyboard available). */
function headlessChoice() {
  if (config.authMethodExplicit) return config.authMethod;
  return config.pairingNumber ? 'pairing-code' : 'qr';
}

async function promptUser() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  rl.on('close', () => { closed = true; });

  // Resolves with the typed line, or null if the input stream closed.
  const ask = (question) =>
    new Promise((resolve) => {
      if (closed) return resolve(null);
      const onClose = () => resolve(null);
      rl.once('close', onClose);
      rl.question(question, (answer) => {
        rl.removeListener('close', onClose);
        resolve(answer);
      });
    });

  const fallback = () => {
    rl.close();
    const method = headlessChoice();
    console.log('\n⚠️  Input closed - continuing with the default login method.\n');
    return { method, pairingNumber: config.pairingNumber };
  };

  printMenu();
  let choice = await ask('Select an option: ');
  while (choice !== null && choice.trim() !== '1' && choice.trim() !== '2') {
    choice = await ask('Please enter 1 or 2: ');
  }
  if (choice === null) return fallback();

  if (choice.trim() === '2') {
    rl.close();
    console.log('\n🖼️  QR code selected. Scan it with WhatsApp > Linked Devices.\n');
    return { method: 'qr', pairingNumber: config.pairingNumber };
  }

  // Phone-number pairing: keep asking until the number looks valid.
  const saved = config.pairingNumber;
  let number = null;
  while (!number) {
    const hint = saved ? ` [Enter = ${maskNumber(saved)}]` : '';
    const answer = await ask(`WhatsApp number with country code, digits only${hint}: `);
    if (answer === null) return fallback();

    const digits = answer.replace(/[^0-9]/g, '');
    if (!digits && saved) number = saved;
    else if (digits.startsWith('0')) console.log('❌ Start with the country code (e.g. 234...), not 0 or +.');
    else if (digits.length < 8 || digits.length > 15) console.log('❌ That does not look like a valid number.');
    else number = digits;
  }
  rl.close();
  logger.info({ pairingNumber: maskNumber(number) }, 'Phone-number pairing selected');
  console.log('\n📱 Phone number selected. Your pairing code will appear shortly...\n');
  return { method: 'pairing-code', pairingNumber: number };
}

/**
 * @returns {Promise<{ method: 'qr' | 'pairing-code', pairingNumber: string }>}
 */
async function resolveAuthMethod() {
  if (hasSavedSession()) {
    logger.info('Saved WhatsApp login found - no pairing needed.');
    return { method: config.authMethod, pairingNumber: config.pairingNumber };
  }

  if (!process.stdin.isTTY) {
    const method = headlessChoice();
    logger.info({ method }, 'No interactive terminal - using the configured login method.');
    return { method, pairingNumber: config.pairingNumber };
  }

  return promptUser();
}

module.exports = { resolveAuthMethod, resetSession, hasSavedSession, maskNumber };
