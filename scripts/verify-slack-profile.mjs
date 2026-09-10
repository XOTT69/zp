import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findSlackProfileUser,normalizeProfileLogin,rememberSlackProfileUser,REMEMBER_PROFILE_SCRIPT} from '../api/_slack-profile.js';
import {validateDirectoryAccount} from '../api/_directory.js';
import {startChallenge,finishChallenge,slackLoginEnabled} from '../api/_slack-auth.js';
import {createSessionCookie,readSessionFromCookie} from '../api/_auth.js';

Object.assign(process.env,{CORPORATE_AUTH_SOURCE:'slack-profile',SLACK_IDENTITY_MODE:'profile',SLACK_TEAM_ID:'TTEST',SLACK_LDAP_FIELD_ID:'XfLDAP',AUTH_SECRET:'test-profile-secret'});
delete process.env.SLACK_LDAP_FIELD_ATTESTATION;
const manifest = JSON.parse(await readFile(new URL('../docs/slack-app-manifest.json',import.meta.url)));
assert.deepEqual(new Set(manifest.oauth_config.scopes.bot),new Set(['users:read','users.profile:read','chat:write']));
assert.equal(normalizeProfileLogin(' TEST.USER '),'test.user');
assert.equal(normalizeProfileLogin('LDAP: test.user'),null);
assert.equal(normalizeProfileLogin('test.user@example.invalid'),null);
assert.deepEqual(validateDirectoryAccount({active:true},'test.user'),{login:'test.user',displayName:'test.user'});
assert.equal(validateDirectoryAccount({active:false},'test.user'),null);

