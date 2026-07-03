import {
  CALCULATORS,
  LEVELS,
  MONTHS,
  calculatePayroll,
  formatCurrency,
  getDefaultInputs,
  roundMoney
} from "./calculator.js";
import { ACCESS_CONFIG } from "./payroll-data.js";

const STORAGE_KEY_PREFIX = "zp-2-2-calculator-inputs";
const ACCESS_STORAGE_KEY = "zp-2-2-access-session";
const form = document.querySelector("#calculatorForm");
const accessView = document.querySelector("#accessView");
const accessForm = document.querySelector("#accessForm");
const accessError = document.querySelector("#accessError");
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

let calculatorType = getRouteType();
let selectedRatingZone = getDefaultInputs(calculatorType || "service").ratingZone;
let currentResult = null;
let accessSession = loadAccessSession();

init();

function init() {
  renderSelects();
  renderRoute();

  accessForm.addEventListener("submit", handleAccessSubmit);
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  ratingZoneGroup.addEventListener("click", handleRatingClick);
  resetButton.addEventListener("click", reset);
  copyButton.addEventListener("click", copySummary);
  printButton.addEventListener("click", printReport);
  logoutButton.addEventListener("click", logout);
  addScenarioButton.addEventListener("click", addScenario);
  clearScenariosButton.addEventListener("click", clearScenarios);
  homeButton.addEventListener("click", () => {
    window.location.hash = "";
  });
  window.addEventListener("hashchange", renderRoute);
}

function renderRoute() {
  if (!accessSession) {
    renderAccessGate();
    return;
  }

  calculatorType = getRouteType();
  if (calculatorType && !canAccessCalculator(calculatorType)) {
    window.location.hash = firstAllowedCalculator();
    return;
  }

  const isHome = calculatorType === null;

  accessView.hidden = true;
  homeView.hidden = !isHome;
  calculatorView.hidden = isHome;
  summaryStrip.hidden = isHome;
  modeSwitcher.hidden = isHome;
  resetButton.hidden = isHome;
  copyButton.hidden = isHome;
  printButton.hidden = isHome;
  homeButton.hidden = isHome;
  logoutButton.hidden = false;
  roleBadge.hidden = false;
  roleBadge.textContent = ACCESS_CONFIG[accessSession.role].label;
  renderAllowedChoices();
  renderModeSwitcher();

  if (isHome) {
    document.querySelector("#appTitle").textContent = "Калькулятор ЗП";
    document.querySelector("#appEyebrow").textContent = "Актуально з 01.03.2026";
    return;
  }

  const config = CALCULATORS[calculatorType];
  const inputs = loadInputs(calculatorType);
  selectedRatingZone = inputs.ratingZone;

  document.querySelector("#appTitle").textContent = config.title;
  document.querySelector("#appEyebrow").textContent = config.source;
  document.querySelector(".visual-panel h2").textContent = config.shortTitle;
  document.querySelector(".visual-panel .eyebrow").textContent = "2/2";

  fillForm(inputs);
  renderRatingButtons(selectedRatingZone);
  renderModeFields();
  renderModeLabels();
  update();
  renderScenarios();
}

function renderAccessGate() {
  accessView.hidden = false;
  homeView.hidden = true;
  calculatorView.hidden = true;
  summaryStrip.hidden = true;
  modeSwitcher.hidden = true;
  resetButton.hidden = true;
  copyButton.hidden = true;
  printButton.hidden = true;
  homeButton.hidden = true;
  logoutButton.hidden = true;
  roleBadge.hidden = true;
  document.querySelector("#appTitle").textContent = "Калькулятор ЗП";
  document.querySelector("#appEyebrow").textContent = "Потрібен код доступу";
}

function handleAccessSubmit(event) {
  event.preventDefault();
  const formData = new FormData(accessForm);
  const role = formData.get("role");
  const code = formData.get("code");
  const config = ACCESS_CONFIG[role];

  if (!config || config.code !== code) {
    accessError.textContent = "Невірний код доступу.";
    return;
  }

  accessSession = {
    role,
    loggedAt: Date.now()
  };
  localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(accessSession));
  accessError.textContent = "";
  accessForm.reset();

  window.location.hash = role === "supervisor" ? "supervisor" : firstAllowedCalculator();
  renderRoute();
}

