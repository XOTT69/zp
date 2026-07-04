import { clearSessionCookie, jsonResponse } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Method not allowed" });
    return;
  }

  jsonResponse(res, 200, { authenticated: false }, { "Set-Cookie": clearSessionCookie() });
}
