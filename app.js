import { defaultRulesSource, withColleagueRules } from './modules/rule-sources.js?v=67';
import { mountRateEditor } from './modules/admin-rate-editor.js?v=67';
import { parseHours, validatePayrollInputs } from "./modules/input-validation.js?v=67";
import { createCalculationRecord, resolveRateVersion } from "./modules/calculation-records.js?v=67";
import {
  CALCULATORS,
  LEVELS,
  MONTHS,
  calculatePayroll,
  configurePayrollData,
  formatCurrency,
  getDefaultInputs,
  roundMoney
} from "./calculator.js?v=67";
import { endSession, fetchSession, loginWithCode } from "./modules/auth-client.js?v=67";
import {
  adminPaymentRulesHtml,
  adminRecentHtml,
  adminRolesHtml,
  adminStatsHtml,
  settingsHistoryHtml
} from "./modules/admin-ui.js?v=67";
import { clampRatingZone as clampZone, ratingButtonsHtml } from "./modules/calculator-ui.js?v=67";
import { buildTextReport as createTextReport, reportHtml } from "./modules/reports.js?v=67";
import { escapeHtml } from "./modules/safe-html.js?v=67";
import {
  MAX_SCENARIOS,
  setStorageIdentity,
  loadCalculationHistory,
  loadCalculatorInputs,
  loadPreferredRole,
  loadSavedTheme,
  loadScenarios,
  saveCalculationHistory,
  saveCalculatorInputs,
  savePreferredRole,
  saveScenarios,
  saveTheme
} from "./modules/storage.js?v=67";

