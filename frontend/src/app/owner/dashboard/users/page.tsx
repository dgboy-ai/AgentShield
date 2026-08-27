"use client";
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
    return users.filter(u=> u.email.toLowerCase().includes(qq) || u.full_name.toLowerCase().includes(qq) || u.user_id.toLowerCase().includes(qq));
  },[users,q]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const pageItems=filtered.slice((page-1)*pageSize, page*pageSize);
  useEffect(()=>{ setPage(1); },[q]);
  return (
    <div className="stagger" style={{display:'flex', flexDirection:'column', gap:16}}>
      <div>
        <div style={{display:'flex', alignItems:'center', gap:8}}><a href="/owner/dashboard" style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, color:'#57534e', textDecoration:'none'}}>Dashboard</a><span style={{color:'#a8a29e'}}>›</span><span className="welcome-title" style={{fontSize:22}}>Users</span><span className="badge badge-purple" style={{marginLeft:8}}>{users.length} total</span></div>
        <p className="welcome-subtitle">All registered users — who downloaded/registered AgentShield. Search by email, name, ID. Paginated brutalist table.</p>
      </div>
      {error && <div className="panel" style={{padding:12, background:'#fef2f2'}}><span className="badge badge-red">{error}</span></div>}
      <div className="panel" style={{padding:12, display:'flex', gap:10, alignItems:'center'}}>
        <div style={{flex:1, display:'flex', alignItems:'center', gap:8, background:'#fff', border:'3px solid #000', borderRadius:4, padding:'8px 12px', boxShadow:'2px 2px 0 #000'}}>
          <span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800}}>⌕</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search email / name / user_id…" style={{flex:1, border:'none', outline:'none', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600}}/>
          {q && <button onClick={()=>setQ("")} className="badge badge-yellow" style={{cursor:'pointer'}}>Clear</button>}
        </div>
        <span style={{fontFamily:'var(--font-mono)', fontSize:11, fontWeight:800, color:'#57534e'}}>{filtered.length} matches • page {page}/{totalPages}</span>
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
                <tr key={u.user_id} style={{borderBottom:'2px solid #e7e5e4'}}>
                  <td style={{padding:'10px 12px', fontWeight:800}}>{u.email}</td>
                  <td style={{padding:'10px 12px'}}>{u.full_name}</td>
                  <td style={{padding:'10px 12px'}}><span className="badge badge-cyan">{u.role || 'user'}</span></td>
                  <td style={{padding:'10px 12px'}}><span className={`badge ${u.is_active?'badge-green':'badge-red'}`}>{u.is_active?'active':'off'}</span></td>
                  <td style={{padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:11}}>{u.created_at? new Date(u.created_at).toLocaleDateString(): '—'}</td>
                  <td style={{padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:10, color:'#57534e'}}>{u.user_id.slice(0,8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
