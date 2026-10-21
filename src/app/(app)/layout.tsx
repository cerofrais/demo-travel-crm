import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { navFor, ROLE_LABEL } from "@/lib/rbac";
import { AppShell } from "@/components/app/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = auth();
  if (!session) redirect("/login");
  const nav = navFor(session.role).map(({ href, label, icon, section }) => ({ href, label, icon, section }));
  return (
    <AppShell nav={nav} user={{ name: session.name, email: session.email, role: ROLE_LABEL[session.role] }}>
      {children}
    </AppShell>
  );
}
