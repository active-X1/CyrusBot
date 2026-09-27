// lib/authSetup.js
//
// Resolves which WhatsApp pairing method to use for THIS run, exactly
// once, before index.js's reconnect loop starts. This is the only
// place that ever prompts the user - nothing else duplicates this
// logic, and the choice is made once and reused across reconnects (so
// you're never asked twice, and the QR/pairing-code paths never both
// fire for the same run).
//
// Resolution order:
//   1. AUTH_METHOD is set in .env -> use it directly, no prompt at all.
//      (Render, or any non-interactive host, should set this.)
//   2. AUTH_METHOD is NOT set AND we have a real interactive terminal
//      (a TTY, e.g. running locally) -> show the setup menu and ask.
//   3. AUTH_METHOD is NOT set AND there's no TTY (most hosting
//      platforms when the env var is forgotten) -> fall back to QR,
//      matching CyrusBot's previous default behaviour.

const readline = require('readline');
const config = require('../config');
const logger = require('./logger');

/** Never let a real phone number reach the logs, even partially. */
function maskNumber(number) {
  if (!number) return '(not set)';
  if (number.length <= 4) return '*'.repeat(number.length);
  return `${number.slice(0, 3)}${'*'.repeat(number.length - 5)}${number.slice(-2)}`;
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
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

/**
 * @returns {Promise<{ method: 'qr' | 'pairing-code', pairingNumber: string }>}
 */
async function resolveAuthMethod() {
  if (config.authMethodExplicit) {
    logger.info({ method: config.authMethod }, 'AUTH_METHOD set in .env, skipping interactive setup menu');
    return { method: config.authMethod, pairingNumber: config.pairingNumber };
  }

  if (!process.stdin.isTTY) {
    logger.info('No interactive terminal and AUTH_METHOD is not set - defaulting to QR pairing.');
    return { method: 'qr', pairingNumber: config.pairingNumber };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  printMenu();

  let choice = (await ask(rl, 'Select an option: ')).trim();
  while (choice !== '1' && choice !== '2') {
    choice = (await ask(rl, 'Please enter 1 or 2: ')).trim();
  }

  if (choice === '2') {
    rl.close();
    return { method: 'qr', pairingNumber: config.pairingNumber };
  }

  let pairingNumber = config.pairingNumber;
  if (!pairingNumber) {
    const answer = await ask(rl, 'Enter your WhatsApp number (digits only, e.g. 15551234567): ');
    pairingNumber = answer.replace(/[^0-9]/g, '');
  }
  rl.close();
  logger.info({ pairingNumber: maskNumber(pairingNumber) }, 'Phone-number pairing selected');
  return { method: 'pairing-code', pairingNumber };
}

module.exports = { resolveAuthMethod, maskNumber };
