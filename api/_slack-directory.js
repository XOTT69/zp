import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {waitUntil} from '@vercel/functions';
import {redis} from './_redis.js';
import {slack} from './_slack-api.js';
import {checkField,eligible,normalizeProfileLogin,loginKey} from './_slack-profile-fields.js';

const HOUR=3600000, RETENTION=7*24*3600;
export const directoryEnabled=()=>process.env.SLACK_DIRECTORY_ENABLED==='true';
export function directoryKeys() {
  const context=loginKey(`directory:${process.env.SLACK_LDAP_FIELD_ATTESTATION || ''}`);
  const base=`zp:slack-directory:v1:${process.env.SLACK_TEAM_ID}:${process.env.SLACK_LDAP_FIELD_ID}:${context}`;
  return {snapshot:base,job:base+':job',lock:base+':lock'};
}
const decode=raw=>raw ? JSON.parse(raw) : null;
function validSnapshot(value,now) {
  return value?.version===1 && Number.isFinite(value.createdAt) && value.createdAt<=now && now-value.createdAt<RETENTION*1000 && value.entries && typeof value.entries==='object';
}
export async function lookupDirectory(login,{store=redis,now=Date.now}={}) {
  const keys=directoryKeys();
  const [raw,jobRaw]=await store([['GET',keys.snapshot],['GET',keys.job]]);
  const snapshot=decode(raw), job=decode(jobRaw), time=now(), key=loginKey(login);
  const complete=validSnapshot(snapshot,time), partial=job && Number.isFinite(job.startedAt) && time-job.startedAt<RETENTION*1000 && job.startedAt<=time;
  const old=complete && Object.hasOwn(snapshot.entries,key) ? snapshot.entries[key] : undefined;
  const current=partial && Object.hasOwn(job.entries || {},key) ? job.entries[key] : undefined;
  // A discovered entry is a candidate, never authentication. Its current IT
  // field, active account and ownership via OTP are still required. Known
  // duplicates/conflicts fail closed, including during an incomplete refresh.
  if(old===null || current===null || (old && current && old!==current)) return {duplicate:true};
  const id=current || old;
  if(/^[UW][A-Z0-9]{2,79}$/.test(id || '')) return {id};
  return {pending:!complete || time-snapshot.createdAt>=HOUR};
}
// A lease owner alone can checkpoint or publish. Interrupted slices resume from
// their last checkpoint; an incomplete scan never replaces the live snapshot.
export const CHECKPOINT_DIRECTORY=`if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]); return 1`;
export const PUBLISH_DIRECTORY=`if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]);redis.call('DEL',KEYS[3]);return 1`;
export const RELEASE_DIRECTORY=`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`;
export async function runDirectoryBatch({send=slack,store=redis,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now,force=false,maxProfiles=40,budgetMs=40000}={}) {
  const keys=directoryKeys(), token=randomBytes(16).toString('hex');
  const [locked]=await store([['SET',keys.lock,token,'EX',120,'NX']]);
  if(locked!=='OK') return {busy:true};
  try {
    const [rawJob,rawSnapshot]=await store([['GET',keys.job],['GET',keys.snapshot]]);
    const snapshot=decode(rawSnapshot);
    let job=decode(rawJob);
    if(!job && validSnapshot(snapshot,now()) && now()-snapshot.createdAt<(force?HOUR:24*HOUR)) return {fresh:true};
    if(!job || now()-job.startedAt>RETENTION*1000) job={startedAt:now(),cursor:'',pending:[],seen:[],cursors:[],entries:{},scanned:0,pages:0,end:false};
    if(job.retryAt>now()) return {pending:true,retryAfter:Math.ceil((job.retryAt-now())/1000)};
    await checkField(send);
    const start=now(), seen=new Set(job.seen); let count=0;
    try {
      while(count<maxProfiles && now()-start<budgetMs) {
        if(!job.pending.length) {
          if(job.end) break;
          const page=await send('users.list',{limit:200,...(job.cursor?{cursor:job.cursor}:{})});
          if(!Array.isArray(page.members)) throw new Error('Incomplete Slack list');
          const next=page.response_metadata?.next_cursor;
          if(next!==undefined && typeof next!=='string') throw new Error('Invalid Slack pagination');
          job.cursor=(next || '').trim();
          if(job.cursor && job.cursors.includes(job.cursor)) throw new Error('Repeated Slack cursor');
          if(job.cursor) job.cursors.push(job.cursor);
          job.end=!job.cursor; job.pages++;
          if(job.pages>1000) throw new Error('Slack directory exceeds page limit');
          job.pending=[...new Set(page.members.filter(eligible).map(user=>user.id))].filter(id=>!seen.has(id));
          // Paginated users.list is Tier 2, including pages with no eligible users.
          await pause(3100);
          continue;
        }
        const id=job.pending[0];
        let profile;
        try { ({profile}=await send('users.profile.get',{user:id})); }
        catch(error) {
          // An account can disappear between listing and reading its profile.
          if(!['user_not_found','users_not_found','account_inactive'].includes(error.code)) throw error;
          seen.add(id);job.pending.shift();job.scanned++;count++;await pause(900);continue;
        }
        if(!profile || typeof profile!=='object') throw new Error('Incomplete Slack profile');
        const login=normalizeProfileLogin(profile.fields?.[process.env.SLACK_LDAP_FIELD_ID]?.value);
        if(login) {
          const key=loginKey(login);
          if(Object.hasOwn(job.entries,key) && job.entries[key]!==id) job.entries[key]=null;
          else job.entries[key]=id;
        }
        seen.add(id);job.pending.shift();job.scanned++;count++;
        // Leave capacity for interactive users.profile.get requests.
        await pause(900);
      }
      job.retryAt=0;job.failures=0;
    } catch(error) {
      if(error.code==='invalid_cursor') {
        job.cursor='';job.cursors=[];job.end=false;job.retryAt=now()+3000;
      } else if(error.retryAfter) job.retryAt=now()+Math.min(3600,Math.max(1,error.retryAfter))*1000;
      else { // Save progress before surfacing a transient error; never log profiles.
        job.seen=[...seen];await store([['EVAL',CHECKPOINT_DIRECTORY,2,keys.lock,keys.job,token,JSON.stringify(job),RETENTION]]);
        job.failures=(job.failures || 0)+1;
        if(job.failures>5) throw error;
        job.retryAt=now()+Math.min(120,job.failures*15)*1000;
      }
    }
    job.seen=[...seen];
    if(job.end && !job.pending.length) {
      const result={version:1,createdAt:now(),entries:job.entries,scanned:job.scanned};
      const [published]=await store([['EVAL',PUBLISH_DIRECTORY,3,keys.lock,keys.snapshot,keys.job,token,JSON.stringify(result),RETENTION]]);
      if(published!==1) return {busy:true};
      return {complete:true,scanned:job.scanned,mapped:Object.values(job.entries).filter(Boolean).length,duplicates:Object.values(job.entries).filter(id=>id===null).length};
    }
    const [saved]=await store([['EVAL',CHECKPOINT_DIRECTORY,2,keys.lock,keys.job,token,JSON.stringify(job),RETENTION]]);
    return saved===1 ? {pending:true,scanned:job.scanned,retryAfter:Math.max(1,Math.ceil((job.retryAt-now())/1000))} : {busy:true};
  } finally { await store([['EVAL',RELEASE_DIRECTORY,1,keys.lock,token]]); }
}
export async function directoryStatus({store=redis}={}) {
  const keys=directoryKeys();const [raw,jobRaw]=await store([['GET',keys.snapshot],['GET',keys.job]]);
  const data=decode(raw),job=decode(jobRaw);
  return {ready:validSnapshot(data,Date.now()),updatedAt:data?.createdAt || null,scanned:data?.scanned || 0,mapped:data?Object.values(data.entries).filter(Boolean).length:0,duplicates:data?Object.values(data.entries).filter(id=>id===null).length:0,progress:job?.scanned || 0,retryAt:job?.retryAt || null};
}
function signedContinuation(timestamp) { return createHmac('sha256',process.env.AUTH_SECRET).update(`slack-directory:${timestamp}`).digest('hex'); }
function constantEqual(a,b) { return typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b)); }
export function authorizedDirectoryRequest(req,now=Date.now()) {
  if(process.env.CRON_SECRET && constantEqual(req.headers.authorization,`Bearer ${process.env.CRON_SECRET}`)) return true;
  const timestamp=req.headers['x-directory-time'],sig=req.headers['x-directory-signature'];
  return Boolean(process.env.AUTH_SECRET && /^\d{13}$/.test(timestamp || '') && Math.abs(now-Number(timestamp))<120000 && /^[a-f0-9]{64}$/.test(sig || '') && constantEqual(sig,signedContinuation(timestamp)));
}
// Each invocation is bounded, with a signed continuation to the fixed configured
// host. No credentials are sent to a request-provided URL or redirect target.
export function scheduleDirectorySync({force=false,runLater=waitUntil,runBatch=runDirectoryBatch,request=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  if(!directoryEnabled()) return;
  runLater((async()=>{
    const result=await runBatch({force});
    if(result.complete) console.log('[Slack directory]',JSON.stringify(result));
    if(!result.pending || result.retryAfter>180 || !process.env.SLACK_DIRECTORY_ORIGIN) return;
    await pause(Math.max(1,result.retryAfter || 1)*1000);
    const target=new URL('/api/corporate-auth?action=directory-sync',process.env.SLACK_DIRECTORY_ORIGIN);
    if(target.protocol!=='https:') throw new Error('Directory continuation requires HTTPS');
    const timestamp=String(Date.now());
    const response=await request(target,{method:'POST',redirect:'error',headers:{'x-directory-time':timestamp,'x-directory-signature':signedContinuation(timestamp)},signal:AbortSignal.timeout(7000)});
    if(!response.ok) throw new Error('Directory continuation failed');
  })().catch(()=>console.error('[Slack directory] Synchronization paused; the next login or scheduled run will resume it.')));
}
