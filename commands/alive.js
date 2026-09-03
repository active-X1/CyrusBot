const { config } = require("../config");

module.exports = {
  name: "alive",
  description: "Check whether the bot is running.",
  category: "General",

  async execute(sock, msg, context) {
    const { jid } = context;

    await sock.sendMessage(jid, {
      text:
        `✅ *${config.botName} is alive!*\n\n` +
        `🤖 Status: Online\n` +
        `⚡ Version: ${config.version}\n` +
        `📌 Type ${config.prefix}menu for the command list`,
    });
  },
};