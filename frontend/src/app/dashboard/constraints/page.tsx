"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Badge,
  EmptyState,
  ErrorState,
  InfoNote,
  PageHeader,
  Skeleton,
  StatCard,
  type Tone,
} from "@/components/dashboard/kit";
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

const TYPE_META: Record<
  string,
  { label: string; tone: Tone; icon: typeof IconShield }
> = {
  safety: { label: "Safety", tone: "red", icon: IconAlert },
  policy: { label: "Policy", tone: "amber", icon: IconLock },
  instruction: { label: "Instruction", tone: "blue", icon: IconShieldCheck },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type || "General", tone: "neutral" as Tone, icon: IconShield };
}

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

    const load = async () => {
      try {
        const [data, score, verify] = await Promise.all([
          api.listConstraints(token, { limit: PAGE_SIZE, offset: 0 }),
          api.integrityScore(token).catch(() => null),
          api.verifyConstraints(token).catch(() => null),
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
        setError(err instanceof ApiError ? err.message : "Failed to load constraints");
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security controls"
        title="Constraint Security"
        description="Pin safety-critical rules outside the agent's compressible context. Every rule is hash-chained, signed, and re-injected after compaction."
        icon={<IconShield size={22} />}
        actions={
          <>
            <Badge tone={activeCount > 0 ? "green" : "neutral"}>
              <span className="ds-dot" />
              {activeCount} active
            </Badge>
            <button
              type="button"
              onClick={reload}
              disabled={fetching}
              className="ds-btn ds-btn-secondary"
            >
              <IconRefresh size={15} className={fetching ? "animate-spin" : undefined} />
              Refresh
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Active rules"
          value={fetching ? <Skeleton className="h-8 w-14" /> : activeCount}
          sublabel={`${constraints.length} loaded`}
          icon={<IconShieldCheck size={17} />}
          tone="green"
        />
        <StatCard
          label="Integrity"
          value={
            fetching ? (
              <Skeleton className="h-8 w-20" />
            ) : integrityHealthy === null ? (
              "—"
            ) : integrityHealthy ? (
              "Healthy"
            ) : (
              "Degraded"
            )
          }
          sublabel={
            integrityScore
              ? `${(integrityScore.integrity_score * 100).toFixed(0)}% verified`
              : "Awaiting verification"
          }
          icon={<IconCheckCircle size={17} />}
          tone={integrityHealthy === false ? "red" : "green"}
        />
        <StatCard
          label="Hash chain"
          value={
            fetching ? (
              <Skeleton className="h-8 w-20" />
            ) : chainValid === null ? (
              "—"
            ) : chainValid ? (
              "Valid"
            ) : (
              "Broken"
            )
          }
          sublabel="SHA-256 tamper evidence"
          icon={<IconLink size={17} />}
          tone={chainValid === false ? "red" : "blue"}
        />
        <StatCard
          label="Signed rules"
          value={fetching ? <Skeleton className="h-8 w-14" /> : signedCount}
          sublabel="ECDSA P-256 signatures"
          icon={<IconKey size={17} />}
          tone="purple"
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <form onSubmit={handlePin} className="ds-card p-5">
            <div className="mb-4 flex items-start gap-3">
              <div
                className="ds-icon-tile h-10 w-10"
                style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}
              >
                <IconPlus size={18} />
              </div>
              <div>
                <h2 className="ds-card-title">Pin a new rule</h2>
                <p className="ds-meta mt-0.5">Protected before every memory operation.</p>
              </div>
            </div>

            <div className="ds-field">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="constraint-text" className="ds-label">
                  Constraint
                </label>
                <span className="ds-meta">{text.length.toLocaleString()} / 10,000</span>
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
                className="ds-textarea"
              />
              <p className="ds-help">
                Write a short, unconditional rule. It is stored outside the agent context and
                checked before high-impact actions.
              </p>
            </div>

            <div className="ds-field mt-4">
              <span className="ds-label">Category</span>
              <div className="grid grid-cols-3 gap-2">
                {(["safety", "policy", "instruction"] as const).map((option) => {
                  const meta = typeMeta(option);
                  const active = type === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setType(option)}
                      className={`ds-btn ds-btn-sm ${active ? "ds-btn-primary" : "ds-btn-secondary"}`}
                      aria-pressed={active}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {pinError ? (
              <div className="ds-alert mt-4">
                <IconAlert size={16} className="mt-0.5 shrink-0" />
                <span>{pinError}</span>
              </div>
            ) : null}

            {justPinned ? (
              <div className="ds-alert ds-alert-success mt-4">
                <IconCheck size={16} className="mt-0.5 shrink-0" />
                <span>Rule pinned with a new signature and hash-chain entry.</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pinning || !text.trim()}
              className="ds-btn ds-btn-primary mt-4 w-full"
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
          </form>

          <div className="ds-card p-5">
            <h2 className="ds-card-title">How pinning protects rules</h2>
            <ol className="mt-4 space-y-4">
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
                <li key={step.title} className="flex gap-3">
                  <span
                    className="ds-mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--ds-text)" }}>
                      {step.title}
                    </p>
                    <p className="ds-meta mt-0.5">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          {error ? (
            <ErrorState
              title="Unable to load constraints"
              message={error}
              onRetry={reload}
            />
          ) : (
            <div className="ds-card overflow-hidden">
              <div className="ds-card-head">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="ds-card-title">Protected constraints</h2>
                    {!fetching ? <Badge tone="neutral">{filtered.length}</Badge> : null}
                  </div>
                  <p className="ds-meta mt-1">
                    {activeCount} active of {constraints.length} loaded
                  </p>
                </div>
                <div className="ds-toolbar">
                  <div className="relative">
                    <IconSearch
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--ds-text-muted)" }}
                    />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search rules"
                      aria-label="Search constraints"
                      className="ds-input h-9 w-full pl-9 text-[13px] sm:w-56"
                    />
                  </div>
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    aria-label="Filter by category"
                    className="ds-select h-9 w-auto text-[13px]"
                  >
                    <option value="all">All categories</option>
                    <option value="safety">Safety</option>
                    <option value="policy">Policy</option>
                    <option value="instruction">Instruction</option>
                  </select>
                </div>
              </div>

              {fetching ? (
                <div className="divide-y" style={{ borderColor: "var(--ds-border)" }}>
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex gap-4 p-5">
                      <Skeleton className="h-10 w-10 shrink-0" />
                      <div className="flex-1 space-y-3">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={<IconShieldCheck size={22} />}
                  title={constraints.length === 0 ? "No protected rules yet" : "No rules match"}
                  description={
                    constraints.length === 0
                      ? "Pin the first safety rule to protect it from context compaction and memory poisoning."
                      : "Adjust the search text or category filter to find a constraint."
                  }
                  action={
                    constraints.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => document.getElementById("constraint-text")?.focus()}
                        className="ds-btn ds-btn-primary"
                      >
                        <IconPlus size={15} />
                        Pin first constraint
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setTypeFilter("all");
                        }}
                        className="ds-btn ds-btn-secondary"
                      >
                        Clear filters
                      </button>
                    )
                  }
                />
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--ds-border)" }}>
                  {filtered.map((constraint) => {
                    const meta = typeMeta(constraint.constraint_type);
                    const TypeIcon = meta.icon;
                    const editing = editingId === constraint.constraint_id;
                    const confirming = confirmingId === constraint.constraint_id;
                    return (
                      <li key={constraint.constraint_id} className="p-4 sm:p-5">
                        <div className="flex gap-3">
                          <div
                            className="ds-icon-tile mt-0.5 h-10 w-10"
                            style={{
                              background: constraint.is_active ? "#F8FAFC" : "#F1F5F9",
                              color: constraint.is_active ? "#047857" : "#64748B",
                              border: "1px solid var(--ds-border)",
                            }}
                          >
                            <TypeIcon size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            {editing ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editingText}
                                  onChange={(event) => setEditingText(event.target.value)}
                                  rows={4}
                                  className="ds-textarea"
                                  aria-label="Edit constraint text"
                                />
                                <div className="ds-toolbar">
                                  <select
                                    value={editingType}
                                    onChange={(event) => setEditingType(event.target.value)}
                                    className="ds-select h-9 w-auto text-[13px]"
                                    aria-label="Constraint category"
                                  >
                                    <option value="safety">Safety</option>
                                    <option value="policy">Policy</option>
                                    <option value="instruction">Instruction</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdate(constraint.constraint_id)}
                                    disabled={savingEdit || !editingText.trim()}
                                    className="ds-btn ds-btn-primary ds-btn-sm"
                                  >
                                    <IconCheck size={14} />
                                    {savingEdit ? "Saving…" : "Save change"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    disabled={savingEdit}
                                    className="ds-btn ds-btn-secondary ds-btn-sm"
                                  >
                                    <IconX size={14} />
                                    Cancel
                                  </button>
                                </div>
                                <p className="ds-help">
                                  Editing re-signs the rule and appends a new audit entry.
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <p className="text-sm font-semibold leading-relaxed" style={{ color: "var(--ds-text)" }}>
                                    {constraint.text}
                                  </p>
                                  {constraint.is_active ? (
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEdit(constraint)}
                                        className="ds-icon-btn"
                                        aria-label="Edit constraint"
                                        title="Edit constraint"
                                      >
                                        <IconEdit size={15} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmingId(constraint.constraint_id)}
                                        className="ds-icon-btn"
                                        aria-label="Deactivate constraint"
                                        title="Deactivate constraint"
                                      >
                                        <IconTrash size={15} />
                                      </button>
                                    </div>
                                  ) : null}
                                </div>

                                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                                  <Badge tone={meta.tone}>{meta.label}</Badge>
                                  <Badge tone={constraint.is_active ? "green" : "neutral"}>
                                    <span className="ds-dot" />
                                    {constraint.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                  {constraint.kms_signature ? (
                                    <Badge tone="purple">
                                      <IconKey size={11} />
                                      Signed
                                    </Badge>
                                  ) : null}
                                  <span
                                    className="ds-mono text-[11px]"
                                    title={constraint.entry_hash}
                                    style={{ color: "var(--ds-text-muted)" }}
                                  >
                                    {constraint.entry_hash ? `${constraint.entry_hash.slice(0, 14)}…` : "hash pending"}
                                  </span>
                                  <span className="ds-meta" title={fullDate(constraint.created_at)}>
                                    Added {relativeTime(constraint.created_at)}
                                  </span>
                                  <span className="ds-mono text-[11px]" style={{ color: "var(--ds-text-muted)" }}>
                                    {constraint.constraint_id.slice(0, 8)}
                                  </span>
                                </div>

                                {confirming ? (
                                  <div className="ds-alert mt-3">
                                    <IconAlert size={16} className="mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                      <p className="font-semibold">Deactivate this rule?</p>
                                      <p className="mt-0.5 text-[12.5px]">
                                        It will stop being enforced after context compaction. The
                                        audit trail keeps a record of this action.
                                      </p>
                                      <div className="mt-2.5 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleDeactivate(constraint.constraint_id)}
                                          disabled={deactivatingId === constraint.constraint_id}
                                          className="ds-btn ds-btn-danger ds-btn-sm"
                                        >
                                          {deactivatingId === constraint.constraint_id
                                            ? "Deactivating…"
                                            : "Deactivate"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmingId(null)}
                                          className="ds-btn ds-btn-secondary ds-btn-sm"
                                        >
                                          Keep active
                                        </button>
                                      </div>
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
                <div className="flex items-center justify-center border-t px-5 py-4" style={{ borderColor: "var(--ds-border)" }}>
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="ds-btn ds-btn-secondary ds-btn-sm"
                  >
                    {loadingMore ? "Loading…" : `Load more (${constraints.length} loaded)`}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <InfoNote>
            The pinning engine compares stored rules against each memory operation. If a rule was
            altered or dropped, the integrity check flags it before the agent continues.
          </InfoNote>
        </div>
      </div>
    </div>
  );
}
