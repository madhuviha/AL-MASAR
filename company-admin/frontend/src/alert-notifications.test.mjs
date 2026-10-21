import test from 'node:test';
import assert from 'node:assert/strict';
import {alertKeySet,alertLogicalKey,dedupeAlerts,newAlerts,normalizeAlertRules,sourceAlertIds,unreadAlertCount} from './alert-notifications.mjs';

const event=(overrides={})=>({
 id:'alert-1',companyId:7,vehicleId:12,vehicleName:'Khawla',type:'Ignition ON',
 eventTime:'2026-10-16T06:00:00.000Z',createdAt:'2026-10-16T06:00:01.000Z',
 eventKey:'legacy-key-a',ruleId:'rule-a',status:'New',read:false,...overrides
});

test('dedupes the same semantic event even when legacy event keys and rule ids differ',()=>{
 const rows=dedupeAlerts([
  event(),
  event({id:'alert-2',eventKey:'legacy-key-b',ruleId:'rule-b',eventTime:'2026-10-16T09:00:00.000+03:00'})
 ]);
 assert.equal(rows.length,1);
 assert.deepEqual(sourceAlertIds(rows[0]),['alert-1','alert-2']);
 assert.deepEqual(rows[0]._sourceRuleIds,['rule-a','rule-b']);
});

test('keeps legitimate exact-time events separate and falls back to eventKey for incomplete rows',()=>{
 assert.notEqual(alertLogicalKey(event()),alertLogicalKey(event({eventTime:'2026-10-16T06:00:00.001Z'})));
 assert.equal(alertLogicalKey({id:'one',eventKey:'server-key'}),'event:server-key');
 assert.equal(dedupeAlerts([{id:'one',eventKey:'server-key'},{id:'two',eventKey:'server-key'}]).length,1);
});

test('popup detection remembers logical events rather than changing database ids',()=>{
 const original=event(),seen=alertKeySet([original]);
 const duplicate=event({id:'alert-2',eventKey:'different-legacy-key',ruleId:'rule-b'});
 assert.equal(newAlerts([duplicate],seen,[{id:'rule-a',inApp:true},{id:'rule-b',inApp:true}]).length,0);
 assert.equal(newAlerts([event({id:'alert-3',eventTime:'2026-10-16T06:01:00.000Z'})],seen,[]).length,1);
});

test('counts duplicate unread rows once and stays unread until every copy is read',()=>{
 const rows=[event({read:true}),event({id:'alert-2',eventKey:'legacy-key-b',read:false})];
 assert.equal(unreadAlertCount(rows,7),1);
 assert.equal(unreadAlertCount(rows.map(row=>({...row,read:true})),7),0);
});

test('normalizes duplicate same-type rules into the persisted engine shape',()=>{
 const normalized=normalizeAlertRules([
  {id:'legacy',companyId:7,type:'Ignition ON',allVehicles:false,vehicleIds:[],enabled:true,name:'ACC',inApp:true,email:false},
  {id:'current',companyId:7,type:'ignition on',allVehicles:false,vehicleIds:[12],enabled:false,name:'Khawla ignition',inApp:false,email:true}
 ]);
 assert.equal(normalized.length,1);
 assert.equal(normalized[0].id,'current');
 assert.equal(normalized[0].enabled,true);
 assert.equal(normalized[0].inApp,true);
 assert.equal(normalized[0].email,true);
 assert.equal(normalized[0].allVehicles,false);
 assert.deepEqual(normalized[0].vehicleIds,[12]);
 assert.equal(normalized[0].name,'Khawla ignition');
});

