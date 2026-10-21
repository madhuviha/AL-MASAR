import {engineState} from './telemetry-state.mjs';
// Shared communication timing; GPS fix validity is a separate label.
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const bool=v=>v===true||v===1||v==='1'||v==='true'?true:v===false||v===0||v==='0'||v==='false'?false:null;
export function mapStatus(v,settings={},now=Date.now()){
 if(v?.expired===true||v?.liveAccess===false||v?.live_access===false||v?.accessStatus==='expired'||v?.access_status==='expired'||v?.local?.expired===true||v?.local?.liveAccess===false||v?.local?.accessStatus==='expired')return {operating:'expired',group:'expired',gps:'Renewal required',ignition:null,engine:null,speed:null,age:Infinity,fresh:false};
 const p=v?.position,a=p?.attributes||{},ignition=bool(a.ignition??a.ignitionOn),motion=bool(a.motion??a.movement);
 const speed=finite(p?.speed)?Number(p.speed)*1.852:finite(v?.speed)?Number(v.speed):null;
 const configured=Number(v?.local?.accuracy?.minMovingSpeed??v?.accuracy?.minMovingSpeed??3),minimum=Number.isFinite(configured)&&configured>=0&&configured<=30?configured:3;
 const received=[p?.serverTime,v?.device?.lastUpdate].map(x=>Date.parse(x)).filter(Number.isFinite);
 const age=received.length?Math.max(0,now-Math.max(...received)):Infinity;
 const offlineMs=Math.max(1,Number(settings.offlineMinutes)||300)*60000;
 const untrackedMs=Math.min(offlineMs,Math.max(5,Number(settings.untrackedSeconds||settings.freshnessSeconds)||120)*1000);
 const fixAge=p?.fixTime?now-Date.parse(p.fixTime):null;
 const gpsOff=/gps\s*:\s*off/i.test(String(a.result||''));
 const freshSample=Number.isFinite(age)&&age<untrackedMs&&!gpsOff&&(!Number.isFinite(fixAge)||fixAge<untrackedMs);
 // Keep the last known operating state visible while communication is stale.
 // The group changes to Currently Untracked at its configured threshold; a
 // stale ignition-on sample must not be relabelled as Parked in the meantime.
 // A reported speed is the most current movement signal. Some trackers keep
 // their older motion flag set after the vehicle has stopped, so only fall
 // back to that flag when the device did not report a speed at all.
 const moving=speed!==null?speed>minimum:motion===true;
 const operating=moving?'moving':ignition===true?'idle':'parked';
 const hasPosition=finite(p?.latitude)&&finite(p?.longitude)&&Math.abs(Number(p.latitude))<=90&&Math.abs(Number(p.longitude))<=180;
 const requestedUntracked=Number(settings.untrackedMinutes);
 const configuredUntracked=Number.isFinite(requestedUntracked)&&requestedUntracked>0?requestedUntracked:15;
 const untrackedAfterMs=Math.min(offlineMs,configuredUntracked*60000);
 const group=!received.length?'never':age>=offlineMs?'offline':age>=untrackedAfterMs?'untracked':operating;
 const gps=p?.valid===false||(Number.isFinite(fixAge)&&fixAge>Math.max(1,Number(settings.noSignalMinutes)||5)*60000)?'No GPS Signal':hasPosition?'GPS available':'No position received';
 return {operating,group,gps,ignition,engine:engineState(p,now),speed:freshSample?speed:null,age,fresh:freshSample};
}
export function reportedHeading(v){for(const value of [v?.position?.course,v?.position?.heading,v?.position?.attributes?.course,v?.position?.attributes?.heading,v?.course,v?.heading]){if(finite(value))return ((Number(value)%360)+360)%360}return null}
export function latestCommunicationTime(v){
 const candidates=[v?.device?.lastUpdate,v?.lastUpdate,v?.last_update,v?.position?.communicationTime,v?.position?.serverTime]
  .map(value=>({value,time:Date.parse(value)})).filter(item=>Number.isFinite(item.time));
 return candidates.length?candidates.reduce((latest,item)=>item.time>latest.time?item:latest).value:null;
}
