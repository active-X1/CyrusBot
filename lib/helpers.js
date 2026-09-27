// lib/helpers.js
// Small, well-scoped utilities shared across commands. Keeping JID
// handling in ONE place (instead of every command re-inventing its own
// regex, like the original oxbot-md did) is what makes owner/admin
// checks maintainable.

const config = require('../config');
const logger = require('./logger');

/**
 * Strip a WhatsApp JID down to just its numeric user id, regardless of
 * whether it's a classic @s.whatsapp.net JID, a @lid JID, or has a
 * ":device" suffix attached.
 *   "15551234567:12@s.whatsapp.net" -> "15551234567"
 *   "98765432101234@lid"            -> "98765432101234"
 */
function digitsFromJid(jid) {
  if (!jid) return '';
  const withoutServer = jid.split('@')[0];
  return withoutServer.split(':')[0];
}

/**
 * Is this sender the configured bot owner (or in SUDO_NUMBERS)?
 * Compares plain digits only, so it's resilient to the
 * @s.whatsapp.net vs @lid inconsistency WhatsApp itself introduced.
 */
function isOwner(senderJid) {
  const senderDigits = digitsFromJid(senderJid);
  if (!senderDigits) return false;
  if (senderDigits === config.ownerNumber) return true;
  return config.sudoNumbers.includes(senderDigits);
}

/**
 * Is this sender an admin of the given group? Returns false (never
 * throws) for DMs or if metadata can't be fetched, so callers can use
 * it unconditionally.
 */
async function isGroupAdmin(sock, chatId, senderJid) {
  if (!chatId.endsWith('@g.us')) return false;
  try {
    const metadata = await sock.groupMetadata(chatId);
    const senderDigits = digitsFromJid(senderJid);
    return (metadata.participants || []).some((p) => {
      const isAdminRole = p.admin === 'admin' || p.admin === 'superadmin';
      return isAdminRole && digitsFromJid(p.id) === senderDigits;
    });
  } catch (err) {
    logger.warn({ err: err.message, chatId }, 'Failed to fetch group metadata for admin check');
    return false;
  }
}

/** True if the sender may manage settings for this chat (owner/sudo, or a group admin). */
async function canManageChat(sock, chatId, senderJid) {
  if (isOwner(senderJid)) return true;
  return isGroupAdmin(sock, chatId, senderJid);
}

/**
 * Send a message and swallow/log any error instead of throwing, so a
 * failed reply (e.g. because the chat was left, or a network blip)
 * never takes the whole bot down.
 */
async function safeSend(sock, chatId, content, options = {}) {
  try {
    return await sock.sendMessage(chatId, content, options);
  } catch (err) {
    logger.error({ err: err.message, chatId }, 'Failed to send message');
    return null;
  }
}

/** Extract the plain text body of an incoming message, or '' if none. */
function extractText(message) {
  const m = message.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).trim();
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = {
  digitsFromJid,
  isOwner,
  isGroupAdmin,
  canManageChat,
  safeSend,
  extractText,
  formatUptime,
};
