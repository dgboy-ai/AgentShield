function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
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

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "include", // for httpOnly refresh/access cookies
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TypeError" && err.message.includes("fetch")) {
      throw new ApiError("Backend unavailable", 503, { error: err.message });
    }
    throw err;
  }

  const expireSession = () => {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem("agentshield_auth"); } catch {}
    window.dispatchEvent(new CustomEvent("agentshield:auth-expired"));
  };

  // Handle 401 with httpOnly refresh (XSS mitigation) and stored refresh fallback
  if (res.status === 401 && !path.includes("/auth/refresh") && !path.includes("/auth/login") && !path.includes("/auth/register")) {
    try {
      let storedRefreshToken: string | undefined;
      let parsedAuth: Record<string, unknown> | null = null;
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem("agentshield_auth");
          if (saved) {
            parsedAuth = JSON.parse(saved);
            storedRefreshToken = (parsedAuth?.refreshToken || parsedAuth?.refresh_token) as string | undefined;
          }
        } catch {}
      }

      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: storedRefreshToken ? JSON.stringify({ refresh_token: storedRefreshToken }) : undefined,
        credentials: "include",
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) headers["Authorization"] = `Bearer ${refreshData.access_token}`;
        if (typeof window !== "undefined" && parsedAuth) {
          parsedAuth.token = refreshData.access_token;
          if (refreshData.refresh_token) parsedAuth.refreshToken = refreshData.refresh_token;
          try { localStorage.setItem("agentshield_auth", JSON.stringify(parsedAuth)); } catch {}
        }
        res = await fetch(`${API_BASE}${path}`, {
          method: opts.method || "GET",
          headers,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          credentials: "include",
        });
        if (res.ok) {
          if (res.status === 204) return undefined as T;
          const retryType = res.headers.get("content-type") || "";
          if (retryType.includes("application/json")) return res.json();
          return (await res.text()) as unknown as T;
        }
      } else {
        // Refresh failed: session expired
        expireSession();
      }
    } catch {
      expireSession();
    }
  }

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new ApiError(extractErrorMessage(detail, res.statusText), res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return (await res.text()) as unknown as T;
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
    request<Record<string, unknown>>(`/api/audit/db-time-travel?timestamp=${encodeURIComponent(timestamp)}&table=${table}`, { token }),
  complianceReport: (token: string) =>
    request<Record<string, unknown>>("/api/audit/compliance/report", { token }),
  exportJsonl: (token: string) =>
    request<string>("/api/audit/export/jsonl", { token }),
  exportCsv: (token: string) =>
    request<string>("/api/audit/export/csv", { token }),
};
