import {isGt06Family,normalizeProtocolPosition} from './protocol-telemetry.mjs';

export const GT06_IGNITION_CARRY_MS=5*60*1000;

const first=(source,keys)=>{
 for(const key of keys)if(source?.[key]!==undefined&&source[key]!==null&&source[key]!=='')return source[key];
 return undefined;
};

export function canonicalReportType(type){
 const value=String(type||'').trim();
 if(value==='General Report')return 'Summary Report';
 if(['Geofence Alert Report','Geofence Alerts Report'].includes(value))return 'Geofence Report';
 if(value==='Door Report')return 'Doors Report';
 return value;
}

export function reportBoolean(value){
 if([true,1,'1','true','TRUE','on','ON','open','OPEN'].includes(value))return true;
 if([false,0,'0','false','FALSE','off','OFF','closed','CLOSED'].includes(value))return false;
 return null;
}

export function reportTimestamp(row={}){
 for(const value of [row.fixTime,row.deviceTime,row.eventTime,row.serverTime,row.createdAt,row.time]){
  const parsed=typeof value==='number'&&Number.isFinite(value)?value:Date.parse(value);
  if(Number.isFinite(parsed))return parsed;
 }
 return NaN;
}

export function normalizeReportPoint(point={}){
 const attributes={...(point.attributes||{})};
 const ignition=reportBoolean(first(attributes,['ignition','ignitionOn','acc','accOn']));
 const door=reportBoolean(first(attributes,['door','doorOpen','doors','doorStatus']));
 if(ignition!==null)attributes.ignition=ignition;
 if(door!==null)attributes.door=door;
 return {...point,attributes};
}

const validGpsPoint=point=>point?.valid!==false&&Number.isFinite(Number(point?.latitude))&&Number.isFinite(Number(point?.longitude))&&Math.abs(Number(point.latitude))<=90&&Math.abs(Number(point.longitude))<=180;
const fixKey=(point,index)=>{
 const raw=point?.fixTime??point?.fixtime;
 const parsed=Date.parse(raw);
 return Number.isFinite(parsed)?`${point?.deviceId??point?.deviceid??''}:${parsed}`:`row:${index}`;
};
const receivedAt=point=>{
 for(const raw of [point?.serverTime,point?.servertime,point?.deviceTime,point?.devicetime]){
  const parsed=Date.parse(raw);if(Number.isFinite(parsed))return parsed;
 }
 return reportTimestamp(point);
};
const mergeSameFix=(current,incoming)=>{
 const currentValid=validGpsPoint(current),incomingValid=validGpsPoint(incoming);
 const base=!currentValid&&incomingValid?incoming:current;
 const latest=receivedAt(incoming)>=receivedAt(current)?incoming:current;
 const attributes={...(current.attributes||{}),...(incoming.attributes||{})};
 return {...base,serverTime:latest.serverTime??latest.servertime??base.serverTime??base.servertime,attributes};
};

export function normalizeReportPoints(rows,options={}){
 const protocol=typeof options==='string'?options:options?.protocol||'';
 const normalized=(Array.isArray(rows)?rows:[]).map(row=>normalizeReportPoint(normalizeProtocolPosition(row,protocol||row?.protocol||'')));
 if(!normalized.some(row=>isGt06Family(protocol,row?.protocol)))return normalized;
 const merged=[],indexes=new Map();
 normalized.forEach((row,index)=>{
  if(!isGt06Family(protocol,row?.protocol)){merged.push(row);return}
  const key=fixKey(row,index),existing=indexes.get(key);
  if(existing===undefined){indexes.set(key,merged.length);merged.push(row);return}
  merged[existing]=mergeSameFix(merged[existing],row);
 });
 return merged.sort((a,b)=>reportTimestamp(a)-reportTimestamp(b)||receivedAt(a)-receivedAt(b));
}

export function stationaryIntervals(points,{kind='Idle',minimumSeconds=0,gapMs=300000,ignitionCarryMs=0}={}){
 const rows=[];let active=null,lastIgnition=null,lastIgnitionTime=null;
 const carryMs=Math.max(0,Number(ignitionCarryMs)||0);
 const close=endIndex=>{
  if(!active||endIndex<active.startIndex)return;
  const endTime=reportTimestamp(points[endIndex]),durationSeconds=(endTime-active.startTime)/1000;
  if(Number.isFinite(durationSeconds)&&durationSeconds>Number(minimumSeconds))rows.push({...active,endIndex,endTime,durationSeconds,startPoint:points[active.startIndex],endPoint:points[endIndex]});
  active=null;
 };
 for(let index=0;index<points.length;index++){
  const point=points[index],time=reportTimestamp(point),previousTime=index?reportTimestamp(points[index-1]):NaN;
  if(!Number.isFinite(time))continue;
  if(Number.isFinite(previousTime)&&(time-previousTime<=0||time-previousTime>gapMs)){
   if(active)close(index-1);lastIgnition=null;lastIgnitionTime=null;
  }
  const explicitIgnition=reportBoolean(point.attributes?.ignition);
  if(explicitIgnition!==null){lastIgnition=explicitIgnition;lastIgnitionTime=time}
  const ignition=explicitIgnition!==null?explicitIgnition:carryMs>0&&lastIgnition!==null&&Number.isFinite(lastIgnitionTime)&&time>=lastIgnitionTime&&time-lastIgnitionTime<=carryMs?lastIgnition:null;
  const speed=point.speed==null?NaN:Number(point.speed)*1.852;
  const state=Number.isFinite(speed)&&speed<=3?(ignition===true?'Idle':ignition===false?'Stop':null):null;
  if(active&&state!==active.kind)close(index-1);
  if(state&&!active)active={kind:state,startIndex:index,startTime:time};
 }
 if(active)close(points.length-1);
 return rows.filter(row=>row.kind===kind);
}

