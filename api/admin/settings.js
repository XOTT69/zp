import { jsonResponse, readJsonBody, readSessionFromCookie } from "../_auth.js";
import { getSessionForRole } from "../_payroll-data.js";
import { getAdminSettings, saveAdminSettings } from "../_settings-store.js";

export default async function handler(req, res) {
  const sessionCookie = await readSessionFromCookie(req.headers.cookie);
  const session = sessionCookie ? getSessionForRole(sessionCookie.role) : null;

  if (!session?.isAdmin) {
    jsonResponse(res, 403, { error: "Немає доступу до адмін-панелі." });
    return;
  }

  if (req.method === "GET") {
    jsonResponse(res, 200, { settings: await getAdminSettings() });
    return;
  }

  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const settings = await saveAdminSettings(body.settings ?? {});
    jsonResponse(res, 200, { ok: true, settings });
    return;
  }

  jsonResponse(res, 405, { error: "Method not allowed" });
}
