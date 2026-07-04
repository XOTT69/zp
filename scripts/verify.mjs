import { calculatePayroll, configurePayrollData, roundMoney } from "../calculator.js";
import { LEVELS, MONTHS, PAYROLL_CONFIG } from "../api/_payroll-data.js";

configurePayrollData({
  months: MONTHS,
  levels: LEVELS,
  config: PAYROLL_CONFIG
});

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
  actualHours: 165,
  testsHigh: false,
  ratingZone: 3,
  level: "level1",
  salary: 23300,
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

const videoLevel2Zone4Result = calculatePayroll({
  month: "Липень",
  actualHours: 165,
  testsHigh: false,
  ratingZone: 4,
  level: "level2",
  salary: 23300,
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
  salary: 23300,
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

const checks = [
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
  ["xd.normHours", xdResult.normHours, 165],
  ["xd.ratingBonus", xdResult.ratingBonus, 19130],
  ["xd.levelBonus", xdResult.levelBonus, 2787],
  ["xd.baseGross", xdResult.baseGross, 39662.593939],
  ["xd.basePay", xdResult.basePay, 31928.388121],
  ["xd.tenurePay", xdResult.tenurePay, 6556],
  ["xd.totalPay", xdResult.totalPay, 38484.388121],
  ["video.normHours", videoResult.normHours, 165],
  ["video.ratingBonus", videoResult.ratingBonus, 14000],
  ["video.levelBonus", videoResult.levelBonus, 0],
  ["video.baseGross", videoResult.baseGross, 37300],
  ["video.basePay", videoResult.basePay, 37300],
  ["video.tenureGross", videoResult.tenureGross, 0],
  ["video.tenurePay", videoResult.tenurePay, 0],
  ["video.totalPay", videoResult.totalPay, 37300],
  ["video.payment15", videoResult.paymentSchedule.midMonthPay, 17250],
  ["video.payment31", videoResult.paymentSchedule.monthEndPay, 11650],
  ["video.payment07", videoResult.paymentSchedule.nextMonthRatingPay, 8400],
  ["video.level2Zone4.levelBonus", videoLevel2Zone4Result.levelBonus, 0],
  ["video.level2Zone4.totalPay", videoLevel2Zone4Result.totalPay, 35900],
  ["video.level3Green.levelBonus", videoLevel3GreenResult.levelBonus, 5500],
  ["video.level3Green.totalPay", videoLevel3GreenResult.totalPay, 45600]
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
