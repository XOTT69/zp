export const MONTHS = [
  { name: "Січень", hours: 176 },
  { name: "Лютий", hours: 154 },
  { name: "Березень", hours: 176 },
  { name: "Квітень", hours: 176 },
  { name: "Травень", hours: 168 },
  { name: "Червень", hours: 176 },
  { name: "Липень", hours: 184 },
  { name: "Серпень", hours: 168 },
  { name: "Вересень", hours: 176 },
  { name: "Жовтень", hours: 176 },
  { name: "Листопад", hours: 168 },
  { name: "Грудень", hours: 184 }
];

export const LEVELS = [
  { value: "level1", label: "1-й рівень" },
  { value: "level2", label: "2-й рівень" },
  { value: "level3", label: "3-й рівень" }
];

export const PAYROLL_CONFIG = {
  defaultTaxRate: 0.23,
  taxiDivisor: 80.5,
  maxRatingZone: 5,
  maxWowCases: 5,
  calculators: {
    service: {
      title: "ЗП оператора сервісу",
      shortTitle: "Сервіс",
      source: "Калькулятор ЗП для графіка 2/2",
      taxMode: "net",
      taxRate: 0.23,
      ratingBonusByZone: {
        1: 23062,
        2: 20290,
        3: 17494,
        4: 14715,
        5: 11935
      },
      tenureBase: 29991,
      ratingFirstPartRate: 3100 / 23062,
      defaultInputs: {
        month: "Липень",
        actualHours: 187,
        testsHigh: true,
        ratingZone: 1,
        level: "level3",
        salary: 12497,
        nightHours: 20,
        holidayHours: 0,
        doubleHours: 13.5,
        wowCases: 0,
        fines: 0,
        taxiAmount: 0,
        tenureYears: 5,
        firstHalfHours: 82.5,
        secondHalfHours: 82.5,
        ratingFirstPart: 3100,
        annualIncome: 0,
        absenceCalendarDays: 365,
        vacationDays: 0,
        sickDays: 0,
        sickInsuranceRate: 0.7,
        maternityDays: 0
      },
      levelBonusRules: {
        level2: { maxZoneExclusive: 4, amount: 2787 },
        level3: { underZone3: 5574, zone3: 2787 }
      }
    },
    supervisor: {
      title: "ЗП СВ",
      shortTitle: "СВ",
      source: "Калькулятор ЗП для графіка 2/2",
      taxMode: "gross",
      taxRate: 0.23,
      ratingBonusByZone: {
        1: 19160,
        2: 16730,
        3: 14330,
        4: 11880,
        5: 9440
      },
      tenureBase: 63190,
      wowCaseRate: 400,
      ratingFirstPartRate: 0,
      defaultInputs: {
        month: "Травень",
        actualHours: 200,
        testsHigh: true,
        ratingZone: 5,
        level: "level3",
        salary: 46560,
        nightHours: 0,
        holidayHours: 0,
        doubleHours: 0,
        wowCases: 0,
        fines: 0,
        taxiAmount: 0,
        tenureYears: 8,
        firstHalfHours: 99,
        secondHalfHours: 93.3,
        ratingFirstPart: 0,
        annualIncome: 0,
        absenceCalendarDays: 365,
        vacationDays: 0,
        sickDays: 0,
        sickInsuranceRate: 1,
        maternityDays: 0
      },
      levelBonusRules: {
        level2: { maxZoneExclusive: 4, amount: 3620 },
        level3: { underZone3: 7240, zone3: 3620 }
      },
      paymentHourlyRates: {
        firstHalfFixedNet: 18170.04 / 99,
        secondHalfFixedNet: 16296 / 93.3
      }
    },
    level4: {
      title: "ЗП 4 лвл",
      shortTitle: "4 лвл",
      source: "Калькулятор ЗП для графіка 2/2",
      taxMode: "gross",
      taxRate: 0.23,
      ratingBonusByZone: {
        1: 34765,
        2: 31165,
        3: 27543,
        4: 0,
        5: 0
      },
      tenureBase: 53406,
      ratingFirstPartRate: 0,
      defaultInputs: {
        month: "Червень",
        actualHours: 157.5,
        testsHigh: false,
        ratingZone: 1,
        level: "level3",
        salary: 22241,
        nightHours: 12,
        holidayHours: 0,
        doubleHours: 0,
        wowCases: 0,
        fines: 0,
        taxiAmount: 0,
        tenureYears: 4,
        firstHalfHours: 82.5,
        secondHalfHours: 82.5,
        ratingFirstPart: 0,
        annualIncome: 0,
        absenceCalendarDays: 365,
        vacationDays: 0,
        sickDays: 0,
        sickInsuranceRate: 0.7,
        maternityDays: 0
      },
      levelBonusRules: {
        level2: { maxZoneExclusive: 3, amount: 3617 },
        level3: { underZone3: 7234, zone3: 0 }
      }
    },
    xd: {
      title: "ЗП ХД",
      shortTitle: "ХД",
      source: "Калькулятор ЗП для графіка 2/2",
      taxMode: "gross",
      taxRate: 0.195,
      tenureTaxMode: "netPlusTaxOnNet",
      ratingBonusByZone: {
        1: 24690,
        2: 21890,
        3: 19130,
        4: 16340,
        5: 13560
      },
      tenureBase: 32780,
      ratingFirstPartRate: 0,
      defaultInputs: {
        month: "Березень",
        actualHours: 184,
        testsHigh: false,
        ratingZone: 3,
        level: "level2",
        salary: 13650,
        nightHours: 0,
        holidayHours: 0,
        doubleHours: 0,
        wowCases: 0,
        fines: 0,
        taxiAmount: 0,
        tenureYears: 4,
        firstHalfHours: 82.5,
        secondHalfHours: 82.5,
        ratingFirstPart: 0,
        annualIncome: 0,
        absenceCalendarDays: 365,
        vacationDays: 0,
        sickDays: 0,
        sickInsuranceRate: 0.7,
        maternityDays: 0
      },
      levelBonusRules: {
        level2: { maxZoneExclusive: 4, amount: 2787 },
        level3: { underZone3: 5575, zone3: 2787 }
      }
    }
  }
};

