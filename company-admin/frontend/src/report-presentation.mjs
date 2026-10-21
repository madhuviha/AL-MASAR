export const REPORT_PALETTE=Object.freeze({
 blue:'#168ff1',green:'#079b58',amber:'#d98000',red:'#dc3545',gray:'#738396',navy:'#173b57'
});

export const REPORT_ALIASES=Object.freeze({
 'General Report':'Summary Report','Door Report':'Doors Report','Geofence Alert Report':'Geofence Report','Alerts Report':'Alert Report','Stop Report':'Stops Report'
});

const DEFINITIONS=Object.freeze({
 'RAG Report':{title:'RAG Report',subtitle:'Fleet safety risk calculated from recorded driving events per 100 km',columns:[['vehicle','Vehicle'],['driver','Driver'],['distanceKm','Distance (km)'],['harshAcceleration','Harsh acceleration'],['harshBraking','Harsh braking'],['harshCornering','Harsh cornering'],['overspeedEvents','Overspeed'],['eventsPer100Km','Events / 100 km'],['rag','RAG rating']]},
 'Driver Behaviour Report':{title:'Driver Behaviour Report',subtitle:'Individual harsh-driving and overspeed events recorded by the tracker',columns:[['vehicle','Vehicle'],['driver','Driver'],['time','Time'],['event','Behaviour event'],['action','Action'],['detail','Detail'],['location','Location']]},
 'Idle Report':{title:'Idle Report',subtitle:'Engine-on stationary periods recorded from vehicle telemetry',columns:[['vehicle','Vehicle'],['driver','Driver'],['start','Idle start'],['end','Idle end'],['durationMin','Idle duration (min)'],['from','Start location'],['to','End location'],['location','Location']]},
 'Stops Report':{title:'Stops Report',subtitle:'Recorded stationary periods for the selected vehicles',columns:[['vehicle','Vehicle'],['driver','Driver'],['start','Stop start'],['end','Stop end'],['durationMin','Stop duration (min)'],['from','Start location'],['to','End location'],['location','Location']]},
 'Summary Report':{title:'General Report',subtitle:'Fleet activity summary for the selected period',columns:[['vehicle','Vehicle'],['driver','Driver'],['distanceKm','Distance (km)'],['durationMin','Recorded duration (min)'],['maxKmh','Maximum speed (km/h)'],['averageKmh','Average speed (km/h)'],['gaps','GPS gaps']]},
 'Driver Overtime Report':{title:'Driver Overtime Report',subtitle:'Driving inside and outside each driver’s configured duty schedule',columns:[['vehicle','Vehicle'],['driver','Driver'],['assignment','Assignment'],['normalDrivingMinutes','Normal driving (min)'],['overrunMinutes','Overtime (min)'],['overtimeHours','Overtime (hours)'],['hourlyRate','Hourly rate'],['overtimeAmount','Overtime amount'],['currency','Currency'],['timezone','Time zone']]},
 'Trip Report':{title:'Trip Report',subtitle:'Completed trips and their recorded distance, duration and locations',columns:[['vehicle','Vehicle'],['driver','Driver'],['start','Trip start'],['end','Trip end'],['distanceKm','Distance (km)'],['durationMin','Duration (min)'],['averageKmh','Average speed (km/h)'],['maxKmh','Maximum speed (km/h)'],['from','Start location'],['to','End location']]},
 'Fuel Report':{title:'Fuel Report',subtitle:'Recorded fuel changes from supported vehicle sensors',columns:[['vehicle','Vehicle'],['driver','Driver'],['time','Time'],['event','Fuel event'],['action','Action'],['source','Source'],['value','Reading'],['delta','Change'],['unit','Unit'],['location','Location']]},
 'Doors Report':{title:'Door Report',subtitle:'Recorded door open and close transitions',columns:[['vehicle','Vehicle'],['driver','Driver'],['time','Time'],['event','Door event'],['action','Action'],['state','Door state'],['location','Location']]},
 'Alert Report':{title:'Alert Report',subtitle:'Fleet alerts recorded during the selected period',columns:[['vehicle','Vehicle'],['time','Time'],['event','Alert'],['severity','Severity'],['status','Status'],['description','Description'],['location','Location']]},
 'Geofence Report':{title:'Geofence Alert Report',subtitle:'Geofence entries, exits and violations recorded during the selected period',columns:[['vehicle','Vehicle'],['driver','Driver'],['time','Time'],['event','Geofence event'],['action','Action'],['geofence','Geofence'],['detail','Detail'],['severity','Severity'],['status','Status'],['location','Location']]}
});

