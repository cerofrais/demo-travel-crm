"use client";

import * as React from "react";
import { PageHeader } from "@/components/app/page-header";
import { ScrollableTabs } from "@/components/ui";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { can } from "@/lib/rbac";
import { MembersTab } from "./members-tab";
import { RolesTab } from "./roles-tab";
import { AssignmentTab } from "./assignment-tab";
import { ActivityMonitor } from "./activity-monitor";

type Tab = "members" | "roles" | "assignment" | "activity";

export function UsersWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const canManage = can(me.role, "users.manage");
  const canAssign = can(me.role, "enquiries.manage");
  const [tab, setTab] = React.useState<Tab>("members");
  const active = db.users.filter((u) => u.active).length;

  return (
    <>
      <PageHeader title="Team" subtitle={`${active} active members · ${db.users.filter((u) => u.online).length} online`} />
      <div className="space-y-4 p-4 md:p-6">
        <ScrollableTabs
          tabs={[
            { key: "members", label: "Members" },
            { key: "roles", label: "Roles & permissions" },
            { key: "assignment", label: "Lead assignment" },
            { key: "activity", label: "Activity monitor" },
          ]}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />
        {tab === "members" && <MembersTab db={db} me={me} canManage={canManage} />}
        {tab === "roles" && <RolesTab />}
        {tab === "assignment" && <AssignmentTab db={db} me={me} canManage={canManage || canAssign} />}
        {tab === "activity" && <ActivityMonitor />}
      </div>
    </>
  );
}
