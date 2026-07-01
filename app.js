import { CONFIG, calculateSalary, roundMoney } from './calculator.js';

const STORAGE_KEY = 'zp-22-calculator-state-v1';
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const form = $('#salary-form');
const monthSelect = $('#month');
const resetButton = $('#reset-button');
const tablePresetButton = $('#table-preset-button');
const fullMonthButton = $('#full-month-button');
const copyButton = $('#copy-button');
const resultToast = $('#result-toast');

const fields = [
  'month',
  'actualHours',
  'testsAbove80',
  'ratingZone',
  'qualificationLevel',
  'baseSalary',
  'nightHours',
  'holidayHours',
  'x2Hours',
  'fines',
  'compensationInput',
  'tenureYears',
  'tenureMode',
  'taxRate',
  'compensationDivisor',
];

const state = loadState();
init();

function init() {
  Object.entries(CONFIG.months).forEach(([month, hours]) => {
    const option = document.createElement('option');
    option.value = month;
    option.textContent = `${month} · ${hours} год`;
    monthSelect.appendChild(option);
  });

  applyStateToForm(state);
  form.addEventListener('input', handleInput);
  form.addEventListener('change', handleInput);
  resetButton.addEventListener('click', () => setState(CONFIG.defaultInput));
  tablePresetButton.addEventListener('click', () => setState(CONFIG.defaultInput));
  fullMonthButton.addEventListener('click', () => setState({
    ...CONFIG.defaultInput,
    actualHours: CONFIG.months[state.month || CONFIG.defaultInput.month],
    testsAbove80: false,
    nightHours: 0,
    holidayHours: 0,
    x2Hours: 0,
    tenureYears: 0,
  }));
  copyButton.addEventListener('click', copySummary);
  render();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...CONFIG.defaultInput, ...(saved || {}) };
  } catch {
    return { ...CONFIG.defaultInput };
  }
}

function saveState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function setState(nextState) {
  Object.assign(state, nextState);
  applyStateToForm(state);
  saveState(state);
  render();
}

function applyStateToForm(nextState) {
  fields.forEach((name) => {
    const input = form.elements[name];
    if (!input) return;
    if (input.type === 'checkbox') {
      input.checked = Boolean(nextState[name]);
    } else {
      input.value = nextState[name];
    }
  });
}

function collectFormState() {
  fields.forEach((name) => {
    const input = form.elements[name];
    if (!input) return;
    state[name] = input.type === 'checkbox' ? input.checked : input.value;
  });
  return state;
}

function handleInput() {
  collectFormState();
  saveState(state);
  render();
}

function formatMoney(value) {
  return moneyFormatter.format(roundMoney(value));
}

function formatNumber(value) {
  return numberFormatter.format(roundMoney(value));
}

function render() {
  const result = calculateSalary(collectFormState());
  renderKpis(result);
  renderLookup(result);
  renderBreakdown(result);
  renderFormula(result);
  renderBars(result);
  renderNotes(result);
}

function renderKpis(result) {
  $('#total-net').textContent = formatMoney(result.totalNet);
  $('#salary-net').textContent = formatMoney(result.salaryNetBeforeTenure);
  $('#tenure-net').textContent = formatMoney(result.tenurePay);
  $('#tax-amount').textContent = formatMoney(result.taxAmount);
  $('#gross-reference').textContent = formatMoney(result.grossReference);
  $('#hourly-rate').textContent = `${formatMoney(result.hourlyFull)} / год`;
}

function renderLookup(result) {
  $('#norm-hours').textContent = `${formatNumber(result.normHours)} год`;
  $('#paid-hours').textContent = `${formatNumber(result.paidHours)} год`;
  $('#test-bonus-hours').textContent = result.testBonusHours ? '+1 год' : '0 год';
  $('#rating-bonus').textContent = formatMoney(result.ratingBonus);
  $('#qualification-bonus').textContent = formatMoney(result.qualificationBonus);
  $('#tenure-rate').textContent = `${formatNumber(result.tenureRate * 100)}%`;
}

