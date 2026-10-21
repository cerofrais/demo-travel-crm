"use client";

import { Suspense } from "react";
import { EnquiriesWorkspace } from "@/components/enquiries/enquiries-workspace";

export default function EnquiriesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading enquiries…</div>}>
      <EnquiriesWorkspace />
    </Suspense>
  );
}
