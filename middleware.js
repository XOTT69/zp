import { readSessionFromCookie } from "./api/_auth.js";
import { getSessionForRole } from "./api/_payroll-data.js";

const APP_PATHS = new Set(["/", "/login", "/service", "/supervisor", "/level4", "/xd"]);
const CALCULATOR_PATHS = new Set(["/service", "/supervisor", "/level4", "/xd"]);

export const config = {
  matcher: ["/", "/login", "/service", "/supervisor", "/level4", "/xd"]
};

export default async function middleware(request) {
  const url = new URL(request.url);
  if (!APP_PATHS.has(url.pathname)) return;

  const cookieSession = await readSessionFromCookie(request.headers.get("cookie"));
  const session = cookieSession ? getSessionForRole(cookieSession.role) : null;

  if (url.pathname === "/login") {
    if (session) return Response.redirect(new URL(`/${session.allowedCalculators[0]}`, request.url));
    return;
  }

  if (url.pathname === "/") {
    if (session) return Response.redirect(new URL(`/${session.allowedCalculators[0]}`, request.url));
    return Response.redirect(new URL("/login", request.url));
  }

  if (CALCULATOR_PATHS.has(url.pathname)) {
    if (!session) return Response.redirect(new URL("/login", request.url));

    const calculator = url.pathname.slice(1);
    if (!session.allowedCalculators.includes(calculator)) {
      return Response.redirect(new URL(`/${session.allowedCalculators[0]}`, request.url));
    }

    return;
  }

  return;
}
