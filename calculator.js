export let LEVELS = [];
export let MONTHS = [];
export let CALCULATORS = {};
export let DEFAULT_INPUTS_BY_TYPE = {};
export let DEFAULT_INPUTS = {};

let PAYROLL_CONFIG = {
  defaultTaxRate: 0.23,
  taxiDivisor: 80.5,
  maxRatingZone: 5,
  maxWowCases: 5,
  calculators: {}
};

export function configurePayrollData(payload) {
  MONTHS = payload.months ?? [];
  LEVELS = payload.levels ?? [];
  PAYROLL_CONFIG = payload.config ?? PAYROLL_CONFIG;
  CALCULATORS = Object.fromEntries(
    Object.entries(PAYROLL_CONFIG.calculators).map(([key, config]) => [
      key,
      {
        title: config.title,
        shortTitle: config.shortTitle,
        source: config.source,
        taxMode: config.taxMode,
        taxRate: getTaxRate(config),
        hasWow: Boolean(config.wowCaseRate)
      }
    ])
  );
  DEFAULT_INPUTS_BY_TYPE = Object.fromEntries(
    Object.entries(PAYROLL_CONFIG.calculators).map(([key, config]) => [
      key,
      { ...config.defaultInputs }
    ])
  );
  DEFAULT_INPUTS = DEFAULT_INPUTS_BY_TYPE.service ?? Object.values(DEFAULT_INPUTS_BY_TYPE)[0] ?? {};
}

/**
 * Calculates payroll for the selected calculator type.
 *
 * @param {object} input - Raw form values.
 * @param {string} calculatorType - Key from PAYROLL_CONFIG.calculators.
 * @returns {object} Payroll totals, taxes, breakdown rows and payment schedule.
 */
export function calculatePayroll(input, calculatorType = "service") {
  const config = PAYROLL_CONFIG.calculators[calculatorType] ?? PAYROLL_CONFIG.calculators.service;
  return config.taxMode === "gross"
    ? calculateSupervisorPayroll(input, calculatorType)
    : calculateServicePayroll(input, calculatorType);
}

/**
 * Calculates a net-input payroll where configured salary, rating and bonuses are already net amounts.
 *
 * @param {object} input - Raw form values.
 * @param {string} calculatorType - Net calculator key, defaults to service.
 * @returns {object} Payroll result with net total, estimated gross and tax values.
 */
