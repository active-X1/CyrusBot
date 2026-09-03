const quotes = [
  "Success is the sum of small efforts, repeated day in and day out.",
  "Do not wait for opportunity. Create it.",
  "The best way to predict the future is to create it.",
  "Discipline is choosing between what you want most and what you want now.",
  "Small steps every day lead to big results.",
];

module.exports = {
  name: "quote",
  description: "Send a motivational quote.",
  category: "Fun",

  async execute(sock, msg, context) {
    const { jid } = context;
    const quote = quotes[Math.floor(Math.random() * quotes.length)];

    await sock.sendMessage(jid, {
      text: `💬 *Quote*\n\n“${quote}”`,
    });
  },
};
