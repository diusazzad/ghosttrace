import { Auth0Client } from "@auth0/nextjs-auth0/server";
import type { NextRequest } from "next/server";

export class Auth0ConfigurationError extends Error {
  constructor(message: string) {
    super(`Auth0ConfigurationError: ${message}`);
    this.name = "Auth0ConfigurationError";
  }
}

/**
 * Validates that an AUTH0_DOMAIN is strictly a hostname without scheme, path, or placeholders.
 */
export function isValidAuth0Domain(domain: string | undefined): boolean {
  if (!domain || typeof domain !== "string") {
    return false;
  }
  const trimmed = domain.trim();
  if (trimmed.length === 0) {
    return false;
  }
  // Reject schemes, paths, query, hash, or whitespace
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    /\s/.test(trimmed)
  ) {
    return false;
  }
  // Reject documentation placeholders and dummy domains
  if (
    trimmed.includes("your-tenant") ||
    trimmed.includes("your_") ||
    trimmed === "demo.auth0.com"
  ) {
    return false;
  }
  // Must match a valid domain/hostname format
  return /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
}

/**
 * Checks whether Auth0 v4 environment variables are configured with valid values.
 * In SDK v4:
 * - AUTH0_DOMAIN must be a scheme-less hostname.
 * - APP_BASE_URL or AUTH0_BASE_URL is the primary app origin setting.
 * - AUTH0_ISSUER_BASE_URL alone is not accepted as v4 configuration.
 */
export function isAuth0Configured(): boolean {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const secret = process.env.AUTH0_SECRET;
  const appBaseUrl = (process.env.APP_BASE_URL || process.env.AUTH0_BASE_URL)?.trim().replace(/\/+$/, "");

  if (!isValidAuth0Domain(domain)) {
    return false;
  }

  if (
    !clientId ||
    clientId.trim().length === 0 ||
    clientId.includes("your_") ||
    clientId === "demo-client-id"
  ) {
    return false;
  }

  if (
    !clientSecret ||
    clientSecret.trim().length < 16 ||
    clientSecret.includes("your_") ||
    clientSecret.includes("placeholder")
  ) {
    return false;
  }

  if (
    !secret ||
    secret.trim().length < 16 ||
    secret.includes("your_") ||
    secret.includes("placeholder")
  ) {
    return false;
  }

  if (!appBaseUrl || appBaseUrl.trim().length === 0 || appBaseUrl.includes("your_")) {
    return false;
  }

  return true;
}

let auth0Instance: Auth0Client | null = null;

/**
 * Returns a singleton Auth0Client instance.
 * Throws Auth0ConfigurationError if Auth0 is not properly configured.
 * Never creates dummy clients with hardcoded demo credentials.
 */
export function getAuth0Client(): Auth0Client {
  if (!isAuth0Configured()) {
    throw new Auth0ConfigurationError(
      "Auth0 v4 is not configured. Missing or invalid AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, or APP_BASE_URL."
    );
  }

  if (!auth0Instance) {
    const domain = process.env.AUTH0_DOMAIN!.trim();
    const clientId = process.env.AUTH0_CLIENT_ID!.trim();
    const clientSecret = process.env.AUTH0_CLIENT_SECRET!.trim();
    const secret = process.env.AUTH0_SECRET!.trim();
    const appBaseUrl = (process.env.APP_BASE_URL || process.env.AUTH0_BASE_URL)!.trim().replace(/\/+$/, "");

    auth0Instance = new Auth0Client({
      domain,
      clientId,
      clientSecret,
      secret,
      appBaseUrl,
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
 * Returns null if unauthenticated, unconfigured, or session is invalid.
 * Never logs raw cookies, tokens, or secrets.
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
    const safeError = err instanceof Error ? err.message : "Session resolution error";
    console.warn(`[Auth0] Session resolution error: ${safeError}`);
    return null;
  }
}

export const getVerifiedUserSession = getServerSession;
