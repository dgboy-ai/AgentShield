"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Overview",
    description: "Command center",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/constraints",
    label: "Constraints",
    description: "Pinned protection rules",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/memory",
    label: "Memory",
    description: "Protected memory vault",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    href: "/dashboard/audit",
    label: "Audit",
    description: "Hash-chained event log",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/compliance",
    label: "Compliance",
    description: "EU AI Act reporting",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
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
    <aside className="flex h-full w-[260px] flex-col border-r border-[#E2E8F0] bg-white">
      <div className="border-b border-[#E2E8F0] px-5 pb-5 pt-6">
        <Link href="/dashboard" onClick={handleNav} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#059669] shadow-[0_2px_8px_rgba(5,150,105,0.25)]">
            <span className="font-heading text-sm font-bold text-white">AS</span>
          </div>
          <div className="min-w-0">
            <div className="font-heading text-[17px] font-bold leading-tight tracking-tight text-[#172033]">
              AgentShield
            </div>
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
              Memory Defense
            </div>
          </div>
        </Link>
      </div>

      <div className="px-5 pb-2 pt-5">
        <span className="ds-label">Navigation</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Dashboard navigation">
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
              aria-current={active ? "page" : undefined}
              className={`group flex items-start gap-3 rounded-xl border px-3 py-3 transition-all duration-200 ${
                active
                  ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                  : "border-transparent text-[#475569] hover:border-[#E2E8F0] hover:bg-[#F8FAFC] hover:text-[#172033]"
              }`}
            >
              <span className={`mt-0.5 ${active ? "text-[#059669]" : "text-[#64748B] group-hover:text-[#475569]"}`}>
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-tight">{item.label}</span>
                <span className={`mt-0.5 block text-[11px] leading-tight ${active ? "text-[#047857]" : "text-[#64748B]"}`}>
                  {item.description}
                </span>
              </span>
              {active ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#059669]" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#E2E8F0] p-4">
        <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-sm font-bold text-[#047857] ring-1 ring-[#A7F3D0]">
            {email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-[#172033]">{email || "Signed in"}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
              Authenticated
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="rounded-lg p-2 text-[#64748B] transition-colors hover:bg-white hover:text-[#DC2626]"
            title="Sign out"
            aria-label="Sign out"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
