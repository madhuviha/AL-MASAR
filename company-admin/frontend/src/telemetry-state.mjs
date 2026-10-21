export function telemetryFresh(t,now=Date.now()){
 return t?.fresh===true&&Number.isFinite(t.sampleTime)&&now-t.sampleTime<=120000&&t.sampleTime<=now+60000;
}
export function engineState(position,now=Date.now()){
 const ignition=position?.attributes?.ignition??position?.attributes?.ignitionOn;
 if([false,0,'0','false'].includes(ignition))return false;
 const t=position?.telemetry;
 return telemetryFresh(t,now)&&typeof t.engineRunning==='boolean'?t.engineRunning:null;
}
