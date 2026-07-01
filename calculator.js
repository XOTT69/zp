export const CONFIG = {
  sourceTitle: 'Розрахунок ЗП 2/2 – актуально з 01.03.2026',
  sourceUpdated: '2026-07-01',
  months: {
    'Січень': 165,
    'Лютий': 154,
    'Березень': 165,
    'Квітень': 165,
    'Травень': 165,
    'Червень': 165,
    'Липень': 165,
    'Серпень': 165,
    'Вересень': 165,
    'Жовтень': 165,
    'Листопад': 165,
    'Грудень': 165,
  },
  ratingBonusByZone: {
    1: 23062,
    2: 20290,
    3: 17494,
    4: 14715,
    5: 11935,
  },
  defaultInput: {
    month: 'Червень',
    actualHours: 117.5,
    testsAbove80: true,
    ratingZone: 3,
    qualificationLevel: '1',
    baseSalary: 12497,
    nightHours: 24,
    holidayHours: 0,
    x2Hours: 12.5,
    fines: 0,
    compensationInput: 0,
    tenureYears: 0,
    tenureMode: 'dynamic',
    taxRate: 23,
    compensationDivisor: 80.5,
  },
  sheetFixedTenureBase: 29991,
};

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).replace(',', '.').replace(/\s+/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getQualificationBonus(level, ratingZone) {
  const zone = toNumber(ratingZone, 0);
  const normalizedLevel = String(level || '1').trim();

  if (normalizedLevel === '1') return 0;
  if (normalizedLevel === '2') return zone < 4 ? 2787 : 0;
  if (normalizedLevel === '3') {
    if (zone < 3) return 5574;
    if (zone === 3) return 2787;
    return 0;
  }
  return 0;
}

export function calculateSalary(rawInput = {}) {
  const input = { ...CONFIG.defaultInput, ...rawInput };

  const month = input.month in CONFIG.months ? input.month : CONFIG.defaultInput.month;
  const normHours = CONFIG.months[month];
  const actualHours = Math.max(0, toNumber(input.actualHours));
  const testBonusHours = input.testsAbove80 ? 1 : 0;
  const paidHours = actualHours + testBonusHours;
  const ratingZone = Math.min(5, Math.max(1, Math.round(toNumber(input.ratingZone, 3))));
  const ratingBonus = CONFIG.ratingBonusByZone[ratingZone] || 0;
  const qualificationBonus = getQualificationBonus(input.qualificationLevel, ratingZone);
  const baseSalary = Math.max(0, toNumber(input.baseSalary));
  const nightHours = Math.max(0, toNumber(input.nightHours));
  const holidayHours = Math.max(0, toNumber(input.holidayHours));
  const x2Hours = Math.max(0, toNumber(input.x2Hours));
  const fines = Math.max(0, toNumber(input.fines));
  const compensationInput = Math.max(0, toNumber(input.compensationInput));
  const compensationDivisor = Math.max(1, toNumber(input.compensationDivisor, 80.5));
  const taxRate = Math.max(0, toNumber(input.taxRate, 23)) / 100;
  const tenureYears = Math.max(0, Math.floor(toNumber(input.tenureYears)));
  const tenureRate = tenureYears >= 1 ? tenureYears * 0.05 : 0;
  const dynamicTenureBase = baseSalary + ratingBonus + qualificationBonus;
  const tenureBase = input.tenureMode === 'sheetFixed'
    ? CONFIG.sheetFixedTenureBase
    : dynamicTenureBase;

  const hourlyFull = normHours > 0 ? (baseSalary + ratingBonus + qualificationBonus) / normHours : 0;
  const baseAccrual = hourlyFull * paidHours;
  const nightPay = normHours > 0 ? (baseSalary / normHours) * nightHours * 0.2 : 0;
  const holidayPay = normHours > 0 ? (baseSalary / normHours) * holidayHours : 0;
  const x2Pay = normHours > 0 ? ((baseSalary + ratingBonus) / normHours) * x2Hours : 0;
  const compensationGrossed = (compensationInput / compensationDivisor) * 100;
  const salaryNetBeforeTenure = baseAccrual + nightPay + holidayPay + x2Pay + compensationGrossed - fines;
  const tenurePay = normHours > 0 ? (tenureBase * tenureRate / normHours) * paidHours : 0;
  const totalNet = salaryNetBeforeTenure + tenurePay;
  const taxAmount = totalNet * taxRate;
  const grossReference = totalNet + taxAmount;

  const parts = [
    { key: 'baseAccrual', label: 'Оклад + рейтинг + кваліфікація за години', value: baseAccrual },
    { key: 'nightPay', label: 'Доплата за нічні години 20%', value: nightPay },
    { key: 'holidayPay', label: 'Святкові години', value: holidayPay },
    { key: 'x2Pay', label: 'Оплата Х2', value: x2Pay },
    { key: 'compensationGrossed', label: 'Монобрат/таксі з перерахунком', value: compensationGrossed },
    { key: 'fines', label: 'Штрафи', value: -fines },
    { key: 'tenurePay', label: 'Премія «Стаж»', value: tenurePay },
  ];

  return {
    input: {
      ...input,
      month,
      actualHours,
      ratingZone,
      baseSalary,
      nightHours,
      holidayHours,
      x2Hours,
      fines,
      compensationInput,
      tenureYears,
      taxRatePercent: taxRate * 100,
      compensationDivisor,
    },
    normHours,
    testBonusHours,
    paidHours,
    ratingBonus,
    qualificationBonus,
    hourlyFull,
    baseAccrual,
    nightPay,
    holidayPay,
    x2Pay,
    compensationGrossed,
    salaryNetBeforeTenure,
    tenureYears,
    tenureRate,
    tenureBase,
    tenurePay,
    totalNet,
    taxAmount,
    grossReference,
    parts,
    rounded: {
      hourlyFull: roundMoney(hourlyFull),
      baseAccrual: roundMoney(baseAccrual),
      nightPay: roundMoney(nightPay),
      holidayPay: roundMoney(holidayPay),
      x2Pay: roundMoney(x2Pay),
      compensationGrossed: roundMoney(compensationGrossed),
      salaryNetBeforeTenure: roundMoney(salaryNetBeforeTenure),
      tenurePay: roundMoney(tenurePay),
      totalNet: roundMoney(totalNet),
      taxAmount: roundMoney(taxAmount),
      grossReference: roundMoney(grossReference),
    },
  };
}
