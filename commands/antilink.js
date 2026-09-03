const { setGroupSetting, getGroupSetting } = require("../handlers/groupHandler");
const { config } = require("../config");

module.exports = {
  name: "antilink",
  description: "Enable or disable link blocking in the current group.",
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

    const enabled = getGroupSetting(jid, "antilink", false);
    const nextValue = !enabled;

    setGroupSetting(jid, "antilink", nextValue);

    await sock.sendMessage(jid, {
      text:
        `🛡️ Antilink is now ${nextValue ? "enabled" : "disabled"} for this group.\n` +
        `Requested by: @${sender.split("@")[0]}`,
    });
  },
};
