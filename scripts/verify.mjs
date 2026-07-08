import { calculatePayroll, configurePayrollData, roundMoney } from "../calculator.js";
import { LEVELS, MONTHS, PAYROLL_CONFIG } from "../api/_payroll-data.js";

configurePayrollData({
  months: MONTHS,
  levels: LEVELS,
  config: PAYROLL_CONFIG
});

const calibratedConfig = structuredClone(PAYROLL_CONFIG);
calibratedConfig.calculators.service.paymentMonthlyRules = {
  Липень: {
    firstHalfAmount: 10123.36,
    firstHalfHours: 51,
    secondHalfAmount: 5467.49,
    secondHalfHours: 56,
    nextMonthAmount: 11266.37,
    tenureAmount: null,
    tenureHours: null
  }
};

const serviceResult = calculatePayroll({
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
}, "service");

const service52Result = calculatePayroll({
  month: "Липень",
  workSchedule: "5/2",
  actualHours: 184,
  testsHigh: false,
  ratingZone: 1,
  level: "level3",
  salary: 12497,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 1
}, "service");

const supervisorResult = calculatePayroll({
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
  tenureYears: 8
}, "supervisor");

const level4Result = calculatePayroll({
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
  tenureYears: 4
}, "level4");

const level452Result = calculatePayroll({
  month: "Липень",
  workSchedule: "5/2",
  actualHours: 184,
  testsHigh: false,
  ratingZone: 1,
  level: "level3",
  salary: 22241,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 1
}, "level4");

const level4ClampedZoneResult = calculatePayroll({
  month: "Липень",
  workSchedule: "2/2",
  actualHours: 165,
  testsHigh: false,
  ratingZone: 5,
  level: "level3",
  salary: 22241,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 0
}, "level4");

const level4ZoneBonusChecks = [
  ["level2", 1, 3617],
  ["level2", 2, 3617],
  ["level2", 3, 0],
  ["level3", 1, 7234],
  ["level3", 2, 3617],
  ["level3", 3, 0]
].map(([level, ratingZone, expected]) => {
  const result = calculatePayroll({
    month: "Липень",
    workSchedule: "2/2",
    actualHours: 165,
    testsHigh: false,
    ratingZone,
    level,
    salary: 22241,
    nightHours: 0,
    holidayHours: 0,
    doubleHours: 0,
    wowCases: 0,
    fines: 0,
    taxiAmount: 0,
    tenureYears: 0
  }, "level4");
  return [`level4.${level}.zone${ratingZone}.levelBonus`, result.levelBonus, expected];
});

const xdResult = calculatePayroll({
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
  tenureYears: 4
}, "xd");

const videoResult = calculatePayroll({
  month: "Липень",
  actualHours: 176,
  testsHigh: false,
  ratingZone: 5,
  level: "level3",
  salary: 30360,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 6,
  firstHalfHours: 79,
  secondHalfHours: 86
}, "video");

const videoMaxTenureResult = calculatePayroll({
  month: "Липень",
  actualHours: 176,
  testsHigh: false,
  ratingZone: 5,
  level: "level3",
  salary: 30360,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 20,
  firstHalfHours: 79,
  secondHalfHours: 86
}, "video");

const videoLevel2WhiteResult = calculatePayroll({
  month: "Липень",
  actualHours: 165,
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
  tenureYears: 0,
  firstHalfHours: 82.5,
  secondHalfHours: 82.5
}, "video");

const videoLevel2YellowResult = calculatePayroll({
  month: "Липень",
  actualHours: 165,
  testsHigh: false,
  ratingZone: 4,
  level: "level2",
  salary: 30360,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 0,
  firstHalfHours: 82.5,
  secondHalfHours: 82.5
}, "video");

const videoLevel3GreenResult = calculatePayroll({
  month: "Липень",
  actualHours: 165,
  testsHigh: false,
  ratingZone: 1,
  level: "level3",
  salary: 30360,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 0,
  firstHalfHours: 82.5,
  secondHalfHours: 82.5
}, "video");

const videoLevel3WhiteResult = calculatePayroll({
  month: "Липень",
  actualHours: 165,
  testsHigh: false,
  ratingZone: 3,
  level: "level3",
  salary: 30360,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 0,
  firstHalfHours: 82.5,
  secondHalfHours: 82.5
}, "video");

