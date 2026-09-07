"use client";
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from "react";
import { useOwnerAuth } from "../../layout";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
interface Health { status:string; database:{status:string; engine:string; error?:string}; latency_ms:number; version:string; }
export default function OwnerHealthPage(){
  const { token } = useOwnerAuth();
  const [health,setHealth]=useState<Health|null>(null);
  const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const fetchHealth=useCallback(async()=>{ if(!token) return; setLoading(true); setError(null); try{ const h={Authorization:`Bearer ${token}`}; const r=await fetch(`${API_BASE}/api/owner/health`,{headers:h}); if(!r.ok) throw new Error(`Status ${r.status}`); setHealth(await r.json()); }catch(e){ setError(e instanceof Error?e.message:"Failed"); } finally{ setLoading(false); } },[token]);
  useEffect(()=>{ fetchHealth(); },[fetchHealth]);
  return (
    <div className="stagger" style={{display:'flex', flexDirection:'column', gap:16}}>
      <div>
        <div style={{display:'flex', alignItems:'center', gap:8}}><a href="/owner/dashboard" style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, color:'#57534e', textDecoration:'none'}}>Dashboard</a><span style={{color:'#a8a29e'}}>›</span><span className="welcome-title" style={{fontSize:22}}>Health</span></div>
        <p className="welcome-subtitle">DB connectivity, latency, engine, and version — Bastion-style health cockpit for AgentShield.</p>
      </div>
      {error && <div className="panel" style={{padding:12, background:'#fef2f2'}}><span className="badge badge-red">{error}</span> <button onClick={fetchHealth} className="btn btn-outline" style={{marginLeft:8, padding:'6px 10px'}}>Retry</button></div>}
      {loading && !health ? <div className="skeleton" style={{height:120}}/> : health && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14}}>
            <div className="kpi-card">
              <div style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, letterSpacing:1}}>STATUS</div>
              <div style={{display:'flex', alignItems:'center', gap:10, marginTop:4}}>
                <span style={{width:12,height:12, borderRadius:999, background: health.status==='healthy'?'#10b981':'#ef4444', border:'2px solid #000', display:'inline-block'}}/>
                <span style={{fontFamily:'var(--font-sg)', fontSize:22, fontWeight:900, textTransform:'uppercase'}}>{health.status}</span>
              </div>
              <div style={{fontSize:11, fontWeight:700, color:'#57534e', fontFamily:'var(--font-mono)'}}>Uptime via host • v{health.version}</div>
            </div>
            <div className="kpi-card">
              <div style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, letterSpacing:1}}>DATABASE</div>
              <div style={{fontFamily:'var(--font-sg)', fontSize:20, fontWeight:900}}>{health.database.engine}</div>
              <div style={{marginTop:6}}><span className={`badge ${health.database.status==='connected'?'badge-green':'badge-red'}`}>{health.database.status}</span></div>
              {health.database.error && <div style={{fontSize:11, color:'#991b1b', marginTop:6, fontFamily:'var(--font-mono)'}}>{health.database.error}</div>}
            </div>
            <div className="kpi-card">
              <div style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, letterSpacing:1}}>LATENCY</div>
              <div style={{fontFamily:'var(--font-sg)', fontSize:22, fontWeight:900}}>{health.latency_ms >=0 ? `${health.latency_ms} ms` : '—'}</div>
              <div style={{fontSize:11, fontWeight:700, color:'#57534e', fontFamily:'var(--font-mono)'}}>SELECT 1 round-trip</div>
            </div>
          </div>
          <div className="bento-panel">
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
              <div style={{width:8,height:8, background:'#000', borderRadius:999, display:'inline-block'}}/>
              <span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, letterSpacing:1}}>ENHANCED CHECKS</span>
              <span className="badge badge-yellow" style={{marginLeft:'auto'}}>Bastion-grade</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div className="panel" style={{padding:14}}>
                <div style={{fontSize:12, fontWeight:800}}>Hash Chain</div>
                <div style={{fontSize:11, color:'#57534e', marginTop:4}}>SHA-256 linked memories + audit. Any mutation breaks verification — same guarantee as Bastion's persistent memory.</div>
                <div className="hash-line" style={{marginTop:10}}/>
              </div>
              <div className="panel" style={{padding:14}}>
                <div style={{fontSize:12, fontWeight:800}}>Rate Limit</div>
                <div style={{fontSize:11, color:'#57534e', marginTop:4}}>Per-IP sliding window + 429 Retry-After. Protects scan & auth from abuse.</div>
                <div style={{marginTop:10, display:'flex', gap:8}}><span className="badge badge-green">429 Safe</span><span className="badge badge-cyan">Jitter Backoff</span></div>
              </div>
            </div>
            <button onClick={fetchHealth} className="btn btn-primary" style={{marginTop:14}}>Re-check Health →</button>
          </div>
        </>
      )}
    </div>
  );
}


