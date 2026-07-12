const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 10;
const memoryAttempts = globalThis.__payrollLoginAttempts ?? new Map();
globalThis.__payrollLoginAttempts = memoryAttempts;

export async function consumeLoginAttempt(req, role) {
  const key = `${clientIp(req)}:${String(role || "unknown").slice(0, 40)}`;
  const now = Date.now();
  const current = memoryAttempts.get(key);
  const entry = !current || current.expiresAt <= now
    ? { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 }
    : { ...current, count: current.count + 1 };
  memoryAttempts.set(key, entry);
  pruneExpiredEntries(now);

  if (hasRedis()) {
    try {
      const redisKey = `zp:login-limit:${encodeURIComponent(key)}`;
      const response = await redisPipeline([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, WINDOW_SECONDS, "NX"],
        ["TTL", redisKey]
      ]);
      const count = Number(response[0]?.result || 0);
      const ttl = Math.max(1, Number(response[2]?.result || WINDOW_SECONDS));
      return { allowed: count <= MAX_ATTEMPTS, retryAfter: ttl };
    } catch {
      // The bounded in-memory limiter remains active when Redis is unavailable.
    }
  }

  return {
    allowed: entry.count <= MAX_ATTEMPTS,
    retryAfter: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000))
  };
}

export async function clearLoginAttempts(req, role) {
  const key = `${clientIp(req)}:${String(role || "unknown").slice(0, 40)}`;
  memoryAttempts.delete(key);
  if (!hasRedis()) return;
  const redisKey = `zp:login-limit:${encodeURIComponent(key)}`;
  await redisPipeline([["DEL", redisKey]]).catch(() => {});
}

function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return (forwarded || req.socket?.remoteAddress || "unknown").slice(0, 80);
}

function pruneExpiredEntries(now) {
  if (memoryAttempts.size < 1000) return;
  for (const [key, entry] of memoryAttempts) {
    if (entry.expiresAt <= now) memoryAttempts.delete(key);
  }
}

function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisPipeline(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "");
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  });
  if (!response.ok) throw new Error("Redis request failed");
  return response.json();
}
