module.exports = {
  name: "menu",
  description: "Display the command menu.",
  async execute(sock, msg, context) {
    const { jid } = context;
    const text = `🤖 CyrusBot\n\nAvailable commands:\n.hello\n.ping\n.menu\n.help`;
    await sock.sendMessage(jid, { text });
  },
};
