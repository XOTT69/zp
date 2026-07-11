import { defaultSettings, getAdminSettings, getSettingsHistory, rollbackAdminSettings, saveAdminSettings } from "../api/_settings-store.js";
import { SettingsValidationError, validateAdminSettings } from "../api/_settings-validation.js";
import { ratingButtonsHtml } from "../modules/calculator-ui.js";
import { escapeHtml } from "../modules/safe-html.js";
import loginHandler from "../api/login.js";

const failures = [];

check("safe HTML", escapeHtml(`<img src=x onerror='x'>`), "&lt;img src=x onerror=&#039;x&#039;&gt;");

const calculators = {
  service: { ratingZones: [1, 2, 3, 4, 5] },
  level4: { ratingZones: [1, 2, 3] }
};
const serviceZones = ratingButtonsHtml(calculators, "service", 2);
const level4Zones = ratingButtonsHtml(calculators, "level4", 2);
check("service zone 2 lime", serviceZones.includes("rating-zone--lime"), true);
check("service zone 5 red", serviceZones.includes("rating-zone--red"), true);
check("level4 zone 2 yellow", level4Zones.includes("rating-zone--yellow"), true);
check("level4 has no zone 4", level4Zones.includes('data-zone="4"'), false);

const validSettings = validateAdminSettings({
  ...defaultSettings(),
  overrides: {
    service: {
      salary: 13000,
      taxRate: 0.23,
      ratingBonusByZone: { 1: 23062 },
      scheduleMonthHours: { "5/2": { Липень: 184 } }
    }
  },
  templates: {
    service: {
      Липень: { workSchedule: "5/2", actualHours: 184, ratingZone: 1, level: "level3" }
    }
  }
});
check("valid settings salary", validSettings.overrides.service.salary, 13000);
expectValidationError("unknown calculator", { ...defaultSettings(), overrides: { unknown: { salary: 1 } } });
expectValidationError("unsafe tax rate", { ...defaultSettings(), overrides: { service: { taxRate: 2 } } });
expectValidationError("unknown override field", { ...defaultSettings(), overrides: { service: { surprise: 1 } } });
expectValidationError("invalid template month", { ...defaultSettings(), templates: { service: { Never: { actualHours: 10 } } } });

process.env.AUTH_SECRET = "verification-secret-that-is-long-enough";
process.env.OPERATOR_ACCESS_CODE = "verification-code";
const failedLoginResponse = await callLogin({ role: "operator", code: "wrong-code" }, "203.0.113.78");
check("login API invalid code", failedLoginResponse.statusCode, 401);
const loginResponse = await callLogin({ role: "operator", code: "verification-code" }, "203.0.113.78");
check("login API success", loginResponse.statusCode, 200);
check("login API sets cookie", Boolean(loginResponse.headers["Set-Cookie"]), true);

const original = await getAdminSettings();
await saveAdminSettings({
  ...original,
  version: { ...original.version, note: "security verification" }
}, { summary: "Automated verification" });
const history = await getSettingsHistory();
check("settings history created", history.length > 0, true);
await rollbackAdminSettings(history[0].id);
check("settings rollback", (await getAdminSettings()).version.note, original.version.note);

if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}

console.log("Security and architecture verification passed.");

function check(name, actual, expected) {
  if (actual !== expected) failures.push(`${name}: expected ${expected}, got ${actual}`);
}

function expectValidationError(name, settings) {
  try {
    validateAdminSettings(settings);
    failures.push(`${name}: expected validation error`);
  } catch (error) {
    if (!(error instanceof SettingsValidationError)) failures.push(`${name}: unexpected ${error?.name || error}`);
  }
}

async function callLogin(body, ip) {
  const req = {
    method: "POST",
    body,
    headers: { "x-forwarded-for": ip },
    socket: { remoteAddress: ip }
  };
  const result = { statusCode: 0, headers: {}, body: "" };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    end(value = "") { result.body = value; },
    get statusCode() { return result.statusCode; },
    set statusCode(value) { result.statusCode = value; }
  };
  await loginHandler(req, res);
  return result;
}
