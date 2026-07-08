const STATS_PREFIX = "zp:stats";
const COUNTER_KEYS = {
  loginAttempts: `${STATS_PREFIX}:counter:login_attempts`,
  loginSuccess: `${STATS_PREFIX}:counter:login_success`,
  loginFailed: `${STATS_PREFIX}:counter:login_failed`,
  views: `${STATS_PREFIX}:counter:views`,
  copies: `${STATS_PREFIX}:counter:copies`,
  pdfs: `${STATS_PREFIX}:counter:pdfs`
};
const HASH_KEYS = {
  roleLogins: `${STATS_PREFIX}:hash:role_logins`,
  roleViews: `${STATS_PREFIX}:hash:role_views`,
  calculatorViews: `${STATS_PREFIX}:hash:calculator_views`,
  pathViews: `${STATS_PREFIX}:hash:path_views`,
  daily: `${STATS_PREFIX}:hash:daily`
};
const RECENT_KEY = `${STATS_PREFIX}:recent`;
const ALL_KEYS = [...Object.values(COUNTER_KEYS), ...Object.values(HASH_KEYS), RECENT_KEY];

const memoryStore = globalThis.__payrollStatsStore ?? {
  counters: Object.fromEntries(Object.keys(COUNTER_KEYS).map((key) => [key, 0])),
  hashes: Object.fromEntries(Object.keys(HASH_KEYS).map((key) => [key, {}])),
  recent: []
};
globalThis.__payrollStatsStore = memoryStore;

export async function recordAuthEvent({ role, success }) {
  const event = {
    type: success ? "login_success" : "login_failed",
    role: cleanValue(role),
    success: Boolean(success)
  };

  await writeStats([
    ["INCR", COUNTER_KEYS.loginAttempts],
    ["INCR", success ? COUNTER_KEYS.loginSuccess : COUNTER_KEYS.loginFailed],
    ...(success ? [["HINCRBY", HASH_KEYS.roleLogins, event.role, 1]] : []),
    ["HINCRBY", HASH_KEYS.daily, dailyField(event.type), 1],
    ...recentCommands(event)
  ], () => {
    memoryStore.counters.loginAttempts += 1;
    memoryStore.counters[success ? "loginSuccess" : "loginFailed"] += 1;
    if (success) incrementMemoryHash("roleLogins", event.role);
    incrementMemoryHash("daily", dailyField(event.type));
    pushMemoryRecent(event);
  });
}

export async function recordClientEvent({ type, role, calculator, path }) {
  const safeType = ["view", "copy", "pdf"].includes(type) ? type : "view";
  const counterKey = safeType === "copy"
    ? COUNTER_KEYS.copies
    : safeType === "pdf"
      ? COUNTER_KEYS.pdfs
      : COUNTER_KEYS.views;
  const counterName = safeType === "copy" ? "copies" : safeType === "pdf" ? "pdfs" : "views";
  const event = {
    type: safeType,
    role: cleanValue(role),
    calculator: cleanValue(calculator || "home"),
    path: cleanValue(path || "/")
  };

  await writeStats([
    ["INCR", counterKey],
    ["HINCRBY", HASH_KEYS.roleViews, event.role, 1],
    ["HINCRBY", HASH_KEYS.calculatorViews, event.calculator, 1],
    ["HINCRBY", HASH_KEYS.pathViews, event.path, 1],
    ["HINCRBY", HASH_KEYS.daily, dailyField(safeType), 1],
    ...recentCommands(event)
  ], () => {
    memoryStore.counters[counterName] += 1;
    incrementMemoryHash("roleViews", event.role);
    incrementMemoryHash("calculatorViews", event.calculator);
    incrementMemoryHash("pathViews", event.path);
    incrementMemoryHash("daily", dailyField(safeType));
    pushMemoryRecent(event);
  });
}

