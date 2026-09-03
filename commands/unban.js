const { isAdmin, removeBannedUser } = require("../handlers/groupHandler");

module.exports = {
  name: "unban",
  description: "Remove a user from the group ban list.",
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
        text: "❌ Only group admins can use .unban.",
      });
      return;
    }

    const target =
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      args[0] ||
      null;

    if (!target) {
      await sock.sendMessage(jid, {
        text: "⚠️ Mention or reply to a user before using .unban.",
      });
      return;
    }

    removeBannedUser(jid, target);

    await sock.sendMessage(jid, {
      text: `✅ Unbanned @${target.split("@")[0]} from the group.`,
    });
  },
};
