import {
  CALCULATORS,
  LEVELS,
  MONTHS,
  calculatePayroll,
  formatCurrency,
  getDefaultInputs,
  roundMoney
} from "./calculator.js";

const STORAGE_KEY_PREFIX = "zp-2-2-calculator-inputs";
const form = document.querySelector("#calculatorForm");
const monthSelect = document.querySelector("#month");
const levelSelect = document.querySelector("#level");
const ratingZoneGroup = document.querySelector("#ratingZoneGroup");
const statusMessage = document.querySelector("#statusMessage");
const homeView = document.querySelector("#homeView");
const calculatorView = document.querySelector("#calculatorView");
const summaryStrip = document.querySelector("#summaryStrip");
const homeButton = document.querySelector("#homeButton");
const resetButton = document.querySelector("#resetButton");
const copyButton = document.querySelector("#copyButton");
const printButton = document.querySelector("#printButton");
const addScenarioButton = document.querySelector("#addScenarioButton");
const clearScenariosButton = document.querySelector("#clearScenariosButton");
const scenarioList = document.querySelector("#scenarioList");
const validationMessages = document.querySelector("#validationMessages");
const formulaList = document.querySelector("#formulaList");
const reportPanel = document.querySelector("#reportPanel");

let calculatorType = getRouteType();
let selectedRatingZone = getDefaultInputs(calculatorType || "service").ratingZone;
let currentResult = null;

init();

function init() {
  renderSelects();
  renderRoute();

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  ratingZoneGroup.addEventListener("click", handleRatingClick);
  resetButton.addEventListener("click", reset);
  copyButton.addEventListener("click", copySummary);
  printButton.addEventListener("click", printReport);
  addScenarioButton.addEventListener("click", addScenario);
  clearScenariosButton.addEventListener("click", clearScenarios);
  homeButton.addEventListener("click", () => {
    window.location.hash = "";
  });
  window.addEventListener("hashchange", renderRoute);
}

function renderRoute() {
  calculatorType = getRouteType();
  const isHome = calculatorType === null;

  homeView.hidden = !isHome;
  calculatorView.hidden = isHome;
  summaryStrip.hidden = isHome;
  resetButton.hidden = isHome;
  copyButton.hidden = isHome;
  printButton.hidden = isHome;
  homeButton.hidden = isHome;

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
  const isSupervisor = calculatorType === "supervisor";
  setText("#totalMainLabel", "Загальна сума до виплати");
  setText("#totalGrossLabel", isSupervisor ? "Сума з податком" : "До виплати ЗП + стаж");
  setText("#totalTaxLabel", isSupervisor ? "Податки 23%" : "Податок 23%");
  setText("#baseResultLabel", isSupervisor ? "ЗП чистими" : "До виплати ЗП");
  setText("#tenureResultLabel", isSupervisor ? "Стаж чистими" : "Премія стаж");
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
  renderReport(result);
  renderScenarios();
}

function readInputs() {
  const data = new FormData(form);
  return {
    month: data.get("month"),
    actualHours: data.get("actualHours"),
    testsHigh: form.elements.testsHigh.checked,
    ratingZone: selectedRatingZone,
    level: data.get("level"),
    salary: data.get("salary"),
    nightHours: data.get("nightHours"),
    holidayHours: data.get("holidayHours"),
    doubleHours: data.get("doubleHours"),
    wowCases: data.get("wowCases"),
    fines: data.get("fines"),
    taxiAmount: data.get("taxiAmount"),
    tenureYears: data.get("tenureYears")
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
    ["Загальна сума до виплати", formatCurrency(result.totalPay)]
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
    ["Податок 23%", result.tax]
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
    ["Загальна сума до виплати", result.totalPay]
  ];
}

async function copySummary() {
  if (!calculatorType) return;
  const result = calculatePayroll(readInputs(), calculatorType);
  const config = CALCULATORS[calculatorType];
  const summary = buildTextReport(result, config);

  try {
    await navigator.clipboard.writeText(summary);
    showStatus("Скопійовано");
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
  window.clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = window.setTimeout(() => {
    statusMessage.textContent = "";
  }, 2200);
}

function loadInputs(type) {
  try {
    return { ...getDefaultInputs(type), ...JSON.parse(localStorage.getItem(storageKey(type))) };
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
