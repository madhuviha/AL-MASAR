export const companySettingsCategories=Object.freeze({
  profile:Object.freeze({
    profile:Object.freeze(['name','email','phone','whatsappNumber','address']),
    preferences:Object.freeze([])
  }),
  branding:Object.freeze({
    profile:Object.freeze(['logoData','collapsedLogoData','faviconData']),
    preferences:Object.freeze(['reportTitle','reportFooter'])
  }),
  region:Object.freeze({
    profile:Object.freeze(['timezone','language','currency']),
    preferences:Object.freeze(['dateFormat','timeFormat','speedUnit','distanceUnit','fuelUnit','temperatureUnit'])
  }),
  trackingMap:Object.freeze({
    profile:Object.freeze([]),
    preferences:Object.freeze([
      'freshnessSeconds','untrackedMinutes','noSignalMinutes','refreshSeconds','offlineMinutes','mapStyle',
      'showVehicleLabels','clusterMarkers','showGeofences','showPoiParking'
    ])
  }),
  alerts:Object.freeze({
    profile:Object.freeze([]),
    preferences:Object.freeze([
      'fleetSpeedLimit','overspeedKmh','offHoursFrom','offHoursTo','alertInApp','alertPush','alertEmail',
      'alertSound','alertVolume'
    ])
  }),
  featureDefaults:Object.freeze({
    profile:Object.freeze([]),
    preferences:Object.freeze(['geofenceRadius','maintenanceReminderDays','sensorMissingText'])
  }),
  usersAccess:Object.freeze({
    profile:Object.freeze([]),
    preferences:Object.freeze(['sessionTimeout','defaultRole'])
  })
});

export class CompanySettingsValidationError extends Error{
  constructor(code,message){super(message);this.name='CompanySettingsValidationError';this.code=code}
}

const record=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const numberRanges=Object.freeze({
  freshnessSeconds:[5,3600],untrackedMinutes:[1,525600],noSignalMinutes:[1,1440],
  refreshSeconds:[2,3600],offlineMinutes:[1,43200],fleetSpeedLimit:[1,250],overspeedKmh:[1,250],
  alertVolume:[0,100],geofenceRadius:[10,100000],maintenanceReminderDays:[0,3650],sessionTimeout:[5,1440]
});
const booleanKeys=new Set([
  'showVehicleLabels','clusterMarkers','showGeofences','showPoiParking',
  'alertInApp','alertPush','alertEmail','alertSound'
]);
const imageLimits=Object.freeze({logoData:2_000_000,collapsedLogoData:2_000_000,faviconData:1_000_000});
const stringLimits=Object.freeze({
  name:200,email:320,phone:80,whatsappNumber:80,address:4000,
  reportTitle:200,reportFooter:1000,timezone:128,language:64,currency:3,
  dateFormat:32,timeFormat:8,speedUnit:16,distanceUnit:16,fuelUnit:16,temperatureUnit:16,
  mapStyle:64,offHoursFrom:5,offHoursTo:5,sensorMissingText:200,defaultRole:64
});
const enums=Object.freeze({
  dateFormat:new Set(['DD-MM-YYYY','MM-DD-YYYY','YYYY-MM-DD']),
  timeFormat:new Set(['24h','12h']),
  speedUnit:new Set(['km/h','mph']),
  distanceUnit:new Set(['km','mi']),
  fuelUnit:new Set(['L','gal']),
  temperatureUnit:new Set(['C','F','°C','°F']),
  mapStyle:new Set(['road','satellite']),
  defaultRole:new Set(['Viewer','Supervisor','Dispatcher','Fleet Manager'])
});

function invalidValue(key,message){
  throw new CompanySettingsValidationError('invalid_settings_value',`${key}: ${message}`);
}

function normalizedString(key,value){
  if(typeof value!=='string')invalidValue(key,'must be text.');
  const normalized=value.trim();
  const limit=stringLimits[key]||8192;
  if(normalized.length>limit)invalidValue(key,`must be ${limit} characters or fewer.`);
  if(key==='name'&&!normalized)invalidValue(key,'is required.');
  if(key==='email'&&normalized&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))invalidValue(key,'must be a valid email address.');
  if((key==='phone'||key==='whatsappNumber')&&normalized&&!/^\+?[0-9][0-9 ()-]{5,30}$/.test(normalized))invalidValue(key,'must be a valid phone number.');
  if(key==='timezone'&&normalized&&!/^(?:UTC|GMT|[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(normalized))invalidValue(key,'must be an IANA time zone such as Asia/Qatar.');
  if(key==='currency'&&normalized&&!/^[A-Z]{3}$/.test(normalized))invalidValue(key,'must be a three-letter currency code.');
  if((key==='offHoursFrom'||key==='offHoursTo')&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized))invalidValue(key,'must use 24-hour HH:mm format.');
  if(enums[key]&&!enums[key].has(normalized))invalidValue(key,'is not a supported option.');
  return key==='email'?normalized.toLowerCase():normalized;
}

