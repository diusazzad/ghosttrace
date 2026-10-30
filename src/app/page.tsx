import { getServerSession, isAuth0Configured } from "@/lib/auth/auth0";
import { ForensicDashboard } from "@/components/forensics/ForensicDashboard";
import { AuthStateDTO } from "@/components/layout/Header";

/**
 * Server Component boundary:
 * Resolves server-side Auth0 session and passes a serializable AuthStateDTO
 * to the interactive client ForensicDashboard without importing server SDKs into the client.
 */
export default async function Page() {
  const isConfigured = isAuth0Configured();
  const session = await getServerSession();

  const authState: AuthStateDTO = {
    isConfigured,
    isAuthenticated: Boolean(session),
    user: session
      ? {
          userId: session.userId,
          name: session.name,
          email: session.email,
        }
      : null,
  };

  return <ForensicDashboard authState={authState} />;
}
