import React,{useEffect,useRef,useState} from 'react';

const paths = {
  seatbelt: <><circle cx="12" cy="4" r="2.5"/><path d="M7 10c-2 2-2 6-2 9m12-9c2 2 2 6 2 9M6 21l1-5h10l1 5M5 16 18 7M5 17h14"/></>,
  ignition: <><circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-3-3 2-2m-5-1 2-2M6 7l2-2"/></>,
  engine: <><path d="M7 8h9l3 4h3v7h-4l-2 2H7l-3-4V9h3ZM8 4h7m-3 0v4M1 11v6m0-3h3"/></>,
  network: <><path d="M3 18h3v4H3zm5-5h3v9H8zm5-5h3v14h-3zm5-6h3v20h-3z"/></>,
  battery: <><rect x="2" y="6" width="20" height="15" rx="2"/><path d="M6 6V3h3v3m6 0V3h3v3M5 13h4m6 0h4m-2-2v4"/></>,
  fuel: <><path d="M3 22V3h11v19M1 22h15M5 6h7v6H5zm9 7h2c3 0 0 7 3 7 2 0 2-2 2-3V8l-4-4m2 2v5h2"/></>,
  gps: <><path d="m10 7 7 7-4 4-7-7zm3-4 3-3 7 7-3 3zM1 15l3-3 7 7-3 3zm13-4 2-2M7 17l-2 2M2 7a4 4 0 0 1 4-4M1 11A10 10 0 0 1 11 1"/></>,
  power: <><path d="M8 2v6m8-6v6M6 8h12v5a6 6 0 0 1-12 0zm6 11v3"/></>,
  door: <><path d="M5 22V8l6-6h8v20ZM8 9l4-4h4v6H8zm6 6h3"/></>,
  temperature: <><path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Zm3-7v11"/><circle cx="12" cy="18" r="1.5"/></>
};
const read=(a,...keys)=>keys.map(k=>a[k]).find(v=>v!==null&&v!==undefined&&v!=='');
const on=v=>v===true||v===1||['true','on','yes','active','fastened','worn','connected','open'].includes(String(v).toLowerCase());
const display=v=>v==null?'Not available':v===true?'On':v===false?'Off':String(v);
const measurement=(a,keys,unit)=>{for(const k of keys){const v=read(a,k);if(v!=null)return `${v}${unit[k]||''}`}return 'Not available'};
export default function LiveSensorIcons({position,ignition,engine}){
 const[changed,setChanged]=useState([]),previous=useRef(null);
 const a=position?.attributes||{},belt=read(a,'seatBelt','seatbelt','seat_belt','seatbeltOn'),network=read(a,'rssi','gsm','signal'),battery=read(a,'batteryLevel','battery'),fuel=read(a,'fuelLevel','fuel'),gps=read(a,'sat','satellites'),power=read(a,'power','externalPower'),door=read(a,'door','doorOpen'),temp=read(a,'temperature','deviceTemp','temp1');
 const positive=v=>v!=null&&Number.isFinite(Number(v))&&Number(v)>0;
 const networkRaw=network==null?'':String(network).trim();
 const networkText=/^[3-7]$/.test(networkRaw)?`${networkRaw}G`:display(network);
 const rows=[
 ['seatbelt','Seat belt',belt==null?'Not available':on(belt)?'Fastened':'Not fastened',on(belt)],
 ['ignition','Ignition',display(ignition),on(ignition)],['engine','Engine',display(engine),on(engine)],
 ['network','Network',networkText,positive(network)],
 ['battery','Battery',measurement(a,['batteryLevel','battery'],{batteryLevel:'%',battery:' V'}),positive(battery)],
 ['fuel','Fuel',measurement(a,['fuelLevel','fuel'],{fuelLevel:'%'}),positive(fuel)],
 ['gps','GPS',gps!=null?`${gps} satellites`:position?.valid===true?'Fixed':position?.valid===false?'No fix':'Not available',position?.valid!==false&&(positive(gps)||position?.valid===true)],
 ['power','Power',typeof power==='boolean'?display(power):power==null?'Not available':`${power} V`,on(power)||positive(power)],
 ['door','Door',door==null?'Not available':on(door)?'Open':'Closed',on(door)],
 ['temperature','Temp',temp==null?'Not available':`${temp} °C`,temp!=null]
 ];
 const snapshot=Object.fromEntries(rows.map(([id,,value,active])=>[id,`${value}|${active?'1':'0'}`])),signature=JSON.stringify(snapshot);
 useEffect(()=>{
  const before=previous.current;
  previous.current=snapshot;
  if(!before)return;
  const next=Object.keys(snapshot).filter(id=>before[id]!==snapshot[id]);
  if(!next.length)return;
  setChanged(next);
  const timer=setTimeout(()=>setChanged([]),900);
  return()=>clearTimeout(timer)
 },[signature]);
 return <div className="liveVehiclePanelIndicators expandedSensorIcons" aria-label="Vehicle sensors">{rows.map(([id,label,value,active])=><button type="button" key={id} className={`liveSensorItem ${active?'is-on ':''}${changed.includes(id)?'has-update':''}`} title={`${label}: ${value}`} aria-label={`${label}: ${value}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[id]}</svg><span>{label}</span><span className="liveSensorTooltip" role="tooltip">{label}: {value}</span></button>)}</div>
}
