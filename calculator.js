export const MONTHS = [
  { name: "Січень", hours: 165 },
  { name: "Лютий", hours: 154 },
  { name: "Березень", hours: 165 },
  { name: "Квітень", hours: 165 },
  { name: "Травень", hours: 165 },
  { name: "Червень", hours: 165 },
  { name: "Липень", hours: 165 },
  { name: "Серпень", hours: 165 },
  { name: "Вересень", hours: 165 },
  { name: "Жовтень", hours: 165 },
  { name: "Листопад", hours: 165 },
  { name: "Грудень", hours: 165 }
];

export const LEVELS = [
  { value: "level1", label: "1-й рівень" },
  { value: "level2", label: "2-й рівень" },
  { value: "level3", label: "3-й рівень" }
];

export const DEFAULT_INPUTS = {
  month: "Липень",
  actualHours: 187,
  testsHigh: true,
  ratingZone: 1,
  level: "level3",
  salary: 12497,
  nightHours: 20,
  holidayHours: 0,
  doubleHours: 13.5,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 5
};

const RATING_BONUS_BY_ZONE = {
  1: 23062,
  2: 20290,
  3: 17494,
  4: 14715,
  5: 11935
};

const TENURE_BASE = 29991;
const PAYROLL_TAX_RATE = 0.23;
const TAXI_DIVISOR = 80.5;

export function calculatePayroll(input) {
  const values = normalizeInputs(input);
  const normHours = getMonthHours(values.month);
  const ratingBonus = RATING_BONUS_BY_ZONE[values.ratingZone] ?? 0;
  const levelBonus = getLevelBonus(values.level, values.ratingZone);
  const testHours = values.testsHigh ? 1 : 0;
  const effectiveHours = values.actualHours + testHours;

  const nightPay = (values.salary / normHours) * values.nightHours * 0.2;
  const holidayPay = (values.salary / normHours) * values.holidayHours;
  const doublePay = ((values.salary + ratingBonus) / normHours) * values.doubleHours;
  const taxiCompensation = (values.taxiAmount / TAXI_DIVISOR) * 100;

  const basePay =
    ((values.salary + levelBonus + ratingBonus) / normHours) * effectiveHours +
    nightPay +
    holidayPay +
    doublePay -
    values.fines +
    taxiCompensation;

  const tenureRate = values.tenureYears >= 1 ? values.tenureYears * 0.05 : 0;
  const tenurePay = ((TENURE_BASE * tenureRate) / normHours) * values.actualHours;
  const totalPay = basePay + tenurePay;
  const tax = totalPay * PAYROLL_TAX_RATE;

  return {
    input: values,
    normHours,
    effectiveHours,
    testHours,
    ratingBonus,
    levelBonus,
    nightPay,
    holidayPay,
    doublePay,
    taxiCompensation,
    basePay,
    tenureRate,
    tenurePay,
    totalPay,
    tax,
    baseGross: basePay,
    baseTax: basePay * PAYROLL_TAX_RATE,
    baseNet: basePay,
    tenureGross: tenurePay,
    tenureTax: tenurePay * PAYROLL_TAX_RATE,
    tenureNet: tenurePay,
    totalGross: totalPay,
    totalTax: tax,
    totalNet: totalPay
  };
}

export function getMonthHours(month) {
  return MONTHS.find((item) => item.name === month)?.hours ?? 165;
}

export function getLevelBonus(level, ratingZone) {
  if (level === "level2" && ratingZone < 4) {
    return 2787;
  }

  if (level === "level3" && ratingZone < 3) {
    return 5574;
  }

  if (level === "level3" && ratingZone === 3) {
    return 2787;
  }

  return 0;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 0
  }).format(roundMoney(value));
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeInputs(input) {
  return {
    month: input.month || DEFAULT_INPUTS.month,
    actualHours: toNumber(input.actualHours),
    testsHigh: Boolean(input.testsHigh),
    ratingZone: Math.min(5, Math.max(1, Math.round(toNumber(input.ratingZone) || 1))),
    level: input.level || DEFAULT_INPUTS.level,
    salary: toNumber(input.salary),
    nightHours: toNumber(input.nightHours),
    holidayHours: toNumber(input.holidayHours),
    doubleHours: toNumber(input.doubleHours),
    fines: toNumber(input.fines),
    taxiAmount: toNumber(input.taxiAmount),
    tenureYears: Math.max(0, Math.floor(toNumber(input.tenureYears)))
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
