// lib/db.js
// CyrusBot has no external database dependency. Instead it uses small
// JSON files under database/ as a lightweight, dependency-free store.
// This is intentionally simple: fine for per-chat flags and counters,
// NOT meant for high-volume data. If you outgrow this, swap the
// implementation below for SQLite/Postgres/etc. without touching the
// commands that call readJson()/writeJson().
//
// SPEED: every file is read from disk ONCE and then kept in memory.
// readJson() used to hit the disk (synchronously) on every incoming
// message; now it is a memory lookup. writeJson() updates memory right
// away and saves to disk in the background (atomic temp file + rename),
// and any pending writes are flushed when the process exits.
//
// Note: because of the cache, editing a database/*.json file by hand
// while the bot is running has no effect until the bot restarts.

const fs = require('fs');
const path = require('path');
const config = require('../config');

const dbDir = path.resolve(config.paths.database);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const MISSING = Symbol('missing');
const cache = new Map();   // name -> parsed value, or MISSING
const pending = new Map(); // name -> latest data waiting to be written
const writing = new Set(); // names with a disk write in progress

function filePath(name) {
  // Guard against path traversal from a bad "name" argument.
  const safeName = path.basename(name);
  return path.join(dbDir, `${safeName}.json`);
}

function loadFromDisk(name) {
  const file = filePath(name);
  try {
    if (!fs.existsSync(file)) return MISSING;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return MISSING;
    return JSON.parse(raw);
  } catch (err) {
    // Corrupt file shouldn't crash the bot - fall back and let the
    // caller keep working; the next write will repair the file.
    return MISSING;
  }
}

/**
 * Read database/<n>.json (from memory after the first read).
 * Returns `fallback` if the file doesn't exist or fails to parse.
 * The result is a private copy, so callers may modify it freely and
 * must call writeJson() to save changes (same as before).
 */
function readJson(name, fallback = {}) {
  if (!cache.has(name)) cache.set(name, loadFromDisk(name));
  const value = cache.get(name);
  return value === MISSING ? fallback : structuredClone(value);
}

function flushOne(name) {
  if (writing.has(name) || !pending.has(name)) return;
  const data = pending.get(name);
  pending.delete(name);
  writing.add(name);

  const file = filePath(name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.promises
    .writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
    .then(() => fs.promises.rename(tmp, file))
    .catch(() => {})
    .finally(() => {
      writing.delete(name);
      flushOne(name); // newer data arrived while we were writing
    });
}

/**
 * Save data: memory is updated immediately, disk shortly after.
 * Atomic on disk (temp file then rename), so a crash mid-write never
 * leaves a half-written file behind.
 */
function writeJson(name, data) {
  cache.set(name, structuredClone(data));
  pending.set(name, structuredClone(data));
  flushOne(name);
}

// Anything still waiting to be saved is written synchronously on exit.
process.on('exit', () => {
  for (const [name, data] of pending) {
    try {
      const file = filePath(name);
      const tmp = `${file}.${process.pid}.exit.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, file);
    } catch {}
  }
});

module.exports = { readJson, writeJson };
