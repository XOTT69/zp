import assert from 'node:assert/strict';
import { CONFIG, calculateSalary, roundMoney } from '../calculator.js';

const tableExample = calculateSalary(CONFIG.defaultInput);
assert.equal(roundMoney(tableExample.totalNet), 24174.59);
assert.equal(roundMoney(tableExample.taxAmount), 5560.15);
assert.equal(tableExample.normHours, 165);
assert.equal(tableExample.paidHours, 118.5);
assert.equal(tableExample.ratingBonus, 17494);
assert.equal(tableExample.qualificationBonus, 0);

const level2Zone3 = calculateSalary({
  ...CONFIG.defaultInput,
  qualificationLevel: '2',
});
assert.equal(level2Zone3.qualificationBonus, 2787);

const level3Zone2 = calculateSalary({
  ...CONFIG.defaultInput,
  ratingZone: 2,
  qualificationLevel: '3',
});
assert.equal(level3Zone2.qualificationBonus, 5574);

const level3Zone3 = calculateSalary({
  ...CONFIG.defaultInput,
  ratingZone: 3,
  qualificationLevel: '3',
});
assert.equal(level3Zone3.qualificationBonus, 2787);

console.log('All calculator tests passed');
