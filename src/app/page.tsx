import { Suspense } from "react";
import { getServerSession, isAuth0Configured } from "@/lib/auth/auth0";
import { ForensicDashboard } from "@/components/forensics/ForensicDashboard";
import { AuthStateDTO } from "@/components/layout/Header";

export const dynamic = "force-dynamic";

/**
 * Async data component that resolves server-side Auth0 session
 * and passes serializable AuthStateDTO to the client ForensicDashboard.
 */
async function DashboardWithAuth() {
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

/**
 * Server Component boundary wrapped in Suspense for Next.js streaming.
 * Prevents prerender blocking when reading cookies/headers for Auth0 session.
 */
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center font-mono text-sm">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Initializing GhostTrace Forensics...</span>
          </div>
        </div>
      }
    >
      <DashboardWithAuth />
    </Suspense>
  );
}
