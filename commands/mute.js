const { isAdmin, addMutedUser, removeMutedUser } = require("../handlers/groupHandler");

module.exports = {
  name: "mute",
  description: "Mute a user in this group for a short time.",
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
        text: "❌ Only group admins can use .mute.",
      });
      return;
    }

    const target =
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      args[0] ||
      null;

    if (!target) {
      await sock.sendMessage(jid, {
        text: "⚠️ Mention or reply to a user before using .mute.",
      });
      return;
    }

    const minutes = Number(args[1] || 5);
    addMutedUser(jid, target, Number.isFinite(minutes) ? minutes : 5);

    await sock.sendMessage(jid, {
      text: `🔇 Muted @${target.split("@")[0]} for ${minutes} minute(s).`,
    });
  },
};
