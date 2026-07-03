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
  taxRate: 0.23,
  taxiDivisor: 80.5,
  maxRatingZone: 5,
  maxWowCases: 5,
  calculators: {
    service: {
      title: "ЗП оператора сервісу",
      shortTitle: "Сервіс",
      source: "Калькулятор ЗП для графіка 2/2",
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
        averageDailyPay: 0,
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
      source: "Калькулятор ЗП+15% 1.03.2026",
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
        averageDailyPay: 0,
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
    }
  }
};

export const ACCESS_CONFIG = {
  operator: {
    label: "Оператор",
    code: "operator2026",
    allowedCalculators: ["service"]
  },
  supervisor: {
    label: "СВ",
    code: "ogo@2026",
    allowedCalculators: ["service", "supervisor"]
  }
};
