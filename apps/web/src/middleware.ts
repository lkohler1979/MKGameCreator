import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Precisa bater com SESSION_COOKIE_NAME em backend/src/lib/auth.ts
const SESSION_COOKIE_NAME = "mkgc_session";

const PROTECTED_PREFIXES = ["/home", "/new-game", "/comunidade", "/configuracoes"];

export function middleware(request: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/home/:path*", "/new-game/:path*", "/comunidade/:path*", "/configuracoes/:path*"],
};
