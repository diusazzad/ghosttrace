import { NextResponse } from "next/server";
import { isAuth0Configured } from "@/lib/auth/auth0";

/**
 * Fallback route handler for /auth/logout.
 */
export async function GET(request: Request) {
  if (!isAuth0Configured()) {
    const url = new URL(request.url);
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL("/", request.url));
}