export async function getStatsSnapshot() {
  if (!hasRedis()) {
    return {
      storage: "ephemeral",
      counters: { ...memoryStore.counters },
      roleLogins: { ...memoryStore.hashes.roleLogins },
      roleViews: { ...memoryStore.hashes.roleViews },
      calculatorViews: { ...memoryStore.hashes.calculatorViews },
      pathViews: { ...memoryStore.hashes.pathViews },
      daily: { ...memoryStore.hashes.daily },
      recent: [...memoryStore.recent]
    };
  }

  try {
    const response = await redisPipeline([
      ...Object.values(COUNTER_KEYS).map((key) => ["GET", key]),
      ["HGETALL", HASH_KEYS.roleLogins],
      ["HGETALL", HASH_KEYS.roleViews],
      ["HGETALL", HASH_KEYS.calculatorViews],
      ["HGETALL", HASH_KEYS.pathViews],
      ["HGETALL", HASH_KEYS.daily],
      ["LRANGE", RECENT_KEY, 0, 29]
    ]);

    const results = response.map((item) => item?.result);
    return {
      storage: "redis",
      counters: {
        loginAttempts: toNumber(results[0]),
        loginSuccess: toNumber(results[1]),
        loginFailed: toNumber(results[2]),
        views: toNumber(results[3]),
        copies: toNumber(results[4]),
        pdfs: toNumber(results[5])
      },
      roleLogins: normalizeHash(results[6]),
      roleViews: normalizeHash(results[7]),
      calculatorViews: normalizeHash(results[8]),
      pathViews: normalizeHash(results[9]),
      daily: normalizeHash(results[10]),
      recent: normalizeRecent(results[11])
    };
  } catch {
    return {
      storage: "redis-unavailable",
      counters: { ...memoryStore.counters },
      roleLogins: { ...memoryStore.hashes.roleLogins },
      roleViews: { ...memoryStore.hashes.roleViews },
      calculatorViews: { ...memoryStore.hashes.calculatorViews },
      pathViews: { ...memoryStore.hashes.pathViews },
      daily: { ...memoryStore.hashes.daily },
      recent: [...memoryStore.recent]
    };
  }
}

export async function resetStats() {
  Object.keys(memoryStore.counters).forEach((key) => {
    memoryStore.counters[key] = 0;
  });
  Object.keys(memoryStore.hashes).forEach((key) => {
    memoryStore.hashes[key] = {};
  });
  memoryStore.recent = [];

  if (!hasRedis()) return;
  await redisPipeline([["DEL", ...ALL_KEYS]]).catch(() => {});
}

function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function writeStats(commands, fallback) {
  fallback();
  if (!hasRedis()) return;
  await redisPipeline(commands).catch(() => {});
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

  if (!response.ok) {
    throw new Error("Redis request failed");
  }

  return response.json();
}

function recentCommands(event) {
  const payload = JSON.stringify({ ...event, at: new Date().toISOString() });
  return [
    ["LPUSH", RECENT_KEY, payload],
    ["LTRIM", RECENT_KEY, 0, 49]
  ];
}

function pushMemoryRecent(event) {
  memoryStore.recent.unshift({ ...event, at: new Date().toISOString() });
  memoryStore.recent = memoryStore.recent.slice(0, 50);
}

function incrementMemoryHash(hashName, field) {
  memoryStore.hashes[hashName][field] = (memoryStore.hashes[hashName][field] ?? 0) + 1;
}

function normalizeHash(value) {
  if (!value) return {};
  if (!Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, count]) => [key, toNumber(count)])
    );
  }

  const result = {};
  for (let index = 0; index < value.length; index += 2) {
    result[value[index]] = toNumber(value[index + 1]);
  }
  return result;
}

function normalizeRecent(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return { type: "unknown", at: item };
    }
  });
}

function dailyField(type) {
  return `${new Date().toISOString().slice(0, 10)}:${type}`;
}

function cleanValue(value) {
  return String(value || "unknown").slice(0, 80);
}

function toNumber(value) {
  return Number(value || 0);
}
