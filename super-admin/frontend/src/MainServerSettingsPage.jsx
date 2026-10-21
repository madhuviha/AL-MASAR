import React, { useRef, useState } from "react";
import { Save, Trash2, Upload } from "lucide-react";
import {
  SETTINGS_SECTION_FIELDS,
  createSettingsPatch,
  validateGeneralSettings,
  validateMapSettings,
  validateSecuritySettings,
  validateTrackingSettings
} from "./settings-sections.mjs";

const protocolOptions = ["GT06", "Teltonika", "H02", "TK103", "Wialon IPS", "Other"];
const mapAccessOptions = [["bingHybrid", "Bing Hybrid"], ["bingRoad", "Bing Normal"], ["bingSatellite", "Bing Satellite"], ["hereHybrid", "HERE Hybrid"], ["hereNormal", "HERE Normal"], ["hereSatellite", "HERE Satellite"], ["mapboxHybrid", "MapBox Hybrid"], ["mapboxStreets", "MapBox Normal"], ["mapboxSatellite", "MapBox Satellite"], ["mapTilerBasic", "MapTiler Basic"], ["mapTilerSatellite", "MapTiler Satellite"], ["mapTilerStreets", "MapTiler Streets"], ["cartoLiberty", "MapTiles Liberty"], ["cartoPositron", "MapTiles Positron"], ["openMapTiles", "OpenMapTiles OSM (self-hosted URL)"], ["railElectrification", "OpenRailway Electrification"], ["railInfrastructure", "OpenRailway Infrastructure"], ["railMaxSpeeds", "OpenRailway Max Speeds"], ["railSignaling", "OpenRailway Signaling"], ["openStreetMap", "OpenStreetMap"], ["tomtomBasic", "TomTom Basic"], ["tomtomSatellite", "TomTom Satellite"], ["yandex", "Yandex"], ["cartoDark", "MapTiles Dark"], ["openTopoMap", "OpenTopoMap"], ["esriStreet", "Esri Street"], ["esriSatellite", "Esri Satellite"], ["mapillary", "Mapillary Street Imagery"]];
const overlayMapAccessKeys = new Set(["railElectrification", "railInfrastructure", "railMaxSpeeds", "railSignaling", "mapillary"]);
const baseMapAccessKeys = mapAccessOptions.filter(([key]) => !overlayMapAccessKeys.has(key)).map(([key]) => key);
const geocoderOptions = [["nominatim", "Nominatim / OpenStreetMap"], ["geoapify", "Geoapify"], ["locationiq", "LocationIQ"], ["tomtom", "TomTom"], ["mapbox", "Mapbox"], ["here", "HERE"], ["maptiler", "MapTiler"], ["bing", "Bing Maps"]];
const mapOptions = [["bing-hybrid", "Bing Hybrid"], ["bing-road", "Bing Normal"], ["bing-satellite", "Bing Satellite"], ["here-hybrid", "HERE Hybrid"], ["here-normal", "HERE Normal"], ["here-satellite", "HERE Satellite"], ["mapbox-hybrid", "MapBox Hybrid"], ["mapbox-streets", "MapBox Normal"], ["mapbox-satellite", "MapBox Satellite"], ["maptiler-basic", "MapTiler Basic"], ["maptiler-satellite", "MapTiler Satellite"], ["maptiler-streets", "MapTiler Streets"], ["carto-liberty", "MapTiles Liberty"], ["carto-positron", "MapTiles Positron"], ["openmaptiles-osm", "OpenMapTiles OSM"], ["rail-electrification", "OpenRailway Electrification"], ["rail-infrastructure", "OpenRailway Infrastructure"], ["rail-maxspeed", "OpenRailway Max Speeds"], ["rail-signals", "OpenRailway Signaling"], ["osm-road", "OpenStreetMap"], ["tomtom-basic", "TomTom Basic"], ["tomtom-satellite", "TomTom Satellite"], ["yandex-road", "Yandex"], ["carto-dark", "MapTiles Dark"], ["open-topo", "OpenTopoMap"], ["esri-street", "Esri Street"], ["esri-satellite", "Esri Satellite"]];
const normalizedMapAccess = (value = {}) => Object.fromEntries(mapAccessOptions.map(([key]) => [key, value[key] ?? true]));
const defaultUserMapAccess = () => Object.fromEntries(mapAccessOptions.map(([key]) => [key, key === "openStreetMap"]));
const allUserMapAccess = () => Object.fromEntries(mapAccessOptions.map(([key]) => [key, true]));
const clone = (value) => JSON.parse(JSON.stringify(value));

