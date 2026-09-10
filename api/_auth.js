export const SESSION_COOKIE = "zp_session";
// Keep a signed session for a month and refresh it while the user is active.
// The cookie contains no password or access code.
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function createSessionCookie(role, identity = {}) {
  const authMethod = identity.authMethod === 'ldap-slack' ? 'ldap-slack' : 'role-code';
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = authMethod === 'ldap-slack' ? (identity.exp || now + 8 * 3600) : now + SESSION_TTL_SECONDS;
  const maxAge = Math.max(0, expiresAt - now);
  const payload = encodeURIComponent(JSON.stringify({ role, exp: expiresAt, authMethod,
    ...(identity.sub ? {sub:String(identity.sub).slice(0,80)} : {}),
    version:await sessionVersion(role,authMethod) }));
  const signature = await sign(payload);
  return `${SESSION_COOKIE}=${payload}.${signature}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secureCookieSuffix()}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureCookieSuffix()}`;
}

export async function readSessionFromCookie(cookieHeader) {
  const rawCookie = parseCookies(cookieHeader)[SESSION_COOKIE];
  if (!rawCookie) return null;

  const separator = rawCookie.lastIndexOf(".");
  const payload = rawCookie.slice(0, separator);
  const signature = rawCookie.slice(separator + 1);
  if (!payload || !signature) return null;

  const expectedSignature = await sign(payload);
  if (!constantTimeEqual(signature, expectedSignature)) return null;

  try {
    const session = JSON.parse(decodeURIComponent(payload));
    if (!session.role || !session.exp || session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (session.authMethod === 'ldap-slack' && process.env.LDAP_SLACK_ENABLED !== 'true') return null;
    if (session.authMethod === 'role-code' && process.env.ROLE_CODE_LOGIN_ENABLED === 'false') return null;
    if (session.version !== await sessionVersion(session.role, session.authMethod || 'role-code')) return null;
    return session;
  } catch {
    return null;
  }
}

async function sessionVersion(role, method) {
  const keys = {admin:'ADMIN_ACCESS_CODE',operator:'OPERATOR_ACCESS_CODE',supervisor:'SUPERVISOR_ACCESS_CODE',level4:'LEVEL4_ACCESS_CODE',xd:'XD_ACCESS_CODE',video:'VIDEO_ACCESS_CODE',iron:'IRON_ACCESS_CODE'};
  const roleCode = method === 'role-code' ? process.env[keys[role]] || '' : '';
  const identityContext = method === 'ldap-slack' ? JSON.stringify([
    process.env.CORPORATE_AUTH_SOURCE || 'slack-profile', process.env.SLACK_IDENTITY_MODE || 'profile',
    process.env.SLACK_TEAM_ID || '', process.env.SLACK_LDAP_FIELD_ID || '', process.env.SLACK_LDAP_FIELD_ATTESTATION || ''
  ]) : '';
  return sign(`${process.env.AUTH_SESSION_VERSION || '1'}:${role}:${method}:${roleCode}${identityContext}`);
}

export function jsonResponse(res, status, body, headers = {}) {
  res.statusCode = status;
  Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    size += new TextEncoder().encode(text).byteLength;
    if (size > 128 * 1024) throw new Error("Request body is too large");
    chunks.push(text);
  }
  const raw = chunks.join("");
  const contentType = req.headers?.["content-type"] ?? req.headers?.get?.("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return raw ? JSON.parse(raw) : {};
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    (cookieHeader || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), part.slice(index + 1)];
      })
  );
}

async function sign(payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required");
  }
  return secret;
}

function secureCookieSuffix() {
  return process.env.NODE_ENV === "development" ? "" : "; Secure";
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}
