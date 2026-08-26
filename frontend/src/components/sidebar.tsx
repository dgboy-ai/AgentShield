"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/constraints",
    label: "Constraints",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/memory",
    label: "Memory",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    href: "/dashboard/audit",
    label: "Audit",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/compliance",
    label: "Compliance",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { email, logout } = useAuth();

  return (
    <aside className="sidebar-glass fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-30">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/20" style={{ background: "linear-gradient(135deg, #0D7C5F, #10B981)" }}>
            <span className="font-black text-white text-sm font-display">AS</span>
          </div>
          <div>
            <div className="font-bold text-sm font-display tracking-tight">AgentShield</div>
            <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#7A7164" }}>Memory Defense</div>
          </div>
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06) 50%, transparent)" }} />

      {/* Section label */}
      <div className="px-5 pt-5 pb-2">
        <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: "#7A7164" }}>Navigation</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`
                  flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-250 cursor-pointer group relative
                  ${active
                    ? "text-white font-semibold"
                    : "hover:bg-white/50"
                  }
                `}
                style={active ? {
                  background: "linear-gradient(135deg, #0D7C5F, #10B981)",
                  color: "white",
                  boxShadow: "0 2px 12px rgba(13,124,95,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                } : {
                  color: "#5A5248",
                }}
              >
                <span className={`transition-transform duration-300 ${active ? "scale-110" : "group-hover:scale-110 group-hover:-rotate-3"}`}>
                  {item.icon}
                </span>
                <span className="font-display">{item.label}</span>
                {active && (
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-dot-pulse" />
                  </div>
                )}
                {!active && (
                  <div className="ml-auto w-0 group-hover:w-1.5 h-1.5 rounded-full bg-primary/40 transition-all duration-300" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Chain status */}
      <div className="px-3 mb-3">
        <div className="glass-card rounded-xl px-4 py-3.5">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-2.5 h-2.5 rounded-full animate-pulse-ring" style={{ background: "#0D7C5F" }} />
            <span className="text-xs font-bold font-display tracking-wide uppercase" style={{ color: "#5A5248" }}>Chain Status</span>
          </div>
          <div className="hash-line w-full mb-2.5 rounded-full overflow-hidden" />
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" style={{ color: "#0D7C5F" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-xs font-bold font-display" style={{ color: "#0D7C5F" }}>All linked &amp; verified</span>
          </div>
        </div>
      </div>

      {/* User */}
      <div className="px-3 pb-4">
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 hover:bg-white/50" style={{ background: "rgba(0,0,0,0.02)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0" style={{ background: "linear-gradient(135deg, #0D7C5F, #10B981)" }}>
            {email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate font-display">{email || "user"}</div>
            <div className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: "#7A7164" }}>Authenticated</div>
          </div>
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="p-1.5 rounded-lg transition-all duration-200 hover:bg-white/60"
            style={{ color: "#7A7164" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