function renderBreakdown(result) {
  const tbody = $('#breakdown-body');
  tbody.innerHTML = '';

  result.parts.forEach((part) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${part.label}</td>
      <td class="numeric ${part.value < 0 ? 'negative' : ''}">${formatMoney(part.value)}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderFormula(result) {
  const formulaList = $('#formula-list');
  const i = result.input;
  const qualificationText = qualificationLabel(i.qualificationLevel);
  const tenureModeText = i.tenureMode === 'sheetFixed'
    ? `фіксована база з активного аркуша: ${formatMoney(CONFIG.sheetFixedTenureBase)}`
    : 'динамічно: оклад + рейтинг + кваліфікація';

  const rows = [
    ['Місяць і норма', `${i.month}: ${formatNumber(result.normHours)} год`],
    ['Оплачувані години', `${formatNumber(i.actualHours)} + ${result.testBonusHours} = ${formatNumber(result.paidHours)} год`],
    ['Рейтинг', `Зона ${i.ratingZone}: ${formatMoney(result.ratingBonus)}`],
    ['Кваліфікація', `${qualificationText}: ${formatMoney(result.qualificationBonus)}`],
    ['Погодинна база', `(${formatMoney(i.baseSalary)} + ${formatMoney(result.ratingBonus)} + ${formatMoney(result.qualificationBonus)}) / ${formatNumber(result.normHours)} = ${formatMoney(result.hourlyFull)}`],
    ['Основне нарахування', `${formatMoney(result.hourlyFull)} × ${formatNumber(result.paidHours)} = ${formatMoney(result.baseAccrual)}`],
    ['Нічні', `${formatMoney(i.baseSalary)} / ${formatNumber(result.normHours)} × ${formatNumber(i.nightHours)} × 20% = ${formatMoney(result.nightPay)}`],
    ['Святкові', `${formatMoney(i.baseSalary)} / ${formatNumber(result.normHours)} × ${formatNumber(i.holidayHours)} = ${formatMoney(result.holidayPay)}`],
    ['Оплата Х2', `(${formatMoney(i.baseSalary)} + ${formatMoney(result.ratingBonus)}) / ${formatNumber(result.normHours)} × ${formatNumber(i.x2Hours)} = ${formatMoney(result.x2Pay)}`],
    ['Монобрат/таксі', `${formatMoney(i.compensationInput)} / ${formatNumber(i.compensationDivisor)} × 100 = ${formatMoney(result.compensationGrossed)}`],
    ['Штрафи', `− ${formatMoney(i.fines)}`],
    ['Стаж', `${result.tenureYears} р. × 5%, база: ${tenureModeText}; результат: ${formatMoney(result.tenurePay)}`],
    ['Податок для довідки', `${formatMoney(result.totalNet)} × ${formatNumber(i.taxRatePercent)}% = ${formatMoney(result.taxAmount)}`],
  ];

  formulaList.innerHTML = rows.map(([term, value]) => `
    <div class="formula-row">
      <span>${term}</span>
      <strong>${value}</strong>
    </div>
  `).join('');
}

function renderBars(result) {
  const chart = $('#parts-chart');
  const positiveParts = result.parts.filter((part) => part.value > 0);
  const max = Math.max(...positiveParts.map((part) => part.value), 1);

  chart.innerHTML = result.parts.map((part) => {
    const width = part.value > 0 ? Math.max(3, (part.value / max) * 100) : 0;
    return `
      <div class="bar-row">
        <div class="bar-label">${part.label}</div>
        <div class="bar-track">
          <div class="bar-fill ${part.value < 0 ? 'bar-negative' : ''}" style="width:${width}%"></div>
        </div>
        <div class="bar-value ${part.value < 0 ? 'negative' : ''}">${formatMoney(part.value)}</div>
      </div>
    `;
  }).join('');
}

function renderNotes(result) {
  const warnings = [];
  if (result.paidHours > result.normHours) {
    warnings.push(`Оплачувані години більші за норму місяця на ${formatNumber(result.paidHours - result.normHours)} год.`);
  }
  if (result.input.qualificationLevel === '2' && result.input.ratingZone >= 4) {
    warnings.push('2-й рівень у зоні 4–5 за формулою таблиці не додає кваліфікаційну доплату.');
  }
  if (result.input.qualificationLevel === '3' && result.input.ratingZone >= 4) {
    warnings.push('3-й рівень у зоні 4–5 за формулою таблиці не додає кваліфікаційну доплату.');
  }
  if (result.input.tenureYears > 0 && result.input.tenureMode === 'sheetFixed') {
    warnings.push('Увімкнено режим стажу «як в активному аркуші» — база стажу фіксована 29 991 грн, навіть якщо змінити рейтинг чи рівень.');
  }

  $('#warnings').innerHTML = warnings.length
    ? warnings.map((item) => `<li>${item}</li>`).join('')
    : '<li>Критичних попереджень немає — розрахунок виглядає логічно.</li>';
}

function qualificationLabel(level) {
  if (String(level) === '1') return '1-й рівень';
  if (String(level) === '2') return '2-й рівень';
  if (String(level) === '3') return '3-й рівень';
  return '—';
}

async function copySummary() {
  const result = calculateSalary(collectFormState());
  const text = [
    'Розрахунок ЗП 2/2',
    `Місяць: ${result.input.month}`,
    `Години: ${formatNumber(result.input.actualHours)} + тест ${result.testBonusHours} = ${formatNumber(result.paidHours)}`,
    `Зона рейтингу: ${result.input.ratingZone} (${formatMoney(result.ratingBonus)})`,
    `Кваліфікація: ${qualificationLabel(result.input.qualificationLevel)} (${formatMoney(result.qualificationBonus)})`,
    `До виплати без стажу: ${formatMoney(result.salaryNetBeforeTenure)}`,
    `Премія стаж: ${formatMoney(result.tenurePay)}`,
    `Загальна сума до виплати: ${formatMoney(result.totalNet)}`,
    `Податок для довідки: ${formatMoney(result.taxAmount)}`,
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    showToast('Розрахунок скопійовано');
  } catch {
    showToast('Не вийшло скопіювати автоматично');
  }
}

function showToast(message) {
  resultToast.textContent = message;
  resultToast.classList.add('is-visible');
  setTimeout(() => resultToast.classList.remove('is-visible'), 1800);
}
