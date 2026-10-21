import React,{useEffect,useState} from 'react';
import {Activity,AlertTriangle,CheckCircle2,Clock3,RefreshCw,RadioTower,Server,WifiOff} from 'lucide-react';

const shownDate=value=>value&&!Number.isNaN(new Date(value).getTime())?new Date(value).toLocaleString():'No packets received';
const protocolName=row=>row.display_name||String(row.protocol||'Unknown').toUpperCase();

export default function TrackingPortsPage({request}){
 const[state,setState]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{setState(await request('/protocol-profiles/status'))}catch(problem){setError(problem.body?.error||problem.message||'Receiver status could not be loaded.')}finally{setLoading(false)}}
 useEffect(()=>{load();const timer=setInterval(load,30000);return()=>clearInterval(timer)},[]);
 const rows=state?.profiles||[];
 return <div className="page trackingPortsPage">
  <div className="titleRow"><div><h1>Tracking Ports</h1><p>Live production receiver configuration and listening status.</p></div><button className="green" onClick={load} disabled={loading}><RefreshCw className={loading?'spin':''}/>{loading?'Checking…':'Check ports'}</button></div>
  {error&&<div className="diagnosticError"><AlertTriangle/>{error}</div>}
  <section className="trackingPortSummary"><div><Server/><span><b>{rows.length}</b><small>Configured protocols</small></span></div><div><CheckCircle2/><span><b>{rows.filter(row=>row.receiverStatus==='listening').length}</b><small>Receivers listening</small></span></div><div><RadioTower/><span><b>{rows.reduce((sum,row)=>sum+Number(row.assignedVehicles||0),0)}</b><small>Assigned vehicles</small></span></div><div><Activity/><span><b>{rows.reduce((sum,row)=>sum+Number(row.onlineVehicles||0),0)}</b><small>Vehicles online</small></span></div></section>
  {!state?.socketCheckAvailable&&state&&<div className="trackingPortWarning"><AlertTriangle/>The server returned protocol settings, but the operating-system socket check was unavailable.</div>}
  <section className="panel"><div className="panelHead"><div><h2>Production receivers</h2><p>Values below come from the backend database and the VPS listening sockets.</p></div><small>Checked {shownDate(state?.checkedAt)}</small></div>
   <div className="trackingPortGrid">{rows.map(row=><article className={`trackingPortCard ${row.receiverStatus}`} key={row.protocol}><header><div className="trackingPortIcon">{row.receiverStatus==='listening'?<RadioTower/>:<WifiOff/>}</div><div><h3>{protocolName(row)}</h3><small>{String(row.protocol||'').toLowerCase()}</small></div><span className={`receiverBadge ${row.receiverStatus}`}>{row.receiverStatus==='listening'?'Listening':row.receiverStatus==='disabled'?'Disabled':'Not listening'}</span></header><div className="trackingPortFields"><div><span>Transport</span><b>{row.transport||'—'}</b></div><div><span>TCP port</span><b>{row.tcp_port||'—'}{row.tcp_port&&<em className={row.tcpListening?'up':'down'}>{row.tcpListening?'Open':'Closed'}</em>}</b></div><div><span>UDP port</span><b>{row.udp_port||'—'}{row.udp_port&&<em className={row.udpListening?'up':'down'}>{row.udpListening?'Open':'Closed'}</em>}</b></div><div><span>Assigned vehicles</span><b>{row.assignedVehicles||0}</b></div><div><span>Online now</span><b>{row.onlineVehicles||0}</b></div><div><span>Last packet</span><b>{shownDate(row.lastPacketAt)}</b></div></div>{row.notes&&<footer><Clock3/>{row.notes}</footer>}</article>)}</div>
   {!rows.length&&!loading&&<div className="empty"><RadioTower/>No production protocol profiles are configured.</div>}
  </section>
  <div className="trackingPortNotice"><AlertTriangle/><div><b>Production safety</b><span>This page is read-only. Changing a port requires coordinated VPS firewall, receiver, DNS and device configuration, so a database-only edit is not offered here.</span></div></div>
 </div>;
}
