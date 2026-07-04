import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSessionFromCookie } from "./_auth.js";
import { getSessionForRole } from "./_payroll-data.js";

const APP_PATHS = new Set(["/", "/login", "/service", "/supervisor", "/level4", "/xd", "/vk", "/video"]);
const CALCULATOR_PATHS = new Set(["/service", "/supervisor", "/level4", "/xd", "/vk", "/video"]);
const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host ?? "localhost"}`);
  const requestedPath = url.searchParams.get("path") || url.pathname;
  const pathname = APP_PATHS.has(requestedPath) ? requestedPath : "/login";
  const cookieSession = await readSessionFromCookie(req.headers.cookie);
  const session = cookieSession ? getSessionForRole(cookieSession.role) : null;

  if (pathname === "/login" && session) {
    redirect(res, `/${session.allowedCalculators[0]}`);
    return;
  }

  if (pathname === "/") {
    redirect(res, session ? `/${session.allowedCalculators[0]}` : "/login");
    return;
  }

  if (CALCULATOR_PATHS.has(pathname)) {
    if (!session) {
      redirect(res, "/login");
      return;
    }

    const calculator = pathname.slice(1);
    if (!session.allowedCalculators.includes(calculator)) {
      redirect(res, `/${session.allowedCalculators[0]}`);
      return;
    }
  }

  const html = await readFile(join(ROOT_DIR, "index.html"), "utf8");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}
