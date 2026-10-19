// lib/antilink.js
//
// Antilink for CyrusBot. Fully local - settings live in database/antilink.json
// (via lib/db.js), no API or external server.
//
// For every group message it checks whether the text contains a link
// (including disguised ones like "site(.)com" or links hidden in button /
// list / interactive messages). If antilink is ON for that group and the
// sender is a normal member, the link is deleted - or the sender is removed,
// depending on the group's setting. The bot must be a group admin to do that.
//
// Never acted on: the bot itself, the bot owner / sudo numbers, group admins.

const { readJson, writeJson } = require('./db');
const logger = require('./logger');
const { getGroupMetadata } = require('./groupCache');
const {
  digitsFromJid,
  isOwner,
  findParticipant,
  botJids,
  isAdminRole,
} = require('./helpers');

const STORE = 'antilink';

// Set ANTILINK_DEBUG=1 in .env to log why a message was or wasn't acted on.
const DEBUG = process.env.ANTILINK_DEBUG === '1';
const dbg = (msg, extra) => { if (DEBUG) logger.info(extra || {}, `[antilink] ${msg}`); };

// ★ ALWAYS-BLOCKED LINKS - deleted even when antilink is OFF in the group.
// Add a domain (no https://, no www.) to block it everywhere.
const BLOCKED_DOMAINS = [
  'rocketviral.com.ng',
];

const TLDS = 'com|net|org|edu|gov|io|co|me|ng|ke|gh|za|link|xyz|gg|app|dev|site|shop|store|online|tech|info|biz|live|news|club|top|vip|chat|bio|tv|fm|cc|to|ly|be|gl|in|uk|us|ca|au|de|fr|es|it|nl|se|pt|br|mx|tr|ae|sa|eg|id|ph|vn|pk|my|ru';

// Full URLs, www., or bare domains with a common ending. The lookbehind skips emails.
const LINK_REGEX = new RegExp(
  '((?:https?:\\/\\/|www\\.)\\S+)|(?<![\\w@.\\-])(?:[a-z0-9-]{2,}\\.)+(?:' + TLDS + ')\\b',
  'i'
);

const ALERT_COOLDOWN_MS = 60_000;
const lastAlert = new Map(); // chatId -> timestamp
const handled = new Set();   // message ids already processed
setInterval(() => handled.clear(), 5 * 60_000).unref();

// ---------------------------------------------------------------- settings
function getSettings(chatId) {
  const entry = readJson(STORE, {})[chatId] || {};
  return { enabled: Boolean(entry.enabled), action: entry.action === 'kick' ? 'kick' : 'delete' };
}

function saveSettings(chatId, patch) {
  const all = readJson(STORE, {});
  all[chatId] = { enabled: false, action: 'delete', ...(all[chatId] || {}), ...patch };
  writeJson(STORE, all);
}

const setEnabled = (chatId, enabled) => saveSettings(chatId, { enabled: Boolean(enabled) });
const setAction = (chatId, action) => saveSettings(chatId, { action: action === 'kick' ? 'kick' : 'delete' });

