module.exports = {
  name: "alive",
  description: "Check whether the bot is running.",
  async execute(sock, msg, context) {
    const { jid } = context;
    await sock.sendMessage(jid, { text: "✅ CyrusBot is alive and ready." });
  },
};
