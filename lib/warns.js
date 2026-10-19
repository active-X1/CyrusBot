// lib/warns.js - warning counts per group member (database/warns.json)
//   { "<groupJid>": { "<digits>": { count, reasons: [...] } } }
const { readJson, writeJson } = require('./db');
const { digitsFromJid } = require('./helpers');

const STORE = 'warns';

/** One stable key per person, whatever address WhatsApp uses for them. */
const keyOf = (participant) => digitsFromJid(participant.phoneNumber || participant.id);

function getWarns(chatId, participant) {
  return readJson(STORE, {})[chatId]?.[keyOf(participant)] || { count: 0, reasons: [] };
}

function addWarn(chatId, participant, reason) {
  const all = readJson(STORE, {});
  all[chatId] = all[chatId] || {};
  const entry = all[chatId][keyOf(participant)] || { count: 0, reasons: [] };
  entry.count += 1;
  if (reason) entry.reasons.push(reason.slice(0, 120));
  all[chatId][keyOf(participant)] = entry;
  writeJson(STORE, all);
  return entry;
}

function resetWarns(chatId, participant) {
  const all = readJson(STORE, {});
  if (all[chatId]) delete all[chatId][keyOf(participant)];
  writeJson(STORE, all);
}

module.exports = { getWarns, addWarn, resetWarns };
