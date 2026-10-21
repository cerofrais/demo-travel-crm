"use client";

import { CallsWorkspace } from "@/components/calls/calls-workspace";
import { useHydrated } from "@/lib/demo/use-db";

export default function CallsPage() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="p-6 text-sm text-muted-foreground">Loading calls…</div>;
  return <CallsWorkspace />;
}
