function isOwner(sender, ownerJid) {
  if (!sender || !ownerJid) return false;
  return sender.replace(/:.+$/, "") === ownerJid.replace(/:.+$/, "");
}

module.exports = { isOwner };
