"use client";

import { Suspense } from "react";
import { AskWorkspace } from "@/components/ask/ask-workspace";

export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <AskWorkspace />
    </Suspense>
  );
}
