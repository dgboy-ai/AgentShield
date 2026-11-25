"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  {
    href: "/dashboard/chat",
    label: "Agent Chat",
    badge: "LIVE",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/constraints",
    label: "Constraints",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/memory",
    label: "Memory",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/audit",
    label: "Audit Trail",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    href: "/dashboard/compliance",
    label: "Compliance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 11 11 13 15 9" />
      </svg>
    ),
  },
  {
    href: "/dashboard/api-access",
    label: "API Access",
    badge: "SDK",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 20l4-16M4 16l4-8 4 8M14 8l6 8M17 4l3 3-3 3" />
      </svg>
    ),
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { email, logout } = useAuth();

  const handleNav = () => {
    onNavigate?.();
  };

  return (
    <aside
      style={{
        display: "flex",
        height: "100%",
        width: "250px",
        flexDirection: "column",
        background: "#F4F3EF",
        borderRight: "3px solid #000000",
        boxSizing: "border-box",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: "72px",
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          borderBottom: "3px solid #000000",
          background: "#FFFFFF",
          boxSizing: "border-box",
        }}
      >
        <Link
          href="/dashboard"
          onClick={handleNav}
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "12px", width: "100%" }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "6px",
              background: "#059669",
              border: "3px solid #000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "3px 3px 0px #000000",
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 900, fontSize: "16px", color: "#FFFFFF", fontFamily: "monospace" }}>
              AS
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: "17px",
                letterSpacing: "0.5px",
                color: "#000000",
                lineHeight: 1.1,
              }}
            >
              AgentShield
            </div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 800,
                color: "#475569",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              Memory Defense
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation Label */}
      <div style={{ padding: "16px 18px 8px 18px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 900,
            color: "#64748B",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
          }}
        >
          Navigation
        </span>
      </div>

      {/* Nav List */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "0 14px",
          flex: 1,
          overflowY: "auto",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNav}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 800,
                color: active ? "#000000" : "#475569",
                background: active ? "#FACC15" : "transparent",
                border: active ? "3px solid #000000" : "3px solid transparent",
                boxShadow: active ? "3px 3px 0px #000000" : "none",
                transform: active ? "translate(-2px, -2px)" : "none",
                transition: "all 0.15s ease",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "#FFFFFF";
                  e.currentTarget.style.color = "#000000";
                  e.currentTarget.style.border = "3px solid #000000";
                  e.currentTarget.style.boxShadow = "3px 3px 0px #000000";
                  e.currentTarget.style.transform = "translate(-2px, -2px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#475569";
                  e.currentTarget.style.border = "3px solid transparent";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "none";
                }
              }}
            >
              <span style={{ display: "flex", alignItems: "center", color: "#000000" }}>
                {item.icon}
              </span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap" }}>
                {item.label}
              </span>
              {item.badge && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 900,
                    background: active ? "#000000" : "#059669",
                    color: active ? "#FACC15" : "#FFFFFF",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontFamily: "monospace",
                    letterSpacing: "0.5px",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer Card */}
      <div style={{ padding: "14px", borderTop: "3px solid #000000", background: "#FFFFFF" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "#F4F3EF",
            border: "2px solid #000000",
            borderRadius: "6px",
            padding: "8px 10px",
            boxShadow: "2px 2px 0px #000000",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "#18181B",
              color: "#FFFFFF",
              border: "2px solid #000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              fontWeight: 900,
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {email?.charAt(0).toUpperCase() || "A"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "#000000",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}
            >
              {email || "agent-demo"}
            </div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#059669",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "2px",
              }}
            >
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#059669" }} />
              Authenticated
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/login");
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#64748B",
              display: "flex",
              alignItems: "center",
            }}
            title="Sign out"
            aria-label="Sign out"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
