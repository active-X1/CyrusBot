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
 * Is any of these JIDs the configured bot owner (or in SUDO_NUMBERS)?
 * Pass every address form you have (e.g. the sender plus the message's
 * participantAlt) - WhatsApp may identify the same person by phone
 * number OR by an @lid, and either may match. Compares plain digits.
 */
function isOwner(...jids) {
  return jids.some((jid) => {
    const digits = digitsFromJid(jid);
    return Boolean(digits) && (digits === config.ownerNumber || config.sudoNumbers.includes(digits));
  });
}

/**
 * Does this group participant match any of the given JIDs? A participant
 * can be listed by phone number (id), by @lid, and may carry the other
 * form in phoneNumber/lid - we compare against all of them.
 */
function sameUser(participant, ...jids) {
  const ids = [participant.id, participant.phoneNumber, participant.lid].map(digitsFromJid).filter(Boolean);
  return jids.map(digitsFromJid).filter(Boolean).some((digits) => ids.includes(digits));
}

function findParticipant(participants, ...jids) {
  return (participants || []).find((p) => sameUser(p, ...jids)) || null;
}

/** The bot account's own addresses (phone and lid forms). */
function botJids(sock) {
  return [sock.user?.id, sock.user?.lid].filter(Boolean);
}

function isAdminRole(participant) {
  return participant?.admin === 'admin' || participant?.admin === 'superadmin';
}

/**
 * Is this sender an admin of the given group? Returns false (never
 * throws) for DMs or if metadata can't be fetched.
 */
async function isGroupAdmin(sock, chatId, senderJid, altJid) {
  if (!chatId.endsWith('@g.us')) return false;
  try {
    const metadata = await sock.groupMetadata(chatId);
    return isAdminRole(findParticipant(metadata.participants, senderJid, altJid));
  } catch (err) {
    logger.warn({ err: err.message, chatId }, 'Failed to fetch group metadata for admin check');
    return false;
  }
}

/** True if the sender may manage settings for this chat (owner/sudo, or a group admin). */
async function canManageChat(sock, chatId, senderJid, altJid) {
  if (isOwner(senderJid, altJid)) return true;
  return isGroupAdmin(sock, chatId, senderJid, altJid);
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

/**
 * Central prefix matcher. Checks `text` against every prefix in
 * `prefixes` (longest first, so e.g. a future two-character prefix
 * would never be shadowed by a one-character one) and returns the
 * prefix that matched plus the remaining text, or null if none did.
 * This is the ONLY place prefix matching happens - commands never
 * check for a prefix themselves, so supporting more than one prefix
 * never requires touching individual command files.
 */
function matchPrefix(text, prefixes) {
  const sorted = [...prefixes].sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (prefix && text.startsWith(prefix)) {
      return { prefix, rest: text.slice(prefix.length) };
    }
  }
  return null;
}

/**
 * Was this message aimed at the bot's own account? True when the account
 * is @mentioned, or the message is a reply to one of the account's own
 * messages. Compares plain digits, so phone-style (@s.whatsapp.net) and
 * @lid identifiers both work.
 */
function isDirectedAtMe(sock, msg) {
  const myIds = [sock.user?.id, sock.user?.lid].map(digitsFromJid).filter(Boolean);
  if (myIds.length === 0) return false;

  // contextInfo lives inside whichever content type the message has
  // (extendedTextMessage, imageMessage, ...).
  const content = msg.message || {};
  const contextInfo = Object.values(content).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo;
  if (!contextInfo) return false;

  const mentioned = (contextInfo.mentionedJid || []).some((jid) => myIds.includes(digitsFromJid(jid)));
  const repliedToMe = contextInfo.participant ? myIds.includes(digitsFromJid(contextInfo.participant)) : false;
  return mentioned || repliedToMe;
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
  sameUser,
  findParticipant,
  botJids,
  isAdminRole,
  isGroupAdmin,
  canManageChat,
  safeSend,
  extractText,
  formatUptime,
  matchPrefix,
  isDirectedAtMe,
};