const form = document.querySelector("#calculatorForm");
const accessView = document.querySelector("#accessView");
const accessForm = document.querySelector("#accessForm");
const accessRole = document.querySelector("#accessRole");
const accessUsername = document.querySelector("#accessUsername");
const rememberRole = document.querySelector("#rememberRole");
const accessError = document.querySelector("#accessError");
const adminView = document.querySelector("#adminView");
const adminButton = document.querySelector("#adminButton");
const adminRefreshButton = document.querySelector("#adminRefreshButton");
const adminResetStatsButton = document.querySelector("#adminResetStatsButton");
const adminRuleForm = document.querySelector("#adminRuleForm");
const adminRuleMonth = document.querySelector("#adminRuleMonth");
const adminPaymentRules = document.querySelector("#adminPaymentRules");
const adminVersionForm = document.querySelector("#adminVersionForm");
const adminRatesForm = document.querySelector("#adminRatesForm");
const previewRatesButton = document.querySelector("#previewRatesButton");
const adminRatePreview = document.querySelector("#adminRatePreview");
const adminTemplatesForm = document.querySelector("#adminTemplatesForm");
const adminPayslipForm = document.querySelector("#adminPayslipForm");
const adminPayslipMonth = document.querySelector("#adminPayslipMonth");
const adminPayslipResult = document.querySelector("#adminPayslipResult");
const adminStorageNotice = document.querySelector("#adminStorageNotice");
const adminStats = document.querySelector("#adminStats");
const adminRoles = document.querySelector("#adminRoles");
const adminRecent = document.querySelector("#adminRecent");
const adminSettingsHistory = document.querySelector("#adminSettingsHistory");
const monthSelect = document.querySelector("#month");
const levelSelect = document.querySelector("#level");
const ratingZoneGroup = document.querySelector("#ratingZoneGroup");
const statusMessage = document.querySelector("#statusMessage");
const homeView = document.querySelector("#homeView");
const calculatorView = document.querySelector("#calculatorView");
const summaryStrip = document.querySelector("#summaryStrip");
const modeSwitcher = document.querySelector("#modeSwitcher");
const homeButton = document.querySelector("#homeButton");
const resetButton = document.querySelector("#resetButton");
const copyButton = document.querySelector("#copyButton");
const printButton = document.querySelector("#printButton");
const logoutButton = document.querySelector("#logoutButton");
const themeToggle = document.querySelector("#themeToggle");
const roleBadge = document.querySelector("#roleBadge");
const addScenarioButton = document.querySelector("#addScenarioButton");
const clearScenariosButton = document.querySelector("#clearScenariosButton");
const scenarioList = document.querySelector("#scenarioList");
const saveHistoryButton = document.querySelector("#saveHistoryButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const historyList = document.querySelector("#historyList");
const validationMessages = document.querySelector("#validationMessages");
const formulaList = document.querySelector("#formulaList");
const reportPanel = document.querySelector("#reportPanel");
const paymentGrid = document.querySelector("#paymentGrid");
const absenceGrid = document.querySelector("#absenceGrid");
const effectiveHourlyResult = document.querySelector("#effectiveHourlyResult");
const effectiveHourlyResultValue = document.querySelector("#effectiveHourlyResultValue");
const rulesVersion = document.querySelector("#rulesVersion");
const tenureResultCard = document.querySelector("#tenureResultCard");
const ratingResultCard = document.querySelector("#ratingResultCard");
const levelResultCard = document.querySelector("#levelResultCard");
const toast = document.querySelector("#toast");
const APP_EYEBROW = "Розрахунок і порівняння зарплат";
const ACTIVE_ACCESS_ROLES = new Set(["admin", "operator", "supervisor", "level4", "xd", "video", "iron", "sz", "psz", "msb", "meo", "fm", "concierge", "soft"]);
const ACTIVE_CALCULATOR_KEYS = new Set(["service", "supervisor", "level4", "xd", "video", "iron", "sz", "psz", "msb", "meo", "fm", "concierge", "soft"]);

let calculatorType = null;
let selectedRatingZone = 1;
let currentResult = null;
let accessSession = null;
let lastTrackedView = "";
let basePayrollPayload = null;
let lastPayrollPayload = null;
let activeSettings = {};
let adminSettingsState = {};
let activeCalculationPayload = null;
let selectedVersion = null;
let savedRecord = null;
let configUnavailable = false;

init();

async function init() {
  applySavedTheme();
  removeStaleStaticOptions();
  restorePreferredRole();
  syncPasswordManagerUsername();
  accessForm.addEventListener("submit", handleAccessSubmit);
  accessRole.addEventListener("change", syncPasswordManagerUsername);
  form.addEventListener("input", update);
  window.addEventListener("storage-failed", () => showStatus("Браузер не зміг зберегти дані. Звільніть місце або скопіюйте звіт."));
  document.querySelector("#recalculateRecord").addEventListener("click", () => {
    savedRecord = null;
    form.inert = false;
    form.elements.rulesSource.value = defaultRulesSource(calculatorType);
    document.querySelector("#savedRecordNotice").hidden = true;
    update();
  });
  initCorporateLogin();
  form.addEventListener("change", handleFormChange);
  ratingZoneGroup.addEventListener("click", handleRatingClick);
  resetButton.addEventListener("click", reset);
  copyButton.addEventListener("click", copySummary);
  printButton.addEventListener("click", printReport);
  logoutButton.addEventListener("click", logout);
  themeToggle.addEventListener("click", toggleTheme);
  adminButton.addEventListener("click", () => navigateTo("/admin"));
  adminRefreshButton.addEventListener("click", renderAdminPanel);
  adminResetStatsButton.addEventListener("click", resetAdminStats);
  adminRuleForm.addEventListener("submit", saveAdminPaymentRule);
  adminPaymentRules.addEventListener("click", deleteAdminPaymentRule);
  adminVersionForm.addEventListener("submit", saveAdminVersion);
  adminRatesForm.addEventListener("submit", saveAdminRates);
  previewRatesButton.addEventListener("click", previewAdminRates);
  adminTemplatesForm.addEventListener("submit", saveAdminTemplates);
  adminSettingsHistory.addEventListener("click", rollbackAdminSettings);
  adminPayslipForm.addEventListener("submit", compareAdminPayslip);
  addScenarioButton.addEventListener("click", addScenario);
  clearScenariosButton.addEventListener("click", clearScenarios);
  scenarioList.addEventListener("click", handleScenarioClick);
  saveHistoryButton.addEventListener("click", saveCurrentCalculationToHistory);
  clearHistoryButton.addEventListener("click", clearCalculationHistory);
  historyList.addEventListener("click", handleHistoryClick);
  homeButton.addEventListener("click", () => {
    navigateTo("/");
  });
  document.addEventListener("click", handleAppLinkClick);
  window.addEventListener("popstate", renderRoute);

  await hydrateSession();
  renderRoute();
}

async function hydrateSession() {
  try {
    const { data } = await fetchSession();
    if (!data.authenticated) return;
    accessSession = data.session;
    setStorageIdentity(accessSession.subject);
    basePayrollPayload = data.payroll;
    lastPayrollPayload = await applyRemoteConfig(basePayrollPayload);
    configurePayrollData(lastPayrollPayload);
    renderSelects();
  } catch {
    accessError.textContent = "Сервер авторизації недоступний. Запустіть сайт через Vercel.";
  }
}

function renderRoute() {
  savedRecord = null; form.inert = false; document.querySelector("#savedRecordNotice").hidden = true;
  if (lastPayrollPayload) configurePayrollData(lastPayrollPayload);
  if (!accessSession) {
    if (window.location.pathname !== "/login") {
      history.replaceState({}, "", "/login");
    }
    renderAccessGate();
    return;
  }

  const isAdminRoute = window.location.pathname === "/admin";
  if (!isAdminRoute && lastPayrollPayload) configurePayrollData(withColleagueRules(lastPayrollPayload));
  if (isAdminRoute && !accessSession.isAdmin) {
    navigateTo(`/${firstAllowedCalculator()}`);
    return;
  }

  calculatorType = isAdminRoute ? null : getRouteType();
  if (calculatorType && !canAccessCalculator(calculatorType)) {
    navigateTo(`/${firstAllowedCalculator()}`);
    return;
  }

  const isHome = calculatorType === null && !isAdminRoute;

  accessView.hidden = true;
  adminView.hidden = !isAdminRoute;
  homeView.hidden = !isHome;
  calculatorView.hidden = isHome || isAdminRoute;
  summaryStrip.hidden = isHome || isAdminRoute;
  modeSwitcher.hidden = isHome || isAdminRoute;
  resetButton.hidden = isHome || isAdminRoute;
  copyButton.hidden = isHome || isAdminRoute;
  printButton.hidden = isHome || isAdminRoute;
  homeButton.hidden = isHome;
  adminButton.hidden = !accessSession.isAdmin || isAdminRoute;
  logoutButton.hidden = false;
  roleBadge.hidden = false;
  roleBadge.textContent = accessSession.label;
  renderAllowedChoices();
  renderModeSwitcher();

  if (isAdminRoute) {
    document.querySelector("#appTitle").textContent = "Адмін панель";
    document.querySelector("#appEyebrow").textContent = APP_EYEBROW;
    renderAdminPanel();
    trackView("admin");
    return;
  }

  if (isHome) {
    document.querySelector("#appTitle").textContent = "Калькулятор ЗП";
    document.querySelector("#appEyebrow").textContent = APP_EYEBROW;
    trackView("home");
    return;
  }

  const config = CALCULATORS[calculatorType];
  const inputs = loadInputs(calculatorType);
  selectedRatingZone = inputs.ratingZone;

  document.querySelector("#appTitle").textContent = config.title;
  document.querySelector("#appEyebrow").textContent = APP_EYEBROW;
  document.querySelector(".visual-panel h2").textContent = config.shortTitle;
  document.querySelector(".visual-panel .eyebrow").textContent = inputs.workSchedule ?? "2/2";

  fillForm(inputs);
  renderRatingButtons(selectedRatingZone);
  renderModeFields();
  renderModeLabels();
  update();
  renderScenarios();
  trackView(calculatorType);
}

function renderAccessGate() {
  removeStaleStaticOptions();
  accessView.hidden = false;
  adminView.hidden = true;
  homeView.hidden = true;
  calculatorView.hidden = true;
  summaryStrip.hidden = true;
  modeSwitcher.hidden = true;
  resetButton.hidden = true;
  copyButton.hidden = true;
  printButton.hidden = true;
  homeButton.hidden = true;
  adminButton.hidden = true;
  logoutButton.hidden = true;
  roleBadge.hidden = true;
  document.querySelector("#appTitle").textContent = "Калькулятор ЗП";
  document.querySelector("#appEyebrow").textContent = APP_EYEBROW;
}

function removeStaleStaticOptions() {
  accessForm.querySelectorAll("option").forEach((option) => {
    if (!ACTIVE_ACCESS_ROLES.has(option.value)) {
      option.remove();
    }
  });

  document.querySelectorAll("[data-calculator-choice], [data-mode-link]").forEach((element) => {
    const type = element.dataset.calculatorChoice || element.dataset.modeLink;
    if (type && !ACTIVE_CALCULATOR_KEYS.has(type)) {
      element.remove();
    }
  });
}

function syncPasswordManagerUsername() {
  if (!accessRole || !accessUsername) return;
  const selectedRole = accessRole.selectedOptions[0];
  accessUsername.value = selectedRole?.textContent?.trim() ?? "";
}

function restorePreferredRole() {
  const savedRole = loadPreferredRole();
  if (!savedRole || !ACTIVE_ACCESS_ROLES.has(savedRole)) return;
  accessRole.value = savedRole;
}

async function handleAccessSubmit(event) {
  event.preventDefault();
  const formData = new FormData(accessForm);
  const role = formData.get("role");
  const code = formData.get("password");
  const submitButton = accessForm.querySelector("button[type='submit']");
  const submitLabel = submitButton.textContent;

  submitButton.disabled = true;
  submitButton.textContent = "Перевіряю…";
  accessForm.setAttribute("aria-busy", "true");
  accessError.textContent = "";

  try {
    const { response, data } = await loginWithCode(role, code);

    if (!response.ok || !data.authenticated) {
      accessError.textContent = data.error || "Невірний код доступу.";
      return;
    }

    accessSession = data.session;
    setStorageIdentity(accessSession.subject);
    basePayrollPayload = data.payroll;
    lastPayrollPayload = await applyRemoteConfig(basePayrollPayload);
    configurePayrollData(lastPayrollPayload);
    renderSelects();
    savePreferredRole(rememberRole?.checked ? role : "");
    accessForm.reset();
    syncPasswordManagerUsername();
    navigateTo(accessSession.isAdmin ? "/admin" : `/${firstAllowedCalculator()}`);
  } catch {
    accessError.textContent = "Не вдалося увійти. Перевірте Vercel API або інтернет.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = submitLabel;
    accessForm.removeAttribute("aria-busy");
  }
}

async function logout() {
  try { await endSession(); } catch { showStatus("Не вдалося вийти: перевірте інтернет і повторіть. Сесія ще активна."); return; }
  accessSession = null;
  setStorageIdentity(null);
  lastTrackedView = "";
  navigateTo("/login");
  renderRoute();
}

function canAccessCalculator(type) {
  return accessSession?.allowedCalculators.includes(type);
}

function firstAllowedCalculator() {
  return accessSession?.allowedCalculators[0] ?? "service";
}

function renderAllowedChoices() {
  homeView.querySelector('.choice-grid').innerHTML=Object.entries(CALCULATORS).filter(([type])=>canAccessCalculator(type)).map(([type,cfg])=>`<a class="choice-card" href="/${escapeHtml(type)}" data-calculator-choice="${escapeHtml(type)}"><span>${escapeHtml(cfg.shortTitle)}</span><strong>${escapeHtml(cfg.title)}</strong><small>${escapeHtml((cfg.scheduleOptions || [{label:'2/2'}]).map(s=>s.label).join(' та '))} · ${cfg.stages?'до / від 3 місяців · ':''}${cfg.reference?'ставки колеги':'правила проєкту'}</small></a>`).join('');
  document.querySelectorAll("[data-calculator-choice]").forEach((choice) => {
    const type = choice.dataset.calculatorChoice;
    choice.hidden = !canAccessCalculator(type);
  });
}

function renderModeSwitcher() {
  document.querySelectorAll("[data-mode-link]").forEach((link) => {
    const type = link.dataset.modeLink;
    link.hidden = !canAccessCalculator(type);
    link.classList.toggle("is-active", type === calculatorType);
  });
}

function getRouteType() {
  const pathRoute = window.location.pathname.replace("/", "");
  if (CALCULATORS[pathRoute]) return pathRoute;
  const route = window.location.hash.replace("#", "");
  return CALCULATORS[route] ? route : null;
}

function renderSelects() {
  if (!MONTHS.length || !LEVELS.length) return;
  monthSelect.innerHTML = MONTHS.map(
    (month) => `<option value="${month.name}">${month.name}</option>`
  ).join("");
  if (adminRuleMonth) {
    adminRuleMonth.innerHTML = MONTHS.map(
      (month) => `<option value="${month.name}">${month.name}</option>`
    ).join("");
  }
  if (adminPayslipMonth) {
    adminPayslipMonth.innerHTML = MONTHS.map(
      (month) => `<option value="${month.name}">${month.name}</option>`
    ).join("");
  }

  levelSelect.innerHTML = LEVELS.map(
    (level) => `<option value="${level.value}">${level.label}</option>`
  ).join("");
}

function renderModeFields() {
  document.querySelectorAll("[data-mode]").forEach((field) => {
    field.hidden = field.dataset.mode !== calculatorType;
  });
  document.querySelectorAll("[data-feature='bonus']").forEach((field) => {
    field.hidden = !hasBonusInput();
  });
  document.querySelectorAll("[data-feature='tests']").forEach((field) => {
    field.hidden = !hasTestsInput();
  });
  document.querySelectorAll("[data-feature='workSchedule']").forEach((field) => {
    field.hidden = !hasWorkScheduleInput();
  });
  document.querySelectorAll("[data-feature='tenureHours']").forEach((field) => {
    field.hidden = !hasTenureHoursInput();
  });
  const cfg = CALCULATORS[calculatorType];
  const stage = cfg.stages?.[form.elements.stage.value] || {};
  for (const [name,hidden] of [['nightHours',cfg.hasNight===false],['doubleHours',cfg.hasDouble===false],['holidayHours',cfg.reference],['tenureYears',stage.noTenure]]) form.elements[name].closest('label').hidden=Boolean(hidden);
  form.elements.level.disabled=Boolean(stage.noQualification);
  renderScheduleOptions();
  renderBonusInput();
  renderDeductionInput();
}

function renderModeLabels() {
  const taxLabel = `Податок ${formatPercent(CALCULATORS[calculatorType].taxRate)}`;
  setText("#totalMainLabel", "На руки");
  setText("#totalGrossLabel", isGrossCalculator() ? "Разом з податком" : "Орієнтовно з податком");
  setText("#totalTaxLabel", taxLabel);
  setText("#baseResultLabel", isGrossCalculator() ? "ЗП чистими" : "До виплати ЗП");
  setText("#tenureResultLabel", isGrossCalculator() ? "Стаж чистими" : "Премія стаж");
  setText("#levelBonusLabel", calculatorType === "video" ? "Доплата рівня за години" : "Доплата рівня");
}

function renderRatingButtons(activeZone) {
  ratingZoneGroup.innerHTML = ratingButtonsHtml(CALCULATORS, calculatorType, activeZone);
}

function handleRatingClick(event) {
  const button = event.target.closest("[data-zone]");
  if (!button) return;
  selectedRatingZone = clampRatingZone(Number(button.dataset.zone));
  renderRatingButtons(selectedRatingZone);
  update();
}

function fillForm(inputs) {
  Object.entries(inputs).forEach(([key, value]) => {
    if (key === "ratingZone") return;
    const field = form.elements[key];
    if (!field) return;

    if (field.type === "checkbox") {
      field.checked = Boolean(value);
    } else {
      field.value = value;
    }
  });
}

function update() {
  if (!calculatorType) return;
  if (savedRecord) return;
  const year = Number(form.elements.year.value);
  const month = form.elements.month.value;
  const source = form.elements.rulesSource.value;
  const period = `${year}-${String(MONTHS.findIndex(m=>m.name===month)+1).padStart(2,'0')}`;
  selectedVersion = resolveRateVersion(activeSettings, period);
  if (year !== 2026 || (!selectedVersion && source === 'our') || configUnavailable) {
    invalidateResult(configUnavailable ? 'Не вдалося завантажити актуальні правила. Оновіть сторінку.' : 'Для цього періоду немає підтверджених правил і норм годин.'); return;
  }
  if (source === 'colleague') selectedVersion = {version:{label:'Основні ставки колеги · звірка 05.09.2026',updatedAt:'2026-09-05',source:'colleague'}};
  let payload = source === 'colleague'
    ? withColleagueRules(lastPayrollPayload)
    : applyAdminSettings(basePayrollPayload,selectedVersion);
  // Video keeps its own period rules while comparisons use the primary rates.
  if (calculatorType === 'video') payload = withColleagueRules(payload);
  // Payment calibrations are a separate, year-specific dataset.
  if (source === 'our') for (const [key,cfg] of Object.entries(payload.config.calculators)) {
    cfg.paymentMonthlyRules = lastPayrollPayload.config.calculators[key]?.paymentMonthlyRules;
  }
  activeCalculationPayload = payload;
  configurePayrollData(payload);
  form.elements.rulesSource.closest('label').hidden = calculatorType === 'video';
  renderModeLabels();
  renderModeFields();
  selectedRatingZone = clampRatingZone(selectedRatingZone);
  renderRatingButtons(selectedRatingZone);
  document.querySelector('#stageField').hidden = !CALCULATORS[calculatorType].stages;
  form.elements.salary.value = getDefaultInputs(calculatorType).salary;
  const inputs = readInputs();
  const errors = validatePayrollInputs(inputs);
  form.querySelectorAll('.field-error,.hour-hint').forEach(el=>el.remove());
  for (const field of form.querySelectorAll('input')) {
    field.removeAttribute('aria-invalid');
    if (errors[field.name]) {
      field.setAttribute('aria-invalid','true');
      const message=document.createElement('small'); message.className='field-error'; message.textContent=errors[field.name]; field.after(message);
    } else if (/Hours$/.test(field.name)) {
      const hint=parseHours(field.value).hint;
      if(hint) { const message=document.createElement('small');message.className='hour-hint';message.textContent=hint;field.after(message); }
    }
  }
  if (Object.keys(errors).length) { invalidateResult('Виправте виділені поля — результат не розраховано.'); return; }
  const result = calculatePayroll(inputs, calculatorType);
  currentResult = result;
  for(const button of [copyButton,printButton,addScenarioButton,saveHistoryButton]) button.disabled=false;
  saveInputs(calculatorType, inputs);
  renderResult(result);
  renderValidation(result);
  renderFormulaList(result);
  renderPaymentSchedule(result);
  renderReport(result);
  renderScenarios();
  renderCalculationHistory();
  renderDirectionComparison(inputs);
}

function handleFormChange(event) {
  if (event.target?.name === "rulesSource") { update(); renderRatingButtons(clampRatingZone(selectedRatingZone)); renderModeFields(); }
  if (event.target?.name === "month") {
    applyMonthTemplate(calculatorType, event.target.value);
  }
  update();
}

function applyMonthTemplate(type, month) {
  if (form.elements.rulesSource.value === 'colleague') return;
  const template = activeSettings.templates?.[type]?.[month];
  if (!template) return;
  const merged = {
    ...readInputs(),
    ...template,
    month
  };
  selectedRatingZone = clampRatingZone(merged.ratingZone ?? selectedRatingZone, type);
  fillForm(merged);
  renderRatingButtons(selectedRatingZone);
  showStatus("Шаблон місяця застосовано");
}

function readInputs() {
  const data = new FormData(form);
  const defaults = getDefaultInputs(calculatorType);
  return {
    year: Number(data.get("year")),
    stage: data.get("stage"),
    rulesSource: data.get("rulesSource"),
    month: data.get("month"),
    workSchedule: hasWorkScheduleInput() ? data.get("workSchedule") : defaults.workSchedule,
    actualHours: data.get("actualHours"),
    testsHigh: hasTestsInput() && form.elements.testsHigh.checked,
    ratingZone: clampRatingZone(selectedRatingZone),
    level: form.elements.level.value,
    salary: defaults.salary,
    nightHours: CALCULATORS[calculatorType]?.hasNight === false ? 0 : data.get("nightHours"),
    holidayHours: CALCULATORS[calculatorType]?.reference ? 0 : data.get("holidayHours"),
    doubleHours: CALCULATORS[calculatorType]?.hasDouble === false ? 0 : data.get("doubleHours"),
    wowCases: hasBonusInput() ? data.get("wowCases") : 0,
    fines: data.get("fines"),
    taxiAmount: data.get("taxiAmount"),
    tenureYears: data.get("tenureYears"),
    tenureHours: hasTenureHoursInput() ? data.get("tenureHours") : data.get("actualHours"),
    firstHalfHours: data.get("firstHalfHours"),
    secondHalfHours: data.get("secondHalfHours"),
    ratingFirstPart: defaults.ratingFirstPart,
    annualIncome: data.get("annualIncome"),
    absenceCalendarDays: data.get("absenceCalendarDays"),
    vacationDays: data.get("vacationDays"),
    sickDays: data.get("sickDays"),
    sickInsuranceRate: data.get("sickInsuranceRate"),
    maternityDays: data.get("maternityDays")
  };
}

function renderResult(result) {
  setText("#totalNet", formatCurrency(result.totalPay));
  setText("#totalGross", formatCurrency(result.totalGross));
  setText("#totalTax", formatCurrency(result.tax));
  setText("#monthNorm", `${result.normHours} год`);
  setText("#effectiveHours", roundMoney(result.effectiveHours));
  document.querySelector(".visual-panel .eyebrow").textContent = result.input.workSchedule ?? "2/2";
  setText("#baseNet", formatCurrency(result.basePay));
  setText("#tenureNet", formatCurrency(result.tenurePay));
  setText("#ratingBonus", formatCurrency(result.ratingBonus));
  setText("#levelBonus", formatCurrency(getLevelBonusDisplayValue(result)));
  tenureResultCard.hidden = Math.abs(result.tenurePay) < 0.005;
  ratingResultCard.hidden = Math.abs(result.ratingBonus) < 0.005;
  levelResultCard.hidden = Math.abs(getLevelBonusDisplayValue(result)) < 0.005;
  renderEffectiveHourlyPay(result);
  renderRulesVersion();

  const rows = isGrossCalculator() ? grossRows(result) : serviceRows(result);

  document.querySelector("#breakdown").innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="breakdown-row">
          <span>${escapeHtml(label)}</span>
          <strong>${formatCurrency(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderEffectiveHourlyPay(result) {
  const showHourlyPay = isHourlyPayCalculator() && result.effectiveHourlyPay !== null;
  effectiveHourlyResult.hidden = !showHourlyPay;
  setText("#effectiveHourlyResultValue", showHourlyPay ? `${formatCurrency(result.effectiveHourlyPay)} / год` : "—");
}

function renderRulesVersion() {
  if (CALCULATORS[calculatorType]?.reference) { rulesVersion.textContent="Основні ставки: калькулятор колеги · звірено 05.09.2026."; return; }
  const version = savedRecord?.version || selectedVersion?.version || activeSettings.version;
  rulesVersion.textContent = version?.label
    ? `${version.label}${version.updatedAt ? ` · оновлено ${version.updatedAt}` : ""}`
    : "Базові правила калькулятора";
}

function renderValidation(result) {
  const messages = buildValidationMessages(result);
  validationMessages.innerHTML = messages
    .map((message) => `<div class="notice ${message.tone}">${escapeHtml(message.text)}</div>`)
    .join("");
}

function buildValidationMessages(result) {
  const messages = [];
  const input = result.input;
  const version = savedRecord?.version || selectedVersion?.version || activeSettings.version;

  if (CALCULATORS[calculatorType]?.reference) {
    messages.push({tone:'info',text:'Розрахунок за ставками калькулятора колеги, звіреними 05.09.2026.'});
  } else if (calculatorType !== 'video') {
    messages.push({tone:'warning',text:'Вибрано попередні правила проєкту. Для актуального розрахунку виберіть основні ставки колеги.'});
  } else if (version?.label) {
    const updated = version.updatedAt ? ` · оновлено ${version.updatedAt}` : "";
    messages.push({ tone: "success", text: `${version.label}${updated}` });
  }

  if (input.actualHours > 240) {
    messages.push({ tone: "warning", text: "Фактичні години виглядають дуже високими. Перевірте, чи це не помилка вводу." });
  }

  if (input.actualHours < 80) {
    messages.push({ tone: "info", text: "Годин мало для повного місяця. Якщо це неповний період, усе ок." });
  }

  if (input.tenureYears === 0) {
    messages.push({ tone: "info", text: "Премія за стаж не нараховується до 1 року." });
  }

  if (input.nightHours > input.actualHours) {
    messages.push({ tone: "warning", text: "Нічних годин більше, ніж фактичних. Варто перевірити значення." });
  }

  if (input.holidayHours > input.actualHours) {
    messages.push({ tone: "warning", text: "Святкових годин більше, ніж фактичних. Варто перевірити значення." });
  }

  if (hasWowBonus() && input.wowCases > 0) {
    messages.push({ tone: "success", text: `WOW-кейси додали ${formatCurrency(result.wowBonus)} до чистої ЗП.` });
  }

  if (result.ratingBonus === 0) {
    messages.push({ tone: "warning", text: "Для цієї зони рейтингова ставка у джерелі дорівнює 0. Перевірте, чи правильна зона." });
  }

  if (calculatorType === "video" && result.levelBonus === 0 && input.level !== "level1") {
    const hint = input.level === "level2"
      ? "2 рівень дає 3620 до податку тільки в зонах 1, 2, 3."
      : "3 рівень дає 7240 до податку в зонах 1, 2; 3506,49 до податку в зоні 3; у зонах 4-5 доплати немає.";
    messages.push({ tone: "info", text: `Доплата рівня зараз 0, бо зона ${input.ratingZone} не проходить під правило. ${hint}` });
  }

  return messages;
}

function renderFormulaList(result) {
  formulaList.innerHTML = formulaRows(result)
    .map(
      (row) => `
        <div class="formula-row">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(row.formula)}</span>
        </div>
      `
    )
    .join("");
}

function formulaRows(result) {
  const i = result.input;
  const doubleBaseFormula = CALCULATORS[calculatorType]?.doublePayMode === "baseHourly"
    ? formatCurrency(i.salary)
    : `(${formatCurrency(i.salary)} + ${formatCurrency(result.ratingBonus)})`;
  const levelBonusFormula = isGrossCalculator()
    ? `${formatCurrency(result.levelBonus)} до податку (${formatCurrency(result.levelBonus * (1 - CALCULATORS[calculatorType].taxRate))} чистими)`
    : formatCurrency(result.levelBonus);
  const rows = [
    {
      label: "Версія правил",
      formula: rulesVersion.textContent
    },
    {
      label: "Графік і норма",
      formula: `${i.workSchedule ?? "2/2"}, ${i.month}: ${result.normHours} год`
    },
    {
      label: "Податок",
      formula: isGrossCalculator() ? `${formatPercent(CALCULATORS[calculatorType].taxRate)} від нарахованої суми` : "Суми введені чистими, податок показано орієнтовно"
    },
    {
      label: "Години в розрахунку",
      formula: `${roundMoney(i.actualHours)} + ${result.testHours} = ${roundMoney(result.effectiveHours)}`
    },
    ...(isHourlyPayCalculator() && result.effectiveHourlyPay !== null
      ? [{
          label: "Ефективна годинна ЗП",
          formula: `${formatCurrency(result.totalPay)} / ${roundMoney(i.actualHours)} год = ${formatCurrency(result.effectiveHourlyPay)} / год`
        }]
      : []),
    {
      label: "Рейтинг",
      formula: `зона ${i.ratingZone} -> ${formatCurrency(result.ratingBonus)}`
    },
    {
      label: "Доплата рівня",
      formula: `${levelLabel(i.level)}, зона ${i.ratingZone} -> ${levelBonusFormula}`
    },
    {
      label: "Нічні",
      formula: `${formatCurrency(i.salary)} / ${result.normHours} * ${roundMoney(i.nightHours)} * 20% = ${formatCurrency(result.nightPay)}`
    },
    {
      label: "Оплата X2",
      formula: `${doubleBaseFormula} / ${result.normHours} * ${roundMoney(i.doubleHours)} = ${formatCurrency(result.doublePay)}`
    }
  ];

  if (isGrossCalculator()) {
    const grossNote = result.taxableBonus > 0 ? ` (включно з бонусами ${formatCurrency(result.taxableBonus)})` : "";
    const wowText = hasWowBonus() ? ` + WOW ${formatCurrency(result.wowBonus)}` : "";
    rows.push(
      {
        label: "ЗП чистими",
        formula: `${formatCurrency(result.baseGross)}${grossNote} - ${formatCurrency(result.baseTax)}${wowText} = ${formatCurrency(result.basePay)}`
      },
      {
      label: "Стаж чистими",
      formula: `${formatCurrency(result.tenureGross)} - ${formatCurrency(result.tenureTax)} = ${formatCurrency(result.tenurePay)}`
      }
    );
  } else {
    rows.push(
      {
        label: "До виплати ЗП",
        formula: `((оклад + рівень + рейтинг) / норма * години) + доплати - штрафи = ${formatCurrency(result.basePay)}`
      },
      {
        label: "Премія стаж",
        formula: `база стажу * ${Math.round(result.tenureRate * 100)}% / ${result.normHours} * ${roundMoney(result.tenureHours)} = ${formatCurrency(result.tenurePay)}`
      }
    );
  }

  if (result.bonusNet > 0) {
    rows.push({
      label: "Додаткові бонуси",
      formula: `${formatCurrency(result.bonusNet)} додано чистими до ЗП`
    });
  }

  if (result.functionalBonus) rows.push({label:"Функціональна надбавка",formula:`${formatCurrency(result.functionalBonus)} / ${result.normHours} × ${result.effectiveHours} год`});

  rows.push({
    label: "Підсумок",
    formula: `${formatCurrency(result.basePay)} + ${formatCurrency(result.tenurePay)} = ${formatCurrency(result.totalPay)}`
  });

  return rows;
}

function renderPaymentSchedule(result) {

  const schedule = result.paymentSchedule;
  const absence = result.absencePayments;
  if (form.elements.averageDailyPay) {
    form.elements.averageDailyPay.value = roundMoney(absence.averageDailyPay);
  }

  if (activeCalculationPayload?.config.calculators[calculatorType]?.paymentScheduleMode === "unverified") {
    paymentGrid.innerHTML = `<p class="empty-state">Дати й суми окремих виплат для цих правил ще не підтверджені.</p>`;
  } else if (!hasReliablePaymentSchedule()) {
    paymentGrid.innerHTML = `
      <article class="payment-card payment-card-muted">
        <span>У донавчанні</span>
        <strong>Прогноз виплат скоро буде</strong>
        <small>Формула ЗП рахується, а календар виплат тимчасово прихований до звірки з фактичними листками.</small>
      </article>
    `;
  } else {
    const rows = [
      {
        label: "15 число",
        value: schedule.midMonthPay,
        parts: [
          ["Оклад за години до 15-го", schedule.midMonthParts.base],
          ["1 частина рейтингу", schedule.midMonthParts.rating],
          ...(hasWowBonus() ? [["WOW-кейси", schedule.midMonthParts.wow]] : [])
        ]
      },
      {
        label: "31 число",
        value: schedule.monthEndPay,
        parts: [["Оклад за години 16-30/31", schedule.monthEndParts.base]]
      },
      {
        label: "07 число",
        value: schedule.nextMonthRatingPay,
        parts: [
          ["2 частина рейтингу", schedule.nextMonthParts.rating],
          ["Доплата рівня", schedule.nextMonthParts.level],
          ["Доплати / утримання", schedule.nextMonthParts.extras],
          ["Коригування годин", schedule.nextMonthParts.settlement]
        ]
      },
      {
        label: "9/10 число",
        value: schedule.tenurePay,
        parts: [["Надбавка за стаж", schedule.tenurePay]]
      }
    ];

    paymentGrid.innerHTML = rows
      .map(
        (row) => `
          <article class="payment-card">
            <span>${row.label}</span>
            <strong>${formatCurrency(row.value)}</strong>
            <div class="payment-parts">
              ${row.parts
                .filter(([, value]) => Math.abs(value) > 0.004)
                .map(
                  ([label, value]) => `
                    <div>
                      <small>${label}</small>
                      <b>${formatCurrency(value)}</b>
                    </div>
                  `
                )
                .join("")}
            </div>
          </article>
        `
      )
      .join("");
  }

  absenceGrid.innerHTML = [
    ["Середня за день", absence.averageDailyPay, "ЗП за 12 місяців / календарні дні"],
    ["Відпустка", absence.vacationPay, "середня за день * дні відпустки"],
    ["Лікарняні", absence.sickPay, "середня за день * % стажу * дні лікарняного"],
    ["Декретні", absence.maternityPay, "середня за день * календарні дні"],
    ["Разом", absence.total, "орієнтовна сума окремих виплат"]
  ]
    .map(
      ([label, value, hint]) => `
        <div class="absence-row">
          <span>${label}<small>${hint}</small></span>
          <strong>${formatCurrency(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderReport(result) {
  const config = CALCULATORS[calculatorType];
  const totalGrossLabel = isGrossCalculator() ? "Разом з податком (ЗП + стаж)" : "Орієнтовно з податком";
  const rows = [
    ["Тип", config.title],
    ["Місяць", result.input.month],
    ...(hasWorkScheduleInput() ? [["Графік", result.input.workSchedule]] : []),
    ["Фактичні години", roundMoney(result.input.actualHours)],
    ["Години в розрахунку", roundMoney(result.effectiveHours)],
    ...(isHourlyPayCalculator() && result.effectiveHourlyPay !== null
      ? [["Ефективна годинна ЗП", `${formatCurrency(result.effectiveHourlyPay)} / год`]]
      : []),
    ...(hasTenureHoursInput() ? [["Години для стажу", roundMoney(result.tenureHours)]] : []),
    ["Зона рейтингу", result.input.ratingZone],
    ["Кваліфікаційний рівень", levelLabel(result.input.level)],
    ["Оклад", formatCurrency(result.input.salary)],
    ["ЗП", formatCurrency(result.basePay)],
    ["Стаж", formatCurrency(result.tenurePay)],
    ["Податки", formatCurrency(result.tax)],
    [totalGrossLabel, formatCurrency(result.totalGross)],
    ["Загальна сума до виплати", formatCurrency(result.totalPay)],
    ...(hasReliablePaymentSchedule()
      ? [
          ["15 число", formatCurrency(result.paymentSchedule.midMonthPay)],
          ["31 число", formatCurrency(result.paymentSchedule.monthEndPay)],
          ["07 число", formatCurrency(result.paymentSchedule.nextMonthRatingPay)],
          ["9/10 число стаж", formatCurrency(result.paymentSchedule.tenurePay)]
        ]
      : [["Виплати по датах", "У донавчанні"]]),
    ["Середня ЗП за день", formatCurrency(result.absencePayments.averageDailyPay)],
    ["Відпустка/лікарняні/декретні", formatCurrency(result.absencePayments.total)]
  ];

  reportPanel.innerHTML = reportHtml(rows, config.title);
}

function hasReliablePaymentSchedule() {
  return calculatorType === "supervisor" && !CALCULATORS[calculatorType]?.reference;
}

function serviceRows(result) {
  return [
    ["ЗП чистими", result.basePay],
    ...optionalMoneyRows([
      ["Нічні", result.nightPay],
      ["Святкові", result.holidayPay],
      ["Оплата X2", result.doublePay],
      ["Монобрат / таксі", result.taxiCompensation],
      [CALCULATORS[calculatorType]?.deductionLabel ?? "Штрафи", -result.input.fines],
      [`Стаж чистими ${Math.round(result.tenureRate * 100)}%`, result.tenurePay]
    ]),
    ["Разом чистими (ЗП + стаж)", result.totalPay],
    [`Орієнтовний податок ${formatPercent(CALCULATORS[calculatorType].taxRate)}`, result.tax],
    ["Орієнтовно з податком", result.totalGross]
  ];
}

function grossRows(result) {
  const rows = [
    ["ЗП до податку", result.baseGross],
    [`Податок із ЗП ${formatPercent(CALCULATORS[calculatorType].taxRate)}`, result.baseTax],
    ["ЗП чистими", result.basePay],
    ...optionalMoneyRows([
      ["Нічні до податку", result.nightPay],
      ["Святкові до податку", result.holidayPay],
      ["Оплата X2 до податку", result.doublePay],
      ["Монобрат / таксі", result.taxiCompensation],
      ["WOW-кейси чистими", hasWowBonus() ? result.wowBonus : 0],
      ["Додаткові бонуси до податку", result.taxableBonus],
      [CALCULATORS[calculatorType]?.deductionLabel ?? "Штрафи", -result.input.fines],
      [`Стаж з податком ${Math.round(result.tenureRate * 100)}%`, result.tenureGross],
      [`Податок зі стажу ${formatPercent(CALCULATORS[calculatorType].taxRate)}`, result.tenureTax],
      ["Стаж чистими", result.tenurePay]
    ]),
    ["Разом чистими (ЗП + стаж)", result.totalPay],
    ["Разом з податком (ЗП + стаж)", result.totalGross]
  ];
  return rows;
}

function optionalMoneyRows(rows) {
  return rows.filter(([, value]) => Math.abs(Number(value) || 0) > 0.004);
}

async function copySummary() {
  if (!calculatorType) return;
  if (!currentResult) return;
  const result = currentResult;
  const config = CALCULATORS[calculatorType];
  const summary = createTextReport(result, config, {
    rulesLabel: rulesVersion.textContent,
    isGross: isGrossCalculator(),
    hasReliablePaymentSchedule: hasReliablePaymentSchedule(),
    showEffectiveHourlyPay: isHourlyPayCalculator(),
    formatCurrency,
    roundMoney,
    levelLabel
  });

  try {
    await navigator.clipboard.writeText(summary);
    trackEvent("copy");
    showStatus("Скопійовано в буфер обміну");
  } catch {
    showStatus("Не вдалося скопіювати");
  }
}

function printReport() {
  if (!calculatorType) return;
  trackEvent("pdf");
  window.print();
}

function addScenario() {
  if (!calculatorType || !currentResult) return;
  const scenarios = loadScenarios(calculatorType);
  if (scenarios.length >= MAX_SCENARIOS) {
    const shouldReplace = window.confirm(`Можна зберегти максимум ${MAX_SCENARIOS} сценаріїв. Видалити найстаріший і додати новий?`);
    if (!shouldReplace) return;
  }
  const next = recordCurrent(`${CALCULATORS[calculatorType].shortTitle} · ${scenarios.length+1}`);

  scenarios.push(next);
  saveScenarios(calculatorType, scenarios.slice(-MAX_SCENARIOS));
  renderScenarios();
  showStatus(scenarios.length > MAX_SCENARIOS ? "Найстаріший сценарій замінено" : "Сценарій додано");
}

function clearScenarios() {
  if (!calculatorType) return;
  saveScenarios(calculatorType, []);
  renderScenarios();
  showStatus("Сценарії очищено");
}

function saveCurrentCalculationToHistory() {
  if (!calculatorType || !currentResult) return;
  const history = loadCalculationHistory(calculatorType);
  const inputs = readInputs();
  const next = recordCurrent(CALCULATORS[calculatorType].shortTitle);
  const previous = history.at(-1);
  const updated = previous && JSON.stringify(previous.inputs) === JSON.stringify(inputs) && JSON.stringify(previous.payroll) === JSON.stringify(next.payroll)
    ? [...history.slice(0, -1), next]
    : [...history, next];
  saveCalculationHistory(calculatorType, updated);
  renderCalculationHistory();
  showStatus("Розрахунок збережено в історію цього пристрою");
}

function clearCalculationHistory() {
  if (!calculatorType) return;
  saveCalculationHistory(calculatorType, []);
  renderCalculationHistory();
  showStatus("Історію очищено");
}

function renderCalculationHistory() {
  if (!calculatorType || !historyList) return;
  const history = loadCalculationHistory(calculatorType).slice().reverse();
  if (!history.length) {
    historyList.innerHTML = `<p class="empty-state">Тут з’являться розрахунки, які ви збережете на цьому пристрої. Коди доступу не зберігаються.</p>`;
    return;
  }
  historyList.innerHTML = history.map((item) => `
    <article class="scenario-item">
      <div>
        <span>${escapeHtml(item.createdAt)}</span>
        <strong>${formatCurrency(item.totalPay)}</strong>
        <small>${escapeHtml(`${item.inputs.month} ${item.inputs.year || 2026}`)}, зона ${escapeHtml(item.inputs.ratingZone)}, ${roundMoney(item.inputs.actualHours)} год</small>
        ${isHourlyPayCalculator() && Number.isFinite(item.effectiveHourlyPay)
          ? `<small>Ефективна годинна ЗП: ${formatCurrency(item.effectiveHourlyPay)} / год</small>`
          : ""}
      </div>
      <div class="scenario-controls">
        <button class="ghost-button" type="button" data-load-history="${escapeHtml(item.id)}">Відкрити</button>
      </div>
    </article>
  `).join("");
}

function renderScenarios() {
  if (!calculatorType || !scenarioList) return;
  const scenarios = loadScenarios(calculatorType);

  if (scenarios.length === 0) {
    scenarioList.innerHTML = `<p class="empty-state">Додайте поточний розрахунок як сценарій, а потім змініть поля для порівняння.</p>`;
    return;
  }

  const currentTotal = currentResult?.totalPay ?? scenarios.at(-1).totalPay;
  scenarioList.innerHTML = scenarios
    .map((scenario) => {
      const delta = currentTotal - scenario.totalPay;
      const deltaClass = delta >= 0 ? "positive" : "negative";
      const deltaLabel = `${delta >= 0 ? "+" : ""}${formatCurrency(delta)}`;

      return `
        <article class="scenario-item">
          <div>
            <span>${escapeHtml(scenario.name)}</span>
            <strong>${formatCurrency(scenario.totalPay)}</strong>
            <small>${escapeHtml(`${scenario.inputs.month} ${scenario.inputs.year || 2026}`)}, зона ${escapeHtml(scenario.inputs.ratingZone)}, ${roundMoney(scenario.inputs.actualHours)} год</small>
            ${isHourlyPayCalculator() && Number.isFinite(scenario.effectiveHourlyPay)
              ? `<small>Ефективна годинна ЗП: ${formatCurrency(scenario.effectiveHourlyPay)} / год</small>`
              : ""}
          </div>
          <div class="scenario-controls">
            <div class="scenario-delta ${deltaClass}">${deltaLabel}</div>
            <button class="ghost-button" type="button" data-load-scenario="${escapeHtml(scenario.id)}">Відкрити</button>
            <button class="icon-button" type="button" data-delete-scenario="${escapeHtml(scenario.id)}" aria-label="Видалити сценарій">×</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function reset() {
  if (!calculatorType) return;
  configurePayrollData(withColleagueRules(lastPayrollPayload));
  const defaults = getRuntimeDefaults(calculatorType);
  selectedRatingZone = defaults.ratingZone;
  fillForm(defaults);
  renderRatingButtons(selectedRatingZone);
  saveInputs(calculatorType, defaults);
  update();
  showStatus("Скинуто");
}

function showStatus(message) {
  statusMessage.textContent = message;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("is-visible");
  window.clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = window.setTimeout(() => {
    statusMessage.textContent = "";
    toast.classList.remove("is-visible");
    toast.hidden = true;
  }, 2200);
}

function loadInputs(type) {
  return loadCalculatorInputs(type, getRuntimeDefaults(type), clampRatingZone);
}

function saveInputs(type, inputs) {
  saveCalculatorInputs(type, inputs);
}

function levelLabel(value) {
  return LEVELS.find((level) => level.value === value)?.label ?? value;
}

function clampRatingZone(zone, type = calculatorType) {
  return clampZone(CALCULATORS, zone, type);
}

function getLevelBonusDisplayValue(result) {
  if (!isGrossCalculator()) return result.levelBonus;
  if (calculatorType === "video") {
    return result.normHours ? (result.levelBonus / result.normHours) * result.effectiveHours : 0;
  }
  return result.levelBonus;
}

function hasTestsInput(type = calculatorType) {
  return CALCULATORS[type]?.hasTests !== false && (CALCULATORS[type]?.reference || (type !== "video" && type !== "iron"));
}

function hasWorkScheduleInput(type = calculatorType) {
  return Boolean(CALCULATORS[type]?.scheduleOptions?.length);
}

function hasTenureHoursInput(type = calculatorType) {
  return type === "iron" && !CALCULATORS[type]?.reference;
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function handleAppLinkClick(event) {
  const link = event.target.closest("a[href^='/']");
  if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateTo(link.getAttribute("href"));
}

function navigateTo(path) {
  history.pushState({}, "", path);
  renderRoute();
}

function handleScenarioClick(event) {
  const loadButton = event.target.closest("[data-load-scenario]");
  if (loadButton && calculatorType) {
    const scenario = loadScenarios(calculatorType).find((item) => String(item.id) === loadButton.dataset.loadScenario);
    if (!scenario) return;
    openRecord(scenario);
    return;
  }
  const button = event.target.closest("[data-delete-scenario]");
  if (!button || !calculatorType) return;
  const id = button.dataset.deleteScenario;
  const scenarios = loadScenarios(calculatorType).filter((scenario) => String(scenario.id) !== id);
  saveScenarios(calculatorType, scenarios);
  renderScenarios();
  showStatus("Сценарій видалено");
}

function handleHistoryClick(event) {
  const button = event.target.closest("[data-load-history]");
  if (!button || !calculatorType) return;
  const item = loadCalculationHistory(calculatorType).find((entry) => String(entry.id) === button.dataset.loadHistory);
  if (!item) return;
  openRecord(item);
}

function getRuntimeDefaults(type) {
  return {
    ...getDefaultInputs(type),
    year: new Date().getFullYear(), rulesSource: defaultRulesSource(type), stage: "after3",
    month: MONTHS[new Date().getMonth()]?.name ?? getDefaultInputs(type).month
  };
}

function isGrossCalculator(type = calculatorType) {
  return CALCULATORS[type]?.taxMode === "gross";
}

function isHourlyPayCalculator(type = calculatorType) {
  return Boolean(CALCULATORS[type]);
}

function hasWowBonus(type = calculatorType) {
  return Boolean(CALCULATORS[type]?.hasWow);
}

function hasBonusInput(type = calculatorType) {
  return Boolean(CALCULATORS[type]?.hasWow || CALCULATORS[type]?.bonusInputMode);
}

function isBonusAmount(type = calculatorType) {
  return CALCULATORS[type]?.bonusInputMode === "amountTaxable" || CALCULATORS[type]?.bonusInputMode === "amountNet";
}

function formatPercent(value) {
  return `${roundMoney((value ?? 0) * 100)}%`;
}

function renderBonusInput() {
  const input = form.elements.wowCases;
  const label = document.querySelector("#bonusInputLabel");
  if (!input || !label) return;

  label.textContent = CALCULATORS[calculatorType]?.bonusLabel ?? "WOW-кейси";
  input.max = isBonusAmount() ? "" : "5";
  input.step = isBonusAmount() ? "1" : "1";
  input.inputMode = isBonusAmount() ? "decimal" : "numeric";
}

function renderDeductionInput() {
  const label = document.querySelector("#deductionInputLabel");
  if (!label) return;
  label.textContent = CALCULATORS[calculatorType]?.deductionLabel ?? "Штрафи";
}

function renderScheduleOptions() {
  const group = document.querySelector("#workScheduleGroup");
  const options = CALCULATORS[calculatorType]?.scheduleOptions;
  if (!group || !options?.length) return;

  const selected = form.elements.workSchedule?.value || getDefaultInputs(calculatorType).workSchedule;
  const current = options.some(option=>option.value===selected) ? selected : options[0].value;
  group.innerHTML = options
    .map(
      (option) => `
        <label>
          <input type="radio" name="workSchedule" value="${option.value}" ${option.value === current ? "checked" : ""} />
          <span>${option.label}</span>
        </label>
      `
    )
    .join("");
}

async function renderAdminPanel() {
  if (!accessSession?.isAdmin) return;
  adminView.setAttribute("aria-busy", "true");
  adminRefreshButton.disabled = true;
  adminStorageNotice.textContent = "Завантажую статистику...";
  adminStats.innerHTML = "";
  adminRoles.innerHTML = "";
  adminRecent.innerHTML = "";
  adminPaymentRules.innerHTML = "";
  adminPayslipResult.innerHTML = "";
  adminSettingsHistory.innerHTML = "";
  adminRatePreview.innerHTML = "";

  try {
    const [statsResponse, rulesResponse, settingsResponse] = await Promise.all([
      fetch("/api/admin/stats", { credentials: "same-origin" }),
      fetch("/api/admin/payment-rules", { credentials: "same-origin" }),
      fetch("/api/admin/settings", { credentials: "same-origin" })
    ]);
    const data = await statsResponse.json();
    const rulesData = await rulesResponse.json();
    const settingsData = await settingsResponse.json();
    if (!statsResponse.ok) throw new Error(data.error || "Не вдалося отримати статистику.");
    if (!rulesResponse.ok) throw new Error(rulesData.error || "Не вдалося отримати правила виплат.");
    if (!settingsResponse.ok) throw new Error(settingsData.error || "Не вдалося отримати налаштування.");

    renderAdminStats(data.stats);
    renderAdminRoles(data.roles, data.calculators);
    renderAdminRecent(data.stats.recent);
    renderAdminPaymentRules(rulesData.rules);
    renderAdminSettings(settingsData.settings);
    adminSettingsHistory.innerHTML = settingsHistoryHtml(settingsData.history);
  } catch (error) {
    adminStorageNotice.textContent = error.message || "Не вдалося завантажити адмін-панель.";
  } finally {
    adminView.removeAttribute("aria-busy");
    adminRefreshButton.disabled = false;
  }
}

function renderAdminStats(stats) {
  const storageMessages = {
    redis: "Статистика зберігається у Redis/Upstash і переживе redeploy.",
    ephemeral: "Redis не підключений: статистика тимчасова і може скидатися після redeploy або холодного старту Vercel.",
    "redis-unavailable": "Redis налаштований, але зараз недоступний. Показую тимчасову локальну статистику."
  };
  adminStorageNotice.textContent = storageMessages[stats.storage] || "Стан сховища статистики невідомий.";

  adminStats.innerHTML = adminStatsHtml(stats);
}

function renderAdminRoles(roles, calculators) {
  adminRoles.innerHTML = adminRolesHtml(roles, calculators);
}

function renderAdminRecent(recent) {
  adminRecent.innerHTML = adminRecentHtml(recent);
}

function renderAdminPaymentRules(rules = {}) {
  adminPaymentRules.innerHTML = adminPaymentRulesHtml(rules, formatCurrency, roundMoney);
}

function renderAdminSettings(settings = {}) {
  adminSettingsState = {
    rateVersions: settings.rateVersions ?? [],
    version: settings.version ?? {},
    overrides: settings.overrides ?? {},
    templates: settings.templates ?? {}
  };

  if (adminVersionForm) {
    adminVersionForm.elements.label.value = adminSettingsState.version.label ?? "";
    adminVersionForm.elements.updatedAt.value = adminSettingsState.version.updatedAt ?? "";
    adminVersionForm.elements.effectiveFrom.value = adminSettingsState.version.effectiveFrom || "2026-03-01";
    adminVersionForm.elements.note.value = adminSettingsState.version.note ?? "";
  }
  if (adminRatesForm) {
    adminRatesForm.elements.overrides.value = prettyJson(adminSettingsState.overrides);
    mountRateEditor(document.querySelector("#adminRateEditor"),adminRatesForm.elements.overrides,()=>applyAdminSettings(basePayrollPayload,{overrides:JSON.parse(adminRatesForm.elements.overrides.value || "{}")}).config.calculators);
    adminRatesForm.elements.overrides.placeholder = prettyJson({
      service: {
        salary: 12497,
        taxRate: 0.23,
        ratingBonusByZone: { "1": 23062, "2": 20080 },
        levelBonusByLevelAndZone: { level3: { "1": 7234, "2": 3617, "3": 0 } }
      }
    });
  }
  if (adminTemplatesForm) {
    adminTemplatesForm.elements.templates.value = prettyJson(adminSettingsState.templates);
    adminTemplatesForm.elements.templates.placeholder = prettyJson({
      iron: {
        Травень: {
          workSchedule: "2/2",
          actualHours: 137,
          nightHours: 39,
          ratingZone: 2,
          level: "level2"
        }
      }
    });
  }
}

async function saveAdminVersion(event) {
  event.preventDefault();
  const data = new FormData(adminVersionForm);
  await saveAdminSettings({
    ...adminSettingsState,
    version: {
      effectiveFrom: data.get("effectiveFrom"),
      label: data.get("label"),
      updatedAt: data.get("updatedAt"),
      note: data.get("note")
    }
  }, "Версію правил збережено");
}

async function saveAdminRates(event) {
  event.preventDefault();
  try {
    await saveAdminSettings({
      ...adminSettingsState,
      overrides: JSON.parse(adminRatesForm.elements.overrides.value || "{}")
    }, "Ставки збережено");
  } catch {
    showStatus("JSON ставок має помилку");
  }
}

function previewAdminRates() {
  try {
    const overrides = JSON.parse(adminRatesForm.elements.overrides.value || "{}");
    const types = Object.keys(overrides).filter((type) => CALCULATORS[type]);
    if (!types.length) {
      adminRatePreview.innerHTML = `<p class="empty-state">Додайте перевизначення хоча б для одного напрямку, щоб побачити прогноз.</p>`;
      return;
    }

    const baseline = types.map((type) => ({
      type,
      title: CALCULATORS[type].title,
      input: getDefaultInputs(type),
      result: calculatePayroll(getDefaultInputs(type), type)
    }));
    const previewPayload = applyAdminSettings(basePayrollPayload, {
      ...adminSettingsState,
      overrides
    });

    configurePayrollData(previewPayload);
    const previews = baseline.map((item) => ({
      ...item,
      nextResult: calculatePayroll(getDefaultInputs(item.type), item.type)
    }));
    configurePayrollData(lastPayrollPayload);

    adminRatePreview.innerHTML = previews.map((item) => {
      const netDifference = item.nextResult.totalPay - item.result.totalPay;
      const grossDifference = item.nextResult.totalGross - item.result.totalGross;
      const tone = Math.abs(netDifference) < 0.005 ? "" : " is-warning";
      return `
        <article class="admin-row">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.input.month)}, ${roundMoney(item.input.actualHours)} год, зона ${item.input.ratingZone}</small>
          </div>
          <small>
            Було: ${formatCurrency(item.result.totalPay)} чистими<br>
            Стане: ${formatCurrency(item.nextResult.totalPay)} чистими
          </small>
          <span class="status-pill${tone}">${netDifference >= 0 ? "+" : ""}${formatCurrency(netDifference)}<br><small>з податком: ${grossDifference >= 0 ? "+" : ""}${formatCurrency(grossDifference)}</small></span>
        </article>
      `;
    }).join("");
  } catch {
    adminRatePreview.innerHTML = `<div class="notice warning">JSON ставок має помилку. Виправте його перед переглядом.</div>`;
  } finally {
    if (lastPayrollPayload) configurePayrollData(lastPayrollPayload);
  }
}

async function saveAdminTemplates(event) {
  event.preventDefault();
  try {
    await saveAdminSettings({
      ...adminSettingsState,
      templates: JSON.parse(adminTemplatesForm.elements.templates.value || "{}")
    }, "Шаблони місяців збережено");
  } catch {
    showStatus("JSON шаблонів має помилку");
  }
}

async function saveAdminSettings(settings, successMessage) {
  const response = await fetch("/api/admin/settings", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings, summary: successMessage })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    showStatus(error.error || "Не вдалося зберегти налаштування");
    return;
  }

  const data = await response.json();
  adminSettingsState = data.settings;
  activeSettings = data.settings;
  await refreshPayrollConfig();
  showStatus(successMessage);
  renderAdminPanel();
}

async function rollbackAdminSettings(event) {
  const button = event.target.closest("[data-rollback-settings]");
  if (!button) return;
  if (!window.confirm("Відновити цю версію ставок і шаблонів? Поточний стан теж залишиться в історії.")) return;

  const response = await fetch("/api/admin/settings", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revisionId: button.dataset.rollbackSettings })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    showStatus(data.error || "Не вдалося відновити версію");
    return;
  }
  adminSettingsState = data.settings;
  activeSettings = data.settings;
  await refreshPayrollConfig();
  showStatus("Версію налаштувань відновлено");
  renderAdminPanel();
}

async function refreshPayrollConfig() {
  const response = await fetch("/api/session", { credentials: "same-origin" });
  const data = await response.json();
  if (!response.ok || !data.authenticated) return;
  basePayrollPayload = data.payroll;
  lastPayrollPayload = await applyRemoteConfig(basePayrollPayload);
  configurePayrollData(lastPayrollPayload);
  renderSelects();
  if (calculatorType) update();
}

async function compareAdminPayslip(event) {
  event.preventDefault();
  const data = new FormData(adminPayslipForm);
  const type = data.get("calculator");
  const defaults = getDefaultInputs(type);
  const expectedGross = toNumber(data.get("expectedGross"));
  const expectedNet = toNumber(data.get("expectedNet"));
  const input = {
    ...defaults,
    month: data.get("month"),
    workSchedule: data.get("workSchedule") || defaults.workSchedule,
    actualHours: data.get("actualHours"),
    testsHigh: false,
    ratingZone: data.get("ratingZone"),
    level: form.elements.level.value,
    salary: defaults.salary,
    nightHours: data.get("nightHours"),
    holidayHours: 0,
    doubleHours: 0,
    wowCases: 0,
    fines: 0,
    taxiAmount: 0,
    tenureYears: data.get("tenureYears"),
    tenureHours: data.get("actualHours"),
    firstHalfHours: defaults.firstHalfHours,
    secondHalfHours: defaults.secondHalfHours,
    ratingFirstPart: defaults.ratingFirstPart
  };
  const result = calculatePayroll(input, type);
  const grossDiff = result.totalGross - expectedGross;
  const netDiff = result.totalPay - expectedNet;
  const grossTone = Math.abs(grossDiff) < 0.02 ? "success" : "warning";
  const netTone = Math.abs(netDiff) < 0.02 ? "success" : "warning";

  adminPayslipResult.innerHTML = `
    <article class="admin-row">
      <div>
        <strong>${CALCULATORS[type]?.title ?? type}</strong>
        <small>${result.input.month}, ${result.input.workSchedule}, зона ${result.input.ratingZone}, ${roundMoney(result.effectiveHours)} год</small>
      </div>
      <small>
        Розрахунок: ${formatCurrency(result.totalGross)} з податком / ${formatCurrency(result.totalPay)} чистими<br>
        Факт: ${formatCurrency(expectedGross)} з податком / ${formatCurrency(expectedNet)} чистими
      </small>
      <span class="status-pill ${Math.abs(grossDiff) < 0.02 && Math.abs(netDiff) < 0.02 ? "" : "is-warning"}">
        різниця ${formatCurrency(netDiff)}
      </span>
    </article>
    <div class="notice ${grossTone}">До податку: різниця ${formatCurrency(grossDiff)}</div>
    <div class="notice ${netTone}">Чистими: різниця ${formatCurrency(netDiff)}</div>
    <article class="admin-row">
      <div>
        <strong>Розкладка калькулятора</strong>
        <small>Оклад/рейтинг/доплати окремо від стажу</small>
      </div>
      <small>
        ЗП: ${formatCurrency(result.baseGross)} з податком / ${formatCurrency(result.basePay)} чистими<br>
        Стаж: ${formatCurrency(result.tenureGross)} з податком / ${formatCurrency(result.tenurePay)} чистими<br>
        Податок: ${formatCurrency(result.tax)}
      </small>
    </article>
  `;
}

async function saveAdminPaymentRule(event) {
  event.preventDefault();
  const data = new FormData(adminRuleForm);
  const payload = {
    calculator: data.get("calculator"),
    month: data.get("month"),
    rule: {
      firstHalfAmount: data.get("firstHalfAmount"),
      firstHalfHours: data.get("firstHalfHours"),
      secondHalfAmount: data.get("secondHalfAmount"),
      secondHalfHours: data.get("secondHalfHours"),
      nextMonthAmount: data.get("nextMonthAmount"),
      tenureAmount: data.get("tenureAmount"),
      tenureHours: data.get("tenureHours"),
      note: data.get("note")
    }
  };

  const response = await fetch("/api/admin/payment-rules", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    showStatus(error.error || "Не вдалося зберегти правило");
    return;
  }

  await reloadPaymentRules();
  adminRuleForm.reset();
  showStatus("Правило виплат збережено");
  renderAdminPanel();
}

async function deleteAdminPaymentRule(event) {
  const button = event.target.closest("[data-delete-rule]");
  if (!button) return;
  const [calculator, month] = button.dataset.deleteRule.split(":");
  const response = await fetch("/api/admin/payment-rules", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calculator, month })
  });
  if (!response.ok) {
    showStatus("Не вдалося видалити правило");
    return;
  }
  await reloadPaymentRules();
  showStatus("Правило видалено");
  renderAdminPanel();
}

