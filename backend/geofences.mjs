export function validGeofence(g){
 const finite=x=>x!==''&&x!=null&&Number.isFinite(Number(x));
 const coordinate=p=>Array.isArray(p)&&p.length===2&&p.every(finite)&&Math.abs(Number(p[0]))<=90&&Math.abs(Number(p[1]))<=180;
 if(!String(g.name||'').trim())return 'Geofence name is required.';
 if(!['circle','polygon'].includes(g.type))return 'Choose Circle or Polygon.';
 if(g.type==='circle'&&(!coordinate([g.lat,g.lng])||!finite(g.radius)||Number(g.radius)<=0||Number(g.radius)>1000000))return 'Choose a centre and a radius between 1 and 1,000,000 metres.';
 if(g.type==='polygon'&&(!Array.isArray(g.points)||g.points.length<3||!g.points.every(coordinate)||new Set(g.points.map(p=>p.join(','))).size<3))return 'A polygon needs at least three different valid points.';
 if(g.overspeedAlert&&(!finite(g.speedLimit)||Number(g.speedLimit)<=0||Number(g.speedLimit)>400))return 'Set a speed limit between 1 and 400 km/h.';
 if(g.overspeedAlert&&(!finite(g.cooldownMinutes??10)||Number(g.cooldownMinutes??10)<1||Number(g.cooldownMinutes??10)>1440))return 'Cooldown must be between 1 and 1,440 minutes.';
 return '';
}
export function evaluateGeofences(store,company,vehicles,runtime,emit,now=Date.now()){
 const distance=(a,b)=>{const rad=x=>x*Math.PI/180,dlat=rad(b[0]-a[0]),dlon=rad(b[1]-a[1]);return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dlon/2)**2)))};
 const contains=(p,pts)=>{let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[0]>p[0])!==(b[0]>p[0])&&p[1]<(b[1]-a[1])*(p[0]-a[0])/(b[0]-a[0])+a[1])inside=!inside}return inside};
 for(const g of store.localGeofences.filter(g=>String(g.companyId)===String(company.id)&&g.active!==false)){
  if(validGeofence(g))continue;
  for(const v of vehicles){const p=v.position,lat=p?.latitude,lng=p?.longitude,sample=Date.parse(p?.serverTime);
   if(v.state==='offline'||p?.valid===false||!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(sample)||now-sample>120000||sample>now+60000||g.vehicleIds?.length&&!g.vehicleIds.map(String).includes(String(v.id)))continue;
   const key=`${g.id}:${v.id}`,inside=g.type==='polygon'?contains([lat,lng],g.points):distance([Number(g.lat),Number(g.lng)],[lat,lng])<=Number(g.radius);
   const previous=runtime[key];const extra={geofenceId:g.id,geofenceName:g.name,driverId:store.drivers?.find(d=>String(d.assignedVehicleId)===String(v.id))?.id||null,driverName:store.drivers?.find(d=>String(d.assignedVehicleId)===String(v.id))?.name||'',timestamp:new Date(sample).toISOString()};
   if(previous!==undefined&&previous!==inside){if(inside&&g.entryAlert)emit({id:'geofence:'+g.id+':entry'},v,'Geofence Entry',`Entered ${g.name}`,'Info',extra);if(!inside&&g.exitAlert)emit({id:'geofence:'+g.id+':exit'},v,'Geofence Exit',`Exited ${g.name}`,'Warning',extra)}runtime[key]=inside;
   const speedKey='speed:'+key,old=runtime[speedKey]||{},signature=JSON.stringify([g.speedLimit,g.cooldownMinutes,g.overspeedAlert]),state=old.signature===signature?old:{signature,lastAlert:null,lastSample:null};
   const exceeds=inside&&g.overspeedAlert&&v.speed!=null&&Number.isFinite(Number(v.speed))&&Number(v.speed)>Number(g.speedLimit);
   if(exceeds&&state.lastSample!==sample&&(state.lastAlert==null||now-state.lastAlert>=Number(g.cooldownMinutes??10)*60000)){
    emit({id:'geofence:'+g.id+':overspeed',cooldownMinutes:Number(g.cooldownMinutes??10)},v,'Geofence Overspeed',`${g.name}: ${Number(v.speed).toFixed(1)} km/h (limit ${Number(g.speedLimit)} km/h)`,'Warning',{...extra,actualSpeed:Number(v.speed),speedLimit:Number(g.speedLimit)});state.lastAlert=now;
   }
   state.lastSample=sample;runtime[speedKey]=state;
  }
 }
 return runtime;
}
