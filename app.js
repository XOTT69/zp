import {
  DEFAULT_INPUTS,
  LEVELS,
  MONTHS,
  calculatePayroll,
  formatCurrency,
  roundMoney
} from "./calculator.js";

const STORAGE_KEY = "zp-2-2-calculator-inputs";
const form = document.querySelector("#calculatorForm");
const monthSelect = document.querySelector("#month");
const levelSelect = document.querySelector("#level");
const ratingZoneGroup = document.querySelector("#ratingZoneGroup");
const statusMessage = document.querySelector("#statusMessage");

let selectedRatingZone = DEFAULT_INPUTS.ratingZone;

init();

function init() {
  renderSelects();
  const savedInputs = loadInputs();
  selectedRatingZone = savedInputs.ratingZone;
  fillForm(savedInputs);
  renderRatingButtons(selectedRatingZone);
  update();

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  ratingZoneGroup.addEventListener("click", handleRatingClick);
  document.querySelector("#resetButton").addEventListener("click", reset);
  document.querySelector("#copyButton").addEventListener("click", copySummary);
}

function renderSelects() {
  monthSelect.innerHTML = MONTHS.map(
    (month) => `<option value="${month.name}">${month.name}</option>`
  ).join("");

  levelSelect.innerHTML = LEVELS.map(
    (level) => `<option value="${level.value}">${level.label}</option>`
  ).join("");
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
  const inputs = readInputs();
  const result = calculatePayroll(inputs);
  saveInputs(inputs);
  renderResult(result);
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
    fines: data.get("fines"),
    taxiAmount: data.get("taxiAmount"),
    tenureYears: data.get("tenureYears")
  };
}

function renderResult(result) {
  setText("#totalNet", formatCurrency(result.totalNet));
  setText("#totalGross", formatCurrency(result.totalGross));
  setText("#totalTax", formatCurrency(result.totalTax));
  setText("#monthNorm", `${result.normHours} год`);
  setText("#effectiveHours", roundMoney(result.effectiveHours));
  setText("#baseNet", formatCurrency(result.baseNet));
  setText("#tenureNet", formatCurrency(result.tenureNet));
  setText("#ratingBonus", formatCurrency(result.ratingBonus));
  setText("#levelBonus", formatCurrency(result.levelBonus));

  const rows = [
    ["До виплати ЗП", result.basePay],
    ["Нічні", result.nightPay],
    ["Святкові", result.holidayPay],
    ["Оплата X2", result.doublePay],
    ["Монобрат / таксі", result.taxiCompensation],
    [`Премія стаж ${Math.round(result.tenureRate * 100)}%`, result.tenurePay],
    ["Загальна сума до виплати", result.totalPay],
    ["Податок 23%", result.tax]
  ];

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

async function copySummary() {
  const result = calculatePayroll(readInputs());
  const summary = [
    `Калькулятор ЗП 2/2, ${result.input.month}`,
    `Загальна сума до виплати: ${formatCurrency(result.totalPay)}`,
    `ЗП: ${formatCurrency(result.basePay)}`,
    `Стаж: ${formatCurrency(result.tenurePay)}`,
    `Податок 23%: ${formatCurrency(result.tax)}`,
    `Години: ${roundMoney(result.effectiveHours)} / норма ${result.normHours}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(summary);
    showStatus("Скопійовано");
  } catch {
    showStatus("Не вдалося скопіювати");
  }
}

function reset() {
  selectedRatingZone = DEFAULT_INPUTS.ratingZone;
  fillForm(DEFAULT_INPUTS);
  renderRatingButtons(selectedRatingZone);
  saveInputs(DEFAULT_INPUTS);
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

function loadInputs() {
  try {
    return { ...DEFAULT_INPUTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return DEFAULT_INPUTS;
  }
}

function saveInputs(inputs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}
