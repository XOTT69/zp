import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {makeSlackCommandHandler,validSlackSignature} from '../api/_slack-command.js';
import {REMEMBER_PROFILE_SCRIPT} from '../api/_slack-profile.js';
Object.assign(process.env,{SLACK_SIGNING_SECRET:'test-signing-secret',SLACK_BOT_TOKEN:'test-bot',SLACK_TEAM_ID:'TTEST',SLACK_LDAP_FIELD_ID:'XfLDAP',SLACK_LDAP_FIELD_ATTESTATION:'TTEST:XfLDAP',AUTH_SECRET:'test-auth-secret',LDAP_SLACK_ENABLED:'true',CORPORATE_AUTH_SOURCE:'slack-profile',SLACK_IDENTITY_MODE:'profile',UPSTASH_REDIS_REST_URL:'https://test.invalid',UPSTASH_REDIS_REST_TOKEN:'test'});
const timestamp='1789012800', now=Number(timestamp)*1000;
const values=new Map(), deliveries=[], calls=[], pending=[];
let deleted=false, ldap=' CC261100MAO ';
const send=async(method,body)=>{
  calls.push({method,body});
  if(method==='auth.test')return {team_id:'TTEST'};
  if(method==='team.profile.get')return {profile:{fields:[{id:'XfLDAP',options:{is_protected:false}}]}};
  if(method==='users.info')return {user:{id:body.user,team_id:'TTEST',deleted}};
  if(method==='users.profile.get')return {profile:{fields:{XfLDAP:{value:ldap}}}};
  if(method==='chat.postMessage'){deliveries.push(body);return {};}
  throw Error(`Forbidden method ${method}`);
};
const store=async commands=>commands.map(command=>{
  const [op,key,value]=command;
  if(op==='GET')return values.get(key)||null;
  if(op==='SET'){if(command.includes('NX')&&values.has(key))return null;values.set(key,value);return 'OK';}
  if(op==='INCR'){const value=Number(values.get(key)||0)+1;values.set(key,value);return value;}
  if(op==='EXPIRE')return 1;
  if(op==='EVAL'&&command[1]===REMEMBER_PROFILE_SCRIPT){const previous=values.get(command[3]);if(previous&&previous!==command[4])return 0;values.set(command[3],command[4]);return 1;}
  throw Error('Unexpected Redis command');
});
const handler=makeSlackCommandHandler({send,store,now:()=>now,runLater:promise=>pending.push(promise)});
const signature=(body,time=timestamp)=>'v0='+createHmac('sha256',process.env.SLACK_SIGNING_SECRET).update(`v0:${time}:${body}`).digest('hex');
const body=(extras={})=>new URLSearchParams({team_id:'TTEST',user_id:'UALICE',command:'/zp',text:'',...extras}).toString();
const request=(raw=body(),time=timestamp,sig=signature(raw,time))=>new Request('https://test.invalid/api/slack-command',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-slack-request-timestamp':time,'x-slack-signature':sig},body:raw});
assert.ok(validSlackSignature(body(),timestamp,signature(body()),now));
assert.equal((await handler(request(body()+'x',timestamp,signature(body())))).status,401);
assert.equal((await handler(request(body(),String(Number(timestamp)-301)))).status,401);
assert.equal((await handler(request(body(),String(Number(timestamp)+301)))).status,401);
assert.equal((await handler(request(body({team_id:'TOTHER'})))).status,403);
assert.equal((await handler(request(body({command:'/other'})))).status,400);
assert.equal((await handler(request(body()+'&user_id=UBOB'))).status,400);
assert.equal(calls.length,0);assert.equal(values.size,0);
assert.equal((await handler(request(body({text:'somebody.else'})))).status,200);
assert.equal(pending.length,0,'Never accept another login as a command argument');
const accepted=await handler(request());
assert.equal(accepted.status,200);assert.equal((await accepted.json()).response_type,'ephemeral');
await Promise.all(pending.splice(0));
const binding=[...values.keys()].find(key=>key.startsWith('zp:slack-login:'));
assert.ok(binding&&!binding.includes('cc261100mao'));
assert.equal(values.get(binding),'UALICE');assert.equal(deliveries.length,1);assert.equal(deliveries[0].channel,'UALICE');
await handler(request());await Promise.all(pending.splice(0));
assert.equal(deliveries.length,1,'Slack retry must not repeat processing or messaging');
await handler(request(body({user_id:'UBOB',trigger_id:'2'})));await Promise.all(pending.splice(0));
assert.equal(values.get(binding),'UALICE','Another Slack sender cannot replace a binding');
assert.match(deliveries.at(-1).text,/Не вдалося/);
deleted=true;ldap='new.ldap';
await handler(request(body({user_id:'UCAROL',trigger_id:'3'})));await Promise.all(pending.splice(0));
assert.equal([...values.keys()].filter(key=>key.startsWith('zp:slack-login:')).length,1);
assert.ok(!calls.some(call=>['users.list','users.lookupByEmail'].includes(call.method)));
assert.ok(calls.filter(call=>call.method==='users.profile.get').every(call=>['UALICE','UBOB'].includes(call.body.user)));
delete process.env.SLACK_SIGNING_SECRET;
assert.equal((await handler(request(body(),timestamp,'v0='+'0'.repeat(64)))).status,503);
console.log('Slack command passed: raw-body signature, timestamp, workspace, sender, replay prevention, no login arguments, collision/deactivation checks and no directory scans. External services were mocked.');
