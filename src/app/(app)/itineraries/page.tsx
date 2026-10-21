"use client";

import { Suspense } from "react";
import { PackagesWorkspace } from "@/components/itineraries/packages-workspace";

export default function ItinerariesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading packages…</div>}>
      <PackagesWorkspace />
    </Suspense>
  );
}
