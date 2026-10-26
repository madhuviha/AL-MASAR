import React from 'react';
import {Edit3,SlidersHorizontal,Trash2} from 'lucide-react';
import {sensorReading,sensorPresets} from './sensor-model.mjs';
import {gt06AutomaticParameters} from '../../../backend/protocol-telemetry.mjs';

const units={speed:'km/h',course:'°',altitude:'m',accuracy:'m',power:'V',battery:'V',batteryLevel:'%',rssi:'',totalDistance:'km',odometer:'km',hours:'h',rpm:'rpm',obdSpeed:'km/h',fuel:'%',fuelUsed:'L',temperature:'°C',humidity:'%',hdop:''};
const core=gt06AutomaticParameters.map(([name,sourceKey])=>({name,sourceKey,unit:units[sourceKey]||'',type:'Core telemetry',...(sourceKey==='totalDistance'||sourceKey==='odometer'?{aliases:sourceKey==='totalDistance'?['odometer']:['totalDistance'],scale:.001}:{}),...(sourceKey==='hours'?{scale:1/3600000}:{})}));
const humanize=key=>String(key).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,x=>x.toUpperCase());
function automaticSensors(){return core}
const additional={'Seat Belt':{type:'Digital Input',sourceKey:'seatBelt',aliases:['seatbelt']},'Seat Belt Sensor':{type:'Digital Input',sourceKey:'seatBelt',aliases:['seatbelt']},'RFID/iButton':{type:'RFID / iButton',sourceKey:'driverUniqueId',aliases:['rfid','ibutton']}};
export function assignedSensors(v,store={}){const automatic=automaticSensors(v),base=v.local?.sensors||v.sensors||[],configured=(store?.sensorConfigs||[]).filter(c=>String(c.vehicleId)===String(v.id)&&c.enabled!==false).map(c=>c.name),names=[...new Set([...base,...configured])];return [...automatic,...names.filter(item=>!automatic.some(c=>c.name===(typeof item==='string'?item:item.name))).map(item=>{const name=typeof item==='string'?item:item.name;const config=(store?.sensorConfigs||[]).find(c=>String(c.vehicleId)===String(v.id)&&c.name===name&&c.enabled!==false);return {name,...sensorPresets[name],...additional[name],...(typeof item==='object'?item:{}),...config}})]}
const mappedValue=m=>m.value==null?'Not reported':m.function==='seat_belt'?(m.value?'WORN':'NOT WORN'):typeof m.value==='boolean'?(m.value?'ON':'OFF'):String(m.value)+(m.unit?' '+m.unit:'');
const rawValue=(key,value)=>value==null?'Not reported':typeof value==='boolean'?(value?'ON':'OFF'):typeof value==='object'?JSON.stringify(value):String(value)+(units[key]?' '+units[key]:'');

export default function AssignedSensors({vehicle,store,management=false,onEdit,onDelete,onMap}){
 const automatic=automaticSensors(vehicle),sensors=assignedSensors(vehicle,store),allMapped=vehicle.position?.mapped_io||vehicle.mapped_io||[],configured=(store?.sensorConfigs||[]).filter(s=>String(s.vehicleId)===String(vehicle.id)&&s.enabled!==false&&!/engine\s*\(\s*voltage\s*\)/i.test(s.name||''));
 // A configured sensor already represents the same signal as its physical I/O
 // mapping. Keep the configured row (with the decoded value) and hide the
 // duplicate mapping row from this list.
 const normalized=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const configuredSignals=new Set(configured.flatMap(s=>[s.sourceKey,s.parameterName,s.name]).map(normalized).filter(Boolean));
 const isSameSignal=(a,b)=>a===b||(a.length>=5&&b.length>=5&&(a.includes(b)||b.includes(a)));
 const mapped=allMapped.filter(m=>{
   const signal=[m.function,m.name,m.sourceKey].map(normalized).filter(Boolean);
   const aliases=signal.flatMap(x=>x==='seatbelt'?['seatbelt','seatbeltsensor']:x==='driverid'||x==='driveridentifier'?['driverid','driveridentifier','driveruniqueid','rfidibutton']:[]);
   return !signal.concat(aliases).some(x=>[...configuredSignals].some(y=>isSameSignal(x,y)));
 });
 const known=new Set(sensors.flatMap(sensor=>[sensor.sourceKey,...(sensor.aliases||[])]).filter(Boolean));
 const raw=Object.entries(vehicle.position?.attributes||{}).filter(([key,value])=>!known.has(key)&&value!==undefined&&value!==null&&['string','number','boolean'].includes(typeof value));
 const reading=s=>s.sourceKey?sensorReading({...vehicle.position,current_driver:vehicle.currentDriver||vehicle.current_driver},s):'Not available';
 if(management)return <section className="sensorManagerList"><header><div><h2>Sensor List</h2><p>Automatic readings, added sensors and physical I/O mappings for {vehicle.name}.</p></div><span>{automatic.length+configured.length+mapped.length}</span></header><details className="sensorAutoGroup"><summary><span>Automatic vehicle readings</span><small>{automatic.length} readings</small><b/></summary><div>{automatic.map(s=><div className="sensorManageRow" key={'core-'+s.sourceKey}><div><b>{s.name}</b><small>Automatic · {s.sourceKey}</small></div><strong>{reading(s)}</strong><em>Automatic</em></div>)}</div></details><h3>Added sensors</h3>{configured.length?configured.map(s=><div className="sensorManageRow" key={'configured-'+s.id}><div><b>{s.name}</b><small>{s.type||'Sensor'} · {s.sourceKey||s.parameterName||'No parameter'}</small></div><strong>{reading(s)}</strong><div className="sensorManageActions"><button type="button" onClick={()=>onEdit?.(s)}><Edit3/>Edit</button><button type="button" className="danger" onClick={()=>onDelete?.(s)}><Trash2/>Delete</button></div></div>):<p className="sensorEmpty">No added sensors for this vehicle. Use Add Sensor to create one.</p>}<h3>Physical I/O mappings</h3>{mapped.length?mapped.map(m=><div className="sensorManageRow" key={'mapped-'+m.channel}><div><b>{m.name}</b><small>{m.channel} · {m.function||'Mapped input'}</small></div><strong>{mappedValue(m)}</strong><button type="button" className="ioMapAction" onClick={onMap}><SlidersHorizontal/>Edit mapping</button></div>):<p className="sensorEmpty">No physical I/O channels are mapped for this vehicle.</p>}<button type="button" className="manageIoButton" onClick={onMap}><SlidersHorizontal/>Manage I/O mappings</button></section>;
 return <details className="assignedSensorList" open><summary>Sensor List <span>{sensors.length+mapped.length+raw.length}</span></summary><div className="assignedSensorListBody">{sensors.map((s,i)=><div className="popupSensor" key={s.name+i}><span>{s.name}</span><b>{reading(s)}</b></div>)}{mapped.map(m=><div className="popupSensor" key={m.channel}><span>{m.name}</span><b>{mappedValue(m)}</b></div>)}{raw.map(([key,value])=><div className="popupSensor" key={'raw-'+key}><span>{humanize(key)}</span><b title={rawValue(key,value)}>{rawValue(key,value)}</b></div>)}</div></details>;
}