const behaviourKind=event=>{
 const text=`${event?.type||''} ${event?.attributes?.alarm||''}`.toLowerCase().replace(/[^a-z]/g,'');
 if(/hardacceleration|harshacceleration/.test(text))return {action:'harsh-acceleration',label:'Harsh acceleration'};
 if(/hardbraking|harshbraking/.test(text))return {action:'harsh-braking',label:'Harsh braking'};
 if(/hardcornering|harshcornering/.test(text))return {action:'harsh-cornering',label:'Harsh cornering'};
 if(/overspeed|devicespeedlimit/.test(text))return {action:'overspeed',label:'Overspeed'};
 return null;
};

export function detailedBehaviourEvents(events=[]){
 const seen=new Set(),rows=[];
 for(const event of Array.isArray(events)?events:[]){
  const kind=behaviourKind(event);if(!kind)continue;
  const time=reportTimestamp(event),key=event.id!=null?`id:${event.id}`:JSON.stringify([event.deviceId,kind.action,Number.isFinite(time)?time:null,event.attributes?.alarm,event.latitude,event.longitude]);
  if(seen.has(key))continue;seen.add(key);
  rows.push({...kind,time:Number.isFinite(time)?time:null,event});
 }
 return rows.sort((a,b)=>(a.time??0)-(b.time??0));
}

const fuelUnit=(attributes,key)=>String(attributes?.[`${key}Unit`]??attributes?.fuelUnit??attributes?.unit??'tracker unit');

export function fuelChanges(points=[]){
 const previous=new Map(),rows=[];
 for(const point of points){
  const attributes=point.attributes||{},time=reportTimestamp(point);
  for(const source of ['fuel','fuelUsed','fuelConsumption']){
   const value=Number(attributes[source]);if(attributes[source]==null||!Number.isFinite(value))continue;
   const prior=previous.get(source),unit=fuelUnit(attributes,source);
   if(!prior){rows.push({source,value,delta:null,unit,event:'Initial reading',action:'initial',time,point});previous.set(source,{value,time});continue}
   const rawDelta=value-prior.value;if(Math.abs(rawDelta)<=1e-9)continue;
   let action='rate-change',event='Consumption rate changed',delta=rawDelta;
   if(source==='fuelUsed'){if(rawDelta>0){action='consumed';event='Fuel consumed';delta=rawDelta}else{action='counter-reset';event='Fuel counter reset'}}
   else if(source==='fuel'){if(rawDelta>0){action='increase';event='Fuel level increased'}else{action='decrease';event='Fuel level decreased'}}
   rows.push({source,value,delta,unit,event,action,time,point});previous.set(source,{value,time});
  }
 }
 return rows;
}

export function doorTransitions(points=[]){
 let previous=null;const rows=[];
 for(const point of points){
  const state=reportBoolean(first(point.attributes||{},['door','doorOpen','doors','doorStatus'])),time=reportTimestamp(point);
  if(state===null||!Number.isFinite(time))continue;
  if(!previous){previous={state,time,point};continue}
  if(state===previous.state)continue;
  rows.push({state:state?'Open':'Closed',action:state?'open':'close',event:state?'Door opened':'Door closed',time,point,previousPoint:previous.point});
  previous={state,time,point};
 }
 return rows;
}

export function geofenceAction(value){
 const text=String(value||'').toLowerCase().replace(/[^a-z]/g,'');
 if(/overspeed/.test(text))return 'overspeed';
 if(/entry|enter/.test(text))return 'entry';
 if(/exit|leave/.test(text))return 'exit';
 return 'event';
}

export function dedupeRows(rows=[],identity){
 const seen=new Set(),output=[];
 for(const row of rows){const key=identity(row);if(seen.has(key))continue;seen.add(key);output.push(row)}
 return output;
}

export function dedupeGeofenceRows(rows=[]){
 const sorted=[...rows].sort((a,b)=>(a._timeMs??0)-(b._timeMs??0)),seen=new Set(),output=[];
 for(const row of sorted){
  const exact=row._eventKey?String(row._eventKey):'';if(exact&&seen.has(exact))continue;
  const duplicate=[...output].reverse().find(previous=>{
   const delta=Math.abs(Number(row._timeMs)-Number(previous._timeMs));if(!Number.isFinite(delta)||delta>5000)return false;
   if(String(row._vehicleId)!==String(previous._vehicleId)||row.action!==previous.action)return false;
   const a=String(row.geofence||'').trim().toLowerCase(),b=String(previous.geofence||'').trim().toLowerCase();
   return !a||!b||a===b||(/^\d+$/.test(a)!==/^\d+$/.test(b));
  });
  if(duplicate)continue;if(exact)seen.add(exact);output.push(row);
 }
 return output;
}
