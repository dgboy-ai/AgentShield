import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { WebMCPProvider } from "@/components/webmcp-provider";
import { OwnerAuthProvider } from "@/app/owner/layout";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AgentShield — Tamper-Evident Memory Defense for LLM Agents",
  description:
    "Protect AI agent memory from poisoning, tampering, and governance decay. Hash chain integrity, constraint pinning, and EU AI Act compliance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col mesh-bg grain-overlay">
        <AuthProvider>
          <OwnerAuthProvider>
            <WebMCPProvider />
            {children}
            <Toaster />
          </OwnerAuthProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
