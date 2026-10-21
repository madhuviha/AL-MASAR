import React,{useEffect,useMemo,useState} from 'react';
import {Activity,AlertTriangle,Car,CheckCircle2,Clipboard,Download,RefreshCw,Search,ShieldAlert,Users,Wifi} from 'lucide-react';
import {requestExport} from '../../../company-admin/frontend/src/ExportDialog.jsx';

const when=value=>value&&!Number.isNaN(new Date(value).getTime())?new Date(value).toLocaleString():'—';
const labelStatus=value=>String(value||'unknown').replace(/(^|\s)\w/g,letter=>letter.toUpperCase());
const idText=(prefix,value)=>value?`${prefix}-${value}`:'—';

function exportRows(rows){
 requestExport(`inviha-diagnostics-${new Date().toISOString().slice(0,10)}`,rows.map(row=>({time:row.time,source:row.source,level:row.level,companyId:row.companyId,userId:row.userId,vehicleId:row.vehicleId,imei:row.imei,protocol:row.protocol,sourceIp:row.sourceIp,port:row.port,message:row.message})),{formats:['csv','xlsx','json']});
}

export default function SupportDiagnosticsPage({data,request}){
 const[tab,setTab]=useState('raw');
 const[filters,setFilters]=useState({companyId:'',userId:'',vehicleId:'',query:'',hours:'24'});
 const[snapshot,setSnapshot]=useState(null),[raw,setRaw]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const allUsers=useMemo(()=>Object.values(data.subAccounts||{}).flat(),[data.subAccounts]);
 const availableUsers=useMemo(()=>allUsers.filter(user=>!filters.companyId||String(user.companyId)===String(filters.companyId)),[allUsers,filters.companyId]);
 const selectedUser=allUsers.find(user=>String(user.id)===String(filters.userId));
 const availableVehicles=useMemo(()=>data.vehicles.filter(vehicle=>(!filters.companyId||String(vehicle.companyId)===String(filters.companyId))&&(!selectedUser||String(vehicle.companyId)===String(selectedUser.companyId))),[data.vehicles,filters.companyId,selectedUser?.id]);

 async function load(nextFilters=filters){
  setLoading(true);setError('');
  try{
   const params=new URLSearchParams();Object.entries(nextFilters).forEach(([key,value])=>value&&params.set(key,value));
   const overview=await request(`/diagnostics/overview?${params.toString()}`);setSnapshot(overview);
   const wanted=nextFilters.vehicleId||overview.vehicles?.[0]?.id;
   if(wanted){
    const detail=await request(`/diagnostics?vehicleId=${encodeURIComponent(wanted)}`);setRaw(detail);
    if(!nextFilters.vehicleId&&overview.vehicles?.length)setFilters(current=>({...current,vehicleId:String(wanted)}));
   }else setRaw(null);
  }catch(problem){setError(problem.body?.error||problem.message||'Diagnostics could not be loaded.')}finally{setLoading(false)}
 }

 useEffect(()=>{load();const timer=setInterval(()=>load(),30000);return()=>clearInterval(timer)},[filters.companyId,filters.userId,filters.vehicleId,filters.hours]);
 const vehicles=snapshot?.vehicles||[],users=snapshot?.users||[],events=snapshot?.events||[],admissions=snapshot?.admissions||[];
 const issues=useMemo(()=>[
  ...events.map(item=>({key:`event-${item.id}`,time:item.createdAt,source:item.source==='backend-api'?'API':'System',level:item.level,companyId:item.companyId,userId:item.userId,vehicleId:item.vehicleId,imei:item.imei,protocol:item.protocol,sourceIp:item.sourceIp,port:item.trackerPort,message:item.message})),
  ...admissions.map(item=>({key:`admission-${item.id}`,time:item.lastSeen,source:'Unregistered device',level:item.status==='declined'?'error':'warning',companyId:null,userId:null,vehicleId:null,imei:item.imei,protocol:item.protocol,sourceIp:item.sourceIp,port:item.sourcePort,message:`${labelStatus(item.status)} tracker connection · ${Number(item.attemptCount||0).toLocaleString()} attempt(s)`})),
  ...vehicles.filter(item=>item.issue).map(item=>({key:`vehicle-${item.id}`,time:item.lastUpdate||snapshot?.sampledAt,source:'Tracker status',level:'warning',companyId:item.companyId,userId:null,vehicleId:item.id,imei:item.imei,protocol:item.protocol,sourceIp:null,port:item.trackerPort,message:item.issue}))
 ].sort((a,b)=>new Date(b.time||0)-new Date(a.time||0)),[events,admissions,vehicles,snapshot?.sampledAt]);
 const selectedVehicle=vehicles.find(vehicle=>String(vehicle.id)===String(filters.vehicleId))||vehicles[0]||null;
 const rawDevice=raw?.device||{}, rawVehicle=raw?.vehicle||selectedVehicle||{};
 const rawAttributes=rawDevice.attributes||{};
 const rawPacket=rawDevice.lastDriverUniqueId?{...rawAttributes,lastKnownDriverUniqueId:rawDevice.lastDriverUniqueId,lastDriverPacketTime:rawDevice.lastDriverPacketTime}:rawAttributes;
 const healthy=vehicles.filter(vehicle=>!vehicle.issue).length;
 const setCompany=companyId=>{const next={...filters,companyId,userId:'',vehicleId:''};setFilters(next);load(next)};
 const setUser=userId=>{const next={...filters,userId,vehicleId:''};setFilters(next);load(next)};
 const setVehicle=vehicleId=>{const next={...filters,vehicleId};setFilters(next);load(next)};
 async function copyRaw(){try{await navigator.clipboard.writeText(JSON.stringify(rawPacket,null,2));setCopied(true);setTimeout(()=>setCopied(false),1600)}catch{setError('The raw packet could not be copied.')}}
 return <div className="page supportDiagnostics supportDiagnosticsSimple">
  <div className="titleRow"><div><h1>Diagnostics</h1><p>Search one vehicle, inspect its raw data, and find the exact fault.</p></div><div className="actions"><button onClick={()=>exportRows(issues)} disabled={!issues.length}><Download/>Export bugs</button><button className="green" onClick={()=>load()} disabled={loading}><RefreshCw className={loading?'spin':''}/>{loading?'Checking…':'Refresh'}</button></div></div>
  <section className="panel diagnosticSearchPanel"><div className="diagnosticSearchLine"><div className="search"><Search/><input value={filters.query} onChange={event=>setFilters({...filters,query:event.target.value})} onKeyDown={event=>event.key==='Enter'&&load()} placeholder="Search vehicle 101, company, user or IMEI…"/><button className="green" onClick={()=>load()}>Find vehicle</button></div><select value={filters.companyId} onChange={event=>setCompany(event.target.value)}><option value="">All companies</option>{data.companies.map(company=><option key={company.id} value={company.id}>C-{company.id} · {company.name}</option>)}</select><select value={filters.userId} onChange={event=>setUser(event.target.value)}><option value="">All users</option>{availableUsers.map(user=><option key={user.id} value={user.id}>U-{user.id} · {user.name}</option>)}</select><select value={filters.vehicleId} onChange={event=>setVehicle(event.target.value)}><option value="">First matching vehicle</option>{availableVehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>V-{vehicle.id} · {vehicle.name}</option>)}</select><select value={filters.hours} onChange={event=>setFilters({...filters,hours:event.target.value})}><option value="1">Last hour</option><option value="24">Last 24 hours</option><option value="168">Last 7 days</option><option value="720">Last 30 days</option></select></div>{selectedVehicle&&<div className="diagnosticIdentity"><span><b>Company</b>{idText('C',selectedVehicle.companyId)}</span><span><b>Vehicle</b>{idText('V',selectedVehicle.id)} · {selectedVehicle.name}</span><span><b>IMEI</b>{selectedVehicle.imei||'—'}</span><span><b>Protocol</b>{selectedVehicle.protocol||'—'}</span><span className={selectedVehicle.issue?'attention':'healthy'}><b>Status</b>{labelStatus(selectedVehicle.status)}</span></div>}</section>
  {error&&<div className="diagnosticError"><AlertTriangle/>{error}</div>}
  <div className="diagnosticTabs" role="tablist"><button className={tab==='raw'?'active':''} onClick={()=>setTab('raw')}><Clipboard/>Raw Data</button><button className={tab==='bugs'?'active':''} onClick={()=>setTab('bugs')}><ShieldAlert/>Bug Detector <b>{issues.length}</b></button></div>
  {tab==='raw'?<RawDataTab raw={raw} rawDevice={rawDevice} rawVehicle={rawVehicle} rawPacket={rawPacket} copied={copied} copyRaw={copyRaw} when={when}/>:<BugDetectorTab issues={issues} vehicles={vehicles} users={users} healthy={healthy} loading={loading} sampledAt={snapshot?.sampledAt} when={when}/>} 
 </div>;
}

