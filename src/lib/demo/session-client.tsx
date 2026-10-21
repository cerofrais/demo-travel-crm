"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AppRole } from "@/lib/rbac";
import { readClientSessionCookie, clearClientSessionCookie, type DemoSessionData } from "./session";

export const DEMO_SESSION_EVENT = "wishtrip-session-changed";

type Status = "loading" | "authenticated" | "unauthenticated";

export interface SessionShape {
  user: { sub: string; name: string; email: string };
  role: AppRole;
}

interface SessionContextValue {
  data: SessionShape | null;
  status: Status;
}

const SessionContext = createContext<SessionContextValue>({ data: null, status: "loading" });

function readSession(): SessionContextValue {
  const raw = readClientSessionCookie();
  if (!raw) return { data: null, status: "unauthenticated" };
  return {
    data: { user: { sub: raw.sub, name: raw.name, email: raw.email }, role: raw.role },
    status: "authenticated",
  };
}

export function SessionProvider({ children, initial }: { children: React.ReactNode; initial?: DemoSessionData | null }) {
  const [state, setState] = useState<SessionContextValue>(() =>
    initial
      ? { data: { user: { sub: initial.sub, name: initial.name, email: initial.email }, role: initial.role }, status: "authenticated" }
      : { data: null, status: "loading" },
  );

  useEffect(() => {
    const refresh = () => setState(readSession());
    refresh();
    window.addEventListener(DEMO_SESSION_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(DEMO_SESSION_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

/** Current signed-in user, or a safe placeholder while the cookie loads. */
export function useCurrentUser(): { sub: string; name: string; email: string; role: AppRole } {
  const { data } = useSession();
  return data ? { ...data.user, role: data.role } : { sub: "", name: "", email: "", role: "VIEWER" };
}

export async function signOut(opts?: { redirect?: boolean; callbackUrl?: string }) {
  clearClientSessionCookie();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DEMO_SESSION_EVENT));
    if (opts?.redirect !== false) window.location.href = opts?.callbackUrl ?? "/login";
  }
}