const values=new Map(), calls=[], deliveries=[];
let protectedField=true, wrongTeam=false, missingField=false;
const users={UALICE:{id:'UALICE',team_id:'TTEST'},UBOB:{id:'UBOB',team_id:'TTEST'}};
const logins={UALICE:' TEST.USER ',UBOB:'other.user'};
const send=async(method,body)=>{
  calls.push({method,body});
  if(method==='auth.test') return {team_id:wrongTeam?'TOTHER':'TTEST'};
  if(method==='team.profile.get') return {profile:{fields:missingField?[]:[{id:'XfLDAP',options:{is_protected:protectedField}}]}};
  if(method==='users.info') return {user:users[body.user]};
  if(method==='users.profile.get') return {profile:{fields:{XfLDAP:{value:logins[body.user]}}}};
  if(method==='chat.postMessage') {deliveries.push(body);return {};}
  throw Error(`Unexpected API call: ${method}`); // users.list and email lookup are forbidden.
};
const store=async commands=>commands.map(command=>{
  const [op,key,value]=command;
  if(op==='GET') return values.get(key)||null;
  if(op==='SET') {values.set(key,value);return 'OK';}
  if(op==='INCR'||op==='EXPIRE') return 1;
  if(op==='DEL') {values.delete(key);return 1;}
  if(op==='EVAL') {
    if(command[1]===REMEMBER_PROFILE_SCRIPT) {
      const previous=values.get(command[3]);
      if(previous && previous!==command[4]) return 0;
      values.set(command[3],command[4]); return 1;
    }
    const raw=values.get(command[3]);
    if(!raw || JSON.parse(raw).digest!==command[4]) return null;
    values.delete(command[3]); return raw;
  }
  throw Error(op);
});
const deps={send,store};
await assert.rejects(findSlackProfileUser('test.user',deps),{code:'SLACK_ID_REQUIRED'});
assert.equal((await findSlackProfileUser('test.user',{...deps,slackUserId:'UALICE'})).id,'UALICE');
assert.equal(values.size,0,'Candidate lookup must not bind a login before OTP');
assert.equal(await findSlackProfileUser('test.user',{...deps,slackUserId:'UBOB'}),null);
assert.equal(await findSlackProfileUser('test.user',{...deps,slackUserId:'invalid'}),null);
for(const flag of ['deleted','is_bot','is_app_user','is_restricted','is_ultra_restricted']) {
  users.UALICE[flag]=true;
  assert.equal(await findSlackProfileUser('test.user',{...deps,slackUserId:'UALICE'}),null);
  delete users.UALICE[flag];
}
users.UALICE.team_id='TOTHER';
assert.equal(await findSlackProfileUser('test.user',{...deps,slackUserId:'UALICE'}),null);
users.UALICE.team_id='TTEST';
protectedField=false;
await assert.rejects(findSlackProfileUser('test.user',{...deps,slackUserId:'UALICE'}));
for(const attestation of ['TOTHER:XfLDAP','TTEST:XfOTHER']) {
  process.env.SLACK_LDAP_FIELD_ATTESTATION=attestation;
  await assert.rejects(findSlackProfileUser('test.user',{...deps,slackUserId:'UALICE'}));
}
process.env.SLACK_LDAP_FIELD_ATTESTATION='TTEST:XfLDAP';
assert.equal((await findSlackProfileUser('test.user',{...deps,slackUserId:'UALICE'})).id,'UALICE');
missingField=true;
await assert.rejects(findSlackProfileUser('test.user',{...deps,slackUserId:'UALICE'}));
missingField=false; wrongTeam=true;
await assert.rejects(findSlackProfileUser('test.user',{...deps,slackUserId:'UALICE'}));
wrongTeam=false;
const directory=async()=>{throw Error('LDAP must not be contacted');};
await assert.rejects(startChallenge('test.user','192.0.2.1',{...deps,directory}),{code:'SLACK_ID_REQUIRED'});
assert.ok(![...values.keys()].some(k=>k.startsWith('zp:otp:cooldown:')),'Missing ID must allow immediate retry');
let challenge=await startChallenge('test.user','192.0.2.1',{...deps,directory,slackUserId:'UALICE'});
assert.equal(deliveries[0].channel,'UALICE');
assert.ok(![...values.keys()].some(k=>k.startsWith('zp:slack-login:')));
let code=deliveries[0].text.match(/\d{6}/)[0];
assert.equal((await finishChallenge(challenge.id,code,{...deps,directory})).sub,'test.user');
assert.equal(await finishChallenge(challenge.id,code,{...deps,directory}),null);
const bindingKey=[...values.keys()].find(k=>k.startsWith('zp:slack-login:'));
assert.ok(bindingKey && !bindingKey.includes('test.user'));
assert.equal(values.get(bindingKey),'UALICE');
assert.equal((await findSlackProfileUser('test.user',deps)).id,'UALICE');
assert.equal(await rememberSlackProfileUser('test.user','UBOB',deps),false);
assert.equal(await findSlackProfileUser('test.user',{...deps,slackUserId:'UBOB'}),null);
challenge=await startChallenge('test.user','192.0.2.1',{...deps,directory}); // No ID on subsequent login.
code=deliveries[1].text.match(/\d{6}/)[0];
logins.UALICE='changed.after.code';
assert.equal(await finishChallenge(challenge.id,code,{...deps,directory}),null);
assert.equal(await findSlackProfileUser('test.user',deps),null);
assert.ok(!calls.some(c=>['users.list','users.lookupByEmail'].includes(c.method)));
assert.ok(calls.filter(c=>c.method==='users.profile.get').every(c=>['UALICE','UBOB'].includes(c.body.user)));
Object.assign(process.env,{LDAP_SLACK_ENABLED:'true',SLACK_BOT_TOKEN:'test-bot-token',UPSTASH_REDIS_REST_URL:'https://test.invalid',UPSTASH_REDIS_REST_TOKEN:'test-redis-token'});
for(const key of ['LDAP_URL','LDAP_BIND_DN','LDAP_BIND_PASSWORD','LDAP_BASE_DN','LDAP_BRIDGE_URL','LDAP_BRIDGE_TOKEN']) delete process.env[key];
assert.equal(slackLoginEnabled(),true);
const cookie=await createSessionCookie('operator',{authMethod:'ldap-slack',sub:'test.user'});
assert.ok(await readSessionFromCookie(cookie));
delete process.env.SLACK_LDAP_FIELD_ATTESTATION;
assert.equal(await readSessionFromCookie(cookie),null);
process.env.CORPORATE_AUTH_SOURCE='directory';
assert.equal(slackLoginEnabled(),false);
console.log('Slack profile identity passed: on-demand checks only, owner attestation, proof before binding, collision rejection, current LDAP and active account, no email or member scans. External services were mocked.');
