import { NextRequest, NextResponse } from "next/server";
import { can, canAny, ROUTE_GUARDS, homeFor } from "@/lib/rbac";
import { DEMO_SESSION_COOKIE, decodeSessionCookie } from "@/lib/demo/session";

/** Route gating by the demo-session cookie (a Keycloak JWT in production). */
export default function middleware(req: NextRequest) {
  const session = decodeSessionCookie(req.cookies.get(DEMO_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  const path = req.nextUrl.pathname;
  const guard = ROUTE_GUARDS.find((g) => path.startsWith(g.prefix));
  const allowed = guard ? (Array.isArray(guard.perm) ? canAny(session.role, guard.perm) : can(session.role, guard.perm)) : true;
  if (guard && !allowed) return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/enquiries/:path*",
    "/inbox/:path*",
    "/tasks/:path*",
    "/trips/:path*",
    "/travellers/:path*",
    "/itineraries/:path*",
    "/payments/:path*",
    "/suppliers/:path*",
    "/agents/:path*",
    "/calls/:path*",
    "/campaigns/:path*",
    "/templates/:path*",
    "/reviews/:path*",
    "/reports/:path*",
    "/users/:path*",
    "/activity/:path*",
    "/settings/:path*",
  ],
};
