const fs = require("fs");
const path = require("path");
const { ROOT_DIR } = require("../config");
const { logError } = require("../utils/logger");

function loadCommands() {
  const commandDir = path.join(ROOT_DIR, "commands");
  const commands = {};

  if (!fs.existsSync(commandDir)) {
    return commands;
  }

  for (const file of fs.readdirSync(commandDir)) {
    if (!file.endsWith(".js")) continue;

    const fullPath = path.join(commandDir, file);
    const command = require(fullPath);

    if (command && command.name) {
      commands[command.name] = command;
    }
  }

  return commands;
}

async function executeCommand(sock, msg, context) {
  const { commandName, args, jid, sender } = context;
  const commands = loadCommands();
  const command = commands[commandName];

  if (!command) {
    return false;
  }

  try {
    if (typeof command.execute === "function") {
      await command.execute(sock, msg, { ...context, args });
      return true;
    }
  } catch (error) {
    logError(error, `command:${commandName}`);
    if (sock && jid) {
      await sock.sendMessage(jid, { text: `❌ Command .${commandName} failed.` });
    }
  }

  return false;
}

module.exports = { loadCommands, executeCommand };
