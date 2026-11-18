"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "green" | "blue" | "amber" | "red" | "purple" | "neutral";

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn("ds-badge", `ds-badge-${tone}`, className)}>{children}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-[#E2E8F0] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {icon ? (
          <div
            className="ds-icon-tile h-12 w-12 rounded-xl"
            style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="ds-eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="ds-page-title">{title}</h1>
          {description ? <p className="ds-subtitle mt-2 max-w-3xl">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h2 className="ds-section-title">{title}</h2>
        {description ? <p className="ds-desc mt-1">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Unable to load data",
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      className="ds-card flex flex-col items-center justify-center px-6 py-12 text-center"
      style={{ borderColor: "#FECACA", background: "#FEF2F2" }}
    >
      <div
        className="ds-icon-tile mb-4 h-12 w-12"
        style={{ background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      </div>
      <h2 className="ds-card-title mb-1" style={{ color: "#B91C1C" }}>
        {title}
      </h2>
      <p className="ds-desc max-w-lg" style={{ color: "#B91C1C" }}>
        {message}
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="ds-btn ds-btn-danger mt-5">
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ds-card flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? (
        <div
          className="ds-icon-tile mb-4 h-12 w-12"
          style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}
        >
          {icon}
        </div>
      ) : null}
      <h3 className="ds-card-title mb-1">{title}</h3>
      {description ? <p className="ds-desc max-w-md">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("ds-skeleton", className)} />;
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = "green",
  className,
}: {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, { bg: string; fg: string; border: string }> = {
    green: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
    blue: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" },
    amber: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
    red: { bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" },
    purple: { bg: "#F5F3FF", fg: "#6D28D9", border: "#DDD6FE" },
    neutral: { bg: "#F8FAFC", fg: "#475569", border: "#E2E8F0" },
  };
  const palette = tones[tone];
  return (
    <div className={cn("ds-card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="ds-label">{label}</p>
        {icon ? (
          <span
            className="ds-icon-tile h-9 w-9"
            style={{ background: palette.bg, color: palette.fg, border: `1px solid ${palette.border}` }}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="ds-stat mt-4">{value}</div>
      {sublabel ? <div className="ds-meta mt-2">{sublabel}</div> : null}
    </div>
  );
}

export function InfoNote({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber";
  className?: string;
}) {
  const styles = {
    neutral: { background: "#F8FAFC", borderColor: "#E2E8F0", color: "#475569" },
    green: { background: "#ECFDF5", borderColor: "#A7F3D0", color: "#065F46" },
    amber: { background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" },
  }[tone];
  return (
    <div
      className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed", className)}
      style={styles}
    >
      <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
