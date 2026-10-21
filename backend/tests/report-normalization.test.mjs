import test from 'node:test';
import assert from 'node:assert/strict';
import {
 canonicalReportType,dedupeGeofenceRows,detailedBehaviourEvents,doorTransitions,fuelChanges,
 normalizeReportPoints,reportBoolean,stationaryIntervals
} from '../report-normalization.mjs';
import {buildReport} from '../report-engine.mjs';
import {routePoints} from '../history.mjs';

const point=(minute,speed,attributes={})=>({fixTime:`2026-10-07T08:${String(minute).padStart(2,'0')}:00Z`,latitude:25+minute/1000,longitude:51,speed,valid:true,attributes});

test('report aliases remain compatible while presenting the requested names',()=>{
 assert.equal(canonicalReportType('General Report'),'Summary Report');
 assert.equal(canonicalReportType('Geofence Alert Report'),'Geofence Report');
 assert.equal(canonicalReportType('Door Report'),'Doors Report');
 assert.equal(canonicalReportType('RAG Report'),'RAG Report');
});

test('stationary periods require normalized, confirmed ignition state',()=>{
 assert.equal(reportBoolean('ON'),true);assert.equal(reportBoolean('0'),false);assert.equal(reportBoolean('unknown'),null);
 const points=normalizeReportPoints([
  point(0,0,{ignition:'true'}),point(3,0,{ignition:1}),point(4,10,{ignition:true}),
  point(5,0,{ignition:'false'}),point(7,0,{ignition:0}),point(8,0,{}),point(10,0,{})
 ]);
 const idle=stationaryIntervals(points,{kind:'Idle',minimumSeconds:120}),stops=stationaryIntervals(points,{kind:'Stop'});
 assert.equal(idle.length,1);assert.equal(idle[0].durationSeconds,180);assert.equal(idle[0].startPoint,points[0]);assert.equal(idle[0].endPoint,points[1]);
 assert.equal(stops.length,1);assert.equal(stops[0].durationSeconds,120);assert.equal(stops[0].startPoint,points[3]);assert.equal(stops[0].endPoint,points[4]);
});

test('GT06 duplicate fix records keep the valid GPS point and merge status telemetry',()=>{
 const fix='2026-10-07T08:00:00Z';
 const rows=normalizeReportPoints([
  {deviceId:10,fixTime:fix,serverTime:'2026-10-07T08:00:01Z',latitude:25.25,longitude:51.5,speed:0,valid:true,attributes:{sat:8}},
  {deviceId:10,fixTime:fix,serverTime:'2026-10-07T08:00:05Z',latitude:null,longitude:null,speed:40,valid:false,attributes:{ignition:true,batteryLevel:80}},
  {deviceId:10,fixTime:'2026-10-07T08:02:01Z',serverTime:'2026-10-07T08:02:02Z',latitude:25.25,longitude:51.5,speed:0,valid:true,attributes:{}},
  {deviceId:10,fixTime:'2026-10-07T08:03:01Z',serverTime:'2026-10-07T08:03:02Z',latitude:null,longitude:null,speed:0,valid:false,attributes:{ignition:true}},
  {deviceId:10,fixTime:'2026-10-07T08:04:02Z',serverTime:'2026-10-07T08:04:03Z',latitude:25.26,longitude:51.51,speed:4,valid:true,attributes:{}}
 ],{protocol:'H9'});
 const points=routePoints(rows);
 assert.equal(rows.length,4);
 assert.equal(points.length,3);
 assert.equal(points[0].latitude,25.25);assert.equal(points[0].longitude,51.5);assert.equal(points[0].speed,0);assert.equal(points[0].valid,true);
 assert.equal(points[0].attributes.ignition,true);assert.equal(points[0].attributes.batteryLevel,80);assert.equal(points[0].attributes.sat,8);
 const idle=stationaryIntervals(points,{kind:'Idle',minimumSeconds:60,ignitionCarryMs:5*60000,gapMs:5*60000});
 assert.equal(idle.length,1);assert.equal(idle[0].durationSeconds,121);
 assert.equal(idle[0].startPoint.latitude,25.25);assert.equal(idle[0].endPoint.latitude,25.25);
});

