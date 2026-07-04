import { createSessionCookie, jsonResponse, readJsonBody } from "./_auth.js";
import { ACCESS_CONFIG, getPayrollPayloadForRole, getRoleCode, getSessionForRole } from "./_payroll-data.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const { role, code } = await readJsonBody(req);
    const roleConfig = ACCESS_CONFIG[role];

    if (!roleConfig || code !== getRoleCode(role)) {
      jsonResponse(res, 401, { error: "Невірний код доступу." });
      return;
    }

    const session = getSessionForRole(role);
    const payroll = getPayrollPayloadForRole(role);
    const cookie = await createSessionCookie(role);

    jsonResponse(res, 200, { authenticated: true, session, payroll }, { "Set-Cookie": cookie });
  } catch {
    jsonResponse(res, 400, { error: "Не вдалося обробити запит." });
  }
}
