import { NextResponse } from "next/server";
import { isAuth0Configured } from "@/lib/auth/auth0";

/**
 * Fallback route handler for /auth/callback.
 */
export async function GET(request: Request) {
  if (!isAuth0Configured()) {
    const url = new URL(request.url);
    url.pathname = "/";
    url.searchParams.set("auth_notice", "unconfigured");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL("/", request.url));
}
