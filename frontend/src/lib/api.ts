function resolveApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  if (env) return env;
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (origin.includes(":3000")) return origin.replace(":3000", ":8000");
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    return origin;
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
  timeoutMs?: number;
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

function extractErrorMessage(detail: unknown, fallback: string): string {
  const body = detail && typeof detail === "object" && "detail" in detail
    ? (detail as Record<string, unknown>).detail
    : detail;
  if (typeof body === "string" && body.trim()) return body;
  if (Array.isArray(body)) {
    const parts = body
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const msg = (item as Record<string, unknown>).msg;
          if (typeof msg === "string") return msg;
        }
        return null;
      })
      .filter((part): part is string => Boolean(part));
    if (parts.length > 0) return parts.join("; ");
  }
  if (body && typeof body === "object") {
    const message = (body as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback || "Request failed";
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
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await doFetch(path, opts, headers, ctrl.signal);
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError("Request timed out", 0, e);
    }
    if (e instanceof Error && e.name === "TypeError" && e.message.includes("fetch")) {
      throw new ApiError("Backend unavailable", 503, { error: e.message });
    }
    throw new ApiError("Network unreachable", 0, e);
  }

  const expireSession = () => {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem("agentshield_auth"); } catch {}
    window.dispatchEvent(new CustomEvent("agentshield:auth-expired"));
  };

  // Single-flight 401 refresh — httpOnly cookie + stored refresh fallback; avoids N concurrent refresh storms
  if (res.status === 401 && !path.includes("/auth/refresh") && !path.includes("/auth/login") && !path.includes("/auth/register")) {
    try {
      if (!refreshInflight) {
        refreshInflight = (async () => {
          let storedRefreshToken: string | undefined;
          if (typeof window !== "undefined") {
            try {
              const saved = localStorage.getItem("agentshield_auth");
              if (saved) {
                const parsedAuth = JSON.parse(saved) as Record<string, unknown>;
                storedRefreshToken = (parsedAuth?.refreshToken || parsedAuth?.refresh_token) as string | undefined;
              }
            } catch {}
          }
          const r = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: storedRefreshToken ? JSON.stringify({ refresh_token: storedRefreshToken }) : undefined,
            credentials: "include",
          });
          if (!r.ok) throw new Error(`refresh ${r.status}`);
          return parseBody(r);
        })().finally(() => {
          refreshInflight = null;
        });
      }
      const refreshData = (await refreshInflight) as Record<string, unknown>;
      const nextToken = typeof refreshData?.access_token === "string" ? (refreshData.access_token as string) : null;
      if (typeof window !== "undefined" && nextToken) {
        try {
          const saved = localStorage.getItem("agentshield_auth");
          if (saved) {
            const parsed = JSON.parse(saved) as Record<string, unknown>;
            parsed.token = nextToken;
            if (typeof refreshData?.refresh_token === "string") parsed.refreshToken = refreshData.refresh_token;
            localStorage.setItem("agentshield_auth", JSON.stringify(parsed));
          }
        } catch {}
      }
      if (nextToken) headers["Authorization"] = `Bearer ${nextToken}`;
      res = await doFetch(path, opts, headers, ctrl.signal);
    } catch {
      // Refresh failed: session expired
      expireSession();
    }
  }
  clearTimeout(timer);

  if (!res.ok) {
    const detail = await parseBody(res).catch(() => null);
    throw new ApiError(extractErrorMessage(detail, res.statusText), res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await parseBody(res)) as T;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatShieldMatch {
  pattern_id: string;
  pattern_name: string;
  category: string;
  severity: string;
  matched_text: string;
}

export interface ChatShieldInfo {
  blocked: boolean;
  risk_score: number;
  match_count: number;
  max_severity: string;
  categories_triggered: string[];
  matches: ChatShieldMatch[];
  scan_time_ms: number;
}

export interface ChatLlmInfo {
  model: string;
  latency_ms: number;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
}

export interface ChatPinnedInfo {
  count: number;
  token_overhead: number;
}

export interface ChatResponse {
  reply: string;
  shield: ChatShieldInfo;
  llm: ChatLlmInfo | null;
  pinned: ChatPinnedInfo;
}

export const api = {
  // Health
  health: () => request<{ status: string; db: string; engine?: string; signing?: Record<string, unknown> }>("/health"),

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
    request<{ user_id: string; email: string; full_name: string; role: string; org_id: string }>(
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
  memoryStats: (token: string) =>
    request<Record<string, unknown>>("/api/memories/stats", { token }),
  storeMemory: (token: string, content: string, memory_type: string) =>
    request<Record<string, unknown>>("/api/memories", {
      method: "POST",
      body: { content, memory_type },
      token,
    }),
  verifyMemories: (token: string) =>
    request<Record<string, unknown>>("/api/memories/chain/verify", { token }),
  getMemory: (token: string, memoryId: string) =>
    request<Record<string, unknown>>(`/api/memories/${memoryId}`, { token }),

  // Scan
  scanText: (token: string, text: string) =>
    request<Record<string, unknown>>("/api/scan", {
      method: "POST",
      body: { text },
      token,
    }),
  scanPatterns: (token: string) =>
    request<Record<string, unknown>>("/api/scan/patterns", { token }),

  // Chat (live Groq agent behind the scan gate)
  chat: (token: string, message: string, history: ChatTurn[] = []) =>
    request<ChatResponse>("/api/chat", {
      method: "POST",
      body: { message, history },
      token,
      timeoutMs: 45000,
    }),

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
  exportCsv: (token: string) =>
    request<string>("/api/audit/export/csv", { token }),
};
