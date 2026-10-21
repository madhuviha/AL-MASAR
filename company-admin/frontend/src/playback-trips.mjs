import {routePoints,timestamp,summarize} from './history.mjs';
const ignition=p=>[true,1,'1','true'].includes(p.attributes?.ignition??p.attributes?.ignitionOn)?true:[false,0,'0','false'].includes(p.attributes?.ignition??p.attributes?.ignitionOn)?false:null;
const moving=p=>p.speed!=null&&Number.isFinite(Number(p.speed))?Number(p.speed)*1.852>3:[true,1,'1','true'].includes(p.attributes?.motion);
export function playbackTrips(rows,stopMs=300000){
 const points=routePoints(rows),trips=[];let active=[],mode=null,stop=null,partialStart=false;
 const finish=(partialEnd=false)=>{if(active.length){const stats=summarize(active);trips.push({points:active,start:timestamp(active[0]),end:timestamp(active.at(-1)),meters:stats.meters,duration:stats.duration,inferred:mode==='movement',partialStart,partialEnd})}active=[];mode=null;stop=null;partialStart=false};
 for(let i=0;i<points.length;i++){
  const p=points[i],ign=ignition(p),previous=points[i-1];
  if(ign===true){if(!active.length){mode='ignition';partialStart=!previous||ignition(previous)!==false}active.push(p);mode='ignition';stop=null;continue}
  if(ign===false){if(active.length){active.push(p);finish()}continue}
  if(mode==='ignition'){active.push(p);continue}
  if(previous&&timestamp(p)-timestamp(previous)>stopMs)finish(true);
  if(moving(p)){if(!active.length){mode='movement';partialStart=true}active.push(p);stop=null}
  else if(active.length){active.push(p);stop??=timestamp(p);if(timestamp(p)-stop>=stopMs)finish()}
 }
 finish(true);return trips;
}
