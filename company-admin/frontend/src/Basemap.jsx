import React,{useEffect,useState} from 'react';
import {TileLayer,useMap} from 'react-leaflet';
import {createPortal} from 'react-dom';
import L from 'leaflet';
import {authToken} from './api';
let mapConfigLoad;
let googleLoad;
export function loadMapConfig(){
 if(!mapConfigLoad)mapConfigLoad=fetch('/inviha-api/api/map-config',{headers:{Authorization:'Bearer '+authToken()}}).then(async response=>{if(!response.ok)throw Error('Map settings unavailable. Refresh after deployment.');return response.json()}).catch(error=>{mapConfigLoad=null;throw error});
 return mapConfigLoad;
}
export function useMapConfig(){
 const [config,setConfig]=useState(null);
 useEffect(()=>{let alive=true;loadMapConfig().then(value=>{if(alive)setConfig(value)}).catch(()=>{});return()=>{alive=false}},[]);
 return config;
}
export function loadGoogle(key){
 if(window.google?.maps?.Map)return Promise.resolve(window.google.maps);
 if(!googleLoad)googleLoad=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Google Maps timed out. Check network access and reload.')),20000);
  window.invihaGoogleReady=()=>{clearTimeout(timer);resolve(window.google.maps)};
  const script=document.createElement('script');script.async=true;
  script.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key,loading:'async',callback:'invihaGoogleReady',v:'quarterly'});
  script.onerror=()=>{clearTimeout(timer);reject(Error('Google Maps could not load. Check network access.'))};document.head.appendChild(script);
 });return googleLoad;
}
function BingLayer({definition}){
 const map=useMap();
 useEffect(()=>{
  if(!definition?.key)return;
  const Bing=L.TileLayer.extend({
   getTileUrl(coords){
    let quad='',digit=0;
    for(let z=coords.z;z>0;z--){digit=0;const mask=1<<(z-1);if((coords.x&mask)!==0)digit++;if((coords.y&mask)!==0)digit+=2;quad+=digit}
    const shard=Math.abs((coords.x+coords.y)%4);
    return `https://ecn.t${shard}.tiles.virtualearth.net/tiles/${definition.style||'r'}${quad}.jpeg?g=1&mkt=en-US&key=${encodeURIComponent(definition.key)}`;
   }
  });
  const layer=new Bing('',{maxZoom:21,attribution:'© Microsoft Bing'}).addTo(map);
  return()=>{map.removeLayer(layer)};
 },[map,definition?.key,definition?.style]);
 return null;
}
export default function Basemap({satellite=false,base=''}){
 const map=useMap(),[config,setConfig]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;loadMapConfig().then(value=>{if(alive)setConfig(value)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[]);
 const selected=base||config?.defaultBase||(satellite?'esri-satellite':'osm-road'),selectedMap=config?.maps?.find(item=>item.id===selected);
 const google=selectedMap?.engine==='google'||(!config?.maps?.length&&config?.provider==='Google Maps'),googleKey=selectedMap?.key||config?.key||'',googleType=selectedMap?.mapTypeId||(String(selected).includes('satellite')||String(selected).includes('hybrid')||satellite?'satellite':String(selected).includes('terrain')?'terrain':'roadmap');
 const bing=selectedMap?.engine==='bing';
 const tileUrl=selectedMap?.url||'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
 useEffect(()=>{if(!google)return;let alive=true,googleMap,host,sync;setError('');
  if(!googleKey){setError('Google Maps selected, but no browser API key is saved.');return}
  const failure=()=>{if(alive)setError('Google rejected the map key. Check billing, Maps JavaScript API and website restrictions, then reload.')},previous=window.gm_authFailure;window.gm_authFailure=failure;
  loadGoogle(googleKey).then(maps=>{if(!alive)return;host=document.createElement('div');Object.assign(host.style,{position:'absolute',inset:'0',zIndex:'0',pointerEvents:'none'});host.className='invihaGoogleBasemap';map.getContainer().prepend(host);const center=map.getCenter();googleMap=new maps.Map(host,{center:{lat:center.lat,lng:center.lng},zoom:map.getZoom(),mapTypeId:googleType,disableDefaultUI:true,gestureHandling:'none',keyboardShortcuts:false,clickableIcons:false,tilt:0,renderingType:maps.RenderingType?.RASTER});sync=()=>{const point=map.getCenter();googleMap.moveCamera({center:{lat:point.lat,lng:point.lng},zoom:map.getZoom(),heading:0,tilt:0})};map.on('move zoom resize',sync)}).catch(reason=>{if(alive)setError(reason.message)});
  return()=>{alive=false;if(sync)map.off('move zoom resize',sync);if(googleMap)window.google?.maps?.event?.clearInstanceListeners(googleMap);host?.remove();if(window.gm_authFailure===failure)window.gm_authFailure=previous};
 },[map,google,googleKey,googleType]);
 return <>{!google&&bing&&<BingLayer definition={selectedMap}/>} {!google&&!bing&&selectedMap?.overlay&&<TileLayer key={`${selected}-base`} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" maxZoom={19}/>} {!google&&!bing&&<TileLayer key={selected} url={tileUrl} attribution={selectedMap?.attribution||'© OpenStreetMap contributors'} maxZoom={selectedMap?.maxZoom||19} tileSize={selectedMap?.tileSize||256} zoomOffset={selectedMap?.zoomOffset||0}/>}<style>{'.invihaGoogleBasemap a,.invihaGoogleBasemap .gm-style-cc{pointer-events:auto!important}'}</style>{error&&createPortal(<div role="alert" style={{position:'absolute',bottom:35,left:'25%',right:60,zIndex:1000,background:'#fff4de',padding:10,color:'#703c00',fontSize:12}}>{error}</div>,map.getContainer())}</>;
}
