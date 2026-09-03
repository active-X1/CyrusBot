const path = require("path");

const {
  DATABASE_DIR,
  readJSON,
  writeJSON,
} = require("../config");

const GROUP_SETTINGS_FILE = path.join(
  DATABASE_DIR,
  "groups.json"
);

function normalizeJid(jid) {
  if (!jid) {
    return "";
  }

  return jid.replace(/:.+$/, "");
}

const BAD_WORDS = [
  "stupid",
  "idiot",
  "dumb",
  "hate",
  "fool",
  "loser",
  "trash",
  "nonsense",
  "moron",
  "bastard",
];

function initGroupState(groupId) {
  return {
    antilink: false,
    welcome: false,
    goodbye: false,
    badword: false,
    mutedUsers: {},
    bannedUsers: {},
    warnings: {},
  };
}

function getGroupSettings(groupId) {
  const data = readJSON(GROUP_SETTINGS_FILE, {});
  const safeData = Array.isArray(data) ? {} : data;

  if (!groupId) {
    return initGroupState(groupId);
  }

  if (!safeData[groupId]) {
    safeData[groupId] = initGroupState(groupId);
    writeJSON(GROUP_SETTINGS_FILE, safeData);
  }

  safeData[groupId].mutedUsers ??= {};
  safeData[groupId].bannedUsers ??= {};

  return safeData[groupId];
}

function saveGroupSettings(data) {
  const safeData = Array.isArray(data) ? {} : data;
  writeJSON(GROUP_SETTINGS_FILE, safeData);
  return safeData;
}

function setGroupSetting(groupId, key, value) {
  const data = readJSON(GROUP_SETTINGS_FILE, {});
  const safeData = Array.isArray(data) ? {} : data;

  if (!safeData[groupId]) {
    safeData[groupId] = initGroupState(groupId);
  }

  safeData[groupId][key] = value;
  saveGroupSettings(safeData);
  return safeData[groupId];
}

function getGroupSetting(groupId, key, fallback = false) {
  return getGroupSettings(groupId)[key] ?? fallback;
}

function addMutedUser(groupId, participant, minutes = 0) {
  const data = readJSON(GROUP_SETTINGS_FILE, {});
  const safeData = Array.isArray(data) ? {} : data;
  const settings = safeData[groupId] || initGroupState(groupId);

  settings.mutedUsers ??= {};
  settings.mutedUsers[normalizeJid(participant)] =
    minutes > 0 ? Date.now() + minutes * 60 * 1000 : Date.now();

  safeData[groupId] = settings;
  saveGroupSettings(safeData);
  return settings;
}

function removeMutedUser(groupId, participant) {
  const data = readJSON(GROUP_SETTINGS_FILE, {});
  const safeData = Array.isArray(data) ? {} : data;
  const settings = safeData[groupId] || initGroupState(groupId);

  settings.mutedUsers ??= {};
  delete settings.mutedUsers[normalizeJid(participant)];

  safeData[groupId] = settings;
  saveGroupSettings(safeData);
  return settings;
}

function isMutedUser(groupId, participant) {
  const settings = getGroupSettings(groupId);
  const member = normalizeJid(participant);
  const timestamp = settings.mutedUsers?.[member];

  if (!timestamp) {
    return false;
  }

  if (timestamp <= Date.now()) {
    removeMutedUser(groupId, member);
    return false;
  }

  return true;
}

function addBannedUser(groupId, participant) {
  const data = readJSON(GROUP_SETTINGS_FILE, {});
  const safeData = Array.isArray(data) ? {} : data;
  const settings = safeData[groupId] || initGroupState(groupId);

  settings.bannedUsers ??= {};
  settings.bannedUsers[normalizeJid(participant)] = true;

  safeData[groupId] = settings;
  writeJSON(GROUP_SETTINGS_FILE, safeData);
  return settings;
}

function removeBannedUser(groupId, participant) {
  const data = readJSON(GROUP_SETTINGS_FILE, {});
  const safeData = Array.isArray(data) ? {} : data;
  const settings = safeData[groupId] || initGroupState(groupId);

  settings.bannedUsers ??= {};
  delete settings.bannedUsers[normalizeJid(participant)];

  safeData[groupId] = settings;
  writeJSON(GROUP_SETTINGS_FILE, safeData);
  return settings;
}

function isBannedUser(groupId, participant) {
  const settings = getGroupSettings(groupId);
  return !!settings.bannedUsers?.[normalizeJid(participant)];
}

function getWarningCount(groupId, participant) {
  const settings = getGroupSettings(groupId);
  return Number(settings.warnings?.[normalizeJid(participant)] || 0);
}

function incrementWarning(groupId, participant) {
  const data = readJSON(GROUP_SETTINGS_FILE, {});
  const safeData = Array.isArray(data) ? {} : data;
  const settings = safeData[groupId] || initGroupState(groupId);

  settings.warnings ??= {};
  const normalized = normalizeJid(participant);
  settings.warnings[normalized] = (settings.warnings[normalized] || 0) + 1;

  safeData[groupId] = settings;
  saveGroupSettings(safeData);

  return settings.warnings[normalized];
}

function resetWarnings(groupId, participant) {
  const data = readJSON(GROUP_SETTINGS_FILE, {});
  const safeData = Array.isArray(data) ? {} : data;
  if (!safeData[groupId]) {
    return 0;
  }

  if (participant) {
    delete safeData[groupId].warnings?.[normalizeJid(participant)];
  } else {
    safeData[groupId].warnings = {};
  }

  saveGroupSettings(safeData);
  return getWarningCount(groupId, participant || "");
}

