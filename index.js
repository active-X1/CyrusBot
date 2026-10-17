// index.js
//
// CyrusBot entry point. Responsibilities of this file, and only this
// file:
//   1. Open/maintain the Baileys WhatsApp connection (QR or pairing code).
//   2. Load commands via lib/commandLoader.js.
//   3. Turn incoming WhatsApp messages into command dispatches.
//   4. Reconnect on drop, shut down cleanly on SIGINT/SIGTERM.
//
// Actual command behaviour lives in commands/*.js - this file stays
// thin on purpose so it's easy to reason about.

const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const config = require('./config');
const logger = require('./lib/logger');
const { loadCommands } = require('./lib/commandLoader');
const {
  isOwner,
  canManageChat,
  safeSend,
  extractText,
  matchPrefix,
} = require('./lib/helpers');
const { maybeSendAutoReply } = require('./lib/autoReply');
const rateLimiter = require('./lib/rateLimiter');
const { askAI, AIProviderError } = require('./lib/aiProvider');
const ui = require('./lib/ui');
const { resolveAuthMethod, resetSession } = require('./lib/authSetup');
const { startGameServer } = require('./lib/gameServer');
const groupCache = require('./lib/groupCache');

const SESSIONS_PATH = path.resolve(config.paths.sessions);

// Baileys needs its own silent-by-default logger instance (separate from
// ours, which is much noisier) to avoid flooding stdout with internal
// protocol chatter.
const baileysLogger = pino({ level: 'silent' });

let commandRegistry = null;
let commandList = [];

function refreshCommands() {
  const { registry, commands } = loadCommands();
  commandRegistry = registry;
  commandList = commands;
}

/**
 * Route one incoming message: parse for a command, enforce permissions,
 * execute it, and fall back to AI-mode auto-reply / the DM auto-reply
 * when nothing matches. Every branch is wrapped so a single bad message
 * or a bug in one command can never crash the whole process.
 */
async function handleIncomingMessage(sock, msg) {
  try {
    if (!msg.message) return;
    if (msg.key.remoteJid === 'status@broadcast') return;

    const chatId = msg.key.remoteJid;
    // Who actually wrote this? In a DM, key.remoteJid is the OTHER person
    // even when WE sent the message (from our own phone), so for our own
    // messages the sender is the bot's own account.
    const senderJid = msg.key.fromMe
      ? sock.user?.id || msg.key.remoteJid
      : msg.key.participant || msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const text = extractText(msg);
    if (!text) return;

    const senderAltJid = msg.key.participantAlt || msg.key.remoteJidAlt;

    const ctx = {
      chatId,
      senderJid,
      isGroup,
      senderAltJid, // the same person's other address form (phone vs @lid), when WhatsApp gives it
      isOwner: Boolean(msg.key.fromMe) || isOwner(senderJid, senderAltJid), // our own account is, by definition, the owner
      config,
      logger,
      commands: commandList,
      safeSend,
      canManageChat,
    };

    const prefixMatch = matchPrefix(text, config.prefixes);
    if (prefixMatch) {
      const [rawCommand, ...args] = prefixMatch.rest.trim().split(/\s+/);
      const commandName = rawCommand.toLowerCase();
      const command = commandRegistry.get(commandName);

      if (!command) return; // unknown command: stay silent, don't spam "unknown command" in busy groups

      if (command.ownerOnly && !ctx.isOwner) {
        await safeSend(sock, chatId, { text: ui.denied('This command is owner-only 👑') }, { quoted: msg });
        return;
      }

      try {
        await command.execute(sock, msg, args, ctx);
      } catch (err) {
        logger.error({ err: err.message, command: commandName }, 'Command execution failed');
        await safeSend(
          sock,
          chatId,
          { text: ui.error(`Something went wrong running ${prefixMatch.prefix}${commandName}.
The error has been logged.`) },
          { quoted: msg }
        );
      }
      return;
    }

    // Not a command: check AI mode for this chat.
    const aimodeCmd = commandRegistry.get('aimode');
    if (aimodeCmd?.isEnabledForChat?.(chatId)) {
      const limit = rateLimiter.checkLimit(chatId);
      if (!limit.allowed) return; // stay silent once the daily limit is hit, to avoid spamming the chat

      try {
        await sock.sendPresenceUpdate('composing', chatId).catch(() => {});
        const answer = await askAI(text);
        rateLimiter.recordUsage(chatId);
        await safeSend(sock, chatId, { text: answer }, { quoted: msg });
      } catch (err) {
        const message = err instanceof AIProviderError ? err.userMessage : 'Something went wrong. Please try again later.';
        logger.error({ err: err.message }, 'AI-mode auto-reply failed');
        await safeSend(sock, chatId, { text: ui.error(message) }, { quoted: msg });
      }
      return;
    }

    // Neither a command nor AI mode: maybe send the owner's auto-reply
    // (DMs always; groups only when mentioned / replied to).
    maybeSendAutoReply(sock, msg, { chatId, senderJid, isGroup }, commandRegistry.get('setmessage')?.getAutoReply);
  } catch (err) {
    // Absolute last line of defense: nothing from message handling
    // should ever escape and crash the process.
    logger.error({ err: err.message }, 'Unhandled error while processing a message');
  }
}