const FALLBACK=Object.freeze({title:'Fleet Report',subtitle:'Recorded fleet data for the selected period',columns:[]});
const canonicalType=type=>REPORT_ALIASES[String(type||'').trim()]||String(type||'Fleet Report').trim();
const pretty=key=>String(key||'').replace(/_/g,' ').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/^./,letter=>letter.toUpperCase());
const hasValue=value=>value!==null&&value!==undefined&&value!=='';
const number=value=>hasValue(value)&&Number.isFinite(Number(value))?Number(value):null;
const values=(rows,key)=>rows.map(row=>number(row?.[key])).filter(value=>value!==null);
const sum=items=>items.reduce((total,value)=>total+value,0);
const hasKey=(rows,key)=>rows.some(row=>Object.prototype.hasOwnProperty.call(row||{},key));
const identity=row=>row?.vehicleId??row?.vehicle??row?.vehicleName??row?.vehicleNumber;
const unique=(rows,key)=>new Set(rows.map(row=>key?row?.[key]:identity(row)).filter(hasValue)).size;
const fixed=(value,digits=1)=>Number(value).toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits});
const metric=(key,label,value,tone='blue',supported=true)=>({key,label,value:supported?value:'N/A',tone:supported?tone:'gray',supported});
const secondsFor=row=>number(row?.durationSeconds)??(number(row?.durationMin)==null?null:number(row.durationMin)*60);
const durationValues=rows=>rows.map(secondsFor).filter(value=>value!==null);
const fieldSupported=(rows,...keys)=>rows.some(row=>keys.some(key=>Object.prototype.hasOwnProperty.call(row||{},key)));
const normalizedText=value=>String(value??'').trim().toLowerCase();
const actionOf=row=>normalizedText(row?.action||row?.event||row?.type);

export function formatDurationSeconds(value){
 const seconds=number(value);if(seconds===null)return'N/A';
 const total=Math.max(0,Math.round(seconds)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),secs=total%60;
 if(hours)return`${hours}h ${String(minutes).padStart(2,'0')}m`;
 if(minutes)return`${minutes}m${secs?` ${String(secs).padStart(2,'0')}s`:''}`;
 return`${secs}s`;
}

export function reportDefinition(type){
 const canonical=canonicalType(type),definition=DEFINITIONS[canonical]||FALLBACK;
 return {...definition,type:canonical,title:definition===FALLBACK?String(type||'Fleet Report'):definition.title};
}

export const reportDisplayName=type=>reportDefinition(type).title;

export function reportColumns(rows=[],type){
 const cleanRows=Array.isArray(rows)?rows:[],definition=reportDefinition(type),present=new Set(cleanRows.flatMap(row=>Object.keys(row||{})).filter(key=>!key.startsWith('_'))),ordered=[];
 for(const [key,label] of definition.columns||[])if(present.has(key)){ordered.push({key,label});present.delete(key)}
 for(const key of present)ordered.push({key,label:pretty(key)});
 return ordered;
}

function stationaryMetrics(rows,noun){
 const durations=durationValues(rows),supported=durations.length>0,total=sum(durations),vehicles=unique(rows);
 return [metric('records',`${noun} events`,rows.length,'blue'),metric('vehicles','Affected vehicles',vehicles,'navy'),metric('total',`Total ${noun.toLowerCase()}`,formatDurationSeconds(total),'amber',supported),metric('average',`Average ${noun.toLowerCase()}`,formatDurationSeconds(supported?total/durations.length:null),'green',supported),metric('longest',`Longest ${noun.toLowerCase()}`,formatDurationSeconds(supported?Math.max(...durations):null),'red',supported)];
}

function summaryMetrics(rows){
 const distances=values(rows,'distanceKm'),durations=durationValues(rows),speeds=values(rows,'maxKmh'),gaps=values(rows,'gaps');
 return [metric('vehicles','Vehicles reported',unique(rows),'blue'),metric('distance','Total distance',`${fixed(sum(distances))} km`,'green',distances.length>0),metric('duration','Recorded duration',formatDurationSeconds(sum(durations)),'navy',durations.length>0),metric('speed','Maximum speed',`${fixed(Math.max(...speeds),1)} km/h`,'amber',speeds.length>0),metric('gaps','GPS gaps',fixed(sum(gaps),0),sum(gaps)>0?'amber':'green',gaps.length>0)];
}

