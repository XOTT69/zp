import {createHmac} from 'node:crypto';
import {redis} from './_redis.js';
import {slack} from './_slack-api.js';

const INDEX_TTL = 24 * 60 * 60;
export function profileIdentityEnabled() { return (process.env.SLACK_IDENTITY_MODE || 'profile') === 'profile'; }
export function profileIdentityConfigured() {
  return Boolean(process.env.SLACK_TEAM_ID && process.env.SLACK_LDAP_FIELD_ID && process.env.AUTH_SECRET);
}
export function normalizeProfileLogin(value) {
  if (typeof value !== 'string') return null;
  const login = value.trim().toLowerCase();
  return /^[a-z0-9._-]{2,80}$/.test(login) ? login : null;
}
function indexKey() { return `zp:slack-profile:${process.env.SLACK_TEAM_ID}:${process.env.SLACK_LDAP_FIELD_ID}`; }
function loginKey(login) { return createHmac('sha256',process.env.AUTH_SECRET).update(`slack-profile:${login}`).digest('hex'); }
function eligible(user) {
  return /^[UW][A-Z0-9]+$/.test(user?.id || '') && user.team_id === process.env.SLACK_TEAM_ID &&
    !user.deleted && !user.is_bot && !user.is_app_user && !user.is_restricted && !user.is_ultra_restricted;
}
async function checkField(send) {
  if (!profileIdentityConfigured()) throw new Error('Slack profile identity is not configured');
  const auth = await send('auth.test',{});
  if (auth.team_id !== process.env.SLACK_TEAM_ID) throw new Error('Unexpected Slack workspace');
  const result = await send('team.profile.get',{});
  const field = result.profile?.fields?.find(item=>item.id === process.env.SLACK_LDAP_FIELD_ID);
  // A self-editable login field could let a member claim another employee's identity.
  if (field?.options?.is_protected !== true) throw new Error('LDAP profile field must be protected by the workspace administrator');
}

// Run outside the login request: a large workspace needs paginated profile reads.
// Publish one complete index atomically; failed scans leave the old index untouched.
export async function syncProfileIndex({send=slack,store=redis,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),progress=()=>{},now=Date.now}={}) {
  await checkField(send);
  const entries = Object.create(null), seenUsers = new Set(), cursors = new Set();
  let cursor = '', scanned = 0, duplicates = 0;
  do {
    const page = await send('users.list',{limit:200,...(cursor ? {cursor} : {})});
    if (!Array.isArray(page.members)) throw new Error('Incomplete Slack member list');
    for (const user of page.members) {
      if (!eligible(user) || seenUsers.has(user.id)) continue;
      seenUsers.add(user.id);
      const {profile} = await send('users.profile.get',{user:user.id});
      if (!profile || typeof profile !== 'object') throw new Error('Incomplete Slack profile');
      const login = normalizeProfileLogin(profile.fields?.[process.env.SLACK_LDAP_FIELD_ID]?.value);
      if (login) {
        const key = loginKey(login);
        if (Object.hasOwn(entries,key)) { if(entries[key] !== null) duplicates++; entries[key] = null; }
        else entries[key] = user.id;
      }
      scanned++;
      progress({scanned,duplicates});
      await pause(750);
    }
    const next = page.response_metadata?.next_cursor;
    if (next !== undefined && typeof next !== 'string') throw new Error('Invalid Slack cursor');
    cursor = (next || '').trim();
    if (cursor && cursors.has(cursor)) throw new Error('Repeated Slack cursor');
    if (cursor) { cursors.add(cursor); await pause(1500); }
  } while (cursor);
  const index = {version:1,teamId:process.env.SLACK_TEAM_ID,fieldId:process.env.SLACK_LDAP_FIELD_ID,createdAt:now(),entries};
  await store([['SET',indexKey(),JSON.stringify(index),'EX',INDEX_TTL]]);
  return {scanned,duplicates,mapped:Object.values(entries).filter(Boolean).length};
}

export async function findSlackProfileUser(login,{send=slack,store=redis,now=Date.now}={}) {
  login = normalizeProfileLogin(login);
  if (!login) return null;
  await checkField(send);
  const [raw] = await store([['GET',indexKey()]]);
  if (!raw) throw new Error('Slack profile index needs synchronization');
  const index = JSON.parse(raw);
  if (index.version !== 1 || index.teamId !== process.env.SLACK_TEAM_ID || index.fieldId !== process.env.SLACK_LDAP_FIELD_ID ||
      !Number.isFinite(index.createdAt) || index.createdAt > now() || now()-index.createdAt >= INDEX_TTL*1000) throw new Error('Stale Slack profile index');
  const key = loginKey(login);
  const id = Object.hasOwn(index.entries || {},key) ? index.entries[key] : null;
  if (!/^[UW][A-Z0-9]+$/.test(id || '')) return null; // Unknown and duplicate logins both fail closed.
  const {user} = await send('users.info',{user:id});
  if (!eligible(user) || user.id !== id) return null;
  const {profile} = await send('users.profile.get',{user:id});
  if (normalizeProfileLogin(profile?.fields?.[process.env.SLACK_LDAP_FIELD_ID]?.value) !== login) return null;
  return user;
}
