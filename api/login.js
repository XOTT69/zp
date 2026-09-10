import { createSessionCookie, jsonResponse, readJsonBody } from "./_auth.js";
import { ACCESS_CONFIG, getPayrollPayloadForRole, getRoleCode, getSessionForRole } from "./_payroll-data.js";
import { recordAuthEvent } from "./_stats-store.js";
import { clearLoginAttempts, consumeLoginAttempt } from "./_login-rate-limit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    if (process.env.ROLE_CODE_LOGIN_ENABLED === 'false') {
      jsonResponse(res, 403, { error: 'Використайте корпоративний вхід.' });
      return;
    }
    const { role, code, password } = await readJsonBody(req);
    const accessCode = code ?? password;
    const rateLimit = await consumeLoginAttempt(req, role);
    if (!rateLimit.allowed) {
      jsonResponse(res, 429, { error: "Забагато спроб входу. Спробуйте пізніше." }, {
        "Retry-After": String(rateLimit.retryAfter)
      });
      return;
    }
    const roleConfig = ACCESS_CONFIG[role];
    const expectedCode = roleConfig ? getRoleCode(role) : "";

    if (!roleConfig || !expectedCode || accessCode !== expectedCode) {
      await recordAuthEvent({ role: role || "unknown", success: false });
      jsonResponse(res, 401, { error: expectedCode ? "Невірний код доступу." : "Код доступу для ролі не налаштовано." });
      return;
    }

    const session = getSessionForRole(role);
    const payroll = getPayrollPayloadForRole(role);
    const cookie = await createSessionCookie(role);

    await clearLoginAttempts(req, role);
    await recordAuthEvent({ role, success: true });
    jsonResponse(res, 200, { authenticated: true, session, payroll }, { "Set-Cookie": cookie });
  } catch (error) {
    const message = error?.message === "AUTH_SECRET is required"
      ? "На Vercel не задано AUTH_SECRET."
      : "Не вдалося обробити запит.";
    jsonResponse(res, 400, { error: message });
  }
}
