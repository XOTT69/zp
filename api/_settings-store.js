const SETTINGS_KEY = "zp:admin-settings";
const memorySettings = globalThis.__payrollAdminSettings ?? defaultSettings();
globalThis.__payrollAdminSettings = memorySettings;

export async function getAdminSettings() {
  if (!hasRedis()) return structuredClone(memorySettings);

  try {
    const response = await redis(["GET", SETTINGS_KEY]);
    return normalizeSettings(response.result ? JSON.parse(response.result) : memorySettings);
  } catch {
    return structuredClone(memorySettings);
  }
}

export async function saveAdminSettings(settings) {
  const normalized = normalizeSettings(settings);
  Object.keys(memorySettings).forEach((key) => delete memorySettings[key]);
  Object.assign(memorySettings, normalized);

  if (hasRedis()) {
    await redis(["SET", SETTINGS_KEY, JSON.stringify(normalized)]).catch(() => {});
  }
  return normalized;
}

export function defaultSettings() {
  return {
    version: {
      label: "Правила актуальні з 01.03.2026",
      updatedAt: "2026-07-08",
      note: ""
    },
    overrides: {},
    templates: {}
  };
}

function normalizeSettings(settings = {}) {
  return {
    version: {
      label: String(settings.version?.label || "Правила актуальні з 01.03.2026").slice(0, 120),
      updatedAt: String(settings.version?.updatedAt || new Date().toISOString().slice(0, 10)).slice(0, 20),
      note: String(settings.version?.note || "").slice(0, 240)
    },
    overrides: normalizeObject(settings.overrides),
    templates: normalizeObject(settings.templates)
  };
}

function normalizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "");
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command])
  });
  if (!response.ok) throw new Error("Redis request failed");
  return (await response.json())[0];
}
