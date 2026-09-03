module.exports = {
  name: "hello",
  description: "Say hello to the bot.",
  async execute(sock, msg, context) {
    const { jid } = context;
    await sock.sendMessage(jid, { text: "👋 Hello! CyrusBot is online." });
  },
};
