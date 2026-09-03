const { config } = require("../config");

module.exports = {
  name: "weather",
  description: "Check a sample local weather report.",
  category: "Utility",

  async execute(sock, msg, context) {
    const { jid, args } = context;
    const location = args.join(" ") || "Lagos";

    const conditions = [
      "Sunny and bright",
      "Partly cloudy",
      "Light rain",
      "Warm and breezy",
      "Clear skies",
    ];

    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const temp = Math.floor(20 + Math.random() * 18);

    await sock.sendMessage(jid, {
      text:
        `🌤️ *Weather for ${location}*\n\n` +
        `Condition: ${condition}\n` +
        `Temperature: ${temp}°C\n` +
        `Tip: ${config.prefix}weather <city> for a custom location`,
    });
  },
};
