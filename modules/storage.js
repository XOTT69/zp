const STORAGE_KEY_PREFIX = "zp-2-2-calculator-inputs";
const THEME_STORAGE_KEY = "zp-theme";
let storageIdentity = '';
export function setStorageIdentity(subject) { storageIdentity = subject && !subject.startsWith('role:') ? subject : ''; }
function storagePrefix() { return storageIdentity ? `${STORAGE_KEY_PREFIX}-user-${encodeURIComponent(storageIdentity)}` : STORAGE_KEY_PREFIX; }

export const MAX_SCENARIOS = 6;
export const MAX_HISTORY_ITEMS = 30;

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
  safeSet(inputStorageKey(type), JSON.stringify(inputs));
}

export function loadScenarios(type) {
  try {
    let raw = localStorage.getItem(scenarioStorageKey(type));
    if (raw === null) {
      const legacy = (storageIdentity ? [] : ['service','supervisor','level4','xd','video','iron']).flatMap(key=>{
        try { const items=JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}-scenarios-${key}`)) || [];
          return Array.isArray(items)?items.map(item=>({...item,type:key,id:`legacy:${key}:${item.id}`})):[];
        } catch { return []; }
      });
      raw=JSON.stringify(legacy.slice(-MAX_SCENARIOS));
      safeSet(scenarioStorageKey(type),raw);
    }
    const scenarios = JSON.parse(raw) ?? [];
    return Array.isArray(scenarios) ? scenarios.slice(-MAX_SCENARIOS) : [];
  } catch {
    return [];
  }
}

export function saveScenarios(type, scenarios) {
  safeSet(scenarioStorageKey(type), JSON.stringify(scenarios.slice(-MAX_SCENARIOS)));
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
  safeSet(historyStorageKey(type), JSON.stringify(history.slice(-MAX_HISTORY_ITEMS)));
}

export function loadPreferredRole() {
  try { return localStorage.getItem("zp-preferred-role") || ""; } catch { return ""; }
}

export function savePreferredRole(role) {
  safeSet("zp-preferred-role",role || "");
}

export function loadSavedTheme() {
  let theme;
  try { theme = localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; }
  return theme === "dark" || theme === "light" ? theme : null;
}

export function saveTheme(theme) {
  safeSet(THEME_STORAGE_KEY, theme);
}

function inputStorageKey(type) {
  return `${storagePrefix()}-${type}`;
}

function scenarioStorageKey(type) {
  return `${storagePrefix()}-scenarios-all`;
}

function historyStorageKey(type) {
  return `${storagePrefix()}-history-${type}`;
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

function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { window.dispatchEvent(new CustomEvent("storage-failed")); }
}
