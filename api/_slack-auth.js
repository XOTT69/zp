import {randomBytes,randomInt,createHmac} from 'node:crypto';
import {redis,hasRedis} from './_redis.js';
import {findDirectoryAccount} from './_directory.js';
import {slack} from './_slack-api.js';
import {findSlackProfileUser,rememberSlackProfileUser,profileIdentityEnabled,profileIdentityConfigured} from './_slack-profile.js';

const TTL = 300;
function authSource() { return process.env.CORPORATE_AUTH_SOURCE || 'slack-profile'; }
export function slackLoginEnabled() {
  const directory = process.env.LDAP_BRIDGE_URL && process.env.LDAP_BRIDGE_TOKEN ||
    process.env.LDAP_URL && process.env.LDAP_BIND_DN && process.env.LDAP_BIND_PASSWORD && process.env.LDAP_BASE_DN;
  const mode = process.env.SLACK_IDENTITY_MODE || 'profile';
  const identity = mode === 'profile' ? profileIdentityConfigured() : mode === 'email';
  const authority = authSource() === 'slack-profile' ? mode === 'profile' : authSource() === 'directory' && directory;
  return Boolean(process.env.LDAP_SLACK_ENABLED === 'true' && authority && identity && process.env.SLACK_BOT_TOKEN && process.env.AUTH_SECRET && hasRedis());
}
export function challengeDigest(id,code) {
  return createHmac('sha256',process.env.AUTH_SECRET).update(`${id}:${code}`).digest('hex');
}
async function findRecipient(account,{send,store,slackUserId}) {
  if (profileIdentityEnabled()) return findSlackProfileUser(account.login,{send,store,slackUserId});
  const {user} = await send('users.lookupByEmail',{email:account.email});
  return user && !user.deleted && !user.is_bot ? user : null;
}
async function findLoginIdentity(login,{directory,send,store,slackUserId}) {
  if (authSource() === 'slack-profile') {
    if (!profileIdentityEnabled()) throw new Error('Slack profile login requires profile identity');
    const user = await findSlackProfileUser(login,{send,store,slackUserId});
    return user ? {user,account:{login,displayName:String(user.real_name || user.profile?.display_name || login).slice(0,100)}} : null;
  }
  if (authSource() !== 'directory') throw new Error('Unknown corporate authentication source');
  const account = await directory(login);
  if (!account) return null;
  const user = await findRecipient(account,{send,store,slackUserId});
  return user?.id ? {account,user} : null;
}
export async function startChallenge(login,ip,{directory=findDirectoryAccount,store=redis,send=slack,slackUserId}={}) {
  const id=randomBytes(24).toString('hex');
  const key=challengeDigest('login',login);
  const ipKey=challengeDigest('ip',ip);
  const limits=await store([['INCR',`zp:otp:ip:${ipKey}`],['EXPIRE',`zp:otp:ip:${ipKey}`,900,'NX'],['SET',`zp:otp:cooldown:${key}`,'1','EX',60,'NX']]);
  if(Number(limits[0])>10 || limits[2] !== 'OK') return {status:429,retryAfter:60};
  let identity;
  try { identity = await findLoginIdentity(login,{directory,send,store,slackUserId}); }
  catch (error) {
    if (['SLACK_CONNECTION_REQUIRED','SLACK_DIRECTORY_PENDING'].includes(error.code)) await store([['DEL',`zp:otp:cooldown:${key}`]]);
    throw error;
  }
  // Identical successful shape for an unknown identifier; never disclose directory membership.
  if(!identity) return {status:200,id,expiresIn:TTL};
  const {account,user} = identity;
  const code=String(randomInt(0,1000000)).padStart(6,'0');
  const record={digest:challengeDigest(id,code),attempts:0,login:account.login,displayName:account.displayName,slackUserId:user.id,identityMode:process.env.SLACK_IDENTITY_MODE || 'profile',authSource:authSource()};
  await store([['SET',`zp:otp:${id}`,JSON.stringify(record),'EX',TTL],['SET',`zp:otp:latest:${key}`,id,'EX',TTL]]);
  try {
    await send('chat.postMessage',{channel:user.id,text:`Код входу до калькулятора ЗП: ${code}\nДіє 5 хвилин і лише один раз. Якщо ви не запитували вхід, ігноруйте повідомлення.`,unfurl_links:false,unfurl_media:false});
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

export async function finishChallenge(id,code,{store=redis,directory=findDirectoryAccount,send=slack}={}) {
  if(!/^[a-f0-9]{48}$/.test(id) || !/^\d{6}$/.test(code)) return null;
  const [raw]=await store([['EVAL',VERIFY_CHALLENGE_SCRIPT,1,`zp:otp:${id}`,challengeDigest(id,code)]]);
  if(!raw) return null;
  const record=JSON.parse(raw);
  const [latest]=await store([['GET',`zp:otp:latest:${challengeDigest('login',record.login)}`]]);
  if(latest!==id) return null;
  if (record.identityMode !== (process.env.SLACK_IDENTITY_MODE || 'profile') || record.authSource !== authSource()) return null;
  const identity = await findLoginIdentity(record.login,{directory,send,store,slackUserId:record.slackUserId});
  if (!identity || identity.user.id !== record.slackUserId) return null;
  if (profileIdentityEnabled() && !await rememberSlackProfileUser(record.login,record.slackUserId,{store})) return null;
  const {account} = identity;
  return {role:'operator',sub:account.login,displayName:account.displayName,authMethod:'ldap-slack'};
}
