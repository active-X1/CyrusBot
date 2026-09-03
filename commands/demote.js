const { isAdmin } = require("../handlers/groupHandler");

module.exports = {
  name: "demote",
  description: "Remove admin rights from a group member.",
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
        text: "❌ Only group admins can use .demote.",
      });
      return;
    }

    const target =
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      args[0] ||
      null;

    if (!target) {
      await sock.sendMessage(jid, {
        text: "⚠️ Mention or reply to a user before using .demote.",
      });
      return;
    }

    try {
      await sock.groupParticipantsUpdate(jid, [target], "demote");
      await sock.sendMessage(jid, {
        text: `📉 Demoted @${target.split("@")[0]} from admin.`,
      });
    } catch (error) {
      await sock.sendMessage(jid, {
        text: "❌ I could not demote that user.",
      });
    }
  },
};
