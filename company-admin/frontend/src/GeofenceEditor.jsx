import React,{useState,useEffect,useRef} from 'react';
import {MapContainer,Marker,Circle,Polygon,useMap,useMapEvents} from 'react-leaflet';
import L from 'leaflet';
import Basemap from './Basemap';
import {searchLocations} from './location';
const pointIcon=L.divIcon({className:'geofenceEditPoint',html:'<span></span>',iconSize:[28,28],iconAnchor:[14,14]});
function Editing({value,onChange,focus,onSelected}){
 const map=useMap();useEffect(()=>{if(focus)map.setView([focus.lat,focus.lng],15)},[focus,map]);
 useMapEvents({click:e=>value.type==='circle'?onChange(v=>({...v,lat:e.latlng.lat,lng:e.latlng.lng})):onChange(v=>({...v,points:[...v.points,[e.latlng.lat,e.latlng.lng]]}))});
 if(value.type==='circle')return <><Circle center={[value.lat,value.lng]} radius={Number(value.radius)||1}/><Marker draggable icon={pointIcon} position={[value.lat,value.lng]} eventHandlers={{dragend:e=>{const p=e.target.getLatLng();onChange(v=>({...v,lat:p.lat,lng:p.lng}))}}}/></>;
 return <>{value.points.length>1&&<Polygon positions={value.points}/>} {value.points.map((p,i)=><Marker key={i} icon={pointIcon} position={p} draggable eventHandlers={{click:()=>onSelected(i),dragend:e=>{const p=e.target.getLatLng();onChange(v=>({...v,points:v.points.map((old,n)=>n===i?[p.lat,p.lng]:old)}))}}}/>)}</>;
}
export default function GeofenceEditor({value,onChange}){
 const [query,setQuery]=useState(''),[results,setResults]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[focus,setFocus]=useState(null),[vertex,setVertex]=useState(null),[unit,setUnit]=useState('m'),sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++},[]);
 async function search(){const id=++sequence.current;setBusy(true);setError('');try{const rows=await searchLocations(query);if(id!==sequence.current)return;setResults(rows);if(!rows.length)setError('No matching places found.')}catch(e){if(id===sequence.current)setError(e.message)}finally{if(id===sequence.current)setBusy(false)}}
 return <div className="geofenceEditor"><div className="searchBox"><input aria-label="Search geofence location" placeholder="Search area, e.g. Najma, Doha" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();search()}}}/><button type="button" disabled={busy||!query.trim()} onClick={search}>{busy?'Searching…':'Search'}</button></div>{error&&<p role="alert">{error}</p>}{results.map(r=><button type="button" key={r.label} onClick={()=>{setFocus(r);onChange(v=>({...v,lat:r.lat,lng:r.lng}));setResults([])}}>{r.label}</button>)}
 <p>{value.type==='circle'?'Drag the centre point or tap the map to move the circle.':'Tap the map to add vertices. Drag a vertex to reshape; select a vertex to remove it.'}</p>
 {value.type==='circle'&&<label>Adjust radius <input aria-label="Adjust circle radius" type="range" min="1" max={Math.max(10000,Number(value.radius)||1)} value={Number(value.radius)||1} onChange={e=>onChange(v=>({...v,radius:Number(e.target.value)}))}/><output>{unit==='km'?(Number(value.radius)/1000).toFixed(3):value.radius} {unit}</output><select aria-label="Radius display unit" value={unit} onChange={e=>setUnit(e.target.value)}><option value="m">metres</option><option value="km">kilometres</option></select></label>}
 <div className="geoPick"><MapContainer zoomAnimation={false} center={[value.lat,value.lng]} zoom={12}><Basemap/><Editing value={value} onChange={onChange} focus={focus} onSelected={setVertex}/></MapContainer></div>
 {value.type==='polygon'&&<div><button type="button" disabled={!value.points.length} onClick={()=>onChange(v=>({...v,points:v.points.slice(0,-1)}))}>Undo point</button><button type="button" disabled={vertex==null||vertex>=value.points.length} onClick={()=>{onChange(v=>({...v,points:v.points.filter((_,i)=>i!==vertex)}));setVertex(null)}}>Remove selected point</button><button type="button" onClick={()=>{onChange(v=>({...v,points:[]}));setVertex(null)}}>Clear points</button><small>{value.points.length} points</small></div>}
 </div>
}
