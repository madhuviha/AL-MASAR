import assert from'node:assert/strict';
import{buildBragRecord,bragSummary,sanitizeBragSettings}from'../brag-report.mjs';

const settings=sanitizeBragSettings({thresholds:{blueMin:90,greenMin:75,amberMin:60},seatbelt:{greenMin:95,amberMin:80},penalties:{overspeed:2,severeOverspeed:5,harshAcceleration:2,harshBraking:2,harshCornering:2,seatbeltViolation:3,excessiveIdlePerHour:1,afterHours:2,driverOverrun:3,geofenceViolation:2}});
assert.throws(()=>sanitizeBragSettings({thresholds:{blueMin:75,greenMin:90,amberMin:60}}),/descend/);
assert.deepEqual(settings.logoModes,{supplier:'platform',contractor:'company',contractCompany:'custom'});
assert.equal(sanitizeBragSettings({logos:{supplier:'data:image/png;base64,abc'}}).logoModes.supplier,'custom');
assert.equal(sanitizeBragSettings({logoModes:{supplier:'invalid'}}).logoModes.supplier,'platform');
const route=[
 {fixTime:'2026-09-01T08:00:00Z',latitude:25.2,longitude:51.5,speed:20,attributes:{seatbelt:true},current_driver:{driver_id:7,name:'Ahmed Ali'}},
 {fixTime:'2026-09-01T08:05:00Z',latitude:25.21,longitude:51.51,speed:20,attributes:{seatbelt:true},current_driver:{driver_id:7,name:'Ahmed Ali'}},
 {fixTime:'2026-09-01T08:10:00Z',latitude:25.22,longitude:51.52,speed:0,attributes:{seatbelt:false,ignition:true},current_driver:{driver_id:7,name:'Ahmed Ali'}},
 {fixTime:'2026-09-01T08:15:00Z',latitude:25.22,longitude:51.52,speed:0,attributes:{seatbelt:false,ignition:true},current_driver:{driver_id:7,name:'Ahmed Ali'}}
];
const events=[
 {id:1,type:'deviceOverspeed',eventTime:'2026-09-01T08:03:00Z',attributes:{speed:90,speedLimit:80}},
 {id:2,type:'harshBraking',eventTime:'2026-09-01T08:04:00Z'},
 {id:3,type:'seatbeltViolation',eventTime:'2026-09-01T08:08:00Z'}
];
const row=buildBragRecord({vehicle:{id:11,name:'QTR 4821',plate_number:'QTR 4821',imei:'123',company_id:3,company_name:'AL MASAR',metadata:{}},route,events,settings});
assert.equal(row.score,93);
assert.equal(row.bragStatus,'Blue');
assert.equal(row.overspeedCount,1);
assert.equal(row.harshBrakingCount,1);
assert.equal(row.seatbeltCompliancePercent,50);
assert.deepEqual(row.driverIds,['7']);
assert.equal(row.violations.length,3);
assert.deepEqual(bragSummary([row],settings).counts,{Blue:1,Green:0,Amber:0,Red:0});
console.log('BRAG scoring, thresholds, driver mapping and summary passed.');
