import {routePoints,summarize,timestamp} from './history.mjs';
import {idleEvents} from './report-metrics.mjs';

export const defaultBragSettings={
 thresholds:{blueMin:90,greenMin:75,amberMin:60},
 seatbelt:{greenMin:95,amberMin:80},
 penalties:{overspeed:2,severeOverspeed:5,harshAcceleration:2,harshBraking:2,harshCornering:2,seatbeltViolation:3,excessiveIdlePerHour:1,afterHours:2,driverOverrun:3,geofenceViolation:2},
 severeOverspeedKph:20,
 idleMinimumSeconds:120,
 logos:{supplier:'',contractor:'',contractCompany:''},
 logoModes:{supplier:'platform',contractor:'company',contractCompany:'custom'}
};

const number=(value,fallback,min=0,max=100000)=>{const parsed=Number(value);return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback};
export function sanitizeBragSettings(input={}){
 const thresholds={blueMin:number(input.thresholds?.blueMin,90,1,100),greenMin:number(input.thresholds?.greenMin,75,0,99),amberMin:number(input.thresholds?.amberMin,60,0,98)};
 if(!(thresholds.blueMin>thresholds.greenMin&&thresholds.greenMin>thresholds.amberMin))throw Error('BRAG score thresholds must descend from Blue to Green to Amber.');
 const seatbelt={greenMin:number(input.seatbelt?.greenMin,95,1,100),amberMin:number(input.seatbelt?.amberMin,80,0,99)};
 if(seatbelt.greenMin<=seatbelt.amberMin)throw Error('Seat-belt Green threshold must be higher than Amber.');
 const penalties={};for(const [key,value] of Object.entries(defaultBragSettings.penalties))penalties[key]=number(input.penalties?.[key],value,0,100);
 const logos={};for(const key of Object.keys(defaultBragSettings.logos)){const value=input.logos?.[key];logos[key]=typeof value==='string'&&value.length<=1500000?value:''}
 const logoModes={};for(const [key,fallback] of Object.entries(defaultBragSettings.logoModes)){const value=input.logoModes?.[key];logoModes[key]=['platform','company','custom','none'].includes(value)?value:(logos[key]?'custom':fallback)}
 return {thresholds,seatbelt,penalties,severeOverspeedKph:number(input.severeOverspeedKph,20,1,200),idleMinimumSeconds:number(input.idleMinimumSeconds,120,0,86400),logos,logoModes};
}

const eventText=event=>`${event.type||''} ${event.attributes?.alarm||''}`.toLowerCase().replace(/[^a-z0-9]/g,'');
function eventKind(event){const text=eventText(event);if(/severeoverspeed/.test(text))return'severeOverspeed';if(/overspeed|devicespeedlimit/.test(text))return'overspeed';if(/hardacceleration|harshacceleration/.test(text))return'harshAcceleration';if(/hardbraking|harshbraking/.test(text))return'harshBraking';if(/hardcornering|harshcornering/.test(text))return'harshCornering';if(/seatbelt/.test(text))return'seatbeltViolation';if(/driveroverrun|drivingovertime/.test(text))return'driverOverrun';if(/geofence/.test(text))return'geofenceViolation';if(/afterhours/.test(text))return'afterHours';return null}
const uniqueEvents=events=>{const found=new Set();return events.filter(event=>{const key=String(event.id??JSON.stringify([event.type,event.eventTime||event.serverTime,event.attributes?.alarm,event.latitude,event.longitude]));if(found.has(key))return false;found.add(key);return true})};
const attr=(point,...keys)=>{for(const key of keys)if(point?.attributes?.[key]!==undefined&&point.attributes[key]!==null)return point.attributes[key];return null};
const bool=value=>value===true||value===1||value==='1'||String(value).toLowerCase()==='true'||String(value).toLowerCase()==='on';
const duration=(seconds)=>{const total=Math.max(0,Math.round(Number(seconds)||0)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60);return `${hours}h ${String(minutes).padStart(2,'0')}m`};
const coordinates=row=>{const latitude=Number(row.latitude),longitude=Number(row.longitude);return Number.isFinite(latitude)&&Number.isFinite(longitude)?`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`:'Location unavailable'};
const scoreStatus=(score,thresholds)=>score>=thresholds.blueMin?'Blue':score>=thresholds.greenMin?'Green':score>=thresholds.amberMin?'Amber':'Red';