async function resetAdminStats() {
  if (!accessSession?.isAdmin) return;
  const shouldReset = window.confirm("Скинути всю статистику входів і переглядів?");
  if (!shouldReset) return;

  const response = await fetch("/api/admin/stats", {
    method: "DELETE",
    credentials: "same-origin"
  });
  if (response.ok) {
    showStatus("Статистику скинуто");
    renderAdminPanel();
  } else {
    showStatus("Не вдалося скинути статистику");
  }
}

function trackView(calculator) {
  const path = window.location.pathname;
  const key = `${path}:${calculator}`;
  if (lastTrackedView === key) return;
  lastTrackedView = key;
  trackEvent("view", { calculator, path });
}

function trackEvent(type, details = {}) {
  if (!accessSession) return;
  const path = details.path || window.location.pathname;
  const calculator = details.calculator || calculatorType || (path === "/admin" ? "admin" : "home");
  fetch("/api/track", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, calculator, path })
  }).catch(() => {});
}

async function applyRemotePaymentRules(payroll) {
  try {
    const response = await fetch("/api/payment-rules", { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) { configUnavailable = true; return payroll; }
    return applyPaymentRules(payroll, data.rules);
  } catch {
    configUnavailable = true;
    return payroll;
  }
}

async function reloadPaymentRules() {
  if (!basePayrollPayload && !lastPayrollPayload) return;
  const sourcePayload = basePayrollPayload ?? lastPayrollPayload;
  const basePayload = {
    ...sourcePayload,
    config: {
      ...sourcePayload.config,
      calculators: Object.fromEntries(
        Object.entries(sourcePayload.config.calculators).map(([key, config]) => [
          key,
          { ...config, paymentMonthlyRules: undefined }
        ])
      )
    }
  };
  lastPayrollPayload = await applyRemoteConfig(basePayload);
  configurePayrollData(lastPayrollPayload);
}

async function applyRemoteConfig(payroll) {
  configUnavailable = false;
  const withSettings = await applyRemoteSettings(payroll);
  return applyRemotePaymentRules(withSettings);
}

async function applyRemoteSettings(payroll) {
  try {
    const response = await fetch("/api/settings", { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) { configUnavailable = true; return payroll; }
    activeSettings = data.settings ?? {};
    adminSettingsState = activeSettings;
    return applyAdminSettings(payroll, activeSettings);
  } catch {
    configUnavailable = true;
    activeSettings = {};
    adminSettingsState = {};
    return payroll;
  }
}

function applyAdminSettings(payroll, settings = {}) {
  const overrides = settings.overrides ?? {};
  return {
    ...payroll,
    config: {
      ...payroll.config,
      rulesVersion: settings.version,
      calculators: Object.fromEntries(
        Object.entries(payroll.config.calculators).map(([key, config]) => [
          key,
          mergeCalculatorOverride(config, overrides[key])
        ])
      )
    }
  };
}

function mergeCalculatorOverride(config, override = {}) {
  if (!override || typeof override !== "object") return config;
  const next = { ...config };
  if (Object.keys(override).length) { next.reference=false;next.source="Правила проєкту (зміни адміністратора)"; }
  if (override.tenureBase !== undefined) next.tenureBase = Number(override.tenureBase);
  if (override.taxRate !== undefined) next.taxRate = Number(override.taxRate);
  if (override.salary !== undefined) {
    next.defaultInputs = { ...next.defaultInputs, salary: Number(override.salary) };
  }
  if (override.ratingBonusByZone) {
    next.ratingBonusByZone = mergeNumberMap(next.ratingBonusByZone, override.ratingBonusByZone);
  }
  if (override.levelBonusByLevel) {
    next.levelBonusByLevel = mergeNumberMap(next.levelBonusByLevel, override.levelBonusByLevel);
  }
  if (override.levelBonusByLevelAndZone) {
    next.levelBonusByLevelAndZone = mergeNestedNumberMap(next.levelBonusByLevelAndZone, override.levelBonusByLevelAndZone);
  }
  if (override.scheduleMonthHours) {
    next.scheduleMonthHours = mergeNestedNumberMap(next.scheduleMonthHours, override.scheduleMonthHours);
  }
  return next;
}

function mergeNumberMap(base = {}, override = {}) {
  return Object.fromEntries(
    Object.entries({ ...base, ...override }).map(([key, value]) => [key, Number(value)])
  );
}

function mergeNestedNumberMap(base = {}, override = {}) {
  const next = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    next[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeNumberMap(base[key], value)
      : Number(value);
  });
  return next;
}

function applyPaymentRules(payroll, rules = {}) {
  return {
    ...payroll,
    config: {
      ...payroll.config,
      calculators: Object.fromEntries(
        Object.entries(payroll.config.calculators).map(([key, config]) => [
          key,
          {
            ...config,
            paymentMonthlyRules: rules[key] ?? config.paymentMonthlyRules
          }
        ])
      )
    }
  };
}

function prettyJson(value) {
  return JSON.stringify(value ?? {}, null, 2);
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function applySavedTheme() {
  const savedTheme = loadSavedTheme();
  const theme = savedTheme === "dark" || savedTheme === "light"
    ? savedTheme
    : document.documentElement.dataset.theme || preferredTheme();
  setTheme(theme, Boolean(savedTheme));
}

function toggleTheme() {
  const nextTheme = currentTheme() === "dark" ? "light" : "dark";
  setTheme(nextTheme, true);
}

function setTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    saveTheme(theme);
  }
  themeToggle.textContent = theme === "dark" ? "Світла" : "Темна";
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
}