function overtimeMetrics(rows){
 const normal=values(rows,'normalDrivingMinutes'),overrun=values(rows,'overrunMinutes'),hours=values(rows,'overtimeHours'),amounts=values(rows,'overtimeAmount'),overtimeSupported=overrun.length>0||hours.length>0;
 const overtimeSeconds=overrun.length?sum(overrun)*60:sum(hours)*3600,driversWithOvertime=overtimeSupported?rows.filter(row=>(number(row.overrunMinutes)??((number(row.overtimeHours)||0)*60))>0).map(row=>row.driver).filter(hasValue):[];
 const currencies=[...new Set(rows.map(row=>row.currency).filter(hasValue))],amountSuffix=currencies.length===1?` ${currencies[0]}`:'';
 return [metric('drivers','Drivers assessed',unique(rows,'driver'),'blue'),metric('overtimeDrivers','Drivers with overtime',new Set(driversWithOvertime).size,driversWithOvertime.length?'amber':'green',overtimeSupported),metric('normal','Normal driving',formatDurationSeconds(sum(normal)*60),'green',normal.length>0),metric('overtime','Total overtime',formatDurationSeconds(overtimeSeconds),overtimeSeconds>0?'amber':'green',overtimeSupported),metric('amount','Overtime amount',`${fixed(sum(amounts),2)}${amountSuffix}`,sum(amounts)>0?'red':'green',amounts.length>0)];
}

function tripMetrics(rows){
 const distances=values(rows,'distanceKm'),durations=durationValues(rows),totalDistance=sum(distances);
 return [metric('trips','Completed trips',rows.length,'green'),metric('vehicles','Vehicles',unique(rows),'blue'),metric('distance','Total distance',`${fixed(totalDistance)} km`,'navy',distances.length>0),metric('duration','Total trip time',formatDurationSeconds(sum(durations)),'blue',durations.length>0),metric('average','Average distance / trip',`${fixed(rows.length?totalDistance/rows.length:0)} km`,'green',distances.length>0&&rows.length>0)];
}

function fuelMetrics(rows){
 const actionsSupported=hasKey(rows,'action'),changes=rows.filter(row=>actionOf(row)!=='initial'),consumed=rows.filter(row=>actionOf(row)==='consumed'),increases=rows.filter(row=>actionOf(row)==='increase'),decreases=rows.filter(row=>actionOf(row)==='decrease'),deltas=consumed.map(row=>number(row.delta)).filter(value=>value!==null),units=[...new Set(consumed.map(row=>row.unit).filter(hasValue))],consistentUnits=units.length<=1,totalLabel=deltas.length?`${fixed(sum(deltas),2)}${units.length===1?` ${units[0]}`:''}`:(actionsSupported?'0':'N/A');
 return [metric('records','Fuel changes',changes.length,'blue',actionsSupported),metric('vehicles','Supported vehicles',unique(rows),'navy'),metric('consumed','Consumption events',consumed.length,'blue',actionsSupported),metric('totalConsumed','Total consumed',consistentUnits?totalLabel:'N/A',consistentUnits?'amber':'gray',actionsSupported&&consistentUnits),metric('increases','Fuel increases',increases.length,'green',actionsSupported),metric('decreases','Fuel decreases',decreases.length,'red',actionsSupported)];
}

function ragMetrics(rows){
 const counts={Green:0,Amber:0,Red:0,'Not rated':0};let events=0;
 for(const row of rows){const rating=Object.hasOwn(counts,row.rag)?row.rag:'Not rated';counts[rating]++;for(const key of ['harshAcceleration','harshBraking','harshCornering','overspeedEvents'])events+=number(row[key])||0}
 return [metric('assessed','Vehicles assessed',rows.length-counts['Not rated'],'navy'),metric('green','Low risk',counts.Green,'green'),metric('amber','Needs attention',counts.Amber,'amber'),metric('red','High risk',counts.Red,'red'),metric('events','Safety events',events,events?'amber':'green')];
}

function behaviourEventMetrics(rows){
 const actions=rows.map(actionOf),harsh=actions.filter(value=>value.startsWith('harsh-')).length,overspeed=actions.filter(value=>value==='overspeed').length;
 return [metric('events','Behaviour events',rows.length,'blue'),metric('vehicles','Affected vehicles',unique(rows),'navy'),metric('drivers','Identified drivers',new Set(rows.map(row=>row.driver).filter(value=>hasValue(value)&&value!=='Not identified')).size,'green'),metric('harsh','Harsh events',harsh,harsh?'amber':'green'),metric('overspeed','Overspeed events',overspeed,overspeed?'red':'green')];
}

