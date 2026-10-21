import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CompanySettingsValidationError,
  companySettingsCategories,
  mergeCompanySettings,
  prepareCompanySettingsPatch,
  prepareLegacyCompanySettingsPatch
} from '../company-settings.mjs';

test('all seven company settings sections have explicit ownership',()=>{
  assert.deepEqual(Object.keys(companySettingsCategories),[
    'profile','branding','region','trackingMap','alerts','featureDefaults','usersAccess'
  ]);
  const owners=new Map();
  for(const [category,groups] of Object.entries(companySettingsCategories)){
    for(const key of [...groups.profile,...groups.preferences]){
      assert.equal(owners.has(key),false,`${key} belongs to both ${owners.get(key)} and ${category}`);
      owners.set(key,category);
    }
  }
});

test('profile and preference values are partitioned without unrelated fields',()=>{
  const patch=prepareCompanySettingsPatch('region',{
    timezone:'Asia/Qatar',language:'English',currency:'QAR',dateFormat:'DD-MM-YYYY',
    timeFormat:'24h',speedUnit:'km/h',distanceUnit:'km',fuelUnit:'L',temperatureUnit:'°C'
  });
  assert.deepEqual(patch.profile,{timezone:'Asia/Qatar',language:'English',currency:'QAR'});
  assert.deepEqual(patch.preferences,{
    dateFormat:'DD-MM-YYYY',timeFormat:'24h',speedUnit:'km/h',distanceUnit:'km',fuelUnit:'L',temperatureUnit:'°C'
  });
});

test('saving one section preserves every existing value outside its patch',()=>{
  const currentProfile={name:'AL MASAR',email:'old@example.com',logoData:'stored-logo'};
  const currentPreferences={offlineMinutes:300,alertEmail:false,sessionTimeout:60};
  const patch=prepareCompanySettingsPatch('profile',{email:' NEW@Example.COM ',whatsappNumber:'+974 5555 0101'});
  const merged=mergeCompanySettings(currentProfile,currentPreferences,patch);
  assert.deepEqual(merged.profile,{
    name:'AL MASAR',email:'new@example.com',logoData:'stored-logo',whatsappNumber:'+974 5555 0101'
  });
  assert.deepEqual(merged.preferences,currentPreferences);
});

test('cross-section keys and malformed bodies are rejected',()=>{
  assert.throws(
    ()=>prepareCompanySettingsPatch('branding',{offlineMinutes:300}),
    error=>error instanceof CompanySettingsValidationError&&error.code==='invalid_settings_key'
  );
  assert.throws(
    ()=>prepareCompanySettingsPatch('unknown',{name:'AL MASAR'}),
    error=>error instanceof CompanySettingsValidationError&&error.code==='invalid_settings_category'
  );
  for(const settings of [null,[],true,'settings',{}]){
    assert.throws(
      ()=>prepareCompanySettingsPatch('profile',settings),
      error=>error instanceof CompanySettingsValidationError&&['invalid_settings_body','empty_settings_patch'].includes(error.code)
    );
  }
});

test('company setting values enforce types, ranges, formats and supported images',()=>{
  const invalid=[
    ['profile',{email:'not-an-email'}],
    ['profile',{phone:'abc'}],
    ['region',{timezone:'Qatar'}],
    ['trackingMap',{offlineMinutes:0}],
    ['trackingMap',{showGeofences:'yes'}],
    ['alerts',{offHoursFrom:'25:00'}],
    ['alerts',{alertVolume:101}],
    ['usersAccess',{defaultRole:'Super Admin'}],
    ['branding',{logoData:'data:text/html;base64,PGgxPm5vPC9oMT4='}]
  ];
  for(const [category,settings] of invalid){
    assert.throws(
      ()=>prepareCompanySettingsPatch(category,settings),
      error=>error instanceof CompanySettingsValidationError&&error.code==='invalid_settings_value',
      `${category} ${JSON.stringify(settings)}`
    );
  }
  assert.deepEqual(prepareCompanySettingsPatch('branding',{logoData:''}).profile,{logoData:''});
});

test('existing tracking thresholds remain compatible when offline is earlier than untracked',()=>{
  assert.deepEqual(
    prepareCompanySettingsPatch('trackingMap',{untrackedMinutes:15,offlineMinutes:10}).preferences,
    {untrackedMinutes:15,offlineMinutes:10}
  );
});

test('legacy full-profile requests cannot persist UI-only or unknown nested fields',()=>{
  const patch=prepareLegacyCompanySettingsPatch({
    id:9,name:'AL MASAR',vehiclePermissions:{all:true},
    settings:{alertSound:true,sessionTimeout:60,unknownDangerousValue:'ignored'}
  });
  assert.deepEqual(patch,{profile:{name:'AL MASAR'},preferences:{alertSound:true,sessionTimeout:60}});
});
