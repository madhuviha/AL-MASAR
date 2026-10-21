import React,{useEffect,useState} from 'react';
import {Circle,CircleMarker,Tooltip,useMap} from 'react-leaflet';
export default function MyLocation({request,onError}){
 const map=useMap(),[point,setPoint]=useState(null);
 useEffect(()=>{if(!request)return;let active=true;
 if(!window.isSecureContext){onError('My Location needs HTTPS. This HTTP page cannot request your location.');return;}
 if(!navigator.geolocation){onError('Location is unavailable in this browser.');return;}
 navigator.geolocation.getCurrentPosition(p=>{if(!active)return;const next=[p.coords.latitude,p.coords.longitude];setPoint({coords:next,accuracy:p.coords.accuracy});map.setView(next,16);},e=>{if(active)onError(e.code===1?'Location permission denied. Allow location for this site and try again.':e.code===3?'Location request timed out. Try again.':'Your location could not be determined.');},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
 return()=>{active=false};
 },[request,map]);
 return point?<><Circle center={point.coords} radius={Math.max(5,point.accuracy)} pathOptions={{color:'#2476e8',fillOpacity:.18}}><Tooltip permanent>Your location · ±{Math.round(point.accuracy)} m</Tooltip></Circle><CircleMarker center={point.coords} radius={7} pathOptions={{color:'white',weight:3,fillColor:'#2476e8',fillOpacity:1}}/></>:null;
}
