const fs = require("fs");
const path = require("path");
const { LOG_DIR } = require("../config");

function logInfo(message) {
  const line = `[${new Date().toISOString()}] INFO: ${message}\n`;
  fs.appendFileSync(path.join(LOG_DIR, "bot.log"), line, { encoding: "utf8" });
  console.log(message);
}

function logError(error, context = "general") {
  const message = error?.stack || error?.message || String(error);
  const line = `[${new Date().toISOString()}] ERROR [${context}]: ${message}\n`;
  fs.appendFileSync(path.join(LOG_DIR, "errors.log"), line, { encoding: "utf8" });
  console.error(`❌ ${context}: ${message}`);
}

module.exports = { logInfo, logError };
