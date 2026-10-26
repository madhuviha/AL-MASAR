import {stoppedAgo} from './stop-duration.mjs';
import React,{useEffect,useState} from 'react';
import engineIcon from './assets/icons8-engine-50.png';
export function EngineIndicator({value,source,iconOnly=false}){const[draw,setDraw]=useState(true);useEffect(()=>{setDraw(true);const timer=setTimeout(()=>setDraw(false),900);return()=>clearTimeout(timer)},[value]);return <span className={(value===true?'engineRunningIndicator':value===false?'engineStoppedIndicator':'engineStoppedIndicator')+(draw?' engineSignalDraw':'')} title={source||'Engine signal unavailable'} aria-label={value===true?'Engine running':'Engine off'}><span className="engineGlyph" style={{'--engine-icon':`url(${engineIcon})`}} aria-hidden="true"/>{!iconOnly&&(value===true?'Running':'OFF')}</span>}
export function StopDuration({position,showLabel=true}){
 const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer)},[]);
 const ago=stoppedAgo(position,now);if(!ago)return null;
 const t=position.telemetry,since=new Date(Number(t.ignitionOffSince)||t.ignitionOffSince).toLocaleString();
 return <span className="stopSince" title={(t.ignitionStopObserved?'Ignition OFF recorded: ':'First observed ignition OFF; actual stop may be earlier: ')+since}>{showLabel&&<span>Stopped since</span>}<b>{ago}</b></span>
}