function logout() {
  accessSession = null;
  localStorage.removeItem(ACCESS_STORAGE_KEY);
  window.location.hash = "";
  renderRoute();
}

function loadAccessSession() {
  try {
    const session = JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY));
    return ACCESS_CONFIG[session?.role] ? session : null;
  } catch {
    return null;
  }
}

function canAccessCalculator(type) {
  return ACCESS_CONFIG[accessSession?.role]?.allowedCalculators.includes(type);
}

function firstAllowedCalculator() {
  return ACCESS_CONFIG[accessSession?.role]?.allowedCalculators[0] ?? "service";
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
  const route = window.location.hash.replace("#", "");
  return route === "service" || route === "supervisor" ? route : null;
}

function renderSelects() {
  monthSelect.innerHTML = MONTHS.map(
    (month) => `<option value="${month.name}">${month.name}</option>`
  ).join("");

  levelSelect.innerHTML = LEVELS.map(
    (level) => `<option value="${level.value}">${level.label}</option>`
  ).join("");
}

function renderModeFields() {
  document.querySelectorAll("[data-mode]").forEach((field) => {
    field.hidden = field.dataset.mode !== calculatorType;
  });
}

function renderModeLabels() {
  setText("#totalMainLabel", "Загальна сума до виплати");
  setText("#totalGrossLabel", "Сума з податком");
  setText("#totalTaxLabel", calculatorType === "supervisor" ? "Податки 23%" : "Податок 23%");
  setText("#baseResultLabel", calculatorType === "supervisor" ? "ЗП чистими" : "До виплати ЗП");
  setText("#tenureResultLabel", calculatorType === "supervisor" ? "Стаж чистими" : "Премія стаж");
}

function renderRatingButtons(activeZone) {
  ratingZoneGroup.innerHTML = [1, 2, 3, 4, 5]
    .map(
      (zone) => `
        <button
          class="segment ${zone === activeZone ? "is-active" : ""}"
          data-zone="${zone}"
          type="button"
          aria-pressed="${zone === activeZone}"
        >${zone}</button>
      `
    )
    .join("");
}

