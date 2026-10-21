"use client";

import { SessionProvider } from "@/lib/demo/session-client";
import type { DemoSessionData } from "@/lib/demo/session";

export function Providers({ children, session }: { children: React.ReactNode; session?: DemoSessionData | null }) {
  return <SessionProvider initial={session}>{children}</SessionProvider>;
}
