"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/lib/api";

interface AuthState {
  token: string | null;
  userId: string | null;
  orgId: string | null;
  email: string | null;
  fullName: string | null;
  role: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  loadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    userId: null,
    orgId: null,
    email: null,
    fullName: null,
    role: null,
    loading: true,
  });

  const fetchUserProfile = async (token: string, base: Partial<AuthState>) => {
    try {
      const me = await api.me(token);
      return {
        ...base,
        token,
        userId: me.user_id,
        orgId: me.org_id,
        email: me.email,
        fullName: me.full_name,
        role: me.role,
        loading: false,
      };
    } catch {
      return {
        ...base,
        token,
        loading: false,
      };
    }
  };

  const refresh = useCallback(async () => {
    try {
      const res = await api.refresh();
      let role: string | null = null;
      let fullName: string | null = null;
      let email: string | null = null;
      try {
        const me = await api.me(res.access_token);
        role = me.role;
        fullName = me.full_name;
        email = me.email;
      } catch {}
      setState((s) => {
        const ns: AuthState = {
          ...s,
          token: res.access_token,
          userId: res.user_id,
          orgId: res.org_id,
          email: email || s.email,
          fullName: fullName || s.fullName,
          role: role || s.role,
          loading: false,
        };
        localStorage.setItem("agentshield_auth", JSON.stringify(ns));
        return ns;
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const tryRefresh = async () => {
      try {
        const res = await api.refresh();
        const full = await fetchUserProfile(res.access_token, {
          userId: res.user_id,
          orgId: res.org_id,
        });
        setState(full as AuthState);
        localStorage.setItem("agentshield_auth", JSON.stringify(full));
        return;
      } catch {}

      const saved = localStorage.getItem("agentshield_auth");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.token) {
            try {
              const me = await api.me(parsed.token);
              const updated = {
                ...parsed,
                email: me.email,
                fullName: me.full_name,
                role: me.role,
                userId: me.user_id,
                orgId: me.org_id,
                loading: false,
              };
              setState(updated);
              localStorage.setItem("agentshield_auth", JSON.stringify(updated));
              return;
            } catch {
              const ok = await refresh();
              if (!ok) setState((s) => ({ ...s, loading: false }));
              return;
            }
          }
        } catch {
          setState((s) => ({ ...s, loading: false }));
        }
      }
      setState((s) => ({ ...s, loading: false }));
    };
    tryRefresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    const fullState: AuthState = {
      token: res.access_token,
      userId: res.user_id,
      orgId: res.org_id,
      email,
      fullName: null,
      role: null,
      loading: false,
    };
    try {
      const me = await api.me(res.access_token);
      fullState.fullName = me.full_name;
      fullState.role = me.role;
      fullState.email = me.email;
    } catch {}
    setState(fullState);
    try { localStorage.setItem("agentshield_auth", JSON.stringify(fullState)); } catch {}
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const res = await api.register(email, password, fullName);
    const fullState: AuthState = {
      token: res.access_token,
      userId: res.user_id,
      orgId: res.org_id,
      email,
      fullName,
      role: "user",
      loading: false,
    };
    try {
      const me = await api.me(res.access_token);
      fullState.role = me.role;
      fullState.fullName = me.full_name;
    } catch {}
    setState(fullState);
    try { localStorage.setItem("agentshield_auth", JSON.stringify(fullState)); } catch {}
  }, []);


  const loadProfile = useCallback(async () => {
    if (!state.token) return;
    try {
      const me = await api.me(state.token);
      setState((s) => {
        const ns = { ...s, email: me.email, fullName: me.full_name, role: me.role };
        localStorage.setItem("agentshield_auth", JSON.stringify(ns));
        return ns;
      });
    } catch {}
  }, [state.token]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    setState({ token: null, userId: null, orgId: null, email: null, fullName: null, role: null, loading: false });
    localStorage.removeItem("agentshield_auth");
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
