import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findSlackProfileUser,normalizeProfileLogin,syncProfileIndex} from '../api/_slack-profile.js';
import {validateDirectoryAccount} from '../api/_directory.js';
import {startChallenge,finishChallenge,slackLoginEnabled} from '../api/_slack-auth.js';
import {createSessionCookie,readSessionFromCookie} from '../api/_auth.js';

Object.assign(process.env,{CORPORATE_AUTH_SOURCE:'slack-profile',SLACK_IDENTITY_MODE:'profile',SLACK_TEAM_ID:'TTEST',SLACK_LDAP_FIELD_ID:'XfLDAP',AUTH_SECRET:'test-profile-secret',LDAP_EMAIL_DOMAINS:'unused.invalid'});
const manifest = JSON.parse(await readFile(new URL('../docs/slack-app-manifest.json',import.meta.url)));
assert.match(manifest.features.bot_user.display_name,/^[a-z0-9._-]{1,80}$/);
assert.deepEqual(new Set(manifest.oauth_config.scopes.bot),new Set(['users:read','users.profile:read','chat:write']));
assert.deepEqual(validateDirectoryAccount({active:true},'test.user'),{login:'test.user',displayName:'test.user'});
assert.equal(validateDirectoryAccount({active:false},'test.user'),null);
assert.equal(validateDirectoryAccount({active:'true'},'test.user'),null);
assert.equal(normalizeProfileLogin(' TEST.USER '),'test.user');
assert.equal(normalizeProfileLogin('LDAP: test.user'),null);
assert.equal(normalizeProfileLogin('test.user@example.invalid'),null);

const values = new Map(), calls = [], deliveries = [];
const now = Date.now();
let protectedField = true, wrongTeam = false, failProfiles = false;
const users = {
  UALICE:{id:'UALICE',team_id:'TTEST'},
  UBOB:{id:'UBOB',team_id:'TTEST'},
  UDUP:{id:'UDUP',team_id:'TTEST'},
  UBOT:{id:'UBOT',team_id:'TTEST',is_bot:true},
  UEXTERNAL:{id:'UEXTERNAL',team_id:'TOTHER'},
  UGUEST:{id:'UGUEST',team_id:'TTEST',is_restricted:true},
  UDELETED:{id:'UDELETED',team_id:'TTEST',deleted:true}
};
const logins = {UALICE:' TEST.USER ',UBOB:'duplicate',UDUP:'Duplicate'};
const send = async (method,body) => {
  calls.push({method,body});
  if(method === 'auth.test') return {team_id:wrongTeam?'TOTHER':'TTEST'};
  if(method === 'team.profile.get') return {profile:{fields:[{id:'XfLDAP',label:'LDAP',options:{is_protected:protectedField}}]}};
  if(method === 'users.list') return body.cursor ? {members:[users.UDUP],response_metadata:{next_cursor:''}} : {members:Object.values(users).filter(u=>u.id!=='UDUP'),response_metadata:{next_cursor:'next-page'}};
  if(method === 'users.profile.get') {
    if(failProfiles) throw Error('Profile failed');
    return {profile:{fields:{XfLDAP:{value:logins[body.user]}}}};
  }
  if(method === 'users.info') return {user:users[body.user]};
  if(method === 'chat.postMessage') { deliveries.push(body); return {}; }
  throw Error(`Unexpected API method: ${method}`);
};
const store = async commands => commands.map(command=>{
  const [op,key,value] = command;
  if(op === 'GET') return values.get(key)||null;
  if(op === 'SET') { values.set(key,value); return 'OK'; }
  if(op === 'INCR' || op === 'EXPIRE') return 1;
  if(op === 'DEL') { values.delete(key); return 1; }
  if(op === 'EVAL') {
    const raw = values.get(command[3]);
    if(!raw || JSON.parse(raw).digest !== command[4]) return null;
    values.delete(command[3]); return raw;
  }
  throw Error(op);
});
const deps = {send,store,pause:async()=>{},now:()=>now};
const result = await syncProfileIndex(deps);
assert.deepEqual(result,{scanned:3,duplicates:1,mapped:1});
assert.ok(calls.some(c=>c.method==='users.list'&&c.body.cursor==='next-page'));
assert.ok(!calls.some(c=>c.method==='users.profile.get'&&['UBOT','UEXTERNAL','UGUEST','UDELETED'].includes(c.body.user)));
const indexKey = [...values.keys()][0];
const indexRaw = values.get(indexKey);
assert.ok(!indexRaw.includes('test.user') && !indexRaw.includes('duplicate'));
assert.equal((await findSlackProfileUser('test.user',deps)).id,'UALICE');
assert.equal(await findSlackProfileUser('duplicate',deps),null);
assert.equal(await findSlackProfileUser('test',deps),null);
await assert.rejects(findSlackProfileUser('test.user',{...deps,now:()=>now+86400000}));
users.UALICE.deleted = true;
assert.equal(await findSlackProfileUser('test.user',deps),null);
users.UALICE.deleted = false;
logins.UALICE = 'renamed.user';
assert.equal(await findSlackProfileUser('test.user',deps),null);
logins.UALICE = 'test.user';
protectedField = false;
await assert.rejects(findSlackProfileUser('test.user',deps));
await assert.rejects(syncProfileIndex(deps));
protectedField = true; wrongTeam = true;
await assert.rejects(findSlackProfileUser('test.user',deps));
wrongTeam = false; failProfiles = true;
await assert.rejects(syncProfileIndex(deps));
assert.equal(values.get(indexKey),indexRaw);
failProfiles = false;