// ------------------------------------------------------------ text reading
function unwrap(message) {
  let m = message;
  for (let i = 0; i < 6 && m; i++) {
    const inner =
      m.ephemeralMessage?.message ||
      m.viewOnceMessage?.message ||
      m.viewOnceMessageV2?.message ||
      m.viewOnceMessageV2Extension?.message ||
      m.documentWithCaptionMessage?.message ||
      m.editedMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

function buttonParams(buttons, add) {
  for (const b of buttons || []) {
    try {
      Object.values(JSON.parse(b.buttonParamsJson || '{}')).forEach((v) => add(typeof v === 'string' ? v : ''));
    } catch {
      add(b.buttonParamsJson);
    }
  }
}

/** Every piece of readable text in a message, including buttons/lists/cards. */
function messageText(message) {
  const m = unwrap(message);
  if (!m) return '';
  const out = [];
  const add = (v) => { if (typeof v === 'string' && v) out.push(v); };

  add(m.conversation);
  add(m.extendedTextMessage?.text);
  add(m.imageMessage?.caption);
  add(m.videoMessage?.caption);
  add(m.documentMessage?.caption);

  const bm = m.buttonsMessage;
  if (bm) {
    add(bm.contentText); add(bm.footerText);
    (bm.buttons || []).forEach((b) => add(b.buttonText?.displayText));
  }

  const lm = m.listMessage;
  if (lm) {
    add(lm.title); add(lm.description); add(lm.footerText);
    (lm.sections || []).forEach((sec) => {
      add(sec.title);
      (sec.rows || []).forEach((r) => { add(r.title); add(r.description); });
    });
  }

  const ht = m.templateMessage?.hydratedTemplate || m.templateMessage?.hydratedFourRowTemplate;
  if (ht) {
    add(ht.hydratedTitleText); add(ht.hydratedContentText); add(ht.hydratedFooterText);
    (ht.hydratedButtons || []).forEach((b) => {
      add(b.urlButton?.url); add(b.urlButton?.displayText); add(b.quickReplyButton?.displayText);
    });
  }

  const im = m.interactiveMessage;
  if (im) {
    add(im.header?.title); add(im.header?.subtitle); add(im.body?.text); add(im.footer?.text);
    buttonParams(im.nativeFlowMessage?.buttons, add);
    (im.carouselMessage?.cards || []).forEach((card) => {
      add(card.body?.text); add(card.header?.title); add(card.footer?.text);
      buttonParams(card.nativeFlowMessage?.buttons, add);
    });
  }

  return out.join('\n');
}

// ------------------------------------------------------------ link finding
// Undo common disguises: invisible characters, full-width letters, "hxxps",
// "https : / /", "site(.)com", "site [dot] com", "site . com".
function normalizeForLinks(text) {
  return String(text)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD]/g, '')
    .normalize('NFKC')
    .replace(/\bhxxp(s?)/gi, 'http$1')
    .replace(/\bh\s*t\s*t\s*p\s*(s?)\s*:\s*\/\s*\/\s*/gi, 'http$1://')
    .replace(/(https?)\s*:\s*\/\s*\/\s*/gi, '$1://')
    .replace(/(\w)\s*[\[\(\{<]\s*(?:\.|dot)\s*[\]\)\}>]\s*(\w)/gi, '$1.$2')
    .replace(new RegExp('(\\w)\\s+(?:dot|\\.)\\s+(' + TLDS + ')\\b', 'gi'), '$1.$2')
    .replace(new RegExp('(\\w)\\s+\\.(' + TLDS + ')\\b', 'gi'), '$1.$2');
}

function hasLink(text) {
  return LINK_REGEX.test(text) || LINK_REGEX.test(normalizeForLinks(text));
}

function isBlockedLink(text) {
  const t = normalizeForLinks(text).toLowerCase();
  const squashed = t.replace(/\s+/g, '');
  return BLOCKED_DOMAINS.some((d) => {
    const x = d.toLowerCase();
    return t.includes(x) || squashed.includes(x);
  });
}

// ---------------------------------------------------------------- enforcing
async function alertAdmins(sock, chatId, meta, senderNum, action) {
  if (Date.now() - (lastAlert.get(chatId) || 0) < ALERT_COOLDOWN_MS) return;
  lastAlert.set(chatId, Date.now());

  const admins = (meta.participants || []).filter(isAdminRole).map((p) => p.id);
  if (!admins.length) return;

  const wanted = action === 'kick' ? 'remove this member' : 'delete this message';
  await sock
    .sendMessage(chatId, {
      text:
        `🔗 *Antilink Alert*\n\n@${senderNum} posted a link.\n` +
        `${admins.map((j) => '@' + digitsFromJid(j)).join(' ')}, please ${wanted} - I'm not an admin here, so I can't do it myself.`,
      mentions: [...admins, `${senderNum}@s.whatsapp.net`],
    })
    .catch(() => {});
}

