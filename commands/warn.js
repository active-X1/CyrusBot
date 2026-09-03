const { isAdmin, incrementWarning, getWarningCount, resetWarnings } = require("../handlers/groupHandler");

module.exports = {
  name: "warn",
  description: "Warn a user in the current group.",
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
        text: "❌ Only group admins can use .warn.",
      });
      return;
    }

    const target =
      msg.message?.extendedTextMessage?.contextInfo?.participant ||
      args[0] ||
      null;

    if (!target) {
      await sock.sendMessage(jid, {
        text: "⚠️ Mention or reply to a user before using .warn.",
      });
      return;
    }

    const warnings = incrementWarning(jid, target);

    await sock.sendMessage(jid, {
      text: `⚠️ @${target.split("@")[0]} now has ${warnings} warning(s).`,
    });

    if (warnings >= 3) {
      await sock.sendMessage(jid, {
        text: `🚫 @${target.split("@")[0]} has reached 3 warnings and is now banned for this group.`,
      });
      resetWarnings(jid, target);
    }
  },
};
