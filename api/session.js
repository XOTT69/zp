import { jsonResponse, readSessionFromCookie } from "./_auth.js";
import { getPayrollPayloadForRole, getSessionForRole } from "./_payroll-data.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    jsonResponse(res, 405, { error: "Method not allowed" });
    return;
  }

  const sessionCookie = await readSessionFromCookie(req.headers.cookie);
  const session = sessionCookie ? getSessionForRole(sessionCookie.role) : null;

  if (!session) {
    jsonResponse(res, 200, { authenticated: false });
    return;
  }

  jsonResponse(res, 200, {
    authenticated: true,
    session,
    payroll: getPayrollPayloadForRole(session.role)
  });
}
