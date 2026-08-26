"use client";

import { useEffect } from "react";
import { registerWebMCPTools } from "@/lib/webmcp";

/**
 * Mounts WebMCP tool registration once on client.
 * Drop into any layout so it runs on every page.
 */
export function WebMCPProvider() {
  useEffect(() => {
    // Register immediately if document.modelContext already injected
    registerWebMCPTools();

    // ChatGPT may inject modelContext after load — poll briefly + listen
    let tries = 0;
    const interval = setInterval(() => {
      tries += 1;
      const hasMC = typeof document !== "undefined" && (document as unknown as { modelContext?: unknown }).modelContext;
      if (hasMC) {
        registerWebMCPTools();
        clearInterval(interval);
      }
      if (tries > 20) clearInterval(interval);
    }, 300);

    // Also re-register on visibility change (ChatGPT in-app browser resume)
    const onVisible = () => {
      if (document.visibilityState === "visible") registerWebMCPTools();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