const imageFileToDataUrl = (file, { maxDimension = 512, quality = 0.82 } = {}) => new Promise((resolve, reject) => {
  if (!file) return reject(new Error("Choose an image file."));
  if (!String(file.type || "").startsWith("image/")) return reject(new Error("Choose a PNG, JPEG, WebP, SVG or icon image."));
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("The selected image could not be read."));
  reader.onload = () => {
    if (["image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"].includes(file.type)) return resolve(String(reader.result || ""));
    const image = new Image();
    image.onerror = () => reject(new Error("The selected image is damaged or unsupported."));
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image processing is unavailable in this browser.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", quality));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("The selected image could not be processed."));
      }
    };
    image.src = String(reader.result || "");
  };
  reader.readAsDataURL(file);
});

function SettingsPanel({ title, children, category, feedback, saving, disabled, onSave }) {
  const item = feedback[category];
  return <section className="panel settingsPanel">
    <div className="panelTitle"><div><h2>{title}</h2></div></div>
    {children}
    <footer className="settingsPanelFooter">
      <div className={item ? `sectionSaveFeedback ${item.type}` : "sectionSaveFeedback"} role={item?.type === "error" ? "alert" : "status"} aria-live="polite">
        {item?.message || `Only ${title.toLowerCase()} changes are saved by this button.`}
      </div>
      <button type="button" className="greenBtn" onClick={() => onSave(category)} disabled={saving || disabled}>
        <Save />{saving ? "Saving…" : `Save ${title}`}
      </button>
    </footer>
  </section>;
}

function ImageSetting({ label, field, value, fallback, compact, inputRef, status, onChoose, onReset, resetLabel = "Reset", help }) {
  return <label className="span2">{label}<div className={`brandingUpload${compact ? " compactBranding" : ""}${field === "loginBackgroundData" ? " loginBackgroundUpload" : ""}`}>
    {value ? <img src={value} alt="" /> : <span>{fallback}</span>}
    <button type="button" onClick={() => inputRef.current?.click()}><Upload />Choose {label.replace("Default ", "")}</button>
    <button type="button" onClick={() => onReset(field)} disabled={status?.status === "processing"}><Trash2 />{resetLabel}</button>
    <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" onChange={(event) => onChoose(field, event.currentTarget, field === "loginBackgroundData" ? { maxDimension: 1920, quality: 0.84 } : undefined)} />
  </div>
    {status?.status === "processing" && <small className="brandingUploadStatus" role="status">Processing image…</small>}
    {status?.status === "error" && <small className="brandingUploadStatus brandingUploadError" role="alert">{status.message}</small>}
    {help && <small>{help}</small>}
  </label>;
}

