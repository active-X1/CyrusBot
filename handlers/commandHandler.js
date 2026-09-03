const fs = require("fs");
const path = require("path");

const {
  ROOT_DIR,
  config,
  normalizePhoneNumber,
} = require("../config");
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

  const isGroupChat = Boolean(jid && jid.endsWith("@g.us"));

  if (command.groupOnly && !isGroupChat) {
    if (sock && jid) {
      await sock.sendMessage(jid, {
        text: "⚠️ This command can only be used in groups.",
      });
    }
    return true;
  }

  if (command.ownerOnly) {
    const senderJid = (sender || jid || "").replace(/:.+$/, "");
    const ownerJid = (config.ownerJid || "").replace(/:.+$/, "");
    const senderNumber = normalizePhoneNumber(senderJid);
    const ownerNumber = normalizePhoneNumber(
      config.ownerNumber || ownerJid
    );

    if (!senderNumber || senderNumber !== ownerNumber) {
      if (sock && jid) {
        await sock.sendMessage(jid, {
          text: "🔒 This command is only available to the bot owner.",
        });
      }
      return true;
    }
  }

  if (command.adminOnly && isGroupChat && sock && jid) {
    try {
      const metadata = await sock.groupMetadata(jid);
      const normalizedSender = (sender || jid).replace(/:.+$/, "");
      const senderIsAdmin = (metadata?.participants || []).some((member) => {
        const memberId = (member.id || "").replace(/:.+$/, "");
        const isAdmin = ["admin", "superadmin"].includes(member?.admin || "");
        return memberId === normalizedSender && isAdmin;
      });

      if (!senderIsAdmin) {
        await sock.sendMessage(jid, {
          text: "❌ Only group admins can use this command.",
        });
        return true;
      }
    } catch (error) {
      // If metadata cannot be loaded, fail closed for admin-only commands.
      await sock.sendMessage(jid, {
        text: "❌ I could not verify admin rights for this command.",
      });
      return true;
    }
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