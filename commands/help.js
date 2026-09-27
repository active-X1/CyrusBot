// commands/help.js
// Note: this used to have aliases: ['menu'], but commands/menu.js is
// now its own dedicated command with that exact name - keeping the
// alias here would collide with it in lib/commandLoader.js's registry.
const config = require('../config');

module.exports = {
  name: 'help',
  aliases: [],
  description: 'List available commands.',
  category: 'general',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const { commands } = ctx;
    const prefix = config.prefix;

    if (args[0]) {
      const target = args[0].toLowerCase().replace(prefix, '');
      const cmd = commands.find((c) => c.name === target || (c.aliases || []).includes(target));
      if (!cmd) {
        return ctx.safeSend(sock, ctx.chatId, { text: `No command named "${target}" found.` }, { quoted: msg });
      }
      const aliasLine = cmd.aliases?.length ? `\nAliases: ${cmd.aliases.map((a) => prefix + a).join(', ')}` : '';
      const ownerLine = cmd.ownerOnly ? '\nOwner only: yes' : '';
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: `*${prefix}${cmd.name}*\n${cmd.description || 'No description.'}${aliasLine}${ownerLine}` },
        { quoted: msg }
      );
    }

    const byCategory = {};
    for (const cmd of commands) {
      const cat = cmd.category || 'general';
      byCategory[cat] = byCategory[cat] || [];
      byCategory[cat].push(cmd);
    }

    let text = `🤖 *${config.botName}* — by ${config.botAuthor}\nPrefix: "${prefix}"\n`;
    for (const [category, cmds] of Object.entries(byCategory)) {
      text += `\n*${category.toUpperCase()}*\n`;
      for (const cmd of cmds) {
        text += `• ${prefix}${cmd.name} — ${cmd.description || ''}\n`;
      }
    }
    text += `\nTip: send "${prefix}help <command>" for details on one command.`;

    await ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
  },
};
