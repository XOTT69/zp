import {createHmac,createHash} from 'node:crypto';
import {slack} from './_slack-api.js';
const fieldChecks=new Map();
export function profileIdentityEnabled() { return (process.env.SLACK_IDENTITY_MODE || 'profile') === 'profile'; }
export function profileIdentityConfigured() {
  return Boolean(process.env.SLACK_TEAM_ID && process.env.SLACK_LDAP_FIELD_ID && process.env.AUTH_SECRET);
}
export function normalizeProfileLogin(value) {
  if (typeof value !== 'string') return null;
  const login = value.trim().toLowerCase();
  return /^[a-z0-9._-]{2,80}$/.test(login) ? login : null;
}
export function loginKey(login) { return createHmac('sha256',process.env.AUTH_SECRET).update(`slack-profile:${login}`).digest('hex'); }
export function eligible(user) {
  return /^[UW][A-Z0-9]+$/.test(user?.id || '') && user.team_id === process.env.SLACK_TEAM_ID &&
    !user.deleted && !user.is_bot && !user.is_app_user && !user.is_restricted && !user.is_ultra_restricted;
}
export async function checkField(send) {
  // Cache only real Slack workspace metadata; user activity and LDAP are never
  // cached. Separate credentials/configuration cannot reuse a previous check.
  if(send!==slack) return validateField(send);
  const context=createHash('sha256').update(JSON.stringify([process.env.SLACK_BOT_TOKEN,process.env.AUTH_SECRET,process.env.SLACK_TEAM_ID,process.env.SLACK_LDAP_FIELD_ID,process.env.SLACK_LDAP_FIELD_ATTESTATION])).digest('hex');
  const cached=fieldChecks.get(context);
  if(cached && cached.until>Date.now()) return cached.promise;
  const entry={until:Date.now()+60000,promise:null};
  entry.promise=validateField(send).catch(error=>{if(fieldChecks.get(context)===entry) fieldChecks.delete(context);throw error;});
  fieldChecks.clear();fieldChecks.set(context,entry);
  return entry.promise;
}
async function validateField(send) {
  if (!profileIdentityConfigured()) throw new Error('Slack profile identity is not configured');
  const [auth,result]=await Promise.all([send('auth.test',{}),send('team.profile.get',{})]);
  if (auth.team_id !== process.env.SLACK_TEAM_ID) throw new Error('Unexpected Slack workspace');
  const field = result.profile?.fields?.find(item=>item.id === process.env.SLACK_LDAP_FIELD_ID);
  if (!field) throw new Error('LDAP profile field is missing');
  // The owner may attest that IT controls editing outside this API flag. Scope
  // that trust to an exact workspace/field pair; never infer it from a login.
  const attested = process.env.SLACK_LDAP_FIELD_ATTESTATION === `${process.env.SLACK_TEAM_ID}:${field.id}`;
  if (field.options?.is_protected !== true && !attested) throw new Error('LDAP profile field needs administrator protection or owner attestation');
}

