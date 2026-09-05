import {randomBytes,randomInt,createHmac} from 'node:crypto';
import {redis,hasRedis} from './_redis.js';
import {findDirectoryAccount} from './_directory.js';

const TTL = 300;
export function slackLoginEnabled() {
  const directory = process.env.LDAP_BRIDGE_URL && process.env.LDAP_BRIDGE_TOKEN ||
    process.env.LDAP_URL && process.env.LDAP_BIND_DN && process.env.LDAP_BIND_PASSWORD && process.env.LDAP_BASE_DN;
  return Boolean(process.env.LDAP_SLACK_ENABLED === 'true' && directory && process.env.SLACK_BOT_TOKEN && process.env.AUTH_SECRET && hasRedis());
}
export function challengeDigest(id,code) {
  return createHmac('sha256',process.env.AUTH_SECRET).update(`${id}:${code}`).digest('hex');
}
async function slack(method,body) {
  const lookup = method === 'users.lookupByEmail';
  const response=await fetch(`https://slack.com/api/${method}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SLACK_BOT_TOKEN}`,'Content-Type':lookup ? 'application/x-www-form-urlencoded' : 'application/json; charset=utf-8'},body:lookup ? new URLSearchParams(body) : JSON.stringify(body),signal:AbortSignal.timeout(7000)});
  const result=await response.json();
  if(response.ok && lookup && result.error === 'users_not_found') return {user:null};
  if(!response.ok || !result.ok) throw new Error('Slack delivery failed');
  return result;
}
export async function startChallenge(login,ip,{directory=findDirectoryAccount,store=redis,send=slack}={}) {
  const id=randomBytes(24).toString('hex');
  const key=challengeDigest('login',login);
  const ipKey=challengeDigest('ip',ip);
  const limits=await store([['INCR',`zp:otp:ip:${ipKey}`],['EXPIRE',`zp:otp:ip:${ipKey}`,900,'NX'],['SET',`zp:otp:cooldown:${key}`,'1','EX',60,'NX']]);
  if(Number(limits[0])>10 || limits[2] !== 'OK') return {status:429,retryAfter:60};
  const account=await directory(login);
  // Identical successful shape for an unknown identifier; never disclose directory membership.
  if(!account) return {status:200,id,expiresIn:TTL};
  const user=await send('users.lookupByEmail',{email:account.email});
  if(!user.user?.id || user.user.deleted || user.user.is_bot) return {status:200,id,expiresIn:TTL};
  const code=String(randomInt(0,1000000)).padStart(6,'0');
  const record={digest:challengeDigest(id,code),attempts:0,login:account.login,displayName:account.displayName};
  await store([['SET',`zp:otp:${id}`,JSON.stringify(record),'EX',TTL],['SET',`zp:otp:latest:${key}`,id,'EX',TTL]]);
  try {
    await send('chat.postMessage',{channel:user.user.id,text:`Код входу до калькулятора ЗП: ${code}\nДіє 5 хвилин і лише один раз. Якщо ви не запитували вхід, ігноруйте повідомлення.`,unfurl_links:false,unfurl_media:false});
  } catch(error) { await store([['DEL',`zp:otp:${id}`]]); throw error; }
  return {status:200,id,expiresIn:TTL};
}

// Verify, increment attempts and consume in one atomic operation across all instances.
export const VERIFY_CHALLENGE_SCRIPT = `
local raw=redis.call('GET',KEYS[1]); if not raw then return false end
local record=cjson.decode(raw)
if record.attempts>=5 then redis.call('DEL',KEYS[1]); return false end
if record.digest~=ARGV[1] then
 record.attempts=record.attempts+1
 if record.attempts>=5 then redis.call('DEL',KEYS[1]) else redis.call('SET',KEYS[1],cjson.encode(record),'KEEPTTL') end
 return false
end
redis.call('DEL',KEYS[1]); return raw`;

export async function finishChallenge(id,code,{store=redis,directory=findDirectoryAccount}={}) {
  if(!/^[a-f0-9]{48}$/.test(id) || !/^\d{6}$/.test(code)) return null;
  const [raw]=await store([['EVAL',VERIFY_CHALLENGE_SCRIPT,1,`zp:otp:${id}`,challengeDigest(id,code)]]);
  if(!raw) return null;
  const record=JSON.parse(raw);
  const [latest]=await store([['GET',`zp:otp:latest:${challengeDigest('login',record.login)}`]]);
  if(latest!==id) return null;
  const account=await directory(record.login);
  if(!account) return null;
  return {role:'operator',sub:account.login,displayName:account.displayName,authMethod:'ldap-slack'};
}
