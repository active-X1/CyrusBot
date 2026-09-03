const { isAdmin } = require("../handlers/groupHandler");

module.exports = {
  name: "delete",
  description: "Delete the replied message in a group.",
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

    if (!(await isAdmin(sock, jid, sender))) {
      await sock.sendMessage(jid, {
        text: "❌ Only group admins can use .delete.",
      });
      return;
    }

    try {
      await sock.sendMessage(jid, {
        delete: msg.key,
      });
    } catch (error) {
      await sock.sendMessage(jid, {
        text: "❌ I could not delete that message.",
      });
    }
  },
};
