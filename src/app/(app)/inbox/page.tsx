"use client";

import { Suspense } from "react";
import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import { useHydrated } from "@/lib/demo/use-db";

export default function InboxPage() {
  // Render only once the persisted store is authoritative, so the SSR seed
  // never has to match a browser's mutated copy.
  const hydrated = useHydrated();
  const fallback = <div className="p-6 text-sm text-muted-foreground">Loading inbox…</div>;
  if (!hydrated) return fallback;
  return (
    <Suspense fallback={fallback}>
      <InboxWorkspace />
    </Suspense>
  );
}
