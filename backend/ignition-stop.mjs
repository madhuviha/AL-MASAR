// Separate from motion-based idling: retain the ignition-off observation across sleep gaps.
export function ignitionStop(live,previous={},now=Date.now()) {
 const a=live?.attributes||{},raw=a.ignition??a.ignitionOn;
 const ignition=[true,1,'1','true'].includes(raw)?true:[false,0,'0','false'].includes(raw)?false:null;
 const time=[live?.deviceTime,live?.devicetime,live?.fixTime,live?.fixtime,live?.serverTime,live?.servertime].map(Date.parse).find(Number.isFinite);
 const old={ignitionOffSince:previous.ignitionOffSince??null,ignitionStopObserved:previous.ignitionStopObserved===true,ignitionSampleTime:previous.ignitionSampleTime??null,stopIgnition:previous.stopIgnition??null};
 if(!Number.isFinite(time)||time>now+60000||time<=(old.ignitionSampleTime??0)||ignition===null)return old;
 const moving=live?.speed!=null&&Number.isFinite(Number(live.speed))&&Number(live.speed)*1.852>3;
 if(ignition===true||moving)return {...old,ignitionOffSince:null,ignitionStopObserved:false,ignitionSampleTime:time,stopIgnition:ignition};
 return {ignitionOffSince:old.ignitionOffSince??time,ignitionStopObserved:old.ignitionOffSince?old.ignitionStopObserved:old.stopIgnition===true&&time-old.ignitionSampleTime<=120000,ignitionSampleTime:time,stopIgnition:false};
}
