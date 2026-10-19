// lib/antibot.js
//
// Spots messages sent by OTHER bots and deletes them (or removes the sender).
//
// How: every message has an ID, and bot libraries generate IDs in a
// recognisable style that real WhatsApp apps don't use:
//   - "BAE5" + 12 characters (16 total)            older Baileys
//   - "3EB0" + 36 characters (40 total)            Baileys
//   - an ID containing a "-"                       some other libraries
//
// LIMITS (be aware):
//   - A bot can only be spotted when it SENDS a message in the group.
//   - Newer bot libraries can produce IDs that look like normal WhatsApp Web
//     messages; those can't be told apart, so they won't be caught.
//   - Bots that drive a real WhatsApp Web / phone also look like real users.
//
// Never acted on: this bot, the owner, group admins.

const { readJson, writeJson } = require('./db');
const logger = require('./logger');
const { getGroupMetadata } = require('./groupCache');
const { digitsFromJid, isOwner, findParticipant, botJids, isAdminRole } = require('./helpers');

const STORE = 'antibot';
const NOTICE_COOLDOWN_MS = 60_000;
const lastNotice = new Map();
const handled = new Set();
setInterval(() => handled.clear(), 5 * 60_000).unref();

function looksLikeBotId(id) {
  if (!id || typeof id !== 'string') return false;
  if (id.startsWith('BAE5') && id.length === 16) return true;
  if (id.startsWith('3EB0') && id.length === 40) return true;
  if (id.includes('-')) return true;
  return false;
}

function getSettings(chatId) {
  const entry = readJson(STORE, {})[chatId] || {};
  return { enabled: Boolean(entry.enabled), action: entry.action === 'kick' ? 'kick' : 'delete' };
}

function save(chatId, patch) {
  const all = readJson(STORE, {});
  all[chatId] = { enabled: false, action: 'delete', ...(all[chatId] || {}), ...patch };
  writeJson(STORE, all);
}

const setEnabled = (chatId, enabled) => save(chatId, { enabled: Boolean(enabled) });
const setAction = (chatId, action) => save(chatId, { action: action === 'kick' ? 'kick' : 'delete' });

/** Called for every incoming group message (see index.js). */
async function handleAntibot(sock, msg) {
  try {
    const chatId = msg.key?.remoteJid;
    if (!chatId?.endsWith('@g.us') || msg.key.fromMe) return;
    if (!looksLikeBotId(msg.key.id)) return; // cheapest check first

    const settings = getSettings(chatId);
    if (!settings.enabled) return;

    if (handled.has(msg.key.id)) return;
    handled.add(msg.key.id);

    const senderJids = [msg.key.participant, msg.key.participantAlt].filter(Boolean);
    if (!senderJids.length) return;
    const senderNum = digitsFromJid(senderJids[0]);

    if (botJids(sock).map(digitsFromJid).some((n) => senderJids.map(digitsFromJid).includes(n))) return;
    if (isOwner(...senderJids)) return;

    let meta = await getGroupMetadata(sock, chatId);
    let sender = findParticipant(meta.participants, ...senderJids);
    if (isAdminRole(sender)) {
      // Re-check with fresh info: the saved copy can be outdated after a demotion.
      meta = (await getGroupMetadata(sock, chatId, { force: true }).catch(() => null)) || meta;
      sender = findParticipant(meta.participants, ...senderJids);
      if (isAdminRole(sender)) return;
    }

    let me = findParticipant(meta.participants, ...botJids(sock));
    if (!isAdminRole(me)) {
      meta = (await getGroupMetadata(sock, chatId, { force: true }).catch(() => null)) || meta;
      me = findParticipant(meta.participants, ...botJids(sock));
      if (!isAdminRole(me)) return; // can't delete or remove without admin rights
    }

    const target = sender?.id || senderJids[0];
    await sock.sendMessage(chatId, { delete: msg.key }).catch((err) =>
      logger.warn({ err: err.message }, '[antibot] delete failed')
    );

    if (settings.action === 'kick') {
      try {
        await sock.groupParticipantsUpdate(chatId, [target], 'remove');
        await sock.sendMessage(chatId, { text: `🤖🚫 Bot account @${senderNum} was *removed*.`, mentions: [target] });
      } catch (err) {
        logger.warn({ err: err.message }, '[antibot] kick failed');
      }
      return;
    }

    if (Date.now() - (lastNotice.get(chatId) || 0) >= NOTICE_COOLDOWN_MS) {
      lastNotice.set(chatId, Date.now());
      await sock
        .sendMessage(chatId, { text: `🤖 A message from @${senderNum} was deleted - other bots aren't allowed here.`, mentions: [target] })
        .catch(() => {});
    }
  } catch (err) {
    logger.error({ err: err.message }, '[antibot] error');
  }
}

module.exports = { handleAntibot, getSettings, setEnabled, setAction, looksLikeBotId };