function BrandingFields({ draft, setValue, uploads, refs, chooseImage, resetImage }) {
  return <div className="settingsForm">
    <label>Default Portal Name<input value={draft.portalTitle || ""} onChange={(e) => setValue("branding", "portalTitle", e.target.value)} /></label>
    <label>Super Admin Browser Title<input value={draft.browserTitle || ""} onChange={(e) => setValue("branding", "browserTitle", e.target.value)} /></label>
    <label>Company Browser Title<input value={draft.companyBrowserTitle || ""} onChange={(e) => setValue("branding", "companyBrowserTitle", e.target.value)} /></label>
    <ImageSetting label="Default Logo" field="brandLogoData" value={draft.brandLogoData} fallback="No logo selected" inputRef={refs.logo} status={uploads.brandLogoData} onChoose={chooseImage} onReset={resetImage} />
    <ImageSetting label="Default Collapsed Sidebar Logo / Icon" field="collapsedLogoData" value={draft.collapsedLogoData} fallback="No collapsed logo selected" compact inputRef={refs.collapsed} status={uploads.collapsedLogoData} onChoose={chooseImage} onReset={resetImage} />
    <ImageSetting label="Login Page Logo" field="loginLogoData" value={draft.loginLogoData} fallback="Uses the default logo" compact inputRef={refs.loginLogo} status={uploads.loginLogoData} onChoose={chooseImage} onReset={resetImage} resetLabel="Use Default" />
    <ImageSetting label="Login Background" field="loginBackgroundData" value={draft.loginBackgroundData} fallback="No login background selected" inputRef={refs.background} status={uploads.loginBackgroundData} onChoose={chooseImage} onReset={resetImage} help="Used on both Super Admin and Company Admin login pages." />
    <label>Template color<input type="color" value={draft.templateColor || "#0aa65f"} onChange={(e) => setValue("branding", "templateColor", e.target.value)} /></label>
    <label>Login text color<input type="color" value={draft.loginTextColor || "#0b2748"} onChange={(e) => setValue("branding", "loginTextColor", e.target.value)} /></label>
    <label>Login page background color<input type="color" value={draft.loginBackgroundColor || "#f4f8fb"} onChange={(e) => setValue("branding", "loginBackgroundColor", e.target.value)} /></label>
    <label>Login panel background color<input type="color" value={draft.loginPanelColor || "#ffffff"} onChange={(e) => setValue("branding", "loginPanelColor", e.target.value)} /></label>
    <label className="span2">Welcome text<input value={draft.welcomeText || ""} onChange={(e) => setValue("branding", "welcomeText", e.target.value)} /></label>
    <label className="span2">Bottom text<input value={draft.bottomText || ""} onChange={(e) => setValue("branding", "bottomText", e.target.value)} /></label>
    <label className="span2 loginTransparencySetting">Login panel transparency <span>{Math.max(0, Math.min(70, Number(draft.loginPanelTransparency ?? 18)))}%</span><input type="range" min="0" max="70" step="1" value={Math.max(0, Math.min(70, Number(draft.loginPanelTransparency ?? 18)))} onChange={(e) => setValue("branding", "loginPanelTransparency", Number(e.target.value))} /><small>0% is solid white. Higher values reveal more of the login background while keeping the form readable.</small></label>
    <label className="span2">Google Play Store URL<input type="url" value={draft.googlePlayUrl || ""} onChange={(e) => setValue("branding", "googlePlayUrl", e.target.value)} placeholder="https://play.google.com/store/apps/details?id=..." /></label>
    <label>Apple App Store URL<input type="url" value={draft.appStoreUrl || ""} onChange={(e) => setValue("branding", "appStoreUrl", e.target.value)} placeholder="https://apps.apple.com/app/..." /></label>
    <label>WhatsApp number<input type="tel" value={draft.whatsappNumber || ""} onChange={(e) => setValue("branding", "whatsappNumber", e.target.value)} placeholder="+974 5555 5555" /><small>Used by the WhatsApp button on both login pages. Include the country code.</small></label>
    <ImageSetting label="Default Favicon" field="faviconData" value={draft.faviconData} fallback="No favicon selected" compact inputRef={refs.favicon} status={uploads.faviconData} onChoose={chooseImage} onReset={resetImage} />
    <div className="span2 hintBox">New company portals use this default logo and favicon. A Company Admin can override only its own company logo.</div>
  </div>;
}