export const ACCESS_CONFIG = {
  operator: {
    label: "Оператор",
    envKey: "OPERATOR_ACCESS_CODE",
    allowedCalculators: ["service"]
  },
  supervisor: {
    label: "СВ",
    envKey: "SUPERVISOR_ACCESS_CODE",
    allowedCalculators: ["supervisor", "service", "level4", "xd"]
  },
  level4: {
    label: "4 лвл",
    envKey: "LEVEL4_ACCESS_CODE",
    allowedCalculators: ["level4"]
  },
  xd: {
    label: "ХД",
    envKey: "XD_ACCESS_CODE",
    allowedCalculators: ["xd"]
  }
};

export function getRoleCode(role) {
  const config = ACCESS_CONFIG[role];
  if (!config) return "";
  return process.env[config.envKey] || "";
}

export function getSessionForRole(role) {
  const config = ACCESS_CONFIG[role];
  if (!config) return null;
  return {
    role,
    label: config.label,
    allowedCalculators: [...config.allowedCalculators]
  };
}

export function getPayrollPayloadForRole(role) {
  const session = getSessionForRole(role);
  if (!session) return null;
  return {
    months: MONTHS,
    levels: LEVELS,
    config: {
      defaultTaxRate: PAYROLL_CONFIG.defaultTaxRate,
      taxiDivisor: PAYROLL_CONFIG.taxiDivisor,
      maxRatingZone: PAYROLL_CONFIG.maxRatingZone,
      maxWowCases: PAYROLL_CONFIG.maxWowCases,
      calculators: Object.fromEntries(
        session.allowedCalculators.map((key) => [key, PAYROLL_CONFIG.calculators[key]])
      )
    }
  };
}