function RawDataTab({raw,rawDevice,rawVehicle,rawPacket,copied,copyRaw,when}){
 const rows=[['Derived status',labelStatus(rawDevice.derivedStatus||rawVehicle.status)],['Connection',labelStatus(rawDevice.connectionStatus||rawVehicle.connectionStatus)],['Last update',when(rawDevice.lastUpdate||rawVehicle.lastUpdate)],['Speed',rawDevice.speedKph==null?'—':`${rawDevice.speedKph} km/h`],['Ignition',rawDevice.ignition==null?'Not available':rawDevice.ignition?'ON':'OFF'],['Motion',rawDevice.motion==null?'Not available':rawDevice.motion?'YES':'NO'],['Latitude',rawDevice.latitude??'—'],['Longitude',rawDevice.longitude??'—'],['Port',raw?.trackerPort?`${raw.trackerPort} · ${raw.transport||'TCP'}`:'—']];
 return <div className="rawDataLayout"><section className="panel"><div className="panelHead"><div><h2><Activity/>Raw tracker data</h2><p>Latest packet for the selected vehicle. Values stay scoped to this vehicle.</p></div><button onClick={copyRaw}><Clipboard/>{copied?'Copied':'Copy raw JSON'}</button></div><div className="rawDataRows">{rows.map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}</div><div className="rawJsonHead"><b>Raw attributes / JSON</b><small>{Object.keys(rawPacket||{}).length} field(s)</small></div><pre className="packetBox rawPacketLarge">{raw?JSON.stringify(rawPacket||{},null,2):'Select a vehicle to load its raw packet.'}</pre></section><section className="panel rawHelpPanel"><h2><Wifi/>Packet guide</h2><p>Use this panel to compare what the tracker sent with what the application stored.</p><div className="rawGuide"><div><CheckCircle2/><span><b>Packet received</b><small>Last update shows when the server received data.</small></span></div><div><CheckCircle2/><span><b>Protocol decoded</b><small>Protocol and port identify the receiver path.</small></span></div><div><AlertTriangle/><span><b>Missing values</b><small>Blank ignition, GPS, or driver values point to device or packet configuration.</small></span></div></div></section></div>;
}

