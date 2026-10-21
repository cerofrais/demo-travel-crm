import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Spectral } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const spectral = Spectral({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "wishtrip CRM",
  description: "Travel CRM demo for wishtrip — enquiries, itineraries, trips, payments and AI agents.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const session = auth();
  return (
    <html lang="en" className={`${jakarta.variable} ${spectral.variable}`}>
      <body className="font-sans antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
