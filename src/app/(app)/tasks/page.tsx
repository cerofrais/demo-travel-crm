"use client";

import { Suspense } from "react";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading tasks…</div>}>
      <TasksWorkspace />
    </Suspense>
  );
}
