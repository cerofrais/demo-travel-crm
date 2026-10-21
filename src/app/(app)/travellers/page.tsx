"use client";

import { Suspense } from "react";
import { TravellersWorkspace } from "@/components/travellers/travellers-workspace";

export default function TravellersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading travellers…</div>}>
      <TravellersWorkspace />
    </Suspense>
  );
}
