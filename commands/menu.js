// commands/menu.js
//
// A dedicated, nicely formatted menu. Everything shown here comes from
// ctx.commands (the live list built by lib/commandLoader.js) - nothing
// is hardcoded, so this can never drift out of sync with what commands
// actually exist. Add or remove a file in commands/ and .menu reflects
// it automatically on the next restart.

const config = require('../config');
const pkg = require('../package.json');
const { formatUptime } = require('../lib/helpers');

// Maps each command's `category` field (see lib/commandLoader.js) to a
// menu section, in display order. A category with no matching commands
// is simply skipped.
const SECTIONS = [
  { key: 'general', title: '📌 MAIN MENU' },
  { key: 'ai', title: '🧠 AI' },
  { key: 'utility', title: '🛠️ TOOLS' },
  { key: 'admin', title: '👑 OWNER' },
];

function box(title, bodyLines) {
  const top = `╭━━〔 ${title} 〕━━╮`;
  const bottom = '╰' + '━'.repeat(Math.max(top.length - 2, 12)) + '╯';
  const body = bodyLines.map((line) => `┃ ${line}`).join('\n');
  return `${top}\n┃\n${body}\n┃\n${bottom}`;
}

function formatCommandLine(cmd) {
  const aliases = cmd.aliases?.length
    ? ` (aka ${cmd.aliases.map((a) => config.prefix + a).join(', ')})`
    : '';
  return `• ${config.prefix}${cmd.name}${aliases} — ${cmd.description || ''}`;
}

module.exports = {
  name: 'menu',
  aliases: ['m'],
  description: 'Show the main CyrusBot menu.',
  category: 'general',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const userTag = `@${ctx.senderJid.split('@')[0].split(':')[0]}`;

    const headerLines = [
      `👤 User     : ${userTag}`,
      `⚡ Prefix   : ${config.prefix}`,
      `🧠 Version  : ${pkg.version}`,
      `⏱️ Uptime   : ${formatUptime(process.uptime())}`,
    ];

    // Group the ACTUAL loaded commands by category, hiding owner-only
    // commands from the menu for anyone who isn't the owner (so the
    // menu never advertises commands the reader can't actually use).
    const grouped = {};
    for (const cmd of ctx.commands) {
      if (cmd.ownerOnly && !ctx.isOwner) continue;
      const key = cmd.category || 'general';
      grouped[key] = grouped[key] || [];
      grouped[key].push(cmd);
    }

    let text =
      `╭━━━〔 🤖 ${config.botName.toUpperCase()} 〕━━━╮\n┃\n` +
      headerLines.map((l) => `┃ ${l}`).join('\n') +
      `\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    for (const section of SECTIONS) {
      const cmds = grouped[section.key];
      if (!cmds || cmds.length === 0) continue;
      text += box(section.title, cmds.map(formatCommandLine)) + '\n\n';
    }

    text += `> ${config.botName} • ${config.botAuthor}`;

    await ctx.safeSend(
      sock,
      ctx.chatId,
      { text, mentions: [ctx.senderJid] },
      { quoted: msg }
    );
  },
};
