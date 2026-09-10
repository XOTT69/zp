import {createHmac} from 'node:crypto';
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