test('ignition carry requires a confirmed value and expires at the configured gap',()=>{
 const missing=[point(0,0,{}),point(2,0,{}),point(4,5,{})];
 assert.equal(stationaryIntervals(missing,{kind:'Idle',minimumSeconds:60,ignitionCarryMs:5*60000}).length,0);
 const expired=[point(0,0,{ignition:true}),point(10,0,{}),point(11,5,{})];
 assert.equal(stationaryIntervals(expired,{kind:'Idle',minimumSeconds:60,ignitionCarryMs:5*60000,gapMs:15*60000}).length,0);
});

test('fuel readings emit only baseline and real changes with directional deltas',()=>{
 const rows=fuelChanges([
  point(0,0,{fuel:50,fuelUsed:10,fuelUnit:'L'}),point(1,0,{fuel:50,fuelUsed:10,fuelUnit:'L'}),
  point(2,0,{fuel:48,fuelUsed:11.5,fuelUnit:'L'}),point(3,0,{fuel:52,fuelUsed:.5,fuelUnit:'L'})
 ]);
 assert.equal(rows.filter(row=>row.source==='fuel').length,3);
 assert.deepEqual(rows.filter(row=>row.source==='fuel').map(row=>row.action),['initial','decrease','increase']);
 assert.equal(rows.find(row=>row.action==='consumed').delta,1.5);
 assert.ok(rows.find(row=>row.action==='counter-reset').delta<0);
 assert.ok(rows.every(row=>row.unit==='L'));
});

test('door report emits transitions rather than repeated samples',()=>{
 const rows=doorTransitions([point(0,0,{door:false}),point(1,0,{door:0}),point(2,0,{door:'open'}),point(3,0,{door:true}),point(4,0,{door:'closed'})]);
 assert.deepEqual(rows.map(row=>[row.action,row.state]),[['open','Open'],['close','Closed']]);
});

test('driver behaviour events are detailed and deduplicated',()=>{
 const events=[
  {id:1,eventTime:'2026-10-07T08:00:00Z',type:'deviceOverspeed'},
  {id:1,eventTime:'2026-10-07T08:00:00Z',type:'deviceOverspeed'},
  {id:2,eventTime:'2026-10-07T08:01:00Z',type:'alarm',attributes:{alarm:'hardBraking'}},
  {id:3,eventTime:'2026-10-07T08:02:00Z',type:'ignitionOn'}
 ];
 assert.deepEqual(detailedBehaviourEvents(events).map(row=>row.action),['overspeed','harsh-braking']);
});

test('tracker and local copies of one geofence transition collapse',()=>{
 const rows=dedupeGeofenceRows([
  {_vehicleId:7,_timeMs:10000,_eventKey:'tracker:1',action:'entry',geofence:'42'},
  {_vehicleId:7,_timeMs:12000,_eventKey:'local:1',action:'entry',geofence:'Depot'},
  {_vehicleId:7,_timeMs:20000,_eventKey:'local:2',action:'exit',geofence:'Depot'}
 ]);
 assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.action),['entry','exit']);
});

test('scheduled engine supports General alias, RAG summary and detailed behaviour separately',async()=>{
 const route=[point(0,10,{ignition:true}),point(5,10,{ignition:true})],events=[{id:5,deviceId:10,eventTime:'2026-10-07T08:02:00Z',type:'deviceOverspeed'}];
 const api={route:async()=>route,events:async()=>events,trips:async()=>[]},base={vehicles:[{id:1,deviceId:10,name:'Truck'}],store:{drivers:[],alerts:[],maintenance:[],sensorConfigs:[]},from:'2026-10-07T08:00:00Z',to:'2026-10-07T09:00:00Z',driverId:'all'};
 const general=await buildReport({...base,type:'General Report'},api),rag=await buildReport({...base,type:'RAG Report'},api),behaviour=await buildReport({...base,type:'Driver Behaviour Report'},api);
 assert.equal(general.length,1);assert.ok(Object.hasOwn(general[0],'distanceKm'));
 assert.equal(rag.length,1);assert.ok(Object.hasOwn(rag[0],'rag'));assert.equal(rag[0].overspeedEvents,1);
 assert.equal(behaviour.length,1);assert.equal(behaviour[0].action,'overspeed');assert.ok(!Object.hasOwn(behaviour[0],'rag'));
});
