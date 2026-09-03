const jokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I told my computer I needed a break, and now it won’t stop sending me vacation ads.",
  "A clean room is a sign of a broken computer.",
  "I used to be addicted to the hokey pokey, but then I turned myself around.",
  "Why did the developer go broke? Because he used up all his cache.",
];

module.exports = {
  name: "joke",
  description: "Send a random joke.",
  category: "Fun",

  async execute(sock, msg, context) {
    const { jid } = context;
    const joke = jokes[Math.floor(Math.random() * jokes.length)];

    await sock.sendMessage(jid, {
      text: `😂 *Joke*\n\n${joke}`,
    });
  },
};
