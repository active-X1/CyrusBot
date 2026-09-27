// lib/logger.js
// A single shared logger instance. Writes human-readable lines to the
// console and structured JSON lines to logs/bot.log. We deliberately do
// NOT log full message bodies or credentials.

const fs = require('fs');
const path = require('path');
const pino = require('pino');
const config = require('../config');

const logsDir = path.resolve(config.paths.logs);
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'bot.log');

// pino.destination writes raw JSON lines to the file; the console gets a
// lighter, friendlier stream via pino's default (no pretty-printer
// dependency required, so this works with just `pino` installed).
const fileStream = pino.destination({ dest: logFilePath, sync: false });

const logger = pino(
  {
    level: config.logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: undefined, // omit pid/hostname noise
  },
  pino.multistream([
    { stream: process.stdout },
    { stream: fileStream },
  ])
);

module.exports = logger;
