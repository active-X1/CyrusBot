// commands/setmessage.js  (owner only)
//
// Your auto-reply message.
//   .setmessage <text>   -> set the message (and keep it on/off as it was)
//   .setmessage on|off   -> turn the auto-reply on or off
//   .setmessage clear    -> delete the message
//   .setmessage          -> show status + current message
//
// WHERE it replies (handled in index.js -> maybeSendAutoReply):
//   - DMs: yes, once per day per chat.
//   - Groups: NO - except when your account is @mentioned or someone
//     replies to one of your messages (once per day per person).
//   - Never to your own messages, and not in chats where AI mode is on.
//
// Reserved words: a message that is exactly "on", "off" or "clear"
// can't be saved, because those are the switches above.

const { readJson, writeJson } = require('../lib/db');
const ui = require('../lib/ui');

const STORE_NAME = 'settings';

function load() {
  return readJson(STORE_NAME, {});
}

function isEnabled(settings = load()) {
  return settings.autoReplyEnabled !== false; // default: on
}

/** Used by index.js. Returns '' when no message is set OR it is switched off. */
function getAutoReply() {
  const settings = load();
  return isEnabled(settings) ? settings.autoReplyMessage || '' : '';
}

function save(patch) {
  const settings = { ...load(), ...patch };
  for (const [k, v] of Object.entries(settings)) if (v === undefined) delete settings[k];
  writeJson(STORE_NAME, settings);
}

module.exports = {
  name: 'setmessage',
  aliases: [],
  description: 'Set DM auto-reply (on/off)',
  emoji: '💬',
  category: 'admin',
  ownerOnly: true,
  getAutoReply, // used by index.js
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
    const input = args.join(' ').trim();
    const word = input.toLowerCase();
    const p = ctx.config.prefix;

    if (word === 'on' || word === 'off') {
      const settings = load();
      save({ autoReplyEnabled: word === 'on' });
      const note = word === 'on' && !settings.autoReplyMessage ? `\n⚠️ No message yet. Use ${p}setmessage <text>` : '';
      return reply(ui.box('💬 AUTO-REPLY', [word === 'on' ? '🟢 Turned ON' : '🔴 Turned OFF']) + note);
    }

    if (word === 'clear') {
      save({ autoReplyMessage: undefined });
      return reply(ui.box('💬 AUTO-REPLY', ['🗑️ Message cleared']));
    }

    if (!input) {
      const settings = load();
      return reply(
        ui.box('💬 AUTO-REPLY', [
          `📡 Status  : ${isEnabled(settings) ? '🟢 ON' : '🔴 OFF'}`,
          `📝 Message : ${settings.autoReplyMessage ? `"${settings.autoReplyMessage}"` : 'not set'}`,
          '',
          '📍 Replies in: DMs, plus groups only when',
          'you are @mentioned or your message is replied to',
          '',
          `⚙️ ${p}setmessage <text> | on | off | clear`,
        ])
      );
    }

    save({ autoReplyMessage: input });
    const on = isEnabled();
    return reply(
      ui.box('💬 AUTO-REPLY', [
        '✅ Message saved:',
        `"${input}"`,
        '',
        `📡 Status: ${on ? '🟢 ON' : '🔴 OFF (use ' + p + 'setmessage on)'}`,
      ])
    );
  },
};
