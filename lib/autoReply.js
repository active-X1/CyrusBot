// lib/autoReply.js
//
// Decides whether to send the owner's auto-reply (set with .setmessage)
// for an incoming message, and sends it.
//
//   - Never replies to the account's own messages.
//   - DMs: replies, once per day per chat.
//   - Groups: ONLY when the account is @mentioned or one of its
//     messages is replied to - once per day per person per group.
//
// `getAutoReply` is passed in (from commands/setmessage.js) and returns
// '' when no message is set or the feature is switched off.

const { readJson, writeJson } = require('./db');
const { safeSend, isDirectedAtMe } = require('./helpers');

function maybeSendAutoReply(sock, msg, { chatId, senderJid, isGroup }, getAutoReply) {
  if (msg.key.fromMe) return false;
  if (isGroup && !isDirectedAtMe(sock, msg)) return false;

  const autoReply = getAutoReply?.();
  if (!autoReply) return false;

  const today = new Date().toISOString().slice(0, 10);
  const logKey = isGroup ? `${chatId}|${senderJid}` : chatId;
  const sentLog = readJson('autoreply-sent', {});
  if (sentLog[logKey] === today) return false;

  // Keep only today's entries so this file can't grow forever.
  const fresh = Object.fromEntries(Object.entries(sentLog).filter(([, day]) => day === today));
  fresh[logKey] = today;
  writeJson('autoreply-sent', fresh);

  safeSend(sock, chatId, { text: autoReply }, isGroup ? { quoted: msg } : {});
  return true;
}

module.exports = { maybeSendAutoReply };
