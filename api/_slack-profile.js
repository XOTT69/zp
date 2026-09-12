import {redis} from './_redis.js';
import {slack} from './_slack-api.js';
import {normalizeProfileLogin,loginKey,eligible,checkField} from './_slack-profile-fields.js';
import {directoryEnabled,lookupDirectory} from './_slack-directory.js';
export {profileIdentityEnabled,profileIdentityConfigured,normalizeProfileLogin} from './_slack-profile-fields.js';
const BINDING_TTL = 30 * 24 * 60 * 60;
function bindingKey(login) { return `zp:slack-login:v2:${process.env.SLACK_TEAM_ID}:${process.env.SLACK_LDAP_FIELD_ID}:${loginKey(login)}`; }

// Directory entries are candidates only: current account and LDAP are checked
// before sending an OTP and again before creating a session.
export async function findSlackProfileUser(login,{send=slack,store=redis,slackUserId}={}) {
  login = normalizeProfileLogin(login);
  if (!login) return null;
  await checkField(send);
  const [boundId] = await store([['GET',bindingKey(login)]]);
  if (boundId && slackUserId && boundId !== slackUserId) return null;
  let candidate;
  if (directoryEnabled()) {
    const match = await lookupDirectory(login,{store});
    if (match.duplicate) return null;
    if (match.id && (boundId || slackUserId) && match.id !== (boundId || slackUserId)) return null;
    candidate = match.id;
    if (!candidate && !boundId && !slackUserId) {
      if (match.pending) { const error=new Error('Slack directory is updating');error.code='SLACK_DIRECTORY_PENDING';throw error; }
      return null;
    }
  }
  const id = candidate || boundId || slackUserId;
  if (!id) {
    const error = new Error('Slack account connection is required');
    error.code = 'SLACK_CONNECTION_REQUIRED';
    throw error;
  }
  if (!/^[UW][A-Z0-9]{2,79}$/.test(id)) return null;
  const [{user},{profile}]=await Promise.all([send('users.info',{user:id}),send('users.profile.get',{user:id})]);
  if (!eligible(user) || user.id !== id) return null;
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

// Only call for a sender authenticated by a verified Slack request signature.
export async function connectSlackProfileUser(id,{send=slack,store=redis}={}) {
  await checkField(send);
  const {user} = await send('users.info',{user:id});
  if (!eligible(user) || user.id !== id) return false;
  const {profile} = await send('users.profile.get',{user:id});
  const login = normalizeProfileLogin(profile?.fields?.[process.env.SLACK_LDAP_FIELD_ID]?.value);
  return Boolean(login && await rememberSlackProfileUser(login,id,{store}));
}
