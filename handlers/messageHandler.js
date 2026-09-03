const { config } = require("../config");
const { executeCommand } = require("./commandHandler");
const { logInfo } = require("../utils/logger");

function parseCommand(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();

  if (!trimmed.startsWith(".") && !trimmed.startsWith("!")) {
    return null;
  }

  const body = trimmed.slice(1).trim();
  if (!body) return null;

  const [commandName, ...args] = body.split(/\s+/);
  return { commandName: commandName.toLowerCase(), args };
}

function getTextFromMessage(msg) {
  if (!msg || !msg.message) return "";

  const message = msg.message;

  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;

  return "";
}

async function handleIncomingMessage(sock, msg) {
  const jid = msg.key?.remoteJid;
  if (!jid || !msg.message) return;

  const sender = msg.key?.participant || jid;
  const text = getTextFromMessage(msg);
  const parsed = parseCommand(text);

  if (!text) return;

  if (parsed) {
    logInfo(`Command received: ${parsed.commandName} from ${sender}`);

    const handled = await executeCommand(sock, msg, {
      commandName: parsed.commandName,
      args: parsed.args,
      jid,
      sender,
    });

    if (handled) {
      return;
    }

    await sock.sendMessage(jid, {
      text: `❌ Unknown command: .${parsed.commandName}\nUse .menu to see available commands.`,
    });
    return;
  }

  if (config.autoReplyEnabled && !msg.key?.fromMe) {
    await sock.sendMessage(jid, { text: config.autoReply });
  }
}

module.exports = { handleIncomingMessage, parseCommand, getTextFromMessage };
