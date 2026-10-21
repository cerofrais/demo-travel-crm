import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";

export default function Home() {
  const session = auth();
  if (!session) redirect("/login");
  redirect(homeFor(session.role));
}
