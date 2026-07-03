import { calculatePayroll, roundMoney } from "../calculator.js";

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

const checks = [
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
  ["supervisor.effectiveHours", supervisorResult.effectiveHours, 201],
  ["supervisor.ratingBonus", supervisorResult.ratingBonus, 9440],
  ["supervisor.levelBonus", supervisorResult.levelBonus, 0],
  ["supervisor.baseGross", supervisorResult.baseGross, 68218.181818],
  ["supervisor.baseTax", supervisorResult.baseTax, 15690.181818],
  ["supervisor.basePay", supervisorResult.basePay, 52528],
  ["supervisor.tenureGross", supervisorResult.tenureGross, 30790.763636],
  ["supervisor.tenureTax", supervisorResult.tenureTax, 7081.875636],
  ["supervisor.tenurePay", supervisorResult.tenurePay, 23708.888],
  ["supervisor.totalPay", supervisorResult.totalPay, 76236.888]
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
