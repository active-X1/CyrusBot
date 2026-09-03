const {
  loadCommands,
} = require("../handlers/commandHandler");

const { config } = require("../config");

module.exports = {
  name: "help",
  description: "Show available commands.",
  category: "General",

  async execute(sock, msg, context) {
    const { jid } = context;
    const commands = loadCommands();

    let text = `📖 *${config.botName} Help*\n\n`;

    for (const command of Object.values(commands)) {
      text +=
        `${config.prefix}${command.name}\n` +
        `└─ ${command.description || "No description"}\n\n`;
    }

    await sock.sendMessage(jid, {
      text: text.trim(),
    });
  },
};