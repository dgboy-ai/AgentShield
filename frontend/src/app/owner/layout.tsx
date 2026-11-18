"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, createContext, useContext } from "react";
import "./bastion.css";
import { OwnerSidebar } from "@/components/owner-sidebar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STORAGE_KEY = "agentshield_owner_token";
const COOKIE_KEY = "owner_token";
const COOKIE_MAX_AGE = 60 * 60; // 60min — mirrors OWNER_JWT_EXPIRE_MINUTES

function setOwnerCookie(token: string) {
  try {
    const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {}
}

function clearOwnerCookie() {
  try {
    document.cookie = `${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {}
}

interface OwnerAuthContextType { authenticated: boolean; token: string | null; login: (p:string)=>Promise<{ok:boolean; error?:string}>; logout: ()=>void; loading: boolean; }
const OwnerAuthContext = createContext<OwnerAuthContextType>({ authenticated:false, token:null, login: async()=>({ok:false}), logout:()=>{}, loading:true });
export function useOwnerAuth(){ return useContext(OwnerAuthContext); }

export function OwnerAuthProvider({ children }: { children: React.ReactNode }){
  const [token,setToken]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    try{
      const t=sessionStorage.getItem(STORAGE_KEY);
      if(t){ setToken(t); setOwnerCookie(t); }
    }catch{} finally{ setLoading(false); }
  },[]);
  // validate token on mount by probing stats
  useEffect(()=>{
    if(!token) return;
    fetch(`${API_BASE}/api/owner/stats`,{ headers:{ Authorization:`Bearer ${token}` }})
      .then(r=>{ if(!r.ok) { try{sessionStorage.removeItem(STORAGE_KEY);}catch{} clearOwnerCookie(); setToken(null);} })
      .catch(()=>{});
  },[token]);

  const login = async (password:string): Promise<{ok:boolean; error?:string}>=>{
    try{
      const r=await fetch(`${API_BASE}/api/owner/verify`,{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ password }) });
      if(!r.ok){
        if(r.status===429) return {ok:false, error:"Too many attempts — try again in 60 seconds"};
        if(r.status===403 || r.status===401) return {ok:false, error:"Invalid owner password"};
        return {ok:false, error:`Server error ${r.status}`};
      }
      const data=await r.json();
      const t=data.token as string;
      try{ sessionStorage.setItem(STORAGE_KEY,t); }catch{}
      setOwnerCookie(t);
      setToken(t);
      return {ok:true};
    }catch{
      return {ok:false, error:"Backend not reachable — is FastAPI running on :8000?"};
    }
  };
  const logout = ()=>{ try{sessionStorage.removeItem(STORAGE_KEY);}catch{} clearOwnerCookie(); setToken(null); };
  return <OwnerAuthContext.Provider value={{authenticated: !!token, token, login, logout, loading}}>{children}</OwnerAuthContext.Provider>;
}

export default function OwnerLayout({ children }: { children: React.ReactNode }){
  const { authenticated, loading, logout } = useOwnerAuth();
  const [navOpen,setNavOpen]=useState(false);
  useEffect(()=>{
    if(!navOpen) return;
    const onKey=(e:KeyboardEvent)=>{ if(e.key==="Escape") setNavOpen(false); };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[navOpen]);
  if(loading){
    return <div className="owner-root min-h-screen flex items-center justify-center" style={{background:'var(--canvas-bg)'}} suppressHydrationWarning><div className="skeleton" style={{width:160,height:12}} suppressHydrationWarning /></div>;
  }
  if(!authenticated) return <OwnerLoginPage/>;
  return (
    <div className={`owner-root${navOpen ? " nav-open" : ""}`} suppressHydrationWarning>
      <div className="owner-layout" suppressHydrationWarning>
        <OwnerSidebar/>
        {navOpen && <div className="owner-scrim" onClick={()=>setNavOpen(false)} aria-hidden="true" />}
        <div className="owner-viewport" suppressHydrationWarning>
          <header className="owner-header">
            <div style={{display:'flex',alignItems:'center',gap:10, flexWrap:'wrap'}}>
              <button
                type="button"
                className="owner-hamburger"
                aria-label={navOpen ? "Close owner navigation" : "Open owner navigation"}
                aria-expanded={navOpen}
                onClick={()=>setNavOpen(o=>!o)}
              >
                <span aria-hidden="true">{navOpen ? "✕" : "☰"}</span>
              </button>
              <span className="glow-badge" style={{fontSize:11,fontWeight:900,fontFamily:'var(--font-sg)', color:'#fff', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', padding:'5px 12px', borderRadius:6, textTransform:'uppercase', letterSpacing:0.5, display:'inline-block'}}>Owner Cockpit</span>
              <span style={{fontSize:11,fontWeight:800, color:'#374151', fontFamily:'var(--font-mono)', background:'#f3f4f6', border:'1.5px solid #000', padding:'3px 8px', borderRadius:4}}>AgentShield • Private</span>
              <span className="live-pill">
                <span className="live-dot" aria-hidden="true"/>
                <span>Live</span>
              </span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span className="badge badge-yellow">OWNER ONLY</span>
              <span className="owner-jwt-hint"> /owner • JWT</span>
              <button type="button" onClick={()=>{ logout(); setNavOpen(false); }} className="btn btn-outline owner-lock-btn">Lock</button>
            </div>
          </header>
          <main className="owner-page" onClick={()=>{ if(navOpen) setNavOpen(false); }}>{children}</main>
        </div>
      </div>
    </div>
  );
}

function OwnerLoginPage(){
  const { login } = useOwnerAuth();
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const handleSubmit = async (e:React.FormEvent)=>{ e.preventDefault(); if(submitting || !password) return; setSubmitting(true); setError(""); const res=await login(password); if(!res.ok){ setError(res.error||"Invalid owner password"); setSubmitting(false); setPassword(""); } };
  return (
    <div className="owner-root min-h-screen flex items-center justify-center owner-login-wrap" suppressHydrationWarning>
      <div className="panel owner-login-card">
        <div className="eyebrow">Owner Access • Private URL</div>
        <div className="owner-login-head">
          <div className="owner-login-mark" aria-hidden="true">
            <span>AS</span>
          </div>
          <div>
            <div className="welcome-title owner-login-title">AgentShield Owner</div>
            <div className="owner-login-sub">Bastion-grade • Enhanced</div>
          </div>
        </div>
        <p className="welcome-subtitle owner-login-copy">Private cockpit. Encrypted in transit, bcrypt-verified on the server, short-lived JWT. Token clears on tab close.</p>
        <form onSubmit={handleSubmit} className="owner-login-form">
          <label htmlFor="owner-password" className="owner-label">Owner password</label>
          <input
            id="owner-password"
            name="owner-password"
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="Enter owner password"
            autoFocus
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "owner-login-error" : undefined}
            className="owner-input"
          />
          {error && <div id="owner-login-error" role="alert" aria-live="assertive" className="badge badge-red owner-error">{error}</div>}
          <button type="submit" disabled={submitting || !password} aria-busy={submitting} className="btn btn-primary owner-submit">
            {submitting ? 'Verifying…' : 'Unlock Cockpit →'}
          </button>
          <div className="owner-login-meta">Server-verified • Rate-limited 5/min • JWT 60min</div>
        </form>
      </div>
    </div>
  );
}


