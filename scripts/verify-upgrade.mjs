import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculatePayroll,configurePayrollData,getDefaultInputs,getMonthHours} from '../calculator.js';
import {MONTHS,LEVELS,PAYROLL_CONFIG,REFERENCE_CALCULATORS,getSessionForRole} from '../api/_payroll-data.js';
import {parseHours,validatePayrollInputs} from '../modules/input-validation.js';
import {createCalculationRecord,resolveRateVersion} from '../modules/calculation-records.js';
import {createSessionCookie,readSessionFromCookie} from '../api/_auth.js';
import {escapeLdapFilter} from '../api/_directory.js';
import {startChallenge,finishChallenge,challengeDigest} from '../api/_slack-auth.js';
const fixture=JSON.parse(await readFile(new URL('../tests/fixtures/colleague-2026-09.json',import.meta.url)));
const payload={months:MONTHS,levels:LEVELS,config:{...PAYROLL_CONFIG,calculators:{...PAYROLL_CONFIG.calculators,...REFERENCE_CALCULATORS}}};
configurePayrollData(payload);
let cases=0;
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.005,`${label}: ${actual} != ${expected}`);
for(const [type,p] of Object.entries(fixture.profiles)) {
  const zones=p.zones || [1,2,3,4,5];
  for(const stage of p.before3?['before3','after3']:['after3']) for(let level=1;level<=3;level++) for(let i=0;i<zones.length;i++) {
    const rating=(stage==='before3'?p.before3:p.ratings)[i];
    const qualification=stage==='before3'||level===1?0:p[`level${level}`][i];
    const functional=stage==='before3'?0:p.functional?.[level-1] || 0;
    const input={...getDefaultInputs(type),year:2026,month:'Вересень',actualHours:165,stage,level:`level${level}`,ratingZone:zones[i],salary:p.salary,tenureYears:0,testsHigh:false,nightHours:0,doubleHours:0,holidayHours:0,taxiAmount:0,wowCases:0,fines:0};
    const r=calculatePayroll(input,type);
    near(r.ratingBonus,rating,`${type}/${stage}/${zones[i]} rating`);
    near(r.levelBonus,qualification,`${type}/${stage}/${zones[i]}/${level} qualification`);
    near(r.totalPay,(p.salary+rating+qualification+functional)*.77,`${type}/${stage}/${zones[i]}/${level} net`);
    const partial=calculatePayroll({...input,actualHours:'82:30',tenureYears:1,tenureHours:82.5,nightHours:10,doubleHours:10,taxiAmount:100,fines:100},type);
    const night=p.night===false?0:p.salary/165*10*.2;
    const double=p.double===false?0:(p.salary+rating)/165*10;
    const tenure=stage==='before3'?0:p.tenure*.05/2;
    near(partial.totalPay,((p.salary+rating+qualification+functional)/2+night+double+tenure-100)*.77+100,`${type} partial/extras/tenure`);
    cases+=2;
  }
}
for(const [schedule,norms] of Object.entries(fixture.norms)) for(let m=0;m<12;m++) assert.equal(getMonthHours(MONTHS[m].name,'supervisor',schedule),norms[m]);
for(const role of ['operator','supervisor','level4','xd','video','iron','admin']) {
  assert.equal(getSessionForRole(role).allowedCalculators.length,13);
  assert.equal(getSessionForRole(role).isAdmin,role==='admin');
}
assert.equal(parseHours('8:30').value,8.5);assert.equal(parseHours('8,5').value,8.5);assert.equal(parseHours('8.30').value,8.3);
assert.ok(parseHours('8:60').error);assert.ok(parseHours('-1').error);assert.ok(parseHours('Infinity').error);
assert.ok(validatePayrollInputs({actualHours:8,nightHours:9,tenureYears:0}).nightHours);
const old={version:{effectiveFrom:'2026-03-01',label:'old'},overrides:{service:{salary:10}}};
const latest={version:{effectiveFrom:'2026-09-01',label:'new'},rateVersions:[old]};
assert.equal(resolveRateVersion(latest,'2026-08').version.label,'old');assert.equal(resolveRateVersion(latest,'2026-09').version.label,'new');assert.equal(resolveRateVersion(latest,'2026-02'),null);
const inputs={...getDefaultInputs('supervisor'),actualHours:165};const result=calculatePayroll(inputs,'supervisor');
const record=createCalculationRecord({type:'supervisor',inputs,result,payroll:payload,version:old.version});
inputs.actualHours=1;payload.config.calculators.supervisor.defaultInputs.salary=1;
assert.equal(record.inputs.actualHours,165);assert.equal(record.payroll.config.calculators.supervisor.defaultInputs.salary,46560);
assert.equal(record.result.totalPay,result.totalPay);
process.env.AUTH_SECRET='unit-test-secret-32-characters-minimum';process.env.OPERATOR_ACCESS_CODE='test-code';process.env.LDAP_SLACK_ENABLED='true';
let cookie=await createSessionCookie('operator');assert.ok(await readSessionFromCookie(cookie));process.env.OPERATOR_ACCESS_CODE='rotated';assert.equal(await readSessionFromCookie(cookie),null);
cookie=await createSessionCookie('operator',{authMethod:'ldap-slack',sub:'test.user'});const session=await readSessionFromCookie(cookie);assert.ok(session.exp<=Date.now()/1000+8*3600);assert.equal((await readSessionFromCookie(await createSessionCookie('operator',session))).exp,session.exp);
process.env.LDAP_SLACK_ENABLED='false';assert.equal(await readSessionFromCookie(cookie),null);
assert.equal(escapeLdapFilter('a*)(x=\\\0'), 'a\\2a\\29\\28x=\\5c\\00');
// Isolated transport doubles: no LDAP, Slack or Redis service is contacted.
const commands=[];const messages=[];const values=new Map();
const store=async pipeline=>pipeline.map(command=>{commands.push(command);const [op,key,value]=command;if(op==='INCR')return 1;if(op==='EXPIRE')return 1;if(op==='SET'){values.set(key,value);return 'OK';}if(op==='GET')return values.get(key)||null;if(op==='DEL'){values.delete(key);return 1;}if(op==='EVAL'){const raw=values.get(command[3]);if(!raw)return null;if(JSON.parse(raw).digest!==command[4])return null;values.delete(command[3]);return raw;}throw Error(op);});
const directory=async login=>({login,email:'test@example.invalid',displayName:'Test'});
const send=async(method,body)=>{messages.push({method,body});return {user:{id:'U_TEST'}};};
const challenge=await startChallenge('test.user','192.0.2.1',{directory,store,send});
assert.equal(challenge.status,200);assert.equal(messages[1].body.channel,'U_TEST');
const code=messages[1].body.text.match(/\d{6}/)[0];const stored=JSON.parse(values.get(`zp:otp:${challenge.id}`));assert.equal(stored.digest,challengeDigest(challenge.id,code));assert.ok(!JSON.stringify(challenge).includes(code));
assert.equal((await finishChallenge(challenge.id,code,{store,directory})).sub,'test.user');assert.equal(await finishChallenge(challenge.id,code,{store,directory}),null);
const previousMessages=messages.length;await startChallenge('unknown','192.0.2.2',{directory:async()=>null,store,send});assert.equal(messages.length,previousMessages);
assert.equal((await startChallenge('limited','192.0.2.3',{store:async()=>[11,1,'OK'],directory,send})).status,429);
console.log(`Upgrade verification passed: ${cases} reference payroll cases, access, hours, snapshots, version selection, session revocation and mocked OTP transport.`);

const storage = await import('../modules/storage.js');
const localValues = new Map();
globalThis.localStorage={getItem:key=>localValues.get(key)??null,setItem:(key,value)=>localValues.set(key,value)};
storage.setStorageIdentity('alice');storage.saveCalculationHistory('service',[{totalPay:123}]);
storage.setStorageIdentity('bob');assert.deepEqual(storage.loadCalculationHistory('service'),[]);
storage.setStorageIdentity('alice');assert.equal(storage.loadCalculationHistory('service')[0].totalPay,123);
console.log('Personal history separation passed.');
