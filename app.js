import {
  CALCULATORS,
  LEVELS,
  MONTHS,
  calculatePayroll,
  configurePayrollData,
  formatCurrency,
  getDefaultInputs,
  roundMoney
} from "./calculator.js?v=53";
import { endSession, fetchSession, loginWithCode } from "./modules/auth-client.js?v=53";
import {
  adminPaymentRulesHtml,
  adminRecentHtml,
  adminRolesHtml,
  adminStatsHtml,
  settingsHistoryHtml
} from "./modules/admin-ui.js?v=53";
import { clampRatingZone as clampZone, ratingButtonsHtml } from "./modules/calculator-ui.js?v=53";
import { buildTextReport as createTextReport, reportHtml } from "./modules/reports.js?v=53";
import { escapeHtml } from "./modules/safe-html.js?v=53";
import {
  MAX_SCENARIOS,
  loadCalculatorInputs,
  loadSavedTheme,
  loadScenarios,
  saveCalculatorInputs,
  saveScenarios,
  saveTheme
} from "./modules/storage.js?v=53";

const form = document.querySelector("#calculatorForm");
const accessView = document.querySelector("#accessView");
const accessForm = document.querySelector("#accessForm");
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
const validationMessages = document.querySelector("#validationMessages");
const formulaList = document.querySelector("#formulaList");
const reportPanel = document.querySelector("#reportPanel");
const paymentGrid = document.querySelector("#paymentGrid");
const absenceGrid = document.querySelector("#absenceGrid");
const toast = document.querySelector("#toast");
const APP_EYEBROW = "Калькулятор ЗП для графіка 2/2";
const ACTIVE_ACCESS_ROLES = new Set(["admin", "operator", "supervisor", "level4", "xd", "video", "iron"]);
const ACTIVE_CALCULATOR_KEYS = new Set(["service", "supervisor", "level4", "xd", "video", "iron"]);

let calculatorType = null;
let selectedRatingZone = 1;
let currentResult = null;
let accessSession = null;
let lastTrackedView = "";
let basePayrollPayload = null;
let lastPayrollPayload = null;
let activeSettings = {};
let adminSettingsState = {};

init();

async function init() {
  applySavedTheme();
  removeStaleStaticOptions();
  accessForm.addEventListener("submit", handleAccessSubmit);
  form.addEventListener("input", update);
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
  adminTemplatesForm.addEventListener("submit", saveAdminTemplates);
  adminSettingsHistory.addEventListener("click", rollbackAdminSettings);
  adminPayslipForm.addEventListener("submit", compareAdminPayslip);
  addScenarioButton.addEventListener("click", addScenario);
  clearScenariosButton.addEventListener("click", clearScenarios);
  scenarioList.addEventListener("click", handleScenarioClick);
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
    basePayrollPayload = data.payroll;
    lastPayrollPayload = await applyRemoteConfig(basePayrollPayload);
    configurePayrollData(lastPayrollPayload);
    renderSelects();
  } catch {
    accessError.textContent = "Сервер авторизації недоступний. Запустіть сайт через Vercel.";
  }
}

