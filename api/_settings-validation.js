const CALCULATORS = new Set(["service", "supervisor", "level4", "xd", "video", "iron", "sz", "psz", "msb", "meo", "fm", "concierge", "soft"]);
const MONTHS = new Set(["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"]);
const LEVELS = new Set(["level1", "level2", "level3"]);
const SCHEDULES = new Set(["2/2", "5/2"]);
const OVERRIDE_FIELDS = new Set([
  "salary",
  "tenureBase",
  "taxRate",
  "ratingBonusByZone",
  "levelBonusByLevel",
  "levelBonusByLevelAndZone",
  "scheduleMonthHours"
]);
const TEMPLATE_NUMBERS = {
  actualHours: [0, 400],
  ratingZone: [1, 5],
  nightHours: [0, 400],
  holidayHours: [0, 400],
  doubleHours: [0, 400],
  wowCases: [0, 1_000_000],
  fines: [0, 1_000_000],
  taxiAmount: [0, 1_000_000],
  tenureYears: [0, 15],
  tenureHours: [0, 400],
  firstHalfHours: [0, 400],
  secondHalfHours: [0, 400],
  annualIncome: [0, 100_000_000],
  absenceCalendarDays: [1, 366],
  vacationDays: [0, 366],
  sickDays: [0, 366],
  sickInsuranceRate: [0, 1],
  maternityDays: [0, 366]
};

export class SettingsValidationError extends Error {
  constructor(issues) {
    super(issues[0] || "Невірні налаштування.");
    this.name = "SettingsValidationError";
    this.issues = issues.slice(0, 20);
  }
}

export function validateAdminSettings(settings) {
  const issues = [];
  assertPlainObject(settings, "settings", issues);
  rejectUnknownKeys(settings, new Set(["version", "overrides", "templates", "rateVersions"]), "settings", issues);

  const normalized = {
    rateVersions: normalizeRateVersions(settings?.rateVersions, issues),
    version: normalizeVersion(settings?.version, issues),
    overrides: normalizeOverrides(settings?.overrides, issues),
    templates: normalizeTemplates(settings?.templates, issues)
  };

  if (issues.length) throw new SettingsValidationError(issues);
  return normalized;
}

function normalizeVersion(value, issues) {
  const version = value ?? {};
  assertPlainObject(version, "version", issues);
  rejectUnknownKeys(version, new Set(["label", "updatedAt", "note", "effectiveFrom"]), "version", issues);
  const date = String(version.updatedAt || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) issues.push("version.updatedAt має бути датою YYYY-MM-DD.");
  const effectiveFrom = String(version.effectiveFrom || '2026-03-01');
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(effectiveFrom)) issues.push('Початок дії правил має бути першим числом місяця YYYY-MM-01.');
  return {
    effectiveFrom,
    label: boundedText(version.label || "Правила актуальні з 01.03.2026", 120, "version.label", issues),
    updatedAt: date.slice(0, 10),
    note: boundedText(version.note || "", 240, "version.note", issues)
  };
}

function normalizeOverrides(value, issues) {
  const overrides = value ?? {};
  assertPlainObject(overrides, "overrides", issues);
  const result = {};
  if (!isPlainObject(overrides)) return result;
  for (const [calculator, override] of Object.entries(overrides)) {
    if (!CALCULATORS.has(calculator)) {
      issues.push(`Невідомий напрямок overrides.${calculator}.`);
      continue;
    }
    assertPlainObject(override, `overrides.${calculator}`, issues);
    if (!isPlainObject(override)) continue;
    rejectUnknownKeys(override, OVERRIDE_FIELDS, `overrides.${calculator}`, issues);
    const next = {};
    if (override.salary !== undefined) next.salary = finiteNumber(override.salary, 0, 1_000_000, `overrides.${calculator}.salary`, issues);
    if (override.tenureBase !== undefined) next.tenureBase = finiteNumber(override.tenureBase, 0, 1_000_000, `overrides.${calculator}.tenureBase`, issues);
    if (override.taxRate !== undefined) next.taxRate = finiteNumber(override.taxRate, 0, 0.5, `overrides.${calculator}.taxRate`, issues);
    if (override.ratingBonusByZone !== undefined) next.ratingBonusByZone = numberMap(override.ratingBonusByZone, zoneKey, `overrides.${calculator}.ratingBonusByZone`, issues);
    if (override.levelBonusByLevel !== undefined) next.levelBonusByLevel = numberMap(override.levelBonusByLevel, levelKey, `overrides.${calculator}.levelBonusByLevel`, issues);
    if (override.levelBonusByLevelAndZone !== undefined) next.levelBonusByLevelAndZone = nestedNumberMap(override.levelBonusByLevelAndZone, levelKey, zoneOrDefaultKey, `overrides.${calculator}.levelBonusByLevelAndZone`, issues);
    if (override.scheduleMonthHours !== undefined) next.scheduleMonthHours = nestedNumberMap(override.scheduleMonthHours, scheduleKey, monthKey, `overrides.${calculator}.scheduleMonthHours`, issues, 1, 400);
    result[calculator] = next;
  }
  return result;
}