/**
 * Build one Baileys socket, wire up its listeners, and resolve once the
 * connection is confirmed open OR permanently closed (logged out).
 * Returns { sock, shouldReconnect } so the caller can decide whether to
 * loop again.
 */
async function connectOnce(authChoice) {
  const { state, saveCreds } = await useMultiFileAuthState(SESSIONS_PATH);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: baileysLogger,
    printQRInTerminal: false, // deprecated in newer Baileys; we render the QR ourselves below
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    defaultQueryTimeoutMs: 60_000,
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 10_000,
    // Lets Baileys reuse our cached group info when sending to groups instead of
    // fetching it from WhatsApp on every send.
    cachedGroupMetadata: async (jid) => groupCache.peek(jid),
  });

  sock.ev.on('creds.update', saveCreds);

  // Group info changed (members, admins, name, settings): drop the cached copy.
  sock.ev.on('group-participants.update', (u) => groupCache.invalidate(u.id));
  sock.ev.on('groups.update', (list) => (list || []).forEach((g) => g.id && groupCache.invalidate(g.id)));

  sock.ev.on('messages.upsert', async (update) => {
    // Only live messages ('notify'). Baileys also emits 'append' events for
    // the bot's OWN sent messages and for offline backlog - handling those
    // could make the bot answer itself or reply to old messages.
    if (update.type !== 'notify') return;
    for (const msg of update.messages || []) {
      if (msg.message?.ephemeralMessage) {
        msg.message = msg.message.ephemeralMessage.message;
      }
      // NOT awaited on purpose: one slow command (.ai up to 30s, .imagine up to
      // 90s) used to freeze every other message in every chat. Each message now
      // runs on its own; handleIncomingMessage catches its own errors.
      handleIncomingMessage(sock, msg).catch((err) =>
        logger.error({ err: err?.message }, 'Message handler crashed')
      );
    }
  });

  if (authChoice.method === 'pairing-code' && !sock.authState.creds.registered) {
    if (!authChoice.pairingNumber) {
      logger.error('Phone-number pairing was selected but no phone number is available (set PAIRING_NUMBER, OWNER_NUMBER, or answer the interactive prompt).');
    } else {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(authChoice.pairingNumber);
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
          logger.info(`Pairing code: ${formatted}`);
          console.log(`\n📟 Pairing code: ${formatted}\nOpen WhatsApp > Linked Devices > Link a Device > enter this code.\n`);
        } catch (err) {
          logger.error({ err: err.message }, 'Failed to request pairing code');
        }
      }, 3000);
    }
  }

  return new Promise((resolve) => {
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && authChoice.method !== 'pairing-code') {
        console.log('\n📱 Scan this QR code with WhatsApp (Linked Devices > Link a Device):\n');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'open') {
        logger.info({ user: sock.user?.id }, `${config.botName} connected`);
        console.log(`\n✅ ${config.botName} is connected and ready.\n`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          logger.warn('WhatsApp logged this device out. The old session will be cleared and you will be asked to log in again.');
          resolve({ sock, shouldReconnect: true, loggedOut: true });
        } else {
          logger.warn({ statusCode }, 'Connection closed, will attempt to reconnect');
          resolve({ sock, shouldReconnect: true });
        }
      }
    });
  });
}

let currentSock = null;
let shuttingDown = false;

async function main() {
  refreshCommands();

  // Game HTTP server: started once, never per reconnect.
  startGameServer();

  // Decided before the loop (and asked at most once per login), so normal
  // reconnects reuse the same choice. It is asked again only when a fresh
  // login is needed: no saved session, or WhatsApp logged us out.
  let authChoice = await resolveAuthMethod();

  let backoffMs = 2000;
  const MAX_BACKOFF_MS = 30_000;

  // Iterative reconnect loop (not recursive) so the call stack never
  // grows and old listeners are dropped each cycle instead of piling up.
  while (!shuttingDown) {
    const { sock, shouldReconnect, loggedOut } = await connectOnce(authChoice);
    currentSock = sock;

    if (!shouldReconnect || shuttingDown) break;

    if (loggedOut) {
      // The saved login is dead. Clear it and start a fresh login
      // (asks phone number vs QR again when a terminal is available).
      resetSession();
      authChoice = await resolveAuthMethod();
      backoffMs = 2000;
      continue;
    }

    await new Promise((r) => setTimeout(r, backoffMs));
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down gracefully...');
  try {
    if (currentSock) {
      await currentSock.end(undefined);
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error while closing the socket');
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Never let a stray error kill the whole bot - log it and keep running.
process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Uncaught exception');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason: reason?.message || reason }, 'Unhandled promise rejection');
});

main().catch((err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Fatal error in main()');
  process.exit(1);
});
