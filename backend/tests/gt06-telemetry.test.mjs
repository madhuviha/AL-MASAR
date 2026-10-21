import test from 'node:test';
import assert from 'node:assert/strict';
import {gt06AutomaticParameters,isGt06Family,normalizeProtocolAttributes,normalizeProtocolPosition} from '../protocol-telemetry.mjs';

test('GT06 aliases normalize every supported parameter family without losing raw fields',()=>{
 const raw={acc:'1',movement:0,charging:'true',immobilized:1,externalVoltage:'13.8',batteryVoltage:'3.91',batteryPercent:'88',signal:'4',sat:'12',odometer:'12345',engineHours:'7200000',temp1:'24.5',fuelLevel:'63',driverId:1234,alarmType:'powerCut',vendorField:'kept'};
 const a=normalizeProtocolAttributes(raw,'GT06');
 assert.deepEqual({ignition:a.ignition,motion:a.motion,charge:a.charge,blocked:a.blocked}, {ignition:true,motion:false,charge:true,blocked:true});
 assert.equal(a.power,13.8);assert.equal(a.battery,3.91);assert.equal(a.batteryLevel,88);assert.equal(a.rssi,4);assert.equal(a.satellites,12);
 assert.equal(a.totalDistance,12345);assert.equal(a.odometer,12345);assert.equal(a.hours,7200000);assert.equal(a.temperature,24.5);assert.equal(a.fuel,63);
 assert.equal(a.driverUniqueId,'1234');assert.equal(a.alarm,'powerCut');assert.equal(a.vendorField,'kept');
});

test('canonical GT06 values win over aliases and missing readings stay missing',()=>{
 const a=normalizeProtocolAttributes({ignition:false,acc:true,power:12.4,externalVoltage:14.2},'gt06');
 assert.equal(a.ignition,false);assert.equal(a.power,12.4);assert.equal('battery' in a,false);assert.equal('rssi' in a,false);
});

test('non-GT06 protocols are preserved without protocol-specific inference',()=>{
 assert.deepEqual(normalizeProtocolAttributes({acc:1,vendor:2},'teltonika'),{acc:1,vendor:2});
});

test('Teltonika and mapped reader aliases expose one canonical iButton value',()=>{
 const a=normalizeProtocolAttributes({driver_id:'470000011D7BB201'},'Teltonika');
 assert.equal(a.driverUniqueId,'470000011D7BB201');
 assert.equal(a.driverIdentifier,'470000011D7BB201');
 const b=normalizeProtocolAttributes({iButtonId:'4200000117213601'},'FMC130');
 assert.equal(b.driverUniqueId,'4200000117213601');
});

test('history positions use the same GT06 normalization and parameter catalogue is unique',()=>{
 const p=normalizeProtocolPosition({latitude:25,longitude:51,attributes:{acc:1,sat:9}},'GT06');
 assert.equal(p.attributes.ignition,true);assert.equal(p.attributes.satellites,9);
 const keys=gt06AutomaticParameters.map(([,key])=>key);assert.equal(new Set(keys).size,keys.length);
});

test('GT06 family labels and the tracker-reported protocol enable the same normalization',()=>{
 for(const label of ['GT06','H9','GX06','GT06 / H9 / GX06'])assert.equal(isGt06Family(label),true);
 assert.equal(isGt06Family('Teltonika'),false);
 assert.equal(normalizeProtocolPosition({attributes:{terminalInfo:0x4e}},'H9').attributes.ignition,true);
 assert.equal(normalizeProtocolPosition({protocol:'gt06',attributes:{terminalInfo:0x4c}},'Other').attributes.ignition,false);
});

test('GT06 external power alias is decoded without inventing a missing reading',()=>{
 assert.equal(normalizeProtocolAttributes({externalPower:'13.72'},'GT06').power,13.72);
 assert.equal('power' in normalizeProtocolAttributes({batteryLevel:80},'GT06'),false);
});

test('stationary GT06 without ignition follows communication thresholds in both portals',async()=>{
 const {mapStatus:companyStatus}=await import('../../company-admin/frontend/src/map-status.mjs');
 const {mapStatus:superStatus}=await import('../../super-admin/frontend/src/map-status.mjs');
 const now=Date.parse('2026-09-22T18:00:00Z');
 const vehicle={device:{lastUpdate:new Date(now).toISOString()},position:{latitude:25.28,longitude:51.53,serverTime:new Date(now-3600000).toISOString(),fixTime:new Date(now-3600000).toISOString(),speed:0,attributes:{}}};
 const settings={untrackedMinutes:15,offlineMinutes:60};
 for(const status of [companyStatus,superStatus]){
  assert.equal(status(vehicle,settings,now).group,'parked');
  assert.equal(status(vehicle,settings,now).gps,'No GPS Signal');
  assert.equal(status(vehicle,settings,now+16*60000).group,'untracked');
  assert.equal(status(vehicle,settings,now+61*60000).group,'offline');
 }
});

test('GT06 automatic readings stay basic while raw optional parameters remain available',()=>{
 assert.deepEqual(gt06AutomaticParameters.map(([,key])=>key),['valid','speed','ignition']);
 const attributes=normalizeProtocolAttributes({acc:1,externalVoltage:13.8,vendorByte:7},'GT06');
 assert.equal(attributes.power,13.8);
 assert.equal(attributes.vendorByte,7);
});

test('R12 heartbeat terminal status supplies ACC only when ignition is absent',()=>{
 assert.equal(normalizeProtocolAttributes({terminalInfo:0x4e},'GT06').ignition,true);
 assert.equal(normalizeProtocolAttributes({terminalInfo:0x4c},'GT06').ignition,false);
 assert.equal(normalizeProtocolAttributes({terminalInfo:0x4e,ignition:false},'GT06').ignition,false);
 assert.equal('ignition' in normalizeProtocolAttributes({status:0x4e},'GT06'),false);
 assert.deepEqual(normalizeProtocolAttributes({terminalInfo:0x4e},'Teltonika'),{terminalInfo:0x4e});
});

test('a missing GPS fix does not override configured communication durations',async()=>{
 const {mapStatus}=await import('../../company-admin/frontend/src/map-status.mjs');
 const now=Date.parse('2026-09-22T18:00:00Z');
 const vehicle={device:{lastUpdate:new Date(now).toISOString()},position:{latitude:null,longitude:null,speed:0,attributes:{}}};
 const settings={untrackedMinutes:15,offlineMinutes:60};
 assert.equal(mapStatus(vehicle,settings,now).group,'parked');
 assert.equal(mapStatus(vehicle,settings,now).gps,'No position received');
 assert.equal(mapStatus(vehicle,settings,now+16*60000).group,'untracked');
 assert.equal(mapStatus(vehicle,settings,now+61*60000).group,'offline');
});

test('stale ignition-on samples remain Idle until the untracked threshold',async()=>{
 const {mapStatus}=await import('../../company-admin/frontend/src/map-status.mjs');
 const now=Date.parse('2026-09-22T18:00:00Z');
 const vehicle={device:{lastUpdate:new Date(now-8*60000).toISOString()},position:{speed:0,serverTime:new Date(now-8*60000).toISOString(),attributes:{ignition:true,motion:false}}};
 const settings={untrackedMinutes:15,offlineMinutes:60,freshnessSeconds:120};
 assert.equal(mapStatus(vehicle,settings,now).group,'idle');
 assert.equal(mapStatus(vehicle,settings,now+8*60000).group,'untracked');
});
