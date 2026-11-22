"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface AuthState {
  token: string | null;
  userId: string | null;
  orgId: string | null;
  email: string | null;
  fullName: string | null;
  role: string | null;
  refreshToken: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  loadProfile: () => Promise<void>;
}

const EMPTY_STATE: AuthState = {
  token: null,
  userId: null,
  orgId: null,
  email: null,
  fullName: null,
  role: null,
  refreshToken: null,
  loading: false,
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ ...EMPTY_STATE, loading: true });

  // Persist auth to localStorage
  const persist = useCallback((s: AuthState) => {
    try { localStorage.setItem("agentshield_auth", JSON.stringify(s)); } catch {}
  }, []);

  // Wipe auth state and redirect to login
  const clearSession = useCallback((reason: "expired" | "logout" = "expired") => {
    try { localStorage.removeItem("agentshield_auth"); } catch {}
    setState({ ...EMPTY_STATE });
    if (reason === "expired") {
      router.push("/login?expired=1");
    } else {
      router.push("/login");
    }
  }, [router]);

  // Try to get a new access token via httpOnly cookie or stored refresh token
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      // Try cookie-based refresh first (backend reads httpOnly cookie automatically)
      const res = await api.refresh();
      if (!res.access_token) return false;

      // Fetch profile with new token
      let profile: { email?: string; full_name?: string; role?: string; user_id?: string; org_id?: string } = {};
      try { profile = await api.me(res.access_token); } catch {}

      const ns: AuthState = {
        token: res.access_token,
        userId: res.user_id || profile.user_id || null,
        orgId: res.org_id || profile.org_id || null,
        email: profile.email || null,
        fullName: profile.full_name || null,
        role: profile.role || null,
        refreshToken: res.refresh_token || null,
        loading: false,
      };
      setState(ns);
      persist(ns);
      return true;
    } catch {
      return false;
    }
  }, [persist]);

  // Bootstrap: run once on mount to restore session
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // 1. Try cookie-based refresh (most reliable — httpOnly cookie auto-sent)
      try {
        const res = await api.refresh();
        if (!cancelled && res.access_token) {
          let profile: { email?: string; full_name?: string; role?: string; user_id?: string; org_id?: string } = {};
          try { profile = await api.me(res.access_token); } catch {}
          const ns: AuthState = {
            token: res.access_token,
            userId: res.user_id || profile.user_id || null,
            orgId: res.org_id || profile.org_id || null,
            email: profile.email || null,
            fullName: profile.full_name || null,
            role: profile.role || null,
            refreshToken: res.refresh_token || null,
            loading: false,
          };
          setState(ns);
          persist(ns);
          return;
        }
      } catch {}

      // 2. Fallback: try stored token from localStorage
      if (!cancelled) {
        try {
          const saved = localStorage.getItem("agentshield_auth");
          if (saved) {
            const parsed: AuthState = JSON.parse(saved);
            if (parsed.token) {
              try {
                const me = await api.me(parsed.token);
                const updated: AuthState = {
                  ...parsed,
                  email: me.email || parsed.email,
                  fullName: me.full_name || parsed.fullName,
                  role: me.role || parsed.role,
                  loading: false,
                };
                if (!cancelled) {
                  setState(updated);
                  persist(updated);
                  return;
                }
              } catch {
                // Stored token also expired — wipe localStorage, show as unauthenticated
                localStorage.removeItem("agentshield_auth");
              }
            }
          }
        } catch {}
      }

      // 3. Not authenticated — set loading false (layout will redirect to /login)
      if (!cancelled) {
        setState({ ...EMPTY_STATE });
      }
    }

    boot();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for auth-expired events dispatched by api.ts when refresh fails mid-session
  useEffect(() => {
    const handle = () => {
      clearSession("expired");
    };
    window.addEventListener("agentshield:auth-expired", handle);
    return () => window.removeEventListener("agentshield:auth-expired", handle);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    let profile: { email?: string; full_name?: string; role?: string } = {};
    try {
      profile = await api.me(res.access_token);
    } catch {
      throw new Error("Failed to validate session after login");
    }
    const ns: AuthState = {
      token: res.access_token,
      userId: res.user_id,
      orgId: res.org_id,
      email: profile.email || email,
      fullName: profile.full_name || null,
      role: profile.role || null,
      refreshToken: res.refresh_token || null,
      loading: false,
    };
    setState(ns);
    persist(ns);
    try { sessionStorage.removeItem("agentshield_chat_current_session_id"); } catch {}
  }, [persist]);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const res = await api.register(email, password, fullName);
    let profile: { email?: string; full_name?: string; role?: string } = {};
    try {
      profile = await api.me(res.access_token);
    } catch {
      throw new Error("Failed to validate session after registration");
    }
    const ns: AuthState = {
      token: res.access_token,
      userId: res.user_id,
      orgId: res.org_id,
      email: profile.email || email,
      fullName: profile.full_name || fullName,
      role: profile.role || null,
      refreshToken: res.refresh_token || null,
      loading: false,
    };
    setState(ns);
    persist(ns);
    try { sessionStorage.removeItem("agentshield_chat_current_session_id"); } catch {}
  }, [persist]);

  const loadProfile = useCallback(async () => {
    if (!state.token) return;
    try {
      const me = await api.me(state.token);
      setState((s) => {
        const ns = { ...s, email: me.email, fullName: me.full_name, role: me.role };
        persist(ns);
        return ns;
      });
    } catch {}
  }, [state.token, persist]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    try { localStorage.removeItem("agentshield_db_engine"); } catch {}
    clearSession("logout");
  }, [clearSession]);

  // Cross-tab session sync: a login/logout in another tab updates this one
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "agentshield_auth") return;
      try {
        if (!e.newValue) {
          setState({ ...EMPTY_STATE });
          return;
        }
        const parsed = JSON.parse(e.newValue) as AuthState;
        setState({ ...parsed, loading: false });
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refresh, loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
