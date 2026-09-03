module.exports = {
  name: "owner",
  description: "Display owner contact information.",
  async execute(sock, msg, context) {
    const { jid } = context;
    await sock.sendMessage(jid, { text: "👑 Owner: Cyrus" });
  },
};