function doorMetrics(rows){
 const supported=fieldSupported(rows,'action','state'),opened=rows.filter(row=>['open','opened'].includes(actionOf(row))||normalizedText(row.state)==='open').length,closed=rows.filter(row=>['close','closed'].includes(actionOf(row))||normalizedText(row.state)==='closed').length;
 return [metric('transitions','Door transitions',rows.length,'blue'),metric('vehicles','Vehicles',unique(rows),'navy'),metric('opened','Opened',opened,'amber',supported),metric('closed','Closed',closed,'green',supported)];
}

function alertMetrics(rows){
 const severitySupported=hasKey(rows,'severity'),statusSupported=hasKey(rows,'status'),critical=rows.filter(row=>['critical','high','emergency'].includes(normalizedText(row.severity))).length,warnings=rows.filter(row=>['warning','warn','medium'].includes(normalizedText(row.severity))).length,resolved=rows.filter(row=>['resolved','closed','completed'].includes(normalizedText(row.status))).length;
 return [metric('alerts','Total alerts',rows.length,'blue'),metric('vehicles','Affected vehicles',unique(rows),'navy'),metric('critical','Critical',critical,'red',severitySupported),metric('warning','Warning',warnings,'amber',severitySupported),metric('resolved','Resolved',resolved,'green',statusSupported)];
}

function geofenceMetrics(rows){
 const supported=fieldSupported(rows,'action','event'),actions=rows.map(actionOf),entries=actions.filter(value=>/\b(entry|enter|entered)\b/.test(value)).length,exits=actions.filter(value=>/\b(exit|leave|left)\b/.test(value)).length,violations=rows.filter((row,index)=>/overspeed|violation|breach/.test(actions[index])||['critical','high'].includes(normalizedText(row.severity))).length;
 return [metric('events','Geofence events',rows.length,'blue'),metric('vehicles','Affected vehicles',unique(rows),'navy'),metric('entries','Entries',entries,'green',supported),metric('exits','Exits',exits,'blue',supported),metric('violations','Violations',violations,'red',supported)];
}

export function reportMetrics(rows=[],summary={}){
 const cleanRows=Array.isArray(rows)?rows:[],type=reportDefinition(summary?.type).type;
 if(type==='RAG Report')return ragMetrics(cleanRows);
 if(type==='Driver Behaviour Report')return behaviourEventMetrics(cleanRows);
 if(type==='Idle Report')return stationaryMetrics(cleanRows,'Idle');
 if(type==='Stops Report')return stationaryMetrics(cleanRows,'Stop');
 if(type==='Summary Report')return summaryMetrics(cleanRows);
 if(type==='Driver Overtime Report')return overtimeMetrics(cleanRows);
 if(type==='Trip Report')return tripMetrics(cleanRows);
 if(type==='Fuel Report')return fuelMetrics(cleanRows);
 if(type==='Doors Report')return doorMetrics(cleanRows);
 if(type==='Alert Report')return alertMetrics(cleanRows);
 if(type==='Geofence Report')return geofenceMetrics(cleanRows);
 return [metric('records','Records',cleanRows.length,'blue'),metric('vehicles','Vehicles',unique(cleanRows),'green'),metric('period','Report period',summary?.from&&summary?.to?'Selected range':'N/A','navy',Boolean(summary?.from&&summary?.to))];
}

