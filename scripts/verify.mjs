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

const checks = [
  ["service.normHours", serviceResult.normHours, 184],
  ["service.effectiveHours", serviceResult.effectiveHours, 188],
  ["service.ratingBonus", serviceResult.ratingBonus, 23062],
  ["service.levelBonus", serviceResult.levelBonus, 5574],
  ["service.nightPay", serviceResult.nightPay, 271.673913],
  ["service.doublePay", serviceResult.doublePay, 2608.94837],
  ["service.basePay", serviceResult.basePay, 44907.817935],
  ["service.tenurePay", serviceResult.tenurePay, 7619.995924],
  ["service.totalPay", serviceResult.totalPay, 52527.813859],
  ["service.tax", serviceResult.tax, 15690.126218],
  ["service.totalGross", serviceResult.totalGross, 68217.940076],
  ["supervisor.normHours", supervisorResult.normHours, 168],
  ["supervisor.effectiveHours", supervisorResult.effectiveHours, 201],
  ["supervisor.ratingBonus", supervisorResult.ratingBonus, 9440],
  ["supervisor.levelBonus", supervisorResult.levelBonus, 0],
  ["supervisor.baseGross", supervisorResult.baseGross, 67000],
  ["supervisor.baseTax", supervisorResult.baseTax, 15410],
  ["supervisor.basePay", supervisorResult.basePay, 51590],
  ["supervisor.tenureGross", supervisorResult.tenureGross, 30240.928571],
  ["supervisor.tenureTax", supervisorResult.tenureTax, 6955.413571],
  ["supervisor.tenurePay", supervisorResult.tenurePay, 23285.515],
  ["supervisor.totalPay", supervisorResult.totalPay, 74875.515],
  ["supervisor.totalGross", supervisorResult.totalGross, 97240.928571],
  ["level4.normHours", level4Result.normHours, 176],
  ["level4.ratingBonus", level4Result.ratingBonus, 34765],
  ["level4.levelBonus", level4Result.levelBonus, 7234],
  ["level4.baseGross", level4Result.baseGross, 57790.786364],
  ["level4.basePay", level4Result.basePay, 44498.9055],
  ["level4.tenurePay", level4Result.tenurePay, 7360.014375],
  ["level4.totalPay", level4Result.totalPay, 51858.919875],
  ["xd.normHours", xdResult.normHours, 176],
  ["xd.ratingBonus", xdResult.ratingBonus, 19130],
  ["xd.levelBonus", xdResult.levelBonus, 2787],
  ["xd.baseGross", xdResult.baseGross, 37183.681818],
  ["xd.basePay", xdResult.basePay, 29932.863864],
  ["xd.tenurePay", xdResult.tenurePay, 6556],
  ["xd.totalPay", xdResult.totalPay, 36488.863864]
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
