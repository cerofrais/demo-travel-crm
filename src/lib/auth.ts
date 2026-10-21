import { cookies } from "next/headers";
import { DEMO_SESSION_COOKIE, decodeSessionCookie, type DemoSessionData } from "@/lib/demo/session";

/** Server-side session read (layouts / pages). */
export function auth(): DemoSessionData | null {
  return decodeSessionCookie(cookies().get(DEMO_SESSION_COOKIE)?.value);
}
