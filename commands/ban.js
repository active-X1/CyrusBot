const { isAdmin, addBannedUser } = require("../handlers/groupHandler");

module.exports = {
  name: "ban",
  description: "Ban a user from this group.",
  category: "Group",
  groupOnly: true,
  adminOnly: true,

  async execute(sock, msg, context) {
    const { jid, sender, args } = context;

    if (!jid.endsWith("@g.us")) {
      await sock.sendMessage(jid, {
        text: "⚠️ This command only works in groups.",
      });
      return;
    }

    if (!(await isAdmin(sock, jid, sender))) {
      await sock.sendMessage(jid, {
        text: "❌ Only group admins can use .ban.",
      });
      return;
    }

    const target =
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      args[0] ||
      null;

    if (!target) {
      await sock.sendMessage(jid, {
        text: "⚠️ Mention or reply to a user before using .ban.",
      });
      return;
    }

    addBannedUser(jid, target);

    try {
      await sock.groupParticipantsUpdate(jid, [target], "remove");
    } catch (error) {
      // Ignore remove failures; the ban still applies.
    }

    await sock.sendMessage(jid, {
      text: `🚫 Banned @${target.split("@")[0]} from this group.`,
    });
  },
};
