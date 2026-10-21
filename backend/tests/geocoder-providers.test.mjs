import test from 'node:test';
import assert from 'node:assert/strict';
import {requestReverseGeocode} from '../google-geocoding.mjs';

test('Geoapify reverse geocoding uses the server key and returns its formatted address',async()=>{
 let request;
 const http={get:async(url,options)=>{request={url,options};return {data:{features:[{properties:{formatted:'Barwa Madinatna, Al Wakrah, Qatar'}}]}}}};
 const result=await requestReverseGeocode('geoapify',25.2017,51.54934,{geoapifyKey:'server-secret'},http);
 assert.equal(result.address,'Barwa Madinatna, Al Wakrah, Qatar');
 assert.equal(result.provider,'geoapify');
 assert.equal(request.options.params.apiKey,'server-secret');
});

test('Nominatim supports a self-hosted endpoint without an API key',async()=>{
 let request;
 const http={get:async(url,options)=>{request={url,options};return {data:{display_name:'Street 1, Industrial Area, Ar Rayyan, Qatar'}}}};
 const result=await requestReverseGeocode('nominatim',25.2,51.4,{nominatimApiUrl:'https://geocoder.example.test/'},http);
 assert.equal(result.address,'Street 1, Industrial Area, Ar Rayyan, Qatar');
 assert.equal(request.url,'https://geocoder.example.test/reverse');
 assert.match(request.options.headers['User-Agent'],/INVIHA-Track/);
});

test('a keyed provider fails clearly when its server credential is missing',async()=>{
 await assert.rejects(()=>requestReverseGeocode('locationiq',25.2,51.4,{},{}),/geocoder_key_missing_locationiq/);
});
