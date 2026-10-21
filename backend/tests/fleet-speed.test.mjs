import assert from 'node:assert/strict';
import {trailLimit} from '../../company-admin/frontend/src/speed-trail.mjs';

const vehicle={id:7,local:{}};
assert.equal(trailLimit(vehicle,[],2,{fleetSpeedLimit:100}),100);
assert.equal(trailLimit(vehicle,[],2,{overspeedKmh:90}),90,'legacy company setting remains supported');
assert.equal(trailLimit({...vehicle,local:{speedLimit:80}},[],2,{fleetSpeedLimit:100}),80,'vehicle-specific limit overrides fleet default');
assert.equal(trailLimit(vehicle,[{type:'Overspeed',companyId:2,enabled:true,vehicleIds:[7],threshold:70}],2,{fleetSpeedLimit:100}),70,'active targeted rule remains the strictest assigned limit');
assert.equal(trailLimit(vehicle,[{type:'Overspeed',companyId:3,enabled:true,threshold:60}],2,{fleetSpeedLimit:100}),100,'another company rule is ignored');
console.log('Fleet speed limit fallback and vehicle/rule overrides passed.');
