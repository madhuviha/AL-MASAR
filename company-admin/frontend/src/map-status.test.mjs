import test from 'node:test';
import assert from 'node:assert/strict';
import {latestCommunicationTime,mapStatus} from './map-status.mjs';

test('expired access is always classified as renewal required',()=>{
 const status=mapStatus({accessStatus:'expired',position:null},{},Date.now());
 assert.equal(status.group,'expired');
 assert.equal(status.gps,'Renewal required');
});

test('a last-known invalid GPS position remains classifiable and visible',()=>{
 const now=Date.now();
 const status=mapStatus({device:{lastUpdate:new Date(now-60000).toISOString()},position:{valid:false,latitude:25.2891283,longitude:51.5383316,serverTime:new Date(now-3600000).toISOString(),fixTime:new Date(now-3600000).toISOString(),speed:null,attributes:{}}},{offlineMinutes:300},now);
 assert.equal(status.gps,'No GPS Signal');
 assert.equal(status.group,'parked');
});

test('defaults to Currently Untracked after fifteen minutes without communication',()=>{
 const now=Date.now();
 const status=mapStatus({device:{lastUpdate:new Date(now-16*60000).toISOString()},position:{valid:true,latitude:25.2,longitude:51.5,serverTime:new Date(now-16*60000).toISOString(),fixTime:new Date(now-16*60000).toISOString(),speed:0,attributes:{ignition:false}}},{offlineMinutes:300},now);
 assert.equal(status.group,'untracked');
});

test('latest communication prefers a fresh heartbeat over an older GPS position',()=>{
 const now=Date.now();
 const heartbeat=new Date(now-3*60000).toISOString();
 const positionTime=new Date(now-4*60*60000).toISOString();
 assert.equal(latestCommunicationTime({device:{lastUpdate:heartbeat},position:{serverTime:positionTime}}),heartbeat);
});
