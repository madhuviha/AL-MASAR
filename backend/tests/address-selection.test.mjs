import test from 'node:test';
import assert from 'node:assert/strict';
import {bestGeocodingAddress} from '../../company-admin/frontend/src/address-status.mjs';

test('address selection rejects coordinate-style results when a street result exists',()=>{
 const rows=[
  {formatted_address:'25.2887037, 51.5384077, Qatar',types:['street_address']},
  {formatted_address:'Al Corniche Street, Doha, Qatar',types:['route']}
 ];
 assert.equal(bestGeocodingAddress(rows),'Al Corniche Street, Doha, Qatar');
});

test('address selection builds a readable label from components when only a coordinate label exists',()=>{
 const rows=[{formatted_address:'25 2887037,51, 5384077, Qatar',types:['street_address'],address_components:[
  {long_name:'Al Corniche Street',types:['route']},
  {long_name:'Doha',types:['locality']},
  {long_name:'Qatar',types:['country']}
 ]}];
 assert.equal(bestGeocodingAddress(rows),'Al Corniche Street, Doha, Qatar');
});

test('address selection keeps an ordinary street address',()=>{
 assert.equal(bestGeocodingAddress([{formatted_address:'10 Street 109, Lusail, Qatar',types:['street_address']}]),'10 Street 109, Lusail, Qatar');
});

test('address selection prefers a named area over a generic numbered street',()=>{
 const components=[
  {long_name:'Barwa Madinatna',types:['neighborhood']},
  {long_name:'Al Wakrah',types:['locality']},
  {long_name:'Qatar',types:['country']}
 ];
 const rows=[
  {formatted_address:'12 Street 1138, Doha, Qatar',types:['street_address'],address_components:components},
  {formatted_address:'Barwa Madinatna, Al Wakrah, Qatar',types:['neighborhood'],address_components:components}
 ];
 assert.equal(bestGeocodingAddress(rows),'Barwa Madinatna, Al Wakrah, Qatar');
});

test('address selection prefers street number, named road and area over a bus stop',()=>{
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
 assert.equal(bestGeocodingAddress(rows),'5 Luqman Street, Fereej Bin Mahmoud, Doha, Qatar');
});

test('address selection prefers a known area over a numbered express highway',()=>{
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
 assert.equal(bestGeocodingAddress(rows),'Barwa Madinatna, Al Wakrah, Qatar');
});

test('address selection includes an administrative area returned separately by Google',()=>{
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
 assert.equal(bestGeocodingAddress(rows),'Street 10 Al Wakalat Street, Industrial Area, Al-Rayyan, Qatar');
});

test('address selection tries the next valid road before falling back to the area',()=>{
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
 assert.equal(bestGeocodingAddress(rows),'Street 1, Industrial Area, Ar Rayyan, Qatar');
});
