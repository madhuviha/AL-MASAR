import assert from 'node:assert/strict';
import {dutyDriving} from '../driver-duty.mjs';
const d={id:'test-driver',duty:{enabled:true,start:'08:00',end:'17:00',days:[0],timezone:'UTC',rate:20,currency:'QAR'}};
const p=t=>({deviceTime:'2026-09-13T'+t+':00Z',speed:20,current_driver:{driver_id:d.id},attributes:{}});
let r=dutyDriving([p('07:59'),p('08:01')],d);assert.equal(r.overrunMinutes,1);assert.equal(r.normalDrivingMinutes,1);
r=dutyDriving([p('17:00'),p('17:03')],d);assert.equal(r.overrunMinutes,3);assert.equal(r.overtimeAmount,1);
assert.equal(dutyDriving([p('07:00'),p('08:00')],d).overrunMinutes,0,'GPS gap not billed');
assert.equal(dutyDriving([p('07:59'),p('08:01')],{id:d.id,duty:{...d.duty,start:'22:00',end:'06:00',days:[6]}}).overrunMinutes,2);
console.log('Duty boundary, overtime rate and signal-gap exclusions passed.');
