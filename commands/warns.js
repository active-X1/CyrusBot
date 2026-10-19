// commands/warns.js  (anyone)
//   .warns            -> your own warnings in this group
//   .warns @user      -> someone else's (or reply to them)
const ui = require('../lib/ui');
const config = require('../config');
const { pickTarget } = require('../lib/groupAdmin');
const { digitsFromJid, findParticipant } = require('../lib/helpers');
const { getGroupMetadata } = require('../lib/groupCache');
const { getWarns } = require('../lib/warns');

const TITLE = '📋 WARNINGS';

module.exports = {
  name: 'warns',
  aliases: [],
  description: 'Show warnings for you or someone else',
  usage: '@user',
  emoji: '📋',
  category: 'utility',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text, extra = {}) => ctx.safeSend(sock, ctx.chatId, { text, ...extra }, { quoted: msg });
    if (!ctx.isGroup) return reply(ui.error('This only works inside a group.'));

    let meta;
    try {
      meta = await getGroupMetadata(sock, ctx.chatId);
    } catch {
      return reply(ui.error("Couldn't read this group's info. Try again shortly."));
    }

    const asked = pickTarget(msg, []);
    const target = asked ? findParticipant(meta.participants, asked) : findParticipant(meta.participants, ctx.senderJid, ctx.senderAltJid);
    if (!target) return reply(ui.box(TITLE, ['❓ That person is not in this group.']));

    const w = getWarns(ctx.chatId, target);
    const lines = [`👤 @${digitsFromJid(target.id)}`, `📊 ${w.count}/${config.warnLimit} warnings`];
    if (w.reasons.length) lines.push('', '📝 Reasons:', ...w.reasons.slice(-5).map((r, i) => `${i + 1}. ${r}`));
    return reply(ui.box(TITLE, lines), { mentions: [target.id] });
  },
};