const videoLevel3YellowResult = calculatePayroll({
  month: "Липень",
  actualHours: 165,
  testsHigh: false,
  ratingZone: 4,
  level: "level3",
  salary: 30360,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 0,
  firstHalfHours: 82.5,
  secondHalfHours: 82.5
}, "video");

const videoPayslipResult = calculatePayroll({
  month: "Липень",
  actualHours: 145,
  testsHigh: false,
  ratingZone: 2,
  level: "level3",
  salary: 30360,
  nightHours: 10,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 2,
  firstHalfHours: 72.5,
  secondHalfHours: 72.5
}, "video");

const videoMayPayslipResult = calculatePayroll({
  month: "Травень",
  actualHours: 90,
  testsHigh: false,
  ratingZone: 1,
  level: "level2",
  salary: 30360,
  nightHours: 22,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 2,
  firstHalfHours: 45,
  secondHalfHours: 45
}, "video");

configurePayrollData({
  months: MONTHS,
  levels: LEVELS,
  config: calibratedConfig
});

const serviceCalibratedResult = calculatePayroll({
  month: "Липень",
  actualHours: 107,
  testsHigh: true,
  ratingZone: 2,
  level: "level3",
  salary: 12497,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 0,
  firstHalfHours: 51,
  secondHalfHours: 56
}, "service");

configurePayrollData({
  months: MONTHS,
  levels: LEVELS,
  config: PAYROLL_CONFIG
});

const iron22Result = calculatePayroll({
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
  firstHalfHours: 82.5,
  secondHalfHours: 82.5
}, "iron");

const iron52Result = calculatePayroll({
  month: "Березень",
  workSchedule: "5/2",
  actualHours: 152,
  testsHigh: false,
  ratingZone: 3,
  level: "level1",
  salary: 22240,
  nightHours: 0,
  holidayHours: 0,
  doubleHours: 0,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 2,
  tenureHours: 175,
  firstHalfHours: 82.5,
  secondHalfHours: 69.5
}, "iron");

const ironActualResult = calculatePayroll({
  month: "Червень",
  workSchedule: "2/2",
  actualHours: 176,
  testsHigh: false,
  ratingZone: 3,
  level: "level2",
  salary: 22240,
  nightHours: 18,
  holidayHours: 0,
  doubleHours: 1.5,
  wowCases: 0,
  fines: 280,
  taxiAmount: 0,
  tenureYears: 2,
  tenureHours: 176,
  firstHalfHours: 88,
  secondHalfHours: 88
}, "iron");

const ironMayResult = calculatePayroll({
  month: "Травень",
  workSchedule: "2/2",
  actualHours: 137,
  testsHigh: false,
  ratingZone: 2,
  level: "level2",
  salary: 22240,
  nightHours: 39,
  holidayHours: 0,
  doubleHours: 0.5,
  wowCases: 0,
  fines: 0,
  taxiAmount: 0,
  tenureYears: 2,
  tenureHours: 137,
  firstHalfHours: 93,
  secondHalfHours: 44
}, "iron");

const monthNormChecks = MONTHS.map((month) => [
  `month.${month.name}.hours`,
  month.hours,
  month.name === "Лютий" ? 154 : 165
]);

