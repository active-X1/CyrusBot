const { setGroupSetting, getGroupSetting } = require("../handlers/groupHandler");
const { config } = require("../config");

module.exports = {
  name: "welcome",
  description: "Toggle welcome messages for the current group.",
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

    const enabled = getGroupSetting(jid, "welcome", false);
    const nextValue = !enabled;

    setGroupSetting(jid, "welcome", nextValue);

    await sock.sendMessage(jid, {
      text: `👋 Welcome messages are now ${nextValue ? "enabled" : "disabled"}.`,
    });
  },
};
