"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquareQuote, ScrollText, ShieldCheck } from "lucide-react";
import { ScrollableTabs, type TabItem } from "@/components/ui";
import { EmptyState, useToast } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { useCurrentUser } from "@/lib/demo/session-client";
import { can } from "@/lib/rbac";
import { DecisionLog } from "./decision-log";
import { DecisionDetail } from "./decision-detail";
import { InboundQuestions } from "./inbound-questions";
import { PolicyModels } from "./policy-models";

const TABS: TabItem[] = [
  { key: "log", label: "Decision log", icon: <ScrollText className="h-3.5 w-3.5" /> },
  { key: "inbound", label: "Inbound questions", icon: <MessageSquareQuote className="h-3.5 w-3.5" /> },
  { key: "policy", label: "Policy & models", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

export function AiAuditWorkspace() {
  const user = useCurrentUser();
  const router = useRouter();
  const params = useSearchParams();
  const { toast, node } = useToast();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? (params.get("tab") as string) : "log";
  const [selected, setSelected] = React.useState<string | null>(params.get("event"));

  function setTab(key: string) {
    router.replace(key === "log" ? "/ai-audit" : `/ai-audit?tab=${key}`, { scroll: false });
  }

  if (!can(user.role, "ai.audit")) {
    return (
      <div className="p-6">
        <EmptyState icon={ShieldCheck} title="AI Audit is restricted" hint="Ask an admin or manager to review AI decisions." />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="AI Audit" subtitle="Every decision the agents made — exact prompt sent, exact output received, who approved it." />
      <div className="space-y-6 p-4 md:p-6">
        <ScrollableTabs tabs={TABS} active={tab} onChange={setTab} />
        {tab === "log" && <DecisionLog onOpen={setSelected} />}
        {tab === "inbound" && <InboundQuestions onToast={toast} />}
        {tab === "policy" && <PolicyModels />}
      </div>
      <DecisionDetail eventId={selected} onClose={() => setSelected(null)} onToast={toast} />
      {node}
    </>
  );
}
