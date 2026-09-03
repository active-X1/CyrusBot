const fs = require("fs");
const path = require("path");

const { ROOT_DIR } = require("../config");
const { logError } = require("../utils/logger");

let commands = null;

function loadCommands(forceReload = false) {
  if (commands && !forceReload) {
    return commands;
  }

  const commandDir = path.join(ROOT_DIR, "commands");
  const loadedCommands = {};

  if (!fs.existsSync(commandDir)) {
    commands = loadedCommands;
    return commands;
  }

  const files = fs
    .readdirSync(commandDir)
    .filter((file) => file.endsWith(".js"));

  for (const file of files) {
    try {
      const fullPath = path.join(commandDir, file);

      delete require.cache[require.resolve(fullPath)];

      const command = require(fullPath);

      if (!command?.name) {
        continue;
      }

      loadedCommands[command.name.toLowerCase()] = command;
    } catch (error) {
      logError(error, `loadCommand:${file}`);
    }
  }

  commands = loadedCommands;

  return commands;
}

function getCommand(name) {
  const commandList = loadCommands();
  return commandList[name?.toLowerCase()];
}

async function executeCommand(sock, msg, context) {
  const {
    commandName,
    args,
    jid,
    sender,
  } = context;

  const command = getCommand(commandName);

  if (!command) {
    return false;
  }

  if (typeof command.execute !== "function") {
    return false;
  }

  try {
    await command.execute(sock, msg, {
      ...context,
      args,
      command,
    });

    return true;
  } catch (error) {
    logError(error, `command:${commandName}`);

    if (sock && jid) {
      await sock.sendMessage(jid, {
        text: `❌ Command .${commandName} failed.`,
      });
    }

    return true;
  }
}

module.exports = {
  loadCommands,
  getCommand,
  executeCommand,
};