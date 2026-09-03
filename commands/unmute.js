const { isAdmin, removeMutedUser } = require("../handlers/groupHandler");

module.exports = {
  name: "unmute",
  description: "Unmute a user in the current group.",
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
        text: "❌ Only group admins can use .unmute.",
      });
      return;
    }

    const target =
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      args[0] ||
      null;

    if (!target) {
      await sock.sendMessage(jid, {
        text: "⚠️ Mention or reply to a user before using .unmute.",
      });
      return;
    }

    removeMutedUser(jid, target);

    await sock.sendMessage(jid, {
      text: `🔊 Unmuted @${target.split("@")[0]} in this group.`,
    });
  },
};
