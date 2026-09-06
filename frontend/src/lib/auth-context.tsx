"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/lib/api";

interface AuthState {
  token: string | null;
  userId: string | null;
  orgId: string | null;
  email: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    userId: null,
    orgId: null,
    email: null,
    loading: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem("agentshield_auth");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState({ ...parsed, loading: false });
      } catch {
        setState((s) => ({ ...s, loading: false }));
      }
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    const newState = {
      token: res.access_token,
      userId: res.user_id,
      orgId: res.org_id,
      email,
      loading: false,
    };
    setState(newState);
    localStorage.setItem("agentshield_auth", JSON.stringify(newState));
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const res = await api.register(email, password, fullName);
    const newState = {
      token: res.access_token,
      userId: res.user_id,
      orgId: res.org_id,
      email,
      loading: false,
    };
    setState(newState);
    localStorage.setItem("agentshield_auth", JSON.stringify(newState));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await api.refresh();
      setState((s) => {
        if (!s.token) return s;
        const ns = { ...s, token: res.access_token, userId: res.user_id, orgId: res.org_id };
        localStorage.setItem("agentshield_auth", JSON.stringify({ ...ns, loading: false }));
        return { ...ns, loading: false };
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    setState({ token: null, userId: null, orgId: null, email: null, loading: false });
    localStorage.removeItem("agentshield_auth");
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
