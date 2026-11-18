function resolveApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  if (env) return env;
  if (typeof window !== "undefined") {
    try {
      const u = new URL(window.location.origin);
      if (u.port === "3000") u.port = "8000";
      return u.toString().replace(/\/+$/, "");
    } catch {}
  }
  return "http://localhost:8000";
}

const API_BASE = resolveApiBase();
const REQUEST_TIMEOUT_MS = 20000;
let refreshInflight: Promise<unknown> | null = null;

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

async function parseBody(res: Response): Promise<unknown> {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();
  if (!text) return null;
  if (ct.includes("json") || ct.includes("jsonl") || text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  // JSONL / text export — return raw string
  return text;
}

async function doFetch(path: string, opts: ApiOptions, headers: Record<string, string>, signal: AbortSignal): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
    signal,
  });
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await doFetch(path, opts, headers, ctrl.signal);
  } catch (e) {
    clearTimeout(timer);
    throw new ApiError(e instanceof DOMException && e.name === "AbortError" ? "Request timed out" : "Network unreachable", 0, e);
  }

  // Single-flight 401 refresh — avoids N concurrent refresh storms
  if (res.status === 401 && !path.includes("/auth/refresh") && !path.includes("/auth/login") && !path.includes("/auth/register")) {
    try {
      if (!refreshInflight) {
        refreshInflight = (async () => {
          const r = await fetch(`${API_BASE}/api/auth/refresh`, { method: "POST", credentials: "include" });
          if (!r.ok) throw new Error(`refresh ${r.status}`);
          return parseBody(r);
        })().finally(() => {
          refreshInflight = null;
        });
      }
      const refreshData = (await refreshInflight) as Record<string, unknown>;
      const nextToken = typeof refreshData?.access_token === "string" ? (refreshData.access_token as string) : null;
      try {
        const saved = localStorage.getItem("agentshield_auth");
        if (saved && nextToken) {
          const parsed = JSON.parse(saved) as Record<string, unknown>;
          parsed.token = nextToken;
          localStorage.setItem("agentshield_auth", JSON.stringify(parsed));
        }
      } catch {}
      if (nextToken) headers["Authorization"] = `Bearer ${nextToken}`;
      res = await doFetch(path, opts, headers, ctrl.signal);
    } catch {}
  }
  clearTimeout(timer);

  if (!res.ok) {
    const detail = await parseBody(res).catch(() => null);
    const msg =
      typeof detail === "object" && detail !== null && "detail" in detail
        ? String((detail as Record<string, unknown>).detail)
        : typeof detail === "string" && detail
          ? detail.slice(0, 300)
          : res.statusText || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  // Export endpoints may return raw JSONL text
  if (path.includes("/export/")) {
    return (await parseBody(res)) as T;
  }
  return (await parseBody(res)) as T;
}

export const api = {
  // Health
  health: () => request<{ status: string; db: string }>("/health"),

  // Auth
  register: (email: string, password: string, full_name: string) =>
    request<{ access_token: string; refresh_token?: string; token_type: string; user_id: string; org_id: string; expires_in?: number }>(
      "/api/auth/register",
      { method: "POST", body: { email, password, full_name } }
    ),
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token?: string; token_type: string; user_id: string; org_id: string; expires_in?: number }>(
      "/api/auth/login",
      { method: "POST", body: { email, password } }
    ),
  refresh: () =>
    request<{ access_token: string; refresh_token?: string; token_type: string; user_id: string; org_id: string }>(
      "/api/auth/refresh",
      { method: "POST" }
    ),
  logout: () =>
    request<{ status: string }>("/api/auth/logout", { method: "POST" }),
  me: (token: string) =>
    request<{ user_id: string; email: string; full_name: string; org_id: string }>(
      "/api/auth/me",
      { token }
    ),

  // Constraints
  listConstraints: (token: string, params?: { limit?: number; offset?: number }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).reduce((acc, [k, v]) => { if (v !== undefined) acc[k] = String(v); return acc; }, {} as Record<string, string>)).toString() : "";
    return request<Record<string, unknown>[]>(`/api/constraints${qs}`, { token });
  },
  pinConstraint: (token: string, text: string, constraint_type: string) =>
    request<Record<string, unknown>>("/api/constraints", {
      method: "POST",
      body: { text, constraint_type },
      token,
    }),
  updateConstraint: (token: string, id: string, text: string, constraint_type?: string) =>
    request<Record<string, unknown>>(`/api/constraints/${id}`, {
      method: "PUT",
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
  listMemories: (token: string, params?: { limit?: number; offset?: number }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).reduce((acc, [k, v]) => { if (v !== undefined) acc[k] = String(v); return acc; }, {} as Record<string, string>)).toString() : "";
    return request<Record<string, unknown>[]>(`/api/memories${qs}`, { token });
  },
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
  auditTimeTravel: (token: string, timestamp: string) =>
    request<Record<string, unknown>>(`/api/audit/time-travel?timestamp=${encodeURIComponent(timestamp)}`, { token }),
  auditDbTimeTravel: (token: string, timestamp: string, table: string = "audit_log") =>
    request<Record<string, unknown>>(`/api/audit/db-time-travel?timestamp=${encodeURIComponent(timestamp)}&table=${encodeURIComponent(table)}`, { token }),
  complianceReport: (token: string) =>
    request<Record<string, unknown>>("/api/audit/compliance/report", { token }),
  exportJsonl: (token: string) =>
    request<string>("/api/audit/export/jsonl", { token }),
};
