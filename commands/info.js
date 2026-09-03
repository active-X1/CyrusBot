module.exports = {
  name: "info",
  description: "Display bot information.",
  async execute(sock, msg, context) {
    const { jid } = context;
    await sock.sendMessage(jid, { text: "🤖 CyrusBot\nVersion: 1.0.0\nMode: modular Baileys structure" });
  },
};
