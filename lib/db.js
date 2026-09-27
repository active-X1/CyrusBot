// lib/db.js
// CyrusBot has no external database dependency. Instead it uses small
// JSON files under database/ as a lightweight, dependency-free store.
// This is intentionally simple: fine for per-chat flags and counters,
// NOT meant for high-volume data. If you outgrow this, swap the
// implementation below for SQLite/Postgres/etc. without touching the
// commands that call readJson()/writeJson().

const fs = require('fs');
const path = require('path');
const config = require('../config');

const dbDir = path.resolve(config.paths.database);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

function filePath(name) {
  // Guard against path traversal from a bad "name" argument.
  const safeName = path.basename(name);
  return path.join(dbDir, `${safeName}.json`);
}

/**
 * Read a JSON file from database/<name>.json.
 * Returns `fallback` if the file doesn't exist or fails to parse.
 */
function readJson(name, fallback = {}) {
  const file = filePath(name);
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    // Corrupt file shouldn't crash the bot - fall back and let the
    // caller keep working; the next write will repair the file.
    return fallback;
  }
}

/**
 * Write a JSON file atomically: write to a temp file then rename, so a
 * crash mid-write never leaves a half-written/corrupt file behind.
 */
function writeJson(name, data) {
  const file = filePath(name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

module.exports = { readJson, writeJson };
