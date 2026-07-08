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

export const PAYROLL_CONFIG = {
  defaultTaxRate: 0.23,
  taxiDivisor: 80.5,
  maxRatingZone: 5,
  maxWowCases: 5,
  maxTenureYears: 15,
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
        ratingZone: 3,
        level: "level2",
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
    },
    video: {
      title: "ЗП відеоверифікатор",
      shortTitle: "Відео",
      source: "Copy of Верифікатори ЗП від 1.03.26",
      taxMode: "gross",
      taxRate: 0.23,
      doublePayMode: "baseHourly",
      bonusInputMode: "amountTaxable",
      bonusLabel: "ВАУ кейси і т.д, грн",
      paymentScheduleMode: "firstHalfRatingGross",
      fixedAdvanceNet: 11650,
      ratingBonusByZone: {
        1: 52233 - 30360,
        2: 50410 - 30360,
        3: 48587 - 30360,
        4: 46764 - 30360,
        5: 44940 - 30360
      },
      tenureBase: 48590,
      maxTenureYears: 15,
      ratingFirstPartRate: 0,
      defaultInputs: {
        month: "Липень",
        actualHours: 176,
        testsHigh: false,
        ratingZone: 3,
        level: "level2",
        salary: 30360,
        nightHours: 0,
        holidayHours: 0,
        doubleHours: 0,
        wowCases: 0,
        fines: 0,
        taxiAmount: 0,
        tenureYears: 6,
        firstHalfHours: 79,
        secondHalfHours: 86,
        ratingFirstPart: 0,
        annualIncome: 0,
        absenceCalendarDays: 365,
        vacationDays: 0,
        sickDays: 0,
        sickInsuranceRate: 0.7,
        maternityDays: 0
      },
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
          1: 7240,
          2: 7240,
          3: 2700 / 0.77,
          4: 0,
          5: 0
        }
      }
    },
    iron: {
      title: "ЗП IRON",
      shortTitle: "IRON",
      source: "Копия Розрахувати зарплату (оператор айрон)",
      taxMode: "gross",
      taxRate: 0.23,
      deductionLabel: "Сума БУР",
      tenureHoursMode: "separate",
      paymentScheduleMode: "iron",
      paymentHourlyRates: {
        firstHalfNet: 19543.62 / 88,
        secondHalfNet: 8873.76 / 88
      },
      paymentMonthlyRates: {
        Травень: {
          firstHalfNet: 19908.10 / 93,
          secondHalfNet: 4566.62 / 44
        },
        Червень: {
          firstHalfNet: 19543.62 / 88,
          secondHalfNet: 8873.76 / 88
        }
      },
      scheduleOptions: [
        { value: "2/2", label: "2/2" },
        { value: "5/2", label: "5/2" }
      ],
      defaultWorkSchedule: "2/2",
      scheduleMonthHours: {
        "2/2": {
          Січень: 165,
          Лютий: 154,
          Березень: 165,
          Квітень: 165,
          Травень: 165,
          Червень: 165,
          Липень: 165,
          Серпень: 165,
          Вересень: 165,
          Жовтень: 165,
          Листопад: 165,
          Грудень: 165
        },
        "5/2": {
          Січень: 176,
          Лютий: 160,
          Березень: 176,
          Квітень: 176,
          Травень: 168,
          Червень: 176,
          Липень: 184,
          Серпень: 168,
          Вересень: 176,
          Жовтень: 176,
          Листопад: 168,
          Грудень: 184
        }
      },
      ratingBonusByZone: {
        1: 35570,
        2: 33370,
        3: 31160,
        4: 28800,
        5: 26740
      },
      levelBonusByLevel: {
        level1: 0,
        level2: 2400,
        level3: 4800
      },
      tenureBase: 53410,
      maxTenureYears: 15,
      ratingFirstPartRate: 0,
      defaultInputs: {
        month: "Червень",
        workSchedule: "2/2",
        actualHours: 206,
        testsHigh: false,
        ratingZone: 3,
        level: "level2",
        salary: 22240,
        nightHours: 36,
        holidayHours: 0,
        doubleHours: 0,
        wowCases: 0,
        fines: 420,
        taxiAmount: 0,
        tenureYears: 2,
        tenureHours: 200,
        firstHalfHours: 88,
        secondHalfHours: 88,
        ratingFirstPart: 0,
        annualIncome: 0,
        absenceCalendarDays: 365,
        vacationDays: 0,
        sickDays: 0,
        sickInsuranceRate: 0.7,
        maternityDays: 0
      }
    }
  }
};

export const ACCESS_CONFIG = {
  admin: {
    label: "Адмін",
    envKey: "ADMIN_ACCESS_CODE",
    allowedCalculators: ["supervisor", "service", "level4", "xd", "video", "iron"],
    isAdmin: true
  },
  operator: {
    label: "Оператор",
    envKey: "OPERATOR_ACCESS_CODE",
    allowedCalculators: ["service"]
  },
  supervisor: {
    label: "СВ",
    envKey: "SUPERVISOR_ACCESS_CODE",
    allowedCalculators: ["supervisor", "service", "level4", "xd", "video", "iron"]
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
  },
  video: {
    label: "Відеоверифікатор",
    envKey: "VIDEO_ACCESS_CODE",
    allowedCalculators: ["video"]
  },
  iron: {
    label: "IRON",
    envKey: "IRON_ACCESS_CODE",
    allowedCalculators: ["iron"]
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
    isAdmin: Boolean(config.isAdmin),
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
      maxTenureYears: PAYROLL_CONFIG.maxTenureYears,
      calculators: Object.fromEntries(
        session.allowedCalculators.map((key) => [key, PAYROLL_CONFIG.calculators[key]])
      )
    }
  };
}
