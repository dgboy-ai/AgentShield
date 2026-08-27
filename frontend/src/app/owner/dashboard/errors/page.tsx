"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useOwnerAuth } from "../../layout";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
interface ErrorEntry { entry_id:string; org_id?:string; actor:string; action:string; details: Record<string,unknown>; recorded_at:string; }

export default function OwnerErrorsPage(){
  const { token } = useOwnerAuth();
  const [blocked,setBlocked]=useState<ErrorEntry[]>([]);
  const [authFailures,setAuthFailures]=useState<ErrorEntry[]>([]);
  const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const [q,setQ]=useState(""); const [filter,setFilter]=useState<"all"|"blocked"|"auth">("all");
  const [page,setPage]=useState(1); const pageSize=8;
  const [openId,setOpenId]=useState<string|null>(null);

  const fetchData = useCallback(async()=>{
    if(!token) return;
    setLoading(true); setError(null);
    try{ const headers={ Authorization:`Bearer ${token}` }; const res=await fetch(`${API_BASE}/api/owner/errors?limit=100`,{headers}); if(!res.ok) throw new Error(`Status ${res.status}`); const data=await res.json(); setBlocked(data.blocked_content||[]); setAuthFailures(data.auth_failures||[]); }
    catch(e){ setError(e instanceof Error? e.message:"Failed"); } finally{ setLoading(false); }
  },[token]);
  useEffect(()=>{ fetchData(); },[fetchData]);

  const all = useMemo(()=>{
    const b = blocked.map(e=>({...e, _kind:"blocked" as const}));
    const a = authFailures.map(e=>({...e, _kind:"auth" as const}));
    let list=[...b,...a].sort((x,y)=> new Date(y.recorded_at).getTime() - new Date(x.recorded_at).getTime());
    if(filter==="blocked") list=list.filter(x=>x._kind==="blocked");
    if(filter==="auth") list=list.filter(x=>x._kind==="auth");
    if(q.trim()){ const qq=q.toLowerCase(); list=list.filter(x=> (x.action?.toLowerCase().includes(qq) || x.actor?.toLowerCase().includes(qq) || JSON.stringify(x.details).toLowerCase().includes(qq))); }
    return list;
  },[blocked,authFailures,filter,q]);
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const pageItems = all.slice((page-1)*pageSize, page*pageSize);
  useEffect(()=>{ setPage(1); },[q,filter]);

  return (
    <div className="stagger" style={{display:'flex', flexDirection:'column', gap:16}}>
      <div>
        <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
          <a href="/owner/dashboard" style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, color:'#57534e', textDecoration:'none'}}>Dashboard</a>
          <span style={{color:'#a8a29e'}}>›</span>
          <span className="welcome-title" style={{fontSize:22}}>Errors & Forensics</span>
          <span className="badge badge-red" style={{marginLeft:8}}>Multi-page • Search • Paginate</span>
        </div>
        <p className="welcome-subtitle">Blocked injections, poisoning hits, and auth failures — Bastion-style alert boxes, searchable, filterable, paginated.</p>
      </div>

      {error && <div className="panel" style={{padding:14, background:'#fef2f2'}}><span className="badge badge-red">{error}</span> <button onClick={fetchData} className="btn btn-outline" style={{marginLeft:8, padding:'6px 10px'}}>Retry</button></div>}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
        <div className="kpi-card" style={{borderColor: blocked.length ? '#ef4444' : '#000'}}>
          <div style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, letterSpacing:1}}>BLOCKED CONTENT</div>
          <div style={{fontFamily:'var(--font-sg)', fontSize:26, fontWeight:900}}>{blocked.length}</div>
          <div style={{fontSize:11, fontWeight:700, color:'#57534e'}}>Injection / poisoning caught</div>
        </div>
        <div className="kpi-card" style={{borderColor: authFailures.length ? '#f59e0b' : '#000'}}>
          <div style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, letterSpacing:1}}>AUTH FAILURES</div>
          <div style={{fontFamily:'var(--font-sg)', fontSize:26, fontWeight:900}}>{authFailures.length}</div>
          <div style={{fontSize:11, fontWeight:700, color:'#57534e'}}>Failed logins / bad tokens</div>
        </div>
      </div>

      <div className="panel" style={{padding:12, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center'}}>
        <div style={{flex:'1 1 260px', display:'flex', alignItems:'center', gap:8, background:'#fff', border:'3px solid #000', borderRadius:4, padding:'8px 12px', boxShadow:'2px 2px 0 #000'}}>
          <span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800}}>⌕</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search actor, action, details JSON…" style={{flex:1, border:'none', outline:'none', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600}}/>
          {q && <button onClick={()=>setQ("")} className="badge badge-yellow" style={{cursor:'pointer'}}>Clear</button>}
        </div>
        <div style={{display:'flex', gap:8}}>
          {(["all","blocked","auth"] as const).map(k=>(
            <button key={k} onClick={()=>setFilter(k)} className={`btn ${filter===k?'btn-primary':'btn-outline'}`} style={{padding:'8px 12px', fontSize:12}}>{k}</button>
          ))}
        </div>
        <div style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, color:'#57534e'}}>{all.length} results • page {page}/{totalPages}</div>
      </div>

      <div className="panel" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 16px', borderBottom:'3px solid #000', background:'#fff'}}>
          <span style={{width:8,height:8, background:'#ef4444', border:'2px solid #000', borderRadius:999, display:'inline-block'}}/>
          <span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, letterSpacing:1}}>FORENSICS FEED</span>
          <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:'#78716c'}}>{pageItems.length} on this page</span>
        </div>
        <div style={{padding:8}}>
          {loading ? <div style={{padding:24, textAlign:'center'}}><div className="skeleton" style={{height:14, width:120, margin:'0 auto'}}/></div>
          : pageItems.length===0 ? <div style={{padding:28, textAlign:'center', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, color:'#78716c'}}>No results — try another filter or search.</div>
          : pageItems.map(e=>(
            <div key={e.entry_id} className="brutal-hover" style={{border:'2px solid #000', borderRadius:6, padding:'12px 14px', marginBottom:8, background: e._kind==='blocked' ? '#fef2f2' : '#fffbeb', boxShadow:'2px 2px 0 #000'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                <span className={`badge ${e._kind==='blocked'?'badge-red':'badge-yellow'}`}>{e._kind==='blocked'?'BLOCKED':'AUTH FAIL'}</span>
                <span style={{fontSize:12, fontWeight:800, color:'#000', fontFamily:'var(--font-sg)'}}>{e.action || e.actor}</span>
                <span style={{marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:'#57534e'}}>{e.recorded_at ? new Date(e.recorded_at).toLocaleString() : ''}</span>
                <button onClick={()=> setOpenId(openId===e.entry_id ? null : e.entry_id)} className="btn btn-outline" style={{padding:'4px 8px', fontSize:11}}>{openId===e.entry_id ? 'Hide' : 'Details'}</button>
              </div>
              <div style={{fontFamily:'var(--font-mono)', fontSize:11, color:'#44403c', marginTop:6}}>Actor: <b>{e.actor || '—'}</b> • ID: {e.entry_id.slice(0,8)}</div>
              {openId===e.entry_id && e.details && Object.keys(e.details).length>0 && (
                <pre style={{marginTop:10, background:'#fff', border:'2px solid #000', borderRadius:4, padding:10, fontSize:11, overflow:'auto', boxShadow:'1px 1px 0 #000'}}>{JSON.stringify(e.details,null,2)}</pre>
              )}
            </div>
          ))}
        </div>
        <div className="pagination" style={{borderTop:'3px solid #000', background:'#fff'}}>
          <button className="pagination-btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹ Prev</button>
          {Array.from({length: totalPages}, (_,i)=>i+1).slice(0,6).map(n=>(
            <button key={n} onClick={()=>setPage(n)} className={`pagination-btn ${n===page?'active':''}`}>{n}</button>
          ))}
          {totalPages>6 && <span style={{fontFamily:'var(--font-mono)', fontSize:12, fontWeight:800}}>…{totalPages}</span>}
          <button className="pagination-btn" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next ›</button>
        </div>
      </div>
    </div>
  );
}
