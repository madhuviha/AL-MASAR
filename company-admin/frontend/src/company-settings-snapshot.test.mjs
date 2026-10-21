import test from 'node:test';
import assert from 'node:assert/strict';
import {withCompanySettingsSnapshot} from './company-settings-snapshot.mjs';

test('settings snapshot synchronizes profile and preferences without touching another company',()=>{
  const before={
    companyProfile:{name:'Old',settings:{legacy:true}},
    companyPreferences:{offlineMinutes:10,alertSound:false},
    companies:[
      {id:7,name:'Old',status:'Active',settings:{offlineMinutes:10,localOnly:'kept'}},
      {id:8,name:'Other',settings:{offlineMinutes:20}}
    ],
    vehicles:[{id:1,companyId:7}]
  };
  const result=withCompanySettingsSnapshot(before,7,{name:'AL MASAR'},{offlineMinutes:300,alertSound:true},{expiry:'2027-01-01'});
  assert.equal(result.companyProfile.name,'AL MASAR');
  assert.equal(result.companyProfile.settings.offlineMinutes,300);
  assert.deepEqual(result.companyPreferences,{offlineMinutes:300,alertSound:true});
  assert.deepEqual(result.companies[0],{
    id:7,name:'AL MASAR',status:'Active',expiry:'2027-01-01',
    settings:{offlineMinutes:300,localOnly:'kept',legacy:true,alertSound:true}
  });
  assert.deepEqual(result.companies[1],before.companies[1]);
  assert.deepEqual(result.vehicles,before.vehicles);
});

test('settings snapshot preserves stored keys omitted by a section response',()=>{
  const before={companyProfile:{name:'Company',phone:'123'},companyPreferences:{offlineMinutes:300},companies:[{id:1,name:'Company',phone:'123',settings:{offlineMinutes:300}}]};
  const result=withCompanySettingsSnapshot(before,1,{phone:'456'},{});
  assert.equal(result.companyProfile.name,'Company');
  assert.equal(result.companyProfile.phone,'456');
  assert.equal(result.companyPreferences.offlineMinutes,300);
  assert.equal(result.companies[0].settings.offlineMinutes,300);
});
