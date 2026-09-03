const { setGroupSetting, getGroupSetting } = require("../handlers/groupHandler");

module.exports = {
  name: "antibadword",
  description: "Enable or disable the group bad-word filter.",
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

    const enabled = getGroupSetting(jid, "badword", false);
    const nextValue = !enabled;

    setGroupSetting(jid, "badword", nextValue);

    await sock.sendMessage(jid, {
      text: `🛡️ Bad-word protection is now ${nextValue ? "enabled" : "disabled"}.`,
    });
  },
};
