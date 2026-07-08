import { jsonResponse, readSessionFromCookie } from "../_auth.js";
import { ACCESS_CONFIG, PAYROLL_CONFIG, getSessionForRole } from "../_payroll-data.js";
import { getStatsSnapshot, resetStats } from "../_stats-store.js";

export default async function handler(req, res) {
  const sessionCookie = await readSessionFromCookie(req.headers.cookie);
  const session = sessionCookie ? getSessionForRole(sessionCookie.role) : null;

  if (!session?.isAdmin) {
    jsonResponse(res, 403, { error: "Немає доступу до адмін-панелі." });
    return;
  }

  if (req.method === "DELETE") {
    await resetStats();
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (req.method !== "GET") {
    jsonResponse(res, 405, { error: "Method not allowed" });
    return;
  }

  jsonResponse(res, 200, {
    stats: await getStatsSnapshot(),
    roles: adminRoles(),
    calculators: adminCalculators()
  });
}

function adminRoles() {
  return Object.fromEntries(
    Object.entries(ACCESS_CONFIG).map(([key, config]) => [
      key,
      {
        label: config.label,
        envKey: config.envKey,
        configured: Boolean(process.env[config.envKey]),
        isAdmin: Boolean(config.isAdmin),
        allowedCalculators: [...config.allowedCalculators]
      }
    ])
  );
}

function adminCalculators() {
  return Object.fromEntries(
    Object.entries(PAYROLL_CONFIG.calculators).map(([key, config]) => [
      key,
      {
        title: config.title,
        source: config.source,
        taxMode: config.taxMode,
        taxRate: config.taxRate,
        salary: config.defaultInputs?.salary ?? 0,
        scheduleOptions: config.scheduleOptions ?? null
      }
    ])
  );
}
