import { validateAdminSettings } from "./_settings-validation.js";

const SETTINGS_KEY = "zp:admin-settings";
const HISTORY_KEY = "zp:admin-settings:history";
const HISTORY_LIMIT = 30;

const memorySettings = globalThis.__payrollAdminSettings ?? defaultSettings();
const memoryHistory = globalThis.__payrollAdminSettingsHistory ?? [];
globalThis.__payrollAdminSettings = memorySettings;
globalThis.__payrollAdminSettingsHistory = memoryHistory;

export async function getAdminSettings() {
  if (!hasRedis()) return structuredClone(memorySettings);

  try {
    const response = await redisPipeline([["GET", SETTINGS_KEY]]);
    const stored = response[0]?.result ? JSON.parse(response[0].result) : memorySettings;
    return validateAdminSettings(stored);
  } catch (error) {
    throw new Error("Сховище правил недоступне. Не використовуйте базові ставки замість актуальних.");
  }
}

export async function getSettingsHistory(limit = 20) {
  const safeLimit = Math.min(HISTORY_LIMIT, Math.max(1, Number(limit) || 20));
  if (!hasRedis()) return structuredClone(memoryHistory.slice(0, safeLimit));

  try {
    const response = await redisPipeline([["LRANGE", HISTORY_KEY, 0, safeLimit - 1]]);
    return (response[0]?.result ?? []).map(parseHistoryEntry).filter(Boolean);
  } catch {
    return structuredClone(memoryHistory.slice(0, safeLimit));
  }
}

export async function saveAdminSettings(settings, meta = {}) {
  let normalized = validateAdminSettings(settings);
  const previous = await getAdminSettings();
  if (JSON.stringify(previous) === JSON.stringify(normalized)) return normalized;

  const versions = [...(previous.rateVersions || [])];
  if (previous.version.effectiveFrom !== normalized.version.effectiveFrom) {
    versions.push({version:previous.version,overrides:previous.overrides,templates:previous.templates});
  }
  normalized = validateAdminSettings({...normalized,rateVersions:versions.slice(-60)});
  if (process.env.NODE_ENV === 'production' && !hasRedis()) throw new Error('Для збереження правил потрібне постійне сховище Redis.');
  const revision = createRevision(previous, meta);
  if (hasRedis()) {
    await redisPipeline([
      ["SET", SETTINGS_KEY, JSON.stringify(normalized)],
      ["LPUSH", HISTORY_KEY, JSON.stringify(revision)],
      ["LTRIM", HISTORY_KEY, 0, HISTORY_LIMIT - 1]
    ]);
  }
  rememberRevision(revision);
  replaceMemorySettings(normalized);
  return normalized;
}

export async function rollbackAdminSettings(revisionId) {
  const history = await getSettingsHistory(HISTORY_LIMIT);
  const revision = history.find((item) => item.id === revisionId);
  if (!revision) throw new Error("Версію для відкату не знайдено.");
  return saveAdminSettings(revision.settings, {
    action: "rollback",
    summary: `Відкат до версії від ${revision.at}`
  });
}

export function defaultSettings() {
  return {
    rateVersions: [],
    version: {
      effectiveFrom: "2026-03-01",
      label: "Правила актуальні з 01.03.2026",
      updatedAt: "2026-07-08",
      note: ""
    },
    overrides: {},
    templates: {}
  };
}

function createRevision(settings, meta) {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action: meta.action === "rollback" ? "rollback" : "update",
    summary: String(meta.summary || "Оновлено налаштування").slice(0, 160),
    settings: structuredClone(settings)
  };
}

function rememberRevision(revision) {
  memoryHistory.unshift(structuredClone(revision));
  memoryHistory.splice(HISTORY_LIMIT);
}

function replaceMemorySettings(settings) {
  Object.keys(memorySettings).forEach((key) => delete memorySettings[key]);
  Object.assign(memorySettings, structuredClone(settings));
}

function parseHistoryEntry(value) {
  try {
    const entry = typeof value === "string" ? JSON.parse(value) : value;
    if (!entry?.id || !entry?.at || !entry?.settings) return null;
    return {
      id: String(entry.id).slice(0, 80),
      at: String(entry.at).slice(0, 40),
      action: entry.action === "rollback" ? "rollback" : "update",
      summary: String(entry.summary || "Оновлено налаштування").slice(0, 160),
      settings: validateAdminSettings(entry.settings)
    };
  } catch {
    return null;
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
  const results = await response.json();
  if (!Array.isArray(results) || results.some(r => r.error)) throw new Error("Redis command failed");
  return results;
}
