import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport} from '../report-engine.mjs';

test('multi-vehicle reports use bounded concurrency',async()=>{
 let active=0,maximum=0;
 const api={route:async deviceId=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,15));active--;return[{deviceId,valid:true,latitude:25,longitude:51,fixTime:'2026-09-30T08:00:00Z',speed:0,attributes:{}}]}};
 const vehicles=Array.from({length:9},(_,index)=>({id:index+1,deviceId:index+1,name:'Vehicle '+(index+1)}));
 const rows=await buildReport({type:'Summary Report',vehicles,store:{},from:'2026-09-30T00:00:00Z',to:'2026-09-30T23:59:00Z',driverId:'all'},api);
 assert.equal(rows.length,9);
 assert.ok(maximum>1);
 assert.ok(maximum<=4);
});
