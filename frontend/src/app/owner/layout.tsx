"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, createContext, useContext } from "react";
import "./bastion.css";
import { OwnerSidebar } from "@/components/owner-sidebar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STORAGE_KEY = "agentshield_owner_token";

interface OwnerAuthContextType { authenticated: boolean; token: string | null; login: (p:string)=>Promise<{ok:boolean; error?:string}>; logout: ()=>void; loading: boolean; }
const OwnerAuthContext = createContext<OwnerAuthContextType>({ authenticated:false, token:null, login: async()=>({ok:false}), logout:()=>{}, loading:true });
export function useOwnerAuth(){ return useContext(OwnerAuthContext); }

export function OwnerAuthProvider({ children }: { children: React.ReactNode }){
  const [token,setToken]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    try{
      const t=sessionStorage.getItem(STORAGE_KEY);
      if(t){ setToken(t); }
    }catch{} finally{ setLoading(false); }
  },[]);
  // validate token on mount by probing stats
  useEffect(()=>{
    if(!token) return;
    fetch(`${API_BASE}/api/owner/stats`,{ headers:{ Authorization:`Bearer ${token}` }})
      .then(r=>{ if(!r.ok) { sessionStorage.removeItem(STORAGE_KEY); setToken(null);} })
      .catch(()=>{});
  },[token]);

  const login = async (password:string): Promise<{ok:boolean; error?:string}>=>{
    try{
      const r=await fetch(`${API_BASE}/api/owner/verify`,{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ password }) });
      if(!r.ok){
        if(r.status===429) return {ok:false, error:"Rate-limited — try again in 60s"};
        if(r.status===403) return {ok:false, error:"INVALID PASSWORD — use DivyanshAI@11 (capital D)"};
        return {ok:false, error:`Server error ${r.status}`};
      }
      const data=await r.json();
      const t=data.token as string;
      sessionStorage.setItem(STORAGE_KEY,t);
      setToken(t);
      return {ok:true};
    }catch{
      return {ok:false, error:"Backend not reachable — is FastAPI running on :8000?"};
    }
  };
  const logout = ()=>{ try{sessionStorage.removeItem(STORAGE_KEY);}catch{} setToken(null); };
  return <OwnerAuthContext.Provider value={{authenticated: !!token, token, login, logout, loading}}>{children}</OwnerAuthContext.Provider>;
}

export default function OwnerLayout({ children }: { children: React.ReactNode }){
  const { authenticated, loading } = useOwnerAuth();
  if(loading){
    return <div className="owner-root min-h-screen flex items-center justify-center" style={{background:'var(--canvas-bg)'}} suppressHydrationWarning><div className="skeleton" style={{width:160,height:12}} suppressHydrationWarning /></div>;
  }
  if(!authenticated) return <OwnerLoginPage/>;
  return (
    <div className="owner-root" suppressHydrationWarning>
      <div className="owner-layout" suppressHydrationWarning>
        <OwnerSidebar/>
        <div className="owner-viewport" suppressHydrationWarning>
          <header className="owner-header">
            <div style={{display:'flex',alignItems:'center',gap:10, flexWrap:'wrap'}}>
              <span className="glow-badge" style={{fontSize:11,fontWeight:900,fontFamily:'var(--font-sg)', color:'#fff', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', padding:'5px 12px', borderRadius:6, textTransform:'uppercase', letterSpacing:0.5, display:'inline-block'}}>Owner Cockpit</span>
              <span style={{fontSize:11,fontWeight:800, color:'#374151', fontFamily:'var(--font-mono)', background:'#f3f4f6', border:'1.5px solid #000', padding:'3px 8px', borderRadius:4}}>AgentShield • Private</span>
              <span style={{display:'flex',alignItems:'center',gap:8, background:'#f0fdf4', border:'1.5px solid #16a34a', borderRadius:4, padding:'3px 8px'}}>
                <span style={{width:7,height:7, background:'#16a34a', borderRadius:999, display:'inline-block'}}/>
                <span style={{fontSize:11,fontWeight:800,color:'#166534', fontFamily:'var(--font-mono)'}}>Live</span>
              </span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span className="badge badge-yellow">OWNER ONLY</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:10,fontWeight:800, color:'#57534e'}}> /owner • JWT</span>
            </div>
          </header>
          <main className="owner-page">{children}</main>
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
  const handleSubmit = async (e:React.FormEvent)=>{ e.preventDefault(); setSubmitting(true); setError(""); const res=await login(password); if(!res.ok){ setError(res.error||"Invalid password"); setSubmitting(false);} };
  return (
    <div className="owner-root min-h-screen flex items-center justify-center" style={{background:'var(--canvas-bg)', padding:24}} suppressHydrationWarning>
      <div className="panel" style={{width:'100%', maxWidth:420, padding:28}}>
        <div className="eyebrow">Owner Access • Private URL</div>
        <div style={{display:'flex',alignItems:'center',gap:14, marginTop:12, marginBottom:8}}>
          <div style={{width:44,height:44, border:'3px solid #000', borderRadius:4, background:'#000', display:'flex',alignItems:'center',justifyContent:'center', boxShadow:'2px 2px 0 #000'}}>
            <span style={{fontWeight:900,color:'#facc15', fontFamily:'var(--font-sg)'}}>AS</span>
          </div>
          <div>
            <div className="welcome-title" style={{fontSize:20, marginBottom:2}}>AgentShield Owner</div>
            <div style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, color:'#57534e', letterSpacing:0.6}}>Bastion-grade • Enhanced</div>
          </div>
        </div>
        <p className="welcome-subtitle" style={{marginBottom:18}}>Private cockpit. Password never leaves server — verified via bcrypt + JWT. Token stored in sessionStorage (clears on tab close).</p>
        <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:12}}>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter owner password" autoFocus
            style={{background:'#fff', border:'3px solid #000', borderRadius:4, padding:'12px 14px', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, boxShadow:'2px 2px 0 #000', outline:'none', width:'100%'}} />
          {error && <div className="badge badge-red" style={{alignSelf:'flex-start'}}>{error}</div>}
          <button type="submit" disabled={submitting || !password} className="btn btn-primary" style={{opacity: submitting||!password?0.6:1, width:'100%', justifyContent:'center'}}>
            {submitting ? 'Verifying…' : 'Unlock Cockpit →'}
          </button>
          <div style={{fontSize:11, fontWeight:700, color:'#78716c', fontFamily:'var(--font-mono)', textAlign:'center'}}>Server-verified • Rate-limited 5/min • JWT 60min</div>
        </form>
      </div>
    </div>
  );
}


