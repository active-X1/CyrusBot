// lib/gameServer.js
//
// Serves the static game HTML files (games/*.html) over HTTP using only
// Node's built-in "http" and "fs" modules - no new dependency.
//
// WHY THIS EXISTS (read this before assuming WhatsApp "renders HTML
// inline"): there is no real WhatsApp feature, official or otherwise,
// that takes a raw HTML/CSS/JS document and executes it as a native
// in-chat-bubble WebView. The closest real thing is tapping a link and
// having WhatsApp Android open it in its in-app browser overlay, which
// still requires the page to be reachable over HTTP from the phone.
// This module is what makes that link real: CyrusBot hosts the game
// itself, so nothing is sent to a third-party site.
//
// Started ONCE in index.js, before the reconnect loop (same pattern as
// lib/authSetup.js), not per-message and not per-reconnect.

const fs = require('fs');
const http = require('http');
const path = require('path');
const config = require('../config');
const logger = require('./logger');
const ui = require('./ui');

const GAMES_DIR = path.resolve(config.paths.games);

// Every playable game is registered here with its route and file. To
// add a new game later: drop the HTML file in games/, add one line
// here, and (per lib/commandLoader.js) a matching commands/<name>.js
// that calls buildGameLink()/sendGame() - no other change needed.
const GAMES = {
  snake: { file: 'snake.html', title: '🐍 Snake' },
  aim: { file: 'aim.html', title: '🎯 Aim Challenge' },
};

let server = null;

function handler(req, res) {
  const url = (req.url || '/').split('?')[0];
  const match = Object.entries(GAMES).find(([key]) => url === `/games/${key}`);

  if (!match) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const [, game] = match;
  const filePath = path.join(GAMES_DIR, game.file);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      logger.error({ err: err.message, filePath }, 'Failed to read game file');
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal error loading game');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

/**
 * Start the game server exactly once. Safe to call repeatedly - a
 * second call is a no-op, so this can live in index.js without any
 * extra bookkeeping at the call site.
 */
function startGameServer() {
  if (server) return server;

  server = http.createServer(handler);
  server.on('error', (err) => {
    logger.error({ err: err.message }, 'Game server error');
  });
  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'Game server listening');
  });
  return server;
}

/**
 * Build the public URL for a game, or null if no public URL is
 * configured (see config.publicUrl). Callers MUST handle null by
 * falling back to sending the file directly instead of a link.
 */
function buildGameLink(gameKey) {
  if (!config.publicUrl) return null;
  if (!GAMES[gameKey]) return null;
  return `${config.publicUrl}/games/${gameKey}`;
}

function getGameFilePath(gameKey) {
  if (!GAMES[gameKey]) return null;
  return path.join(GAMES_DIR, GAMES[gameKey].file);
}

/**
 * Send a game to a chat: a tappable link if a public URL is available
 * (opens in WhatsApp's in-app browser overlay), otherwise the raw
 * self-contained HTML file as a document attachment (fully playable
 * once opened, just not "inside" WhatsApp). Never throws - any failure
 * is caught and reported back as a normal chat message instead of
 * crashing the command.
 */
async function sendGame(sock, chatId, msg, gameKey, safeSend) {
  const game = GAMES[gameKey];
  if (!game) {
    await safeSend(sock, chatId, { text: ui.error(`Unknown game "${gameKey}".`) }, { quoted: msg });
    return;
  }

  const link = buildGameLink(gameKey);

  if (link) {
    await safeSend(
      sock,
      chatId,
      {
        text: ui.box(game.title, ['👆 Tap to play:', link, '', 'ℹ️ Opens in the in-app browser.', '🔒 Runs on your device - no data sent to the bot.']),
      },
      { quoted: msg }
    );
    return;
  }

  // No public URL available (e.g. running locally, or deployed as a
  // Render Background Worker instead of a Web Service) - fall back to
  // sending the fully self-contained HTML file itself.
  try {
    const filePath = getGameFilePath(gameKey);
    const buffer = fs.readFileSync(filePath);
    await safeSend(
      sock,
      chatId,
      {
        document: buffer,
        mimetype: 'text/html',
        fileName: `${gameKey}.html`,
        caption: ui.box(game.title, ['📎 No public link configured,', 'so here is the game file.', '🌐 Open it in a browser to play.']),
      },
      { quoted: msg }
    );
  } catch (err) {
    logger.error({ err: err.message, gameKey }, 'Failed to send game file fallback');
    await safeSend(
      sock,
      chatId,
      { text: ui.error(`Couldn't load ${game.title} right now. Try again later.`) },
      { quoted: msg }
    );
  }
}

module.exports = { startGameServer, buildGameLink, getGameFilePath, sendGame, GAMES };
