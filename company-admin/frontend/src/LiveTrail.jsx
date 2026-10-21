import {speedSegments} from './speed-trail.mjs';
import React,{useState,useEffect,useMemo} from 'react';
import {Polyline} from 'react-leaflet';
import {api} from './api';
import {routePoints,timestamp} from './history.mjs';
export default function LiveTrail({vehicle,enabled,minutes=30,speedLimit,onStatus}){
 const [live,setLive]=useState({device:null,points:[]});
 const [history,setHistory]=useState({device:null,points:[]});
 const device=vehicle?.deviceId;
 useEffect(()=>{let active=true,busy=false;if(!enabled||!device){onStatus?.(enabled?'Select a vehicle to display its trail.':'');return}setHistory({device,points:[]});
 async function load(){if(busy)return;busy=true;const end=new Date(),start=new Date(+end-minutes*60000);try{const rows=await api.route(device,start.toISOString(),end.toISOString());if(active){setHistory({device,points:routePoints(rows.filter(p=>p.deviceId==null||String(p.deviceId)===String(device)))});onStatus?.('')}}catch{if(active)onStatus?.('Trail history unavailable. Toggle Trails to retry.')}finally{busy=false}}
 load();return()=>{active=false}},[device,enabled,minutes,onStatus]);
 useEffect(()=>{if(!enabled||!device||!vehicle?.position)return;const p=vehicle.position;if(p.deviceId!=null&&String(p.deviceId)!==String(device))return;setLive(old=>({device,points:routePoints([...(String(old.device)===String(device)?old.points:[]),p]).filter(x=>timestamp(x)>=Date.now()-minutes*60000)}))},[vehicle?.position,device,enabled,minutes]);
 const points=useMemo(()=>{if(!enabled||!device||String(history.device)!==String(device))return [];const last=vehicle?.position;return routePoints([...history.points,...(String(live.device)===String(device)?live.points:[]),...(last&&(last.deviceId==null||String(last.deviceId)===String(device))?[last]:[])]).filter(p=>timestamp(p)>=Date.now()-minutes*60000)},[history,live,vehicle?.position,device,minutes,enabled]);
 useEffect(()=>{if(enabled&&device&&String(history.device)===String(device))onStatus?.('')},[enabled,device,history.device,onStatus]);
 return <>{speedSegments(points,speedLimit).map(({positions,color},i)=><Polyline key={i} positions={positions} pathOptions={{color,weight:4,opacity:.9,lineCap:'round',lineJoin:'round'}}/>)}</>;
}
