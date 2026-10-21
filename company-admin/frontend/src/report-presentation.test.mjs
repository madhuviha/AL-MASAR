import test from 'node:test';
import assert from 'node:assert/strict';
import {reportColumns,reportDisplayName,reportMetrics,reportRowTone} from './report-presentation.mjs';

const byKey=metrics=>Object.fromEntries(metrics.map(metric=>[metric.key,metric]));

test('uses requested public report names while preserving internal aliases',()=>{
 assert.equal(reportDisplayName('Summary Report'),'General Report');assert.equal(reportDisplayName('General Report'),'General Report');assert.equal(reportDisplayName('Doors Report'),'Door Report');assert.equal(reportDisplayName('Geofence Alert Report'),'Geofence Alert Report');
});
test('idle metrics use exact row durations and affected vehicles',()=>{
 const metrics=byKey(reportMetrics([{vehicle:'A',durationMin:10},{vehicle:'A',durationMin:20},{vehicle:'B',durationMin:30}],{type:'Idle Report'}));
 assert.equal(metrics.records.value,3);assert.equal(metrics.vehicles.value,2);assert.equal(metrics.total.value,'1h 00m');assert.equal(metrics.average.value,'20m');assert.equal(metrics.longest.value,'30m');
});
test('general metrics sum only available numeric data',()=>{
 const metrics=byKey(reportMetrics([{vehicle:'A',distanceKm:'12.5',durationMin:30,maxKmh:80,gaps:0},{vehicle:'B',distanceKm:7.5,durationMin:15,maxKmh:65,gaps:2}],{type:'Summary Report'}));
 assert.equal(metrics.distance.value,'20.0 km');assert.equal(metrics.duration.value,'45m');assert.equal(metrics.speed.value,'80.0 km/h');assert.equal(metrics.gaps.value,'2');
});
test('fuel metrics count normalized changes and never invent unsupported totals',()=>{
 const rows=[{vehicle:'A',action:'initial',delta:null,unit:'L'},{vehicle:'A',action:'consumed',delta:3,unit:'L'},{vehicle:'A',action:'increase',delta:10,unit:'L'},{vehicle:'B',action:'decrease',delta:-2,unit:'L'}],metrics=byKey(reportMetrics(rows,{type:'Fuel Report'}));
 assert.equal(metrics.records.value,3);assert.equal(metrics.consumed.value,1);assert.equal(metrics.totalConsumed.value,'3.00 L');assert.equal(metrics.increases.value,1);assert.equal(metrics.decreases.value,1);
 const unsupported=byKey(reportMetrics([{vehicle:'A',telemetry:'fuel',value:80}],{type:'Fuel Report'}));assert.equal(unsupported.totalConsumed.value,'N/A');assert.equal(unsupported.totalConsumed.supported,false);
});
test('rag cards count recorded ratings and safety events',()=>{
 const metrics=byKey(reportMetrics([
  {vehicle:'A',rag:'Green',harshAcceleration:1,harshBraking:0,harshCornering:0,overspeedEvents:0},
  {vehicle:'B',rag:'Amber',harshAcceleration:0,harshBraking:2,harshCornering:1,overspeedEvents:0},
  {vehicle:'C',rag:'Red',harshAcceleration:0,harshBraking:0,harshCornering:0,overspeedEvents:4},
  {vehicle:'D',rag:'Not rated'}
 ],{type:'RAG Report'}));
 assert.equal(metrics.assessed.value,3);assert.equal(metrics.green.value,1);assert.equal(metrics.amber.value,1);assert.equal(metrics.red.value,1);assert.equal(metrics.events.value,8);
});
test('door and alert cards come from normalized states',()=>{
 const doors=byKey(reportMetrics([{vehicle:'A',action:'open',state:'Open'},{vehicle:'A',action:'close',state:'Closed'}],{type:'Doors Report'}));assert.equal(doors.opened.value,1);assert.equal(doors.closed.value,1);assert.equal(reportRowTone('Doors Report','state','Open',{action:'open'}),'amber');
 const alerts=byKey(reportMetrics([{vehicle:'A',severity:'Critical',status:'Open'},{vehicle:'B',severity:'Warning',status:'Resolved'}],{type:'Alert Report'}));assert.equal(alerts.critical.value,1);assert.equal(alerts.warning.value,1);assert.equal(alerts.resolved.value,1);
});
test('declared columns are stable and unknown data is appended',()=>{
 const columns=reportColumns([{driver:'D',vehicle:'V',durationMin:2,custom:'x'}],'Trip Report').map(column=>column.key);assert.deepEqual(columns,['vehicle','driver','durationMin','custom']);
});
