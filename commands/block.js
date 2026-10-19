// commands/block.js  (owner only)
//   .block @user   |   reply to someone   |   .block <number>
//   In a private chat, .block with nothing else blocks the person you are chatting with.
const ui = require('../lib/ui');
const { pickTarget } = require('../lib/groupAdmin');
const { digitsFromJid, findParticipant, isOwner, botJids } = require('../lib/helpers');
const { getGroupMetadata } = require('../lib/groupCache');

const TITLE = '⛔ BLOCK';

module.exports = {
  name: 'block',
  aliases: [],
  description: 'Block someone on WhatsApp',
  usage: '@user',
  emoji: '⛔',
  category: 'general',
  ownerOnly: true,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });

    let targetJid = ctx.isGroup ? pickTarget(msg, args) : pickTarget(msg, args) || ctx.chatId;
    if (!targetJid) return reply(ui.usage('block', '@user', 'Or reply to the person, or give their number'));

    // Work out the person's phone-number address (WhatsApp wants that one for blocking).
    const candidates = [];
    if (ctx.isGroup) {
      try {
        const person = findParticipant((await getGroupMetadata(sock, ctx.chatId)).participants, targetJid);
        if (person?.phoneNumber) candidates.push(person.phoneNumber);
        if (person?.id) candidates.push(person.id);
      } catch {}
    }
    candidates.push(targetJid);
    const digits = digitsFromJid(candidates[0]);

    if (isOwner(...candidates) || botJids(sock).map(digitsFromJid).includes(digits)) {
      return reply(ui.box(TITLE, ["🚫 I won't do that to myself or my owner."]));
    }

    let lastError = null;
    for (const jid of [...new Set(candidates)]) {
      try {
        await sock.updateBlockStatus(jid, 'block');
        return reply(ui.box(TITLE, [`⛔ @${digitsFromJid(jid)} has been blocked.`]));
      } catch (err) {
        lastError = err;
      }
    }
    ctx.logger.error({ err: lastError?.message }, 'block failed');
    return reply(ui.error("Couldn't block that person. Please try again."));
  },
};