const checks = [
  ...monthNormChecks,
  ["service.normHours", serviceResult.normHours, 165],
  ["service.effectiveHours", serviceResult.effectiveHours, 188],
  ["service.ratingBonus", serviceResult.ratingBonus, 23062],
  ["service.levelBonus", serviceResult.levelBonus, 5574],
  ["service.nightPay", serviceResult.nightPay, 302.957576],
  ["service.doublePay", serviceResult.doublePay, 2909.372727],
  ["service.basePay", serviceResult.basePay, 50079.021212],
  ["service.tenurePay", serviceResult.tenurePay, 8497.45],
  ["service.totalPay", serviceResult.totalPay, 58576.471212],
  ["service.tax", serviceResult.tax, 17496.868024],
  ["service.totalGross", serviceResult.totalGross, 76073.339237],
  ["service52.normHours", service52Result.normHours, 184],
  ["service52.ratingBonus", service52Result.ratingBonus, 23062],
  ["service52.totalPay", service52Result.totalPay, 42632.55],
  ["supervisor.normHours", supervisorResult.normHours, 165],
  ["supervisor.effectiveHours", supervisorResult.effectiveHours, 201],
  ["supervisor.ratingBonus", supervisorResult.ratingBonus, 9440],
  ["supervisor.levelBonus", supervisorResult.levelBonus, 0],
  ["supervisor.baseGross", supervisorResult.baseGross, 68218.181818],
  ["supervisor.baseTax", supervisorResult.baseTax, 15690.181818],
  ["supervisor.basePay", supervisorResult.basePay, 52528],
  ["supervisor.tenureGross", supervisorResult.tenureGross, 30790.763636],
  ["supervisor.tenureTax", supervisorResult.tenureTax, 7081.875636],
  ["supervisor.tenurePay", supervisorResult.tenurePay, 23708.888],
  ["supervisor.totalPay", supervisorResult.totalPay, 76236.888],
  ["supervisor.totalGross", supervisorResult.totalGross, 99008.945455],
  ["level4.normHours", level4Result.normHours, 165],
  ["level4.ratingBonus", level4Result.ratingBonus, 34765],
  ["level4.levelBonus", level4Result.levelBonus, 7234],
  ["level4.baseGross", level4Result.baseGross, 61643.505455],
  ["level4.basePay", level4Result.basePay, 47465.4992],
  ["level4.tenurePay", level4Result.tenurePay, 7850.682],
  ["level4.totalPay", level4Result.totalPay, 55316.1812],
  ["level452.normHours", level452Result.normHours, 184],
  ["level452.ratingBonus", level452Result.ratingBonus, 34765],
  ["level452.totalPay", level452Result.totalPay, 51520.931],
  ["level4.clampedZone", level4ClampedZoneResult.input.ratingZone, 3],
  ["level4.clampedRatingBonus", level4ClampedZoneResult.ratingBonus, 27543],
  ...level4ZoneBonusChecks,
  ["xd.normHours", xdResult.normHours, 165],
  ["xd.ratingBonus", xdResult.ratingBonus, 19130],
  ["xd.levelBonus", xdResult.levelBonus, 2787],
  ["xd.baseGross", xdResult.baseGross, 39662.593939],
  ["xd.basePay", xdResult.basePay, 31928.388121],
  ["xd.tenurePay", xdResult.tenurePay, 6556],
  ["xd.totalPay", xdResult.totalPay, 38484.388121],
  ["video.normHours", videoResult.normHours, 165],
  ["video.ratingBonus", videoResult.ratingBonus, 14580],
  ["video.levelBonus", videoResult.levelBonus, 0],
  ["video.baseGross", videoResult.baseGross, 47936],
  ["video.basePay", videoResult.basePay, 36910.72],
  ["video.tenureGross", videoResult.tenureGross, 15548.8],
  ["video.tenurePay", videoResult.tenurePay, 11972.576],
  ["video.totalPay", videoResult.totalPay, 48883.296],
  ["video.payment15", videoResult.paymentSchedule.midMonthPay, 17025.16],
  ["video.payment31", videoResult.paymentSchedule.monthEndPay, 13285.68],
  ["video.payment07", videoResult.paymentSchedule.nextMonthRatingPay, 6599.88],
  ["video.default.ratingZone", PAYROLL_CONFIG.calculators.video.defaultInputs.ratingZone, 3],
  ["video.default.level2BonusGross", PAYROLL_CONFIG.calculators.video.levelBonusByLevelAndZone.level2[3], 3620],
  ["video.maxTenure.inputYears", videoMaxTenureResult.input.tenureYears, 15],
  ["video.maxTenure.tenurePay", videoMaxTenureResult.tenurePay, 29931.44],
  ["video.maxTenure.totalPay", videoMaxTenureResult.totalPay, 66842.16],
  ["video.level2White.levelBonusNet", videoLevel2WhiteResult.paymentSchedule.nextMonthParts.level, 2787.4],
  ["video.level2Yellow.levelBonusNet", videoLevel2YellowResult.paymentSchedule.nextMonthParts.level, 0],
  ["video.level3Green.levelBonusNet", videoLevel3GreenResult.paymentSchedule.nextMonthParts.level, 5574.8],
  ["video.level3White.levelBonusNet", videoLevel3WhiteResult.paymentSchedule.nextMonthParts.level, 2700],
  ["video.level3Yellow.levelBonusNet", videoLevel3YellowResult.paymentSchedule.nextMonthParts.level, 0],
  ["video.payslip.baseGross", videoPayslipResult.baseGross, 51030.121212],
  ["video.payslip.basePay", videoPayslipResult.basePay, 39293.193333],
  ["video.payslip.tenureGross", videoPayslipResult.tenureGross, 4270.030303],
  ["video.payslip.tenurePay", videoPayslipResult.tenurePay, 3287.923333],
  ["video.payslip.totalGross", videoPayslipResult.totalGross, 55300.151515],
  ["video.payslip.totalPay", videoPayslipResult.totalPay, 42581.116667],
  ["video.mayPayslip.baseGross", videoMayPayslipResult.baseGross, 31273.236364],
  ["video.mayPayslip.basePay", videoMayPayslipResult.basePay, 24080.392],
  ["video.mayPayslip.tenureGross", videoMayPayslipResult.tenureGross, 2650.363636],
  ["video.mayPayslip.tenurePay", videoMayPayslipResult.tenurePay, 2040.78],
  ["video.mayPayslip.totalGross", videoMayPayslipResult.totalGross, 33923.6],
  ["video.mayPayslip.totalPay", videoMayPayslipResult.totalPay, 26121.172],
  ["service.calibrated.payment15", serviceCalibratedResult.paymentSchedule.midMonthPay, 10123.36],
  ["service.calibrated.payment31", serviceCalibratedResult.paymentSchedule.monthEndPay, 5467.49],
  ["service.calibrated.payment07", serviceCalibratedResult.paymentSchedule.nextMonthRatingPay, 11266.37],
  ["iron22.normHours", iron22Result.normHours, 165],
  ["iron22.ratingBonus", iron22Result.ratingBonus, 31160],
  ["iron22.levelBonus", iron22Result.levelBonus, 2400],
  ["iron22.nightPay", iron22Result.nightPay, 970.472727],
  ["iron22.baseGross", iron22Result.baseGross, 70215.927273],
  ["iron22.basePay", iron22Result.basePay, 54066.264],
  ["iron22.tenureGross", iron22Result.tenureGross, 6473.939394],
  ["iron22.tenurePay", iron22Result.tenurePay, 4984.933333],
  ["iron22.totalGross", iron22Result.totalGross, 76689.866667],
  ["iron22.totalPay", iron22Result.totalPay, 59051.197333],
  ["iron52.normHours", iron52Result.normHours, 176],
  ["iron52.ratingBonus", iron52Result.ratingBonus, 31160],
  ["iron52.levelBonus", iron52Result.levelBonus, 0],
  ["iron52.baseGross", iron52Result.baseGross, 46118.181818],
  ["iron52.basePay", iron52Result.basePay, 35511],
  ["iron52.tenureGross", iron52Result.tenureGross, 5310.653409],
  ["iron52.tenurePay", iron52Result.tenurePay, 4089.203125],
  ["iron52.totalGross", iron52Result.totalGross, 51428.835227],
  ["iron52.totalPay", iron52Result.totalPay, 39600.203125],
  ["ironActual.baseGross", ironActualResult.baseGross, 60210.690909],
  ["ironActual.basePay", ironActualResult.basePay, 46362.232],
  ["ironActual.tenureGross", ironActualResult.tenureGross, 5697.066667],
  ["ironActual.tenurePay", ironActualResult.tenurePay, 4386.741333],
  ["ironActual.totalGross", ironActualResult.totalGross, 65907.757576],
  ["ironActual.totalPay", ironActualResult.totalPay, 50748.973333],
  ["ironActual.payment15", ironActualResult.paymentSchedule.midMonthPay, 19543.62],
  ["ironActual.payment31", ironActualResult.paymentSchedule.monthEndPay, 8873.76],
  ["ironActual.payment07", ironActualResult.paymentSchedule.nextMonthRatingPay, 17944.852],
  ["ironActual.payment09", ironActualResult.paymentSchedule.tenurePay, 4386.741333],
  ["ironMay.payment15", ironMayResult.paymentSchedule.midMonthPay, 19908.10],
  ["ironMay.payment31", ironMayResult.paymentSchedule.monthEndPay, 4566.62],
  ["ironMay.payment07", ironMayResult.paymentSchedule.nextMonthRatingPay, 13552.30],
  ["ironMay.payment09", ironMayResult.paymentSchedule.tenurePay, 3414.679333]
];

let failed = false;

for (const [name, actual, expected] of checks) {
  const delta = Math.abs(roundMoney(actual) - roundMoney(expected));
  if (delta > 0.02) {
    failed = true;
    console.error(`${name}: expected ${expected}, got ${actual}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("Formula verification passed.");
