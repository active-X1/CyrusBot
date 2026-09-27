// commands/aimode.js
//
// ".aimode on"  -> every non-command message sent in this chat from now
//                  on gets an automatic AI reply (still subject to the
//                  same daily limit as .ai).
// ".aimode off" -> stops automatic replies for this chat.
// ".aimode"     -> shows current status.
//
// State is per-chat (per JID) and persisted in database/aimode.json so
// it survives restarts. Toggling requires owner/sudo or a group admin,
// so random members can't spam-enable it in a shared group.

const { readJson, writeJson } = require('../lib/db');

const STORE_NAME = 'aimode';

function isEnabledForChat(chatId) {
  const state = readJson(STORE_NAME, {});
  return Boolean(state[chatId]);
}

function setEnabledForChat(chatId, enabled) {
  const state = readJson(STORE_NAME, {});
  if (enabled) {
    state[chatId] = true;
  } else {
    delete state[chatId];
  }
  writeJson(STORE_NAME, state);
}

module.exports = {
  name: 'aimode',
  aliases: [],
  description: 'Toggle automatic AI replies for this chat: ".aimode on" / ".aimode off".',
  category: 'ai',
  ownerOnly: false, // permission is checked manually below (owner OR group admin)
  isEnabledForChat, // exported for index.js to check on every incoming message
  async execute(sock, msg, args, ctx) {
    const sub = (args[0] || '').toLowerCase();

    if (sub !== 'on' && sub !== 'off') {
      const status = isEnabledForChat(ctx.chatId) ? 'ON' : 'OFF';
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: `AI mode is currently *${status}* for this chat.\nUsage: ${ctx.config.prefix}aimode on|off` },
        { quoted: msg }
      );
    }

    const allowed = await ctx.canManageChat(sock, ctx.chatId, ctx.senderJid);
    if (!allowed) {
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: '🚫 Only the bot owner or a group admin can change AI mode.' },
        { quoted: msg }
      );
    }

    setEnabledForChat(ctx.chatId, sub === 'on');
    await ctx.safeSend(
      sock,
      ctx.chatId,
      { text: sub === 'on' ? '✅ AI mode enabled for this chat.' : '🛑 AI mode disabled for this chat.' },
      { quoted: msg }
    );
  },
};
