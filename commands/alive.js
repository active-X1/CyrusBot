module.exports = {
  name: "alive",
  description: "Check whether the bot is running.",
  category: "General",

  async execute(sock, msg, context) {
    const { jid } = context;

    await sock.sendMessage(jid, {
      text:
        "✅ *CyrusBot is alive!*\n\n" +
        "🤖 Status: Online\n" +
        "⚡ Ready: Yes",
    });
  },
};