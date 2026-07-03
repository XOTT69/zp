import { LEVELS, MONTHS, PAYROLL_CONFIG } from "./payroll-data.js";

export { LEVELS, MONTHS };

export const CALCULATORS = Object.fromEntries(
  Object.entries(PAYROLL_CONFIG.calculators).map(([key, config]) => [
    key,
    {
      title: config.title,
      shortTitle: config.shortTitle,
      source: config.source
    }
  ])
);

export const DEFAULT_INPUTS_BY_TYPE = Object.fromEntries(
  Object.entries(PAYROLL_CONFIG.calculators).map(([key, config]) => [
    key,
    { ...config.defaultInputs }
  ])
);

export const DEFAULT_INPUTS = DEFAULT_INPUTS_BY_TYPE.service;

export function calculatePayroll(input, calculatorType = "service") {
  return calculatorType === "supervisor"
    ? calculateSupervisorPayroll(input)
    : calculateServicePayroll(input);
}

export function calculateServicePayroll(input) {
  const values = normalizeInputs(input, "service");
  const config = PAYROLL_CONFIG.calculators.service;
  const normHours = getMonthHours(values.month);
  const ratingBonus = config.ratingBonusByZone[values.ratingZone] ?? 0;
  const levelBonus = getServiceLevelBonus(values.level, values.ratingZone);
  const testHours = values.testsHigh ? 1 : 0;
  const effectiveHours = values.actualHours + testHours;

  const nightPay = (values.salary / normHours) * values.nightHours * 0.2;
  const holidayPay = (values.salary / normHours) * values.holidayHours;
  const doublePay = ((values.salary + ratingBonus) / normHours) * values.doubleHours;
  const taxiCompensation = (values.taxiAmount / PAYROLL_CONFIG.taxiDivisor) * 100;

  const basePay =
    ((values.salary + levelBonus + ratingBonus) / normHours) * effectiveHours +
    nightPay +
    holidayPay +
    doublePay -
    values.fines +
    taxiCompensation;

  const tenureRate = values.tenureYears >= 1 ? values.tenureYears * 0.05 : 0;
  const tenurePay = ((config.tenureBase * tenureRate) / normHours) * values.actualHours;
  const totalPay = basePay + tenurePay;
  const tax = totalPay * PAYROLL_CONFIG.taxRate;

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
    wowBonus: 0,
    basePay,
    baseGross: basePay,
    baseTax: basePay * PAYROLL_CONFIG.taxRate,
    tenureRate,
    tenurePay,
    tenureGross: tenurePay,
    tenureTax: tenurePay * PAYROLL_CONFIG.taxRate,
    totalPay,
    tax,
    baseNet: basePay,
    tenureNet: tenurePay,
    totalGross: totalPay,
    totalTax: tax,
    totalNet: totalPay
  };
}

export function calculateSupervisorPayroll(input) {
  const values = normalizeInputs(input, "supervisor");
  const config = PAYROLL_CONFIG.calculators.supervisor;
  const normHours = getMonthHours(values.month);
  const ratingBonus = config.ratingBonusByZone[values.ratingZone] ?? 0;
  const levelBonus = getSupervisorLevelBonus(values.level, values.ratingZone);
  const testHours = values.testsHigh ? 1 : 0;
  const effectiveHours = values.actualHours + testHours;

  const nightPay = (values.salary / normHours) * values.nightHours * 0.2;
  const holidayPay = (values.salary / normHours) * values.holidayHours;
  const doublePay = ((values.salary + ratingBonus) / normHours) * values.doubleHours;
  const wowBonus = Math.min(PAYROLL_CONFIG.maxWowCases, Math.max(0, values.wowCases)) * config.wowCaseRate;
  const taxiCompensation = (values.taxiAmount / PAYROLL_CONFIG.taxiDivisor) * 100;

  const baseGross =
    ((values.salary + levelBonus + ratingBonus) / normHours) * effectiveHours +
    nightPay +
    holidayPay +
    doublePay +
    taxiCompensation -
    values.fines;
  const baseTax = baseGross * PAYROLL_CONFIG.taxRate;
  const basePay = baseGross - baseTax + wowBonus;

  const tenureRate = values.tenureYears >= 1 ? values.tenureYears * 0.05 : 0;
  const tenureGross = ((config.tenureBase * tenureRate) / normHours) * effectiveHours;
  const tenureTax = tenureGross * PAYROLL_CONFIG.taxRate;
  const tenurePay = tenureGross - tenureTax;
  const totalPay = basePay + tenurePay;
  const tax = baseTax + tenureTax;

  return {
    calculatorType: "supervisor",
    input: values,
    normHours,
    effectiveHours,
    testHours,
    ratingBonus,
    levelBonus,
    nightPay,
    holidayPay,
    doublePay,
    wowBonus,
    taxiCompensation,
    baseGross,
    baseTax,
    basePay,
    baseNet: basePay,
    tenureRate,
    tenureGross,
    tenureTax,
    tenurePay,
    tenureNet: tenurePay,
    totalGross: baseGross + tenureGross,
    totalTax: tax,
    totalPay,
    totalNet: totalPay,
    tax
  };
}

export function getMonthHours(month) {
  return MONTHS.find((item) => item.name === month)?.hours ?? 165;
}

export function getServiceLevelBonus(level, ratingZone) {
  const rules = PAYROLL_CONFIG.calculators.service.levelBonusRules;
  return getLevelBonusFromRules(level, ratingZone, rules);
}

export function getSupervisorLevelBonus(level, ratingZone) {
  const rules = PAYROLL_CONFIG.calculators.supervisor.levelBonusRules;
  return getLevelBonusFromRules(level, ratingZone, rules);
}

function getLevelBonusFromRules(level, ratingZone, rules) {
  if (level === "level2" && ratingZone < rules.level2.maxZoneExclusive) {
    return rules.level2.amount;
  }

  if (level === "level3" && ratingZone < 3) {
    return rules.level3.underZone3;
  }

  if (level === "level3" && ratingZone === 3) {
    return rules.level3.zone3;
  }

  return 0;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(roundMoney(value));
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function getDefaultInputs(calculatorType = "service") {
  return { ...DEFAULT_INPUTS_BY_TYPE[calculatorType] };
}

function normalizeInputs(input, calculatorType) {
  const defaults = getDefaultInputs(calculatorType);
  return {
    month: input.month || defaults.month,
    actualHours: toNumber(input.actualHours),
    testsHigh: Boolean(input.testsHigh),
    ratingZone: Math.min(PAYROLL_CONFIG.maxRatingZone, Math.max(1, Math.round(toNumber(input.ratingZone) || 1))),
    level: input.level || defaults.level,
    salary: toNumber(input.salary),
    nightHours: toNumber(input.nightHours),
    holidayHours: toNumber(input.holidayHours),
    doubleHours: toNumber(input.doubleHours),
    wowCases: Math.min(PAYROLL_CONFIG.maxWowCases, Math.max(0, Math.round(toNumber(input.wowCases)))),
    fines: toNumber(input.fines),
    taxiAmount: toNumber(input.taxiAmount),
    tenureYears: Math.max(0, Math.floor(toNumber(input.tenureYears)))
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
