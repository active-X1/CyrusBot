// lib/mode.js
// Bot mode: "public" (everyone can use the bot) or "private" (only the owner
// gets any reply - commands, AI mode and auto-replies are all ignored for
// everyone else). Saved in database/mode.json, so it survives restarts.
const { readJson, writeJson } = require('./db');

const STORE = 'mode';

function getMode() {
  return readJson(STORE, {}).mode === 'private' ? 'private' : 'public';
}

function setMode(mode) {
  writeJson(STORE, { mode: mode === 'private' ? 'private' : 'public' });
}

module.exports = { getMode, setMode };
