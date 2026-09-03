const { config } = require("../config");

const {
  loadCommands,
} = require("../handlers/commandHandler");

module.exports = {
  name: "info",
  description: "Display bot information.",
  category: "General",

  async execute(sock, msg, context) {
    const { jid } = context;
    const commands = loadCommands();

    const text =
      `🤖 *${config.botName}*\n\n` +
      `📦 Version: ${config.version}\n` +
      `⚡ Mode: Modular Baileys\n` +
      `🧩 Commands: ${Object.keys(commands).length}\n` +
      `🌍 Timezone: ${config.timezone}\n` +
      `👑 Owner: Cyrus`;

    await sock.sendMessage(jid, {
      text,
    });
  },
};