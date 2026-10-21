import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCompanyExport} from './company-data-export.mjs';

test('company export is tenant-scoped and excludes accounts and passwords',()=>{
  const own={id:7,name:'AL MASAR',settings:{offlineMinutes:300}};
  const store={
    users:[{id:1,companyId:7,email:'admin@example.com',password:'secret'}],
    vehicles:[{id:1,companyId:7,name:'Own'},{id:2,companyId:8,name:'Other'}],
    drivers:[{id:3,companyId:'7',name:'Driver'},{id:4,companyId:8,name:'Other driver'}],
    localGeofences:[{id:5,companyId:7},{id:6,companyId:8}],
    maintenance:[{id:7,companyId:7}],
    sensorConfigs:[{id:8,companyId:7}],
    alertRules:[{id:9,companyId:7},{id:10,companyId:8}]
  };
  const result=buildCompanyExport(store,own,'2026-10-17T12:00:00.000Z');
  assert.equal(result.createdAt,'2026-10-17T12:00:00.000Z');
  assert.deepEqual(result.vehicles.map(row=>row.id),[1]);
  assert.deepEqual(result.drivers.map(row=>row.id),[3]);
  assert.deepEqual(result.geofences.map(row=>row.id),[5]);
  assert.deepEqual(result.maintenance.map(row=>row.id),[7]);
  assert.deepEqual(result.sensorConfigs.map(row=>row.id),[8]);
  assert.deepEqual(result.alertRules.map(row=>row.id),[9]);
  assert.equal(Object.hasOwn(result,'users'),false);
  assert.equal(JSON.stringify(result).includes('secret'),false);
});

test('missing collections export as empty lists',()=>{
  const result=buildCompanyExport({}, {id:3,name:'Empty'}, '2026-10-17T12:00:00.000Z');
  for(const key of ['vehicles','drivers','geofences','maintenance','sensorConfigs','alertRules'])assert.deepEqual(result[key],[]);
});

test('company settings exposes no browser-side restore path',async()=>{
  const [settingsSource,appSource]=await Promise.all([
    readFile(new URL('./CompanySettingsPage.jsx',import.meta.url),'utf8'),
    readFile(new URL('./App.jsx',import.meta.url),'utf8')
  ]);
  assert.doesNotMatch(settingsSource,/onImportData|accept=["']application\/json/);
  assert.doesNotMatch(appSource,/importCompanyData/);
  assert.match(settingsSource,/Restore unavailable/);
});
