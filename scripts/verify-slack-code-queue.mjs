import assert from 'node:assert/strict';
import {queueCodeRequest,pollCodeRequest,SAVE_QUEUED_REQUEST} from '../api/_slack-code-queue.js';
import {RELEASE_DIRECTORY} from '../api/_slack-directory.js';
import {requestSlackCode} from '../modules/slack-login.js';
import {startChallenge} from '../api/_slack-auth.js';
let time=Date.now();const values=new Map(),expires=new Map();
const now=()=>time;
const store=async commands=>commands.map(c=>{
  const [op,key,value]=c;
  if(expires.get(key)<=time){values.delete(key);expires.delete(key);}
  if(op==='GET') return values.get(key) || null;
  if(op==='SET') {if(c.includes('NX') && values.has(key)) return null;values.set(key,value);if(c.includes('EX'))expires.set(key,time+Number(c[c.indexOf('EX')+1])*1000);return 'OK';}
  if(op==='INCR'){const n=Number(values.get(key)||0)+1;values.set(key,n);return n;}
  if(op==='EXPIRE'){if(c.includes('NX') && expires.has(key))return 0;expires.set(key,time+value*1000);return 1;}
  if(op==='DEL'){values.delete(key);expires.delete(key);return 1;}
  if(op==='EVAL') {
    const n=c[2],keys=c.slice(3,3+n),args=c.slice(3+n);
    if(key===RELEASE_DIRECTORY){if(values.get(keys[0])!==args[0])return 0;values.delete(keys[0]);return 1;}
    if(key===SAVE_QUEUED_REQUEST){if(values.get(keys[0])!==args[0])return 0;values.set(keys[1],args[1]);expires.set(keys[1],time+Number(args[2])*1000);return 1;}
  }
  throw Error('Unexpected store call');
});
let calls=0, scheduled=0, ready=false, unblock;
const id='a'.repeat(48);
const start=async(login,ip,opts)=>{
  calls++;assert.equal(login,'test.user');assert.equal(opts.skipAttemptLimit,true);
  if(!ready){const e=Error('pending');e.code='SLACK_DIRECTORY_PENDING';throw e;}
  if(unblock) await unblock;
  return {status:200,id,expiresIn:300};
};
const deps={store,now,start,schedule:()=>scheduled++};
const ticket=await queueCodeRequest('test.user','192.0.2.10',{store,now});
assert.equal((await pollCodeRequest(ticket.requestId,deps)).pending,true);assert.equal(calls,0);
time+=5000;assert.equal((await pollCodeRequest(ticket.requestId,deps)).pending,true);assert.equal(calls,1);assert.equal(scheduled,1);
assert.equal((await pollCodeRequest(ticket.requestId,deps)).pending,true);assert.equal(calls,1,'Polling before retry time makes no Slack request');
ready=true;time+=5000;
const concurrent=await Promise.all(Array.from({length:6},()=>pollCodeRequest(ticket.requestId,deps)));
assert.equal(calls,2,'Concurrent polls issue one code');assert.ok(concurrent.some(result=>result.id===id));
assert.equal((await pollCodeRequest(ticket.requestId,deps)).id,id);assert.equal(calls,2,'Ready result replay never resends a code');
time+=301000;assert.equal((await pollCodeRequest(ticket.requestId,deps)).status,410);
assert.equal((await pollCodeRequest('invalid',deps)).status,400);
// The browser uses the same ticket and handles cancellation without resending.
const bodies=[];let count=0;
const response=await requestSlackCode('test.user',{request:async(url,options)=>{
  bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>++count<3?{pending:true,requestId:id,retryAfter:3}:{challengeId:id,expiresIn:300}};
},wait:async()=>{}});
assert.equal(response.challengeId,id);assert.deepEqual(bodies.map(body=>body.action),['request','poll','poll']);
const controller=new AbortController();let requests=0;
await assert.rejects(requestSlackCode('test.user',{signal:controller.signal,onPending:()=>controller.abort(),wait:async()=>{},request:async()=>{requests++;return {ok:true,json:async()=>({pending:true,requestId:id})};}}),{name:'AbortError'});
assert.equal(requests,1);
// An office IP can request codes for many different logins. Target abuse and
// repeated issuance retain independent limits; polling never counts as a send.
Object.assign(process.env,{AUTH_SECRET:'rate-test',CORPORATE_AUTH_SOURCE:'directory',SLACK_IDENTITY_MODE:'email'});
const rateDeps={store,directory:async()=>null,send:async()=>{throw Error('No message expected');}};
for(let i=0;i<20;i++) assert.equal((await startChallenge(`office${i}`,'192.0.2.20',rateDeps)).status,200);
assert.equal((await startChallenge('office0','192.0.2.20',rateDeps)).reason,'cooldown');
for(let i=0;i<5;i++){time+=61000;assert.equal((await startChallenge('protected.login','192.0.2.21',rateDeps)).status,200);}
time+=61000;assert.equal((await startChallenge('protected.login','192.0.2.21',rateDeps)).reason,'login');
assert.equal((await startChallenge('network.limit','192.0.2.22',{...rateDeps,store:async()=>[301,1,1,1]})).reason,'network');
console.log('Code queue passed: automatic polling, one delivery under concurrency, replay, expiry, cancel, 20 coworkers on one IP and independent per-login/network limits. No external messages.');
