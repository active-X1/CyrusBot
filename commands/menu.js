// commands/menu.js
//
// Main menu: bot info, then GENERAL commands, then ADMIN COMMANDS (a
// separate block), then OWNER ONLY. Built from ctx.commands, so it only
// ever lists commands that exist. A command appears automatically when its
// file sets `category` ("general" | "ai" | "utility" | "games" | "admin")
// and optionally `usage` (e.g. "@user"). Order follows ORDER below.
//
// Sent with the bot account's profile picture when it can be fetched;
// otherwise the same menu is sent as plain text.

const config = require('../config');
const ui = require('../lib/ui');
const { formatUptime, digitsFromJid } = require('../lib/helpers');

// General commands first (each in its own block), then ADMIN COMMANDS as a
// separate block, then OWNER ONLY.
const SECTIONS = [
  { key: 'general', title: '📌 GENERAL COMMANDS' },
  { key: 'ai', title: '🧠 AI' },
  { key: 'utility', title: '🛠️ TOOLS' },
  { key: 'games', title: '🎮 GAMES' },
];
const ADMIN_TITLE = '👮 ADMIN COMMANDS';
const OWNER_TITLE = '👑 OWNER ONLY';
const BULLET = '│ ➜ ';

const ORDER = [
  'menu', 'ping', 'help', 'owner', 'weather', 'mode',
  'ai', 'imagine', 'aimode', 'translate', 'summarize',
  'profile', 'groupinfo', 'warns', 'encrypt', 'decrypt',
  'snakegame', 'aimgame',
  'groupimg', 'tagall', 'hidetag', 'kick', 'warn', 'resetwarn', 'mute', 'unmute', 'antilink', 'antibot', 'welcome', 'goodbye', 'link', 'revoke', 'promote', 'demote',
  'view', 'setmessage', 'broadcast', 'stats', 'block', 'unblock',
];

function byOrder(a, b) {
  const ia = ORDER.indexOf(a.name);
  const ib = ORDER.indexOf(b.name);
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.name.localeCompare(b.name);
}

function entry(cmd, prefix) {
  const usage = cmd.usage ? ` ${cmd.usage}` : '';
  const aliases = cmd.aliases?.length ? ` (${cmd.aliases.map((a) => prefix + a).join(' ')})` : '';
  return `${prefix}${cmd.name}${usage}${aliases}`;
}

// The bot's own picture rarely changes, so remember it for 15 minutes instead of
// asking WhatsApp and re-downloading it on every .menu.
const PIC_TTL_MS = 15 * 60_000;
let picCache = null; // { url, buffer, ts }

async function getProfilePicture(sock) {
  if (picCache && Date.now() - picCache.ts < PIC_TTL_MS) return picCache;
  try {
    const digits = digitsFromJid(sock.user?.id);
    if (!digits) return null;
    const url = await sock.profilePictureUrl(`${digits}@s.whatsapp.net`, 'image');
    if (!url) return null;
    let buffer = null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) buffer = Buffer.from(await res.arrayBuffer());
    } catch {}
    picCache = { url, buffer, ts: Date.now() };
    return picCache;
  } catch {
    return null; // no photo / hidden by privacy / network - caller falls back to text
  }
}

// Who to greet: the sender's digits, and a clean JID (no ":device" part)
// so WhatsApp turns "@digits" into a real mention.
function senderMention(ctx) {
  const jid = ctx.senderJid || '';
  const digits = digitsFromJid(jid);
  return { digits, jid: `${digits}@${jid.endsWith('@lid') ? 'lid' : 's.whatsapp.net'}` };
}

function buildMenu(sock, ctx) {
  const prefix = config.prefix;
  const ownerName = sock.user?.name || sock.user?.verifiedName || 'Owner';
  const isAdminCmd = (c) => c.category === 'admin';
  const adminCmds = ctx.commands.filter(isAdminCmd).sort(byOrder);
  const ownerCmds = ctx.commands.filter((c) => c.ownerOnly && !isAdminCmd(c)).sort(byOrder);

  const sender = senderMention(ctx);
  const header = ui.card(`🤖 ${config.botName.toUpperCase()}`, [
    `👋🏽 Hi @${sender.digits}`,
    '',
    `👤 Owner: ${ownerName}`,
    `💻 Developer: ${config.botAuthor}`,
    `⚡ Prefix: ${config.prefixes.join(' ')}`,
    `🤖 Bot: ${config.botName}`,
    `📊 Commands: ${ctx.commands.length} (${ctx.commands.filter((c) => c.ownerOnly).length} owner-only)`,
    `⏱️ Uptime: ${formatUptime(process.uptime())}`,
    '',
  ]);

  const sections = [];
  for (const section of SECTIONS) {
    const cmds = ctx.commands
      .filter((c) => !c.ownerOnly && !isAdminCmd(c) && (c.category || 'general') === section.key)
      .sort(byOrder);
    if (cmds.length) sections.push(ui.section(section.title, cmds.map((c) => entry(c, prefix)), { bullet: BULLET }));
  }
  if (adminCmds.length) sections.push(ui.section(ADMIN_TITLE, adminCmds.map((c) => entry(c, prefix)), { bullet: BULLET }));
  if (ownerCmds.length) sections.push(ui.section(OWNER_TITLE, ownerCmds.map((c) => entry(c, prefix)), { bullet: BULLET }));

  const text = [header, ...sections, `> ${config.botName} • ${config.botAuthor}`].join('\n\n');
  return { text, mentions: [sender.jid] };
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
    const { text, mentions } = buildMenu(sock, ctx);

    const picture = await getProfilePicture(sock);
    if (picture) {
      const image = picture.buffer || { url: picture.url };
      const sent = await ctx.safeSend(sock, ctx.chatId, { image, caption: text, mentions }, { quoted: msg });
      if (sent) return;
      ctx.logger.warn('Menu image send failed, falling back to text');
    }
    await ctx.safeSend(sock, ctx.chatId, { text, mentions }, { quoted: msg });
  },
};
