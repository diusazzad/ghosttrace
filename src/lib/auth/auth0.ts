import { Auth0Client } from "@auth0/nextjs-auth0/server";
import type { NextRequest } from "next/server";

let auth0Instance: Auth0Client | null = null;

/**
 * Checks whether Auth0 credentials are provided and non-placeholder.
 */
export function isAuth0Configured(): boolean {
  const secret = process.env.AUTH0_SECRET;
  const domain = process.env.AUTH0_DOMAIN || process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  return Boolean(
    secret && secret.trim().length > 0 && !secret.includes("your_") &&
    domain && domain.trim().length > 0 && !domain.includes("your_") &&
    clientId && clientId.trim().length > 0 && !clientId.includes("your_") &&
    clientSecret && clientSecret.trim().length > 0 && !clientSecret.includes("your_")
  );
}

/**
 * Returns a singleton Auth0Client instance.
 */
export function getAuth0Client(): Auth0Client {
  if (!auth0Instance) {
    auth0Instance = new Auth0Client({
      domain: process.env.AUTH0_DOMAIN || process.env.AUTH0_ISSUER_BASE_URL || "demo.auth0.com",
      clientId: process.env.AUTH0_CLIENT_ID || "demo-client-id",
      clientSecret: process.env.AUTH0_CLIENT_SECRET || "demo-client-secret-placeholder-min32chars",
      secret: process.env.AUTH0_SECRET || "demo-session-secret-placeholder-min32chars",
      appBaseUrl: process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000",
    });
  }
  return auth0Instance;
}

export interface VerifiedUserSession {
  userId: string;
  email?: string;
  name?: string;
  isDemo: boolean;
}

/**
 * Server-side session verification helper.
 * Extracts the canonical identity from verified Auth0 subject (`sub`).
 * Returns null if unauthenticated or Auth0 is unconfigured.
 */
export async function getServerSession(req?: NextRequest): Promise<VerifiedUserSession | null> {
  if (!isAuth0Configured()) {
    return null;
  }

  try {
    const client = getAuth0Client();
    const session = req ? await client.getSession(req) : await client.getSession();
    if (!session || !session.user || !session.user.sub) {
      return null;
    }

    return {
      userId: session.user.sub,
      email: session.user.email,
      name: session.user.name,
      isDemo: false,
    };
  } catch (err) {
    console.error("Auth0 session resolution failed:", err);
    return null;
  }
}
