import {createHmac} from 'node:crypto';
import {redis} from './_redis.js';
import {slack} from './_slack-api.js';

const BINDING_TTL = 30 * 24 * 60 * 60;
export function profileIdentityEnabled() { return (process.env.SLACK_IDENTITY_MODE || 'profile') === 'profile'; }
export function profileIdentityConfigured() {
  return Boolean(process.env.SLACK_TEAM_ID && process.env.SLACK_LDAP_FIELD_ID && process.env.AUTH_SECRET);
}
export function normalizeProfileLogin(value) {
  if (typeof value !== 'string') return null;
  const login = value.trim().toLowerCase();
  return /^[a-z0-9._-]{2,80}$/.test(login) ? login : null;
}
function bindingKey(login) { return `zp:slack-login:v2:${process.env.SLACK_TEAM_ID}:${process.env.SLACK_LDAP_FIELD_ID}:${loginKey(login)}`; }
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
  if (!field) throw new Error('LDAP profile field is missing');
  // The owner may attest that IT controls editing outside this API flag. Scope
  // that trust to an exact workspace/field pair; never infer it from a login.
  const attested = process.env.SLACK_LDAP_FIELD_ATTESTATION === `${process.env.SLACK_TEAM_ID}:${field.id}`;
  if (field.options?.is_protected !== true && !attested) throw new Error('LDAP profile field needs administrator protection or owner attestation');
}

// No directory scan. An unbound login needs a Member ID supplied by its owner.
// The ID only selects a candidate; current workspace, account, LDAP and OTP still
// prove identity. A binding is saved only after successful OTP verification.
export async function findSlackProfileUser(login,{send=slack,store=redis,slackUserId}={}) {
  login = normalizeProfileLogin(login);
  if (!login) return null;
  await checkField(send);
  const [boundId] = await store([['GET',bindingKey(login)]]);
  if (boundId && slackUserId && boundId !== slackUserId) return null;
  const id = boundId || slackUserId;
  if (!id) {
    const error = new Error('Slack Member ID is required for the first login');
    error.code = 'SLACK_ID_REQUIRED';
    throw error;
  }
  if (!/^[UW][A-Z0-9]{2,79}$/.test(id)) return null;
  const {user} = await send('users.info',{user:id});
  if (!eligible(user) || user.id !== id) return null;
  const {profile} = await send('users.profile.get',{user:id});
  if (normalizeProfileLogin(profile?.fields?.[process.env.SLACK_LDAP_FIELD_ID]?.value) !== login) return null;
  return user;
}

// Atomic first claim: a second Slack account cannot replace an existing binding.
export const REMEMBER_PROFILE_SCRIPT = `
local current=redis.call('GET',KEYS[1])
if current and current~=ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); return 1`;

export async function rememberSlackProfileUser(login,id,{store=redis}={}) {
  login = normalizeProfileLogin(login);
  if (!login || !/^[UW][A-Z0-9]{2,79}$/.test(id || '')) return false;
  const [saved] = await store([['EVAL',REMEMBER_PROFILE_SCRIPT,1,bindingKey(login),id,BINDING_TTL]]);
  return saved === 1;
}
