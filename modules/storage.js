const STORAGE_KEY_PREFIX = "zp-2-2-calculator-inputs";
const THEME_STORAGE_KEY = "zp-theme";

export const MAX_SCENARIOS = 6;
export const MAX_HISTORY_ITEMS = 8;

export function loadCalculatorInputs(type, defaults, clampZone) {
  try {
    const saved = JSON.parse(localStorage.getItem(inputStorageKey(type))) ?? {};
    migrateSavedInputs(type, saved, defaults);
    const inputs = {
      ...defaults,
      ...saved,
      salary: defaults.salary,
      ratingFirstPart: defaults.ratingFirstPart
    };
    inputs.ratingZone = clampZone(inputs.ratingZone, type);
    return inputs;
  } catch {
    return { ...defaults, ratingZone: clampZone(defaults.ratingZone, type) };
  }
}

export function saveCalculatorInputs(type, inputs) {
  localStorage.setItem(inputStorageKey(type), JSON.stringify(inputs));
}

export function loadScenarios(type) {
  try {
    const scenarios = JSON.parse(localStorage.getItem(scenarioStorageKey(type))) ?? [];
    return Array.isArray(scenarios) ? scenarios.slice(-MAX_SCENARIOS) : [];
  } catch {
    return [];
  }
}

export function saveScenarios(type, scenarios) {
  localStorage.setItem(scenarioStorageKey(type), JSON.stringify(scenarios.slice(-MAX_SCENARIOS)));
}

export function loadCalculationHistory(type) {
  try {
    const history = JSON.parse(localStorage.getItem(historyStorageKey(type))) ?? [];
    return Array.isArray(history) ? history.slice(-MAX_HISTORY_ITEMS) : [];
  } catch {
    return [];
  }
}

export function saveCalculationHistory(type, history) {
  localStorage.setItem(historyStorageKey(type), JSON.stringify(history.slice(-MAX_HISTORY_ITEMS)));
}

export function loadPreferredRole() {
  return localStorage.getItem("zp-preferred-role") || "";
}

export function savePreferredRole(role) {
  if (role) localStorage.setItem("zp-preferred-role", role);
  else localStorage.removeItem("zp-preferred-role");
}

export function loadSavedTheme() {
  const theme = localStorage.getItem(THEME_STORAGE_KEY);
  return theme === "dark" || theme === "light" ? theme : null;
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function inputStorageKey(type) {
  return `${STORAGE_KEY_PREFIX}-${type}`;
}

function scenarioStorageKey(type) {
  return `${STORAGE_KEY_PREFIX}-scenarios-${type}`;
}

function historyStorageKey(type) {
  return `${STORAGE_KEY_PREFIX}-history-${type}`;
}

function migrateSavedInputs(type, saved, defaults) {
  if (type === "supervisor" && Number(saved.firstHalfHours) === 82.5) {
    saved.firstHalfHours = defaults.firstHalfHours;
  }
  if (type === "video") {
    saved.testsHigh = false;
    if (Number(saved.ratingZone) === 5 && saved.level === "level3") {
      saved.ratingZone = defaults.ratingZone;
      saved.level = defaults.level;
    }
  }
  if (type === "iron") {
    saved.testsHigh = false;
    if (Number(saved.firstHalfHours) === 82.5) saved.firstHalfHours = defaults.firstHalfHours;
    if (Number(saved.secondHalfHours) === 82.5) saved.secondHalfHours = defaults.secondHalfHours;
  }
  if (saved.secondHalfHours === undefined) saved.secondHalfHours = defaults.secondHalfHours;
}
