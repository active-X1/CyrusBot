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
const os = require('os');
const { getMode } = require('../lib/mode');
const pkg = require('../package.json');
const { formatUptime, digitsFromJid } = require('../lib/helpers');

// General commands first (each in its own block), then ADMIN COMMANDS as a
// separate block, then OWNER ONLY.
const SECTIONS = [
  { key: 'general', title: 'GENERAL' },
  { key: 'ai', title: 'AI' },
  { key: 'utility', title: 'TOOLS' },
  { key: 'games', title: 'GAMES' },
];
const ADMIN_TITLE = 'ADMIN';
const OWNER_TITLE = 'OWNER';

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

// ---- Cypher-style blocks ---------------------------------------------------
//   ┏▣ ◈ *TITLE* ◈        header block uses ┃ rows
//   │➽ command              command blocks use │➽ rows
//   ┗▣
// Every line is short and there are no long rules, so nothing wraps on a phone.
const SMALL = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
const small = (t) => String(t).toLowerCase().replace(/[a-z]/g, (c) => SMALL[c]);

// WhatsApp shows "Read more" after this many invisible characters, so only the
// header is visible until the person taps it. Used for the plain-text menu.
const READ_MORE = '\u200E'.repeat(4000);

function infoBlock(title, rows) {
  return [`┏▣ ◈ *${title}* ◈`, ...rows.map(([k, v]) => `┃ *${small(k)}* : ${v}`), '┗▣'].join('\n');
}

function listBlock(title, names) {
  return [`┏▣ ◈ *${title} MENU* ◈`, ...names.map((n) => `│➽ ${n}`), '┗▣'].join('\n');
}

const bar = (pct) => `[${'█'.repeat(Math.round(pct / 10))}${'░'.repeat(10 - Math.round(pct / 10))}] ${pct}%`;
const sizeOf = (bytes) => (bytes >= 1024 ** 3 ? `${Math.round(bytes / 1024 ** 3)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`);

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

function buildMenu(sock, ctx, { fold = false } = {}) {
  const prefix = config.prefix;
  const ownerName = config.ownerName || sock.user?.name || sock.user?.verifiedName || 'Owner';
  const isAdminCmd = (c) => c.category === 'admin';
  const adminCmds = ctx.commands.filter(isAdminCmd).sort(byOrder);
  const ownerCmds = ctx.commands.filter((c) => c.ownerOnly && !isAdminCmd(c)).sort(byOrder);
  const names = (list) => list.map((c) => c.name);

  const used = process.memoryUsage().rss;
  const total = os.totalmem();
  const header = infoBlock(config.botName.toUpperCase(), [
    ['owner', ownerName],
    ['prefix', `[ ${config.prefixes.join(' ')} ]`],
    ['mode', getMode() === 'private' ? 'Private' : 'Public'],
    ['commands', ctx.commands.length],
    ['version', pkg.version],
    ['uptime', formatUptime(process.uptime())],
    ['usage', `${sizeOf(used)} of ${sizeOf(total)}`],
    ['ram', bar(Math.min(100, Math.round((used / total) * 100)))],
  ]);

  const sections = [];
  for (const group of SECTIONS) {
    const cmds = ctx.commands.filter((c) => !c.ownerOnly && !isAdminCmd(c) && (c.category || 'general') === group.key).sort(byOrder);
    if (cmds.length) sections.push(listBlock(group.title, names(cmds)));
  }
  if (adminCmds.length) sections.push(listBlock(ADMIN_TITLE, names(adminCmds)));
  if (ownerCmds.length) sections.push(listBlock(OWNER_TITLE, names(ownerCmds)));
  sections.push([
    '┏▣ ◈ *LINKS* ◈',
    '│➽ portfolio',
    '│ https://activex-portfolio.vercel.app',
    '│➽ github',
    '│ https://github.com/active-X1',
    '┗▣',
  ].join('\n'));

  const footer = `_${prefix}help <command> for details • built by ${config.botAuthor}_`;
  const text = [header + (fold ? `\n${READ_MORE}` : ''), ...sections, footer].join('\n\n');
  return { text, mentions: [] };
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
    const picture = await getProfilePicture(sock);
    if (picture) {
      const { text, mentions } = buildMenu(sock, ctx); // caption: WhatsApp adds its own "Read more"
      const image = picture.buffer || { url: picture.url };
      const sent = await ctx.safeSend(sock, ctx.chatId, { image, caption: text, mentions }, { quoted: msg });
      if (sent) return;
      ctx.logger.warn('Menu image send failed, falling back to text');
    }
    const { text, mentions } = buildMenu(sock, ctx, { fold: true });
    await ctx.safeSend(sock, ctx.chatId, { text, mentions }, { quoted: msg });
  },
};