/** Called for every incoming group message (see index.js). */
async function handleAntilink(sock, msg) {
  try {
    const chatId = msg.key?.remoteJid;
    if (!chatId?.endsWith('@g.us') || msg.key.fromMe) return;

    const text = messageText(msg.message);
    if (!text) return;
    const blocked = isBlockedLink(text);
    if (!blocked && !hasLink(text)) return;

    const mid = msg.key.id;
    if (mid) {
      if (handled.has(mid)) return;
      handled.add(mid);
    }

    const settings = getSettings(chatId);
    if (!settings.enabled && !blocked) { dbg('skip: antilink is OFF in this group'); return; }
    // Antilink OFF + always-blocked link => only delete. ON => the group's chosen action.
    const action = settings.enabled ? settings.action : 'delete';

    const senderJids = [msg.key.participant, msg.key.participantAlt].filter(Boolean);
    if (!senderJids.length) { dbg('skip: no sender on message'); return; }
    const senderNum = digitsFromJid(senderJids[0]);

    // Never act on the bot or its owner.
    if (botJids(sock).map(digitsFromJid).some((n) => senderJids.map(digitsFromJid).includes(n))) return;
    if (isOwner(...senderJids)) { dbg('skip: sender is the owner'); return; }

    let meta = await getGroupMetadata(sock, chatId);
    if (!meta) return;
    let sender = findParticipant(meta.participants, ...senderJids);

    // Group admins are exempt - but re-check with FRESH info first, because the
    // saved copy can still list someone as admin after they were demoted.
    if (isAdminRole(sender)) {
      meta = (await getGroupMetadata(sock, chatId, { force: true }).catch(() => null)) || meta;
      sender = findParticipant(meta.participants, ...senderJids);
      if (isAdminRole(sender)) { dbg('skip: sender is a group admin'); return; }
    }
    if (sender && isOwner(sender.id, sender.phoneNumber, sender.lid)) { dbg('skip: sender is the owner'); return; }

    // The bot must be an admin to delete/kick. Re-check fresh before giving up.
    let me = findParticipant(meta.participants, ...botJids(sock));
    if (!isAdminRole(me)) {
      meta = (await getGroupMetadata(sock, chatId, { force: true }).catch(() => null)) || meta;
      me = findParticipant(meta.participants, ...botJids(sock));
      if (!isAdminRole(me)) {
        dbg('bot is NOT admin - alerting admins instead');
        await alertAdmins(sock, chatId, meta, senderNum, action);
        return;
      }
    }

    // Use the id format the group itself lists for this person.
    const target = sender?.id || senderJids[0];

    dbg(`deleting link from ${senderNum} (action=${action})`);
    await sock.sendMessage(chatId, { delete: msg.key }).catch((err) =>
      logger.warn({ err: err.message }, '[antilink] delete failed')
    );

    if (action === 'kick') {
      try {
        await sock.groupParticipantsUpdate(chatId, [target], 'remove');
        await sock.sendMessage(chatId, { text: `🚫 @${senderNum} was *removed* for posting a link.`, mentions: [target] });
      } catch (err) {
        logger.warn({ err: err.message }, '[antilink] kick failed');
        await sock
          .sendMessage(chatId, { text: `⚠️ Couldn't remove @${senderNum} - make sure I have admin rights.`, mentions: [target] })
          .catch(() => {});
      }
    } else {
      await sock
        .sendMessage(chatId, { text: `🗑️ Link from @${senderNum} was *deleted* - links aren't allowed here.`, mentions: [target] })
        .catch(() => {});
    }
  } catch (err) {
    logger.error({ err: err.message }, '[antilink] error');
  }
}

module.exports = { handleAntilink, getSettings, setEnabled, setAction, hasLink, isBlockedLink, messageText };
