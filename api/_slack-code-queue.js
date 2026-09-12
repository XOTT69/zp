import {randomBytes} from 'node:crypto';
import {redis} from './_redis.js';
import {startChallenge} from './_slack-auth.js';
import {scheduleDirectorySync,RELEASE_DIRECTORY} from './_slack-directory.js';
const TTL=900;
const key=id=>`zp:otp:queued:${id}`;
const waiting=(id,retryAfter=5)=>({status:202,pending:true,requestId:id,retryAfter,message:'Шукаємо ваш акаунт у Slack. Код надішлемо автоматично — залиште цю сторінку відкритою.'});
export const SAVE_QUEUED_REQUEST=`if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]);return 1`;
export async function queueCodeRequest(login,ip,{store=redis,now=Date.now,retryAfter=5}={}) {
  const id=randomBytes(24).toString('hex');
  await store([['SET',key(id),JSON.stringify({login,ip,deadline:now()+TTL*1000,nextAttemptAt:now()+retryAfter*1000,status:'pending'}),'EX',TTL]]);
  return waiting(id,retryAfter);
}
export async function pollCodeRequest(id,{store=redis,start=startChallenge,schedule=scheduleDirectorySync,now=Date.now}={}) {
  if(!/^[a-f0-9]{48}$/.test(id || '')) return {status:400,error:'Невірний запит.'};
  const [raw]=await store([['GET',key(id)]]);
  if(!raw) return {status:410,error:'Запит закінчився. Спробуйте отримати новий код.'};
  const record=JSON.parse(raw);
  if(record.status==='ready') return now()<record.codeExpiresAt ? record.result : {status:410,error:'Термін дії коду минув. Отримайте новий код.'};
  if(record.deadline<=now()) return {status:410,error:'Пошук зайняв надто багато часу. Перевірте LDAP або зверніться до адміністратора.'};
  if(record.nextAttemptAt>now()) return waiting(id,Math.max(1,Math.ceil((record.nextAttemptAt-now())/1000)));
  const lock=key(id)+':lock',token=randomBytes(16).toString('hex');
  const [acquired]=await store([['SET',lock,token,'EX',120,'NX']]);
  if(acquired!=='OK') return waiting(id);
  try {
    // Re-read under the lease: a concurrent poll may have already sent a code.
    const [latest]=await store([['GET',key(id)]]);
    if(!latest) return {status:410,error:'Запит закінчився.'};
    const current=JSON.parse(latest);
    if(current.status==='ready') return now()<current.codeExpiresAt ? current.result : {status:410,error:'Термін дії коду минув. Отримайте новий код.'};
    if(current.nextAttemptAt>now()) return waiting(id,Math.ceil((current.nextAttemptAt-now())/1000));
    let result;
    try { result=await start(record.login,record.ip,{store,skipAttemptLimit:true}); }
    catch(error) {
      if(error.code!=='SLACK_DIRECTORY_PENDING' && !error.retryAfter) throw error;
      if(error.code==='SLACK_DIRECTORY_PENDING') schedule({force:true});
      result={status:202,retryAfter:error.retryAfter || 5};
    }
    if(result.status===429 || result.status===202) {
      record.nextAttemptAt=now()+Math.max(1,result.retryAfter || 5)*1000;
      await store([['EVAL',SAVE_QUEUED_REQUEST,2,lock,key(id),token,JSON.stringify(record),Math.max(1,Math.ceil((record.deadline-now())/1000))]]);
      return waiting(id,result.retryAfter || 5);
    }
    record.status='ready';record.result=result;record.codeExpiresAt=now()+result.expiresIn*1000;
    const [saved]=await store([['EVAL',SAVE_QUEUED_REQUEST,2,lock,key(id),token,JSON.stringify(record),result.expiresIn]]);
    return saved===1 ? result : waiting(id);
  } finally {await store([['EVAL',RELEASE_DIRECTORY,1,lock,token]]);}
}
