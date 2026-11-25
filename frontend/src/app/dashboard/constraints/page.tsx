"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  IconAlert,
  IconCheck,
  IconCheckCircle,
  IconEdit,
  IconKey,
  IconLink,
  IconLock,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShield,
  IconShieldCheck,
  IconTrash,
  IconX,
} from "@/components/dashboard/icons";

const BLACK = "#000000";
const SHADOW = `6px 6px 0px ${BLACK}`;
const SHADOW_SM = `4px 4px 0px ${BLACK}`;
const FONT_HEAD = "var(--font-space-grotesk)";
const FONT_MONO = "var(--font-geist-mono)";

const TYPE_COLORS: Record<string, { label: string; fg: string; bg: string }> = {
  safety: { label: "Safety", fg: "#000", bg: "#FF4D4D" },
  policy: { label: "Policy", fg: "#000", bg: "#FACC15" },
  instruction: { label: "Instruction", fg: "#000", bg: "#4D9FFF" },
};

function typeColors(type: string) {
  return TYPE_COLORS[type] ?? { label: type || "General", fg: "#000", bg: "#E2E8F0" };
}

interface Constraint {
  constraint_id: string;
  org_id: string;
  text: string;
  constraint_type: string;
  is_active: boolean;
  previous_hash: string | null;
  entry_hash: string;
  kms_signature: string | null;
  created_at: string;
  updated_at: string;
}

interface IntegrityScore {
  org_id: string;
  integrity_score: number;
  token_overhead: number;
  token_overhead_pct: number;
  estimated_tokens: number;
}

interface IntegrityVerify {
  constraint_integrity: {
    report_id: string;
    total_constraints: number;
    active_constraints: number;
    compromised_constraints: number;
    hash_mismatches: string[];
    compaction_events_count: number;
    overall_score: number;
    generated_at: string;
  };
  hash_chain: {
    is_valid?: boolean;
    valid?: boolean;
    total_entries?: number;
    valid_entries?: number;
  };
}

const PAGE_SIZE = 50;
const MAX_LENGTH = 10_000;

function relativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function fullDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function Chip({ label, bg, fg = "#000", title }: { label: string; bg: string; fg?: string; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        background: bg,
        color: fg,
        border: `2px solid ${BLACK}`,
        borderRadius: "7px",
        padding: "3px 9px",
        fontSize: "11px",
        fontWeight: 900,
        fontFamily: FONT_HEAD,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        flexShrink: 0,
        boxShadow: `2px 2px 0px ${BLACK}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sublabel: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: `3px solid ${BLACK}`,
        borderRadius: "14px",
        boxShadow: SHADOW,
        padding: "20px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span
          style={{
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: accent,
            border: `3px solid ${BLACK}`,
            borderRadius: "10px",
            boxShadow: `3px 3px 0px ${BLACK}`,
            color: BLACK,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontFamily: FONT_HEAD,
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#475569",
            textAlign: "right",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: FONT_HEAD,
          fontSize: "30px",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          color: BLACK,
          marginTop: "12px",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginTop: "4px" }}>{sublabel}</div>
    </div>
  );
}

function Panel({
  title,
  description,
  accent,
  action,
  children,
}: {
  title: string;
  description?: string;
  accent: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `3px solid ${BLACK}`,
        borderRadius: "16px",
        boxShadow: SHADOW,
        overflow: "hidden",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          padding: "16px 20px",
          borderBottom: `3px solid ${BLACK}`,
          background: accent,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: BLACK, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: FONT_HEAD, fontSize: "18px", fontWeight: 900, color: BLACK, margin: 0, letterSpacing: "-0.01em" }}>
              {title}
            </h3>
            {description ? (
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: 700, color: BLACK, opacity: 0.65 }}>{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div style={{ padding: "16px", flex: 1 }}>{children}</div>
    </div>
  );
}

function NeoButton({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
  size = "md",
  ariaLabel,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  ariaLabel?: string;
  title?: string;
}) {
  const palette =
    variant === "primary"
      ? { bg: "#2DD4A0", fg: "#000" }
      : variant === "danger"
      ? { bg: "#FF4D4D", fg: "#000" }
      : variant === "ghost"
      ? { bg: "transparent", fg: "#000" }
      : { bg: "#FFFFFF", fg: "#000" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "7px",
        fontFamily: FONT_HEAD,
        fontWeight: 900,
        fontSize: size === "sm" ? "12px" : "13px",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: palette.fg,
        background: palette.bg,
        border: `3px solid ${BLACK}`,
        borderRadius: "9px",
        boxShadow: variant === "ghost" ? "none" : SHADOW_SM,
        padding: size === "sm" ? "7px 12px" : "10px 16px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        transform: "translate(-1px, -1px)",
        transition: "transform 100ms, box-shadow 100ms",
      }}
      onMouseDown={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px, 2px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "1px 1px 0px #000";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translate(-1px, -1px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW_SM;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translate(-1px, -1px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = variant === "ghost" ? "none" : SHADOW_SM;
      }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `3px solid ${BLACK}`,
  borderRadius: "9px",
  background: "#fff",
  padding: "10px 12px",
  fontSize: "14px",
  fontWeight: 600,
  color: BLACK,
  outline: "none",
  boxShadow: `2px 2px 0px ${BLACK}`,
  fontFamily: "inherit",
};

export default function ConstraintsPage() {
  const { token } = useAuth();
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [integrityScore, setIntegrityScore] = useState<IntegrityScore | null>(null);
  const [integrityVerify, setIntegrityVerify] = useState<IntegrityVerify | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [type, setType] = useState("safety");
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [justPinned, setJustPinned] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingType, setEditingType] = useState("safety");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const isManual = reloadKey > 0;
    const load = async () => {
      try {
        const [data, score, verify] = await Promise.all([
          api.listConstraints(token, { limit: PAGE_SIZE, offset: 0 }, isManual),
          api.integrityScore(token, isManual).catch(() => null),
          api.verifyConstraints(token, isManual).catch(() => null),
        ]);
        if (cancelled) return;
        const list = data as unknown as Constraint[];
        setConstraints(list);
        setHasMore(list.length >= PAGE_SIZE);
        setError(null);
        setIntegrityScore(score ? (score as unknown as IntegrityScore) : null);
        setIntegrityVerify(verify ? (verify as unknown as IntegrityVerify) : null);
      } catch (err) {
        if (cancelled) return;
        if (constraints.length === 0) {
          setError(err instanceof ApiError ? err.message : "Failed to load constraints");
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  function reload() {
    setFetching(true);
    setLoadingMore(false);
    setReloadKey((key) => key + 1);
  }

  async function loadMore() {
    if (!token || loadingMore || fetching) return;
    setLoadingMore(true);
    try {
      const data = await api.listConstraints(token, {
        limit: PAGE_SIZE,
        offset: constraints.length,
      });
      const list = data as unknown as Constraint[];
      setConstraints((prev) => {
        const seen = new Set(prev.map((item) => item.constraint_id));
        return [...prev, ...list.filter((item) => !seen.has(item.constraint_id))];
      });
      setHasMore(list.length >= PAGE_SIZE);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load more constraints");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handlePin(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !text.trim() || pinning) return;
    setPinning(true);
    setPinError(null);
    setJustPinned(false);
    try {
      await api.pinConstraint(token, text.trim(), type);
      setText("");
      setJustPinned(true);
      toast.success("Constraint pinned and signed");
      reload();
    } catch (err) {
      setPinError(err instanceof ApiError ? err.message : "Failed to pin constraint");
    } finally {
      setPinning(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!token || !editingText.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await api.updateConstraint(token, id, editingText.trim(), editingType);
      toast.success("Constraint updated and re-signed");
      setEditingId(null);
      setEditingText("");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update constraint");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!token || deactivatingId) return;
    setDeactivatingId(id);
    try {
      await api.deleteConstraint(token, id);
      toast.success("Constraint deactivated");
      setConfirmingId(null);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to deactivate constraint");
    } finally {
      setDeactivatingId(null);
    }
  }

  function startEdit(constraint: Constraint) {
    setEditingId(constraint.constraint_id);
    setEditingText(constraint.text);
    setEditingType(constraint.constraint_type);
    setConfirmingId(null);
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return constraints.filter((item) => {
      if (typeFilter !== "all" && item.constraint_type !== typeFilter) return false;
      if (!needle) return true;
      return (
        item.text.toLowerCase().includes(needle) ||
        item.constraint_id.toLowerCase().includes(needle)
      );
    });
  }, [constraints, query, typeFilter]);

  const activeCount = constraints.filter((item) => item.is_active).length;
  const signedCount = constraints.filter((item) => Boolean(item.kms_signature)).length;
  const integrityHealthy = integrityScore ? integrityScore.integrity_score >= 0.999 : null;
  const chainValid = integrityVerify?.hash_chain
    ? Boolean(integrityVerify.hash_chain.is_valid ?? integrityVerify.hash_chain.valid)
    : null;

  return (
    <div className="space-y-7">
      {/* Hero header */}
      <div
        style={{
          background: "#0A0F14",
          border: `3px solid ${BLACK}`,
          borderRadius: "16px",
          boxShadow: SHADOW,
          padding: "32px 36px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#FACC15",
              margin: 0,
            }}
          >
            Security controls
          </p>
          <h1
            style={{
              fontFamily: FONT_HEAD,
              fontSize: "44px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#fff",
              margin: "10px 0 0 0",
              lineHeight: 1.05,
            }}
          >
            Constraint Security
          </h1>
          <p style={{ margin: "10px 0 0 0", fontSize: "15px", fontWeight: 600, color: "#94A3B8", maxWidth: "640px" }}>
            Pin safety-critical rules outside the agent&apos;s compressible context. Every rule is hash-chained,
            signed, and re-injected after compaction.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <Chip
            label={`${activeCount} active`}
            bg={activeCount > 0 ? "#2DD4A0" : "#E2E8F0"}
            title="Active constraints"
          />
          <button
            type="button"
            onClick={reload}
            disabled={fetching}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              fontFamily: FONT_HEAD,
              fontWeight: 900,
              fontSize: "13px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: BLACK,
              background: "#FACC15",
              border: `3px solid ${BLACK}`,
              borderRadius: "9px",
              boxShadow: SHADOW_SM,
              padding: "10px 16px",
              cursor: fetching ? "not-allowed" : "pointer",
              opacity: fetching ? 0.6 : 1,
              transform: "translate(-1px, -1px)",
            }}
          >
            <IconRefresh size={15} className={fetching ? "animate-spin" : undefined} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active rules"
          value={fetching ? "…" : activeCount}
          sublabel={`${constraints.length} loaded`}
          icon={<IconShieldCheck size={18} />}
          accent="#2DD4A0"
        />
        <StatCard
          label="Integrity"
          value={fetching ? "…" : integrityHealthy === null ? "—" : integrityHealthy ? "Healthy" : "Degraded"}
          sublabel={
            integrityScore
              ? `${(integrityScore.integrity_score * 100).toFixed(0)}% verified`
              : "Awaiting verification"
          }
          icon={<IconCheckCircle size={18} />}
          accent={integrityHealthy === false ? "#FF4D4D" : "#2DD4A0"}
        />
        <StatCard
          label="Hash chain"
          value={fetching ? "…" : chainValid === null ? "—" : chainValid ? "Valid" : "Broken"}
          sublabel="SHA-256 tamper evidence"
          icon={<IconLink size={18} />}
          accent={chainValid === false ? "#FF4D4D" : "#4D9FFF"}
        />
        <StatCard
          label="Signed rules"
          value={fetching ? "…" : signedCount}
          sublabel="ECDSA P-256 signatures"
          icon={<IconKey size={18} />}
          accent="#C084FC"
        />
      </div>

      {/* Main grid: pin form + list */}
      <div className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <form onSubmit={handlePin}>
            <Panel title="Pin a new rule" description="Protected before every memory operation." accent="#2DD4A0">
              <div className="space-y-4">
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                    <label
                      htmlFor="constraint-text"
                      style={{ fontFamily: FONT_HEAD, fontSize: "12px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: BLACK }}
                    >
                      Constraint
                    </label>
                    <span style={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                      {text.length.toLocaleString()} / 10,000
                    </span>
                  </div>
                  <textarea
                    id="constraint-text"
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value);
                      setJustPinned(false);
                    }}
                    placeholder="Never execute shell commands without explicit user confirmation."
                    maxLength={MAX_LENGTH}
                    rows={5}
                    disabled={pinning}
                    style={{ ...inputStyle, resize: "vertical", minHeight: "120px" }}
                  />
                  <p style={{ margin: "8px 0 0 0", fontSize: "12px", fontWeight: 600, color: "#475569", lineHeight: 1.5 }}>
                    Write a short, unconditional rule. It is stored outside the agent context and checked before
                    high-impact actions.
                  </p>
                </div>

                <div>
                  <span style={{ fontFamily: FONT_HEAD, fontSize: "12px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: BLACK, display: "block", marginBottom: "8px" }}>
                    Category
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(["safety", "policy", "instruction"] as const).map((option) => {
                      const colors = typeColors(option);
                      const active = type === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setType(option)}
                          aria-pressed={active}
                          style={{
                            fontFamily: FONT_HEAD,
                            fontWeight: 900,
                            fontSize: "12px",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: BLACK,
                            background: active ? colors.bg : "#fff",
                            border: `3px solid ${BLACK}`,
                            borderRadius: "9px",
                            boxShadow: active ? `3px 3px 0px ${BLACK}` : `2px 2px 0px ${BLACK}`,
                            padding: "9px 6px",
                            cursor: "pointer",
                            transform: active ? "translate(-1px, -1px)" : "none",
                          }}
                        >
                          {colors.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {pinError ? (
                  <div
                    style={{
                      background: "#FFE5E5",
                      border: `3px solid ${BLACK}`,
                      borderRadius: "9px",
                      boxShadow: `2px 2px 0px ${BLACK}`,
                      padding: "10px 12px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: BLACK,
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <IconAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{pinError}</span>
                  </div>
                ) : null}

                {justPinned ? (
                  <div
                    style={{
                      background: "#D9FFF0",
                      border: `3px solid ${BLACK}`,
                      borderRadius: "9px",
                      boxShadow: `2px 2px 0px ${BLACK}`,
                      padding: "10px 12px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: BLACK,
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <IconCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Rule pinned with a new signature and hash-chain entry.</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pinning || !text.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    width: "100%",
                    fontFamily: FONT_HEAD,
                    fontWeight: 900,
                    fontSize: "14px",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: BLACK,
                    background: "#2DD4A0",
                    border: `3px solid ${BLACK}`,
                    borderRadius: "9px",
                    boxShadow: SHADOW_SM,
                    padding: "12px 16px",
                    cursor: pinning || !text.trim() ? "not-allowed" : "pointer",
                    opacity: pinning || !text.trim() ? 0.55 : 1,
                    transform: "translate(-1px, -1px)",
                  }}
                >
                  {pinning ? (
                    <>
                      <IconRefresh size={15} className="animate-spin" />
                      Pinning…
                    </>
                  ) : (
                    <>
                      <IconLock size={15} />
                      Pin constraint
                    </>
                  )}
                </button>
              </div>
            </Panel>
          </form>

          <Panel title="How pinning protects rules" accent="#FACC15">
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                {
                  title: "Stored outside context",
                  body: "Rules live in the protected pinning engine, not the agent's summarizable context window.",
                },
                {
                  title: "Sealed and signed",
                  body: "Each change creates a hash-chain entry and an ECDSA signature so modifications are detectable.",
                },
                {
                  title: "Re-injected after compaction",
                  body: "The engine verifies and restores active rules after memory compression or poisoning attempts.",
                },
              ].map((step, index) => (
                <li key={step.title} style={{ display: "flex", gap: "12px" }}>
                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#FACC15",
                      border: `3px solid ${BLACK}`,
                      borderRadius: "8px",
                      boxShadow: `2px 2px 0px ${BLACK}`,
                      fontFamily: FONT_HEAD,
                      fontWeight: 900,
                      fontSize: "13px",
                      color: BLACK,
                    }}
                  >
                    {index + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 900, fontFamily: FONT_HEAD, color: BLACK }}>
                      {step.title}
                    </p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", fontWeight: 600, color: "#475569", lineHeight: 1.5 }}>
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          {error ? (
            <div
              style={{
                background: "#FFE5E5",
                border: `3px solid ${BLACK}`,
                borderRadius: "16px",
                boxShadow: SHADOW,
                padding: "28px",
              }}
            >
              <h3 style={{ fontFamily: FONT_HEAD, fontSize: "20px", fontWeight: 900, color: BLACK, margin: 0 }}>
                Unable to load constraints
              </h3>
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", fontWeight: 600, color: "#475569" }}>{error}</p>
              <div style={{ marginTop: "16px" }}>
                <NeoButton onClick={reload} variant="danger">
                  <IconRefresh size={14} />
                  Retry
                </NeoButton>
              </div>
            </div>
          ) : (
            <Panel
              title="Protected constraints"
              description={fetching ? "Loading…" : `${activeCount} active of ${constraints.length} loaded`}
              accent="#4D9FFF"
              action={
                !fetching ? <Chip label={`${filtered.length} shown`} bg="#fff" /> : null
              }
            >
              {/* Toolbar */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: "1 1 180px", minWidth: 0 }}>
                  <IconSearch
                    size={15}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#475569",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search rules"
                    aria-label="Search constraints"
                    style={{ ...inputStyle, paddingLeft: "34px", fontSize: "13px" }}
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  aria-label="Filter by category"
                  style={{ ...inputStyle, width: "auto", fontSize: "13px", cursor: "pointer", fontWeight: 700 }}
                >
                  <option value="all">All categories</option>
                  <option value="safety">Safety</option>
                  <option value="policy">Policy</option>
                  <option value="instruction">Instruction</option>
                </select>
              </div>

              {fetching ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      style={{
                        border: `3px solid ${BLACK}`,
                        borderRadius: "12px",
                        background: "#F1F5F9",
                        height: "88px",
                        animation: "pulse 1.5s ease-in-out infinite",
                      }}
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      width: "56px",
                      height: "56px",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#FACC15",
                      border: `3px solid ${BLACK}`,
                      borderRadius: "14px",
                      boxShadow: SHADOW_SM,
                      color: BLACK,
                    }}
                  >
                    <IconShieldCheck size={26} />
                  </span>
                  <h3
                    style={{
                      fontFamily: FONT_HEAD,
                      fontSize: "20px",
                      fontWeight: 900,
                      color: BLACK,
                      margin: "16px 0 0 0",
                    }}
                  >
                    {constraints.length === 0 ? "No protected rules yet" : "No rules match"}
                  </h3>
                  <p style={{ margin: "8px auto 0", fontSize: "14px", fontWeight: 600, color: "#475569", maxWidth: "380px" }}>
                    {constraints.length === 0
                      ? "Pin the first safety rule to protect it from context compaction and memory poisoning."
                      : "Adjust the search text or category filter to find a constraint."}
                  </p>
                  <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
                    {constraints.length === 0 ? (
                      <NeoButton onClick={() => document.getElementById("constraint-text")?.focus()}>
                        <IconPlus size={15} />
                        Pin first constraint
                      </NeoButton>
                    ) : (
                      <NeoButton
                        variant="secondary"
                        onClick={() => {
                          setQuery("");
                          setTypeFilter("all");
                        }}
                      >
                        Clear filters
                      </NeoButton>
                    )}
                  </div>
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {filtered.map((constraint) => {
                    const colors = typeColors(constraint.constraint_type);
                    const editing = editingId === constraint.constraint_id;
                    const confirming = confirmingId === constraint.constraint_id;
                    return (
                      <li
                        key={constraint.constraint_id}
                        style={{
                          border: `3px solid ${BLACK}`,
                          borderRadius: "12px",
                          boxShadow: `3px 3px 0px ${BLACK}`,
                          background: constraint.is_active ? "#fff" : "#F1F5F9",
                          padding: "16px",
                        }}
                      >
                        <div style={{ display: "flex", gap: "12px" }}>
                          <span
                            style={{
                              width: "40px",
                              height: "40px",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: colors.bg,
                              border: `3px solid ${BLACK}`,
                              borderRadius: "10px",
                              boxShadow: `2px 2px 0px ${BLACK}`,
                              color: BLACK,
                              marginTop: "2px",
                            }}
                          >
                            <IconShield size={18} />
                          </span>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            {editing ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editingText}
                                  onChange={(event) => setEditingText(event.target.value)}
                                  rows={4}
                                  aria-label="Edit constraint text"
                                  style={{ ...inputStyle, resize: "vertical" }}
                                />
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                  <select
                                    value={editingType}
                                    onChange={(event) => setEditingType(event.target.value)}
                                    aria-label="Constraint category"
                                    style={{ ...inputStyle, width: "auto", fontSize: "13px", cursor: "pointer", fontWeight: 700 }}
                                  >
                                    <option value="safety">Safety</option>
                                    <option value="policy">Policy</option>
                                    <option value="instruction">Instruction</option>
                                  </select>
                                  <NeoButton
                                    size="sm"
                                    onClick={() => handleUpdate(constraint.constraint_id)}
                                    disabled={savingEdit || !editingText.trim()}
                                  >
                                    <IconCheck size={14} />
                                    {savingEdit ? "Saving…" : "Save change"}
                                  </NeoButton>
                                  <NeoButton
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setEditingId(null)}
                                    disabled={savingEdit}
                                  >
                                    <IconX size={14} />
                                    Cancel
                                  </NeoButton>
                                </div>
                                <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                                  Editing re-signs the rule and appends a new audit entry.
                                </p>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      lineHeight: 1.55,
                                      color: BLACK,
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {constraint.text}
                                  </p>
                                  {constraint.is_active ? (
                                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                                      <NeoButton
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => startEdit(constraint)}
                                        ariaLabel="Edit constraint"
                                        title="Edit constraint"
                                      >
                                        <IconEdit size={14} />
                                      </NeoButton>
                                      <NeoButton
                                        size="sm"
                                        variant="danger"
                                        onClick={() => setConfirmingId(constraint.constraint_id)}
                                        ariaLabel="Deactivate constraint"
                                        title="Deactivate constraint"
                                      >
                                        <IconTrash size={14} />
                                      </NeoButton>
                                    </div>
                                  ) : null}
                                </div>

                                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "12px" }}>
                                  <Chip label={colors.label} bg={colors.bg} />
                                  <Chip label={constraint.is_active ? "Active" : "Inactive"} bg={constraint.is_active ? "#2DD4A0" : "#E2E8F0"} />
                                  {constraint.kms_signature ? <Chip label="Signed" bg="#C084FC" /> : null}
                                  <span
                                    style={{
                                      fontFamily: FONT_MONO,
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      color: "#64748B",
                                    }}
                                    title={constraint.entry_hash}
                                  >
                                    {constraint.entry_hash ? `${constraint.entry_hash.slice(0, 14)}…` : "hash pending"}
                                  </span>
                                  <span
                                    style={{ fontSize: "12px", fontWeight: 600, color: "#64748B" }}
                                    title={fullDate(constraint.created_at)}
                                  >
                                    Added {relativeTime(constraint.created_at)}
                                  </span>
                                  <span style={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 700, color: "#94A3B8" }}>
                                    {constraint.constraint_id.slice(0, 8)}
                                  </span>
                                </div>

                                {confirming ? (
                                  <div
                                    style={{
                                      marginTop: "12px",
                                      background: "#FFE5E5",
                                      border: `3px solid ${BLACK}`,
                                      borderRadius: "9px",
                                      boxShadow: `2px 2px 0px ${BLACK}`,
                                      padding: "12px",
                                    }}
                                  >
                                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 900, fontFamily: FONT_HEAD, color: BLACK }}>
                                      Deactivate this rule?
                                    </p>
                                    <p style={{ margin: "6px 0 0 0", fontSize: "13px", fontWeight: 600, color: "#475569", lineHeight: 1.5 }}>
                                      It will stop being enforced after context compaction. The audit trail keeps a
                                      record of this action.
                                    </p>
                                    <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                                      <NeoButton
                                        size="sm"
                                        variant="danger"
                                        onClick={() => handleDeactivate(constraint.constraint_id)}
                                        disabled={deactivatingId === constraint.constraint_id}
                                      >
                                        {deactivatingId === constraint.constraint_id ? "Deactivating…" : "Deactivate"}
                                      </NeoButton>
                                      <NeoButton size="sm" variant="secondary" onClick={() => setConfirmingId(null)}>
                                        Keep active
                                      </NeoButton>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {hasMore && !fetching && !error ? (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
                  <NeoButton variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : `Load more (${constraints.length} loaded)`}
                  </NeoButton>
                </div>
              ) : null}
            </Panel>
          )}

          <div
            style={{
              background: "#EFF6FF",
              border: `3px solid ${BLACK}`,
              borderRadius: "14px",
              boxShadow: SHADOW_SM,
              padding: "16px 20px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#1E3A5F",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ fontFamily: FONT_HEAD, fontWeight: 900 }}>How it works: </strong>
            The pinning engine compares stored rules against each memory operation. If a rule was altered or
            dropped, the integrity check flags it before the agent continues.
          </div>
        </div>
      </div>
    </div>
  );
}
