import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {runDirectoryBatch,lookupDirectory,directoryKeys,CHECKPOINT_DIRECTORY,PUBLISH_DIRECTORY,RELEASE_DIRECTORY,authorizedDirectoryRequest,scheduleDirectorySync} from '../api/_slack-directory.js';
import {findSlackProfileUser} from '../api/_slack-profile.js';
import {startChallenge,finishChallenge} from '../api/_slack-auth.js';
import {REMEMBER_PROFILE_SCRIPT} from '../api/_slack-profile.js';
Object.assign(process.env,{SLACK_DIRECTORY_ENABLED:'true',SLACK_TEAM_ID:'TDIR',SLACK_LDAP_FIELD_ID:'XfLDAP',AUTH_SECRET:'directory-test-secret',CORPORATE_AUTH_SOURCE:'slack-profile',SLACK_IDENTITY_MODE:'profile'});
delete process.env.SLACK_LDAP_FIELD_ATTESTATION;
let time=1789000000000, fail=false, active=true, ldap='alice', sends=[];
const values=new Map(), calls=[];
const store=async commands=>commands.map(c=>{
  if(c[0]==='GET') return values.get(c[1]) || null;
  if(c[0]==='SET') {if(c.includes('NX') && values.has(c[1])) return null;values.set(c[1],c[2]);return 'OK';}
  if(c[0]==='DEL') return values.delete(c[1])?1:0;
  if(c[0]==='INCR') {const n=Number(values.get(c[1]) || 0)+1;values.set(c[1],n);return n;}
  if(c[0]==='EXPIRE') return 1;
  if(c[0]==='EVAL') {
    const [,script,n,...args]=c,keys=args.slice(0,n),argv=args.slice(n);
    if(script===RELEASE_DIRECTORY) {if(values.get(keys[0])===argv[0]) {values.delete(keys[0]);return 1;}return 0;}
    if(script===CHECKPOINT_DIRECTORY || script===PUBLISH_DIRECTORY) {
      if(values.get(keys[0])!==argv[0]) return 0;
      values.set(keys[1],argv[1]);if(script===PUBLISH_DIRECTORY) values.delete(keys[2]);return 1;
    }
    if(script===REMEMBER_PROFILE_SCRIPT) {const prev=values.get(keys[0]);if(prev && prev!==argv[0]) return 0;values.set(keys[0],argv[0]);return 1;}
    const raw=values.get(keys[0]);if(!raw || JSON.parse(raw).digest!==argv[0]) return null;values.delete(keys[0]);return raw;
  }
  throw Error('Unexpected Redis operation');
});
const member=id=>({id,team_id:'TDIR'});
const send=async(method,body)=>{
  calls.push({method,body});
  if(method==='auth.test') return {team_id:'TDIR'};
  if(method==='team.profile.get') return {profile:{fields:[{id:'XfLDAP',options:{is_protected:true}}]}};
  if(method==='users.list') return body.cursor ? {members:[member('UDUP2'),member('UBOB')],response_metadata:{next_cursor:''}} : {members:[member('UALICE'),member('UDUP1'),{...member('UGUEST'),is_restricted:true}],response_metadata:{next_cursor:'page-two'}};
  if(method==='users.profile.get') {
    if(fail && body.user==='UBOB') {const e=Error('rate limited');e.retryAfter=25;throw e;}
    return {profile:{fields:{XfLDAP:{value:body.user==='UALICE'?ldap:body.user==='UBOB'?'bob':'duplicate'}}}};
  }
  if(method==='users.info') return {user:{...member(body.user),deleted:!active}};
  if(method==='chat.postMessage') {sends.push(body);return {};}
  throw Error('Unexpected Slack method');
};
const deps={store,send,now:()=>time,pause:async()=>{},maxProfiles:1};
assert.deepEqual(await lookupDirectory('alice',deps),{pending:true});
await assert.rejects(findSlackProfileUser('alice',deps),{code:'SLACK_DIRECTORY_PENDING'});
let result=await runDirectoryBatch(deps);
assert.ok(result.pending);
assert.equal(values.has(directoryKeys().snapshot),false,'Incomplete refresh must not replace the full snapshot');
assert.deepEqual(await lookupDirectory('alice',deps),{id:'UALICE'},'A discovered candidate need not wait for other employees');
assert.ok(![...values.keys()].some(key=>key.startsWith('zp:slack-login:')),'A partial candidate is not a verified binding');
assert.deepEqual(await lookupDirectory('alice',{...deps,now:()=>time+25*3600000}),{id:'UALICE'},'An overnight pause must not discard discovered candidates');
values.set(directoryKeys().lock,'another-owner');
assert.deepEqual(await runDirectoryBatch(deps),{busy:true});values.delete(directoryKeys().lock);
for(let i=0;i<5 && !result.complete;i++) result=await runDirectoryBatch(deps);
assert.ok(result.complete);assert.equal(result.mapped,2);assert.equal(result.duplicates,1);
assert.deepEqual(await lookupDirectory('alice',deps),{id:'UALICE'});
assert.deepEqual(await lookupDirectory('duplicate',deps),{duplicate:true});
assert.deepEqual(await lookupDirectory('unknown',deps),{pending:false});
assert.ok(!calls.some(c=>c.body?.user==='UGUEST'));
const snapshot=JSON.parse(values.get(directoryKeys().snapshot));
assert.ok(!JSON.stringify(snapshot).includes('alice'),'Snapshot contains only HMAC login keys');
// Make injected time agree with production helper for end-to-end candidate checks.
snapshot.createdAt=Date.now();values.set(directoryKeys().snapshot,JSON.stringify(snapshot));
assert.equal((await findSlackProfileUser('alice',deps)).id,'UALICE');
assert.equal(await findSlackProfileUser('duplicate',deps),null);
assert.ok(![...values.keys()].some(key=>key.startsWith('zp:slack-login:')),'Discovery must not create a verified binding');
const challenge=await startChallenge('alice','192.0.2.1',deps);
assert.equal(sends.length,1);assert.equal(sends[0].channel,'UALICE');
const code=sends[0].text.match(/\d{6}/)[0];
assert.equal((await finishChallenge(challenge.id,code,deps)).sub,'alice','First login works without slash command or supplied member ID');
active=false;assert.equal(await findSlackProfileUser('alice',deps),null);active=true;
ldap='changed';assert.equal(await findSlackProfileUser('alice',deps),null);ldap='alice';
// Interrupted/rate-limited refresh preserves a complete live snapshot and resumes.
time=Date.now()+25*3600000; fail=true;
const before=values.get(directoryKeys().snapshot);
result=await runDirectoryBatch({...deps,maxProfiles:20});
assert.ok(result.pending);assert.equal(result.retryAfter,25);
assert.equal(values.get(directoryKeys().snapshot),before);
const countBefore=calls.length;await runDirectoryBatch(deps);assert.equal(calls.length,countBefore,'Retry-After respected across invocations');
time+=26000;fail=false;result=await runDirectoryBatch({...deps,maxProfiles:20});assert.ok(result.complete);
const timestamp=String(Date.now()), signature=createHmac('sha256',process.env.AUTH_SECRET).update(`slack-directory:${timestamp}`).digest('hex');
assert.equal(authorizedDirectoryRequest({headers:{}}),false);
assert.equal(authorizedDirectoryRequest({headers:{'x-directory-time':timestamp,'x-directory-signature':signature}}),true);
assert.equal(authorizedDirectoryRequest({headers:{'x-directory-time':timestamp,'x-directory-signature':signature}},Number(timestamp)+120001),false);
let pending,fetches=[];
process.env.SLACK_DIRECTORY_ORIGIN='https://calculator.example';
scheduleDirectorySync({runLater:p=>pending=p,runBatch:async()=>({pending:true,retryAfter:1}),pause:async()=>{},request:async(url,options)=>{fetches.push({url:String(url),options});return {ok:true};}});
await pending;assert.equal(fetches.length,1);assert.equal(fetches[0].url,'https://calculator.example/api/corporate-auth?action=directory-sync');assert.equal(fetches[0].options.redirect,'error');
console.log('Slack directory passed: resumable pagination, atomic publication, protected lease, duplicates, active LDAP recheck, first OTP without /zp, rate-limit checkpoint, signed continuation. External services mocked.');