export function calculateServicePayroll(input, calculatorType = "service") {
  const values = normalizeInputs(input, calculatorType);
  const config = PAYROLL_CONFIG.calculators[calculatorType];
  const taxRate = getTaxRate(config);
  const normHours = getMonthHours(values.month);
  const ratingBonus = config.ratingBonusByZone[values.ratingZone] ?? 0;
  const levelBonus = getLevelBonus(values.level, values.ratingZone, calculatorType);
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
  const baseGross = basePay / (1 - taxRate);
  const baseTax = baseGross - basePay;
  const tenureGross = tenurePay / (1 - taxRate);
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
    isGrossMode: false,
    taxRate,
    paymentHourlyRates: config.paymentHourlyRates
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

/**
 * Calculates a gross-input payroll where tax is deducted from salary, rating and bonuses.
 *
 * @param {object} input - Raw form values.
 * @param {string} calculatorType - Gross calculator key, defaults to supervisor.
 * @returns {object} Payroll result with gross, tax, net totals and payment schedule.
 */
export function calculateSupervisorPayroll(input, calculatorType = "supervisor") {
  const values = normalizeInputs(input, calculatorType);
  const config = PAYROLL_CONFIG.calculators[calculatorType];
  const taxRate = getTaxRate(config);
  const normHours = getMonthHours(values.month);
  const ratingBonus = config.ratingBonusByZone[values.ratingZone] ?? 0;
  const levelBonus = getLevelBonus(values.level, values.ratingZone, calculatorType);
  const testHours = values.testsHigh ? 1 : 0;
  const effectiveHours = values.actualHours + testHours;

  const nightPay = (values.salary / normHours) * values.nightHours * 0.2;
  const holidayPay = (values.salary / normHours) * values.holidayHours;
  const doublePay = ((values.salary + ratingBonus) / normHours) * values.doubleHours;
  const wowBonus = Math.min(PAYROLL_CONFIG.maxWowCases, Math.max(0, values.wowCases)) * (config.wowCaseRate ?? 0);
  const taxiCompensation = (values.taxiAmount / PAYROLL_CONFIG.taxiDivisor) * 100;

  const baseGross =
    ((values.salary + levelBonus + ratingBonus) / normHours) * effectiveHours +
    nightPay +
    holidayPay +
    doublePay +
    taxiCompensation -
    values.fines;
  const baseTax = baseGross * taxRate;
  const basePay = baseGross - baseTax + wowBonus;

  const tenureRate = values.tenureYears >= 1 ? values.tenureYears * 0.05 : 0;
  const tenureBasePay = config.tenureTaxMode === "netPlusTaxOnNet"
    ? config.tenureBase * tenureRate
    : ((config.tenureBase * tenureRate) / normHours) * effectiveHours;
  const tenureTax = tenureBasePay * taxRate;
  const tenureGross = config.tenureTaxMode === "netPlusTaxOnNet"
    ? tenureBasePay + tenureTax
    : tenureBasePay;
  const tenurePay = config.tenureTaxMode === "netPlusTaxOnNet"
    ? tenureBasePay
    : tenureGross - tenureTax;
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
    isGrossMode: true,
    taxRate,
    paymentHourlyRates: config.paymentHourlyRates
  });
  const absencePayments = calculateAbsencePayments(values);

  return {
    calculatorType,
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
  return getLevelBonus(level, ratingZone, "service");
}

export function getSupervisorLevelBonus(level, ratingZone) {
  return getLevelBonus(level, ratingZone, "supervisor");
}

export function getLevelBonus(level, ratingZone, calculatorType = "service") {
  const rules = PAYROLL_CONFIG.calculators[calculatorType]?.levelBonusRules;
  if (!rules) return 0;
  return getLevelBonusFromRules(level, ratingZone, rules);
}

function getLevelBonusFromRules(level, ratingZone, rules) {
  if (!rules.level2 || !rules.level3) return 0;

  if (level === "level2" && ratingZone < rules.level2.maxZoneExclusive) {
    return rules.level2.amount;
  }

  if (level === "level3" && ratingZone < 3) {
    return rules.level3.underZone3;
  }

  if (level === "level3" && ratingZone === 3) {
    return rules.level3.zone3;
  }

  // For level 3 in rating zones 4-5 the source sheets intentionally do not add a level bonus.
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
  return { ...(DEFAULT_INPUTS_BY_TYPE[calculatorType] ?? DEFAULT_INPUTS) };
}

function normalizeInputs(input, calculatorType) {
  const defaults = getDefaultInputs(calculatorType);
  const config = PAYROLL_CONFIG.calculators[calculatorType];
  const taxRate = getTaxRate(config);
  const ratingZone = Math.min(PAYROLL_CONFIG.maxRatingZone, Math.max(1, Math.round(toNumber(input.ratingZone) || 1)));
  const ratingBonus = config.ratingBonusByZone[ratingZone] ?? 0;
  const ratingTaxMultiplier = config.taxMode === "gross" ? 1 - taxRate : 1;
  const ratingFirstPart = Math.max(
    0,
    config.ratingFirstPartRate
      ? ratingBonus * config.ratingFirstPartRate * ratingTaxMultiplier
      : toNumber(defaults.ratingFirstPart)
  );

  return {
    month: input.month || defaults.month,
    actualHours: toNumber(input.actualHours),
    testsHigh: Boolean(input.testsHigh),
    ratingZone,
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
    secondHalfHours: Math.max(0, toNumber(valueOrDefault(input.secondHalfHours, defaults.secondHalfHours))),
    ratingFirstPart,
    annualIncome: Math.max(0, toNumber(input.annualIncome)),
    absenceCalendarDays: Math.max(1, Math.floor(toNumber(valueOrDefault(input.absenceCalendarDays, defaults.absenceCalendarDays)))),
    vacationDays: Math.max(0, toNumber(input.vacationDays)),
    sickDays: Math.max(0, toNumber(input.sickDays)),
    sickInsuranceRate: Math.min(1, Math.max(0, toNumber(valueOrDefault(input.sickInsuranceRate, defaults.sickInsuranceRate)))),
    maternityDays: Math.max(0, toNumber(input.maternityDays))
  };
}

