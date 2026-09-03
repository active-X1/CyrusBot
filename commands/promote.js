const { isAdmin } = require("../handlers/groupHandler");

module.exports = {
  name: "promote",
  description: "Promote a group member to admin.",
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
        text: "❌ Only group admins can use .promote.",
      });
      return;
    }

    const target =
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      args[0] ||
      null;

    if (!target) {
      await sock.sendMessage(jid, {
        text: "⚠️ Mention or reply to a user before using .promote.",
      });
      return;
    }

    try {
      await sock.groupParticipantsUpdate(jid, [target], "promote");
      await sock.sendMessage(jid, {
        text: `👑 Promoted @${target.split("@")[0]} to admin.`,
      });
    } catch (error) {
      await sock.sendMessage(jid, {
        text: "❌ I could not promote that user.",
      });
    }
  },
};
