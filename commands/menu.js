const { loadCommands } = require("../handlers/commandHandler");
const { config } = require("../config");

module.exports = {
  name: "menu",
  description: "Display the main command menu.",
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
    text += `║ *${config.botName}* ║\n`;
    text += `║ Version: *${config.version}* ║\n`;
    text += "╚═══════════════════╝\n\n";

    for (const [category, categoryCommands] of Object.entries(grouped)) {
      if (!categoryCommands.length) {
        continue;
      }

      text += `*${category} Commands*\n`;

      for (const command of categoryCommands) {
        text += `➤ ${config.prefix}${command.name}\n`;
      }

      text += "\n";
    }

    await sock.sendMessage(jid, {
      text: text.trim(),
    });
  },
};