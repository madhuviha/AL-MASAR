import test from 'node:test';
import assert from 'node:assert/strict';
import {alertSemanticKey,dedupeAlertEvents,normalizeAlertRules,ruleTargetsVehicle} from '../alert-rules.mjs';
import {evaluateAlerts} from '../rules.mjs';
import {pushOutboxIdentity} from '../mobile-push.mjs';

const company={id:1};
const vehicle=(serverTime,ignition=true)=>({
 id:7,
 name:'Khawla',
 state:'parked',
 speed:0,
 position:{latitude:25.25,longitude:51.5,serverTime,attributes:{ignition}}
});
const baseStore=rules=>({
 alerts:[],
 drivers:[],
 localGeofences:[],
 alertRules:rules,
 ruleRuntime:{},
 geofenceRuntime:{}
});

test('same-type rules merge vehicle scope and keep latest editable settings',()=>{
 const merged=normalizeAlertRules([
  {id:'old',companyId:1,type:'Overspeed',threshold:80,vehicleIds:['7'],allVehicles:false,enabled:true,inApp:true,email:false},
  {id:'new',companyId:1,type:'overspeed',threshold:100,vehicleIds:['8'],allVehicles:false,enabled:false,inApp:false,email:true}
 ]);
 assert.equal(merged.length,1);
 assert.equal(merged[0].id,'new');
 assert.equal(merged[0].threshold,100);
 assert.equal(merged[0].enabled,true);
 assert.equal(merged[0].inApp,true);
 assert.equal(merged[0].email,true);
 assert.equal(merged[0].allVehicles,false);
 assert.deepEqual(new Set(merged[0].vehicleIds.map(String)),new Set(['7','8']));
});

test('explicit allVehicles false with no vehicle IDs targets no vehicles',()=>{
 const rule={id:'none',companyId:1,type:'Ignition ON',allVehicles:false,vehicleIds:[],enabled:true};
 assert.equal(ruleTargetsVehicle(rule,7),false);
 const result=evaluateAlerts(baseStore([rule]),company,[vehicle('2026-10-16T08:00:00.000Z')]);
 assert.equal(result.alerts.length,0);
});

test('legacy empty vehicle selection continues to mean all vehicles',()=>{
 assert.equal(ruleTargetsVehicle({vehicleIds:[]},7),true);
 assert.equal(ruleTargetsVehicle({vehicleIds:['7']},7),true);
 assert.equal(ruleTargetsVehicle({vehicleIds:['8']},7),false);
});

test('overlapping same-type rules emit one web and push alert event',()=>{
 const at='2026-10-16T08:00:00.000Z';
 const result=evaluateAlerts(baseStore([
  {id:'all',companyId:1,type:'Ignition ON',allVehicles:true,vehicleIds:[],enabled:true},
  {id:'khawla',companyId:1,type:'Ignition ON',allVehicles:false,vehicleIds:['7'],enabled:true}
 ]),company,[vehicle(at)]);
 assert.equal(result.alerts.length,1);
 assert.equal(result.alerts[0].vehicleId,7);
 assert.equal(result.alerts[0].type,'Ignition ON');
});

test('semantic event dedupe ignores rule ID and threshold changes',()=>{
 const at='2026-10-16T08:00:00.000Z';
 const moving={...vehicle(at),state:'moving',speed:120};
 const first=evaluateAlerts(baseStore([
  {id:'speed-80',companyId:1,type:'Overspeed',threshold:80,allVehicles:true,vehicleIds:[],enabled:true}
 ]),company,[moving]);
 const replay=evaluateAlerts({
  ...first,
  alertRules:[{id:'speed-100',companyId:1,type:'Overspeed',threshold:100,allVehicles:true,vehicleIds:[],enabled:true}],
  ruleRuntime:{}
 },company,[moving]);
 assert.equal(replay.alerts.length,1);
});

test('a later condition episode remains a legitimate new alert',()=>{
 const rule={id:'ignition',companyId:1,type:'Ignition ON',allVehicles:true,vehicleIds:[],enabled:true};
 const first=evaluateAlerts(baseStore([rule]),company,[vehicle('2026-10-16T08:00:00.000Z',true)]);
 const reset=evaluateAlerts(first,company,[vehicle('2026-10-16T08:01:00.000Z',false)]);
 const later=evaluateAlerts(reset,company,[vehicle('2026-10-16T08:02:00.000Z',true)]);
 assert.equal(later.alerts.length,2);
 assert.notEqual(later.alerts[0].eventKey,later.alerts[1].eventKey);
});

