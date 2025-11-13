import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const AUTH_EXEMPT_API_PREFIXES = ["/api/login", "/api/logout"];

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api");
}

function isAuthExemptApi(pathname: string): boolean {
  return AUTH_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  let session = null;
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    session = await verifySessionToken(sessionCookie);
  } catch (error) {
    // If AUTH_SECRET is not set or there's an auth error, log it and treat as no session
    console.error("Middleware auth error:", error);
    // In production, you might want to return an error page instead
    // For now, we'll treat it as unauthenticated
  }

  if (pathname === "/login") {
    if (session) {
      const redirectUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  if (isApiRoute(pathname)) {
    if (isAuthExemptApi(pathname)) {
      return NextResponse.next();
    }

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
        }
      );
    }

    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
