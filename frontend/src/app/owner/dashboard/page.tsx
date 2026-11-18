"use client";
export const dynamic = 'force-dynamic';
import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { useOwnerAuth } from "../layout";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
interface OwnerStats {
  timestamp: string;
  users: { total:number; active:number; recent_today:number };
  organizations: { total:number };
  memories: { total:number; recent_today:number };
  constraints: { total:number; active:number };
  audit: { total_events:number; recent_today:number; blocked_content:number };
  patterns: { total_patterns:number; total_categories:number; by_category?:Record<string,number>; total_scans:number };
  database: { status:string; engine:string };
}
interface ActivityEntry { entry_id:string; event_type:string; actor:string; action:string; details: Record<string,unknown>; recorded_at:string; }
interface SessionRow { org_id:string; org_name:string; owner_email:string; session_label:string; total_entries:number; is_valid:boolean; broken_at:number|null; head_hash:string; verification_time_ms:number; last_active:string|null; verified_at:string; }
interface ChainState { hash_chain:{is_valid:boolean; total_entries:number; chains:any[]; method:string}; audit_chain:{is_valid:boolean; total_entries:number} }

export default function OwnerDashboardPage(){
  const { token } = useOwnerAuth();
  const [stats,setStats]=useState<OwnerStats|null>(null);
  const [activity,setActivity]=useState<ActivityEntry[]>([]);
  const [chain,setChain]=useState<ChainState|null>(null);
  const [sessions,setSessions]=useState<SessionRow[]>([]);
  const [liveTick,setLiveTick]=useState<string|null>(null);
  const [liveEntries,setLiveEntries]=useState<number>(0);
  const esRef=useRef<EventSource|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const fetchData = useCallback(async()=>{
    if(!token) return;
    setLoading(true); setError(null);
    try{
      const headers={ Authorization:`Bearer ${token}` };
      const [sRes,aRes,cRes,sessRes]=await Promise.all([
        fetch(`${API_BASE}/api/owner/stats`,{headers}),
        fetch(`${API_BASE}/api/owner/activity?limit=24`,{headers}),
        fetch(`${API_BASE}/api/owner/chain`,{headers}),
        fetch(`${API_BASE}/api/owner/sessions`,{headers}),
      ]);
      if(!sRes.ok) throw new Error(`Stats ${sRes.status}`);
      setStats(await sRes.json());
      const aData = aRes.ok ? await aRes.json() : {entries:[]}; setActivity(aData.entries||[]);
      const cData = cRes.ok ? await cRes.json() : null; setChain(cData);
      const sessData = sessRes.ok ? await sessRes.json() : {sessions:[]}; setSessions(sessData.sessions||[]);
    }catch(e){ setError(e instanceof Error? e.message:"Failed to load"); } finally{ setLoading(false); }
  },[token]);

  // real-time — cookie-auth SSE (no token in URL), polling fallback with backoff
  useEffect(()=>{
    if(!token) return;
    fetchData();
    // Backend accepts `owner_token` cookie (see /api/owner/stream). Cookie is
    // mirrored on login in ../layout so EventSource sends it via withCredentials.
    let es: EventSource | null = null;
    let closed = false;
    let failures = 0;
    try{
      es = new EventSource(`${API_BASE}/api/owner/stream`, { withCredentials: true } as EventSourceInit);
      esRef.current = es;
      es.onmessage=(e)=>{
        try{
          const d=JSON.parse(e.data);
          failures = 0;
          if(d.ts){ setLiveTick(d.ts); setLiveEntries(d.total_entries ?? 0); }
          // bump org count live without full fetch (functional update, no stale closure)
          if(d.total_sessions!=null){
            setStats(s=> s ? {...s, organizations:{total:d.total_sessions}} : s);
          }
        }catch{}
      };
      es.onerror=()=>{
        failures += 1;
        // Close broken stream; fallback poller below keeps data fresh.
        // Backoff: stop hammering after repeated failures, rely on interval.
        try{ es?.close(); }catch{}
        if(failures > 3){ try{ esRef.current?.close(); }catch{} esRef.current = null; }
      };
    }catch{}
    // fallback poll every 10s if SSE drops/closed
    const id=setInterval(()=>{ if(closed) return; if(!esRef.current || (esRef.current as EventSource).readyState===2) fetchData(); },10000);
    return ()=>{ closed = true; try{ es?.close(); }catch{} esRef.current = null; clearInterval(id); };
  },[token, fetchData]);

  if(loading && !stats){
    return <div className="stagger owner-loading">
      <div className="skeleton" style={{height:28, width:260}}/>
      <div className="kpi-grid">
        {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:110}}/>)}
      </div>
    </div>;
  }
  if(error){
    return <div className="panel owner-error-panel"><div className="badge badge-red" role="alert">{error}</div><div className="owner-error-actions"><button onClick={fetchData} className="btn btn-outline">Retry</button></div></div>;
  }

  const chainValid = chain?.hash_chain.is_valid ?? true;
  const chainEntries = chain?.hash_chain.total_entries ?? 0;
  const auditValid = chain?.audit_chain.is_valid ?? true;

  const kpis = [
    { label:"Users", value: stats?.users.total ?? 0, sub:`${stats?.users.active ?? 0} active • ${stats?.users.recent_today ?? 0} today`, accent:"#0ea5e9" },
    { label:"Memories", value: stats?.memories.total ?? 0, sub:`${stats?.memories.recent_today ?? 0} today • hash-linked`, accent:"#7c3aed" },
    { label:"Constraints", value: stats?.constraints.total ?? 0, sub:`${stats?.constraints.active ?? 0} active • pinned`, accent:"#0D7C5F" },
    { label:"Audit Events", value: stats?.audit.total_events ?? 0, sub:`${stats?.audit.blocked_content ?? 0} blocked • ${stats?.audit.recent_today ?? 0} today`, accent:"#ef4444" },
  ];

  return (
    <div className="stagger" style={{display:'flex', flexDirection:'column', gap:18}}>
      <div className="welcome-section owner-welcome">
        <div className="eyebrow">Owner Cockpit • Session-wise • Real-time SSE</div>
        <div className="welcome-title">AgentShield — Live System Cockpit</div>
        <p className="welcome-subtitle">
          Real product = <b>per-org isolation</b> like Bastion/CRDB: each org owns its hash chain (multi-tenant). Session-wise ledger below shows every org&apos;s chain + live SSE
          <span className={`live-pill${liveTick ? " is-live" : ""}`} aria-live="polite">
            <span className={`live-dot${liveTick ? " is-live" : ""}`} aria-hidden="true"/> {liveTick ? new Date(liveTick).toLocaleTimeString() : 'connecting…'} • {liveEntries} entries live
          </span>
        </p>
      </div>

      <div className="kpi-grid">
        {kpis.map(k=>(
          <div key={k.label} className="kpi-card kpi-hover" tabIndex={0}>
            <div className="kpi-head">
              <span className="chain-dot" style={{width:10,height:10, borderRadius:999, background:k.accent, border:'2px solid #000', display:'inline-block'}}/>
              <span className="kpi-label">{k.label}</span>
            </div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="snapshot-grid">
        <div className="bento-panel">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}><span style={{width:8,height:8, background:'#000', borderRadius:999, display:'inline-block'}}/><span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, letterSpacing:1}}>SYSTEM SNAPSHOT • REAL</span></div>
            <span className="badge badge-yellow">Live • {stats?.database.engine ?? 'unknown'} • SSE</span>
          </div>
          <div className="bento-kpis">
            {[
              {k:"Orgs (sessions)", v: stats?.organizations.total ?? sessions.length, sub:"tenants"},
              {k:"Patterns", v: stats?.patterns.total_patterns ?? 0, sub:"OWASP ASI06"},
              {k:"Categories", v: stats?.patterns.total_categories ?? 0, sub:"live count"},
            ].map(s=>(
              <div key={s.k} className="bento-kpi" tabIndex={0}>
                <div style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, letterSpacing:1, color:'#57534e'}}>{s.k}</div>
                <div style={{fontFamily:'var(--font-sg)', fontSize:22, fontWeight:900, color:'#000'}}>{s.v}</div>
                <div style={{fontSize:10, color:'#78716c', fontWeight:700, fontFamily:'var(--font-mono)'}}>{s.sub}</div>
              </div>
            ))}
          </div>
          {stats?.patterns.by_category && (
            <div style={{marginTop:10, display:'flex', gap:6, flexWrap:'wrap'}}>
              {Object.entries(stats.patterns.by_category).map(([cat,c])=>(
                <span key={cat} className="badge badge-yellow" style={{fontSize:9}}>{cat.split('_')[0]} {c}</span>
              ))}
            </div>
          )}
          <div style={{marginTop:14, display:'flex', alignItems:'center', gap:10, fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, color:'#57534e', flexWrap:'wrap'}}>
            <span>DB:</span><span className={`badge ${stats?.database.status==='connected'?'badge-green':'badge-red'}`}>{stats?.database.status}</span>
            <span>•</span><span>{new Date(stats?.timestamp ?? Date.now()).toLocaleString()}</span>
            <span>•</span><span style={{color:'#000'}}>Scans {stats?.patterns.total_scans ?? 0}</span>
          </div>
        </div>

        <div className="panel" style={{padding:'18px', borderLeft: chainValid ? '3px solid #000' : '3px solid #ef4444'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
            <span style={{width:8,height:8, background: chainValid ? '#10b981' : '#ef4444', border:'2px solid #000', borderRadius:999, display:'inline-block', animation: chainValid?'pulse 1.2s infinite':undefined}}/>
            <span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, letterSpacing:1}}>CHAIN VIGILANT • LIVE SSE</span>
            <span className={`badge ${chainValid ? 'badge-green' : 'badge-red'}`} style={{marginLeft:'auto'}}>{chainValid ? 'VERIFIED' : 'BROKEN'}</span>
          </div>
          <div className="hash-line" style={{marginBottom:12, opacity: chainValid ? 1 : 0.3}}/>
          <div style={{fontSize:12, fontWeight:800, color:'#000'}}>{chainEntries} total entries • {chainValid ? 'no tamper' : 'tamper detected'}</div>
          <div style={{fontSize:11, color:'#57534e', marginTop:4, fontFamily:'var(--font-mono)'}}>{chain?.hash_chain.method ?? 'SHA-256 canonical'}</div>
          {!chainValid && chain?.hash_chain.chains?.find((c:any)=> !c.is_valid) && (
            <div className="badge badge-red" style={{marginTop:8}}>Broken at {chain.hash_chain.chains.find((c:any)=> !c.is_valid).broken_at} • {chain.hash_chain.chains.find((c:any)=> !c.is_valid).broken_entry_id?.slice(0,8)}</div>
          )}
          <div style={{display:'flex', gap:8, marginTop:10, fontSize:11, fontWeight:700}}>
            <span className={`badge ${auditValid ? 'badge-green' : 'badge-red'}`}>Audit {auditValid ? 'OK' : 'FAIL'}: {chain?.audit_chain.total_entries ?? 0}</span>
            <span className="badge badge-yellow">Real-time</span>
          </div>
          <Link href="/owner/dashboard/health" className="btn btn-outline owner-health-link">Open Health →</Link>
        </div>
      </div>

      {/* Session-wise ledger — what orgs do: per-tenant table, not combined */}
      <div className="panel" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'3px solid #000', background:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}><span style={{width:8,height:8, background:'#000', border:'2px solid #000', borderRadius:999, display:'inline-block'}}/><span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, letterSpacing:1}}>SESSION LEDGER • Per-Org Isolation (real)</span></div>
          <span className="badge badge-purple">{sessions.length} sessions</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', fontSize:12, borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#fff', borderBottom:'3px solid #000', fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, letterSpacing:0.5, textTransform:'uppercase'}}>
              <th style={{textAlign:'left', padding:'10px 12px'}}>Session (org)</th>
              <th style={{textAlign:'left', padding:'10px 12px'}}>Owner</th>
              <th style={{textAlign:'left', padding:'10px 12px'}}>Entries</th>
              <th style={{textAlign:'left', padding:'10px 12px'}}>Chain</th>
              <th style={{textAlign:'left', padding:'10px 12px'}}>Head hash</th>
              <th style={{textAlign:'left', padding:'10px 12px'}}>Last active</th>
            </tr></thead>
            <tbody>
              {sessions.length===0 ? <tr><td colSpan={6} style={{padding:20, textAlign:'center', fontFamily:'var(--font-mono)', fontSize:12, color:'#78716c'}}>No sessions yet</td></tr> :
               sessions.map(s=>(
                <tr key={s.org_id} style={{borderBottom:'2px solid #e7e5e4', background: s.is_valid ? '#fff' : '#fef2f2'}}>
                  <td style={{padding:'10px 12px', fontWeight:800, fontFamily:'var(--font-mono)', fontSize:11}}>{s.session_label}</td>
                  <td style={{padding:'10px 12px'}}>{s.owner_email}</td>
                  <td style={{padding:'10px 12px', fontWeight:900}}>{s.total_entries}</td>
                  <td style={{padding:'10px 12px'}}><span className={`badge ${s.is_valid?'badge-green':'badge-red'}`}>{s.is_valid?'VERIFIED':'BROKEN'}</span></td>
                  <td style={{padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:10, color:'#57534e'}}>{s.head_hash}</td>
                  <td style={{padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:10}}>{s.last_active ? new Date(s.last_active).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{padding:'10px 16px', background:'#facc15', borderTop:'3px solid #000', fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800}}>Organizations = tenants: each org is isolated SHA-256 chain (like Bastion per-customer DB). SSE pushes live head + valid per session.</div>
      </div>

      <div className="panel" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'3px solid #000', background:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}><span style={{width:8,height:8, background:'#f97316', border:'2px solid #000', borderRadius:999, display:'inline-block'}}/><span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, letterSpacing:1}}>LIVE ACTIVITY • Audit Trail (real)</span></div>
          <span style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, color:'#78716c'}}>SSE + auto-refresh • newest first</span>
        </div>
        <div style={{padding:8}}>
          {activity.length===0 ? <div style={{padding:24, textAlign:'center', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, color:'#78716c'}}>No activity yet — pin a constraint or store a memory to see trail</div> :
            activity.slice(0,14).map(e=>{
              const d = e.details as any;
              const meta = d?.risk_score != null ? `risk ${d.risk_score}` : d?.match_count != null ? `${d.match_count} matches` : '';
              return (
              <div key={e.entry_id} className="brutal-hover" style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:'2px solid transparent', borderRadius:6}}>
                <span className={`badge ${badgeFor(e.event_type)}`}>{e.event_type}</span>
                <span style={{flex:1, fontSize:12, fontWeight:700, color:'#1c1917', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{e.actor} → {e.action} {meta && <span style={{fontFamily:'var(--font-mono)', fontSize:10, color:'#0D7C5F'}}>• {meta}</span>}</span>
                <span style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:'#78716c', whiteSpace:'nowrap'}}>{e.recorded_at ? new Date(e.recorded_at).toLocaleTimeString() : ''}</span>
              </div>
            )})}
        </div>
      </div>
    </div>
  );
}

function badgeFor(t:string){
  if(t.includes('MEMORY')) return 'badge-purple';
  if(t.includes('CONSTRAINT')) return 'badge-green';
  if(t.includes('PATTERN')) return 'badge-red';
  if(t.includes('AUTH')) return 'badge-cyan';
  if(t.includes('CHAIN')) return 'badge-green';
  return 'badge-yellow';
}


