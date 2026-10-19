// commands/profile.js
//
// ".profile" / ".pic" (also "!profile" / "!pic"): download a WhatsApp
// profile picture and send it back.
//
//   In a group: .pic @someone       -> that person's picture
//               reply to someone    -> that person's picture
//               .pic (no tag/reply) -> the GROUP's picture
//   In a DM:    .pic                -> the person you're chatting with
//
// If there is no picture, or it is hidden by privacy settings, WhatsApp
// refuses the request and we say so instead of failing.

const { digitsFromJid, findParticipant } = require('../lib/helpers');
const { getGroupMetadata } = require('../lib/groupCache');
const ui = require('../lib/ui');

/** Find the message's contextInfo (mentions / quoted reply live here), whatever the message type. */
function contextOf(msg) {
  return Object.values(msg.message || {}).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo;
}

/** Everything WhatsApp could call this person: phone jid, @lid, and so on (best guess first). */
function candidateJids(participants, jid) {
  const list = [];
  const add = (j) => {
    if (!j) return;
    const clean = j.replace(/:\d+@/, '@'); // drop any ":device" part
    if (!list.includes(clean)) list.push(clean);
  };

  const person = findParticipant(participants, jid);
  if (person) {
    add(person.phoneNumber);
    if (person.id?.endsWith('@s.whatsapp.net')) add(person.id);
    add(person.id);
    add(person.lid);
  }
  add(jid);
  const digits = digitsFromJid(jid);
  if (!person && /^\d{7,15}$/.test(digits)) add(`${digits}@s.whatsapp.net`);
  return list;
}

module.exports = {
  name: 'profile',
  aliases: ['pic'],
  description: 'Get a profile or group picture',
  usage: '@user',
  emoji: '🖼️',
  category: 'utility',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const send = (content) => ctx.safeSend(sock, ctx.chatId, content, { quoted: msg });

    // 1. Decide whose picture we want.
    let targetJid;
    let isGroupPic = false;
    let participants = [];

    if (!ctx.isGroup) {
      targetJid = ctx.chatId; // DM: the other person
    } else {
      try {
        participants = (await getGroupMetadata(sock, ctx.chatId))?.participants || [];
      } catch {
        participants = [];
      }

      const info = contextOf(msg);
      targetJid = info?.mentionedJid?.[0] || info?.participant;

      // Fallback: someone typed "@2348012345678" but WhatsApp didn't attach a mention.
      if (!targetJid) {
        const typed = args.find((a) => /^@?\+?\d{7,15}$/.test(a));
        if (typed) targetJid = `${typed.replace(/\D/g, '')}@s.whatsapp.net`;
      }

      if (!targetJid) {
        targetJid = ctx.chatId; // no tag, no reply: the group's own picture
        isGroupPic = true;
      }
    }

    // 2. Ask WhatsApp for the picture URL ('image' = full size). A person can be
    //    known by more than one address (phone / @lid), so try each until one works.
    let url = null;
    for (const jid of isGroupPic || !ctx.isGroup ? [targetJid] : candidateJids(participants, targetJid)) {
      try {
        url = await sock.profilePictureUrl(jid, 'image');
        if (url) break;
      } catch (err) {
        // Usually "item-not-found" (no picture) or "not-authorized" (hidden).
        ctx.logger.info({ reason: err.message }, 'No profile picture available for one address');
      }
    }

    if (!url) {
      return send({
        text: ui.box(isGroupPic ? '🖼️ GROUP PICTURE' : '🖼️ PROFILE', [
          isGroupPic ? '🚫 This group has no picture' : '🚫 No profile picture',
          ...(isGroupPic ? [] : ['It is missing or hidden by privacy settings']),
        ]),
      });
    }

    // 3. Download it ourselves, then send the bytes (not the URL).
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      if (isGroupPic) {
        let name = '';
        try { name = (await getGroupMetadata(sock, ctx.chatId))?.subject || ''; } catch {}
        await send({ image: buffer, caption: ui.box('🖼️ GROUP PICTURE', name ? [`👥 ${name}`] : ['👥 This group']) });
      } else {
        await send({
          image: buffer,
          caption: ui.box('🖼️ PROFILE', [`👤 @${digitsFromJid(targetJid)}`]),
          mentions: [targetJid],
        });
      }
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'profile picture download failed');
      await send({ text: ui.error("Found the picture but couldn't download it. Please try again.") });
    }
  },
};
