import React,{useState,useEffect} from 'react';
import {lookupAddress,coordinates} from './location';
import './location-status.css';

const STOP_ADDRESS_DELAY=30000;
function normalizedPosition(position){
 if(typeof position!=='string')return position;
 const match=/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(position);
 return match?{latitude:Number(match[1]),longitude:Number(match[2])}:{address:position};
}

export default function Address({position}){
 const current=normalizedPosition(position),currentKey=coordinates(current),stopStart=Number(current?.telemetry?.stoppedSince),stationary=Number.isFinite(stopStart)&&stopStart>0;
 const [lookupPosition,setLookupPosition]=useState(()=>stationary?null:current),[pendingStop,setPendingStop]=useState(stationary),[result,setResult]=useState({label:'Loading address…'}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!currentKey){setLookupPosition(current);setPendingStop(false);return;}
  if(!stationary){setLookupPosition(current);setPendingStop(false);return;}
  const commit=()=>{setLookupPosition(previous=>previous?.__stopStart===stopStart?previous:{...current,__stopStart:stopStart});setPendingStop(false)};
  const remaining=Math.max(0,stopStart+STOP_ADDRESS_DELAY-Date.now());
  setPendingStop(remaining>0);
  if(!remaining){commit();return;}
  const timer=setTimeout(commit,remaining);
  return()=>clearTimeout(timer);
 },[currentKey,current?.address,stationary,stopStart]);
 const lookupKey=coordinates(lookupPosition),mapUrl=currentKey?'https://www.openstreetmap.org/?mlat='+Number(current.latitude)+'&mlon='+Number(current.longitude)+'#map=17/'+Number(current.latitude)+'/'+Number(current.longitude):'';
 useEffect(()=>{
  if(pendingStop)return;
  let alive=true;
  setResult({label:'Loading address…'});
  lookupAddress(lookupPosition,{retry:attempt>0}).then(value=>{if(alive)setResult(value)});
  return()=>{alive=false};
 },[lookupKey,lookupPosition?.address,pendingStop,attempt]);
 const shown=pendingStop&&!lookupKey?{label:'Confirming stop location…'}:result;
 return <span className="addressDisplay" title={currentKey}>{mapUrl?<a className="addressMapLink" href={mapUrl} target="_blank" rel="noreferrer">{shown.label}</a>:<span>{shown.label}</span>}{shown.reason&&currentKey&&<details className="addressHelp"><summary>Why?</summary><div>{shown.reason}<button onClick={()=>setAttempt(value=>value+1)}>Retry address</button></div></details>}</span>;
}
