import {behaviourMetrics} from './driver-behaviour.mjs';
import {dutyDriving} from './driver-duty.mjs';
import {reportRange} from './report-metrics.mjs';
import {routePoints,summarize,timestamp} from './history.mjs';
import {buildBragRecord,defaultBragSettings} from './brag-report.mjs';
import {isGt06Family} from './protocol-telemetry.mjs';
import {
 canonicalReportType,dedupeGeofenceRows,dedupeRows,detailedBehaviourEvents,doorTransitions,
 fuelChanges,geofenceAction,GT06_IGNITION_CARRY_MS,normalizeReportPoints,reportBoolean,reportTimestamp,stationaryIntervals
} from './report-normalization.mjs';

export const reportTypes=['BRAG Report','RAG Report','Driver Behaviour Report','Driver Overtime Report','Trip Report','Idle Report','Parking Report','Stops Report','General Report','Mileage Report','Ignition Report','Driver Report','Geofence Alert Report','Alert Report','Fuel Report','Maintenance Report','Sensor Report','Harsh Events Report','Temperature Report','Door Report'];

const locationText=point=>{
 const address=String(point?.address||point?.attributes?.address||'').trim();if(address)return address;
 const latitude=Number(point?.latitude),longitude=Number(point?.longitude);return Number.isFinite(latitude)&&Number.isFinite(longitude)?`${latitude}, ${longitude}`:'Location unavailable';
};
const eventTime=event=>reportTimestamp(event);

