// lib/rateLimiter.js
// Tracks how many AI replies each chat (JID) has used today and enforces
// config.aiDailyLimit. Storage: database/ai-usage.json, shape:
//   { "<jid>": { "date": "2026-09-27", "count": 3 } }
// The counter resets automatically the first time a new local date is seen
// for that JID - no cron job or scheduler needed.

const { readJson, writeJson } = require('./db');
const config = require('../config');

const STORE_NAME = 'ai-usage';

function todayKey() {
  // Local date, e.g. "2026-09-27". Using local time keeps "resets at
  // midnight" intuitive for whoever is running the bot.
  return new Date().toISOString().slice(0, 10);
}

/**
 * Check whether `jid` still has AI replies left today.
 * @returns {{ allowed: boolean, remaining: number, limit: number }}
 */
function checkLimit(jid) {
  const usage = readJson(STORE_NAME, {});
  const today = todayKey();
  const entry = usage[jid];

  if (!entry || entry.date !== today) {
    return { allowed: true, remaining: config.aiDailyLimit, limit: config.aiDailyLimit };
  }

  const remaining = Math.max(0, config.aiDailyLimit - entry.count);
  return { allowed: remaining > 0, remaining, limit: config.aiDailyLimit };
}

/** Record one AI reply having been used for `jid` today. */
function recordUsage(jid) {
  const usage = readJson(STORE_NAME, {});
  const today = todayKey();
  const entry = usage[jid];

  if (!entry || entry.date !== today) {
    usage[jid] = { date: today, count: 1 };
  } else {
    entry.count += 1;
  }
  writeJson(STORE_NAME, usage);
}

module.exports = { checkLimit, recordUsage };
