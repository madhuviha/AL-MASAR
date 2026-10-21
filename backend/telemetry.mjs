import {ignitionStop} from './ignition-stop.mjs';
export const telemetryBool=v=>[true,1,'1','true'].includes(v)?true:[false,0,'0','false'].includes(v)?false:null;
const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function deriveTelemetry(live,metadata={},previous={},now=Date.now()){
 previous={...previous,...ignitionStop(live,previous,now)};
 const a=live?.attributes||{},config=metadata.accuracy||{},time=[live?.devicetime,live?.deviceTime,live?.fixtime,live?.fixTime,live?.servertime,live?.serverTime].map(Date.parse).find(Number.isFinite),received=[live?.servertime,live?.serverTime,live?.lastupdate,live?.lastUpdate].map(Date.parse).filter(Number.isFinite);
 const ignition=telemetryBool(a.ignition??a.ignitionOn),speed=numeric(live?.speed),kmh=speed===null?null:speed*1.852;
 const fresh=Number.isFinite(time)&&time<=now+60000&&received.length>0&&now-Math.max(...received)<=120000&&now-time<=120000;
 if(!fresh)return {...previous,ignition,engineRunning:ignition===false?false:null,engineSource:ignition===false?'last ignition OFF':'unavailable',fresh:false};
 if(previous.sampleTime&&time<previous.sampleTime)return {...previous,ignition,fresh:false,engineRunning:ignition===false?false:null,engineSource:ignition===false?'last ignition OFF':'out-of-order sample'};
 let engine=null,source='unavailable',candidate=null,candidateSince=null;
 const rpm=numeric(a[config.engineRpmKey||'rpm']),direct=telemetryBool(a.engineRunning),device=config.engineSignalKey?telemetryBool(a[config.engineSignalKey]):null;
 if(rpm!==null&&rpm>=0){engine=rpm>Math.max(0,Number(config.engineRpmThreshold)||0);source='RPM'}
 else if(direct!==null){engine=direct;source='engine-running signal'}
 else if(device!==null){engine=device;source='configured device signal'}
 else if(ignition===false){engine=false;source='ignition OFF'}
 else if(ignition===true&&config.engineVoltageEnabled===true){
  const voltage=numeric(a[config.engineVoltageKey||'power']),on=numeric(config.engineVoltageOn),off=numeric(config.engineVoltageOff),signature=JSON.stringify([config.engineVoltageKey,on,off,config.engineDebounceSeconds]);
  const same=previous.voltageSignature===signature,old=same&&previous.engineSource==='voltage inference'?previous.engineRunning:null;
  if(voltage!==null&&on!==null&&off!==null&&on>off&&off>0){candidate=voltage>=on?true:voltage<=off?false:old;
   if(candidate!==null){candidateSince=same&&previous.candidate===candidate?previous.candidateSince:time;const delay=Math.max(0,Number(config.engineDebounceSeconds??10))*1000;engine=time-candidateSince>=delay?candidate:old;source=engine===null?'voltage pending':'voltage inference';}
  }
 }
 const moving=kmh===null?null:kmh>Math.max(0,Number(config.minMovingSpeed??3));
 let stoppedSince=previous.stoppedSince??null,stopStartObserved=previous.stopStartObserved??false;
 if(previous.sampleTime&&time-previous.sampleTime>120000){stoppedSince=null;stopStartObserved=false}
 if(moving===true){stoppedSince=null;stopStartObserved=false}else if(moving===false&&!stoppedSince){stoppedSince=time;stopStartObserved=previous.moving===true&&time-previous.sampleTime<=120000}
 const activityState=kmh!==null&&kmh>3?'running':ignition===true?'idle':ignition===false?'parked':null;
 const contiguous=Number.isFinite(previous.sampleTime)&&time>=previous.sampleTime&&time-previous.sampleTime<=120000;
 const same=activityState!==null&&activityState===previous.activityState&&contiguous&&Number.isFinite(previous.activitySince);
 const activitySince=activityState===null?null:same?previous.activitySince:time;
 const activityStartObserved=activityState===null?false:same?previous.activityStartObserved===true:contiguous&&previous.activityState!=null&&previous.activityState!==activityState;
 return {...ignitionStop(live,previous,now),activityState,activitySince,activityStartObserved,ignition,engineRunning:engine,engineSource:source,sampleTime:time,fresh:true,candidate,candidateSince,voltageSignature:JSON.stringify([config.engineVoltageKey,numeric(config.engineVoltageOn),numeric(config.engineVoltageOff),config.engineDebounceSeconds]),moving,stoppedSince,stopStartObserved};
}
