"use client";
export const dynamic = 'force-dynamic';
import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useOwnerAuth } from "../../layout";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
interface OwnerUser { user_id:string; email:string; full_name:string; role:string; is_active:boolean; org_id:string; created_at:string; }
export default function OwnerUsersPage(){
  const { token } = useOwnerAuth();
  const [users,setUsers]=useState<OwnerUser[]>([]);
  const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const [q,setQ]=useState(""); const [page,setPage]=useState(1); const pageSize=10;
  const fetchData=useCallback(async()=>{ if(!token) return; setLoading(true); setError(null); try{ const h={Authorization:`Bearer ${token}`}; const r=await fetch(`${API_BASE}/api/owner/users`,{headers:h}); if(!r.ok) throw new Error(`Status ${r.status}`); const d=await r.json(); setUsers(d.users||[]);}catch(e){ setError(e instanceof Error?e.message:"Failed"); } finally{ setLoading(false); } },[token]);
  useEffect(()=>{ fetchData(); },[fetchData]);
  const filtered = useMemo(()=>{
    if(!q.trim()) return users;
    const qq=q.toLowerCase();
    return users.filter(u=> (u.email || "").toLowerCase().includes(qq) || (u.full_name || "").toLowerCase().includes(qq) || (u.user_id || "").toLowerCase().includes(qq));
  },[users,q]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const safePage=Math.min(page,totalPages);
  const pageItems=filtered.slice((safePage-1)*pageSize, safePage*pageSize);
  useEffect(()=>{ setPage(1); },[q]);
  useEffect(()=>{ if(page>totalPages) setPage(totalPages); },[page,totalPages]);
  const copyId = async (id: string) => {
    try { await navigator.clipboard.writeText(id); } catch {}
  };
  return (
    <div className="stagger" style={{display:'flex', flexDirection:'column', gap:16}}>
      <div>
        <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}><Link href="/owner/dashboard" style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, color:'#57534e', textDecoration:'none'}} className="transition-colors hover:text-black">Dashboard</Link><span style={{color:'#a8a29e'}} aria-hidden="true">›</span><span className="welcome-title" style={{fontSize:22}}>Users</span><span className="badge badge-purple" style={{marginLeft:8}}>{users.length} total</span></div>
        <p className="welcome-subtitle">All registered users — who downloaded/registered AgentShield. Search by email, name, ID. Paginated brutalist table.</p>
      </div>
      {error && <div className="panel" style={{padding:12, background:'#fef2f2'}}><span className="badge badge-red" role="alert">{error}</span> <button onClick={fetchData} className="btn btn-outline" style={{marginLeft:8, padding:'6px 10px'}}>Retry</button></div>}
      <div className="panel" style={{padding:12, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
        <div style={{flex:1, minWidth:220, display:'flex', alignItems:'center', gap:8, background:'#fff', border:'3px solid #000', borderRadius:4, padding:'8px 12px', boxShadow:'2px 2px 0 #000'}}>
          <span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800}} aria-hidden="true">⌕</span>
          <label htmlFor="owner-user-search" className="sr-only">Search users</label>
          <input id="owner-user-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search email / name / user_id…" autoComplete="off" style={{flex:1, border:'none', outline:'none', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, background:'transparent'}}/>
          {q && <button onClick={()=>setQ("")} className="badge badge-yellow brutal-hover" style={{cursor:'pointer'}}>Clear</button>}
        </div>
        <span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, color:'#57534e'}} aria-live="polite">{filtered.length} matches • page {safePage}/{totalPages}</span>
      </div>
      <div className="panel" style={{padding:0, overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', fontSize:12}}>
            <thead>
              <tr style={{background:'#fff', borderBottom:'3px solid #000', fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, letterSpacing:1, textTransform:'uppercase'}}>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Email</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Name</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Role</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Active</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Created</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{padding:20, textAlign:'center'}}><span className="skeleton" style={{display:'inline-block', width:120, height:12}}/></td></tr>
              : pageItems.length===0 ? <tr><td colSpan={6} style={{padding:20, textAlign:'center', fontFamily:'var(--font-mono)', fontWeight:700, color:'#78716c'}}>No users found</td></tr>
              : pageItems.map(u=>(
                <tr key={u.user_id} style={{borderBottom:'2px solid #e7e5e4'}} className="brutal-hover">
                  <td style={{padding:'10px 12px', fontWeight:800}}>{u.email}</td>
                  <td style={{padding:'10px 12px'}}>{u.full_name || "—"}</td>
                  <td style={{padding:'10px 12px'}}><span className="badge badge-cyan">{u.role || 'user'}</span></td>
                  <td style={{padding:'10px 12px'}}><span className={`badge ${u.is_active?'badge-green':'badge-red'}`}>{u.is_active?'active':'off'}</span></td>
                  <td style={{padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:11}}>{u.created_at? new Date(u.created_at).toLocaleDateString(): '—'}</td>
                  <td style={{padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:10, color:'#57534e'}}><button onClick={() => copyId(u.user_id)} title={u.user_id} className="transition-transform hover:-translate-y-px font-mono">{u.user_id.slice(0,8)} ⧉</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination" style={{borderTop:'3px solid #000', background:'#fff'}}>
          <button className="pagination-btn" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} aria-label="Previous page">‹ Prev</button>
          {Array.from({length: totalPages}, (_,i)=>i+1).slice(Math.max(0,safePage-3),safePage+3).map(n=>(
            <button key={n} onClick={()=>setPage(n)} aria-current={n===safePage ? "page" : undefined} className={`pagination-btn ${n===safePage?'active':''}`}>{n}</button>
          ))}
          {totalPages>6 && safePage<totalPages-3 && <span style={{fontFamily:'var(--font-mono)', fontSize:12, fontWeight:800}}>…{totalPages}</span>}
          <button className="pagination-btn" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} aria-label="Next page">Next ›</button>
        </div>
      </div>
    </div>
  );
}


