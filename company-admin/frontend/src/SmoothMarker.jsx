import React,{forwardRef,useEffect,useRef,useImperativeHandle} from 'react';
import {Marker} from 'react-leaflet';
export const SmoothMarker=forwardRef(function SmoothMarker({position,fixTime,children,...props},forwarded){
 const marker=useRef(null),initial=useRef(position),last=useRef(null);
 useImperativeHandle(forwarded,()=>marker.current);
 useEffect(()=>{
  const m=marker.current;if(!m)return;const next={lat:Number(position[0]),lng:Number(position[1])},time=Date.parse(fixTime),previous=last.current;
  if(previous&&Number.isFinite(time)&&time<previous.time)return;
  last.current={...next,time};const from=m.getLatLng();const dt=previous?time-previous.time:0;
  if(!previous||!Number.isFinite(dt)||dt<=0||dt>120000||from.distanceTo(next)>Math.max(100,dt/1000*70)){m.setLatLng(next);return;}
  let frame;const start=performance.now(),duration=Math.min(1800,Math.max(400,dt*.2));
  const tick=now=>{const t=Math.min(1,(now-start)/duration);m.setLatLng([from.lat+(next.lat-from.lat)*t,from.lng+(next.lng-from.lng)*t]);if(t<1)frame=requestAnimationFrame(tick)};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[position[0],position[1],fixTime]);
 return <Marker {...props} ref={marker} position={initial.current}>{children}</Marker>;
});
