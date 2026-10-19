// lib/chatLog.js
// Remembers the last few text messages of each chat IN MEMORY ONLY (nothing is
// written to disk and it is cleared on restart). Used by .summarize.
const config = require('../config');
const { messageText } = require('./antilink');
const { digitsFromJid } = require('./helpers');

const PER_CHAT = 100;
const MAX_CHATS = 300;
const MAX_TEXT = 400;

const logs = new Map(); // chatId -> [{ name, text, ts }]

function record(msg) {
  const chatId = msg.key?.remoteJid;
  if (!chatId || chatId === 'status@broadcast' || chatId.endsWith('@newsletter')) return;

  const text = messageText(msg.message).trim();
  if (!text) return;
  if (config.prefixes.some((p) => text.startsWith(p))) return; // commands aren't conversation

  let list = logs.get(chatId);
  if (!list) {
    if (logs.size >= MAX_CHATS) logs.delete(logs.keys().next().value); // drop the oldest chat
    list = [];
    logs.set(chatId, list);
  }
  const who = msg.key.fromMe ? 'Me' : msg.pushName || digitsFromJid(msg.key.participant || chatId);
  list.push({ name: who, text: text.slice(0, MAX_TEXT), ts: Date.now() });
  if (list.length > PER_CHAT) list.splice(0, list.length - PER_CHAT);
}

function last(chatId, n) {
  return (logs.get(chatId) || []).slice(-n);
}

module.exports = { record, last };
