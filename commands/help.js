// commands/help.js
// ".help"           -> quick boxed list of every command name
// ".help <command>" -> details for one command (aliases, owner-only)
// (.menu is the full, prettier overview; commands/menu.js owns the name "menu".)
const config = require('../config');
const ui = require('../lib/ui');
const { matchPrefix } = require('../lib/helpers');

module.exports = {
  name: 'help',
  aliases: [],
  description: 'Help & command details',
  emoji: '❓',
  category: 'general',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const { commands } = ctx;
    const prefix = config.prefix;
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });

    if (args[0]) {
      const raw = args[0].toLowerCase();
      const target = matchPrefix(raw, config.prefixes)?.rest || raw;
      const cmd = commands.find((c) => c.name === target || (c.aliases || []).includes(target));
      if (!cmd) return reply(ui.error(`No command named "${target}" found.\nTry ${prefix}menu`));

      const lines = [`📝 ${cmd.description || 'No description.'}`];
      if (cmd.aliases?.length) lines.push(`🔀 Aliases : ${cmd.aliases.map((a) => prefix + a).join(', ')}`);
      lines.push(`🔐 Access  : ${cmd.ownerOnly ? '👑 Owner only' : '🌍 Everyone'}`);
      return reply(ui.box(`${cmd.emoji || '📌'} ${prefix}${cmd.name}`, lines));
    }

    const names = commands.map((c) => `${prefix}${c.name}`);
    return reply(
      ui.box('❓ HELP', [
        `📊 ${commands.length} commands available`,
        `⚡ Prefix : ${config.prefixes.join(' ')}`,
        '',
        names.join('  '),
        '',
        `📖 ${prefix}help <command> for details`,
        `📋 ${prefix}menu for the full menu`,
      ])
    );
  },
};
