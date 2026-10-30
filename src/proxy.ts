import { NextResponse } from "next/server";
import { isAuth0Configured, getAuth0Client } from "@/lib/auth/auth0";

/**
 * Next.js 16 Proxy convention (replaces legacy middleware.ts).
 * Mounts Auth0 authentication flow (/auth/login, /auth/logout, /auth/callback)
 * when Auth0 credentials are provided.
 */
export async function proxy(request: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.next();
  }

  const client = getAuth0Client();
  return await client.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"
  ]
};