function validateSettingValue(key,value){
  if(Object.hasOwn(imageLimits,key)){
    if(typeof value!=='string')invalidValue(key,'must be an image value.');
    if(value.length>imageLimits[key])invalidValue(key,'image is too large.');
    if(value&&!/^data:image\/(?:png|jpeg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=\s]+$/i.test(value))invalidValue(key,'must be a supported image data URL.');
    return value;
  }
  if(Object.hasOwn(numberRanges,key)){
    const [minimum,maximum]=numberRanges[key];
    if(typeof value!=='number'||!Number.isFinite(value)||value<minimum||value>maximum)invalidValue(key,`must be between ${minimum} and ${maximum}.`);
    return value;
  }
  if(booleanKeys.has(key)){
    if(typeof value!=='boolean')invalidValue(key,'must be true or false.');
    return value;
  }
  return normalizedString(key,value);
}

/**
 * Validates one settings section and partitions it by the two existing storage
 * locations. A section can own only the keys listed above, so saving it cannot
 * replace another section or any operational company records.
 */
export function prepareCompanySettingsPatch(category,settings){
  if(typeof category!=='string'||!Object.hasOwn(companySettingsCategories,category)){
    throw new CompanySettingsValidationError('invalid_settings_category','Unknown company settings category.');
  }
  if(!record(settings)){
    throw new CompanySettingsValidationError('invalid_settings_body','Settings must be an object.');
  }
  const keys=Object.keys(settings);
  if(!keys.length)throw new CompanySettingsValidationError('empty_settings_patch','Add at least one setting to save.');
  const ownership=companySettingsCategories[category],profileKeys=new Set(ownership.profile),preferenceKeys=new Set(ownership.preferences);
  const unknown=keys.filter(key=>!profileKeys.has(key)&&!preferenceKeys.has(key));
  if(unknown.length){
    throw new CompanySettingsValidationError('invalid_settings_key',`These settings do not belong to ${category}: ${unknown.join(', ')}`);
  }
  const profile={},preferences={};
  for(const key of keys){
    const value=validateSettingValue(key,settings[key]);
    if(profileKeys.has(key))profile[key]=value;else preferences[key]=value;
  }
  return {profile,preferences};
}

export function mergeCompanySettings(currentProfile,currentPreferences,patch){
  return {
    profile:{...(record(currentProfile)?currentProfile:{}),...(record(patch?.profile)?patch.profile:{})},
    preferences:{...(record(currentPreferences)?currentPreferences:{}),...(record(patch?.preferences)?patch.preferences:{})}
  };
}

/**
 * Compatibility adapter for older company clients that still submit a full
 * profile. Unknown UI-only fields are ignored, and nested preferences are
 * reduced to the same allowlists and validation used by section saves.
 */
export function prepareLegacyCompanySettingsPatch(value){
  if(!record(value))throw new CompanySettingsValidationError('invalid_settings_body','Profile must be an object.');
  const profileKeys=new Set(Object.values(companySettingsCategories).flatMap(category=>category.profile));
  const preferenceKeys=new Set(Object.values(companySettingsCategories).flatMap(category=>category.preferences));
  const profile={},preferences={};
  for(const key of Object.keys(value))if(profileKeys.has(key))profile[key]=validateSettingValue(key,value[key]);
  if(value.settings!==undefined&&!record(value.settings))throw new CompanySettingsValidationError('invalid_settings_body','Profile settings must be an object.');
  for(const [key,input] of Object.entries(value.settings||{}))if(preferenceKeys.has(key))preferences[key]=validateSettingValue(key,input);
  if(!Object.keys(profile).length&&!Object.keys(preferences).length)throw new CompanySettingsValidationError('empty_settings_patch','No supported company settings were supplied.');
  return {profile,preferences};
}
