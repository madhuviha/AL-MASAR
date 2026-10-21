import {stoppedAgo} from './stop-duration.mjs';
import React,{useEffect,useState} from 'react';
export function EngineIndicator({value,source,iconOnly=false}){return <span className={value===true?'engineRunningIndicator':'engineStoppedIndicator'} title={source||'Engine signal unavailable'} aria-label={value===true?'Engine running':value===false?'Engine off':'Engine unavailable'}><svg width="22" height="20" viewBox="0 0 24 20" aria-hidden="true"><path fill="currentColor" d="M6 1h9v2h-3v2h4l3 3h3v9h-3l-2 2H6l-3-4H1V8h3V5h5V3H6zm0 6v8l2 2h8l2-2h2v-5h-2l-3-3z"/></svg>{!iconOnly&&(value===true?'Running':value===false?'OFF':'Unavailable')}</span>}
export function StopDuration({position,showLabel=true}){
 const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer)},[]);
 const ago=stoppedAgo(position,now);if(!ago)return null;
 const t=position.telemetry,since=new Date(Number(t.ignitionOffSince)||t.ignitionOffSince).toLocaleString();
 return <span className="stopSince" title={(t.ignitionStopObserved?'Ignition OFF recorded: ':'First observed ignition OFF; actual stop may be earlier: ')+since}>{showLabel&&<span>Stopped since</span>}<b>{ago}</b></span>
}