export function buildBragRecord({vehicle,route=[],events=[],settings=defaultBragSettings}){
 const config=sanitizeBragSettings(settings),points=routePoints(route),stats=summarize(points),deduped=uniqueEvents(events),counts={overspeed:0,severeOverspeed:0,harshAcceleration:0,harshBraking:0,harshCornering:0,seatbeltViolation:0,afterHours:0,driverOverrun:0,geofenceViolation:0};
 const violations=[];
 for(const event of deduped){let kind=eventKind(event);if(!kind)continue;const speed=number(event.attributes?.speed??event.speed,0,0,500),limit=number(event.attributes?.speedLimit??event.attributes?.limit??vehicle.metadata?.speedLimit,0,0,500);if(kind==='overspeed'&&limit&&speed-limit>=config.severeOverspeedKph)kind='severeOverspeed';counts[kind]++;
  const penalty=config.penalties[kind==='severeOverspeed'?'severeOverspeed':kind]||0;violations.push({dateTime:event.eventTime||event.serverTime||event.deviceTime||null,vehicle:vehicle.plate_number||vehicle.name,driver:event.current_driver?.name||'Not identified',eventType:kind.replace(/([A-Z])/g,' $1').replace(/^./,value=>value.toUpperCase()),speedKph:speed||null,limitKph:limit||null,location:event.address||event.attributes?.address||coordinates(event),penalty:-penalty});
 }
 const idleSeconds=idleEvents(stats.events,config.idleMinimumSeconds).reduce((sum,event)=>sum+event.duration/1000,0);
 const drivingSeconds=points.slice(1).reduce((sum,point,index)=>{const previous=points[index],delta=timestamp(point)-timestamp(previous);return sum+(delta>0&&delta<=300000&&(Number(previous.speed)||0)*1.852>3?delta/1000:0)},0);
 const seatbeltSamples=points.map(point=>attr(point,'seatbelt','seatBelt','seatbeltFastened','seatBeltFastened')).filter(value=>value!==null),seatbeltCompliant=seatbeltSamples.filter(bool).length,seatbeltCompliancePercent=seatbeltSamples.length?Number((seatbeltCompliant/seatbeltSamples.length*100).toFixed(1)):null;
 const drivers=[...new Set(points.map(point=>point.current_driver?.name).filter(Boolean))],driverIds=[...new Set(points.map(point=>point.current_driver?.driver_id).filter(value=>value!==null&&value!==undefined).map(String))];
 const penalty=Object.entries(counts).reduce((sum,[key,value])=>sum+value*(config.penalties[key]||0),0)+Math.floor(idleSeconds/3600)*config.penalties.excessiveIdlePerHour;
 const score=Math.max(0,Math.min(100,Math.round(100-penalty))),supportedMetrics=['distance','drivingTime','idle',...new Set(deduped.map(eventKind).filter(Boolean)),...(seatbeltSamples.length?['seatbelt']:[])];
 return {vehicleId:Number(vehicle.id),vehicleNumber:vehicle.plate_number||vehicle.name,vehicleName:vehicle.name,imei:vehicle.imei,driverName:drivers.join(', ')||'Not identified',driverIds,companyId:Number(vehicle.company_id),companyName:vehicle.company_name||'',contractor:vehicle.metadata?.contractor||'',contract:vehicle.metadata?.contract||'',distanceKm:Number((stats.meters/1000).toFixed(1)),drivingSeconds:Math.round(drivingSeconds),drivingTime:duration(drivingSeconds),idleSeconds:Math.round(idleSeconds),idleTime:duration(idleSeconds),overspeedCount:counts.overspeed+counts.severeOverspeed,severeOverspeedCount:counts.severeOverspeed,harshAccelerationCount:counts.harshAcceleration,harshBrakingCount:counts.harshBraking,harshCorneringCount:counts.harshCornering,seatbeltViolationCount:counts.seatbeltViolation,seatbeltCompliancePercent,afterHoursCount:counts.afterHours,driverOverrunCount:counts.driverOverrun,geofenceViolationCount:counts.geofenceViolation,totalEvents:Object.values(counts).reduce((sum,value)=>sum+value,0),totalPenalty:penalty,score,bragStatus:scoreStatus(score,config.thresholds),supportedMetrics,violations};
}

export function bragSummary(rows,settings=defaultBragSettings){const counts={Blue:0,Green:0,Amber:0,Red:0};for(const row of rows)counts[row.bragStatus]=(counts[row.bragStatus]||0)+1;const scores=rows.map(row=>row.score).filter(Number.isFinite),ordered=[...rows].sort((a,b)=>b.score-a.score);return {totalVehicles:rows.length,counts,averageFleetScore:scores.length?Number((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)):0,highest:ordered[0]||null,lowest:ordered.at(-1)||null,settings:sanitizeBragSettings(settings)};}
