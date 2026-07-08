import { jsonResponse, readSessionFromCookie } from "./_auth.js";
import { getSessionForRole } from "./_payroll-data.js";
import { getPaymentRules } from "./_payment-rules.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    jsonResponse(res, 405, { error: "Method not allowed" });
    return;
  }

  const sessionCookie = await readSessionFromCookie(req.headers.cookie);
  const session = sessionCookie ? getSessionForRole(sessionCookie.role) : null;
  if (!session) {
    jsonResponse(res, 401, { error: "Unauthorized" });
    return;
  }

  jsonResponse(res, 200, { rules: await getPaymentRules() });
}
