module.exports = {
  name: "help",
  description: "Show available commands.",
  async execute(sock, msg, context) {
    const { jid } = context;
    const commandFiles = require("fs").readdirSync(require("path").join(__dirname)).filter((file) => file.endsWith(".js"));
    const helpText = commandFiles
      .map((file) => `.${file.replace(/\.js$/, "")}`)
      .join("\n");

    await sock.sendMessage(jid, { text: `📖 Available commands:\n${helpText}` });
  },
};
