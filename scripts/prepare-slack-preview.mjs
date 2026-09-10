import {slack} from '../api/_slack-api.js';

// Saved Vercel secrets are write-only outside deployment runtimes. Inspect only
// non-secret setup metadata in Preview; never print tokens or employee profiles.
if (process.env.VERCEL_ENV === 'preview' && process.env.SLACK_BOT_TOKEN && !process.env.SLACK_LDAP_FIELD_ID) {
  try {
    const auth = await slack('auth.test');
    const result = await slack('team.profile.get');
    const ldapFields = (result.profile?.fields || []).filter(field=>field.label?.trim().toLowerCase() === 'ldap')
      .map(field=>({id:field.id,label:field.label,protected:field.options?.is_protected ?? null,isScim:field.options?.is_scim ?? null}));
    console.log('[Slack setup]',JSON.stringify({teamId:auth.team_id,ldapFields}));
  } catch (error) {
    console.error('[Slack setup]',error.message);
  }
}
