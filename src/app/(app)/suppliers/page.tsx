"use client";

import { Suspense } from "react";
import { SuppliersWorkspace } from "@/components/suppliers/suppliers-workspace";

export default function SuppliersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading suppliers…</div>}>
      <SuppliersWorkspace />
    </Suspense>
  );
}
