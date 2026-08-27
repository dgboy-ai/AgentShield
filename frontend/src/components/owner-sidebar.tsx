"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useOwnerAuth } from "@/app/owner/layout";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const NAV = [
  { href: "/owner/dashboard", label: "Overview", icon: GridIcon },
  { href: "/owner/dashboard/errors", label: "Errors", icon: ShieldAlertIcon },
  { href: "/owner/dashboard/users", label: "Users", icon: UsersIcon },
  { href: "/owner/dashboard/health", label: "Health", icon: PulseIcon },
];

function GridIcon(){ return <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 8.25V6ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 18v2.25A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25V15.75Z"/></svg>; }
function ShieldAlertIcon(){ return <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>; }
function UsersIcon(){ return <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.374 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM16.5 6.375a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>; }
function PulseIcon(){ return <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125 9.75 3l2.25 9h5.25L13.5 21l-2.25-9H6Z"/></svg>; }

function ChainVigilantLive(){
  const { token } = useOwnerAuth();
  const [state,setState]=useState<{ok:boolean|null, entries:number, audit:number, checking:boolean}>({ok:null, entries:0, audit:0, checking:true});
  useEffect(()=>{
    if(!token) return;
    let alive=true;
    const poll=async()=>{
      try{
        setState(s=>({...s, checking:true}));
        const r=await fetch(`${API_BASE}/api/owner/chain`,{headers:{Authorization:`Bearer ${token}`}});
        if(!r.ok) throw new Error(String(r.status));
        const j=await r.json();
        if(!alive) return;
        setState({ok: !!j.hash_chain?.is_valid, entries: j.hash_chain?.total_entries ?? 0, audit: j.audit_chain?.total_entries ?? 0, checking:false});
      }catch{ if(alive) setState(s=>({...s, checking:false})); }
    };
    poll();
    const id=setInterval(poll,15000);
    return ()=>{ alive=false; clearInterval(id); };
  },[token]);
  const ok=state.ok;
  const bg = ok===false ? '#ef4444' : ok===true ? '#10b981' : '#a8a29e';
  const badge = ok===false ? 'BROKEN' : ok===true ? 'VERIFIED' : '…';
  const badgeCls = ok===false ? 'badge-red' : ok===true ? 'badge-green' : 'badge-yellow';
  return (
    <div className="panel" style={{padding:'12px'}}>
      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
        <span style={{width:8,height:8, border:'2px solid #000', borderRadius:999, background:bg, display:'inline-block', animation: state.checking ? 'pulse 1s infinite' : undefined}}/>
        <span style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800, letterSpacing:1}}>CHAIN VIGILANT • LIVE</span>
        <span className={`badge ${badgeCls}`} style={{marginLeft:'auto', fontSize:9}}>{badge}</span>
      </div>
      <div className="hash-line" style={{marginBottom:8, opacity: ok===false?0.4:1}}/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <div style={{background:'#fff', border:'2px solid #000', borderRadius:4, padding:'6px 8px'}}>
          <div style={{fontFamily:'var(--font-mono)', fontSize:9, fontWeight:800, color:'#57534e'}}>HASH ENTRIES</div>
          <div style={{fontFamily:'var(--font-sg)', fontWeight:900, fontSize:13, color:'#000'}}>{state.checking && state.entries===0 ? '…' : state.entries}</div>
        </div>
        <div style={{background:'#fff', border:'2px solid #000', borderRadius:4, padding:'6px 8px'}}>
          <div style={{fontFamily:'var(--font-mono)', fontSize:9, fontWeight:800, color:'#57534e'}}>AUDIT ENTRIES</div>
          <div style={{fontFamily:'var(--font-sg)', fontWeight:900, fontSize:13, color:'#000'}}>{state.checking && state.audit===0 ? '…' : state.audit}</div>
        </div>
      </div>
      <div style={{fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:'#57534e', marginTop:8, lineHeight:1.4}}>
        SHA-256 verify() • <span style={{color: ok===false?'#991b1b':'#065f46', fontWeight:800}}>{ok===false ? 'TAMPER DETECTED' : ok ? 'no tamper' : 'checking…'}</span> • ECDSA-P256
      </div>
      {ok===false && <div className="badge badge-red" style={{marginTop:8, width:'100%', justifyContent:'center', display:'flex'}}>Chain broken — see Health →</div>}
    </div>
  );
}

export function OwnerSidebar(){
  const pathname = usePathname();
  const { logout } = useOwnerAuth();
  return (
    <aside className="owner-sidebar">
      <div className="owner-sidebar-top">
        <Link href="/owner/dashboard" className="flex items-center gap-3" style={{textDecoration:'none'}}>
          <div className="w-10 h-10 flex items-center justify-center" style={{background:'#000', border:'2px solid #000', borderRadius:4, boxShadow:'2px 2px 0 #000'}}>
            <span style={{fontFamily:'var(--font-sg)', fontWeight:900, color:'#facc15', fontSize:13}}>AS</span>
          </div>
          <div>
            <div style={{fontFamily:'var(--font-sg)', fontWeight:900, fontSize:13, color:'#000', lineHeight:1}}>AgentShield</div>
            <div style={{fontFamily:'var(--font-mono)', fontSize:9, fontWeight:800, letterSpacing:1, color:'#57534e'}}>OWNER • PRIVATE</div>
          </div>
        </Link>

        <div className="eyebrow" style={{alignSelf:'flex-start'}}>Owner Cockpit</div>

        <nav className="owner-nav">
          {NAV.map(item=>{
            const active = pathname === item.href || (item.href !== "/owner/dashboard" && pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`owner-link ${active ? 'active' : ''}`}>
                <Icon/>{item.label}
              </Link>
            );
          })}
        </nav>

        <ChainVigilantLive />
      </div>

      <div className="owner-sidebar-footer">
        <div className="profile-avatar" style={{width:30,height:30, border:'2px solid #000', borderRadius:4, background:'#facc15', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:11}}>DS</div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:12, fontWeight:800, color:'#000', fontFamily:'var(--font-sg)'}}>Divyansh</div>
          <div style={{fontSize:10, fontWeight:700, color:'#57534e', fontFamily:'var(--font-mono)'}}>OWNER</div>
        </div>
        <button onClick={logout} className="btn btn-outline" style={{padding:'6px 10px', fontSize:11}}>Lock</button>
      </div>
    </aside>
  );
}
