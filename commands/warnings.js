const { isAdmin, getWarningCount, resetWarnings } = require("../handlers/groupHandler");

module.exports = {
  name: "warnings",
  description: "Show the warning count for a user.",
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
        text: "❌ Only group admins can use .warnings.",
      });
      return;
    }

    const target =
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      args[0] ||
      sender;

    const count = getWarningCount(jid, target);

    await sock.sendMessage(jid, {
      text: `📊 @${target.split("@")[0]} has ${count} warning(s).`,
    });
  },
};