const directory = async ()=>{ throw Error('Slack-only authentication must not contact LDAP'); };
let challenge = await startChallenge('test.user','192.0.2.1',{send,store,directory});
assert.equal(deliveries[0].channel,'UALICE');
let code = deliveries[0].text.match(/\d{6}/)[0];
assert.equal((await finishChallenge(challenge.id,code,{send,store,directory})).sub,'test.user');
assert.equal(await finishChallenge(challenge.id,code,{send,store,directory}),null);
challenge = await startChallenge('test.user','192.0.2.1',{send,store,directory});
code = deliveries[1].text.match(/\d{6}/)[0];
logins.UALICE = 'changed.after.code';
assert.equal(await finishChallenge(challenge.id,code,{send,store,directory}),null);
await startChallenge('duplicate','192.0.2.2',{send,store,directory});
assert.equal(deliveries.length,2);
assert.ok(!calls.some(c=>c.method==='users.lookupByEmail'));
Object.assign(process.env,{LDAP_SLACK_ENABLED:'true',SLACK_BOT_TOKEN:'test-bot-token',UPSTASH_REDIS_REST_URL:'https://test.invalid',UPSTASH_REDIS_REST_TOKEN:'test-redis-token'});
for (const key of ['LDAP_URL','LDAP_BIND_DN','LDAP_BIND_PASSWORD','LDAP_BASE_DN','LDAP_BRIDGE_URL','LDAP_BRIDGE_TOKEN']) delete process.env[key];
assert.equal(slackLoginEnabled(),true);
const cookie = await createSessionCookie('operator',{authMethod:'ldap-slack',sub:'test.user'});
assert.ok(await readSessionFromCookie(cookie));
process.env.SLACK_TEAM_ID = 'TOTHER';
assert.equal(await readSessionFromCookie(cookie),null);
process.env.SLACK_TEAM_ID = 'TTEST';
process.env.CORPORATE_AUTH_SOURCE = 'directory';
assert.equal(slackLoginEnabled(),false);
assert.equal(await readSessionFromCookie(cookie),null);
process.env.CORPORATE_AUTH_SOURCE = 'slack-profile';
process.env.SLACK_IDENTITY_MODE = 'email';
assert.equal(validateDirectoryAccount({active:true},'test.user'),null);
process.env.SLACK_IDENTITY_MODE = 'invalid';
assert.equal(slackLoginEnabled(),false);
console.log('Slack profile identity passed: pagination, protected field, exact matching, duplicates, freshness, delivery and verification without email. External services were mocked.');
