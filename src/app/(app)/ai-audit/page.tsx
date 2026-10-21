"use client";

import * as React from "react";
import { AiAuditWorkspace } from "@/components/ai-audit/ai-audit-workspace";
import { useHydrated } from "@/lib/demo/use-db";

export default function AiAuditPage() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="p-6 text-sm text-muted-foreground">Loading AI audit…</div>;
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading AI audit…</div>}>
      <AiAuditWorkspace />
    </React.Suspense>
  );
}
