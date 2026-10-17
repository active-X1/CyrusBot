// lib/groupCache.js
//
// Short-lived cache for group metadata. Without it, every admin check and
// every group command asks WhatsApp over the network for the same data
// (a slow round trip each time, and too many requests can get rate limited).
//
//   getGroupMetadata(sock, chatId)  -> cached for TTL_MS, fetched once even if
//                                      several callers ask at the same moment
//   peek(chatId)                    -> cached copy or undefined (used by
//                                      Baileys' cachedGroupMetadata option)
//   invalidate(chatId)              -> drop it (called when members/admins/
//                                      settings change)

const TTL_MS = 60_000;

const cache = new Map();    // chatId -> { meta, ts }
const inflight = new Map(); // chatId -> Promise

function peek(chatId) {
  const hit = cache.get(chatId);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.meta;
  return undefined;
}

async function getGroupMetadata(sock, chatId, { force = false } = {}) {
  if (!force) {
    const cached = peek(chatId);
    if (cached) return cached;
    if (inflight.has(chatId)) return inflight.get(chatId);
  }

  const p = sock
    .groupMetadata(chatId)
    .then((meta) => {
      cache.set(chatId, { meta, ts: Date.now() });
      return meta;
    })
    .finally(() => inflight.delete(chatId));

  inflight.set(chatId, p);
  return p;
}

function invalidate(chatId) {
  cache.delete(chatId);
  inflight.delete(chatId);
}

// Keep the map from growing forever on a bot that sits in many groups.
setInterval(() => {
  const now = Date.now();
  for (const [id, hit] of cache) if (now - hit.ts >= TTL_MS) cache.delete(id);
}, 5 * 60_000).unref();

module.exports = { getGroupMetadata, peek, invalidate };
