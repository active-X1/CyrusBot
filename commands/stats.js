// commands/stats.js  (owner only) - a quick health report for the bot.
const os = require('os');
const config = require('../config');
const ui = require('../lib/ui');
const { readJson } = require('../lib/db');
const { getMode } = require('../lib/mode');
const { formatUptime } = require('../lib/helpers');

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

module.exports = {
  name: 'stats',
  aliases: [],
  description: 'Bot health: uptime, memory, groups',
  emoji: '📊',
  category: 'general',
  ownerOnly: true,
  async execute(sock, msg, args, ctx) {
    const mem = process.memoryUsage();

    let groups = 'unavailable';
    try {
      groups = String(Object.keys((await sock.groupFetchAllParticipating()) || {}).length);
    } catch {}

    const countOn = (store) => Object.values(readJson(store, {})).filter((v) => v && (v === true || v.enabled)).length;

    const lines = [
      `⏱️ Uptime   : ${formatUptime(process.uptime())}`,
      `🧠 Memory   : ${mb(mem.rss)} (heap ${mb(mem.heapUsed)})`,
      `🖥️ Server   : ${os.platform()} • ${os.cpus().length} CPU • load ${os.loadavg()[0].toFixed(2)}`,
      `🟢 Node     : ${process.version}`,
      '',
      `👥 Groups   : ${groups}`,
      `📚 Commands : ${ctx.commands.length}`,
      `🔐 Mode     : ${getMode().toUpperCase()}`,
      `🤖 AI mode  : ${countOn('aimode')} chat(s)`,
      `🔗 Antilink : ${countOn('antilink')} group(s)`,
      `🛡️ Antibot  : ${countOn('antibot')} group(s)`,
      '',
      `⚡ Prefix   : ${config.prefixes.join(' ')}`,
    ];
    return ctx.safeSend(sock, ctx.chatId, { text: ui.box('📊 BOT STATS', lines) }, { quoted: msg });
  },
};