function renderRoute() {
  if (!accessSession) {
    if (window.location.pathname !== "/login") {
      history.replaceState({}, "", "/login");
    }
    renderAccessGate();
    return;
  }

  const isAdminRoute = window.location.pathname === "/admin";
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

async function handleAccessSubmit(event) {
  event.preventDefault();
  const formData = new FormData(accessForm);
  const role = formData.get("role");
  const code = formData.get("code");
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
    basePayrollPayload = data.payroll;
    lastPayrollPayload = await applyRemoteConfig(basePayrollPayload);
    configurePayrollData(lastPayrollPayload);
    renderSelects();
    accessForm.reset();
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
  accessSession = null;
  lastTrackedView = "";
  await endSession();
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
  renderScheduleOptions();
  renderBonusInput();
  renderDeductionInput();
}

function renderModeLabels() {
  const taxLabel = `Податок ${formatPercent(CALCULATORS[calculatorType].taxRate)}`;
  setText("#totalMainLabel", "Загальна сума до виплати");
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
  const inputs = readInputs();
  const result = calculatePayroll(inputs, calculatorType);
  currentResult = result;
  saveInputs(calculatorType, inputs);
  renderResult(result);
  renderValidation(result);
  renderFormulaList(result);
  renderPaymentSchedule(result);
  renderReport(result);
  renderScenarios();
}

function handleFormChange(event) {
  if (event.target?.name === "month") {
    applyMonthTemplate(calculatorType, event.target.value);
  }
  update();
}

function applyMonthTemplate(type, month) {
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
    month: data.get("month"),
    workSchedule: hasWorkScheduleInput() ? data.get("workSchedule") : defaults.workSchedule,
    actualHours: data.get("actualHours"),
    testsHigh: hasTestsInput() && form.elements.testsHigh.checked,
    ratingZone: clampRatingZone(selectedRatingZone),
    level: data.get("level"),
    salary: defaults.salary,
    nightHours: data.get("nightHours"),
    holidayHours: data.get("holidayHours"),
    doubleHours: data.get("doubleHours"),
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

function renderValidation(result) {
  const messages = buildValidationMessages(result);
  validationMessages.innerHTML = messages
    .map((message) => `<div class="notice ${message.tone}">${escapeHtml(message.text)}</div>`)
    .join("");
}

function buildValidationMessages(result) {
  const messages = [];
  const input = result.input;
  const version = activeSettings.version;

  if (version?.label) {
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
      formula: `${activeSettings.version?.label ?? "Базові правила"}${activeSettings.version?.updatedAt ? `, оновлено ${activeSettings.version.updatedAt}` : ""}`
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

  if (!hasReliablePaymentSchedule()) {
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
  return calculatorType === "supervisor";
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
  const result = calculatePayroll(readInputs(), calculatorType);
  const config = CALCULATORS[calculatorType];
  const summary = createTextReport(result, config, {
    isGross: isGrossCalculator(),
    hasReliablePaymentSchedule: hasReliablePaymentSchedule(),
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
  const next = {
    id: Date.now(),
    name: `Сценарій ${scenarios.length + 1}`,
    inputs: readInputs(),
    totalPay: currentResult.totalPay,
    basePay: currentResult.basePay,
    tenurePay: currentResult.tenurePay,
    tax: currentResult.tax,
    createdAt: new Date().toLocaleString("uk-UA")
  };

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
            <small>${escapeHtml(scenario.inputs.month)}, зона ${escapeHtml(scenario.inputs.ratingZone)}, ${roundMoney(scenario.inputs.actualHours)} год</small>
          </div>
          <div class="scenario-controls">
            <div class="scenario-delta ${deltaClass}">${deltaLabel}</div>
            <button class="icon-button" type="button" data-delete-scenario="${escapeHtml(scenario.id)}" aria-label="Видалити сценарій">×</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function reset() {
  if (!calculatorType) return;
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
  return type !== "video" && type !== "iron";
}

function hasWorkScheduleInput(type = calculatorType) {
  return Boolean(CALCULATORS[type]?.scheduleOptions?.length);
}

function hasTenureHoursInput(type = calculatorType) {
  return type === "iron";
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
  const button = event.target.closest("[data-delete-scenario]");
  if (!button || !calculatorType) return;
  const id = Number(button.dataset.deleteScenario);
  const scenarios = loadScenarios(calculatorType).filter((scenario) => scenario.id !== id);
  saveScenarios(calculatorType, scenarios);
  renderScenarios();
  showStatus("Сценарій видалено");
}

function getRuntimeDefaults(type) {
  return {
    ...getDefaultInputs(type),
    month: MONTHS[new Date().getMonth()]?.name ?? getDefaultInputs(type).month
  };
}

function isGrossCalculator(type = calculatorType) {
  return CALCULATORS[type]?.taxMode === "gross";
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

  const current = form.elements.workSchedule?.value || getDefaultInputs(calculatorType).workSchedule || options[0].value;
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
    version: settings.version ?? {},
    overrides: settings.overrides ?? {},
    templates: settings.templates ?? {}
  };

  if (adminVersionForm) {
    adminVersionForm.elements.label.value = adminSettingsState.version.label ?? "";
    adminVersionForm.elements.updatedAt.value = adminSettingsState.version.updatedAt ?? "";
    adminVersionForm.elements.note.value = adminSettingsState.version.note ?? "";
  }
  if (adminRatesForm) {
    adminRatesForm.elements.overrides.value = prettyJson(adminSettingsState.overrides);
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
    level: data.get("level"),
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
    if (!response.ok) return payroll;
    return applyPaymentRules(payroll, data.rules);
  } catch {
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
  const withSettings = await applyRemoteSettings(payroll);
  return applyRemotePaymentRules(withSettings);
}

async function applyRemoteSettings(payroll) {
  try {
    const response = await fetch("/api/settings", { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) return payroll;
    activeSettings = data.settings ?? {};
    adminSettingsState = activeSettings;
    return applyAdminSettings(payroll, activeSettings);
  } catch {
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
