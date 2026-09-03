const { config } = require("../config");

module.exports = {
  name: "news",
  description: "Show a quick headline summary.",
  category: "Utility",

  async execute(sock, msg, context) {
    const { jid } = context;
    const headlines = [
      "Global markets continue to recover amid stable interest rates.",
      "Local communities are embracing new digital learning tools.",
      "Tech startups expand AI tools to improve daily productivity.",
      "Sustainable energy projects are gaining momentum worldwide.",
      "Developers focus on cleaner user interfaces and better automation.",
    ];

    const headline = headlines[Math.floor(Math.random() * headlines.length)];

    await sock.sendMessage(jid, {
      text:
        "📰 *Top Story*\n\n" +
        `${headline}\n\n` +
        `Tip: Connect a live API key to replace this starter news feed.`,
    });
  },
};