function currentTheme() {
  return document.documentElement.dataset.theme || preferredTheme();
}

function preferredTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function invalidateResult(message) {
  currentResult=null;
  for(const id of ['totalNet','totalGross','totalTax','monthNorm','baseNet','tenureNet','ratingBonus','levelBonus']) setText('#'+id,'—');
  for(const button of [copyButton,printButton,addScenarioButton,saveHistoryButton]) button.disabled=true;
  absenceGrid.innerHTML='';
  effectiveHourlyResult.hidden=true;
  validationMessages.innerHTML=`<div class="notice warning">${escapeHtml(message)}</div>`;
  for(const el of [paymentGrid,formulaList,reportPanel,document.querySelector('#breakdown'),document.querySelector('#directionComparison')]) el.innerHTML='';
}
function recordCurrent(name) {
  return createCalculationRecord({type:calculatorType,name,inputs:currentResult.input,result:currentResult,payroll:activeCalculationPayload,version:selectedVersion?.version || activeSettings.version});
}
function openRecord(item) {
  if (!item.result || !item.payroll) { showStatus('Цей старий запис не містить знімка правил. Його сума залишається в історії; точне відновлення недоступне.'); return; }
  if (item.type && item.type !== calculatorType) navigateTo('/'+item.type);
  savedRecord=item; activeCalculationPayload=item.payroll; selectedVersion={version:item.version};
  configurePayrollData(item.payroll); fillForm(item.inputs); selectedRatingZone=item.inputs.ratingZone;
  renderRatingButtons(selectedRatingZone); renderModeFields(); renderModeLabels(); currentResult=item.result;
  form.inert=true; document.querySelector('#savedRecordNotice').hidden=false;
  renderDirectionComparison(item.inputs);
  renderResult(item.result); renderValidation(item.result); renderFormulaList(item.result); renderPaymentSchedule(item.result); renderReport(item.result);
  for(const button of [copyButton,printButton]) button.disabled=false;
}
function zoneTone(type, zone) {
  const cfg=CALCULATORS[type];
  if (cfg?.zoneTones?.[zone]) return cfg.zoneTones[zone];
  return type==='level4' ? ({1:'green',2:'yellow',3:'red'})[zone] : ({1:'green',2:'lime',3:'yellow',4:'pink',5:'red'})[zone];
}
function renderDirectionComparison(inputs) {
  const tone=zoneTone(calculatorType,inputs.ratingZone);
  const rows=Object.entries(CALCULATORS).map(([type,cfg])=>{
    const zone=cfg.ratingZones.length===1 ? cfg.ratingZones[0] : cfg.ratingZones.find(z=>zoneTone(type,z)===tone);
    const schedule=inputs.workSchedule || '2/2';
    if(zone===undefined || cfg.scheduleOptions && !cfg.scheduleOptions.some(s=>s.value===schedule)) return `<tr><td>${escapeHtml(cfg.shortTitle)}</td><td colspan="3">Немає відповідної зони або графіка</td></tr>`;
    const target={...getDefaultInputs(type),...inputs,ratingZone:zone,salary:getDefaultInputs(type).salary,testsHigh:hasTestsInput(type)&&inputs.testsHigh,nightHours:cfg.hasNight===false?0:inputs.nightHours,doubleHours:cfg.hasDouble===false?0:inputs.doubleHours,holidayHours:cfg.reference?0:inputs.holidayHours};
    const result=calculatePayroll(target,type);
    return `<tr><td><a href="/${type}">${escapeHtml(cfg.shortTitle)}</a></td><td>${formatCurrency(result.totalPay)}</td><td>${formatCurrency(result.totalPay-currentResult.totalPay)}</td><td>${(cfg.reference?'Колега':'Наші')+(cfg.hasTests===false||cfg.hasNight===false||cfg.hasDouble===false?' · лише доступні доплати':'')}</td></tr>`;
  });
  document.querySelector('#directionComparison').innerHTML=`<table class="comparison-table"><thead><tr><th>Напрямок</th><th>На руки</th><th>Різниця</th><th>Правила</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
async function initCorporateLogin() {
  const corporate=document.querySelector('#corporateLogin');
  const message=document.querySelector('#corporateError');
  const otpField=document.querySelector('#otpField');
  const restart=document.querySelector('#restartOtp');
  let challengeId=null;
  try {
    const response=await fetch('/api/corporate-auth'); const options=await response.json();
    if(!response.ok) return;
    corporate.hidden=!options.ldapSlack; accessForm.hidden=!options.roleCode;
    if(!options.ldapSlack && !options.roleCode) { const notice=document.createElement('p');notice.className='notice warning';notice.textContent='Зверніться до адміністратора для налаштування входу.';corporate.before(notice); }
  } catch { return; }
  restart.addEventListener('click',()=>{challengeId=null;otpField.hidden=true;restart.hidden=true;corporate.elements.login.readOnly=false;corporate.elements.otp.value='';corporate.querySelector('[type=submit]').textContent='Отримати код у Slack';});
  corporate.addEventListener('submit',async event=>{
    event.preventDefault(); const button=corporate.querySelector('[type=submit]'); button.disabled=true;
    try {
      const response=await fetch('/api/corporate-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(challengeId?{action:'verify',challengeId,code:corporate.elements.otp.value}:{action:'request',login:corporate.elements.login.value})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error || 'Спробуйте ще раз.');
      if(data.authenticated) { corporate.reset(); await hydrateSession(); navigateTo('/'+firstAllowedCalculator()); }
      else {challengeId=data.challengeId;otpField.hidden=false;restart.hidden=false;corporate.elements.login.readOnly=true;corporate.elements.otp.focus();button.textContent='Увійти';message.textContent=data.message;}
    } catch(error) {message.textContent=error.message;} finally {button.disabled=false;}
  });
}