function containsLink(text) {
  return /(https?:\/\/|www\.)\S+/i.test(text || "");
}

async function getCurrentGroupName(sock, groupId) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    return metadata?.subject || "this group";
  } catch (error) {
    return "this group";
  }
}

async function getDisplayName(sock, groupId, participant) {
  const target = participant || "";
  const phone = normalizeJid(target).split("@")[0] || "member";

  try {
    const metadata = await sock.groupMetadata(groupId);
    const user = (metadata?.participants || []).find(
      (member) => normalizeJid(member.id) === normalizeJid(target)
    );

    if (user?.notify) {
      return user.notify;
    }

    if (user?.name) {
      return user.name;
    }
  } catch (error) {
    // fall through to number
  }

  return phone;
}

async function handleGroupJoinEvent(sock, groupId, participants) {
  if (!sock || !groupId || !Array.isArray(participants)) {
    return;
  }

  if (!getGroupSetting(groupId, "welcome", false)) {
    return;
  }

  const groupName = await getCurrentGroupName(sock, groupId);

  for (const participant of participants) {
    const cleanedParticipant = normalizeJid(participant);
    const displayName = await getDisplayName(sock, groupId, participant);

    await sock.sendMessage(groupId, {
      text: `👋 Welcome *@${displayName}* to *${groupName}*!`,
      mentions: [cleanedParticipant + "@s.whatsapp.net"],
    });
  }
}

async function handleGroupLeaveEvent(sock, groupId, participants) {
  if (!sock || !groupId || !Array.isArray(participants)) {
    return;
  }

  if (!getGroupSetting(groupId, "goodbye", false)) {
    return;
  }

  const groupName = await getCurrentGroupName(sock, groupId);

  for (const participant of participants) {
    const cleanedParticipant = normalizeJid(participant);
    const displayName = await getDisplayName(sock, groupId, participant);

    await sock.sendMessage(groupId, {
      text: `👋 Goodbye *@${displayName}* from *${groupName}*...`,
      mentions: [cleanedParticipant + "@s.whatsapp.net"],
    });
  }
}

function containsBadWord(text) {
  if (!text || typeof text !== "string") {
    return false;
  }

  const lower = text.toLowerCase();
  return BAD_WORDS.some((word) => lower.includes(word));
}

async function isAdmin(sock, chatId, participantJid) {
  if (!sock || !chatId || !participantJid) {
    return false;
  }

  try {
    const metadata = await sock.groupMetadata(chatId);
    const normalizedParticipant = normalizeJid(participantJid);

    return (metadata?.participants || []).some((member) => {
      const memberId = normalizeJid(member.id);
      const isGroupAdmin = ["admin", "superadmin"].includes(
        member?.admin || ""
      );

      return memberId === normalizedParticipant && isGroupAdmin;
    });
  } catch (error) {
    return false;
  }
}

async function handleGroupMessage(sock, msg) {
  if (
    !sock ||
    !msg ||
    !msg.key?.remoteJid ||
    !msg.key.remoteJid.endsWith("@g.us")
  ) {
    return false;
  }

  const groupId = msg.key.remoteJid;
  const sender = msg.key.participant || groupId;
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    "";

  const settings = getGroupSettings(groupId);

  if (isBannedUser(groupId, sender)) {
    return true;
  }

  if (
    isMutedUser(groupId, sender) &&
    !(await isAdmin(sock, groupId, sender))
  ) {
    return true;
  }

  if (
    settings.antilink &&
    containsLink(text) &&
    !(await isAdmin(sock, groupId, sender))
  ) {
    try {
      await sock.sendMessage(groupId, {
        text: "🚫 Links are not allowed in this group.",
      });
    } catch (error) {
      // Ignore send issues and keep the message flow safe.
    }

    try {
      await sock.sendMessage(groupId, {
        delete: msg.key,
      });
    } catch (error) {
      // Ignore delete issues for compatibility.
    }

    return true;
  }

  if (
    settings.badword &&
    containsBadWord(text) &&
    !(await isAdmin(sock, groupId, sender))
  ) {
    const currentWarnings = incrementWarning(groupId, sender);
    const maxWarnings = 3;

    try {
      await sock.sendMessage(groupId, {
        text:
          `⚠️ Warning: ${currentWarnings}/${maxWarnings}. ` +
          "Please avoid abusive language.",
      });
    } catch (error) {
      // Ignore send issues.
    }

    try {
      await sock.sendMessage(groupId, {
        delete: msg.key,
      });
    } catch (error) {
      // Ignore delete issues.
    }

    if (currentWarnings >= maxWarnings) {
      addBannedUser(groupId, sender);
      try {
        await sock.sendMessage(groupId, {
          text: `🚫 @${sender.split("@")[0]} has been banned for repeated bad-word violations.`,
        });
      } catch (error) {
        // Ignore send issues.
      }

      resetWarnings(groupId, sender);
    }

    return true;
  }

  return false;
}

module.exports = {
  handleGroupMessage,
  getGroupSettings,
  setGroupSetting,
  getGroupSetting,
  isAdmin,
  containsLink,
  containsBadWord,
  normalizeJid,
  addMutedUser,
  removeMutedUser,
  isMutedUser,
  addBannedUser,
  removeBannedUser,
  isBannedUser,
  getWarningCount,
  incrementWarning,
  resetWarnings,
  handleGroupJoinEvent,
  handleGroupLeaveEvent,
};
