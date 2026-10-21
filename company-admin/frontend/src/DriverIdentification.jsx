import React,{useEffect,useState} from 'react';
import {api,authToken} from './api';
export const currentDriverName=v=>v?.currentDriver?.name||v?.current_driver?.name||'Not identified';
export function DriverIdentifiers({value,onChange}){
 const rows=value.identifiers||((value.rfid&&value.rfid===value.ibutton)?[{type:'DRIVER_ID',identifier:value.rfid}]:[{type:'RFID',identifier:value.rfid||''},{type:'IBUTTON',identifier:value.ibutton||''}]);
 const change=(i,key,text)=>onChange(rows.map((r,j)=>j===i?{...r,[key]:text}:r));
 return <div className="wide driverIdentifiers"><strong>Driver identifiers</strong><p>Register the decoded RFID or iButton value exactly, including leading zeros. Hex bytes may be entered as <code>7A0000045ABCDE</code>, <code>0x7A…</code>, or colon-separated bytes. Planned vehicle assignment is optional.</p>{rows.map((r,i)=><div key={i} className="driverIdentifierRow"><select aria-label={'Identifier type '+(i+1)} value={r.type} onChange={e=>change(i,'type',e.target.value)}><option value="RFID">RFID</option><option value="IBUTTON">iButton</option><option value="DRIVER_ID">Driver Identifier</option></select><input aria-label={'Identifier '+(i+1)} value={r.identifier} onChange={e=>change(i,'identifier',e.target.value)} placeholder="Decoded identifier or byte value"/><button type="button" onClick={()=>onChange(rows.filter((_,j)=>i!==j))}>Remove</button></div>)}<button type="button" onClick={()=>onChange([...rows,{type:'RFID',identifier:''}])}>Add identifier</button></div>;
}
export function CurrentDriver({vehicle}){
 const d=vehicle?.currentDriver||vehicle?.current_driver;
 return <span><b>{currentDriverName(vehicle)}</b>{d?.identifier&&<><br/><small>{d.type==='IBUTTON'?'iButton':d.type==='RFID'?'RFID':'Driver Identifier'} · {d.identifier}</small><br/><small>Identified: {new Date(d.identified_at).toLocaleString()}</small></>}</span>;
}
export function DriverIdentificationSettings({vehicles,toast}){
 const [id,setId]=useState(''),[d,setD]=useState({}),[busy,setBusy]=useState(false);
 const vehicle=vehicles.find(v=>String(v.id)===id);
 useEffect(()=>setD(vehicle?.local?.driverIdentification||{}),[id,vehicle?.local?.driverIdentification]);
 async function save(){setBusy(true);try{await api.saveDriverIdentification(id,d);toast('Driver identification mapping saved');window.dispatchEvent(new Event('inviha-refresh'));}catch(e){toast(e.message);}finally{setBusy(false);}}
 return <div className="card"><h2>Driver Identification</h2><p>Match decoded tracker identifiers to this company's driver master and retain identification history.</p><div className="filters"><label>Vehicle<select value={id} onChange={e=>setId(e.target.value)}><option value="">Select vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label></div>{vehicle&&<><p>Device profile: {vehicle.local?.model||'Not specified'} · {vehicle.local?.protocol||'Not specified'}</p><div className="formGrid"><label>Decoded source<select value={d.sourceKey||''} onChange={e=>setD({...d,sourceKey:e.target.value})}><option value="">Automatic decoded driver identifier</option>{['driverUniqueId','driverIdentifier','rfid','ibutton','iButton'].map(k=><option key={k}>{k}</option>)}</select></label><label>Reader type<select value={d.type||'DRIVER_ID'} onChange={e=>setD({...d,type:e.target.value})}><option value="DRIVER_ID">Driver Identifier / registered type</option><option value="RFID">RFID</option><option value="IBUTTON">iButton</option></select></label><label><input type="checkbox" checked={d.enabled!==false} onChange={e=>setD({...d,enabled:e.target.checked})}/>Match driver master and store history</label><label><input type="checkbox" checked={d.unknownAlert===true} onChange={e=>setD({...d,unknownAlert:e.target.checked})}/>Unknown Driver alert</label></div><p>Normalized field: driver_identifier</p><p>Current Driver: <CurrentDriver vehicle={vehicle}/></p><button type="button" disabled={busy} onClick={save}>{busy?'Saving…':'Save driver identification'}</button></>}</div>;
}
export function useDriverUpdates(enabled){
 useEffect(()=>{
  if(!enabled)return;const controller=new AbortController();let retry;
  async function connect(){try{
   const r=await fetch('/inviha-api/api/driver-identification/stream',{headers:{Authorization:'Bearer '+authToken()},signal:controller.signal});
   if(!r.ok)throw Error('Stream unavailable');
   const reader=r.body.getReader(),decoder=new TextDecoder();let pending='';
   while(!controller.signal.aborted){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let end;
    while((end=pending.indexOf('\n\n'))>=0){const message=pending.slice(0,end);pending=pending.slice(end+2);if(message.includes('data: changed'))window.dispatchEvent(new Event('inviha-refresh'));}
   }
  }catch{}finally{if(!controller.signal.aborted)retry=setTimeout(connect,5000);}}
  connect();return()=>{controller.abort();clearTimeout(retry);};
 },[enabled]);
}
