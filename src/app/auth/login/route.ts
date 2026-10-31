import { NextResponse } from "next/server";
import { isAuth0Configured } from "@/lib/auth/auth0";

/**
 * Fallback route handler for /auth/login.
 * When Auth0 v4 credentials are fully configured, proxy.ts middleware intercepts
 * this route and initiates Auth0 Universal Login.
 * If credentials are missing or unconfigured in the deployment environment,
 * this handler intercepts the request and gracefully redirects to home rather than 404.
 */
export async function GET(request: Request) {
  if (!isAuth0Configured()) {
    const url = new URL(request.url);
    url.pathname = "/";
    url.searchParams.set("auth_notice", "unconfigured");
    return NextResponse.redirect(url);
  }

  // When configured, redirect to home if reached directly
  return NextResponse.redirect(new URL("/", request.url));
}
