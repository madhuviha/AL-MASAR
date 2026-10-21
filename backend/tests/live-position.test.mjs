import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLivePosition} from '../live-position.mjs';

test('uses the current valid GPS fix',()=>{
 const result=resolveLivePosition({valid:true,latitude:25.2,longitude:51.5,course:90,fixtime:'current'});
 assert.equal(result.source,'current');
 assert.equal(result.latitude,25.2);
 assert.equal(result.fixTime,'current');
});

test('keeps the last valid location when the newest packet has an invalid GPS fix',()=>{
 const result=resolveLivePosition({valid:false,latitude:0,longitude:0,last_valid_latitude:25.2891283,last_valid_longitude:51.5383316,last_valid_fixtime:'last-valid'});
 assert.equal(result.source,'last_valid');
 assert.equal(result.latitude,25.2891283);
 assert.equal(result.longitude,51.5383316);
 assert.equal(result.fixTime,'last-valid');
});

test('never invents a location when neither fix is usable',()=>{
 const result=resolveLivePosition({valid:false,latitude:0,longitude:0,last_valid_latitude:null,last_valid_longitude:null});
 assert.equal(result.available,false);
 assert.equal(result.latitude,null);
});
