import {authToken} from './api';
import {addressFailure,looksLikeGenericNumberedStreet,looksLikeTransportPoi,validCoordinates} from './address-status.mjs';
const cache=new Map();let queue=Promise.resolve();
export function coordinates(p){return validCoordinates(p)?`${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`:''}
async function serverAddress(p){const response=await fetch('/inviha-api/api/geocode/reverse?'+new URLSearchParams({latitude:String(Number(p.latitude)),longitude:String(Number(p.longitude))}),{headers:{Authorization:'Bearer '+authToken()},cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('SERVER_GEOCODING');const body=await response.json(),address=String(body?.address||'').trim();if(!address||looksLikeGenericNumberedStreet(address)||looksLikeTransportPoi(address))throw Error('ADDRESS_NOT_FOUND');return address}
function cacheServerAddress(p,address){fetch('/inviha-api/api/geocode/cache',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+authToken()},body:JSON.stringify({latitude:Number(p.latitude),longitude:Number(p.longitude),address})}).catch(()=>{})}
export async function lookupAddress(p,{retry=false}={}){
 if(p?.address&&p.address!=='Address unavailable'&&!looksLikeGenericNumberedStreet(p.address)&&!looksLikeTransportPoi(p.address))return {label:p.address,ok:true};const key=coordinates(p);if(!key)return {label:'Location unavailable',reason:'No valid GPS position was recorded.',ok:false};
 if(retry)cache.delete(key);const old=cache.get(key);if(old&&old.until>Date.now())return old.promise;
 const work=queue.then(async()=>{try{return {label:await serverAddress(p),ok:true}}catch(e){const failure=addressFailure(e);const entry=cache.get(key);if(entry)entry.until=Date.now()+30000;return {...failure,ok:false}}});
 queue=work.then(()=>undefined,()=>undefined);cache.set(key,{promise:work,until:Date.now()+5*60000});if(cache.size>512)cache.delete(cache.keys().next().value);return work;
}
export async function resolveAddress(p){return (await lookupAddress(p)).label}
export async function reportLocation(p,mode='address'){const c=coordinates(p);if(mode==='coordinates')return c||'Location unavailable';const a=await resolveAddress(p);return mode==='both'?`${a}${c?' ('+c+')':''}`:a}
export async function searchLocations(query){
 const value=String(query||'').trim();if(!value)return [];
 const response=await fetch('/inviha-api/api/geocode/search?'+new URLSearchParams({q:value}),{headers:{Authorization:'Bearer '+authToken()},cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Address search unavailable. Please retry.');
 const body=await response.json();return Array.isArray(body)?body:[];
}
