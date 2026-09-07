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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col mesh-bg grain-overlay" suppressHydrationWarning>
        {/* Fix for BIS/Samsung Internet extension injecting bis_skin_checked causing hydration mismatch (dev-only, HotReload) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{(function(){var clean=function(root){try{root.querySelectorAll('[bis_skin_checked],[bis_register]').forEach(function(e){e.removeAttribute('bis_skin_checked');e.removeAttribute('bis_register');});if(root.hasAttribute&&root.hasAttribute('bis_skin_checked'))root.removeAttribute('bis_skin_checked');if(root.hasAttribute&&root.hasAttribute('bis_register'))root.removeAttribute('bis_register');var b=document.body;if(b){b.removeAttribute('__processed_d7529ec1-27c6-4986-a255-9317b5370ded__');b.removeAttribute('bis_register');b.removeAttribute('bis_skin_checked');}}catch(e){}};clean(document);var obs=new MutationObserver(function(muts){muts.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1){clean(n);if(n.querySelectorAll)clean(n);}});if(m.type==='attributes'&&m.attributeName&&m.attributeName.indexOf('bis_')===0){try{m.target.removeAttribute(m.attributeName);}catch(e){}}});});obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['bis_skin_checked','bis_register','__processed_d7529ec1-27c6-4986-a255-9317b5370ded__']});})();}catch(e){}`,
          }}
        />
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
