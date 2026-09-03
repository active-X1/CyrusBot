const { isAdmin } = require("../handlers/groupHandler");

module.exports = {
  name: "kick",
  description: "Remove a mentioned user from the group.",
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
        text: "❌ Only group admins can use .kick.",
      });
      return;
    }

    const target =
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      args[0]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net" ||
      null;

    if (!target) {
      await sock.sendMessage(jid, {
        text: "⚠️ Mention or reply to a user before using .kick.",
      });
      return;
    }

    try {
      await sock.groupParticipantsUpdate(jid, [target], "remove");
      await sock.sendMessage(jid, {
        text: `👢 Removed @${target.split("@")[0]} from the group.`,
      });
    } catch (error) {
      await sock.sendMessage(jid, {
        text: "❌ I could not remove that user.",
      });
    }
  },
};