test('missing GT06 ignition samples do not restart an active ignition episode',()=>{
 const rule={id:'ignition',companyId:1,type:'Ignition ON',allVehicles:true,vehicleIds:[],enabled:true};
 const first=evaluateAlerts(baseStore([rule]),company,[vehicle('2026-10-17T06:31:14.000Z',true)]);
 const missing=evaluateAlerts(first,company,[{
  ...vehicle('2026-10-17T06:31:30.000Z',true),
  state:'moving',speed:45,
  position:{latitude:25.25,longitude:51.5,serverTime:'2026-10-17T06:31:30.000Z',attributes:{motion:true}}
 }]);
 const heartbeat=evaluateAlerts(missing,company,[vehicle('2026-10-17T06:34:14.000Z',true)]);
 assert.equal(first.alerts.length,1);
 assert.equal(missing.alerts.length,1);
 assert.equal(heartbeat.alerts.length,1);
 assert.equal(heartbeat.ruleRuntime['ignition:7'].fired,true);
});

test('temporary offline state does not restart an active ignition episode',()=>{
 const rule={id:'ignition',companyId:1,type:'Ignition ON',allVehicles:true,vehicleIds:[],enabled:true};
 const first=evaluateAlerts(baseStore([rule]),company,[vehicle('2026-10-17T06:31:14.000Z',true)]);
 const offline=evaluateAlerts(first,company,[{
  ...vehicle('2026-10-17T06:33:14.000Z',true),state:'offline'
 }]);
 const reconnected=evaluateAlerts(offline,company,[vehicle('2026-10-17T06:34:14.000Z',true)]);
 assert.equal(reconnected.alerts.length,1);
 assert.equal(reconnected.ruleRuntime['ignition:7'].fired,true);
});

test('missing GT06 ignition samples do not restart an active ignition-off episode',()=>{
 const rule={id:'ignition-off',companyId:1,type:'Ignition OFF',allVehicles:true,vehicleIds:[],enabled:true};
 const first=evaluateAlerts(baseStore([rule]),company,[vehicle('2026-10-17T08:00:00.000Z',false)]);
 const missing=evaluateAlerts(first,company,[{
  ...vehicle('2026-10-17T08:00:30.000Z',false),
  position:{latitude:25.25,longitude:51.5,serverTime:'2026-10-17T08:00:30.000Z',attributes:{motion:false}}
 }]);
 const heartbeat=evaluateAlerts(missing,company,[vehicle('2026-10-17T08:03:00.000Z',false)]);
 assert.equal(heartbeat.alerts.length,1);
 assert.equal(heartbeat.ruleRuntime['ignition-off:7'].fired,true);
});

test('stored web alerts dedupe by semantic event rather than rule-generated ID',()=>{
 const common={companyId:1,vehicleId:7,type:'Ignition ON',eventTime:'2026-10-16T08:00:00.000Z'};
 const rows=[
  {...common,id:'first',eventKey:'legacy-rule-one'},
  {...common,id:'second',eventKey:'legacy-rule-two'},
  {...common,id:'later',eventKey:'legacy-rule-three',eventTime:'2026-10-16T08:02:00.000Z'}
 ];
 const result=dedupeAlertEvents(rows);
 assert.deepEqual(result.map(alert=>alert.id),['first','later']);
 assert.notEqual(alertSemanticKey(rows[0]),alertSemanticKey(rows[2]));
});

test('mobile outbox keeps the original alert ID and adds a shared semantic guard',()=>{
 const common={companyId:1,vehicleId:7,type:'Ignition ON',eventTime:'2026-10-16T08:00:00.000Z'};
 const first=pushOutboxIdentity({...common,id:'first',eventKey:'legacy-rule-one'});
 const duplicate=pushOutboxIdentity({...common,id:'second',eventKey:'legacy-rule-two'});
 assert.equal(first.alertId,'legacy-rule-one');
 assert.equal(duplicate.alertId,'legacy-rule-two');
 assert.equal(first.semanticKey,duplicate.semanticKey);
});
