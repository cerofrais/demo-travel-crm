"use client";

import { Suspense } from "react";
import { ActivityWorkspace } from "@/components/activity/activity-workspace";

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading activity…</div>}>
      <ActivityWorkspace />
    </Suspense>
  );
}
