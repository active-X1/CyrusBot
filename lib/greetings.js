// lib/greetings.js
// Welcome / goodbye messages. Settings per group live in database/greetings.json:
//   { "<groupJid>": { welcome: { enabled, text }, goodbye: { enabled, text } } }
// Placeholders in the text:  {user}  {group}  {count}
const { readJson, writeJson } = require('./db');
const logger = require('./logger');
const ui = require('./ui');
const { guardAdmin } = require('./groupAdmin');
const { getGroupMetadata } = require('./groupCache');
const { digitsFromJid, botJids } = require('./helpers');

const STORE = 'greetings';

const DEFAULT_TEXT = {
  welcome: '👋 Welcome {user} to *{group}*! 🎉\nYou are member #{count}. Enjoy your stay!',
  goodbye: '👋 {user} has left *{group}*. Take care! 🌍',
};

function getGreeting(chatId, kind) {
  const entry = readJson(STORE, {})[chatId]?.[kind] || {};
  return { enabled: Boolean(entry.enabled), text: entry.text || DEFAULT_TEXT[kind] };
}

function saveGreeting(chatId, kind, patch) {
  const all = readJson(STORE, {});
  all[chatId] = all[chatId] || {};
  all[chatId][kind] = { ...(all[chatId][kind] || {}), ...patch };
  writeJson(STORE, all);
}

function render(template, { users, group, count }) {
  return template
    .replace(/\{user\}/gi, users.map((j) => `@${digitsFromJid(j)}`).join(', '))
    .replace(/\{group\}/gi, group)
    .replace(/\{count\}/gi, String(count));
}

/** Called for every group-participants.update event (see index.js). */
async function handleParticipantsUpdate(sock, update) {
  const kind = update.action === 'add' ? 'welcome' : update.action === 'remove' ? 'goodbye' : null;
  if (!kind || !update.id) return;
  if (!getGreeting(update.id, kind).enabled) return;

  const botNums = botJids(sock).map(digitsFromJid);
  const users = (update.participants || [])
    .map((p) => (typeof p === 'string' ? p : p?.id))
    .filter((jid) => jid && !botNums.includes(digitsFromJid(jid)));
  if (!users.length) return;

  const meta = await getGroupMetadata(sock, update.id, { force: true }).catch(() => null);
  const text = render(getGreeting(update.id, kind).text, {
    users,
    group: meta?.subject || 'this group',
    count: meta?.participants?.length || meta?.size || '?',
  });
  await sock.sendMessage(update.id, { text, mentions: users }).catch((err) =>
    logger.warn({ err: err.message, kind }, 'Could not send greeting')
  );
}

/** Builds the .welcome / .goodbye command (they only differ in `kind`). */
function makeCommand(kind) {
  const isWelcome = kind === 'welcome';
  const title = isWelcome ? '👋 WELCOME' : '🚪 GOODBYE';
  return {
    name: kind,
    aliases: [],
    description: isWelcome ? 'Greet new members' : 'Say goodbye to members who leave',
    usage: 'on|off|set <text>',
    emoji: isWelcome ? '👋' : '🚪',
    category: 'admin',
    ownerOnly: false, // owner OR group admin, checked in guardAdmin
    async execute(sock, msg, args, ctx) {
      const reply = (text, extra = {}) => ctx.safeSend(sock, ctx.chatId, { text, ...extra }, { quoted: msg });
      const guard = await guardAdmin(sock, msg, ctx, title, { needBotAdmin: false });
      if (!guard) return;

      const p = ctx.config.prefix;
      const sub = (args[0] || '').toLowerCase();

      if (sub === 'on' || sub === 'off') {
        saveGreeting(ctx.chatId, kind, { enabled: sub === 'on' });
        return reply(ui.box(title, [sub === 'on' ? '🟢 Turned ON' : '🔴 Turned OFF']));
      }
      if (sub === 'set') {
        const text = args.slice(1).join(' ').trim();
        if (!text) {
          return reply(ui.usage(kind, 'set <text>', 'Use {user} {group} {count}, e.g. Welcome {user} to {group}!'));
        }
        saveGreeting(ctx.chatId, kind, { text: text.slice(0, 800) });
        return reply(ui.box(title, ['✅ Message saved', '', 'Preview:', render(text, { users: [ctx.senderJid], group: guard.meta.subject, count: guard.meta.participants.length })]), {
          mentions: [ctx.senderJid],
        });
      }
      if (sub === 'reset') {
        saveGreeting(ctx.chatId, kind, { text: '' });
        return reply(ui.box(title, ['✅ Message reset to the default']));
      }
      if (sub) return reply(ui.usage(kind, 'on|off|set <text>|reset'));

      const g = getGreeting(ctx.chatId, kind);
      return reply(
        ui.box(title, [
          `📡 Status: ${g.enabled ? '🟢 ON' : '🔴 OFF'}`,
          '',
          '💬 Current message:',
          g.text,
          '',
          `${p}${kind} on | off`,
          `${p}${kind} set <text>   (use {user} {group} {count})`,
          `${p}${kind} reset`,
        ])
      );
    },
  };
}

module.exports = { handleParticipantsUpdate, makeCommand, getGreeting };
