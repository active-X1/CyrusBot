// commands/broadcast.js  (owner only)
//   .broadcast <message>  -> shows a preview and asks for confirmation
//   .broadcast yes        -> (within 60 seconds) sends it to every group you are in
// Messages go out one by one with a pause between them. Sending the same
// message to many groups can get a WhatsApp account restricted, so use sparingly.
const ui = require('../lib/ui');

const TITLE = '📣 BROADCAST';
const CONFIRM_WINDOW_MS = 60_000;
const DELAY_MIN_MS = 2500;
const DELAY_SPREAD_MS = 2000;

let pending = null; // { text, groups, expires }
let sending = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  name: 'broadcast',
  aliases: ['bc'],
  description: 'Send a message to all your groups',
  usage: '<message>',
  emoji: '📣',
  category: 'general',
  ownerOnly: true,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
    const p = ctx.config.prefix;
    const first = (args[0] || '').toLowerCase();

    // ---- confirm ------------------------------------------------------
    if (args.length === 1 && (first === 'yes' || first === 'confirm')) {
      if (sending) return reply(ui.error('A broadcast is already being sent. Please wait for it to finish.'));
      if (!pending || Date.now() > pending.expires) {
        pending = null;
        return reply(ui.error(`Nothing waiting to send.\nStart with ${p}broadcast <message>`));
      }
      const { text, groups } = pending;
      pending = null;
      sending = true;
      await reply(ui.box(TITLE, [`🚀 Sending to ${groups.length} group(s)...`, 'I will tell you when it is done.']));

      let ok = 0;
      let failed = 0;
      try {
        for (const jid of groups) {
          const sent = await ctx.safeSend(sock, jid, { text: `📢 *Broadcast*\n\n${text}` });
          if (sent) ok += 1;
          else failed += 1;
          await sleep(DELAY_MIN_MS + Math.random() * DELAY_SPREAD_MS);
        }
      } finally {
        sending = false;
      }
      return reply(ui.box(TITLE, ['✅ Done', `📬 Delivered: ${ok}`, ...(failed ? [`⚠️ Failed: ${failed}`] : [])]));
    }

    // ---- start --------------------------------------------------------
    const text = args.join(' ').trim();
    if (!text) return reply(ui.usage('broadcast', '<message>', 'You will be asked to confirm before it is sent'));
    if (sending) return reply(ui.error('A broadcast is already being sent. Please wait for it to finish.'));

    let groups;
    try {
      groups = Object.keys((await sock.groupFetchAllParticipating()) || {});
    } catch (err) {
      ctx.logger.warn({ err: err.message }, 'broadcast: could not list groups');
      return reply(ui.error("Couldn't load your groups. Try again shortly."));
    }
    if (!groups.length) return reply(ui.error('You are not in any groups.'));

    pending = { text, groups, expires: Date.now() + CONFIRM_WINDOW_MS };
    return reply(
      ui.box(TITLE, [
        `👥 Groups: ${groups.length}`,
        '',
        '💬 Message:',
        text.length > 300 ? `${text.slice(0, 300)}…` : text,
        '',
        `✅ To send, reply: ${p}broadcast yes   (within 60 seconds)`,
        '⚠️ Messaging many groups at once can get a number restricted.',
      ])
    );
  },
};