function BugDetectorTab({issues,vehicles,users,healthy,loading,sampledAt,when}){
 return <div className="bugDetector"><div className="diagnosticSummary"><Summary icon={Car} label="Vehicles checked" value={vehicles.length}/><Summary icon={CheckCircle2} label="Healthy now" value={healthy} tone="good"/><Summary icon={ShieldAlert} label="Needs attention" value={issues.length} tone={issues.length?'warn':'good'}/><Summary icon={Users} label="Related users" value={users.length}/></div><section className="panel bugChecks"><div className="panelHead"><div><h2><ShieldAlert/>Bug detector</h2><p>Checks receiver, tracker status, API failures, and unregistered device attempts.</p></div><small>Checked {when(sampledAt)}{loading?' · refreshing…':''}</small></div><div className="bugCheckGrid"><Check label="Receiver and protocol" ok={!vehicles.some(vehicle=>vehicle.issue&&/communication|update/i.test(vehicle.issue))} detail="The selected tracker is sending packets through its configured protocol."/><Check label="Database and API" ok={!issues.some(issue=>issue.source==='API'&&issue.level==='error')} detail="Application errors are recorded with time, IDs, and source IP."/><Check label="Vehicle status" ok={!vehicles.some(vehicle=>vehicle.issue)} detail="A warning means the vehicle has no recent tracker communication."/></div></section><section className="panel"><div className="panelHead"><div><h2>Recent bugs and warnings</h2><p>Exact records for the selected search and time range.</p></div><b>{issues.length} result(s)</b></div><div className="tableScroll"><table className="diagnosticTable issueTable"><thead><tr><th>Exact time</th><th>Source</th><th>IDs</th><th>IMEI / Protocol</th><th>Source IP / Port</th><th>Problem</th></tr></thead><tbody>{issues.map(issue=><tr key={issue.key}><td>{when(issue.time)}</td><td><span className={`diagnosticLevel ${issue.level}`}>{issue.level}</span><small>{issue.source}</small></td><td><div className="diagnosticIds"><span className="diagnosticId">{idText('C',issue.companyId)}</span><span className="diagnosticId">{idText('U',issue.userId)}</span><span className="diagnosticId">{idText('V',issue.vehicleId)}</span></div></td><td><b>{issue.imei||'—'}</b><small>{issue.protocol||'—'}</small></td><td><b>{issue.sourceIp||'—'}</b><small>{issue.port?`Port ${issue.port}`:'—'}</small></td><td>{issue.message}</td></tr>)}</tbody></table></div>{!issues.length&&!loading&&<div className="diagnosticClear"><CheckCircle2/><b>No bugs found for this vehicle.</b><span>The detector checks again every 30 seconds.</span></div>}</section></div>;
}

function Check({label,ok,detail}){return <div className={`bugCheck ${ok?'ok':'bad'}`}><span>{ok?<CheckCircle2/>:<AlertTriangle/>}</span><div><b>{label}</b><small>{detail}</small></div><strong>{ok?'OK':'CHECK'}</strong></div>}
function Summary({icon:Icon,label,value,tone=''}){return <div className={`diagnosticSummaryCard ${tone}`}><Icon/><div><span>{label}</span><b>{value}</b></div></div>}
