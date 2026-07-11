import { jsonResponse, readJsonBody, readSessionFromCookie } from "../_auth.js";
import { getSessionForRole } from "../_payroll-data.js";
import { getAdminSettings, getSettingsHistory, rollbackAdminSettings, saveAdminSettings } from "../_settings-store.js";
import { SettingsValidationError } from "../_settings-validation.js";

export default async function handler(req, res) {
  const sessionCookie = await readSessionFromCookie(req.headers.cookie);
  const session = sessionCookie ? getSessionForRole(sessionCookie.role) : null;

  if (!session?.isAdmin) {
    jsonResponse(res, 403, { error: "Немає доступу до адмін-панелі." });
    return;
  }

  if (req.method === "GET") {
    jsonResponse(res, 200, {
      settings: await getAdminSettings(),
      history: await getSettingsHistory()
    });
    return;
  }

  if (req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const settings = await saveAdminSettings(body.settings ?? {}, {
        summary: body.summary || "Оновлено налаштування в адмін-панелі"
      });
      jsonResponse(res, 200, {
        ok: true,
        settings,
        history: await getSettingsHistory()
      });
    } catch (error) {
      const issues = error instanceof SettingsValidationError ? error.issues : [error.message || "Не вдалося зберегти налаштування."];
      jsonResponse(res, 400, { error: issues[0], issues });
    }
    return;
  }

  if (req.method === "PATCH") {
    try {
      const body = await readJsonBody(req);
      const settings = await rollbackAdminSettings(String(body.revisionId || ""));
      jsonResponse(res, 200, {
        ok: true,
        settings,
        history: await getSettingsHistory()
      });
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || "Не вдалося відкотити налаштування." });
    }
    return;
  }

  jsonResponse(res, 405, { error: "Method not allowed" });
}