/**
 * Builds an estimated payment schedule by payroll dates.
 *
 * @param {object} values - Normalized input values.
 * @param {object} parts - Calculated payroll components used to split payments.
 * @returns {object} Estimated 15th, month-end, next-month and tenure payouts.
 */
function calculatePaymentSchedule(values, parts) {
  const taxMultiplier = parts.isGrossMode ? 1 - parts.taxRate : 1;
  const firstHalfHours = Math.min(values.firstHalfHours, parts.effectiveHours);
  const secondHalfHours = Math.min(values.secondHalfHours, Math.max(0, parts.effectiveHours - firstHalfHours));
  const fixedWorked = (values.salary / parts.normHours) * parts.effectiveHours * taxMultiplier;
  const fixedAdvanceTarget = parts.paymentHourlyRates?.firstHalfFixedNet
    ? parts.paymentHourlyRates.firstHalfFixedNet * firstHalfHours
    : (values.salary / parts.normHours) * firstHalfHours * taxMultiplier;
  const fixedAdvance = Math.min(fixedWorked, fixedAdvanceTarget);
  const fixedMonthEndTarget = parts.paymentHourlyRates?.secondHalfFixedNet
    ? parts.paymentHourlyRates.secondHalfFixedNet * secondHalfHours
    : (values.salary / parts.normHours) * secondHalfHours * taxMultiplier;
  const fixedMonthEnd = Math.min(Math.max(0, fixedWorked - fixedAdvance), fixedMonthEndTarget);
  const fixedSettlement = Math.max(0, fixedWorked - fixedAdvance - fixedMonthEnd);
  const ratingWorked = (parts.ratingBonus / parts.normHours) * parts.effectiveHours * taxMultiplier;
  const ratingFirstPart = Math.min(values.ratingFirstPart, ratingWorked);
  const ratingSecondPart = Math.max(0, ratingWorked - ratingFirstPart);
  const levelPay = (parts.levelBonus / parts.normHours) * parts.effectiveHours * taxMultiplier;
  const extras = (parts.nightPay + parts.holidayPay + parts.doublePay + parts.taxiCompensation - parts.fines) * taxMultiplier;
  const nextMonthRatingPay = ratingSecondPart + levelPay + extras + fixedSettlement;
  const midMonthPay = fixedAdvance + ratingFirstPart + parts.wowBonus;
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
    extras,
    wowBonus: parts.wowBonus,
    midMonthParts: {
      base: fixedAdvance,
      rating: ratingFirstPart,
      wow: parts.wowBonus
    },
    monthEndParts: {
      base: fixedMonthEnd
    },
    nextMonthParts: {
      rating: ratingSecondPart,
      level: levelPay,
      extras,
      settlement: fixedSettlement
    }
  };
}

function calculateAbsencePayments(values) {
  const averageDailyPay = values.annualIncome / values.absenceCalendarDays;
  const sickPay = averageDailyPay * values.sickInsuranceRate * values.sickDays;
  const vacationPay = averageDailyPay * values.vacationDays;
  const maternityPay = averageDailyPay * values.maternityDays;

  return {
    averageDailyPay,
    sickPay,
    vacationPay,
    maternityPay,
    total: sickPay + vacationPay + maternityPay
  };
}

function toNumber(value) {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function valueOrDefault(value, fallback) {
  return value === undefined || value === null || value === "" ? fallback : value;
}

function getTaxRate(config) {
  return config?.taxRate ?? PAYROLL_CONFIG.defaultTaxRate;
}
