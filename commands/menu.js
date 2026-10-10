// commands/menu.js
//
// Main menu: bot info, then ONLY command names (no descriptions, no
// blank lines). Everything listed comes from ctx.commands, so it never
// shows a command that doesn't exist.
//
// Layout: the info box is closed; the category sections are open
// (no bottom line); the last section - OWNER ONLY - closes the menu.
//
// To add a game: create commands/<name>.js with category: 'games' and
// an `emoji` - it appears automatically. Order inside a section follows
// ORDER below; commands not listed there go last, alphabetically.
//
// Sent with the bot account's WhatsApp profile picture when it can be
// fetched; otherwise the same menu is sent as plain text.

const config = require('../config');
const ui = require('../lib/ui');
const { formatUptime, digitsFromJid } = require('../lib/helpers');

const SECTIONS = [
  { key: 'general', title: '📌 MAIN' },
  { key: 'ai', title: '🧠 AI' },
  { key: 'utility', title: '🛠️ TOOLS' },
  { key: 'games', title: '🎮 GAMES' },
];
const OWNER_TITLE = '👑 OWNER ONLY';

const ORDER = [
  'menu', 'ping', 'help',
  'ai', 'aimode',
  'profile', 'groupinfo', 'encrypt', 'decrypt',
  'snakegame', 'aimgame',
  'view', 'setmessage', 'promote', 'demote',
];

function byOrder(a, b) {
  const ia = ORDER.indexOf(a.name);
  const ib = ORDER.indexOf(b.name);
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.name.localeCompare(b.name);
}

function entry(cmd, prefix) {
  const aliases = cmd.aliases?.length ? ` (${cmd.aliases.map((a) => prefix + a).join(' ')})` : '';
  return `${cmd.emoji || '•'} ${prefix}${cmd.name}${aliases}`;
}

async function getProfilePictureUrl(sock) {
  try {
    const digits = digitsFromJid(sock.user?.id);
    if (!digits) return null;
    return (await sock.profilePictureUrl(`${digits}@s.whatsapp.net`, 'image')) || null;
  } catch {
    return null; // no photo / hidden by privacy / network - caller falls back to text
  }
}

function buildMenu(sock, ctx) {
  const prefix = config.prefix;
  const ownerName = sock.user?.name || sock.user?.verifiedName || 'Owner';
  const ownerCmds = ctx.commands.filter((c) => c.ownerOnly).sort(byOrder);

  const header = ui.box(
    `🤖 ${config.botName.toUpperCase()}`,
    [
      `👤 Owner: ${ownerName}`,
      `💻 Developer: ${config.botAuthor}`,
      `⚡ Prefix: ${config.prefixes.join(' ')}`,
      `🤖 Bot: ${config.botName}`,
      `📊 Commands: ${ctx.commands.length} (${ownerCmds.length} owner-only)`,
      `⏱️ Uptime: ${formatUptime(process.uptime())}`,
    ],
    { compact: true }
  );

  // Every section with its command lines; owner-only commands go last.
  const sections = [];
  for (const section of SECTIONS) {
    const cmds = ctx.commands.filter((c) => !c.ownerOnly && (c.category || 'general') === section.key).sort(byOrder);
    if (cmds.length) sections.push({ title: section.title, lines: cmds.map((c) => entry(c, prefix)) });
  }
  if (ownerCmds.length) sections.push({ title: OWNER_TITLE, lines: ownerCmds.map((c) => entry(c, prefix)) });

  // Only the LAST section is closed; the others stay open.
  const body = sections.map((s, i) =>
    ui.box(s.title, s.lines, { compact: true, open: i !== sections.length - 1 })
  );

  return [header, ...body, `> ${config.botName} • ${config.botAuthor}`].join('\n');
}

module.exports = {
  name: 'menu',
  aliases: ['m'],
  description: 'Show this menu',
  emoji: '📋',
  category: 'general',
  ownerOnly: false,
  buildMenu, // exported so it can be tested
  async execute(sock, msg, args, ctx) {
    const text = buildMenu(sock, ctx);

    const pictureUrl = await getProfilePictureUrl(sock);
    if (pictureUrl) {
      const sent = await ctx.safeSend(sock, ctx.chatId, { image: { url: pictureUrl }, caption: text }, { quoted: msg });
      if (sent) return;
      ctx.logger.warn('Menu image send failed, falling back to text');
    }
    await ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
  },
};
