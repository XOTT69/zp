import {profileIdentityEnabled} from './_slack-profile.js';

export function escapeLdapFilter(value) {
  return String(value).replace(/[\\*()\0]/g, char=>`\\${char.charCodeAt(0).toString(16).padStart(2,'0')}`);
}

export async function findDirectoryAccount(login) {
  // The bridge alternative is for directories reachable only inside the corporate network.
  if (process.env.LDAP_BRIDGE_URL) {
    const url = new URL(process.env.LDAP_BRIDGE_URL);
    if (url.protocol !== 'https:') throw new Error('LDAP bridge must use HTTPS');
    const response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.LDAP_BRIDGE_TOKEN}`},body:JSON.stringify({login}),signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('Directory unavailable');
    return validateDirectoryAccount(await response.json(),login);
  }
  if (!process.env.LDAP_URL?.startsWith('ldaps://')) throw new Error('LDAPS is required');
  const {Client} = await import('ldapts');
  const client = new Client({url:process.env.LDAP_URL,connectTimeout:5000,timeout:7000,
    tlsOptions:{minVersion:'TLSv1.2',rejectUnauthorized:true,...(process.env.LDAP_CA_CERT ? {ca:process.env.LDAP_CA_CERT.replace(/\\n/g,'\n')} : {})}});
  try {
    await client.bind(process.env.LDAP_BIND_DN,process.env.LDAP_BIND_PASSWORD);
    const template = process.env.LDAP_SEARCH_FILTER || '(&(objectClass=user)(sAMAccountName={{login}})(!(userAccountControl:1.2.840.113556.1.4.803:=2)))';
    if (!template.includes('{{login}}')) throw new Error('LDAP filter must restrict the login');
    const result = await client.search(process.env.LDAP_BASE_DN,{scope:'sub',sizeLimit:2,
      filter:template.replaceAll('{{login}}',escapeLdapFilter(login)),attributes:[...(!profileIdentityEnabled()?['mail']:[]),'displayName','sAMAccountName','userAccountControl']});
    if (result.searchEntries.length !== 1) return null;
    const entry = result.searchEntries[0];
    const value = key=>Array.isArray(entry[key]) ? entry[key][0] : entry[key];
    if (Number(value('userAccountControl') || 0) & 2) return null;
    return validateDirectoryAccount({active:true,email:value('mail'),displayName:value('displayName')},login);
  } finally { await client.unbind().catch(()=>{}); }
}

export function validateDirectoryAccount(account,login) {
  if (account?.active !== true) return null;
  const identity = {login,displayName:String(account.displayName || login).slice(0,100)};
  if (profileIdentityEnabled()) return identity;
  if (typeof account.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) return null;
  const allowed = (process.env.LDAP_EMAIL_DOMAINS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(account.email.split('@').at(-1).toLowerCase())) return null;
  return {...identity,email:account.email.toLowerCase()};
}
