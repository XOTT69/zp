import { jsonResponse, readJsonBody, readSessionFromCookie } from "./_auth.js";
import { getSessionForRole } from "./_payroll-data.js";
import { recordClientEvent } from "./_stats-store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Method not allowed" });
    return;
  }

  const sessionCookie = await readSessionFromCookie(req.headers.cookie);
  const session = sessionCookie ? getSessionForRole(sessionCookie.role) : null;
  if (!session) {
    jsonResponse(res, 401, { error: "Unauthorized" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    await recordClientEvent({
      type: body.type,
      role: session.role,
      calculator: body.calculator,
      path: body.path
    });
    jsonResponse(res, 200, { ok: true });
  } catch {
    jsonResponse(res, 400, { error: "Не вдалося записати подію." });
  }
}
