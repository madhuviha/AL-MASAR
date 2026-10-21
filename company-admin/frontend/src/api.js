const BASE='/inviha-api/api';
const KEY='inviha_company_token';
export const authToken=()=>{if(location.pathname.startsWith('/admin'))return localStorage.getItem('inviha_super_token')||'';const q=new URLSearchParams(location.search),handoff=q.get('supportToken');if(handoff){sessionStorage.setItem('inviha_company_support_token',handoff);history.replaceState({},'',location.pathname+location.hash)}return sessionStorage.getItem('inviha_company_support_token')||localStorage.getItem(KEY)||'';};
export const setAuthToken=t=>{sessionStorage.removeItem('inviha_company_support_token');return t?localStorage.setItem(KEY,t):localStorage.removeItem(KEY)};
async function req(path,opts={}){const token=authToken();const headers={'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...(opts.headers||{})};const r=await fetch(`${BASE}${path}`,{...opts,headers});let body=null;try{body=await r.json()}catch{}if(!r.ok){if(r.status===401&&path!=='/auth/login'){setAuthToken('');setTimeout(()=>location.reload(),0)}const raw=body?.message||body?.error;const message=raw&&/[ .]/.test(raw)&&!/[{}<>]/.test(raw)?raw:({401:'Your session has expired. Please sign in again.',403:'Your account does not have permission for this action.',409:'These records changed. Refresh and try again.',413:'The saved data is too large. Use a smaller logo or photo.'}[r.status]||'The request could not be completed. Please try again.');const e=new Error(message);e.body=body;e.status=r.status;throw e}return body}
const mapUser=u=>({...u.metadata,id:Number(u.id),companyId:Number(u.companyId),name:u.name,email:u.email,role:u.metadata?.displayRole||(u.role==='company_admin'?'Company Admin':'Viewer'),status:u.status==='active'?'Active':'Inactive',password:''});
export const profileRequest=req;
export function subscribeVehicles(onRows,onConnection){
 let stopped=false,controller=null,retryTimer=null,watchdogTimer=null,retryMs=1000;
 const armWatchdog=()=>{clearTimeout(watchdogTimer);watchdogTimer=setTimeout(()=>controller?.abort(),35000)};
 const connect=async()=>{
  if(stopped)return;
  controller=new AbortController();
  try{
   const token=authToken();
   const response=await fetch(`${BASE}/vehicles/stream`,{headers:{Accept:'text/event-stream',...(token?{Authorization:`Bearer ${token}`}:{})},signal:controller.signal});
   if(response.status===401){setAuthToken('');stopped=true;setTimeout(()=>location.reload(),0);return}
   if(!response.ok||!response.body)throw new Error('stream_unavailable');
   onConnection?.(true);retryMs=1000;armWatchdog();
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
   while(!stopped){
    const {value,done}=await reader.read();if(done)break;
    armWatchdog();
    buffer+=decoder.decode(value,{stream:true});const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop()||'';
    for(const block of blocks){
     const event=block.split(/\r?\n/).find(x=>x.startsWith('event:'))?.slice(6).trim();
     const dataLine=block.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');
     if(event==='vehicles'&&dataLine){try{const rows=JSON.parse(dataLine);if(Array.isArray(rows))onRows(rows)}catch{}}
    }
   }
  }catch(e){if(!stopped&&e.name!=='AbortError')onConnection?.(false)}
  finally{clearTimeout(watchdogTimer);if(!stopped){retryTimer=setTimeout(connect,retryMs);retryMs=Math.min(15000,retryMs*2)}}
 };
 connect();
 return()=>{stopped=true;clearTimeout(retryTimer);clearTimeout(watchdogTimer);controller?.abort()};
}
export const api={
 saveDriverIdentification:(id,config)=>req('/vehicles/'+id+'/driver-identification',{method:'PUT',body:JSON.stringify(config)}),
 immobilize:(id,action)=>req('/vehicles/'+id+'/immobilizer',{method:'POST',body:JSON.stringify({action})}),
 sendCommand:(id,payload)=>req('/vehicles/'+id+'/commands',{method:'POST',body:JSON.stringify(typeof payload==='string'?{command:payload}:payload)}),
 commandHistory:id=>req('/vehicles/'+id+'/commands/history'),
 trackingPolicy:()=>req('/tracking-policy'),
 scheduledReports:id=>req('/scheduled-reports/'+encodeURIComponent(id)),
 bragReport:payload=>req('/reports/brag',{method:'POST',body:JSON.stringify(payload)}),
 deleteVehicle:id=>req('/vehicles/'+id,{method:'DELETE'}),
 saveVehicle:(v,existing)=>req('/vehicles',{method:'POST',body:JSON.stringify({id:existing?v.id:undefined,companyId:v.companyId,name:v.name,imei:v.imei,plateNumber:v.plate,registration:v.license||'',protocol:v.protocol||'GT06',deviceModel:v.deviceModel||v.model||'',active:v.status!=='Inactive',metadata:v})}),

 users:async()=>(await req('/users')).map(mapUser),
 saveUser:u=>req('/users'+(u.id?'/'+u.id:''),{method:u.id?'PUT':'POST',body:JSON.stringify({name:u.name,email:u.email,password:u.password||'',role:u.role==='Company Admin'?'company_admin':'company_user',status:u.status==='Active'?'active':'inactive',metadata:{...u,displayRole:u.role}})}),
 login:(email,password,captchaToken='')=>req('/auth/login',{method:'POST',body:JSON.stringify({email,password,captchaToken})}), me:()=>req('/auth/me'), company:()=>req('/company/me'), companyState:()=>req('/company/state'),saveCompanySettings:(profile,version)=>req('/company/settings',{method:'PUT',body:JSON.stringify({profile,version})}),saveCompanySettingsSection:(category,settings,version)=>req('/company/settings',{method:'PATCH',body:JSON.stringify({category,settings,version})}), saveCompanyState:(data,version)=>req('/company/state',{method:'PUT',body:JSON.stringify({data,version})}), logout:()=>req('/auth/logout',{method:'POST'}), vehicles:()=>req('/vehicles'),
 devices:async()=>{const vs=await req('/vehicles');return vs.filter(v=>v.live_access!==false).map(v=>({id:v.traccar_device_id,name:v.name,uniqueId:v.imei,status:v.connection_status||v.device_status,lastUpdate:v.last_update}))},
 positions:async()=>{const vs=await req('/vehicles');return vs.filter(v=>v.live_access!==false&&v.traccar_device_id!=null).map(v=>({mapped_io:v.mapped_io,current_driver:v.current_driver,telemetry:v.telemetry,deviceId:v.traccar_device_id,latitude:v.latitude,longitude:v.longitude,address:v.address||'',altitude:v.altitude??null,course:v.course??null,speed:v.speed_kph==null?null:Number(v.speed_kph)/1.852,valid:v.position_valid,serverTime:v.last_update,deviceTime:v.device_time,fixTime:v.fix_time,attributes:{...(v.attributes||{}),ignition:v.ignition,motion:v.motion}}))},
 trips:(deviceId,from,to)=>req('/reports/trips?'+new URLSearchParams({deviceId,from,to})),summary:(deviceId,from,to)=>req('/reports/summary?'+new URLSearchParams({deviceId,from,to})),route:(deviceId,from,to)=>req('/reports/route?'+new URLSearchParams({deviceId,from,to})),events:(deviceId,from,to)=>req('/reports/events?'+new URLSearchParams({deviceId,from,to})),news:()=>req('/news'),markNewsRead:id=>req('/news/'+encodeURIComponent(id)+'/read',{method:'POST'})
};
