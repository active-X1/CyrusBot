const { config } = require("../config");

module.exports = {
  name: "tts",
  description: "Prepare text for text-to-speech use.",
  category: "Utility",

  async execute(sock, msg, context) {
    const { jid, args } = context;
    const text = args.join(" ");

    if (!text) {
      await sock.sendMessage(jid, {
        text: `🔊 Usage: ${config.prefix}tts <text>`,
      });
      return;
    }

    await sock.sendMessage(jid, {
      text: `🔊 *TTS*\n\n${text}`,
    });
  },
};
