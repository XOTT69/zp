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
  maxTenureYears: 15,
  calculators: {}
};

export function configurePayrollData(payload) {
  MONTHS = payload.months ?? [];
  LEVELS = payload.levels ?? [];
  PAYROLL_CONFIG = applyRuntimeConfigOverrides(payload.config ?? PAYROLL_CONFIG);
  CALCULATORS = Object.fromEntries(
    Object.entries(PAYROLL_CONFIG.calculators).map(([key, config]) => [
      key,
      {
        title: config.title,
        shortTitle: config.shortTitle,
        source: config.source,
        taxMode: config.taxMode,
        taxRate: getTaxRate(config),
        hasWow: Boolean(config.wowCaseRate),
        bonusInputMode: config.bonusInputMode ?? null,
        bonusLabel: config.bonusLabel ?? "WOW-кейси",
        deductionLabel: config.deductionLabel ?? "Штрафи",
        scheduleOptions: config.scheduleOptions ?? null,
        doublePayMode: config.doublePayMode ?? "salaryPlusRating"
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

function applyRuntimeConfigOverrides(config) {
  const calculators = { ...(config.calculators ?? {}) };

  if (calculators.video) {
    calculators.video = {
      ...calculators.video,
      levelBonusByLevelAndZone: {
        level1: { default: 0 },
        level2: {
          1: 2700 / 0.77,
          2: 2700 / 0.77,
          3: 2700 / 0.77,
          4: 0,
          5: 0
        },
        level3: {
          1: 5500 / 0.77,
          2: 5500 / 0.77,
          3: 2700 / 0.77,
          4: 0,
          5: 0
        }
      }
    };
  }

  return {
    ...config,
    calculators
  };
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
  const normHours = getMonthHours(values.month, calculatorType, values.workSchedule);
  const ratingBonus = config.ratingBonusByZone[values.ratingZone] ?? 0;
  const levelBonus = getLevelBonus(values.level, values.ratingZone, calculatorType);
  const testHours = values.testsHigh ? 1 : 0;
  const effectiveHours = values.actualHours + testHours;

  const nightPay = (values.salary / normHours) * values.nightHours * 0.2;
  const holidayPay = (values.salary / normHours) * values.holidayHours;
  const doublePay = getDoublePay(values, config, ratingBonus, normHours);
  const bonusNet = config.bonusInputMode === "amountNet" ? values.wowCases : 0;
  const taxiCompensation = (values.taxiAmount / PAYROLL_CONFIG.taxiDivisor) * 100;

  const basePay =
    ((values.salary + levelBonus + ratingBonus) / normHours) * effectiveHours +
    nightPay +
    holidayPay +
    doublePay -
    values.fines +
    bonusNet +
    taxiCompensation;

  const tenureRate = values.tenureYears >= 1 ? values.tenureYears * 0.05 : 0;
  const tenureHours = config.tenureHoursMode === "separate" ? values.tenureHours : values.actualHours;
  const tenurePay = ((config.tenureBase * tenureRate) / normHours) * tenureHours;
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
    finesGross: values.fines,
    finesNet: 0,
    basePay,
    tenurePay,
    wowBonus: 0,
    taxableBonus: 0,
    bonusNet,
    isGrossMode: false,
    taxRate,
    paymentScheduleMode: config.paymentScheduleMode,
    fixedAdvanceNet: config.fixedAdvanceNet,
    variableFirstPartNet: config.variableFirstPartNet,
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
    taxableBonus: 0,
    bonusNet,
    basePay,
    baseGross,
    baseTax,
    tenureRate,
    tenureHours,
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
  const normHours = getMonthHours(values.month, calculatorType, values.workSchedule);
  const ratingBonus = config.ratingBonusByZone[values.ratingZone] ?? 0;
  const levelBonus = getLevelBonus(values.level, values.ratingZone, calculatorType);
  const testHours = values.testsHigh ? 1 : 0;
  const effectiveHours = values.actualHours + testHours;

  const nightPay = (values.salary / normHours) * values.nightHours * 0.2;
  const holidayPay = (values.salary / normHours) * values.holidayHours;
  const doublePay = getDoublePay(values, config, ratingBonus, normHours);
  const taxableBonus = config.bonusInputMode === "amountTaxable" ? values.wowCases : 0;
  const wowBonus = config.bonusInputMode === "amountTaxable"
    ? 0
    : Math.min(PAYROLL_CONFIG.maxWowCases, Math.max(0, values.wowCases)) * (config.wowCaseRate ?? 0);
  const taxiCompensation = (values.taxiAmount / PAYROLL_CONFIG.taxiDivisor) * 100;

  const finesGross = config.finesMode === "net" ? 0 : values.fines;
  const finesNet = config.finesMode === "net" ? values.fines : 0;
  const baseGross =
    ((values.salary + levelBonus + ratingBonus) / normHours) * effectiveHours +
    nightPay +
    holidayPay +
    doublePay +
    taxableBonus +
    taxiCompensation -
    finesGross;
  const baseTax = baseGross * taxRate;
  const basePay = baseGross - baseTax + wowBonus - finesNet;

  const tenureRate = values.tenureYears >= 1 ? values.tenureYears * 0.05 : 0;
  const tenureHours = config.tenureHoursMode === "separate" ? values.tenureHours : effectiveHours;
  const tenureBasePay = config.tenureTaxMode === "netPlusTaxOnNet"
    ? config.tenureBase * tenureRate
    : ((config.tenureBase * tenureRate) / normHours) * tenureHours;
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
    finesGross,
    finesNet,
    basePay,
    tenurePay,
    wowBonus,
    taxableBonus,
    isGrossMode: true,
    taxRate,
    paymentScheduleMode: config.paymentScheduleMode,
    fixedAdvanceNet: config.fixedAdvanceNet,
    variableFirstPartNet: config.variableFirstPartNet,
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
    taxableBonus,
    taxiCompensation,
    baseGross,
    baseTax,
    basePay,
    baseNet: basePay,
    tenureRate,
    tenureHours,
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

export function getMonthHours(month, calculatorType = null, workSchedule = null) {
  const config = PAYROLL_CONFIG.calculators[calculatorType];
  const schedule = workSchedule ?? config?.defaultWorkSchedule;
  if (schedule && config?.scheduleMonthHours?.[schedule]?.[month]) {
    return config.scheduleMonthHours[schedule][month];
  }
  return config?.monthHours?.[month] ?? MONTHS.find((item) => item.name === month)?.hours ?? 165;
}

export function getServiceLevelBonus(level, ratingZone) {
  return getLevelBonus(level, ratingZone, "service");
}

export function getSupervisorLevelBonus(level, ratingZone) {
  return getLevelBonus(level, ratingZone, "supervisor");
}

export function getLevelBonus(level, ratingZone, calculatorType = "service") {
  const config = PAYROLL_CONFIG.calculators[calculatorType];
  const zoneRules = config?.levelBonusByLevelAndZone?.[level];
  if (zoneRules) {
    return zoneRules[ratingZone] ?? zoneRules.default ?? 0;
  }
  if (config?.levelBonusByLevel) {
    return config.levelBonusByLevel[level] ?? 0;
  }
  const rules = config?.levelBonusRules;
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
  const maxTenureYears = config.maxTenureYears ?? PAYROLL_CONFIG.maxTenureYears ?? 15;
  const tenureYears = Math.min(maxTenureYears, Math.max(0, Math.floor(toNumber(input.tenureYears))));

  return {
    month: input.month || defaults.month,
    workSchedule: input.workSchedule || defaults.workSchedule || config.defaultWorkSchedule || "2/2",
    actualHours: toNumber(input.actualHours),
    testsHigh: Boolean(input.testsHigh),
    ratingZone,
    level: input.level || defaults.level,
    salary: toNumber(input.salary),
    nightHours: toNumber(input.nightHours),
    holidayHours: toNumber(input.holidayHours),
    doubleHours: toNumber(input.doubleHours),
    wowCases: normalizeBonusInput(input.wowCases, config),
    fines: toNumber(input.fines),
    taxiAmount: toNumber(input.taxiAmount),
    tenureYears,
    tenureHours: Math.max(0, toNumber(valueOrDefault(input.tenureHours, input.actualHours))),
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
  if (parts.paymentScheduleMode === "firstHalfRatingGross") {
    return calculateFirstHalfRatingGrossPaymentSchedule(values, parts);
  }

  if (parts.paymentScheduleMode === "videoVerifier") {
    return calculateVideoVerifierPaymentSchedule(values, parts);
  }

  if (parts.paymentScheduleMode === "iron") {
    return calculateIronPaymentSchedule(values, parts);
  }

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
  const extrasGross = parts.nightPay + parts.holidayPay + parts.doublePay + parts.taxableBonus + parts.taxiCompensation - (parts.finesGross ?? parts.fines ?? 0);
  const extras = extrasGross * taxMultiplier + (parts.bonusNet ?? 0) - (parts.finesNet ?? 0);
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

function calculateIronPaymentSchedule(values, parts) {
  const firstHalfHours = Math.min(values.firstHalfHours, parts.effectiveHours);
  const secondHalfHours = Math.min(values.secondHalfHours, Math.max(0, parts.effectiveHours - firstHalfHours));
  const midMonthPay = (parts.paymentHourlyRates?.firstHalfNet ?? 0) * firstHalfHours;
  const monthEndPay = (parts.paymentHourlyRates?.secondHalfNet ?? 0) * secondHalfHours;
  const fixedAdvance = Math.min(midMonthPay, (values.salary / parts.normHours) * (parts.normHours / 2) * (1 - parts.taxRate));
  const ratingFirstPart = Math.max(0, midMonthPay - fixedAdvance);
  const nextMonthRatingPay = Math.max(0, parts.basePay - midMonthPay - monthEndPay);

  return {
    midMonthPay,
    monthEndPay,
    nextMonthRatingPay,
    tenurePay: parts.tenurePay,
    estimatedTotal: midMonthPay + monthEndPay + nextMonthRatingPay + parts.tenurePay,
    fixedAdvance,
    fixedMonthEnd: monthEndPay,
    fixedSettlement: 0,
    ratingFirstPart,
    ratingSecondPart: nextMonthRatingPay,
    levelPay: 0,
    extras: 0,
    wowBonus: 0,
    midMonthParts: {
      base: fixedAdvance,
      rating: ratingFirstPart,
      wow: 0
    },
    monthEndParts: {
      base: monthEndPay
    },
    nextMonthParts: {
      rating: nextMonthRatingPay,
      level: 0,
      extras: 0,
      settlement: 0
    }
  };
}

function calculateFirstHalfRatingGrossPaymentSchedule(values, parts) {
  const taxMultiplier = parts.isGrossMode ? 1 - parts.taxRate : 1;
  const firstHalfHours = Math.min(values.firstHalfHours, parts.effectiveHours);
  const fixedWorked = (values.salary / parts.normHours) * parts.effectiveHours * taxMultiplier;
  const fixedAdvance = Math.min(fixedWorked, parts.fixedAdvanceNet ?? fixedWorked / 2);
  const fixedMonthEnd = Math.max(0, fixedWorked - fixedAdvance);
  const ratingWorked = (parts.ratingBonus / parts.normHours) * parts.effectiveHours * taxMultiplier;
  const ratingFirstPart = Math.min(
    ratingWorked,
    (parts.ratingBonus / parts.normHours) * firstHalfHours * taxMultiplier
  );
  const ratingSecondPart = Math.max(0, ratingWorked - ratingFirstPart);
  const levelPay = (parts.levelBonus / parts.normHours) * parts.effectiveHours * taxMultiplier;
  const extrasGross = parts.nightPay + parts.holidayPay + parts.doublePay + parts.taxableBonus + parts.taxiCompensation - (parts.finesGross ?? parts.fines ?? 0);
  const extras = extrasGross * taxMultiplier + (parts.bonusNet ?? 0) - (parts.finesNet ?? 0);
  const nextMonthRatingPay = ratingSecondPart + levelPay + extras;
  const midMonthPay = fixedAdvance + ratingFirstPart;

  return {
    midMonthPay,
    monthEndPay: fixedMonthEnd,
    nextMonthRatingPay,
    tenurePay: parts.tenurePay,
    estimatedTotal: midMonthPay + fixedMonthEnd + nextMonthRatingPay + parts.tenurePay,
    fixedAdvance,
    fixedMonthEnd,
    fixedSettlement: 0,
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
      settlement: 0
    }
  };
}

function calculateVideoVerifierPaymentSchedule(values, parts) {
  const workFactor = parts.normHours ? parts.effectiveHours / parts.normHours : 0;
  const fixedWorked = (values.salary / parts.normHours) * parts.effectiveHours;
  const fixedAdvanceTarget = (parts.fixedAdvanceNet ?? values.salary / 2) * workFactor;
  const fixedAdvance = Math.min(fixedWorked, fixedAdvanceTarget);
  const fixedMonthEnd = Math.max(0, fixedWorked - fixedAdvance);
  const ratingWorked = (parts.ratingBonus / parts.normHours) * parts.effectiveHours;
  const ratingFirstPart = Math.min(ratingWorked, (parts.variableFirstPartNet ?? 0) * workFactor);
  const ratingSecondPart = Math.max(0, ratingWorked - ratingFirstPart);
  const levelPay = (parts.levelBonus / parts.normHours) * parts.effectiveHours;
  const extras = parts.nightPay + parts.holidayPay + parts.doublePay + (parts.bonusNet ?? 0) + parts.taxiCompensation - (parts.finesGross ?? parts.fines ?? 0) - (parts.finesNet ?? 0);
  const nextMonthRatingPay = ratingSecondPart + levelPay + extras;
  const midMonthPay = fixedAdvance + ratingFirstPart;

  return {
    midMonthPay,
    monthEndPay: fixedMonthEnd,
    nextMonthRatingPay,
    tenurePay: parts.tenurePay,
    estimatedTotal: midMonthPay + fixedMonthEnd + nextMonthRatingPay + parts.tenurePay,
    fixedAdvance,
    fixedMonthEnd,
    fixedSettlement: 0,
    ratingFirstPart,
    ratingSecondPart,
    levelPay,
    extras,
    wowBonus: 0,
    midMonthParts: {
      base: fixedAdvance,
      rating: ratingFirstPart,
      wow: 0
    },
    monthEndParts: {
      base: fixedMonthEnd
    },
    nextMonthParts: {
      rating: ratingSecondPart,
      level: levelPay,
      extras,
      settlement: 0
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

function getDoublePay(values, config, ratingBonus, normHours) {
  if (config.doublePayMode === "baseHourly") {
    return (values.salary / normHours) * values.doubleHours;
  }
  return ((values.salary + ratingBonus) / normHours) * values.doubleHours;
}

function normalizeBonusInput(value, config) {
  const numberValue = Math.max(0, toNumber(value));
  if (config.bonusInputMode === "amountTaxable" || config.bonusInputMode === "amountNet") {
    return numberValue;
  }
  return Math.min(PAYROLL_CONFIG.maxWowCases, Math.max(0, Math.round(numberValue)));
}

function valueOrDefault(value, fallback) {
  return value === undefined || value === null || value === "" ? fallback : value;
}

function getTaxRate(config) {
  return config?.taxRate ?? PAYROLL_CONFIG.defaultTaxRate;
}
