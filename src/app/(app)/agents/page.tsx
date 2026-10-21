"use client";

import { AgentsWorkspace } from "@/components/agents/agents-workspace";
import { useHydrated } from "@/lib/demo/use-db";

export default function AgentsPage() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="p-6 text-sm text-muted-foreground">Loading agents…</div>;
  return <AgentsWorkspace />;
}
