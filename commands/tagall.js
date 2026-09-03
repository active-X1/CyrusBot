const { isAdmin } = require("../handlers/groupHandler");

module.exports = {
  name: "tagall",
  description: "Mention every member in the current group.",
  category: "Group",
  groupOnly: true,
  adminOnly: true,

  async execute(sock, msg, context) {
    const { jid, sender } = context;

    if (!jid.endsWith("@g.us")) {
      await sock.sendMessage(jid, {
        text: "⚠️ This command only works in groups.",
      });
      return;
    }

    const isSenderAdmin = await isAdmin(sock, jid, sender);

    if (!isSenderAdmin) {
      await sock.sendMessage(jid, {
        text: "❌ Only group admins can use tagall.",
      });
      return;
    }

    try {
      const metadata = await sock.groupMetadata(jid);
      const members = metadata?.participants || [];

      if (!members.length) {
        await sock.sendMessage(jid, {
          text: "⚠️ No members found in this group.",
        });
        return;
      }

      const mentions = members
        .map((member) => `@${member.id.split("@")[0]}`)
        .join(" ");

      await sock.sendMessage(jid, {
        text: `📣 *Tag all*\n\n${mentions}`,
        mentions: members.map((member) => ({ tag: member.id })),
      });
    } catch (error) {
      await sock.sendMessage(jid, {
        text: "❌ Failed to tag group members.",
      });
    }
  },
};