function handleRatingClick(event) {
  const button = event.target.closest("[data-zone]");
  if (!button) return;
  selectedRatingZone = Number(button.dataset.zone);
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

function readInputs() {
  const data = new FormData(form);
  const defaults = getDefaultInputs(calculatorType);
  return {
    month: data.get("month"),
    actualHours: data.get("actualHours"),
    testsHigh: form.elements.testsHigh.checked,
    ratingZone: selectedRatingZone,
    level: data.get("level"),
    salary: defaults.salary,
    nightHours: data.get("nightHours"),
    holidayHours: data.get("holidayHours"),
    doubleHours: data.get("doubleHours"),
    wowCases: calculatorType === "supervisor" ? data.get("wowCases") : 0,
    fines: data.get("fines"),
    taxiAmount: data.get("taxiAmount"),
    tenureYears: data.get("tenureYears"),
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
  setText("#baseNet", formatCurrency(result.basePay));
  setText("#tenureNet", formatCurrency(result.tenurePay));
  setText("#ratingBonus", formatCurrency(result.ratingBonus));
  setText("#levelBonus", formatCurrency(result.levelBonus));

  const rows = calculatorType === "supervisor" ? supervisorRows(result) : serviceRows(result);

  document.querySelector("#breakdown").innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="breakdown-row">
          <span>${label}</span>
          <strong>${formatCurrency(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderValidation(result) {
  const messages = buildValidationMessages(result);
  validationMessages.innerHTML = messages
    .map((message) => `<div class="notice ${message.tone}">${message.text}</div>`)
    .join("");
}

function buildValidationMessages(result) {
  const messages = [];
  const input = result.input;

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

  if (calculatorType === "supervisor" && input.wowCases > 0) {
    messages.push({ tone: "success", text: `WOW-кейси додали ${formatCurrency(result.wowBonus)} до чистої ЗП.` });
  }

  return messages;
}

function renderFormulaList(result) {
  formulaList.innerHTML = formulaRows(result)
    .map(
      (row) => `
        <div class="formula-row">
          <strong>${row.label}</strong>
          <span>${row.formula}</span>
        </div>
      `
    )
    .join("");
}

function formulaRows(result) {
  const i = result.input;
  const rows = [
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
      formula: `${levelLabel(i.level)}, зона ${i.ratingZone} -> ${formatCurrency(result.levelBonus)}`
    },
    {
      label: "Нічні",
      formula: `${formatCurrency(i.salary)} / ${result.normHours} * ${roundMoney(i.nightHours)} * 20% = ${formatCurrency(result.nightPay)}`
    },
    {
      label: "Оплата X2",
      formula: `(${formatCurrency(i.salary)} + ${formatCurrency(result.ratingBonus)}) / ${result.normHours} * ${roundMoney(i.doubleHours)} = ${formatCurrency(result.doublePay)}`
    }
  ];

  if (calculatorType === "supervisor") {
    rows.push(
      {
        label: "ЗП чистими",
        formula: `${formatCurrency(result.baseGross)} - ${formatCurrency(result.baseTax)} + WOW ${formatCurrency(result.wowBonus)} = ${formatCurrency(result.basePay)}`
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
        formula: `29991 * ${Math.round(result.tenureRate * 100)}% / ${result.normHours} * ${roundMoney(i.actualHours)} = ${formatCurrency(result.tenurePay)}`
      }
    );
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
  const rows = [
    {
      label: "15 число",
      value: schedule.midMonthPay,
      parts: [
        ["Оклад за години до 15-го", schedule.midMonthParts.base],
        ["1 частина рейтингу", schedule.midMonthParts.rating],
        ...(calculatorType === "supervisor" ? [["WOW-кейси", schedule.midMonthParts.wow]] : [])
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
  const rows = [
    ["Тип", config.title],
    ["Місяць", result.input.month],
    ["Фактичні години", roundMoney(result.input.actualHours)],
    ["Години в розрахунку", roundMoney(result.effectiveHours)],
    ["Зона рейтингу", result.input.ratingZone],
    ["Кваліфікаційний рівень", levelLabel(result.input.level)],
    ["Оклад", formatCurrency(result.input.salary)],
    ["ЗП", formatCurrency(result.basePay)],
    ["Стаж", formatCurrency(result.tenurePay)],
    ["Податки", formatCurrency(result.tax)],
    ["Сума з податком", formatCurrency(result.totalGross)],
    ["Загальна сума до виплати", formatCurrency(result.totalPay)],
    ["15 число", formatCurrency(result.paymentSchedule.midMonthPay)],
    ["31 число", formatCurrency(result.paymentSchedule.monthEndPay)],
    ["07 число", formatCurrency(result.paymentSchedule.nextMonthRatingPay)],
    ["9/10 число стаж", formatCurrency(result.paymentSchedule.tenurePay)],
    ["Середня ЗП за день", formatCurrency(result.absencePayments.averageDailyPay)],
    ["Відпустка/лікарняні/декретні", formatCurrency(result.absencePayments.total)]
  ];

  reportPanel.innerHTML = `
    <div class="report-header">
      <span>Звіт</span>
      <strong>${config.title}</strong>
    </div>
    <div class="report-table">
      ${rows
        .map(
          ([label, value]) => `
            <div>
              <span>${label}</span>
              <strong>${value}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function serviceRows(result) {
  return [
    ["До виплати ЗП", result.basePay],
    ["Нічні", result.nightPay],
    ["Святкові", result.holidayPay],
    ["Оплата X2", result.doublePay],
    ["Монобрат / таксі", result.taxiCompensation],
    [`Премія стаж ${Math.round(result.tenureRate * 100)}%`, result.tenurePay],
    ["Загальна сума до виплати", result.totalPay],
    ["Податок 23%", result.tax],
    ["Сума з податком", result.totalGross]
  ];
}

function supervisorRows(result) {
  return [
    ["Сума ЗП з податком", result.baseGross],
    ["Податок ЗП 23%", result.baseTax],
    ["До виплати ЗП", result.basePay],
    ["WOW-кейси", result.wowBonus],
    [`Стаж з податком ${Math.round(result.tenureRate * 100)}%`, result.tenureGross],
    ["Податок стаж 23%", result.tenureTax],
    ["Стаж чистими", result.tenurePay],
    ["Загальна сума до виплати", result.totalPay],
    ["Сума з податком", result.totalGross]
  ];
}

async function copySummary() {
  if (!calculatorType) return;
  const result = calculatePayroll(readInputs(), calculatorType);
  const config = CALCULATORS[calculatorType];
  const summary = buildTextReport(result, config);

  try {
    await navigator.clipboard.writeText(summary);
    showStatus("Скопійовано в буфер обміну");
  } catch {
    showStatus("Не вдалося скопіювати");
  }
}

function printReport() {
  if (!calculatorType) return;
  window.print();
}

function addScenario() {
  if (!calculatorType || !currentResult) return;
  const scenarios = loadScenarios(calculatorType);
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
  saveScenarios(calculatorType, scenarios);
  renderScenarios();
  showStatus("Сценарій додано");
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
            <span>${scenario.name}</span>
            <strong>${formatCurrency(scenario.totalPay)}</strong>
            <small>${scenario.inputs.month}, зона ${scenario.inputs.ratingZone}, ${roundMoney(scenario.inputs.actualHours)} год</small>
          </div>
          <div class="scenario-delta ${deltaClass}">${deltaLabel}</div>
        </article>
      `;
    })
    .join("");
}

function buildTextReport(result, config) {
  return [
    `${config.title}, ${result.input.month}`,
    `Загальна сума до виплати: ${formatCurrency(result.totalPay)}`,
    `ЗП: ${formatCurrency(result.basePay)}`,
    `Стаж: ${formatCurrency(result.tenurePay)}`,
    `Податки: ${formatCurrency(result.tax)}`,
    `Сума з податком: ${formatCurrency(result.totalGross)}`,
    `15 число: ${formatCurrency(result.paymentSchedule.midMonthPay)}`,
    `31 число: ${formatCurrency(result.paymentSchedule.monthEndPay)}`,
    `07 число: ${formatCurrency(result.paymentSchedule.nextMonthRatingPay)}`,
    `9/10 число стаж: ${formatCurrency(result.paymentSchedule.tenurePay)}`,
    `Середня ЗП за день: ${formatCurrency(result.absencePayments.averageDailyPay)}`,
    `Відпустка/лікарняні/декретні: ${formatCurrency(result.absencePayments.total)}`,
    `Години: ${roundMoney(result.effectiveHours)} / норма ${result.normHours}`,
    `Рейтинг: зона ${result.input.ratingZone}, ${formatCurrency(result.ratingBonus)}`,
    `Рівень: ${levelLabel(result.input.level)}, ${formatCurrency(result.levelBonus)}`
  ].join("\n");
}

function reset() {
  if (!calculatorType) return;
  const defaults = getDefaultInputs(calculatorType);
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
  try {
    const defaults = getDefaultInputs(type);
    const saved = JSON.parse(localStorage.getItem(storageKey(type))) ?? {};
    if (type === "supervisor" && Number(saved.firstHalfHours) === 82.5) {
      saved.firstHalfHours = defaults.firstHalfHours;
    }
    if (saved.secondHalfHours === undefined) {
      saved.secondHalfHours = defaults.secondHalfHours;
    }
    return {
      ...defaults,
      ...saved,
      salary: defaults.salary,
      ratingFirstPart: defaults.ratingFirstPart
    };
  } catch {
    return getDefaultInputs(type);
  }
}

function saveInputs(type, inputs) {
  localStorage.setItem(storageKey(type), JSON.stringify(inputs));
}

function storageKey(type) {
  return `${STORAGE_KEY_PREFIX}-${type}`;
}

function scenarioStorageKey(type) {
  return `${STORAGE_KEY_PREFIX}-scenarios-${type}`;
}

function loadScenarios(type) {
  try {
    return JSON.parse(localStorage.getItem(scenarioStorageKey(type))) ?? [];
  } catch {
    return [];
  }
}

function saveScenarios(type, scenarios) {
  localStorage.setItem(scenarioStorageKey(type), JSON.stringify(scenarios.slice(-6)));
}

function levelLabel(value) {
  return LEVELS.find((level) => level.value === value)?.label ?? value;
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}
