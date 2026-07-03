import { calculatePayroll, roundMoney } from "../calculator.js";

const result = calculatePayroll({
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
});

const checks = [
  ["effectiveHours", result.effectiveHours, 188],
  ["ratingBonus", result.ratingBonus, 23062],
  ["levelBonus", result.levelBonus, 5574],
  ["nightPay", result.nightPay, 302.957576],
  ["doublePay", result.doublePay, 2909.372727],
  ["basePay", result.basePay, 50079.021212],
  ["tenurePay", result.tenurePay, 8497.45],
  ["totalPay", result.totalPay, 58576.471212],
  ["tax", result.tax, 13472.588379]
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