function normalizeTemplates(value, issues) {
  const templates = value ?? {};
  assertPlainObject(templates, "templates", issues);
  const result = {};
  if (!isPlainObject(templates)) return result;
  for (const [calculator, byMonth] of Object.entries(templates)) {
    if (!CALCULATORS.has(calculator)) {
      issues.push(`Невідомий напрямок templates.${calculator}.`);
      continue;
    }
    assertPlainObject(byMonth, `templates.${calculator}`, issues);
    if (!isPlainObject(byMonth)) continue;
    result[calculator] = {};
    for (const [month, template] of Object.entries(byMonth)) {
      if (!MONTHS.has(month)) {
        issues.push(`Невідомий місяць templates.${calculator}.${month}.`);
        continue;
      }
      assertPlainObject(template, `templates.${calculator}.${month}`, issues);
      if (!isPlainObject(template)) continue;
      const allowed = new Set(["workSchedule", "testsHigh", "level", ...Object.keys(TEMPLATE_NUMBERS)]);
      rejectUnknownKeys(template, allowed, `templates.${calculator}.${month}`, issues);
      const next = {};
      if (template.workSchedule !== undefined) {
        if (!SCHEDULES.has(template.workSchedule)) issues.push(`templates.${calculator}.${month}.workSchedule має бути 2/2 або 5/2.`);
        else next.workSchedule = template.workSchedule;
      }
      if (template.level !== undefined) {
        if (!LEVELS.has(template.level)) issues.push(`templates.${calculator}.${month}.level має невірне значення.`);
        else next.level = template.level;
      }
      if (template.testsHigh !== undefined) {
        if (typeof template.testsHigh !== "boolean") issues.push(`templates.${calculator}.${month}.testsHigh має бути true або false.`);
        else next.testsHigh = template.testsHigh;
      }
      for (const [field, range] of Object.entries(TEMPLATE_NUMBERS)) {
        if (template[field] !== undefined) next[field] = finiteNumber(template[field], range[0], range[1], `templates.${calculator}.${month}.${field}`, issues);
      }
      result[calculator][month] = next;
    }
  }
  return result;
}

function numberMap(value, keyValidator, path, issues, min = 0, max = 1_000_000) {
  assertPlainObject(value, path, issues);
  const result = {};
  if (!isPlainObject(value)) return result;
  for (const [key, number] of Object.entries(value || {})) {
    if (!keyValidator(key)) {
      issues.push(`Невірний ключ ${path}.${key}.`);
      continue;
    }
    result[key] = finiteNumber(number, min, max, `${path}.${key}`, issues);
  }
  return result;
}

function nestedNumberMap(value, outerValidator, innerValidator, path, issues, min = 0, max = 1_000_000) {
  assertPlainObject(value, path, issues);
  const result = {};
  if (!isPlainObject(value)) return result;
  for (const [outerKey, inner] of Object.entries(value || {})) {
    if (!outerValidator(outerKey)) {
      issues.push(`Невірний ключ ${path}.${outerKey}.`);
      continue;
    }
    result[outerKey] = numberMap(inner, innerValidator, `${path}.${outerKey}`, issues, min, max);
  }
  return result;
}

function finiteNumber(value, min, max, path, issues) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    issues.push(`${path} має бути числом від ${min} до ${max}.`);
    return min;
  }
  return number;
}

function boundedText(value, max, path, issues) {
  const text = String(value);
  if (text.length > max) issues.push(`${path} не може бути довшим за ${max} символів.`);
  return text.slice(0, max);
}

function assertPlainObject(value, path, issues) {
  if (!isPlainObject(value)) issues.push(`${path} має бути JSON-об'єктом.`);
}

function rejectUnknownKeys(value, allowed, path, issues) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(`Невідоме поле ${path}.${key}.`);
  }
}

const zoneKey = (key) => /^[1-5]$/.test(key);
const zoneOrDefaultKey = (key) => key === "default" || zoneKey(key);
const levelKey = (key) => LEVELS.has(key);
const scheduleKey = (key) => SCHEDULES.has(key);
const monthKey = (key) => MONTHS.has(key);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeRateVersions(value, issues) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 60) { issues.push('Дозволено до 60 версій правил.'); return []; }
  return value.map(entry => {
    assertPlainObject(entry, 'rateVersions', issues);
    rejectUnknownKeys(entry,new Set(['version','overrides','templates']),'rateVersions',issues);
    return {version:normalizeVersion(entry?.version,issues),overrides:normalizeOverrides(entry?.overrides,issues),templates:normalizeTemplates(entry?.templates,issues)};
  });
}
