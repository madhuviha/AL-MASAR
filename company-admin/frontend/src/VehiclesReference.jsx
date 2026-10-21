import {SensorsIoPanel} from './DeviceProfiles.jsx';
import {profileRequest} from './api.js';
import {CurrentDriver} from './DriverIdentification.jsx';
import ImmobilizerControl from './ImmobilizerControl.jsx';
import AssignedSensors from './AssignedSensors.jsx';
import {EngineIndicator,StopDuration} from './EngineIndicator';
import Address from './Address.jsx';
import Basemap from './Basemap.jsx';
import VehicleImageEditor from './VehicleImageEditor';
import React,{useState,useEffect,useRef} from 'react';
import {Car,Search,Plus,Download,RefreshCw,MoreVertical,X,Navigation,MapPin,History,Route,ClipboardList,Wrench,UserRound,Phone,Radio,CalendarDays,Clock3,Gauge,Fuel,Power,Building2,Users,Copy,Edit3,Map as MapIcon,CheckCircle2} from 'lucide-react';
import {MapContainer,TileLayer,Marker} from 'react-leaflet';
import {latestCommunicationTime,mapStatus} from './map-status.mjs';
import {requestExport} from './ExportDialog.jsx';
import {dedupeAlerts} from './alert-notifications.mjs';
import './vehicles-reference.css';
const known=x=>x!==null&&x!==undefined&&x!=='';
const display=x=>known(x)?String(x):'Not available';
const protocol=v=>v.position?.protocol||v.local?.protocol||v.device?.protocol;
const imei=v=>v.imei||v.local?.imei||v.device?.uniqueId;
const date=x=>x&&Number.isFinite(Date.parse(x))?new Date(x).toLocaleString():'Not available';
const statusName=s=>({expired:'Expired',never:'Not Tracked Yet',untracked:'Currently Untracked',offline:'Offline',moving:'Moving',idle:'Idle',parked:'Parked'}[s]);
const accessBlocked=v=>v?.expired===true||v?.liveAccess===false||v?.local?.expired===true;
const renewalMessage=v=>v?.accessMessage||v?.local?.accessMessage||'Vehicle subscription expired. Please renew to continue live tracking.';
function Engine({on}){return <svg viewBox="0 0 24 20" className={on===true?'engineOn':''} aria-label={on===true?'Engine ON':on===false?'Engine OFF':'Engine unavailable'}><path fill="currentColor" stroke="none" d="M6 1h9v2h-3v2h4l3 3h3v9h-3l-2 2H6l-3-4H1V8h3V5h5V3H6zm0 6v8l2 2h8l2-2h2v-5h-2l-3-3z"/></svg>}
export function VehicleReferenceDialog({v,company,store,onClose,onNavigate,onEdit,Image,toast,canEditImage,showMapActions=true}){
 const dialog=useRef(null),[tab,setTab]=useState('Overview'),[imageEdit,setImageEdit]=useState(false);
 useEffect(()=>{dialog.current.showModal();return ()=>dialog.current?.close()},[]);
 const p=v.position||{},a=p.attributes||{},local=v.local||{},s=mapStatus(v,company.settings),state=statusName(s.group);
 const coords=Number.isFinite(p.latitude)&&Number.isFinite(p.longitude);
 const updated=latestCommunicationTime(v);
 const driver=v.driverName||'Not identified';
 const engine=s.engine;
 const fuel=a.fuelLevel,odo=a.totalDistance??a.odometer,externalVoltage=a.power??a.externalPowerVoltage??a.externalVoltage??a.externalPower;
 const row=(Icon,label,value,cls='')=><div className={'vrField '+cls} key={label}><Icon/><span>{label}</span><b>{value}</b></div>;
 const events=dedupeAlerts((store.alerts||[]).filter(e=>String(e.companyId)===String(company.id)&&((e.deviceId!=null&&String(e.deviceId)===String(v.deviceId||v.id))||(e.vehicleId!=null&&String(e.vehicleId)===String(local.id||v.id)))));
 const jobs=(store.maintenance||[]).filter(e=>String(e.companyId)===String(company.id)&&e.vehicleId!=null&&String(e.vehicleId)===String(local.id||v.id));
 return <dialog className="vrDialog" ref={dialog} onCancel={e=>{e.preventDefault();onClose()}} aria-labelledby="vrTitle">
 <header><h2 id="vrTitle">Vehicle Details</h2><button aria-label="Close vehicle details" onClick={onClose}><X/></button></header>
 <div className="vrHero"><div className="vrPhoto"><Image v={v}/>{canEditImage&&<button className="changeVehiclePhoto" onClick={()=>setImageEdit(x=>!x)}>Change image</button>}</div><div className="vrIdentity"><h3>{v.name}<span className={'vrBadge '+s.group}>{state}</span></h3><b>{display(v.plate||local.plate)}</b><p>{display(v.category||local.category)} <i>•</i> {display(protocol(v))} <i>•</i> {company.name}</p></div></div>
 {imageEdit&&<VehicleImageEditor vehicleId={local.id||v.id} initial={local.imageUrl||v.imageUrl||''} onDone={()=>setImageEdit(false)} toast={toast}/>}<ImmobilizerControl vehicle={v} company={company} toast={toast}/><nav className="vrTabs">{[[Car,'Overview'],[Radio,'Sensor List'],[Radio,'Sensors & I/O'],[MapPin,'Location'],[History,'History'],[Route,'Trips'],[ClipboardList,'Events'],[Wrench,'Maintenance']].map(([Icon,t])=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}><Icon/>{t}</button>)}</nav>
 <div className="vrBody">
 {tab==='Overview'&&<div className="vrColumns"><div><h3 className="vrSectionTitle"><Car/>Vehicle Information</h3>
 {row(Car,'Vehicle Name',display(v.name))}{row(ClipboardList,'Plate Number',display(v.plate||local.plate))}{row(Radio,'IMEI',display(imei(v)))}{row(Radio,'Device Model',display(local.deviceModel||local.device_model||v.device?.model))}{row(Radio,'Protocol',display(protocol(v)))}{row(Building2,'Company',display(company.name))}{row(UserRound,'Current Driver',<CurrentDriver vehicle={v}/>)}{row(Users,'Group',display(v.group||local.group))}{row(Phone,'SIM Number',display(local.simNumber||local.sim||v.device?.phone))}
 </div><div><h3 className="vrSectionTitle"><Gauge/>Live Status</h3>
 {row(CheckCircle2,'Status',<span className={'vrState '+s.group}>● &nbsp;{state}</span>)}{row(Gauge,'Speed',s.speed==null?'Not available':Math.round(s.speed)+' kph')}{row(()=> <Engine on={engine}/>,'Engine',engine===true?'ON':engine===false?'OFF':'Not available',engine===true?'engineOn':'')}{row(Power,'Ignition',s.ignition===true?'ON':s.ignition===false?'OFF':'Not available',s.ignition===true?'engineOn':'')}
 
 {row(Radio,'External Voltage',known(externalVoltage)&&Number.isFinite(Number(externalVoltage))?Number(externalVoltage).toFixed(2)+' V':'Not reported by tracker')}{row(Gauge,'Odometer',known(odo)&&Number.isFinite(Number(odo))?(Number(odo)/1000).toLocaleString(undefined,{maximumFractionDigits:1})+' km':'Not available')}{row(Clock3,'Last Update',date(updated))}{row(CalendarDays,'Expiry Date',local.expiryDate?date(local.expiryDate):local.unlimited===true?'Unlimited':'Not available')}
  {row(MapPin,'Address',<Address position={p}/>)}
 </div></div>}
 {tab==='Sensor List'&&<AssignedSensors vehicle={v} store={store}/>}
 {tab==='Sensors & I/O'&&<SensorsIoPanel vehicleId={v.id} request={profileRequest} onSaved={()=>{toast('I/O mappings saved');window.dispatchEvent(new Event('inviha-refresh'))}}/>}
 {tab==='Location'&&(coords?<><MapContainer zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} key={v.id} center={[p.latitude,p.longitude]} zoom={15} style={{height:280}}><Basemap/><Marker position={[p.latitude,p.longitude]}/></MapContainer><p><Address position={p}/> · {s.gps}</p></>:<p>No recorded position for this vehicle.</p>)}
 {tab==='History'&&<div className="vrTabAction"><History/><h3>Route Playback</h3><p>Choose a date range to replay this vehicle’s recorded GPS history.</p><button onClick={()=>onNavigate('playback')}>Open Playback</button></div>}
 {tab==='Trips'&&<div className="vrTabAction"><Route/><h3>Vehicle Trips</h3><p>View recorded trips and export a trip report.</p><button onClick={()=>onNavigate('reports')}>Open Reports</button></div>}
 {tab==='Events'&&<div className="vrEventList">{events.length?events.slice().reverse().map((e,i)=><p key={e.id||i}><b>{e.type||e.title}</b><span>{date(e.createdAt||e.time)}</span></p>):<p>No recorded events for this vehicle.</p>}</div>}
 {tab==='Maintenance'&&<div className="vrEventList">{jobs.length?jobs.map((j,i)=><p key={j.id||i}><b>{j.name||j.type||j.title}</b><span>{j.status} · {date(j.dueDate)}</span></p>):<p>No maintenance records for this vehicle.</p>}<button onClick={()=>onNavigate('maintenance')}>Manage Maintenance</button></div>}
 </div><footer>{showMapActions&&<><button className="vrPrimary" disabled={!coords} onClick={()=>onNavigate('map')}><Navigation/>Live Track</button><button className="vrBlue" disabled={!coords} onClick={()=>onNavigate('map')}><MapIcon/>View on Map</button><button disabled={!coords} onClick={()=>window.open('https://www.mapillary.com/app/?lat='+p.latitude+'&lng='+p.longitude+'&z=17','_blank','noopener,noreferrer')}><UserRound/>Street imagery</button></>}<span/>{onEdit&&<button onClick={onEdit}><Edit3/>Edit</button>}<button onClick={onClose}><X/>Close</button></footer>
 </dialog>
}
export default function VehiclesReference({company,vehicles,selected,setSelected,store,setStore,setPage,toast,allDevices,Image,Form,Modal,userRole}){
 const [q,setQ]=useState(''),[filter,setFilter]=useState('all'),[proto,setProto]=useState('all'),[edit,setEdit]=useState(null),[menu,setMenu]=useState(null),[page,setPageNumber]=useState(1);
 const perms=company.vehiclePermissions||{},rows=vehicles.filter(v=>(filter==='all'||mapStatus(v,company.settings).group===filter)&&(proto==='all'||protocol(v)===proto)&&[v.name,v.plate,imei(v)].join(' ').toLowerCase().includes(q.toLowerCase()));
 useEffect(()=>{try{const action=JSON.parse(localStorage.getItem('inviha.vehicleAction')||'null');if(!action)return;localStorage.removeItem('inviha.vehicleAction');const vehicle=vehicles.find(v=>String(v.id)===String(action.vehicleId));if(vehicle){setSelected(vehicle);if(action.action==='edit'&&perms.editVehicle)setEdit(vehicle.local)}}catch{localStorage.removeItem('inviha.vehicleAction')}},[]);
 const pages=Math.max(1,Math.ceil(rows.length/15)),current=Math.min(page,pages),shown=rows.slice((current-1)*15,current*15);
 const open=(v,action)=>{if(accessBlocked(v)){toast(renewalMessage(v));return}action()};
 const go=(v,dest)=>open(v,()=>{setSelected(v);setPage(dest)});
 const exportRows=()=>requestExport('vehicles',rows.map(v=>({vehicleName:v.name,plateNumber:v.plate,imei:imei(v),protocol:protocol(v),status:statusName(mapStatus(v,company.settings).group),speedKph:mapStatus(v,company.settings).speed,lastUpdate:latestCommunicationTime(v),expiryDate:v.local?.expiryDate||''})),{formats:['csv','xlsx','json']});
 return <section className="page vrPage"><div className="vrPageHead"><div><h1>Vehicles / Objects</h1><p>Manage your tracker inventory and vehicle information.</p></div><div><button onClick={exportRows}><Download/>Export</button>{perms.addVehicle&&<button className="vrPrimary" onClick={()=>setEdit({})}><Plus/>Add Vehicle</button>}</div></div>
 <div className="vrTableCard"><div className="vrFilters"><label><Search/><input placeholder="Search vehicles by name, plate or IMEI..." value={q} onChange={e=>{setQ(e.target.value);setPageNumber(1)}}/></label><select aria-label="Vehicle status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All Statuses</option>{['expired','moving','idle','parked','untracked','offline','never'].map(s=><option key={s} value={s}>{statusName(s)}</option>)}</select><select aria-label="Company"><option>{company.name||'Company'}</option></select><select aria-label="Protocol" value={proto} onChange={e=>setProto(e.target.value)}><option value="all">All Protocols</option>{[...new Set(vehicles.map(protocol).filter(Boolean))].map(p=><option key={p}>{p}</option>)}</select><button onClick={()=>{setQ('');setFilter('all');setProto('all');setPageNumber(1)}}><RefreshCw/>Reset</button></div>
 <div className="vrTableScroll"><table><thead><tr>{['Active','Vehicle Name','Plate Number','IMEI','Protocol','Company','Status','Speed','Last Update','Expiry Date','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{shown.map(v=>{const s=mapStatus(v,company.settings),blocked=accessBlocked(v);return <tr key={v.id} className={selected?.id===v.id?'selected':''}><td><span className={'vrBadge '+(blocked?'expired':v.local?.status==='Inactive'?'offline':'moving')}>{blocked?'Expired':v.local?.status||'Active'}</span></td><td><button className="vrName" onClick={()=>open(v,()=>setSelected(v))}>{v.name}</button></td><td>{display(v.plate)}</td><td>{display(imei(v))}</td><td>{display(protocol(v))}</td><td>{company.name}</td><td><span className={'vrBadge '+s.group}>{statusName(s.group)}</span></td><td>{s.speed==null?'—':Math.round(s.speed)+' kph'}</td><td>{blocked?<span className="vrRenew">Please renew</span>:date(latestCommunicationTime(v))}</td><td>{v.local?.expiryDate?date(v.local.expiryDate):v.local?.unlimited===true?'Unlimited':'Not available'}{blocked&&<small className="vrRenew">Please renew</small>}</td><td className="vrMenuCell"><button aria-label={'Actions for '+v.name} onClick={()=>setMenu(menu===v.id?null:v.id)}><MoreVertical/></button>{menu===v.id&&<div className="vrMenu"><button onClick={()=>{setMenu(null);open(v,()=>setSelected(v))}}>View Details</button>{perms.editVehicle&&<button onClick={()=>{setEdit(v.local);setMenu(null)}}>Edit</button>}<button onClick={()=>go(v,'map')}>Follow</button><button onClick={()=>go(v,'playback')}>Playback</button></div>}</td></tr>})}</tbody></table>{!rows.length&&<p className="vrEmpty">No matching vehicles.</p>}</div>
 <div className="vrTableFooter"><span>Showing {rows.length?(current-1)*15+1:0} to {Math.min(current*15,rows.length)} of {rows.length} vehicles</span><div><button disabled={current===1} onClick={()=>setPageNumber(current-1)}>‹</button><button className="vrPrimary">{current}</button><button disabled={current===pages} onClick={()=>setPageNumber(current+1)}>›</button></div></div></div>
 {selected&&edit===null&&<VehicleReferenceDialog key={selected.id} v={vehicles.find(v=>v.id===selected.id)||selected} company={company} store={store} Image={Image} toast={toast} canEditImage={['company_admin','super_admin'].includes(userRole)} onClose={()=>setSelected(null)} onNavigate={dest=>go(selected,dest)} onEdit={perms.editVehicle?()=>setEdit(selected.local):null}/>}
 {edit!==null&&<Modal title={edit.id?'Edit Vehicle':'Add Vehicle'} onClose={()=>setEdit(null)} wide><Form initial={edit} company={company} store={store} setStore={setStore} allDevices={allDevices} toast={toast} onClose={()=>setEdit(null)}/></Modal>}
 </section>
}
