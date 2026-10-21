import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMapAccess,availableMaps,defaultBaseMap,mapAccessDefinitions} from '../map-access.mjs';

test('existing accounts retain all maps by default',()=>{
 const access=normalizeMapAccess();
 const ids=availableMaps(access).map(map=>map.id);
 for(const id of ['osm-road','carto-liberty','carto-positron','carto-dark','open-topo','esri-street','esri-satellite','rail-electrification','rail-infrastructure','rail-maxspeed','rail-signals'])assert.ok(ids.includes(id),`${id} should remain available`);
 assert.equal(access.mapillary,true);
});

test('legacy Google map settings are ignored',()=>{
 const access=normalizeMapAccess({googleNormal:false,openStreetMap:true});
 assert.equal('googleRoad' in access,false);
 assert.equal('googleSatellite' in access,false);
 assert.equal(defaultBaseMap({mapProvider:'Google Maps'},access),'osm-road');
});

test('at least one base map is always available',()=>{
 const access=normalizeMapAccess(Object.fromEntries(mapAccessDefinitions.map(([key])=>[key,false])));
 assert.equal(access.openStreetMap,true);
 assert.deepEqual(availableMaps(access).map(x=>x.id),['osm-road']);
});

test('an allowed user map preference becomes the default',()=>{
 const access=normalizeMapAccess({openStreetMap:true,cartoDark:true,esriSatellite:false});
 assert.equal(defaultBaseMap({mapProvider:'OpenStreetMap'},access,'carto-dark'),'carto-dark');
 assert.equal(defaultBaseMap({mapProvider:'OpenStreetMap'},access,'google-road'),'osm-road');
});

test('keyed maps appear only after their browser credential is configured',()=>{
 const access=normalizeMapAccess();
 assert.equal(availableMaps(access).some(map=>map.id==='maptiler-streets'),false);
 assert.equal(availableMaps(access,{mapTilerKey:'configured'}).some(map=>map.id==='maptiler-streets'),true);
 assert.equal(availableMaps(access,{googleMapsKey:'configured'}).filter(map=>map.id.startsWith('google-')).length,0);
 assert.equal(availableMaps(access,{bingMapsKey:'configured'}).filter(map=>map.id.startsWith('bing-')).length,3);
 assert.equal(availableMaps(access,{yandexMapsKey:'configured'}).some(map=>map.id==='yandex-road'),true);
 assert.equal(availableMaps(access,{openMapTilesUrl:'https://tiles.example/{z}/{x}/{y}.png'}).some(map=>map.id==='openmaptiles-osm'),true);
});
