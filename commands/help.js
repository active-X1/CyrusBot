const { loadCommands } = require("../handlers/commandHandler");
const { config } = require("../config");

module.exports = {
  name: "help",
  description: "Show available commands.",
  category: "General",

  async execute(sock, msg, context) {
    const { jid } = context;
    const commands = Object.values(loadCommands())
      .filter((command) => command?.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    const grouped = {
      General: [],
      Fun: [],
      Utility: [],
    };

    for (const command of commands) {
      const category = command.category || "General";

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(command);
    }

    let text = "╔═══════════════════╗\n";
    text += `║ *${config.botName} Help* ║\n`;
    text += "╚═══════════════════╝\n\n";

    text += "*Core group controls*\n";
    text += `• ${config.prefix}antilink — toggle link protection\n`;
    text += `• ${config.prefix}antibadword — toggle bad-word protection\n`;
    text += `• ${config.prefix}warn — warn a user\n`;
    text += `• ${config.prefix}warnings — show a user's warning count\n\n`;

    for (const [category, categoryCommands] of Object.entries(grouped)) {
      if (!categoryCommands.length) {
        continue;
      }

      text += `*${category} Commands*\n`;

      for (const command of categoryCommands) {
        text +=
          `• ${config.prefix}${command.name} — ${command.description || "No description"}\n`;
      }

      text += "\n";
    }

    await sock.sendMessage(jid, {
      text: text.trim(),
    });
  },
};