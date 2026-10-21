import test from 'node:test';
import assert from 'node:assert/strict';
import {bestGoogleAddress,geocodeCacheKey,readableAddress} from '../google-geocoding.mjs';

test('server geocoder selects a readable street instead of a coordinate label',()=>{
  const rows=[
    {formatted_address:'25.28913, 51.53833, Qatar',types:['street_address']},
    {formatted_address:'Al Bank Street, Al Souq, Doha, Qatar',types:['route']}
  ];
  assert.equal(bestGoogleAddress(rows),'Al Bank Street, Al Souq, Doha, Qatar');
});

test('server geocoder prefers a named area over a generic numbered street',()=>{
  const components=[
    {long_name:'Barwa Madinatna',types:['neighborhood']},
    {long_name:'Al Wakrah',types:['locality']},
    {long_name:'Qatar',types:['country']}
  ];
  const rows=[
    {formatted_address:'12 Street 1138, Doha, Qatar',types:['street_address'],address_components:components},
    {formatted_address:'Barwa Madinatna, Al Wakrah, Qatar',types:['neighborhood'],address_components:components}
  ];
  assert.equal(bestGoogleAddress(rows),'Barwa Madinatna, Al Wakrah, Qatar');
});

test('geocode cache uses a stable roughly eleven-metre coordinate key',()=>{
  assert.equal(geocodeCacheKey(25.2891283,51.5383316),'25.2891,51.5383');
  assert.equal(geocodeCacheKey(25.2891266,51.5383083),'25.2891,51.5383');
});

test('shared address cache rejects coordinate and plus-code labels',()=>{
  assert.equal(readableAddress('Al Bank Street, Al Souq, Doha, Qatar'),true);
  assert.equal(readableAddress('25.28913, 51.53833, Qatar'),false);
  assert.equal(readableAddress('7HQH+M8 Doha, Qatar'),false);
  assert.equal(readableAddress('Bus Stop 56792, Doha, Qatar'),false);
  assert.equal(readableAddress('7 Doha Express Hwy, Doha, Qatar'),false);
});

test('server geocoder prefers a street and area over a transit point',()=>{
 const rows=[
  {formatted_address:'Bus Stop 56792, Doha, Qatar',types:['bus_station','transit_station','point_of_interest','establishment']},
  {formatted_address:'5 Luqman St, Doha, Qatar',types:['street_address'],address_components:[
   {long_name:'5',types:['street_number']},
   {long_name:'Luqman Street',types:['route']},
   {long_name:'Fereej Bin Mahmoud',types:['sublocality_level_1','sublocality']},
   {long_name:'Doha',types:['locality']},
   {long_name:'Qatar',types:['country']}
  ]}
 ];
 assert.equal(bestGoogleAddress(rows),'5 Luqman Street, Fereej Bin Mahmoud, Doha, Qatar');
});

test('server geocoder prefers a known area over a numbered express highway',()=>{
 const components=[
  {long_name:'7',types:['street_number']},
  {long_name:'Doha Express Highway',types:['route']},
  {long_name:'Barwa Madinatna',types:['neighborhood']},
  {long_name:'Al Wakrah',types:['locality']},
  {long_name:'Qatar',types:['country']}
 ];
 const rows=[
  {formatted_address:'7 Doha Express Hwy, Doha, Qatar',types:['street_address'],address_components:components},
  {formatted_address:'Barwa Madinatna, Al Wakrah, Qatar',types:['neighborhood'],address_components:components}
 ];
 assert.equal(bestGoogleAddress(rows),'Barwa Madinatna, Al Wakrah, Qatar');
});

test('server geocoder combines a street with an area supplied in a separate Google result',()=>{
 const rows=[
  {formatted_address:'6C7Q+729, Al-Rayyan, Qatar',types:['plus_code'],address_components:[
   {long_name:'Al-Rayyan',types:['locality']},{long_name:'Qatar',types:['country']}
  ]},
  {formatted_address:'Street 10 Al Wakalat Street, ١٠, Qatar',types:['street_address'],address_components:[
   {long_name:'Street 10',types:['street_number']},{long_name:'Al Wakalat Street',types:['route']},
   {long_name:'١٠',types:['locality']},{long_name:'Qatar',types:['country']}
  ]},
  {formatted_address:'Industrial Area, Qatar',types:['administrative_area_level_3','political'],address_components:[
   {long_name:'Industrial Area',types:['administrative_area_level_3','political']},{long_name:'Qatar',types:['country']}
  ]}
 ];
 assert.equal(bestGoogleAddress(rows),'Street 10 Al Wakalat Street, Industrial Area, Al-Rayyan, Qatar');
});

test('server geocoder tries the next valid road before falling back to the area',()=>{
 const rows=[
  {formatted_address:'53 Street 3, Ar Rayyan, Qatar',types:['street_address'],address_components:[
   {long_name:'53',types:['street_number']},{long_name:'Street 3',types:['route']},{long_name:'Ar Rayyan',types:['locality']},{long_name:'Qatar',types:['country']}
  ]},
  {formatted_address:'Street 1, Ar Rayyan, Qatar',types:['route'],address_components:[
   {long_name:'Street 1',types:['route']},{long_name:'Ar Rayyan',types:['locality']},{long_name:'Qatar',types:['country']}
  ]},
  {formatted_address:'Industrial Area, Qatar',types:['administrative_area_level_3','political'],address_components:[
   {long_name:'Industrial Area',types:['administrative_area_level_3','political']},{long_name:'Qatar',types:['country']}
  ]}
 ];
 assert.equal(bestGoogleAddress(rows),'Street 1, Industrial Area, Ar Rayyan, Qatar');
});
