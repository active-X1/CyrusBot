// commands/summarize.js
//   .summarize            -> summary of the recent chat (last 40 messages)
//   .summarize 80         -> last 80 messages (max 100)
//   (reply to a message) .summarize -> summary of that one long message
// The bot only remembers messages it has seen since it last started, and only
// keeps them in memory. Uses the AI and counts toward the daily AI limit.
const ui = require('../lib/ui');
const { askAI, AIProviderError } = require('../lib/aiProvider');
const rateLimiter = require('../lib/rateLimiter');
const { messageText } = require('../lib/antilink');
const chatLog = require('../lib/chatLog');

const DEFAULT_COUNT = 40;
const MAX_COUNT = 100;

module.exports = {
  name: 'summarize',
  aliases: ['summary', 'tldr'],
  description: 'Summarize a message or the recent chat',
  usage: '[number]',
  emoji: '📝',
  category: 'ai',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });

    // What to summarize: the replied message, or else the recent chat.
    const info = Object.values(msg.message || {}).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo;
    const quoted = info?.quotedMessage ? messageText(info.quotedMessage).trim() : '';

    let material;
    let kind;
    if (quoted) {
      material = quoted.slice(0, 6000);
      kind = 'message';
    } else {
      const count = Math.min(MAX_COUNT, Math.max(5, Number.parseInt(args[0], 10) || DEFAULT_COUNT));
      const recent = chatLog.last(ctx.chatId, count);
      if (recent.length < 3) {
        return reply(
          ui.box('📝 SUMMARY', [
            'Not enough messages to summarize yet.',
            '',
            'I only see messages sent while I am running.',
            'Tip: reply to a long message with this command to summarize just that one.',
          ])
        );
      }
      material = recent.map((m) => `${m.name}: ${m.text}`).join('\n').slice(-8000);
      kind = 'chat';
    }

    const limit = rateLimiter.checkLimit(ctx.chatId);
    if (!limit.allowed) {
      return reply(ui.notice('⏳', 'LIMIT REACHED', `Daily AI limit hit (${limit.limit}/day for this chat).\nTry again tomorrow 🌙`));
    }

    try {
      sock.sendPresenceUpdate('composing', ctx.chatId).catch(() => {});
      const summary = await askAI(material, {
        system:
          kind === 'chat'
            ? 'You summarize WhatsApp group conversations. Give 3 to 6 short bullet points (use "•") of the main topics, decisions and open questions. ' +
              'Mention who said something only when it matters. Under 120 words. Plain text, same language as the chat.'
            : 'You summarize a single WhatsApp message. Give the main points in 2 to 5 short bullet points (use "•"). Under 100 words. Plain text, same language as the message.',
        maxTokens: 400,
      });
      rateLimiter.recordUsage(ctx.chatId);
      return reply(`📝 *Summary*\n\n${summary}`);
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'summarize failed');
      return reply(ui.error(err instanceof AIProviderError ? err.userMessage : 'Something went wrong. Please try again later.'));
    }
  },
};
