const facts = [
  "Octopuses have three hearts.",
  "Honey never spoils.",
  "A day on Venus is longer than a year on Venus.",
  "Bananas are berries, but strawberries are not.",
  "There are more possible iterations of a chess game than atoms in the observable universe.",
];

module.exports = {
  name: "fact",
  description: "Send a random fact.",
  category: "Fun",

  async execute(sock, msg, context) {
    const { jid } = context;
    const fact = facts[Math.floor(Math.random() * facts.length)];

    await sock.sendMessage(jid, {
      text: `🧠 *Fact*\n\n${fact}`,
    });
  },
};
