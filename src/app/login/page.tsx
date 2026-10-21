import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RolePicker } from "./role-picker";
import { BrandMark, BrandWordmark } from "@/components/app/brand";

export default function LoginPage() {
  const session = auth();
  if (session) redirect("/");
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(1200px_620px_at_12%_-12%,#f3ede1,transparent),radial-gradient(1000px_720px_at_112%_18%,#e7efea,transparent),#eee7db]">
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl md:grid-cols-5">
          <div className="relative flex flex-col justify-between bg-sidebar p-8 text-white md:col-span-2">
            <div>
              <div className="flex items-center gap-3">
                <BrandMark className="h-11 w-11" />
                <BrandWordmark size="lg" />
              </div>
              <p className="mt-6 font-display text-2xl font-semibold leading-tight">Every enquiry, planned around the traveller.</p>
              <p className="mt-3 text-sm text-white/70">
                CRM for wishtrip&apos;s trip consultants: Instagram-to-booking pipeline, itineraries rebuilt from reels, payments, travel docs — with a voice agent and an auto-reply agent working the queue.
              </p>
            </div>
            <ul className="mt-8 space-y-2 text-xs text-white/60">
              <li>• Comment &ldquo;PLAN&rdquo; → DM → qualified lead in minutes</li>
              <li>• Day-by-day itineraries with transparent pricing</li>
              <li>• Advance · docs · visa · vouchers · post-trip loop</li>
              <li>• Aanya (voice) and Wish (chat) agents, with human hand-off</li>
            </ul>
          </div>
          <div className="p-8 md:col-span-3">
            <h1 className="font-display text-xl font-semibold text-foreground">Sign in to wishtrip CRM</h1>
            <p className="mt-1 text-sm text-muted-foreground">Interactive demo — pick a role. Nothing here is real data; it is generated in your browser and resets if you clear site data.</p>
            <div className="mt-6">
              <RolePicker />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
