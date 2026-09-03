const { setGroupSetting, getGroupSetting } = require("../handlers/groupHandler");

module.exports = {
  name: "goodbye",
  description: "Toggle goodbye messages for the current group.",
  category: "Group",
  groupOnly: true,
  adminOnly: true,

  async execute(sock, msg, context) {
    const { jid } = context;

    if (!jid.endsWith("@g.us")) {
      await sock.sendMessage(jid, {
        text: "⚠️ This command only works in groups.",
      });
      return;
    }

    const enabled = getGroupSetting(jid, "goodbye", false);
    const nextValue = !enabled;

    setGroupSetting(jid, "goodbye", nextValue);

    await sock.sendMessage(jid, {
      text: `👋 Goodbye messages are now ${nextValue ? "enabled" : "disabled"}.`,
    });
  },
};
