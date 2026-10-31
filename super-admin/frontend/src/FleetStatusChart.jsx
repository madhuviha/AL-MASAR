import React from 'react';
import {mapStatus} from './map-status.mjs';
export const fleetState=(v,settings={})=>mapStatus({device:{lastUpdate:v.lastUpdate},position:{latitude:v.latitude,longitude:v.longitude,speed:v.speedKph==null?null:Number(v.speedKph)/1.852,attributes:{ignition:v.ignition,motion:v.motion}}},settings).group;
export default function FleetStatusChart({vehicles,settings={}}){
 const colors={moving:'#14a565',idle:'#ee9a26',parked:'#7c5ce0',offline:'#e34b59',untracked:'#ee6877',never:'#8494a8'};
 const labels={moving:'Moving',idle:'Idle',parked:'Parked',offline:'Offline',untracked:'Currently Untracked',never:'Not Tracked Yet'};
 const descriptions={moving:'Vehicle is moving',idle:'Ignition on, vehicle stationary',parked:'Vehicle parked',offline:'Communication timeout reached',untracked:'Insufficient position or ignition data',never:'No communication received'};
 const counts=Object.fromEntries(Object.keys(colors).map(k=>[k,vehicles.filter(v=>fleetState(v,settings)===k).length]));
 let sum=0;const stops=Object.keys(colors).map(k=>{const start=sum;sum+=counts[k]/Math.max(1,vehicles.length)*100;return colors[k]+' '+start+'% '+sum+'%'});
 return <div className="fleetStatusChart"><div className="fleetStatusRing" style={{background:vehicles.length?'conic-gradient('+stops.join(',')+')':'#e7edf3'}}><div><b>{vehicles.length}</b><span>Total Vehicles</span></div></div><div className="fleetStatusLegend">{Object.keys(colors).map(k=>{const pct=vehicles.length?Math.round(counts[k]/vehicles.length*100):0;return <div key={k}><i style={{background:colors[k]}}/><span><b>{labels[k]}</b><small>{descriptions[k]}</small></span><strong>{counts[k]}<small>{pct}%</small></strong></div>})}</div></div>
}