export async function buildReport({type:requestedType,vehicles,store,from,to,driverId,idleMinimumSeconds=120,bragSettings=defaultBragSettings},api){
 const type=canonicalReportType(requestedType),{start,end}=reportRange(from,to);
 const time=value=>new Date(value).toLocaleString(),vIds=new Set(vehicles.map(vehicle=>String(vehicle.id))),within=value=>{const parsed=typeof value==='number'?value:Date.parse(value);return Number.isFinite(parsed)&&parsed>=+start&&parsed<=+end};
 if(type==='Alert Report'){
  const rows=(store.alerts||[]).filter(alert=>vIds.has(String(alert.vehicleId))&&within(alert.eventTime??alert.createdAt)).map(alert=>({vehicle:alert.vehicleName||vehicles.find(vehicle=>String(vehicle.id)===String(alert.vehicleId))?.name||'Unknown vehicle',time:time(alert.eventTime??alert.createdAt),event:alert.type||alert.title||'Alert',severity:alert.severity||'—',status:alert.status||'New',description:alert.description||'—',location:alert.address||alert.location||locationText(alert),_eventKey:alert.eventKey||alert.id||JSON.stringify([alert.vehicleId,alert.type,alert.eventTime??alert.createdAt])}));
  return dedupeRows(rows,row=>String(row._eventKey)).map(({_eventKey,...row})=>row);
 }
 if(type==='Maintenance Report')return (store.maintenance||[]).filter(item=>vIds.has(String(item.vehicleId))&&within(item.dueDate)).map(item=>({vehicle:vehicles.find(vehicle=>String(vehicle.id)===String(item.vehicleId))?.name,service:item.title||item.serviceType,due:item.dueDate,status:item.status,cost:item.cost??'—'}));

 const buildVehicle=async vehicle=>{
  const out=[],args=[vehicle.deviceId,start.toISOString(),end.toISOString()];
  if(type==='Trip Report'){
   const rows=await api.trips(...args);return rows.map(trip=>({vehicle:vehicle.name,driver:[...new Set((trip.driver_sessions||[]).map(driver=>driver.name).filter(Boolean))].join(', ')||'Not identified',start:time(trip.startTime),end:time(trip.endTime),distanceKm:trip.distance==null?'—':Number(trip.distance/1000).toFixed(1),durationMin:trip.duration==null?'—':Math.round(trip.duration/60000),averageKmh:trip.averageSpeed==null?'—':Number(Number(trip.averageSpeed)*1.852).toFixed(1),maxKmh:trip.maxSpeed==null?'—':Number(Number(trip.maxSpeed)*1.852).toFixed(1),from:trip.startAddress||locationText({latitude:trip.startLat,longitude:trip.startLon}),to:trip.endAddress||locationText({latitude:trip.endLat,longitude:trip.endLon})}));
  }
  if(type==='Geofence Report'){
   const events=await api.events(...args);for(const event of events.filter(item=>/geofence/i.test(`${item.type||''} ${item.attributes?.alarm||''}`))){
    const stamp=eventTime(event),action=geofenceAction(`${event.type||''} ${event.attributes?.alarm||''}`),geofence=event.geofenceName||event.attributes?.geofenceName||event.geofenceId||event.attributes?.geofenceId||'';
    out.push({vehicle:vehicle.name,driver:event.current_driver?.name||'Not identified',time:time(stamp),event:action==='event'?(event.type||'Geofence event'):`Geofence ${action[0].toUpperCase()+action.slice(1)}`,action,geofence:geofence||'—',detail:event.attributes?.alarm||event.type||'—',severity:event.severity||'—',status:event.status||'Recorded',location:locationText(event),_vehicleId:vehicle.id,_timeMs:stamp,_eventKey:event.id==null?'':`tracker:${event.id}`});
   }
   for(const alert of (store.alerts||[]).filter(item=>String(item.vehicleId)===String(vehicle.id)&&within(item.eventTime??item.createdAt)&&/geofence/i.test(`${item.type||''} ${item.title||''}`))){
    const rawTime=alert.eventTime??alert.createdAt,stamp=typeof rawTime==='number'?rawTime:Date.parse(rawTime),action=geofenceAction(`${alert.type||''} ${alert.title||''}`),geofence=alert.geofenceName||alert.geofenceId||'';
    out.push({vehicle:alert.vehicleName||vehicle.name,driver:alert.driverName||'Not identified',time:time(stamp),event:action==='event'?(alert.type||'Geofence event'):`Geofence ${action[0].toUpperCase()+action.slice(1)}`,action,geofence:geofence||'—',detail:alert.description||alert.type||'—',severity:alert.severity||'—',status:alert.status||'New',location:alert.address||alert.location||locationText(alert),_vehicleId:vehicle.id,_timeMs:stamp,_eventKey:alert.eventKey||alert.id||''});
   }
   return dedupeGeofenceRows(out).map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!key.startsWith('_'))));
  }
  if(type==='Harsh Events Report'){
   const events=await api.events(...args);return detailedBehaviourEvents(events).filter(item=>item.action!=='overspeed').map(item=>({vehicle:vehicle.name,driver:item.event.current_driver?.name||'Not identified',time:time(item.time),event:item.label,detail:item.event.attributes?.alarm||item.event.type||'—',location:locationText(item.event)}));
  }
  if(type==='Driver Report'){
   const events=await api.events(...args);return events.filter(event=>event.current_driver?.identifier&&['Driver identified','Unknown Driver','Late driver identification'].includes(event.type)&&(driverId==='all'||String(event.current_driver.driver_id)===String(driverId))).map(event=>({vehicle:vehicle.name,time:time(event.eventTime),driver:event.current_driver.name,identifier:event.current_driver.identifier,identification:event.current_driver.type,event:event.type}));
  }

  const points=routePoints(normalizeReportPoints(await api.route(...args),{protocol:vehicle.protocol})),stats=summarize(points);
  const recordedDrivers=[...new Set(points.map(point=>point.current_driver?.name||'Not identified'))].join(', ')||'Not identified';
  if(type==='BRAG Report'){
   const events=await api.events(...args);return [buildBragRecord({vehicle:{...vehicle,plate_number:vehicle.plate_number||vehicle.plate||vehicle.name,metadata:vehicle.metadata||{}},route:points,events:events.filter(event=>(event.deviceId==null||String(event.deviceId)===String(vehicle.deviceId))&&within(event.eventTime||event.serverTime)),settings:bragSettings})];
  }
  if(type==='RAG Report'){
   const events=await api.events(...args);return [{vehicle:vehicle.name,driver:recordedDrivers,assignment:'Recorded driver sessions',...behaviourMetrics(events.filter(event=>(event.deviceId==null||String(event.deviceId)===String(vehicle.deviceId))&&within(event.eventTime||event.serverTime)),stats.meters/1000)}];
  }
  if(type==='Driver Behaviour Report'){
   const events=await api.events(...args);return detailedBehaviourEvents(events.filter(event=>(event.deviceId==null||String(event.deviceId)===String(vehicle.deviceId))&&within(event.eventTime||event.serverTime))).map(item=>({vehicle:vehicle.name,driver:item.event.current_driver?.name||'Not identified',time:time(item.time),event:item.label,action:item.action,detail:item.event.attributes?.alarm||item.event.type||'—',location:locationText(item.event)}));
  }
  if(type==='Driver Overtime Report'){
   const drivers=(store.drivers||[]).filter(driver=>(driverId==='all'||String(driver.id)===String(driverId))&&points.some(point=>String(point.current_driver?.driver_id)===String(driver.id)));
   for(const driver of drivers){const duty=dutyDriving(points,driver);if(duty)out.push({vehicle:vehicle.name,driver:driver.name,assignment:'Recorded driver sessions',...duty})}return out;
  }
  if(['Summary Report','Mileage Report'].includes(type))return [{vehicle:vehicle.name,driver:recordedDrivers,distanceKm:(stats.meters/1000).toFixed(1),durationMin:Math.round(stats.duration/60000),maxKmh:stats.maxSpeed?.toFixed(1)??'—',averageKmh:stats.averageSpeed?.toFixed(1)??'—',gaps:stats.events.filter(event=>event.type==='GPS history gap').length}];
  if(['Idle Report','Parking Report','Stops Report'].includes(type)){
   const kind=type==='Idle Report'?'Idle':'Stop',minimumSeconds=type==='Idle Report'?idleMinimumSeconds:0;
   return stationaryIntervals(points,{kind,minimumSeconds,ignitionCarryMs:isGt06Family(vehicle.protocol)?GT06_IGNITION_CARRY_MS:0}).map(period=>({vehicle:vehicle.name,driver:period.startPoint?.current_driver?.name||'Not identified',event:type==='Parking Report'?'Parking':period.kind,start:time(period.startTime),end:time(period.endTime),durationMin:Number((period.durationSeconds/60).toFixed(3)),from:locationText(period.startPoint),to:locationText(period.endPoint)}));
  }
  if(type==='Fuel Report')return fuelChanges(points).map(reading=>({vehicle:vehicle.name,driver:reading.point?.current_driver?.name||'Not identified',time:time(reading.time),event:reading.event,action:reading.action,source:reading.source,value:reading.value,delta:reading.delta,unit:reading.unit,location:locationText(reading.point)}));
  if(type==='Doors Report')return doorTransitions(points).map(change=>({vehicle:vehicle.name,driver:change.point?.current_driver?.name||'Not identified',time:time(change.time),event:change.event,action:change.action,state:change.state,location:locationText(change.point)}));
  if(type==='Ignition Report'){
   let previous=null;for(const point of points){const state=reportBoolean(point.attributes?.ignition);if(state===null)continue;if(previous===null){previous=state;continue}if(state===previous)continue;previous=state;out.push({vehicle:vehicle.name,driver:point.current_driver?.name||'Not identified',time:time(timestamp(point)),event:state?'Ignition ON':'Ignition OFF',state:state?'On':'Off',location:locationText(point)})}return out;
  }
  const keys=({'Temperature Report':['temperature','temp1','temp2']})[type];
  for(const point of points){const attributes=point.attributes||{};if(type==='Sensor Report'){for(const config of (store.sensorConfigs||[]).filter(config=>String(config.vehicleId)===String(vehicle.id)&&config.enabled!==false)){if(attributes[config.sourceKey]==null)continue;out.push({vehicle:vehicle.name,time:time(timestamp(point)),sensor:config.name,source:config.sourceKey,value:attributes[config.sourceKey],unit:config.unit||'',location:locationText(point)})}}else for(const key of keys||[]){if(attributes[key]==null)continue;out.push({vehicle:vehicle.name,time:time(timestamp(point)),telemetry:key,value:attributes[key],location:locationText(point)})}}
  return out;
 };

 const out=[],eligible=vehicles.filter(vehicle=>vehicle.deviceId);
 for(let offset=0;offset<eligible.length;offset+=4){const batches=await Promise.all(eligible.slice(offset,offset+4).map(buildVehicle));for(const rows of batches)out.push(...rows)}
 return out;
}
