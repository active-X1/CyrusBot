// commands/unblock.js  (owner only)
//   .unblock @user   |   reply to someone   |   .unblock <number>
//   In a private chat, .unblock with nothing else unblocks the person you are chatting with.
const ui = require('../lib/ui');
const { pickTarget } = require('../lib/groupAdmin');
const { digitsFromJid, findParticipant, isOwner, botJids } = require('../lib/helpers');
const { getGroupMetadata } = require('../lib/groupCache');

const TITLE = '✅ UNBLOCK';

module.exports = {
  name: 'unblock',
  aliases: [],
  description: 'Unblock someone on WhatsApp',
  usage: '@user',
  emoji: '✅',
  category: 'general',
  ownerOnly: true,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });

    let targetJid = ctx.isGroup ? pickTarget(msg, args) : pickTarget(msg, args) || ctx.chatId;
    if (!targetJid) return reply(ui.usage('unblock', '@user', 'Or reply to the person, or give their number'));

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
        await sock.updateBlockStatus(jid, 'unblock');
        return reply(ui.box(TITLE, [`✅ @${digitsFromJid(jid)} has been unblocked.`]));
      } catch (err) {
        lastError = err;
      }
    }
    ctx.logger.error({ err: lastError?.message }, 'unblock failed');
    return reply(ui.error("Couldn't unblock that person. Please try again."));
  },
};
