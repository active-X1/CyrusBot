// commands/setmessage.js
//
// Owner-only. Sets a custom auto-reply message that CyrusBot sends once
// per DM conversation to greet/inform people who message the owner
// directly while AI mode is off for that chat (e.g. "I'm away right
// now, I'll get back to you soon!").
//
// NOTE: the original request only said ".setmessage" without describing
// its exact behaviour, so this is an explicit assumption - it's wired
// up cleanly (persisted via lib/db.js, read by index.js) so it's easy
// to repurpose if you meant something else (e.g. a group welcome
// message - see commands aimode.js for the pattern to copy).
//
// Usage:
//   .setmessage <text>   -> sets the message
//   .setmessage clear    -> removes it (auto-reply turns off)
//   .setmessage          -> shows the current message

const { readJson, writeJson } = require('../lib/db');

const STORE_NAME = 'settings';

function getAutoReply() {
  const settings = readJson(STORE_NAME, {});
  return settings.autoReplyMessage || '';
}

function setAutoReply(text) {
  const settings = readJson(STORE_NAME, {});
  if (text) {
    settings.autoReplyMessage = text;
  } else {
    delete settings.autoReplyMessage;
  }
  writeJson(STORE_NAME, settings);
}

module.exports = {
  name: 'setmessage',
  aliases: [],
  description: "Owner only. Set the bot's custom DM auto-reply text: \".setmessage <text>\" (or \"clear\").",
  category: 'admin',
  ownerOnly: true,
  getAutoReply, // exported for index.js to use when routing DMs
  async execute(sock, msg, args, ctx) {
    const text = args.join(' ').trim();

    if (!text) {
      const current = getAutoReply();
      return ctx.safeSend(
        sock,
        ctx.chatId,
        {
          text: current
            ? `Current auto-reply message:\n"${current}"`
            : 'No auto-reply message is set. Use ".setmessage <text>" to set one.',
        },
        { quoted: msg }
      );
    }

    if (text.toLowerCase() === 'clear') {
      setAutoReply('');
      return ctx.safeSend(sock, ctx.chatId, { text: '🗑️ Auto-reply message cleared.' }, { quoted: msg });
    }

    setAutoReply(text);
    await ctx.safeSend(sock, ctx.chatId, { text: `✅ Auto-reply message set:\n"${text}"` }, { quoted: msg });
  },
};
