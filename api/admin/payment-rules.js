import { jsonResponse, readJsonBody, readSessionFromCookie } from "../_auth.js";
import { getSessionForRole } from "../_payroll-data.js";
import { deletePaymentRule, getPaymentRules, savePaymentRule } from "../_payment-rules.js";

export default async function handler(req, res) {
  const sessionCookie = await readSessionFromCookie(req.headers.cookie);
  const session = sessionCookie ? getSessionForRole(sessionCookie.role) : null;

  if (!session?.isAdmin) {
    jsonResponse(res, 403, { error: "Немає доступу до адмін-панелі." });
    return;
  }

  if (req.method === "GET") {
    jsonResponse(res, 200, { rules: await getPaymentRules() });
    return;
  }

  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const rules = await savePaymentRule(body.calculator, body.month, body.rule ?? {});
    jsonResponse(res, 200, { ok: true, rules });
    return;
  }

  if (req.method === "DELETE") {
    const body = await readJsonBody(req);
    const rules = await deletePaymentRule(body.calculator, body.month);
    jsonResponse(res, 200, { ok: true, rules });
    return;
  }

  jsonResponse(res, 405, { error: "Method not allowed" });
}
