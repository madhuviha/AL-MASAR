export const platformSettingsCategories=Object.freeze({
  branding:Object.freeze([
    'portalTitle','browserTitle','companyBrowserTitle','brandLogoData','collapsedLogoData',
    'loginLogoData','loginBackgroundData','templateColor','loginTextColor',
    'loginBackgroundColor','loginPanelColor','welcomeText','bottomText',
    'loginPanelTransparency','googlePlayUrl','appStoreUrl','whatsappNumber','faviconData'
  ]),
  tracking:Object.freeze([
    'serverName','serverDescription','trackerHost','apiUrl','defaultProtocol',
    'untrackedMinutes','trackingPolicyEnabled','offlineMinutes'
  ]),
  general:Object.freeze([
    'supportEmail','supportPhone','timezone','dateFormat','timeFormat','durationFormat',
    'distanceUnit','capacityUnit','altitudeUnit','distanceDecimals','language'
  ]),
  maps:Object.freeze([
    'mapProvider','defaultBaseMap','mapZoom','mapCenterLatitude','mapCenterLongitude','enabledMaps',
    'mapillaryAccessToken','mapTilerKey','mapboxToken','hereMapsKey','tomtomMapsKey','yandexMapsKey',
    'openMapTilesUrl','openMapTilesAttribution','openMapTilesMaxZoom','geocoderPrimary',
    'geocoderFallback','geocoderPrimaryApiUrl','geocoderAddressApiUrl','geocoderCacheEnabled',
    'geocoderCacheDays','nominatimApiUrl','geoapifyKey','locationIqKey','tomtomGeocodingKey',
    'mapboxGeocodingToken','hereGeocodingKey','mapTilerGeocodingKey','bingMapsKey',
    'streetviewProvider','streetviewApiKey'
  ]),
  security:Object.freeze([
    'expiryNotifyBeforeDays','expiryNotifyAfterDays','cameraImageRetentionDays',
    'backupRetention','captchaProvider','captchaSiteKey','captchaSecretKey'
  ]),
  deployment:Object.freeze(['notes'])
});

export const platformSecretSettingKeys=new Set([
  'mapillaryAccessToken','mapTilerKey','mapboxToken','hereMapsKey','tomtomMapsKey',
  'yandexMapsKey','geoapifyKey','locationIqKey','tomtomGeocodingKey',
  'mapboxGeocodingToken','hereGeocodingKey','mapTilerGeocodingKey','bingMapsKey',
  'streetviewApiKey','captchaSiteKey','captchaSecretKey'
]);

export class PlatformSettingsValidationError extends Error{
  constructor(code,message){super(message);this.name='PlatformSettingsValidationError';this.code=code}
}

const record=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const unchangedSecret=value=>value===undefined||(typeof value==='string'&&!value.trim());
const numberRanges=Object.freeze({
  loginPanelTransparency:[0,70],untrackedMinutes:[1,525600],offlineMinutes:[2,525600],
  distanceDecimals:[0,4],mapZoom:[2,20],mapCenterLatitude:[-90,90],mapCenterLongitude:[-180,180],
  openMapTilesMaxZoom:[2,24],geocoderCacheDays:[1,3650],expiryNotifyBeforeDays:[0,365],
  expiryNotifyAfterDays:[0,365],cameraImageRetentionDays:[0,3650],backupRetention:[1,520]
});
const booleanKeys=new Set(['trackingPolicyEnabled','geocoderCacheEnabled']);
const imageLimits=Object.freeze({
  brandLogoData:2_000_000,collapsedLogoData:2_000_000,loginLogoData:2_000_000,
  loginBackgroundData:6_500_000,faviconData:1_000_000
});
const stringLimits=Object.freeze({
  notes:50_000,serverDescription:2_000,welcomeText:500,bottomText:500,openMapTilesAttribution:2_000,
  googlePlayUrl:4_096,appStoreUrl:4_096,apiUrl:4_096,trackerHost:1_024,openMapTilesUrl:4_096,
  geocoderPrimaryApiUrl:4_096,geocoderAddressApiUrl:4_096,nominatimApiUrl:4_096
});
const colorKeys=new Set(['templateColor','loginTextColor','loginBackgroundColor','loginPanelColor']);
const captchaProviders=new Set(['None','Cloudflare Turnstile','Google reCAPTCHA']);

