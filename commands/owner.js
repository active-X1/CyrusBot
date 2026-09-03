const { config } = require("../config");

module.exports = {
  name: "owner",
  description: "Display owner contact information.",
  category: "General",

  async execute(sock, msg, context) {
    const { jid } = context;

    await sock.sendMessage(jid, {
      text:
        `👑 *CyrusBot Owner*\n\n` +
        `Name: Cyrus\n` +
        `JID: ${config.ownerJid}`,
    });
  },
};