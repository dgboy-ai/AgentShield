const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const msg = typeof detail === "object" && detail !== null && "detail" in detail
      ? String((detail as Record<string, unknown>).detail)
      : res.statusText;
    throw new ApiError(msg, res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Health
  health: () => request<{ status: string; db: string }>("/health"),

  // Auth
  register: (email: string, password: string, full_name: string) =>
    request<{ access_token: string; token_type: string; user_id: string; org_id: string }>(
      "/api/auth/register",
      { method: "POST", body: { email, password, full_name } }
    ),
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string; user_id: string; org_id: string }>(
      "/api/auth/login",
      { method: "POST", body: { email, password } }
    ),
  me: (token: string) =>
    request<{ user_id: string; email: string; full_name: string; org_id: string }>(
      "/api/auth/me",
      { token }
    ),

  // Constraints
  listConstraints: (token: string) =>
    request<Record<string, unknown>[]>("/api/constraints", { token }),
  pinConstraint: (token: string, text: string, constraint_type: string) =>
    request<Record<string, unknown>>("/api/constraints", {
      method: "POST",
      body: { text, constraint_type },
      token,
    }),
  deleteConstraint: (token: string, id: string) =>
    request<void>(`/api/constraints/${id}`, { method: "DELETE", token }),
  verifyConstraints: (token: string) =>
    request<Record<string, unknown>>("/api/constraints/integrity/verify", { token }),
  integrityScore: (token: string) =>
    request<Record<string, unknown>>("/api/constraints/integrity/score", { token }),

  // Memories
  listMemories: (token: string) =>
    request<Record<string, unknown>[]>("/api/memories", { token }),
  storeMemory: (token: string, content: string, memory_type: string) =>
    request<Record<string, unknown>>("/api/memories", {
      method: "POST",
      body: { content, memory_type },
      token,
    }),
  verifyMemories: (token: string) =>
    request<Record<string, unknown>>("/api/memories/chain/verify", { token }),

  // Scan
  scanText: (token: string, text: string) =>
    request<Record<string, unknown>>("/api/scan", {
      method: "POST",
      body: { text },
      token,
    }),
  scanPatterns: (token: string) =>
    request<Record<string, unknown>>("/api/scan/patterns", { token }),

  // Audit
  auditEntries: (token: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Record<string, unknown>>(`/api/audit${qs}`, { token });
  },
  auditTimeline: (token: string) =>
    request<Record<string, unknown>>("/api/audit/timeline", { token }),
  auditVerify: (token: string) =>
    request<Record<string, unknown>>("/api/audit/verify", { token }),
  complianceReport: (token: string) =>
    request<Record<string, unknown>>("/api/audit/compliance/report", { token }),
  exportJsonl: (token: string) =>
    request<string>("/api/audit/export/jsonl", { token }),
};