function invalidValue(key,message){
  throw new PlatformSettingsValidationError('invalid_settings_value',`${key}: ${message}`);
}

function validateSettingValue(key,value){
  if(platformSecretSettingKeys.has(key)&&value===null)return;
  if(Object.hasOwn(imageLimits,key)){
    if(typeof value!=='string')invalidValue(key,'must be an image value.');
    if(value.length>imageLimits[key])invalidValue(key,'image is too large.');
    if(value&&!/^data:image\/(?:png|jpeg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=\s]+$/i.test(value))invalidValue(key,'must be a supported image data URL.');
    return;
  }
  if(Object.hasOwn(numberRanges,key)){
    const [minimum,maximum]=numberRanges[key];
    if(typeof value!=='number'||!Number.isFinite(value)||value<minimum||value>maximum)invalidValue(key,`must be between ${minimum} and ${maximum}.`);
    return;
  }
  if(booleanKeys.has(key)){
    if(typeof value!=='boolean')invalidValue(key,'must be true or false.');
    return;
  }
  if(key==='enabledMaps'){
    if(!record(value)||Object.keys(value).length>100||Object.entries(value).some(([name,enabled])=>!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name)||typeof enabled!=='boolean'))invalidValue(key,'must contain valid map switches.');
    return;
  }
  if(typeof value!=='string')invalidValue(key,'must be text.');
  const limit=stringLimits[key]||8_192;
  if(value.length>limit)invalidValue(key,`must be ${limit} characters or fewer.`);
  if(colorKeys.has(key)&&!/^#[0-9a-f]{6}$/i.test(value))invalidValue(key,'must be a six-digit colour.');
  if(key==='captchaProvider'&&!captchaProviders.has(value))invalidValue(key,'is not a supported CAPTCHA provider.');
}

/**
 * Validate and reduce a category request to the exact keys that category owns.
 * Empty secret fields are deliberately omitted so an unchanged masked/password
 * input can never erase a credential that is already stored.
 */
export function preparePlatformSettingsPatch(category,settings){
  if(typeof category!=='string'||!Object.hasOwn(platformSettingsCategories,category)){
    throw new PlatformSettingsValidationError('invalid_settings_category','Unknown settings category.');
  }
  if(!record(settings)){
    throw new PlatformSettingsValidationError('invalid_settings_body','Settings must be an object.');
  }
  const keys=Object.keys(settings);
  if(!keys.length){
    throw new PlatformSettingsValidationError('empty_settings_patch','Add at least one setting to save.');
  }
  const allowed=new Set(platformSettingsCategories[category]);
  const unknown=keys.filter(key=>!allowed.has(key));
  if(unknown.length){
    throw new PlatformSettingsValidationError('invalid_settings_key',`These settings do not belong to ${category}: ${unknown.join(', ')}`);
  }
  const patch={};
  for(const key of keys){
    if(platformSecretSettingKeys.has(key)&&unchangedSecret(settings[key]))continue;
    validateSettingValue(key,settings[key]);
    patch[key]=settings[key];
  }
  if(!Object.keys(patch).length){
    throw new PlatformSettingsValidationError('empty_settings_patch','No changed settings were supplied.');
  }
  if(category==='tracking'&&Object.hasOwn(patch,'untrackedMinutes')&&Object.hasOwn(patch,'offlineMinutes')&&patch.offlineMinutes<=patch.untrackedMinutes){
    invalidValue('offlineMinutes','must be longer than the Currently Untracked duration.');
  }
  return patch;
}

export function mergePlatformSettings(current,patch){
  return {...(record(current)?current:{}),...(record(patch)?patch:{})};
}
