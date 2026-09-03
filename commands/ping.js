module.exports = {
  name: "ping",
  description: "Check bot latency and online status.",
  category: "General",

  async execute(sock, msg, context) {
    const { jid } = context;

    const start = Date.now();

    await sock.sendMessage(jid, {
      text: "🏓 Measuring latency...",
    });

    const elapsed = Date.now() - start;

    await sock.sendMessage(jid, {
      text: `🏓 Pong!\nLatency: ${elapsed}ms`,
    });
  },
};