function TrackingFields({ draft, setValue }) {
  return <div className="settingsForm">
    <label>Server name<input value={draft.serverName || "MASAR TRACK"} onChange={(e) => setValue("tracking", "serverName", e.target.value)} /></label>
    <label>Server description<input value={draft.serverDescription || ""} onChange={(e) => setValue("tracking", "serverDescription", e.target.value)} /></label>
    <label>Tracker Host / Domain<input value={draft.trackerHost || ""} onChange={(e) => setValue("tracking", "trackerHost", e.target.value)} /></label>
    <label>INVIHA API URL<input value={draft.apiUrl || ""} onChange={(e) => setValue("tracking", "apiUrl", e.target.value)} /></label>
    <label>Default Protocol<select value={draft.defaultProtocol || "GT06"} onChange={(e) => setValue("tracking", "defaultProtocol", e.target.value)}>{protocolOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
    <label>Currently Untracked after no communication (minutes)<input type="number" min="1" value={draft.untrackedMinutes ?? 15} onChange={(e) => setValue("tracking", "untrackedMinutes", Number(e.target.value))} /></label>
    <label>Offline Threshold (minutes)<input type="number" min="2" value={draft.offlineMinutes ?? 300} onChange={(e) => setValue("tracking", "offlineMinutes", Number(e.target.value))} /></label>
    <label className="checkLine span2"><input type="checkbox" checked={draft.trackingPolicyEnabled === true} onChange={(e) => setValue("tracking", "trackingPolicyEnabled", e.target.checked)} /><span>Apply this global tracking policy to every company</span></label>
    <p className="span2 settingsHelp">When enabled, saving this panel applies the durations to existing and future vehicles. Freshness still controls only the live glow.</p>
  </div>;
}

function GeneralFields({ draft, setValue }) {
  return <div className="settingsForm">
    <label>Support Email<input value={draft.supportEmail || ""} onChange={(e) => setValue("general", "supportEmail", e.target.value)} /></label>
    <label>Support Phone<input value={draft.supportPhone || ""} onChange={(e) => setValue("general", "supportPhone", e.target.value)} /></label>
    <label>Timezone<input value={draft.timezone || ""} onChange={(e) => setValue("general", "timezone", e.target.value)} /></label>
    <label>Date format<select value={draft.dateFormat || "DD-MM-YYYY"} onChange={(e) => setValue("general", "dateFormat", e.target.value)}><option>DD-MM-YYYY</option><option>MM-DD-YYYY</option><option>YYYY-MM-DD</option></select></label>
    <label>Time format<select value={draft.timeFormat || "24h"} onChange={(e) => setValue("general", "timeFormat", e.target.value)}><option value="12h">12-hour with AM/PM</option><option value="24h">24-hour</option></select></label>
    <label>Duration format<select value={draft.durationFormat || "HH:mm:ss"} onChange={(e) => setValue("general", "durationFormat", e.target.value)}><option>HH:mm:ss</option><option>Human readable</option></select></label>
    <label>Distance unit<select value={draft.distanceUnit || "km"} onChange={(e) => setValue("general", "distanceUnit", e.target.value)}><option value="km">Kilometres (km)</option><option value="mi">Miles (mi)</option></select></label>
    <label>Capacity unit<select value={draft.capacityUnit || "L"} onChange={(e) => setValue("general", "capacityUnit", e.target.value)}><option>L</option><option>gal</option></select></label>
    <label>Altitude unit<select value={draft.altitudeUnit || "m"} onChange={(e) => setValue("general", "altitudeUnit", e.target.value)}><option>m</option><option>ft</option></select></label>
    <label>Distance decimals<select value={draft.distanceDecimals ?? 1} onChange={(e) => setValue("general", "distanceDecimals", Number(e.target.value))}><option value="0">0 (2 km)</option><option value="1">1 (2.5 km)</option><option value="2">2 (2.50 km)</option></select></label>
    <label>Language<select value={draft.language || "English"} onChange={(e) => setValue("general", "language", e.target.value)}><option>English</option><option>Arabic</option></select></label>
  </div>;
}

function MapsFields({ draft, setValue, setMany }) {
  const enabled = normalizedMapAccess(draft.enabledMaps);
  const keyField = (key, label, help = "") => <label>{label}<input type="password" value={draft[key] ?? ""} onChange={(e) => setValue("maps", key, e.target.value)} autoComplete="new-password" /><button className="clearSecretButton" type="button" onClick={() => setValue("maps", key, null)}>Clear saved key</button>{help && <small>{help}</small>}</label>;
  return <div className="settingsForm mapsGeocodingSettings">
    <fieldset className="span2 legacyMaps"><legend>Default maps</legend><div className="legacyMapActions"><button type="button" onClick={() => setValue("maps", "enabledMaps", allUserMapAccess())}>Select all</button><button type="button" onClick={() => setMany("maps", { enabledMaps: defaultUserMapAccess(), defaultBaseMap: "osm-road", mapProvider: "OpenStreetMap" })}>Deselect all</button></div>{mapAccessOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={enabled[key] !== false} onChange={(e) => setValue("maps", "enabledMaps", { ...enabled, [key]: e.target.checked })} />{label}</label>)}</fieldset>
    <label>Default map<select value={draft.defaultBaseMap || "osm-road"} onChange={(e) => setValue("maps", "defaultBaseMap", e.target.value)}>{mapOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Default map zoom<input type="number" min="2" max="20" value={draft.mapZoom ?? 11} onChange={(e) => setValue("maps", "mapZoom", Number(e.target.value))} /></label>
    <label>Address provider (primary)<select value={draft.geocoderPrimary || "nominatim"} onChange={(e) => setValue("maps", "geocoderPrimary", e.target.value)}>{geocoderOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Fallback address provider<select value={draft.geocoderFallback || "none"} onChange={(e) => setValue("maps", "geocoderFallback", e.target.value)}><option value="none">No fallback</option>{geocoderOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="checkLine"><input type="checkbox" checked={draft.geocoderCacheEnabled !== false} onChange={(e) => setValue("maps", "geocoderCacheEnabled", e.target.checked)} /><span>Enable geocoder cache</span></label>
    <label>Address cache days<input type="number" min="1" max="3650" disabled={draft.geocoderCacheEnabled === false} value={draft.geocoderCacheDays ?? 30} onChange={(e) => setValue("maps", "geocoderCacheDays", Number(e.target.value))} /></label>
    <label>Primary geocoder API URL<input value={draft.geocoderPrimaryApiUrl || ""} onChange={(e) => setValue("maps", "geocoderPrimaryApiUrl", e.target.value)} placeholder="Optional custom or self-hosted endpoint" /></label>
    <label>Address/fallback API URL<input value={draft.geocoderAddressApiUrl || ""} onChange={(e) => setValue("maps", "geocoderAddressApiUrl", e.target.value)} placeholder="Optional custom or self-hosted endpoint" /></label>
    <label>Map center latitude<input type="number" step="0.000001" value={draft.mapCenterLatitude ?? 25.2854} onChange={(e) => setValue("maps", "mapCenterLatitude", Number(e.target.value))} /></label>
    <label>Map center longitude<input type="number" step="0.000001" value={draft.mapCenterLongitude ?? 51.5310} onChange={(e) => setValue("maps", "mapCenterLongitude", Number(e.target.value))} /></label>
    <h4 className="span2">Map and street imagery keys</h4>
    {keyField("mapillaryAccessToken", "Mapillary access token", "Used only for street imagery.")}{keyField("mapTilerKey", "MapTiler browser key")}{keyField("mapboxToken", "Mapbox public token")}{keyField("hereMapsKey", "HERE browser key")}{keyField("tomtomMapsKey", "TomTom browser key")}{keyField("bingMapsKey", "Bing Maps browser key")}{keyField("yandexMapsKey", "Yandex Maps browser key")}
    <label className="span2">OpenMapTiles self-hosted tile URL<input value={draft.openMapTilesUrl || ""} onChange={(e) => setValue("maps", "openMapTilesUrl", e.target.value)} placeholder="https://maps.example.com/styles/osm/{z}/{x}/{y}.png" /></label>
    <label>OpenMapTiles attribution<input value={draft.openMapTilesAttribution || ""} onChange={(e) => setValue("maps", "openMapTilesAttribution", e.target.value)} /></label>
    <label>OpenMapTiles maximum zoom<input type="number" min="2" max="24" value={draft.openMapTilesMaxZoom ?? 20} onChange={(e) => setValue("maps", "openMapTilesMaxZoom", Number(e.target.value))} /></label>
    <h4 className="span2">Server geocoding keys</h4>
    {keyField("geoapifyKey", "Geoapify key")}{keyField("locationIqKey", "LocationIQ key")}{keyField("tomtomGeocodingKey", "TomTom geocoding key")}{keyField("mapboxGeocodingToken", "Mapbox geocoding token")}{keyField("hereGeocodingKey", "HERE geocoding key")}{keyField("mapTilerGeocodingKey", "MapTiler geocoding key")}
    <label>Nominatim API URL<input value={draft.nominatimApiUrl || "https://nominatim.openstreetmap.org"} onChange={(e) => setValue("maps", "nominatimApiUrl", e.target.value)} /></label>
    <h4 className="span2">Street imagery</h4>
    <label>Streetview API<select value={draft.streetviewProvider || "Mapillary"} onChange={(e) => setValue("maps", "streetviewProvider", e.target.value)}><option>None</option><option>Mapillary</option></select></label>
    {keyField("streetviewApiKey", "Streetview API key")}
    <div className="span2 hintBox">All customers use the platform geocoder selected here. Server geocoding keys are never sent to customer browsers.</div>
  </div>;
}

function SecurityFields({ draft, setValue }) {
  return <div className="settingsForm">
    <label>Expiry notification before days<input type="number" min="0" max="365" value={draft.expiryNotifyBeforeDays ?? 10} onChange={(e) => setValue("security", "expiryNotifyBeforeDays", Number(e.target.value))} /></label>
    <label>Expiry notification after days<input type="number" min="0" max="365" value={draft.expiryNotifyAfterDays ?? 10} onChange={(e) => setValue("security", "expiryNotifyAfterDays", Number(e.target.value))} /></label>
    <label>Days to keep vehicle camera images<input type="number" min="0" max="3650" value={draft.cameraImageRetentionDays ?? 30} onChange={(e) => setValue("security", "cameraImageRetentionDays", Number(e.target.value))} /><small>0 disables automatic camera-image deletion.</small></label>
    <label>Backup Retention (weeks)<input type="number" min="1" value={draft.backupRetention ?? 8} onChange={(e) => setValue("security", "backupRetention", Number(e.target.value))} /></label>
    <label>CAPTCHA provider<select value={draft.captchaProvider || "None"} onChange={(e) => setValue("security", "captchaProvider", e.target.value)}><option>None</option><option>Cloudflare Turnstile</option><option>Google reCAPTCHA</option></select></label>
    <label>CAPTCHA site key<input value={draft.captchaSiteKey ?? ""} onChange={(e) => setValue("security", "captchaSiteKey", e.target.value)} /><button className="clearSecretButton" type="button" onClick={() => setValue("security", "captchaSiteKey", null)}>Clear saved key</button></label>
    <label>CAPTCHA secret key<input type="password" autoComplete="new-password" value={draft.captchaSecretKey ?? ""} onChange={(e) => setValue("security", "captchaSecretKey", e.target.value)} /><button className="clearSecretButton" type="button" onClick={() => setValue("security", "captchaSecretKey", null)}>Clear saved key</button><small>Leave blank to retain an existing saved secret. Use Clear saved key to remove it.</small></label>
  </div>;
}

export default function MainServerSettingsPage({ settings, saveSettings, verifyBranding, applyBranding }) {
  const [draft, setDraft] = useState(() => clone(settings));
  const [feedback, setFeedback] = useState({});
  const [saving, setSaving] = useState("");
  const [uploads, setUploads] = useState({});
  const uploadSequence = useRef({});
  const changedFields = useRef(new Set());
  const refs = { logo: useRef(), collapsed: useRef(), loginLogo: useRef(), background: useRef(), favicon: useRef() };
  const processingImages = Object.values(uploads).some((item) => item?.status === "processing");

  const clearFeedback = (category) => setFeedback((current) => ({ ...current, [category]: null }));
  const setValue = (category, key, value) => {
    changedFields.current.add(key);
    setDraft((current) => ({ ...current, [key]: value }));
    clearFeedback(category);
  };
  const setMany = (category, values) => {
    Object.keys(values).forEach((key) => changedFields.current.add(key));
    setDraft((current) => ({ ...current, ...values }));
    clearFeedback(category);
  };
  const chooseImage = async (field, input, options) => {
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (!file) return;
    const sequence = (uploadSequence.current[field] || 0) + 1;
    uploadSequence.current[field] = sequence;
    clearFeedback("branding");
    setUploads((current) => ({ ...current, [field]: { status: "processing", message: "" } }));
    try {
      const value = await imageFileToDataUrl(file, options);
      if (uploadSequence.current[field] !== sequence) return;
      setDraft((current) => ({ ...current, [field]: value }));
      setUploads((current) => ({ ...current, [field]: { status: "ready", message: "" } }));
    } catch (error) {
      if (uploadSequence.current[field] !== sequence) return;
      setUploads((current) => ({ ...current, [field]: { status: "error", message: error.message || "The image could not be processed." } }));
    }
  };
  const resetImage = (field) => {
    uploadSequence.current[field] = (uploadSequence.current[field] || 0) + 1;
    setDraft((current) => ({ ...current, [field]: "" }));
    setUploads((current) => ({ ...current, [field]: { status: "ready", message: "" } }));
    clearFeedback("branding");
  };

  const validationError = (category) => {
    if (category === "tracking") return validateTrackingSettings(draft);
    if (category === "general") return validateGeneralSettings(draft);
    if (category === "maps") return validateMapSettings(draft, baseMapAccessKeys);
    if (category === "security") return validateSecuritySettings(draft, settings, changedFields.current);
    if (category === "branding" && processingImages) return "Wait for the selected images to finish processing.";
    return "";
  };
  const saveSection = async (category) => {
    const error = validationError(category);
    if (error) {
      setFeedback((current) => ({ ...current, [category]: { type: "error", message: error } }));
      return;
    }
    setSaving(category);
    setFeedback((current) => ({ ...current, [category]: { type: "progress", message: "Saving this section…" } }));
    try {
      const patch = createSettingsPatch(category, draft);
      const saved = await saveSettings(category, patch, category === "branding" ? { verify: verifyBranding } : undefined);
      if (category === "branding") applyBranding(saved);
      SETTINGS_SECTION_FIELDS[category].forEach((key) => changedFields.current.delete(key));
      const labels = { branding: "Global branding was saved. Public login branding was verified.", tracking: "Server and tracking settings were saved.", general: "General settings were saved.", maps: "Maps and geocoding settings were saved.", security: "Notification, retention and security settings were saved.", deployment: "Deployment notes were saved." };
      setFeedback((current) => ({ ...current, [category]: { type: "success", message: labels[category] } }));
    } catch (error) {
      setFeedback((current) => ({ ...current, [category]: { type: "error", message: error.message || "This section was not saved." } }));
    } finally {
      setSaving("");
    }
  };

  const panelProps = (category) => ({ category, feedback, saving: saving === category, disabled: Boolean(saving) || (category === "branding" && processingImages), onSave: saveSection });
  return <div className="page mainServerSettingsPage">
    <div className="titleRow"><div><h1>Main Server Settings</h1><p>Each card saves independently. Draft changes in the other cards stay on screen until you save them.</p></div></div>
    <div className="settingsColumns">
      <div className="settingsColumn">
        <SettingsPanel title="Global Branding" {...panelProps("branding")}><BrandingFields draft={draft} setValue={setValue} uploads={uploads} refs={refs} chooseImage={chooseImage} resetImage={resetImage} /></SettingsPanel>
        <SettingsPanel title="General" {...panelProps("general")}><GeneralFields draft={draft} setValue={setValue} /></SettingsPanel>
        <SettingsPanel title="Notifications, Retention & Security" {...panelProps("security")}><SecurityFields draft={draft} setValue={setValue} /></SettingsPanel>
      </div>
      <div className="settingsColumn">
        <SettingsPanel title="Server & Tracking" {...panelProps("tracking")}><TrackingFields draft={draft} setValue={setValue} /></SettingsPanel>
        <SettingsPanel title="Maps & Geocoding" {...panelProps("maps")}><MapsFields draft={draft} setValue={setValue} setMany={setMany} /></SettingsPanel>
        <SettingsPanel title="Deployment Notes" {...panelProps("deployment")}><textarea className="bigTextarea" value={draft.notes || ""} onChange={(e) => setValue("deployment", "notes", e.target.value)} placeholder="VPS notes, firewall ports, domain plan..." /></SettingsPanel>
      </div>
    </div>
  </div>;
}
