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
  const baseGross = basePay / (1 - PAYROLL_CONFIG.taxRate);
  const baseTax = baseGross - basePay;
  const tenureGross = tenurePay / (1 - PAYROLL_CONFIG.taxRate);
  const tenureTax = tenureGross - tenurePay;
  const totalGross = baseGross + tenureGross;
  const tax = baseTax + tenureTax;
  const paymentSchedule = calculatePaymentSchedule(values, {
    normHours,
    effectiveHours,
    ratingBonus,
    levelBonus,
    nightPay,
    holidayPay,
    doublePay,
    taxiCompensation,
    fines: values.fines,
    tenurePay,
    wowBonus: 0,
    isGrossMode: false
  });
  const absencePayments = calculateAbsencePayments(values);

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
    baseGross,
    baseTax,
    tenureRate,
    tenurePay,
    tenureGross,
    tenureTax,
    totalPay,
    tax,
    baseNet: basePay,
    tenureNet: tenurePay,
    totalGross,
    totalTax: tax,
    totalNet: totalPay,
    paymentSchedule,
    absencePayments
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
  const paymentSchedule = calculatePaymentSchedule(values, {
    normHours,
    effectiveHours,
    ratingBonus,
    levelBonus,
    nightPay,
    holidayPay,
    doublePay,
    taxiCompensation,
    fines: values.fines,
    tenurePay,
    wowBonus,
    isGrossMode: true
  });
  const absencePayments = calculateAbsencePayments(values);

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
    tax,
    paymentSchedule,
    absencePayments
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
    tenureYears: Math.max(0, Math.floor(toNumber(input.tenureYears))),
    firstHalfHours: Math.max(0, toNumber(valueOrDefault(input.firstHalfHours, defaults.firstHalfHours))),
    ratingFirstPart: Math.max(0, toNumber(valueOrDefault(input.ratingFirstPart, defaults.ratingFirstPart))),
    averageDailyPay: Math.max(0, toNumber(input.averageDailyPay)),
    vacationDays: Math.max(0, toNumber(input.vacationDays)),
    sickDays: Math.max(0, toNumber(input.sickDays)),
    sickInsuranceRate: Math.min(1, Math.max(0, toNumber(valueOrDefault(input.sickInsuranceRate, defaults.sickInsuranceRate)))),
    maternityDays: Math.max(0, toNumber(input.maternityDays))
  };
}

function calculatePaymentSchedule(values, parts) {
  const taxMultiplier = parts.isGrossMode ? 1 - PAYROLL_CONFIG.taxRate : 1;
  const firstHalfHours = Math.min(values.firstHalfHours, parts.effectiveHours);
  const fullHalfHours = parts.normHours / 2;
  const fixedWorked = (values.salary / parts.normHours) * parts.effectiveHours * taxMultiplier;
  const fixedAdvance = Math.min(
    fixedWorked,
    (values.salary / parts.normHours) * firstHalfHours * taxMultiplier
  );
  const fixedMonthEndTarget = (values.salary / parts.normHours) * fullHalfHours * taxMultiplier;
  const fixedMonthEnd = Math.min(Math.max(0, fixedWorked - fixedAdvance), fixedMonthEndTarget);
  const fixedSettlement = Math.max(0, fixedWorked - fixedAdvance - fixedMonthEnd);
  const ratingWorked = (parts.ratingBonus / parts.normHours) * parts.effectiveHours * taxMultiplier;
  const ratingFirstPart = Math.min(values.ratingFirstPart, ratingWorked);
  const ratingSecondPart = Math.max(0, ratingWorked - ratingFirstPart);
  const levelPay = (parts.levelBonus / parts.normHours) * parts.effectiveHours * taxMultiplier;
  const extras = parts.nightPay + parts.holidayPay + parts.doublePay + parts.taxiCompensation - parts.fines + parts.wowBonus;
  const nextMonthRatingPay = ratingSecondPart + levelPay + extras + fixedSettlement;
  const midMonthPay = fixedAdvance + ratingFirstPart;
  const monthEndPay = fixedMonthEnd;

  return {
    midMonthPay,
    monthEndPay,
    nextMonthRatingPay,
    tenurePay: parts.tenurePay,
    estimatedTotal: midMonthPay + monthEndPay + nextMonthRatingPay + parts.tenurePay,
    fixedAdvance,
    fixedMonthEnd,
    fixedSettlement,
    ratingFirstPart,
    ratingSecondPart,
    levelPay,
    extras
  };
}

function calculateAbsencePayments(values) {
  const sickPay = values.averageDailyPay * values.sickInsuranceRate * values.sickDays;
  const vacationPay = values.averageDailyPay * values.vacationDays;
  const maternityPay = values.averageDailyPay * values.maternityDays;

  return {
    sickPay,
    vacationPay,
    maternityPay,
    total: sickPay + vacationPay + maternityPay
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function valueOrDefault(value, fallback) {
  return value === undefined || value === null || value === "" ? fallback : value;
}
