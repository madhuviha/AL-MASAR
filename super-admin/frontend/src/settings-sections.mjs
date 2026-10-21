export const SETTINGS_SECTION_FIELDS = Object.freeze({
  branding: Object.freeze([
    "portalTitle", "browserTitle", "companyBrowserTitle", "brandLogoData", "collapsedLogoData",
    "loginLogoData", "loginBackgroundData", "templateColor", "loginTextColor", "loginBackgroundColor",
    "loginPanelColor", "welcomeText", "bottomText", "loginPanelTransparency", "googlePlayUrl",
    "appStoreUrl", "whatsappNumber", "faviconData"
  ]),
  tracking: Object.freeze([
    "serverName", "serverDescription", "trackerHost", "apiUrl", "defaultProtocol", "untrackedMinutes",
    "trackingPolicyEnabled", "offlineMinutes"
  ]),
  general: Object.freeze([
    "supportEmail", "supportPhone", "timezone", "dateFormat", "timeFormat", "durationFormat",
    "distanceUnit", "capacityUnit", "altitudeUnit", "distanceDecimals", "language"
  ]),
  maps: Object.freeze([
    "mapProvider", "defaultBaseMap", "mapZoom", "mapCenterLatitude", "mapCenterLongitude", "enabledMaps",
    "mapillaryAccessToken", "mapTilerKey", "mapboxToken", "hereMapsKey", "tomtomMapsKey", "yandexMapsKey",
    "openMapTilesUrl", "openMapTilesAttribution", "openMapTilesMaxZoom", "geocoderPrimary", "geocoderFallback",
    "geocoderPrimaryApiUrl", "geocoderAddressApiUrl", "geocoderCacheEnabled", "geocoderCacheDays",
    "nominatimApiUrl", "geoapifyKey", "locationIqKey", "tomtomGeocodingKey", "mapboxGeocodingToken",
    "hereGeocodingKey", "mapTilerGeocodingKey", "bingMapsKey", "streetviewProvider", "streetviewApiKey"
  ]),
  security: Object.freeze([
    "expiryNotifyBeforeDays", "expiryNotifyAfterDays", "cameraImageRetentionDays", "backupRetention", "captchaProvider",
    "captchaSiteKey", "captchaSecretKey"
  ]),
  deployment: Object.freeze(["notes"])
});

export function createSettingsPatch(category, draft) {
  const fields = SETTINGS_SECTION_FIELDS[category];
  if (!fields) throw new Error(`Unknown settings section: ${category}`);
  return Object.fromEntries(fields.map((key) => [key, draft?.[key]]));
}

export function settingsSectionChangedOnServer(patch, loadedSettings = {}, serverSettings = {}, defaults = {}) {
  return Object.keys(patch || {}).some((key) => {
    const serverValue = Object.hasOwn(serverSettings, key) ? serverSettings[key] : defaults[key];
    return JSON.stringify(serverValue) !== JSON.stringify(loadedSettings[key]);
  });
}

export function validateTrackingSettings(settings) {
  const untracked = Number(settings?.untrackedMinutes);
  const offline = Number(settings?.offlineMinutes);
  if (!(untracked > 0)) return "Currently Untracked duration must be greater than zero.";
  if (!(offline > untracked)) return "Offline duration must be longer than Currently Untracked duration.";
  return "";
}

const providerKeys = Object.freeze({
  geoapify: ["geoapifyKey"],
  locationiq: ["locationIqKey"],
  tomtom: ["tomtomGeocodingKey", "tomtomMapsKey"],
  mapbox: ["mapboxGeocodingToken", "mapboxToken"],
  here: ["hereGeocodingKey", "hereMapsKey"],
  maptiler: ["mapTilerGeocodingKey", "mapTilerKey"],
  bing: ["bingMapsKey"]
});

function hasProviderKey(settings, provider) {
  return (providerKeys[provider] || []).some((key) => String(settings?.[key] || "").trim());
}

export function validateMapSettings(settings, baseMapKeys) {
  const enabled = settings?.enabledMaps || {};
  if (!baseMapKeys.some((key) => enabled[key] !== false)) return "Enable at least one default map.";
  const openTilesUrl = String(settings?.openMapTilesUrl || "").trim();
  if (enabled.openMapTiles !== false && openTilesUrl && !["{z}", "{x}", "{y}"].every((part) => openTilesUrl.includes(part))) {
    return "OpenMapTiles URL must include {z}, {x} and {y} placeholders.";
  }
  const primary = settings?.geocoderPrimary || "nominatim";
  const fallback = settings?.geocoderFallback || "none";
  if (fallback !== "none" && fallback === primary) return "Choose a different fallback geocoder.";
  if (primary !== "nominatim" && !hasProviderKey(settings, primary) && !String(settings?.geocoderPrimaryApiUrl || "").trim()) {
    return "Add the server key or custom API URL for the selected primary geocoder.";
  }
  const zoom = Number(settings?.mapZoom);
  if (!Number.isFinite(zoom) || zoom < 2 || zoom > 20) return "Default map zoom must be between 2 and 20.";
  const latitude = Number(settings?.mapCenterLatitude), longitude = Number(settings?.mapCenterLongitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return "Map center latitude must be between -90 and 90.";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return "Map center longitude must be between -180 and 180.";
  return "";
}

export function validateSecuritySettings(settings, savedSettings = {}, changedFields = new Set()) {
  const before = Number(settings?.expiryNotifyBeforeDays), after = Number(settings?.expiryNotifyAfterDays);
  const retention = Number(settings?.cameraImageRetentionDays);
  const backupWeeks = Number(settings?.backupRetention);
  if (!Number.isFinite(before) || before < 0 || before > 365) return "Expiry notification before days must be between 0 and 365.";
  if (!Number.isFinite(after) || after < 0 || after > 365) return "Expiry notification after days must be between 0 and 365.";
  if (!Number.isFinite(retention) || retention < 0 || retention > 3650) return "Camera image retention must be between 0 and 3650 days.";
  if (!Number.isFinite(backupWeeks) || backupWeeks < 1) return "Backup retention must be at least one week.";
  const provider = settings?.captchaProvider || "None";
  if (provider === "None") return "";
  if (settings?.captchaSiteKey === null || settings?.captchaSecretKey === null) return "Select None before clearing credentials for the active CAPTCHA provider.";
  if (!String(settings?.captchaSiteKey || "").trim()) return "Add the CAPTCHA site key, or select None.";
  const providerChanged = provider !== (savedSettings?.captchaProvider || "None");
  if (providerChanged && (!changedFields.has("captchaSiteKey") || !changedFields.has("captchaSecretKey"))) return "Enter new CAPTCHA site and secret keys when changing provider.";
  if (providerChanged && !String(settings?.captchaSecretKey || "").trim()) return "Add the CAPTCHA secret key when enabling a provider.";
  return "";
}

export function validateGeneralSettings(settings) {
  return "";
}