export function reportLegend(type){
 const canonical=reportDefinition(type).type;
 if(canonical==='RAG Report')return[{label:'Green: under 2 events / 100 km',tone:'green'},{label:'Amber: 2 to under 5',tone:'amber'},{label:'Red: 5 or more',tone:'red'},{label:'Not rated',tone:'gray'}];
 if(canonical==='Driver Behaviour Report')return[{label:'Recorded event',tone:'blue'},{label:'Harsh event',tone:'amber'},{label:'Overspeed',tone:'red'},{label:'Unavailable',tone:'gray'}];
 if(['Idle Report','Stops Report'].includes(canonical))return[{label:'Under 20 min',tone:'green'},{label:'20–59 min',tone:'amber'},{label:'60 min or longer',tone:'red'},{label:'Unavailable',tone:'gray'}];
 if(canonical==='Summary Report')return[{label:'Recorded data',tone:'green'},{label:'Information',tone:'blue'},{label:'GPS gap attention',tone:'amber'},{label:'Unavailable',tone:'gray'}];
 if(canonical==='Driver Overtime Report')return[{label:'Within duty schedule',tone:'green'},{label:'Overtime',tone:'amber'},{label:'Unavailable',tone:'gray'}];
 if(canonical==='Trip Report')return[{label:'Completed trip',tone:'green'},{label:'Distance and time',tone:'blue'},{label:'Unavailable',tone:'gray'}];
 if(canonical==='Fuel Report')return[{label:'Fuel increase',tone:'green'},{label:'Consumption',tone:'blue'},{label:'Reset / attention',tone:'amber'},{label:'Fuel decrease',tone:'red'},{label:'Unavailable',tone:'gray'}];
 if(canonical==='Doors Report')return[{label:'Closed',tone:'green'},{label:'Open',tone:'amber'},{label:'Unavailable',tone:'gray'}];
 if(canonical==='Alert Report')return[{label:'Resolved',tone:'green'},{label:'Information',tone:'blue'},{label:'Warning',tone:'amber'},{label:'Critical / open',tone:'red'},{label:'Unavailable',tone:'gray'}];
 if(canonical==='Geofence Report')return[{label:'Entry',tone:'green'},{label:'Exit / information',tone:'blue'},{label:'Attention',tone:'amber'},{label:'Violation / overspeed',tone:'red'},{label:'Unavailable',tone:'gray'}];
 return[{label:'Information',tone:'blue'},{label:'Normal',tone:'green'},{label:'Attention',tone:'amber'},{label:'Critical',tone:'red'},{label:'Unavailable',tone:'gray'}];
}

export function reportRowTone(type,key,value,row={}){
 const canonical=reportDefinition(type).type,text=normalizedText(value);
 if(value===null||value===undefined||value===''||text==='n/a'||text==='not available'||text==='not rated')return'gray';
 if(['severity','risk'].includes(key)){if(['critical','high','emergency','red'].includes(text))return'red';if(['warning','warn','medium','amber'].includes(text))return'amber';if(['low','info','information','blue'].includes(text))return'blue';if(['normal','good','green'].includes(text))return'green'}
 if(canonical==='RAG Report'&&key==='rag'){if(text==='green')return'green';if(text==='amber')return'amber';if(text==='red')return'red';return'gray'}
 if(canonical==='Driver Behaviour Report'&&['action','event'].includes(key)){const action=actionOf(row)||text;return action==='overspeed'?'red':action.startsWith('harsh-')?'amber':'blue'}
 if(key==='status'){if(['resolved','closed','completed','green'].includes(text))return'green';if(['warning','pending','acknowledged','amber'].includes(text))return'amber';if(['critical','failed','open','active','new','red'].includes(text))return'red';if(['info','blue'].includes(text))return'blue'}
 if(['Idle Report','Stops Report'].includes(canonical)&&['durationMin','durationSeconds'].includes(key)){const minutes=key==='durationSeconds'?(number(value)||0)/60:(number(value)||0);return minutes>=60?'red':minutes>=20?'amber':'green'}
 if(canonical==='Summary Report'&&key==='gaps')return(number(value)||0)>0?'amber':'green';
 if(canonical==='Driver Overtime Report'&&['overrunMinutes','overtimeHours','overtimeAmount'].includes(key))return(number(value)||0)>0?'amber':'green';
 if(canonical==='Fuel Report'&&['action','event'].includes(key)){const action=actionOf(row)||text;if(action==='increase')return'green';if(action==='decrease')return'red';if(action==='consumed'||action==='initial'||action==='rate-change')return'blue';if(action==='counter-reset')return'amber'}
 if(canonical==='Doors Report'&&['action','state','event'].includes(key)){const action=actionOf(row)||text;if(['close','closed'].includes(action)||text==='closed')return'green';if(['open','opened'].includes(action)||text==='open')return'amber'}
 if(canonical==='Geofence Report'&&['action','event'].includes(key)){const action=actionOf(row)||text;if(/entry|enter/.test(action))return'green';if(/exit|leave/.test(action))return'blue';if(/overspeed|violation|breach/.test(action))return'red';return'blue'}
 return'';
}

export function reportCellValue(type,key,value){
 if(value===null||value===undefined||value==='')return'N/A';
 if(key==='durationSeconds')return formatDurationSeconds(value);
 if(['durationMin','normalDrivingMinutes','overrunMinutes'].includes(key)){const numeric=number(value);return numeric===null?'N/A':fixed(numeric,numeric%1?2:0)}
 if(['distanceKm','averageKmh','maxKmh','overtimeHours'].includes(key)){const numeric=number(value);return numeric===null?String(value):fixed(numeric,numeric%1?2:0)}
 if(typeof value==='boolean')return value?'Yes':'No';
 return String(value);
}
