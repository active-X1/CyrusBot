const {
  loadCommands,
} = require("../handlers/commandHandler");

const { config } = require("../config");

module.exports = {
  name: "menu",
  description: "Display the command menu.",
  category: "General",

  async execute(sock, msg, context) {
    const { jid } = context;
    const commands = loadCommands();

    const grouped = {};

    for (const command of Object.values(commands)) {
      const category = command.category || "Other";

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(command);
    }

    let text =
      `🤖 *${config.botName}*\n` +
      `📌 Version: ${config.version}\n\n`;

    for (const [category, categoryCommands] of Object.entries(
      grouped
    )) {
      text += `╭─❖ *${category}*\n`;

      for (const command of categoryCommands) {
        text +=
          `│ ${config.prefix}${command.name}` +
          ` — ${command.description || "No description"}\n`;
      }

      text += "╰───────────────\n\n";
    }

    await sock.sendMessage(jid, {
      text: text.trim(),
    });
  },
};