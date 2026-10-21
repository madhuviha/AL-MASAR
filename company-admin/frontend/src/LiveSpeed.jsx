import React,{useEffect,useRef,useState} from 'react';
import {trailLimit} from './speed-trail.mjs';
import gaugeArt from './assets/speedometer-blue.jpeg';
export default function LiveSpeed({vehicle,rules,companyId,companySettings}){
 const [now,setNow]=useState(Date.now()),[updating,setUpdating]=useState(false),first=useRef(true);useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
 const p=vehicle?.position,time=Date.parse(p?.serverTime||p?.deviceTime||p?.fixTime),fresh=Number.isFinite(time)&&now-time<=120000&&time<=now+60000;
 const speed=fresh&&p?.speed!=null&&Number.isFinite(Number(p.speed))?Math.max(0,Number(p.speed)*1.852):null;
 const limit=vehicle?trailLimit(vehicle,rules,companyId,companySettings):null,signature=JSON.stringify([p?.serverTime,p?.deviceTime,p?.fixTime,p?.speed,limit]);useEffect(()=>{if(first.current){first.current=false;return}setUpdating(true);const timer=setTimeout(()=>setUpdating(false),900);return()=>clearTimeout(timer)},[signature]);
 if(!vehicle)return null;
 const over=speed!==null&&limit!==null&&speed>limit;
 const ratio=limit&&speed!==null?Math.max(0,Math.min(1,speed/limit)):0;
 return <aside className={'liveSpeed '+(over?'overLimit ':'')+(updating?'isUpdating':'')} aria-label="Selected vehicle speed">
   <div className="speedGaugeVisual" style={{'--speed-ratio':ratio}}>
     <img src={gaugeArt} alt="" aria-hidden="true"/>
     <span className="speedGaugeProgress" aria-hidden="true"/>
     <div className="speedGaugeValue"><strong>{speed===null?'—':Math.round(speed)}</strong><span>km/h</span></div>
   </div>
 </aside>
}
