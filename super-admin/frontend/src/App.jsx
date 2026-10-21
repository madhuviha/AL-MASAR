import MasterData from "./MasterData.jsx";
import AccuracyFields from "../../../company-admin/frontend/src/AccuracyFields.jsx";
import { readClientPage, pushClientPage } from "../../../company-admin/frontend/src/client-routing.mjs";
import LanguagePreferences, { useLanguageSetting, useText } from "../../../company-admin/frontend/src/LanguagePreferences.jsx";
import { FormSection, VehicleAppearance, LoginVisual, LoginAppLinks, LoginSupportLinks, LoginBadge, LoginBrandText, LoginCaptcha, readLoginCaptchaToken, VehicleSymbol } from "../../../company-admin/frontend/src/FleetAppearance.jsx";
import {ExportDialogHost,requestExport} from "../../../company-admin/frontend/src/ExportDialog.jsx";
import SuperVehicleDetails from "./SuperVehicleDetails.jsx";
import { vehicleCategories } from "../../../company-admin/frontend/src/vehicle-catalog.mjs";
import { DeviceModelFields, SensorsIoPanel, DeviceProfileManager } from "./DeviceProfiles.jsx";
import { companyFieldOptions, companyRequiredFields, validateCompanyFields } from "../../../backend/company-field-policy.mjs";
import { anniversary } from "../../../backend/company-dates.mjs";
import ServerResources from "./ServerResources";
import PlatformMap from "./PlatformMap";
import { BrandLoading } from "./LoadingStatus.jsx";
import { mergeLoginBranding, validatePublicLoginBranding } from "./login-branding.mjs";
import FleetStatusChart, { fleetState } from "./FleetStatusChart";
import UnregisteredDevicesPage from "./UnregisteredDevicesPage.jsx";
import SupportDiagnosticsPage from "./SupportDiagnosticsPage.jsx";
import TrackingPortsPage from "./TrackingPortsPage.jsx";
import ReportSettingsPage from "./ReportSettingsPage.jsx";
import MainServerSettingsPage from "./MainServerSettingsPage.jsx";
import { settingsSectionChangedOnServer } from "./settings-sections.mjs";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Car,
  Smartphone,
  Map,
  Database,
  Settings,
  Activity,
  CloudDownload,
  CreditCard,
  LifeBuoy,
  UserRound,
  Globe2,
  LogOut,
  LogIn,
  ChevronDown,
  Search,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  MapPin,
  KeyRound,
  RadioTower,
  PlugZap,
  Boxes,
  Languages,
  FileSpreadsheet,
  Eye,
  Edit3,
  Trash2,
  Download,
  MoreVertical,
  Upload,
  Send,
  Save,
  X,
  Users,
  CalendarDays,
  Gauge,
  Truck,
  Bus,
  Container,
  Ambulance,
  Warehouse,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  HardDrive,
  Clock3,
  Wrench,
  Layers3,
  FileDown,
  FileUp,
  RotateCcw,
  Play,
  Pause,
  Filter,
  ChevronRight,
  Power,
  Route,
  MonitorCog,
  ReceiptText,
  MessageSquareText,
  Phone,
  AtSign,
  Building,
  Mail,
  Lock,
  Package,
  Shield,
  Cloud,
  DatabaseBackup,
  ClipboardList,
  Megaphone
} from "lucide-react";
const sensorOptions = ["Ignition", "Seat Belt", "RFID/iButton", "Fuel", "Temperature", "Door", "PTO", "External Power", "Internal Battery", "GPS", "GSM", "Harsh Braking", "Harsh Acceleration", "Harsh Cornering"];
const categoryOptions = vehicleCategories;
const protocolOptions = ["GT06", "Teltonika", "H02", "TK103", "Wialon IPS", "Other"];
const roleOptions = ["Company Admin", "Fleet Manager", "Dispatcher", "Supervisor", "Viewer"];
const mapAccessOptions = [["bingHybrid", "Bing Hybrid"], ["bingRoad", "Bing Normal"], ["bingSatellite", "Bing Satellite"], ["hereHybrid", "HERE Hybrid"], ["hereNormal", "HERE Normal"], ["hereSatellite", "HERE Satellite"], ["mapboxHybrid", "MapBox Hybrid"], ["mapboxStreets", "MapBox Normal"], ["mapboxSatellite", "MapBox Satellite"], ["mapTilerBasic", "MapTiler Basic"], ["mapTilerSatellite", "MapTiler Satellite"], ["mapTilerStreets", "MapTiler Streets"], ["cartoLiberty", "MapTiles Liberty"], ["cartoPositron", "MapTiles Positron"], ["openMapTiles", "OpenMapTiles OSM (self-hosted URL)"], ["railElectrification", "OpenRailway Electrification"], ["railInfrastructure", "OpenRailway Infrastructure"], ["railMaxSpeeds", "OpenRailway Max Speeds"], ["railSignaling", "OpenRailway Signaling"], ["openStreetMap", "OpenStreetMap"], ["tomtomBasic", "TomTom Basic"], ["tomtomSatellite", "TomTom Satellite"], ["yandex", "Yandex"], ["cartoDark", "MapTiles Dark"], ["openTopoMap", "OpenTopoMap"], ["esriStreet", "Esri Street"], ["esriSatellite", "Esri Satellite"], ["mapillary", "Mapillary Street Imagery"]];
const overlayMapAccessKeys = new Set(["railElectrification", "railInfrastructure", "railMaxSpeeds", "railSignaling", "mapillary"]);
const baseMapAccessKeys = mapAccessOptions.filter(([key]) => !overlayMapAccessKeys.has(key)).map(([key]) => key);
const geocoderOptions = [["nominatim", "Nominatim / OpenStreetMap"], ["geoapify", "Geoapify"], ["locationiq", "LocationIQ"], ["tomtom", "TomTom"], ["mapbox", "Mapbox"], ["here", "HERE"], ["maptiler", "MapTiler"], ["bing", "Bing Maps"]];
const normalizedMapAccess = (value = {}) => {
  return Object.fromEntries(mapAccessOptions.map(([key]) => [key, value[key] ?? true]));
};
const defaultUserMapAccess = () => Object.fromEntries(mapAccessOptions.map(([key]) => [key, key === "openStreetMap"]));
const allUserMapAccess = () => Object.fromEntries(mapAccessOptions.map(([key]) => [key, true]));
const GLOBAL_BRAND_KEY = "inviha_global_branding";
const imageFileToDataUrl = (file, { maxDimension = 512, quality = 0.82 } = {}) => new Promise((resolve, reject) => {
  if (!file) return reject(new Error("Choose an image file."));
  if (!String(file.type || "").startsWith("image/")) return reject(new Error("Choose a PNG, JPEG, WebP, SVG or icon image."));
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("The selected image could not be read."));
  reader.onload = () => {
    if (file.type === "image/svg+xml" || file.type === "image/x-icon" || file.type === "image/vnd.microsoft.icon") {
      resolve(String(reader.result || ""));
      return;
    }
    const img = new Image();
    img.onerror = () => reject(new Error("The selected image is damaged or unsupported."));
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height)), canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Image processing is unavailable in this browser.");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", quality));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("The selected image could not be processed."));
      }
    };
    img.src = String(reader.result || "");
  };
  reader.readAsDataURL(file);
});
const uploadData = (file, cb) => {
  if (!file) return;
  imageFileToDataUrl(file).then(cb).catch((error) => alert(error.message));
};
const applySuperBranding = (settings) => {
  const b = { logoData: settings.loginLogoData || settings.brandLogoData || "", collapsedLogoData: settings.collapsedLogoData || "", faviconData: settings.faviconData || "", loginBackgroundData: "", loginBackgroundUrl: settings.loginBackgroundData ? "/inviha-api/api/public/login-background" : "", loginPanelTransparency: Math.max(0, Math.min(70, Number(settings.loginPanelTransparency ?? 18))), templateColor: settings.templateColor || "#0aa65f", loginTextColor: settings.loginTextColor || "#0b2748", loginBackgroundColor: settings.loginBackgroundColor || "#f4f8fb", loginPanelColor: settings.loginPanelColor || "#ffffff", welcomeText: settings.welcomeText || "", bottomText: settings.bottomText || "", portalTitle: settings.portalTitle || "Fleet Management", companyBrowserTitle: settings.companyBrowserTitle || settings.portalTitle || "Fleet Management", googlePlayUrl: settings.googlePlayUrl || "", appStoreUrl: settings.appStoreUrl || "", whatsappNumber: settings.whatsappNumber || "", timezone: settings.timezone || "Asia/Qatar", dateFormat: settings.dateFormat || "DD-MM-YYYY", timeFormat: settings.timeFormat || "24h" };
  localStorage.setItem(GLOBAL_BRAND_KEY, JSON.stringify(b));
  document.title = settings.browserTitle || "INVIHA TRACK \u2022 Super Admin";
  let l = document.querySelector('link[rel~="icon"]');
  if (!l) {
    l = document.createElement("link");
    l.rel = "icon";
    document.head.appendChild(l);
  }
  l.href = settings.faviconData || "/admin/favicon.svg";
};
const API_BASE = "/inviha-api/api";
const AUTH_KEY = "inviha_super_token";
const getToken = () => localStorage.getItem(AUTH_KEY) || "";
async function apiJson(path, options = {}) {
  const token = getToken();
  const r = await fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json", ...token ? { Authorization: `Bearer ${token}` } : {}, ...options.headers || {} }, ...options });
  let body = null;
  try {
    body = await r.json();
  } catch {
  }
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/setup-')) {
      localStorage.removeItem(AUTH_KEY);
      setTimeout(() => location.reload(), 0);
    }
    const raw = body?.error;
    const e = new Error(raw && /[ .]/.test(raw) && !/[{}<>]/.test(raw) ? raw : { 401: "Please sign in again.", 403: "You do not have permission for this action.", 409: "Records changed. Refresh and try again." }[r.status] || "The request could not be completed. Please try again.");
    e.body = body;
    throw e;
  }
  return body;
}
async function verifyPublicLoginBranding(settings) {
  const response = await fetch(`${API_BASE}/public/branding?verify=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("The public login branding could not be checked.");
  const branding = await response.json();
  validatePublicLoginBranding(settings, branding);
  if (String(settings.loginBackgroundData || "").startsWith("data:image/")) {
    const backgroundUrl = String(branding.loginBackgroundUrl || "");
    const join = backgroundUrl.includes("?") ? "&" : "?";
    const background = await fetch(`${backgroundUrl}${join}verify=${Date.now()}`, { cache: "no-store" });
    if (!background.ok || background.status === 204 || !(await background.arrayBuffer()).byteLength) {
      throw new Error("The saved login background is not available to the public login page.");
    }
  }
  return branding;
}
const localDateTimeToIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
function apiCompanyToUi(c) {
  return { ...c.metadata || {}, id: Number(c.id), name: c.name, status: (c.status || "active").replace(/^./, (m) => m.toUpperCase()), email: c.email || "", mobile: c.metadata?.mobile || "", address: c.metadata?.address || "", country: c.metadata?.country || "", plan: c.metadata?.plan || "", vehicleLimit: c.metadata?.vehicleLimit ?? 0, created: c.created_at || "", expiry: c.metadata?.expiry || "" };
}
function apiVehicleToUi(v) {
  return { ...v.metadata || {}, id: Number(v.id), name: v.name || "", plate: v.plate_number || "", license: v.registration || "", company: v.company_name || "", companyId: v.company_id ? Number(v.company_id) : null, imei: v.imei || "", protocol: v.protocol || "GT06", deviceModel: v.device_model || "", status: (v.status || "Offline").replace(/^./, (m) => m.toUpperCase()), deviceStatus: (v.connection_status || v.device_status || "offline").replace(/^./, (m) => m.toUpperCase()), category: v.metadata?.category || "Car", userEmail: v.metadata?.userEmail || "", expiry: v.expiration_date ? String(v.expiration_date).slice(0, 10) : "", sensorGroup: v.metadata?.sensorGroup || "", sensors: v.metadata?.sensors || [], deviceId: v.traccar_device_id || null, active: v.active !== false, latitude: v.latitude ?? null, longitude: v.longitude ?? null, current_driver: v.current_driver, mapped_io: v.mapped_io, telemetry: v.telemetry, speedKph: v.speed_kph ?? null, ignition: v.ignition ?? null, motion: v.motion ?? null, lastUpdate: v.last_update || null, positionTime: v.position_time || null, course: v.course ?? null, altitude: v.altitude ?? null, attributes: v.attributes || {}, fixTime: v.fix_time, positionValid: v.position_valid };
}
const companyPermissionOptions = ["Dashboard", "Live Map", "Vehicle List", "Vehicle Details", "History", "Trips", "Playback", "Reports", "Drivers", "RFID / iButton", "Alerts", "Geofences", "Sensors", "Fuel Monitoring", "Temperature Monitoring", "Seat Belt Monitoring", "Ignition Status", "Harsh Braking", "Harsh Acceleration", "Harsh Cornering", "Overspeed", "Idling", "Maintenance", "Commands", "Immobilizer", "Export Reports", "User Management"];
const companyVehiclePermissionOptions = ["Immobilizer", "Add Vehicle", "Edit Vehicle", "Delete Vehicle", "Change IMEI", "Change Tracker Configuration", "Sensors/I/O"];
const initialData = {
  settings: { companyName: "INVIHA Technologies", serverName: "MASAR TRACK", serverDescription: "Complete Fleet Management Solution", brandLogoData: "", loginLogoData: "", collapsedLogoData: "", faviconData: "", portalTitle: "Fleet Management", browserTitle: "INVIHA TRACK \u2022 Super Admin", companyBrowserTitle: "Fleet Management", supportEmail: "support@inviha.com", supportPhone: "+974", whatsappNumber: "", timezone: "Asia/Qatar", language: "English", dateFormat: "DD-MM-YYYY", timeFormat: "24h", durationFormat: "HH:mm:ss", distanceUnit: "km", capacityUnit: "L", altitudeUnit: "m", distanceDecimals: 1, trackerHost: "gps.inviha.com", apiUrl: "/inviha-api/api", defaultProtocol: "GT06", offlineMinutes: 300, untrackedMinutes: 15, backupRetention: 8, mapProvider: "OpenStreetMap", defaultBaseMap: "osm-road", mapZoom: 11, mapCenterLatitude: 25.2854, mapCenterLongitude: 51.5310, enabledMaps: Object.fromEntries(mapAccessOptions.map(([key]) => [key, true])), mapillaryAccessToken: "", mapTilerKey: "", mapboxToken: "", hereMapsKey: "", tomtomMapsKey: "", yandexMapsKey: "", openMapTilesUrl: "", openMapTilesAttribution: "", openMapTilesMaxZoom: 20, geocoderPrimary: "nominatim", geocoderFallback: "none", geocoderPrimaryApiUrl: "", geocoderAddressApiUrl: "", geocoderCacheEnabled: true, geocoderCacheDays: 30, nominatimApiUrl: "https://nominatim.openstreetmap.org", geoapifyKey: "", locationIqKey: "", tomtomGeocodingKey: "", mapboxGeocodingToken: "", hereGeocodingKey: "", mapTilerGeocodingKey: "", bingMapsKey: "", streetviewProvider: "Mapillary", streetviewApiKey: "", expiryNotifyBeforeDays: 10, expiryNotifyAfterDays: 10, cameraImageRetentionDays: 30, captchaProvider: "None", captchaSiteKey: "", captchaSecretKey: "", templateColor: "#0aa65f", loginTextColor: "#0b2748", loginBackgroundColor: "#f4f8fb", loginPanelColor: "#ffffff", welcomeText: "Welcome to MASAR TRACK", bottomText: "2026 © INVIHA Technologies", notes: "", loginBackgroundData: "", loginPanelTransparency: 18, googlePlayUrl: "https://play.google.com/store/apps/", appStoreUrl: "https://apps.apple.com/app/" },
  companies: [],
  subAccounts: {},
  adminModules: {},
  headerBanners: [],
  sensorGroups: [
    { id: 1, name: "Standard GPS", sensors: ["Ignition", "External Power", "Internal Battery", "GPS", "GSM"] },
    { id: 2, name: "Driver + Seatbelt", sensors: ["Ignition", "Seat Belt", "RFID/iButton", "External Power", "Internal Battery", "GPS", "GSM"] },
    { id: 3, name: "Full Fleet", sensors: ["Ignition", "Seat Belt", "RFID/iButton", "Fuel", "Temperature", "Door", "PTO", "External Power", "Internal Battery", "GPS", "GSM", "Harsh Braking", "Harsh Acceleration", "Harsh Cornering"] }
  ],
  vehicles: [],
  devices: [],
  pendingDevices: [],
  plans: [],
  tickets: [],
  auditLogs: [],
  serviceLogs: [],
  backups: [],
  profile: { name: "Super Admin", email: "", mobile: "", company: "INVIHA Technologies" }
};
const nav = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["news", "News & Updates", Megaphone],
  ["map", "Map", MapPin],
  ["companies", "Users", Users],
  ["vehicles", "Vehicles", Car],
  ["commands", "Commands", MonitorCog],
  ["events", "Events", Activity],
  ["content", "Content", Boxes, [
    ["emailTemplates", "Email templates", AtSign],
    ["smsTemplates", "SMS templates", MessageSquareText],
    ["mapIcons", "Map icons", MapPin],
    ["vehicleIcons", "Vehicle icons", Car],
    ["expenseTypes", "Vehicle expense types", ReceiptText],
    ["privacyPolicy", "Privacy policy", Shield],
    ["gpsActivation", "GPS vehicle activation", RadioTower],
    ["apnConfig", "APN configuration", Wifi],
    ["diemRates", "Diem rates", CalendarDays],
    ["commandTemplates", "Command templates", MonitorCog]
  ]],
  ["setup", "Setup", Settings, [
    ["emailSettings", "Email", AtSign],
    ["settings", "Main server settings", Settings],
    ["billingGateway", "Billing gateway", CreditCard],
    ["trackingPorts", "Tracking ports", RadioTower],
    ["reportSettings", "Report settings", FileSpreadsheet],
    ["language", "Languages", Languages],
    ["blockedIps", "Blocked IPs", Shield],
    ["tools", "Tools", Wrench],
    ["plugins", "Plugins", PlugZap],
    ["sensorGroups", "Sensor groups", Gauge],
    ["smsGateway", "SMS gateway", MessageSquareText],
    ["billing", "Vehicle plans", ReceiptText]
  ]],
  ["system", "Logs", FileSpreadsheet, [
    ["logs", "Tracker server logs", ClipboardList],
    ["unregisteredVehicles", "Unregistered Vehicles", AlertTriangle],
    ["reportLogs", "Scheduled report log", FileSpreadsheet],
    ["diagnostics", "Diagnostics", Activity],
    ["backups", "Data retention", DatabaseBackup],
    ["database", "Database", Database]
  ]]
];
const deepClone = (x) => JSON.parse(JSON.stringify(x));
function normalizeData(raw) {
  const base = deepClone(initialData);
  if (!raw || typeof raw !== "object") return base;
  const merged = { ...base, ...raw, settings: { ...base.settings, ...raw.settings && typeof raw.settings === "object" ? raw.settings : {} } };
  merged.settings.mapProvider = "OpenStreetMap";
  if (String(merged.settings.defaultBaseMap || "").startsWith("google-")) merged.settings.defaultBaseMap = "osm-road";
  merged.settings.enabledMaps = normalizedMapAccess(merged.settings.enabledMaps);
  if (merged.settings.geocoderPrimary === "google") merged.settings.geocoderPrimary = "nominatim";
  if (merged.settings.geocoderFallback === "google") merged.settings.geocoderFallback = "none";
  if (merged.settings.streetviewProvider === "Google Street View") merged.settings.streetviewProvider = "Mapillary";
  delete merged.settings.googleMapsKey;
  delete merged.settings.googleServerGeocodingKey;
  const arrayKeys = ["companies", "vehicles", "devices", "pendingDevices", "sensorGroups", "plans", "tickets", "auditLogs", "serviceLogs", "backups", "headerBanners"];
  for (const k of arrayKeys) if (!Array.isArray(merged[k])) merged[k] = base[k];
  if (!merged.subAccounts || typeof merged.subAccounts !== "object" || Array.isArray(merged.subAccounts)) merged.subAccounts = base.subAccounts;
  if (!merged.adminModules || typeof merged.adminModules !== "object" || Array.isArray(merged.adminModules)) merged.adminModules = {};
  if (!merged.profile || typeof merged.profile !== "object" || Array.isArray(merged.profile)) merged.profile = base.profile;
  return merged;
}
function loadData() {
  return deepClone(initialData);
}
function persist(d) {
}
function subscribeVehicleStream(onRows, onConnection) {
  let stopped = false, controller = null, retryTimer = null, retryMs = 1e3;
  const connect = async () => {
    if (stopped) return;
    controller = new AbortController();
    try {
      const token = getToken(), response = await fetch(`${API_BASE}/vehicles/stream`, { headers: { Accept: "text/event-stream", ...token ? { Authorization: `Bearer ${token}` } : {} }, signal: controller.signal });
      if (!response.ok || !response.body) throw new Error("stream_unavailable");
      onConnection?.(true);
      retryMs = 1e3;
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = "";
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          const event = block.split(/\r?\n/).find((x) => x.startsWith("event:"))?.slice(6).trim(), dataLine = block.split(/\r?\n/).filter((x) => x.startsWith("data:")).map((x) => x.slice(5).trim()).join("\n");
          if (event === "vehicles" && dataLine) {
            try {
              const rows = JSON.parse(dataLine);
              if (Array.isArray(rows)) onRows(rows);
            } catch {
            }
          }
        }
      }
    } catch (e) {
      if (!stopped && e.name !== "AbortError") onConnection?.(false);
    } finally {
      if (!stopped) {
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(15e3, retryMs * 2);
      }
    }
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    controller?.abort();
  };
}
function now() {
  return (/* @__PURE__ */ new Date()).toLocaleString();
}
function addAudit(data, setData, action, target, result = "Success") {
  setData({ ...data, auditLogs: [{ id: Date.now(), time: now(), user: data.profile?.name || "Super Admin", action, target, result }, ...data.auditLogs || []].slice(0, 500) });
}
function downloadCsv(name, rows) {
  requestExport(name,rows,{formats:['csv','xlsx','json']});
}
function downloadBlob(name, content, type = "application/octet-stream") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
}
function companyVehicleCount(data, name) {
  return data.vehicles.filter((v) => v.company === name).length;
}
function companyUserCount(data, name) {
  return (data.subAccounts[name] || []).length;
}
function fmtDate(v) {
  if (!v) return "\u2014";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return v;
  }
}
function useStableSidebar() {
  const [expanded, setExpanded] = useState(false), timers = useRef({ enter: null, leave: null }), holdUntil = useRef(0);
  useEffect(() => () => {
    clearTimeout(timers.current.enter);
    clearTimeout(timers.current.leave);
  }, []);
  const onMouseEnter = () => {
    clearTimeout(timers.current.leave);
    clearTimeout(timers.current.enter);
    timers.current.enter = setTimeout(() => setExpanded(true), 120);
  };
  const onMouseLeave = () => {
    clearTimeout(timers.current.enter);
    clearTimeout(timers.current.leave);
    const wait = Math.max(360, holdUntil.current - Date.now());
    timers.current.leave = setTimeout(() => setExpanded(false), wait);
  };
  const onNavigate = () => {
    holdUntil.current = Date.now() + 700;
    clearTimeout(timers.current.leave);
    setExpanded(true);
  };
  return { expanded, onMouseEnter, onMouseLeave, onNavigate };
}
function SuperLogin({ onReady }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [showPassword, setShowPassword] = useState(false), [name, setName] = useState("Super Admin"), [setup, setSetup] = useState(false), [loading, setLoading] = useState(true), [submitting, setSubmitting] = useState(false), [error, setError] = useState("");
  const friendly = (e) => ({ invalid_credentials: "Incorrect email or password.", account_disabled: "This account is disabled.", login_failed: "Unable to sign in right now.", captcha_required: "Complete the security check and try again.", email_and_password_required: "Enter a valid email and a password of at least 8 characters.", super_admin_already_exists: "The Super Admin account is already configured." })[e] || "Unable to sign in. Check your details or contact your administrator.";
  useEffect(() => {
    fetch(`${API_BASE}/auth/setup-status`).then((r) => {
      if (!r.ok) throw Error("Server unavailable");
      return r.json();
    }).then((x) => setSetup(!!x.setupRequired)).catch(() => setError("Unable to reach the INVIHA server.")).finally(() => setLoading(false));
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      if (setup) {
        await apiJson("/auth/setup-super-admin", { method: "POST", body: JSON.stringify({ name, email, password }) });
        setSetup(false);
      }
      const out = await apiJson("/auth/login", { method: "POST", body: JSON.stringify({ email, password, captchaToken: readLoginCaptchaToken() }) });
      if (out.user?.role !== "super_admin") throw new Error("Super Admin access required.");
      localStorage.setItem(AUTH_KEY, out.token);
      onReady(out.user);
    } catch (ex) {
      setError(friendly(ex.body?.error || ex.message));
    } finally {
      setSubmitting(false);
    }
  }
  return <div className="authPage productionAdminLogin" style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh", display: "grid", placeItems: "center", margin: 0, padding: 16, boxSizing: "border-box" }}><LoginVisual /><form className="authCard productionAdminCard masarLoginCard" onSubmit={submit} style={{ margin: "auto", width: "min(520px,calc(100vw - 32px))" }}><LoginBadge /><h1>{setup ? "Create Super Admin" : "Welcome back"}</h1><p>{setup ? "Create the first administrator account for this server." : "Sign in to your account."}</p>{setup && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>}<label><span className="loginFieldLabel">Email address</span><span className="loginInputWrap"><Mail /><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></span></label><label><span className="loginFieldLabel">Password</span><span className="fleetPassword loginInputWrap"><Lock /><input type={showPassword ? "text" : "password"} autoComplete={setup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength="8" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Eye /></button></span></label>{error && <div className="authError">{error}</div>}<LoginCaptcha/><button className="greenBtn" disabled={loading || submitting}>{loading ? "Checking server..." : submitting ? "Logging in\u2026" : setup ? "Create Account & Login" : "Login"}</button><div className="loginSecurityLine"><span/><ShieldCheck/><b>Secure fleet access</b><span/></div><LoginAppLinks /><LoginSupportLinks /><LoginBrandText position="bottom"/></form></div>;
}
function Sidebar({ page, setPage, counts, settings, onLogout, onRestartTracking, restarting }) {
  const t = useText();
  const [open, setOpen] = useState({ content: false, setup: true, system: false });
  const side = useStableSidebar();
  const sideRef = useRef();
  const onSideKey = (e) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const btns = [...sideRef.current.querySelectorAll(".navBtn,.subNav button,.logout")].filter((x) => x.offsetParent !== null);
    if (!btns.length) return;
    e.preventDefault();
    let i = btns.indexOf(document.activeElement);
    if (e.key === "Home") i = 0;
    else if (e.key === "End") i = btns.length - 1;
    else if (e.key === "ArrowDown") i = i < 0 ? 0 : (i + 1) % btns.length;
    else i = i < 0 ? btns.length - 1 : (i - 1 + btns.length) % btns.length;
    btns[i]?.focus();
  };
  return <aside ref={sideRef} tabIndex={0} aria-label="Super Admin navigation" className={`sidebar ${side.expanded ? "expanded" : ""}`} onKeyDown={onSideKey} onMouseEnter={side.onMouseEnter} onMouseLeave={side.onMouseLeave}><div className="brand">{settings?.brandLogoData ? <img className="brandLogoImg" src={settings.brandLogoData} alt="Admin logo" /> : <><div className="fallbackFullMark">V</div><div className="brandText"><b>INVIHA TRACK</b><small>SUPER ADMIN</small></div></>}{settings?.collapsedLogoData ? <img className="compactAdminLogo" src={settings.collapsedLogoData} alt="Collapsed admin logo" /> : <div className="compactAdminMark">V</div>}</div><div className="sideScroll">{nav.map(([key, label, Icon, children]) => <div key={key}>{children ? <><button aria-label={t(label)} className={"navBtn " + (children.some((x) => x[0] === page) ? "active" : "")} onClick={() => {
    side.onNavigate();
    setOpen((o) => ({ content: false, setup: false, system: false, [key]: !o[key] }));
  }}><Icon /><span>{t(label)}</span><ChevronDown className={"chev " + (open[key] ? "rot" : "")} /></button>{open[key] && <div className="subNav">{children.map(([ck, cl, CI]) => <button key={ck} aria-label={t(cl)} className={page === ck ? "activeSub" : ""} onClick={() => {
    side.onNavigate();
    setPage(ck);
  }}><CI /><span>{t(cl)}</span></button>)}</div>}</> : <button aria-label={t(label)} className={"navBtn " + (page === key ? "active" : "")} onClick={() => {
    side.onNavigate();
    setPage(key);
  }}><Icon /><span>{t(label)}</span>{key === "companies" && <em>{counts.admins}</em>}{key === "users" && <em>{counts.users}</em>}{key === "vehicles" && <em>{counts.vehicles}</em>}</button>}</div>)}<button className="navBtn sidebarRestart" disabled={restarting} onClick={() => {
    side.onNavigate();
    onRestartTracking();
  }}><RefreshCw className={restarting ? "spin" : ""} /><span>{restarting ? "Restarting tracking\u2026" : "Restart Tracking Service"}</span></button></div><button className="logout" aria-label={t("Logout")} onClick={onLogout}><LogOut /><span>{t("Logout")}</span></button></aside>;
}
function Header({ data, setData, setPage }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  function search() {
    const s = q.trim().toLowerCase();
    if (!s) return;
    const v = data.vehicles.find((x) => JSON.stringify(x).toLowerCase().includes(s));
    if (v) {
      setPage("vehicles");
      return;
    }
    const c = data.companies.find((x) => JSON.stringify(x).toLowerCase().includes(s));
    if (c) {
      setPage("companies");
      return;
    }
    alert("No company, vehicle or IMEI found.");
  }
  return <header><div className="search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search companies, vehicles, IMEI or locations..." /></div><div className="headRight"><button className="iconTop" onClick={() => setPage("diagnostics")} title="System status"><Activity /></button><div className="profile"><button onClick={() => setOpen(!open)}><div className="avatar">S</div><div><b>{data.profile?.name || "Super Admin"}</b><small>INVIHA Technologies</small></div><ChevronDown /></button>{open && <div className="profileMenu"><button onClick={() => {
    setPage("profile");
    setOpen(false);
  }}><UserRound />Profile</button><button onClick={() => {
    setPage("settings");
    setOpen(false);
  }}><Settings />Settings</button><button onClick={() => alert("Password change will be connected to production authentication.")}><KeyRound />Change Password</button><button onClick={() => {
    setPage("support");
    setOpen(false);
  }}><LifeBuoy />Help & Support</button><button className="red" onClick={() => {
    localStorage.removeItem(AUTH_KEY);
    location.reload();
  }}><LogOut />Logout</button></div>}</div></div></header>;
}
function Stat({ icon: Icon, label, value, tone = "blue", sub, onClick }) {
  return <button className={"stat statButton " + (onClick ? "clickable" : "")} onClick={onClick || void 0}><div className={"ico " + tone}><Icon /></div><div><small>{label}</small><b>{value}</b>{sub && <span>{sub}</span>}</div></button>;
}
function PageHead({ title, subtitle, children }) {
  const t = useText();
  return <div className="titleRow"><div><h1>{t(title)}</h1>{subtitle && <p>{subtitle}</p>}</div>{children && <div className="actions">{children}</div>}</div>;
}
function Panel({ title, subtitle, children, className = "" }) {
  const t = useText();
  return <section className={"panel " + className}>{(title || subtitle) && <div className="panelTitle"><div>{title && <h2>{t(title)}</h2>}{subtitle && <p>{subtitle}</p>}</div></div>}{children}</section>;
}
function Info({ label, value }) {
  return <div className="infoRow"><span>{label}</span><b>{value ?? "\u2014"}</b></div>;
}
function Modal({ title, onClose, children, wide = false, className = "" }) {
  const t = useText();
  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className={"modal " + (wide ? "modalWide " : "") + className}><div className="modalHead"><h2>{t(title)}</h2><button onClick={onClose}><X /></button></div>{children}</div></div>;
}
function StatusPill({ value }) {
  value = String(value || "Unknown").replace(/^./, (c) => c.toUpperCase());
  const good = ["Active", "Online", "Healthy", "Connected", "Running", "Success", "Resolved", "Moving"];
  const warn = ["Warning", "Pending", "Due", "Idle"];
  return <span className={"pill " + (value === "Parked" ? "purplePill" : value === "Not Tracked Yet" ? "grayPill" : good.includes(value) ? "greenPill" : warn.includes(value) ? "amberPill" : "redPill")}>{value}</span>;
}
function DeviceManagementCard({ data, setData, setPage }) {
  const [tab, setTab] = useState("Import");
  const [company, setCompany] = useState(data.companies[0]?.name || "");
  const [model, setModel] = useState("");
  const [edition, setEdition] = useState("Standard Edition");
  const [period, setPeriod] = useState("1 year");
  const [imeis, setImeis] = useState("");
  const [showImport, setShowImport] = useState(false);
  return <>
    <Panel className="deviceManagementCard"><div className="panelTitle"><div><h2>Device Management</h2><p>Import, sell, renew or upgrade device subscriptions.</p></div></div><div className="tabs dashboardActionTabs">{["Import", "Sale", "Renew", "Upgrade"].map((name) => <button key={name} className={tab === name ? "activeTab" : ""} onClick={() => setTab(name)}>{name}</button>)}</div>{tab === "Import" ? <div className="dashboardImportForm"><label>Company<select value={company} onChange={(e) => setCompany(e.target.value)}>{data.companies.map((c) => <option key={c.id}>{c.name}</option>)}</select></label><label>Model<select value={model} onChange={(e) => setModel(e.target.value)}><option value="">Select Model</option><option>H9</option><option>GT06</option><option>Teltonika</option></select></label><label>Edition<select value={edition} onChange={(e) => setEdition(e.target.value)}><option>Standard Edition</option><option>Professional Edition</option></select></label><label>Period<select value={period} onChange={(e) => setPeriod(e.target.value)}><option>1 year</option><option>2 years</option><option>Monthly</option></select></label><label className="dashboardImei"><span>IMEI numbers</span><textarea value={imeis} onChange={(e) => setImeis(e.target.value)} placeholder="Enter one IMEI per line" /></label><div className="dashboardImportActions"><button onClick={() => setShowImport(true)}><Upload />Upload CSV</button><button onClick={() => setPage("vehicles")}><FileDown />Template</button><button onClick={() => setImeis("")}>Refresh</button><button className="greenBtn" onClick={() => setShowImport(true)}><Upload />Import</button></div></div> : <div className="dashboardActionEmpty">{tab} device subscriptions from this dashboard.</div>}</Panel>{showImport && <BulkVehicleModal data={data} onClose={() => setShowImport(false)} onSave={(rows) => { setData({ ...data, vehicles: [...data.vehicles, ...rows] }); setShowImport(false); }} />}</>;
}
function Dashboard({ data, setData, setPage, apiReady }) {
  const online = data.vehicles.filter((x) => x.deviceStatus === "Online").length;
  const protocolCounts = data.devices.reduce((out, device) => { const key = String(device.protocol || "Other").toUpperCase(); out[key] = (out[key] || 0) + 1; return out; }, {});
  const protocolRows = Object.entries(protocolCounts).sort((a, b) => b[1] - a[1]);
  const deviceOnline = data.devices.filter((device) => String(device.status || "").toLowerCase() === "online").length;
  return <div className="page"><PageHead title="Welcome, Super Admin" subtitle="Platform overview across all customer companies."><button className="green" onClick={() => setPage("companies")}><Plus />Add Customer</button><button onClick={() => setPage("vehicles")}><Plus />Add Vehicle</button></PageHead><div className="stats fourStats"><Stat icon={Building2} label="Total Companies" value={data.companies.length} sub="Platform customers" onClick={() => setPage("companies")} /><Stat icon={Car} label="Total Vehicles" value={data.vehicles.length} tone="green" sub={`${online} online`} onClick={() => setPage("vehicles")} /><Stat icon={RadioTower} label="Total Devices" value={data.devices.length} tone="purple" sub={`${deviceOnline} online`} onClick={() => setPage("devices")} /><Stat icon={Users} label="Sub Accounts" value={Object.values(data.subAccounts).flat().length} tone="orange" sub="Across all companies" onClick={() => setPage("companies")} /></div><DeviceManagementCard data={data} setData={setData} setPage={setPage} /><div className="grid3"><Panel title="Platform Fleet Overview" subtitle="Quick operational snapshot" className="wide"><div className="miniBars">{data.companies.map((c) => <div key={c.id}><span>{c.name}</span><div><i style={{ width: `${Math.max(8, Math.min(100, companyVehicleCount(data, c.name) * 6))}%` }} /></div><b>{companyVehicleCount(data, c.name)} vehicles</b></div>)}</div></Panel><Panel title="Protocol Statistics"><div className="miniBars protocolBars">{protocolRows.length ? protocolRows.map(([protocol, count]) => <div key={protocol}><span>{protocol}</span><div><i style={{ width: `${Math.max(8, (count / Math.max(1, data.devices.length)) * 100)}%` }} /></div><b>{count} devices</b></div>) : <div className="empty">No device protocol data.</div>}</div></Panel><Panel title="Fleet Status"><FleetStatusChart vehicles={data.vehicles} settings={data.settings} /></Panel><Panel title="System Health"><ServerResources /><HealthRow label="Tracking Engine" value={apiReady ? "Check Diagnostics" : "Unavailable"} /><HealthRow label="Database" value={apiReady ? "Connected" : "Check API"} /><HealthRow label="API" value={apiReady ? "Healthy" : "Unavailable"} /><HealthRow label="Realtime" value={apiReady ? "Live refresh" : "Unavailable"} /><HealthRow label="Backup" value={`${data.backups.length} exports recorded`} /></Panel></div><Panel><div className="panelHead"><h2>Companies</h2><button onClick={() => setPage("companies")}>View All</button></div><table><thead><tr><th>Customer / Company</th><th>Vehicles</th><th>Sub Accounts</th><th>Status</th><th>Expiry</th></tr></thead><tbody>{data.companies.map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td>{companyVehicleCount(data, c.name)}</td><td>{companyUserCount(data, c.name)}</td><td><StatusPill value={c.status} /></td><td>{fmtDate(c.expiry)}</td></tr>)}</tbody></table></Panel></div>;
}
function HealthRow({ label, value }) {
  return <div className="health"><span><i className="dot greenDot" />{label}</span><b>{value}</b></div>;
}
function CompaniesPage({ data, setData, setPage, setCompanyFilter }) {
  const [q, setQ] = useState(""), [form, setForm] = useState(null), [menu, setMenu] = useState(null), [expanded, setExpanded] = useState(null);
  const vehiclesFor = (company) => data.vehicles.filter((v) => String(v.company || "").toLowerCase() === String(company.name || "").toLowerCase() || String(v.companyId) === String(company.id));
  const isCompanyAdmin = (user) => String(user?.role || user?.metadata?.displayRole || "").replace(/[_\s]+/g, " ").trim().toLowerCase() === "company admin";
  const accountGroups = data.companies.map((company) => {
    const accounts = [...data.subAccounts[company.name] || []].sort((a, b) => Number(a.id) - Number(b.id));
    const main = accounts.find(isCompanyAdmin) || null;
    const subAccounts = main ? accounts.filter((u) => String(u.id) !== String(main.id)) : accounts;
    return { company, main, subAccounts, vehicles: vehiclesFor(company) };
  }).filter((group) => group.main && JSON.stringify(group).toLowerCase().includes(q.toLowerCase()));
  const [currentPage, setCurrentPage] = useState(1), pageSize = 25, pageCount = Math.max(1, Math.ceil(accountGroups.length / pageSize)), safePage = Math.min(currentPage, pageCount), visibleGroups = accountGroups.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => setCurrentPage(1), [q]);
  useEffect(() => setCurrentPage((page) => Math.min(page, pageCount)), [pageCount]);
  const firstName = (u) => u?.metadata?.firstName || u?.firstName || u?.name?.split(" ")[0] || "";
  const lastName = (u) => u?.metadata?.lastName || u?.lastName || u?.name?.split(" ").slice(1).join(" ") || "";
  async function loginAs(user) {
    if (!user) return;
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      alert("Allow popups to open the user account.");
      return;
    }
    try {
      const out = await apiJson("/users/" + user.id + "/support-login", { method: "POST" });
      tab.location.replace(window.location.origin.replace("admin.", "track.") + "/?supportToken=" + encodeURIComponent(out.token));
    } catch (e) {
      tab.close();
      alert(e.body?.error || "Unable to open the user account.");
    }
  }
  const saveUser = (company, user) => {
    const current = data.subAccounts[company.name] || [];
    const exists = current.some((x) => String(x.id) === String(user.id));
    const next = exists ? current.map((x) => String(x.id) === String(user.id) ? user : x) : [...current, { ...user, id: user.id || Date.now() }];
    setData({ ...data, subAccounts: { ...data.subAccounts, [company.name]: next } });
    setForm(null);
  };
  const removeUser = (company, user) => {
    if (!user || !confirm("Delete login account " + user.email + "?")) return;
    const current = data.subAccounts[company.name] || [];
    setData({ ...data, subAccounts: { ...data.subAccounts, [company.name]: current.filter((x) => String(x.id) !== String(user.id)) } });
    setMenu(null);
  };
  const toggleDetails = (companyId, section) => setExpanded((current) => current?.companyId === companyId && current?.section === section ? null : { companyId, section });
  return <div className="page usersDirectoryPage"><PageHead title={"Company Admins (" + accountGroups.length + ")"} subtitle="Main customer administrator accounts. Click Vehicles to manage that company's vehicles, or Subusers to view its accounts."><button className="green" onClick={() => setForm({ company: data.companies.find((c) => !(data.subAccounts[c.name] || []).some(isCompanyAdmin)) || data.companies[0] || null, user: { role: "Company Admin", group: "Company Admin" } })}><Plus />Add Admin</button><button onClick={() => downloadCsv("company-admins.csv", accountGroups.map(({ company, main, subAccounts, vehicles }) => ({ userId: main.id, companyId: company.id, email: main.email || "", name: main.name || "", company: company.name, subusers: subAccounts.length, vehicles: vehicles.length })))}><Download />Export</button></PageHead><Panel className="usersDirectoryPanel"><div className="filterRow"><div className="search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company administrator, email or company..." /></div></div><div className="usersTableWrap"><table className="legacyUsersTable mainUsersTable"><thead><tr><th>User ID</th><th>Company ID</th><th>Active</th><th>Email</th><th>First name</th><th>Last name</th><th>Company</th><th>Role</th><th>Manager</th><th>Vehicles</th><th>Subusers</th><th>Vehicle limit</th><th>Expiration date</th><th>Last login</th><th>Actions</th></tr></thead><tbody>{visibleGroups.map(({ company, main, subAccounts, vehicles }) => {
    const detail = expanded?.companyId === company.id ? expanded.section : null;
    return <React.Fragment key={company.id}><tr className={detail ? "legacyUserOpen" : ""}><td><span className="recordIdBadge">U-{main.id}</span></td><td><span className="recordIdBadge">C-{company.id}</span></td><td><span className={main.status !== "Inactive" ? "activeBadge" : "inactiveBadge"}>{main.status || "Active"}</span></td><td>{main.email}</td><td>{firstName(main) || "\u2014"}</td><td>{lastName(main) || "\u2014"}</td><td><b>{company.name}</b></td><td>{main.role || "Company Admin"}</td><td>{main.metadata?.manager || main.manager || "\u2014"}</td><td><button className="tableLink countButton" title="Open company vehicles" onClick={() => {
      setCompanyFilter(company.name);
      setPage("vehicles");
    }}>{vehicles.length}</button></td><td><button className={"tableLink countButton " + (detail === "subusers" ? "countActive" : "")} onClick={() => toggleDetails(company.id, "subusers")}>{subAccounts.length}</button></td><td>{company.vehicleLimit || "Unlimited"}</td><td>{company.expiry ? fmtDate(company.expiry) : "Unlimited"}</td><td>{main.metadata?.lastLogin || main.lastLogin || "\u2014"}</td><td className="actionCell"><button className="iconBtn" title="Actions" onClick={() => setMenu(menu === company.id ? null : company.id)}><Settings /></button>{menu === company.id && <div className="rowMenu"><button onClick={() => {
      setForm({ company, user: main });
      setMenu(null);
    }}><Edit3 />Edit admin</button><button onClick={() => loginAs(main)}><LogIn />Log in as</button><button className="red" onClick={() => removeUser(company, main)}><Trash2 />Delete</button></div>}</td></tr>{detail === "subusers" && <tr className="legacyVehicleRows"><td colSpan="15"><div className="singleAccountExpansion"><section><div className="legacyVehicleHead"><b>Subusers · {company.name}</b><span>{subAccounts.length} account(s)</span><button className="tableAddButton" onClick={() => setForm({ company, user: null })}><Plus />Add subuser</button></div>{subAccounts.length ? subAccounts.map((user) => <div className="subAccountRow" key={user.id}><span className="recordIdBadge">U-{user.id}</span><span><b>{user.name}</b><small>{user.email}</small></span><span>{user.role || "User"}</span><span><StatusPill value={user.status} /></span><span className="subAccountActions"><button onClick={() => setForm({ company, user })}><Edit3 />Edit</button><button onClick={() => loginAs(user)}><LogIn />Login</button></span></div>) : <div className="empty nestedEmpty">No subusers for this administrator.</div>}</section></div></td></tr>}</React.Fragment>;
  })}</tbody></table>{!accountGroups.length && <div className="empty">No company administrator accounts match this search.</div>}</div><div className="usersPagination"><span>Showing {accountGroups.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, accountGroups.length)} of {accountGroups.length} admins</span><div><button type="button" disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button><strong>Page {safePage} of {pageCount}</strong><button type="button" disabled={safePage === pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}>Next</button></div></div></Panel>{form && <ReferenceUserAccountForm data={data} company={form.company} user={form.user} onClose={() => setForm(null)} onSave={saveUser} />}</div>;
}
function CompanyUsersPage({ data, setData }) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [adminMenu, setAdminMenu] = useState(null);
  const [vehicleMenu, setVehicleMenu] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [viewVehicle, setViewVehicle] = useState(null);
  const [editVehicle, setEditVehicle] = useState(null);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const isCompanyAdmin = (user) => String(user?.role || user?.metadata?.displayRole || "").replace(/[_\s]+/g, " ").trim().toLowerCase() === "company admin";
  const firstName = (user) => user?.metadata?.firstName || user?.firstName || user?.name?.split(" ")[0] || "";
  const lastName = (user) => user?.metadata?.lastName || user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "";
  const groups = data.companies.map((company) => {
    const accounts = [...data.subAccounts[company.name] || []].sort((a, b) => Number(a.id) - Number(b.id));
    const main = accounts.find(isCompanyAdmin) || null;
    const subAccounts = main ? accounts.filter((user) => String(user.id) !== String(main.id)) : accounts;
    const vehicles = data.vehicles.filter((vehicle) => String(vehicle.company || "").toLowerCase() === String(company.name || "").toLowerCase() || String(vehicle.companyId) === String(company.id));
    return { company, main, subAccounts, vehicles };
  }).filter((group) => group.main && JSON.stringify(group).toLowerCase().includes(q.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(groups.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const visibleGroups = groups.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => setCurrentPage(1), [q]);
  useEffect(() => setCurrentPage((page) => Math.min(page, pageCount)), [pageCount]);
  const toggle = (companyId, section) => {
    setVehicleMenu(null);
    setExpanded((current) => current?.companyId === companyId && current?.section === section ? null : { companyId, section });
  };
  async function loginAs(user) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) return alert("Allow popups to open the user account.");
    try {
      const out = await apiJson("/users/" + user.id + "/support-login", { method: "POST" });
      tab.location.replace(window.location.origin.replace("admin.", "track.") + "/?supportToken=" + encodeURIComponent(out.token));
    } catch (error) {
      tab.close();
      alert(error.body?.error || "Unable to open the user account.");
    }
  }
  const saveUser = (company, user) => {
    const current = data.subAccounts[company.name] || [];
    const exists = current.some((item) => String(item.id) === String(user.id));
    const next = exists ? current.map((item) => String(item.id) === String(user.id) ? user : item) : [...current, { ...user, id: user.id || Date.now() }];
    setData({ ...data, subAccounts: { ...data.subAccounts, [company.name]: next } });
    setForm(null);
  };
  const removeUser = (company, user) => {
    if (!confirm("Delete login account " + user.email + "?")) return;
    const current = data.subAccounts[company.name] || [];
    setData({ ...data, subAccounts: { ...data.subAccounts, [company.name]: current.filter((item) => String(item.id) !== String(user.id)) } });
    setAdminMenu(null);
  };
  async function removeVehicle(vehicle) {
    if (!confirm("Archive " + vehicle.name + " and disable its tracker?")) return;
    try {
      await apiJson("/vehicles/" + vehicle.id, { method: "DELETE" });
      await setData({ ...data, vehicles: data.vehicles.filter((item) => item.id !== vehicle.id) });
      setVehicleMenu(null);
    } catch (error) {
      alert(error.body?.error || error.message);
    }
  }
  async function saveVehicle(vehicle) {
    try {
      setSavingVehicle(true);
      const company = data.companies.find((item) => item.name === vehicle.company);
      if (!company) throw new Error("Select a valid user and company.");
      await apiJson("/vehicles", { method: "POST", body: JSON.stringify({ companyId: String(company.id), name: vehicle.name, plateNumber: vehicle.plate, registration: vehicle.license, imei: vehicle.imei, protocol: vehicle.protocol, deviceModel: vehicle.deviceModel, expirationDate: vehicle.expiry || null, active: vehicle.active !== false, metadata: vehicle, id: vehicle.id }) });
      const latest = await apiJson("/vehicles");
      await setData({ ...data, vehicles: (Array.isArray(latest) ? latest : []).map(apiVehicleToUi) });
      setEditVehicle(null);
    } catch (error) {
      alert("Vehicle save failed: " + (error.body?.error || error.message));
    } finally {
      setSavingVehicle(false);
    }
  }
  return <div className="page usersDirectoryPage"><PageHead title={`Users (${groups.length})`} subtitle="Main customer administrator accounts. Click the Vehicles or Subusers count to view details."><button className="green" disabled={!data.companies.length} onClick={() => setForm({ company: data.companies.find((company) => !(data.subAccounts[company.name] || []).some(isCompanyAdmin)) || data.companies[0], user: { role: "Company Admin", group: "Company Admin" } })}><Plus />Add User</button><button onClick={() => downloadCsv("users.csv", groups.map(({ company, main, subAccounts, vehicles }) => ({ userId: main.id, companyId: company.id, email: main.email || "", name: main.name || "", company: company.name, subusers: subAccounts.length, vehicles: vehicles.length })))}><Download />Export</button></PageHead><Panel className="usersDirectoryPanel"><div className="filterRow"><div className="search"><Search /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search company administrator, email or company..." /></div></div><div className="usersTableWrap"><table className="legacyUsersTable mainUsersTable mergedUsersTable"><thead><tr><th>User ID</th><th>Company ID</th><th>Active</th><th>Email</th><th>First name</th><th>Last name</th><th>Company</th><th>Role</th><th>Manager</th><th>Vehicles</th><th>Subusers</th><th>Vehicle limit</th><th>Expiration date</th><th>Last login</th><th>Actions</th></tr></thead><tbody>{visibleGroups.map(({ company, main, subAccounts, vehicles }) => {
    const detail = expanded?.companyId === company.id ? expanded.section : null;
    return <React.Fragment key={company.id}><tr className={detail ? "legacyUserOpen" : ""}><td><span className="recordIdBadge">U-{main.id}</span></td><td><span className="recordIdBadge">C-{company.id}</span></td><td><span className={main.status !== "Inactive" ? "activeBadge" : "inactiveBadge"}>{main.status || "Active"}</span></td><td>{main.email}</td><td>{firstName(main) || "—"}</td><td>{lastName(main) || "—"}</td><td><b>{company.name}</b></td><td>{main.role || "Company Admin"}</td><td>{main.metadata?.manager || main.manager || "—"}</td><td><button className={"tableLink countButton " + (detail === "vehicles" ? "countActive" : "")} onClick={() => toggle(company.id, "vehicles")}>{vehicles.length}</button></td><td><button className={"tableLink countButton " + (detail === "subusers" ? "countActive" : "")} onClick={() => toggle(company.id, "subusers")}>{subAccounts.length}</button></td><td>{company.vehicleLimit || "Unlimited"}</td><td>{company.expiry ? fmtDate(company.expiry) : "Unlimited"}</td><td>{main.metadata?.lastLogin || main.lastLogin || "—"}</td><td className="actionCell"><button className="iconBtn" title="User actions" onClick={() => setAdminMenu(adminMenu === company.id ? null : company.id)}><Settings /></button>{adminMenu === company.id && <div className="rowMenu"><button onClick={() => {
      setForm({ company, user: main });
      setAdminMenu(null);
    }}><Edit3 />Edit user</button><button onClick={() => loginAs(main)}><LogIn />Log in as</button><button className="red" onClick={() => removeUser(company, main)}><Trash2 />Delete</button></div>}</td></tr>{detail === "vehicles" && <tr className="mergedVehiclesRow"><td colSpan="15"><div className="mergedVehicleList">{vehicles.length ? vehicles.map((vehicle) => {
      const menuKey = `${company.id}:${vehicle.id}`;
      return <div className="mergedVehicleRow" key={vehicle.id}><b>{vehicle.name}</b><span>{vehicle.imei || "—"}</span><span className={String(vehicle.deviceStatus || vehicle.status || "").toLowerCase() === "online" || String(vehicle.status || "").toLowerCase() === "parked" ? "onlineDot" : "offlineDot"}>{vehicle.status || "Unknown"}</span><span>{vehicle.expiry || "Unlimited"}</span><span className="mergedVehicleAction"><button className="iconBtn" title={`Actions for ${vehicle.name}`} onClick={() => setVehicleMenu(vehicleMenu === menuKey ? null : menuKey)}><Settings /></button>{vehicleMenu === menuKey && <div className="rowMenu"><button onClick={() => {
        setViewVehicle(vehicle);
        setVehicleMenu(null);
      }}><Eye />View</button><button onClick={() => {
        setEditVehicle(vehicle);
        setVehicleMenu(null);
      }}><Edit3 />Edit</button><button className="red" onClick={() => removeVehicle(vehicle)}><Trash2 />Delete</button></div>}</span></div>;
    }) : <div className="empty nestedEmpty">No vehicles assigned to this administrator.</div>}</div></td></tr>}{detail === "subusers" && <tr className="legacyVehicleRows"><td colSpan="15"><div className="singleAccountExpansion"><section><div className="legacyVehicleHead"><b>Subusers · {company.name}</b><span>{subAccounts.length} account(s)</span><button className="tableAddButton" onClick={() => setForm({ company, user: null })}><Plus />Add subuser</button></div>{subAccounts.length ? subAccounts.map((user) => <div className="subAccountRow" key={user.id}><span className="recordIdBadge">U-{user.id}</span><span><b>{user.name}</b><small>{user.email}</small></span><span>{user.role || "User"}</span><span><StatusPill value={user.status} /></span><span className="subAccountActions"><button onClick={() => setForm({ company, user })}><Edit3 />Edit</button><button onClick={() => loginAs(user)}><LogIn />Login</button></span></div>) : <div className="empty nestedEmpty">No subusers for this administrator.</div>}</section></div></td></tr>}</React.Fragment>;
  })}</tbody></table>{!groups.length && <div className="empty">No customer administrator accounts match this search.</div>}</div><div className="usersPagination"><span>Showing {groups.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, groups.length)} of {groups.length} users</span><div><button type="button" disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button><strong>Page {safePage} of {pageCount}</strong><button type="button" disabled={safePage === pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}>Next</button></div></div></Panel>{form && <ReferenceUserAccountForm data={data} company={form.company} user={form.user} onClose={() => setForm(null)} onSave={saveUser} />}{viewVehicle && <SuperVehicleDetails vehicle={viewVehicle} data={data} onClose={() => setViewVehicle(null)} onEdit={(vehicle) => {
    setViewVehicle(null);
    setEditVehicle(vehicle);
  }} />}{editVehicle && <VehicleFormV2 data={data} vehicle={editVehicle} onClose={() => setEditVehicle(null)} onSave={saveVehicle} saving={savingVehicle} />}</div>;
}
function CompanyForm({ data, company, onClose, onSave }) {
  const [tab, setTab] = useState("main");
  const base = company ? { ...company } : { id: Date.now(), name: "", customerName: "", status: "Active", expiry: anniversary((/* @__PURE__ */ new Date()).toISOString().slice(0, 10)), email: "", mobile: "", address: "", country: "Qatar", logo: "", plan: data.plans[0]?.name || "Starter", vehicleLimit: 25, created: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), temporaryPassword: "", historyRetentionDays: 30, permissions: companyPermissionOptions.reduce((a, k) => ({ ...a, [k]: true }), {}), vehiclePermissions: companyVehiclePermissionOptions.reduce((a, k) => ({ ...a, [k]: false }), {}) };
  const [f, setF] = useState({ ...base, permissions: { ...companyPermissionOptions.reduce((a, k) => ({ ...a, [k]: true }), {}), ...base.permissions || {} }, vehiclePermissions: { ...companyVehiclePermissionOptions.reduce((a, k) => ({ ...a, [k]: false }), {}), ...base.vehiclePermissions || {} } });
  const togglePerm = (group, key) => setF({ ...f, [group]: { ...f[group], [key]: !f[group][key] } });
  return <Modal title={company ? "Edit Customer" : "Add Customer"} onClose={onClose} wide><div className="tabs"><button className={tab === "main" ? "activeTab" : ""} onClick={() => setTab("main")}>Main</button><button className={tab === "permissions" ? "activeTab" : ""} onClick={() => setTab("permissions")}>Permissions</button><button className={tab === "vehicle" ? "activeTab" : ""} onClick={() => setTab("vehicle")}>Vehicle Permissions</button><button className={tab === "access" ? "activeTab" : ""} onClick={() => setTab("access")}>Login / Access</button><button className={tab === "required" ? "activeTab" : ""} onClick={() => setTab("required")}>Mandatory fields</button></div>{tab === "required" && <div className="companyRequiredGroup"><h3>Required fields for this company</h3><p>Select the company form fields that must be filled before saving. Account name, email and the initial password are required to create a working login.</p><div className="sensorGrid">{companyFieldOptions.map(([key, label, , locked]) => <label className="checkCard" key={key}><input type="checkbox" checked={companyRequiredFields(f.requiredFields).includes(key)} disabled={locked} onChange={(e) => setF({ ...f, requiredFields: e.target.checked ? [...companyRequiredFields(f.requiredFields), key] : companyRequiredFields(f.requiredFields).filter((k) => k !== key) })} /><span>{label}{locked ? " \xB7 Required for account" : ""}</span></label>)}</div><p>Temporary password is required for a new company; it is optional when editing an existing company.</p></div>}{tab === "main" && <div className="formGrid"><label>Company Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label><label>Customer / Admin Name<input value={f.customerName || ""} onChange={(e) => setF({ ...f, customerName: e.target.value })} /></label><label>Admin Email<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label><label>Mobile<input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></label><label>Country<input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></label><label>Address<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label><label>Plan<select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>{data.plans.map((p) => <option key={p.id}>{p.name}</option>)}</select></label><label>Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>Active</option><option>Suspended</option></select></label><label>Reports & history retention (days)<input type="number" min="1" max="3650" value={f.historyRetentionDays ?? 30} onChange={(e) => setF({ ...f, historyRetentionDays: Math.max(1, Number(e.target.value) || 30) })} /><small>Default 30 days. Applies to every user in this company.</small></label><label className="span2">Company Logo / URL<input value={f.logo || ""} onChange={(e) => setF({ ...f, logo: e.target.value })} placeholder="Optional company logo URL / uploaded path" /></label></div>}{tab === "permissions" && <div className="sensorGrid permissionGrid">{companyPermissionOptions.map((k) => <label key={k} className="checkCard"><input type="checkbox" checked={!!f.permissions[k]} onChange={() => togglePerm("permissions", k)} /><span>{k}</span></label>)}</div>}{tab === "vehicle" && <><div className="hintBox permissionHint">These permissions are OFF by default. Enable only when this company is allowed to manage vehicles or tracker configuration.</div><div className="sensorGrid permissionGrid">{companyVehiclePermissionOptions.map((k) => <label key={k} className="checkCard"><input type="checkbox" checked={!!f.vehiclePermissions[k]} onChange={() => togglePerm("vehiclePermissions", k)} /><span>{k}</span></label>)}</div></>}{tab === "access" && <div className="formGrid"><label>Login Email<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label><label>Temporary Password<input type="text" value={f.temporaryPassword || ""} onChange={(e) => setF({ ...f, temporaryPassword: e.target.value })} placeholder="Set / reset temporary password" /></label><label>Activation Date<input type="date" value={(f.created || "").slice(0, 10)} onChange={(e) => {
    const created = e.target.value;
    if (!created) return;
    setF({ ...f, created, ...!company ? { expiry: anniversary(created) } : {} });
  }} /></label><label>Account Expiry<input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} /></label><label>Vehicle Limit<input type="number" value={f.vehicleLimit} onChange={(e) => setF({ ...f, vehicleLimit: Number(e.target.value) })} /></label><label>Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>Active</option><option>Suspended</option></select></label><label>Support Login<select value={f.supportLogin || "Allowed"} onChange={(e) => setF({ ...f, supportLogin: e.target.value })}><option>Allowed</option><option>Blocked</option></select></label><div className="span2 hintBox">Company credentials are managed by the INVIHA backend. Set a temporary password here when creating or resetting a company administrator.</div></div>}<div className="modalFoot"><button onClick={onClose}>Cancel</button><button className="greenBtn" onClick={() => {
    const issue = validateCompanyFields(f, { creating: !company });
    if (issue) {
      alert(issue.message);
      setTab(issue.tab);
      return;
    }
    if (!company && String(f.temporaryPassword || "").length < 8) {
      alert("Temporary password must be at least 8 characters.");
      setTab("access");
      return;
    }
    onSave(company?.name, f);
  }}><Save />Save Customer</button></div></Modal>;
}
function SubAccountsModal({ data, company, onClose, onSave }) {
  const [list, setList] = useState(deepClone(data.subAccounts[company.name] || []));
  const [add, setAdd] = useState(false);
  async function loginAs(u) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      alert("Allow popups to open the user account.");
      return;
    }
    try {
      const out = await apiJson(`/users/${u.id}/support-login`, { method: "POST" });
      tab.sessionStorage.setItem("inviha_company_support_token", out.token);
      tab.location.replace(window.location.origin.replace("admin.", "track.") + "/?supportToken=" + encodeURIComponent(out.token));
    } catch (e) {
      tab.close();
      alert(e.body?.error || "Unable to open the user account.");
    }
  }
  const [n, setN] = useState({ name: "", email: "", password: "", role: "Viewer", status: "Active", historyAccessDays: Number(company.historyRetentionDays) || 30 });
  return <Modal title={`${company.name} \u2014 Sub Accounts`} onClose={onClose} wide><div className="modalToolbar"><button className="greenBtn" onClick={() => setAdd(!add)}><Plus />Add Sub Account</button><span>{list.length} account(s)</span></div>{add && <div className="inlineForm"><input placeholder="Name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /><input placeholder="Email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} /><input type="password" placeholder="Password (12+ characters)" value={n.password || ""} onChange={(e) => setN({ ...n, password: e.target.value })} /><select value={n.role} onChange={(e) => setN({ ...n, role: e.target.value })}>{roleOptions.map((x) => <option key={x}>{x}</option>)}</select><input type="number" min="1" max={Number(company.historyRetentionDays) || 30} title="History access days" placeholder="History days" value={n.historyAccessDays ?? 30} onChange={(e) => setN({ ...n, historyAccessDays: Math.min(Number(company.historyRetentionDays) || 30, Math.max(1, Number(e.target.value) || 30)) })} /><button onClick={() => {
    if (!n.name || !n.email) return alert("Name and email required");
    setList([...list, { ...n, id: Date.now() }]);
    setN({ name: "", email: "", password: "", role: "Viewer", status: "Active", historyAccessDays: Number(company.historyRetentionDays) || 30 });
    setAdd(false);
  }}>Add</button></div>}<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>History</th><th>Status</th><th>Actions</th></tr></thead><tbody>{list.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.historyAccessDays || company.historyRetentionDays || 30} days</td><td><StatusPill value={u.status} /></td><td><button className="smallLoginBtn" title="Login as user" onClick={() => loginAs(u)}><LogIn />Login</button><button className="iconBtn red" title="Remove user" onClick={() => setList(list.filter((x) => x.id !== u.id))}><Trash2 /></button></td></tr>)}</tbody></table><div className="modalFoot"><button onClick={onClose}>Cancel</button><button className="greenBtn" onClick={() => onSave(list)}><Save />Save Accounts</button></div></Modal>;
}
function CategoryIcon({ category }) {
  const M = { Car, Pickup: Truck, Truck, Bus, Van: Truck, Motorcycle: Car, Trailer: Container, "Heavy Equipment": Warehouse, Tanker: Truck, Emergency: Ambulance };
  const I = M[category] || Car;
  return <span className="vehicleIcon"><I /></span>;
}
function LegacyUserAccountForm({ data, user, company, onClose, onSave }) {
  const isEdit = Boolean(user?.id), selectedCompany = company || data.companies[0], limit = Number(selectedCompany?.historyRetentionDays) || 30;
  const initial = user || {};
  const [draft, setDraft] = useState({ active: initial.status !== "Inactive", firstName: initial.firstName || initial.name?.split(" ")[0] || "", lastName: initial.lastName || initial.name?.split(" ").slice(1).join(" ") || "", personalCode: initial.personalCode || "", birthDate: initial.birthDate || "", address: initial.address || "", email: initial.email || "", phone: initial.mobile || "", group: initial.role || "Viewer", manager: initial.manager || "", mapAccess: isEdit ? normalizedMapAccess(initial.mapAccess) : defaultUserMapAccess(), vehicleLimitEnabled: initial.vehicleLimit != null, vehicleLimit: initial.vehicleLimit || "", expirationEnabled: Boolean(initial.expirationDate), expirationDate: initial.expirationDate || "", passwordMode: isEdit ? "auto" : "auto", password: "", sendCreatedEmail: true, historyAccessDays: initial.historyAccessDays || limit });
  const f = (k, v) => setDraft((x) => ({ ...x, [k]: v }));
  const save = () => {
    const name = [draft.firstName, draft.lastName].filter(Boolean).join(" ").trim();
    if (!selectedCompany || !name || !draft.email.includes("@")) return alert("Company, first name and valid email are required.");
    if (!isEdit && draft.password.length < 12) return alert("Password must contain at least 12 characters.");
    if (!baseMapAccessKeys.some((key) => draft.mapAccess[key] !== false)) return alert("Select at least one base map for this customer.");
    onSave(selectedCompany, { ...user || {}, name, firstName: draft.firstName, lastName: draft.lastName, email: draft.email, password: draft.password, status: draft.active ? "Active" : "Inactive", mobile: draft.phone, address: draft.address, personalCode: draft.personalCode, birthDate: draft.birthDate, role: draft.group, manager: draft.manager, mapAccess: draft.mapAccess, vehicleLimit: draft.vehicleLimitEnabled ? Number(draft.vehicleLimit) || 0 : null, expirationDate: draft.expirationEnabled ? draft.expirationDate : "", historyAccessDays: Math.min(limit, Number(draft.historyAccessDays) || limit), sendCreatedEmail: draft.sendCreatedEmail });
  };
  return <Modal title={isEdit ? "Edit User" : "Add new user"} onClose={onClose} wide><div className="legacyUserForm"><label className="checkLine span2"><input type="checkbox" checked={draft.active} onChange={(e) => f("active", e.target.checked)} /> Active</label><label>First name:<input value={draft.firstName} onChange={(e) => f("firstName", e.target.value)} /></label><label>Last name:<input value={draft.lastName} onChange={(e) => f("lastName", e.target.value)} /></label><label>Personal code:<input value={draft.personalCode} onChange={(e) => f("personalCode", e.target.value)} /></label><label>Birth date:<input type="date" value={draft.birthDate} onChange={(e) => f("birthDate", e.target.value)} /></label><label className="span2">Address:<input value={draft.address} onChange={(e) => f("address", e.target.value)} /></label><label className="span2">Email:<input type="email" value={draft.email} onChange={(e) => f("email", e.target.value)} /></label><label className="span2">Phone number:<input value={draft.phone} onChange={(e) => f("phone", e.target.value)} /></label><label>Group *:<select value={draft.group} onChange={(e) => f("group", e.target.value)}>{roleOptions.map((x) => <option key={x}>{x}</option>)}</select></label><label>Manager:<select value={draft.manager} onChange={(e) => f("manager", e.target.value)}><option value="">-- Select --</option>{data.companies.map((c) => <option key={c.id}>{c.name}</option>)}</select></label><fieldset className="span2 legacyMaps"><legend>Available maps:</legend><div className="legacyMapActions"><button type="button" onClick={() => f("mapAccess", allUserMapAccess())}>Select all</button><button type="button" onClick={() => f("mapAccess", defaultUserMapAccess())}>Deselect all</button></div>{mapAccessOptions.map(([k, label]) => <label key={k}><input type="checkbox" checked={draft.mapAccess[k] !== false} onChange={(e) => f("mapAccess", { ...draft.mapAccess, [k]: e.target.checked })} />{label}</label>)}</fieldset><label>Vehicle limit:<span className="legacyOptional"><input type="checkbox" checked={draft.vehicleLimitEnabled} onChange={(e) => f("vehicleLimitEnabled", e.target.checked)} /><input type="number" min="0" disabled={!draft.vehicleLimitEnabled} value={draft.vehicleLimit} onChange={(e) => f("vehicleLimit", e.target.value)} /></span></label><label>Expiration date:<span className="legacyOptional"><input type="checkbox" checked={draft.expirationEnabled} onChange={(e) => f("expirationEnabled", e.target.checked)} /><input type="datetime-local" disabled={!draft.expirationEnabled} value={draft.expirationDate} onChange={(e) => f("expirationDate", e.target.value)} /></span></label><fieldset className="span2 legacyPassword"><legend>Password change</legend><label><input type="radio" name="passwordMode" checked={draft.passwordMode === "auto"} onChange={() => f("passwordMode", "auto")} /> Autogenerate</label><label><input type="radio" name="passwordMode" checked={draft.passwordMode === "manual"} onChange={() => f("passwordMode", "manual")} /> Manual</label>{draft.passwordMode === "manual" && <input type="password" placeholder="Minimum 12 characters" value={draft.password} onChange={(e) => f("password", e.target.value)} />}</fieldset><label className="checkLine span2"><input type="checkbox" checked={draft.sendCreatedEmail} onChange={(e) => f("sendCreatedEmail", e.target.checked)} /> Send “Account created” email</label></div><div className="modalFoot"><button onClick={onClose}>Cancel</button><button className="greenBtn" onClick={save}><Save />Save</button></div></Modal>;
}
function UsersPage({ data, setData }) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const rows = data.companies.flatMap((c) => (data.subAccounts[c.name] || []).map((u) => ({ ...u, company: c.name, companyRecord: c }))).filter((u) => JSON.stringify(u).toLowerCase().includes(q.toLowerCase()));
  const commit = (company, user) => {
    const current = data.subAccounts[company.name] || [];
    const next = user.id ? current.map((x) => String(x.id) === String(user.id) ? user : x) : [...current, { ...user, id: Date.now() }];
    setData({ ...data, subAccounts: { ...data.subAccounts, [company.name]: next } });
    setForm(null);
  };
  const removeAll = async () => {
    if (!rows.length || !confirm(`Delete all ${rows.length} customer user accounts? This cannot be undone.`)) return;
    try {
      await apiJson("/users", { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE ALL USERS" }) });
      window.location.reload();
    } catch (e) {
      alert(e.body?.error || e.message);
    }
  };
  const remove = (u) => {
    if (!confirm(`Delete login account ${u.email}? The account will be disabled and removed from the user list.`)) return;
    const current = data.subAccounts[u.company] || [];
    setData({ ...data, subAccounts: { ...data.subAccounts, [u.company]: current.filter((x) => String(x.id) !== String(u.id)) } });
  };
  return <div className="page"><PageHead title={`Users ${rows.length}`} subtitle="Login accounts for customer companies. Add, edit, disable or delete an account here; company records remain under Companies."><button className="danger" onClick={removeAll} disabled={!rows.length}><Trash2 />Delete All Users</button><button className="green" onClick={() => setForm({ company: data.companies[0] || null, user: null })}><Plus />Add User</button></PageHead><Panel><div className="filterRow"><div className="search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, email, company or role..." /></div></div><table><thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Role</th><th>History</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((u) => <tr key={`${u.company}-${u.id}`}><td><b>{u.name}</b></td><td>{u.email}</td><td>{u.company}</td><td>{u.role}</td><td>{u.historyAccessDays || u.companyRecord.historyRetentionDays || 30} days</td><td><StatusPill value={u.status} /></td><td><div className="userRowActions"><button className="editAction" onClick={() => setForm({ company: u.companyRecord, user: u })}><Edit3 />Edit</button><button className="statusAction" onClick={() => commit(u.companyRecord, { ...u, status: u.status === "Active" ? "Inactive" : "Active" })}><Power />{u.status === "Active" ? "Disable" : "Enable"}</button><button className="deleteAction" onClick={() => remove(u)}><Trash2 />Delete</button></div></td></tr>)}</tbody></table>{!rows.length && <div className="empty">No customer users found.</div>}</Panel>{form && <ReferenceUserAccountForm data={data} company={form.company} user={form.user} onClose={() => setForm(null)} onSave={commit} />}</div>;
}
function ReferenceUserAccountForm({ data, user, company, onClose, onSave }) {
  const isEdit = Boolean(user?.id), selectedCompany = company || data.companies[0], limit = Number(selectedCompany?.historyRetentionDays) || 30;
  const initial = user || {};
  const initialRole = String(initial.role || initial.metadata?.displayRole || initial.group || initial.metadata?.group || "User").replace(/[_\s]+/g, " ").trim().toLowerCase();
  const isCompanyAdminAccount = initialRole === "company admin";
  const [tab, setTab] = useState("main");
  const createPassword = () => `Inv${Math.random().toString(36).slice(2, 8)}!${Math.floor(1e3 + Math.random() * 9e3)}`;
  const [draft, setDraft] = useState({ active: initial.status !== "Inactive", firstName: initial.firstName || initial.name?.split(" ")[0] || "", lastName: initial.lastName || initial.name?.split(" ").slice(1).join(" ") || "", personalCode: initial.personalCode || "", birthDate: initial.birthDate || "", address: initial.address || "", email: initial.email || "", phone: initial.mobile || "", group: isCompanyAdminAccount ? "Company Admin" : initial.group || initial.metadata?.group || initial.role || initial.metadata?.displayRole || "User", manager: initial.manager || initial.metadata?.manager || "", mapAccess: isEdit ? normalizedMapAccess(initial.mapAccess) : defaultUserMapAccess(), vehicleLimitEnabled: initial.vehicleLimit != null, vehicleLimit: initial.vehicleLimit || "", expirationEnabled: Boolean(initial.expirationDate), expirationDate: initial.expirationDate || "", passwordMode: "auto", password: initial.password || "", sendCreatedEmail: initial.sendCreatedEmail !== false, historyAccessDays: initial.historyAccessDays || limit, permissions: { ...companyPermissionOptions.reduce((acc, key) => ({ ...acc, [key]: true }), {}), ...initial.permissions || {} }, vehicleIds: (initial.vehicleIds || []).map(String) });
  const f = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const companyVehicles = data.vehicles.filter((vehicle) => vehicle.company === selectedCompany?.name || String(vehicle.companyId) === String(selectedCompany?.id));
  const groupOptions = ["User", ...roleOptions.filter((role) => role !== "User")];
  const tabs = [["main", "Main"], ["permissions", "Permissions"], ["vehicles", "Vehicles"], ["vehicleList", "Vehicles list"]];
  const save = () => {
    const name = [draft.firstName, draft.lastName].filter(Boolean).join(" ").trim();
    if (!selectedCompany || !name || !draft.email.includes("@")) return alert("Company, first name and valid email are required.");
    if (!isEdit && draft.password.length < 12) return alert("Password must contain at least 12 characters.");
    if (!baseMapAccessKeys.some((key) => draft.mapAccess[key] !== false)) return alert("Select at least one base map for this customer.");
    const savedRole = isCompanyAdminAccount ? "Company Admin" : draft.group;
    onSave(selectedCompany, { ...user || {}, name, firstName: draft.firstName, lastName: draft.lastName, email: draft.email, password: draft.password, status: draft.active ? "Active" : "Inactive", mobile: draft.phone, address: draft.address, personalCode: draft.personalCode, birthDate: draft.birthDate, role: savedRole, group: savedRole, manager: draft.manager, mapAccess: draft.mapAccess, vehicleIds: isCompanyAdminAccount ? companyVehicles.map((vehicle) => String(vehicle.id)) : draft.vehicleIds, permissions: draft.permissions, vehicleLimit: draft.vehicleLimitEnabled ? Number(draft.vehicleLimit) || 0 : null, expirationDate: draft.expirationEnabled ? draft.expirationDate : "", historyAccessDays: Math.min(limit, Number(draft.historyAccessDays) || limit), sendCreatedEmail: draft.sendCreatedEmail });
  };
  return <Modal title={isEdit ? "Edit user" : "Add new user"} onClose={onClose} className="referenceUserModal"><div className="referenceUserTabs">{tabs.map(([key, label]) => <button type="button" key={key} className={tab === key ? "activeTab" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>{tab === "main" && <div className="legacyUserForm referenceUserMain"><label className="checkLine span2"><input type="checkbox" checked={draft.active} onChange={(e) => f("active", e.target.checked)} /> Active</label><label>First name:<input value={draft.firstName} onChange={(e) => f("firstName", e.target.value)} /></label><label>Last name:<input value={draft.lastName} onChange={(e) => f("lastName", e.target.value)} /></label><label>Personal code:<input value={draft.personalCode} onChange={(e) => f("personalCode", e.target.value)} /></label><label>Birth date:<input type="date" value={draft.birthDate} onChange={(e) => f("birthDate", e.target.value)} /></label><label className="span2">Address:<input value={draft.address} onChange={(e) => f("address", e.target.value)} /></label><label className="span2">Email:<input type="email" value={draft.email} onChange={(e) => f("email", e.target.value)} /></label><label className="span2">Phone number:<input value={draft.phone} onChange={(e) => f("phone", e.target.value)} /></label><label>Group*:<select value={draft.group} onChange={(e) => f("group", e.target.value)}>{groupOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>Manager:<select value={draft.manager} onChange={(e) => f("manager", e.target.value)}><option value="">-- Select --</option>{data.companies.map((c) => <option key={c.id}>{c.name}</option>)}</select></label><fieldset className="span2 legacyMaps"><legend>Available maps:</legend><div className="legacyMapActions"><button type="button" onClick={() => f("mapAccess", allUserMapAccess())}>Select all</button><button type="button" onClick={() => f("mapAccess", defaultUserMapAccess())}>Deselect all</button></div>{mapAccessOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={draft.mapAccess[key] !== false} onChange={(e) => f("mapAccess", { ...draft.mapAccess, [key]: e.target.checked })} />{label}</label>)}</fieldset><label>Vehicle limit:<span className="legacyOptional"><input type="checkbox" checked={draft.vehicleLimitEnabled} onChange={(e) => f("vehicleLimitEnabled", e.target.checked)} /><input type="number" min="0" disabled={!draft.vehicleLimitEnabled} value={draft.vehicleLimit} onChange={(e) => f("vehicleLimit", e.target.value)} /></span></label><label>Expiration date:<span className="legacyOptional"><input type="checkbox" checked={draft.expirationEnabled} onChange={(e) => f("expirationEnabled", e.target.checked)} /><input type="datetime-local" disabled={!draft.expirationEnabled} value={draft.expirationDate} onChange={(e) => f("expirationDate", e.target.value)} /></span></label><fieldset className="span2 legacyPassword"><legend>Password change</legend><label><input type="radio" name="referencePasswordMode" checked={draft.passwordMode === "auto"} onChange={() => {
    f("passwordMode", "auto");
    if (!draft.password) f("password", createPassword());
  }} /> Autogenerate</label><label><input type="radio" name="referencePasswordMode" checked={draft.passwordMode === "manual"} onChange={() => f("passwordMode", "manual")} /> Manual</label><div className="referencePasswordInput"><input type="password" placeholder="Minimum 12 characters" value={draft.password} onChange={(e) => f("password", e.target.value)} /><button type="button" onClick={() => f("password", createPassword())}>Generate</button></div><small className="referencePasswordHint">{draft.passwordMode === "auto" ? "Generated password can be reviewed or changed before saving." : "Enter at least 12 characters."}</small></fieldset><label className="checkLine span2"><input type="checkbox" checked={draft.sendCreatedEmail} onChange={(e) => f("sendCreatedEmail", e.target.checked)} /> Send “Account created” email</label></div>}{tab === "permissions" && <div className="referenceTabPanel"><h3>Permissions</h3><p>Choose the features this user can access.</p><div className="referencePermissionGrid">{companyPermissionOptions.map((permission) => <label key={permission}><input type="checkbox" checked={draft.permissions[permission] !== false} onChange={(e) => f("permissions", { ...draft.permissions, [permission]: e.target.checked })} /><span>{permission}</span></label>)}</div></div>}{tab === "vehicles" && <div className="referenceTabPanel"><h3>Vehicles</h3><p>Select the vehicles assigned to this user.</p><div className="referenceVehicleGrid">{companyVehicles.length ? companyVehicles.map((vehicle) => <label key={vehicle.id}><input type="checkbox" checked={draft.vehicleIds.includes(String(vehicle.id))} onChange={(e) => f("vehicleIds", e.target.checked ? [.../* @__PURE__ */ new Set([...draft.vehicleIds, String(vehicle.id)])] : draft.vehicleIds.filter((id) => id !== String(vehicle.id)))} /><span><b>{vehicle.name}</b><small>{vehicle.plate || vehicle.imei || "No plate"}</small></span></label>) : <div className="referenceEmpty">No vehicles are assigned to this company yet.</div>}</div></div>}{tab === "vehicleList" && <div className="referenceTabPanel"><h3>Vehicles list</h3><p>Vehicles currently selected for this user.</p>{companyVehicles.filter((vehicle) => draft.vehicleIds.includes(String(vehicle.id))).length ? <div className="referenceSelectedVehicles">{companyVehicles.filter((vehicle) => draft.vehicleIds.includes(String(vehicle.id))).map((vehicle) => <div key={vehicle.id}><span>{vehicle.name}</span><small>{vehicle.plate || vehicle.imei || "No plate"}</small></div>)}</div> : <div className="referenceEmpty">No vehicles selected.</div>}</div>}<div className="modalFoot"><button type="button" onClick={onClose}>Cancel</button><button type="button" className="greenBtn" onClick={save}><Save />Save</button></div></Modal>;
}
const moduleLabels = { emailTemplates: "Email templates", smsTemplates: "SMS templates", mapIcons: "Map icons", vehicleIcons: "Vehicle icons", expenseTypes: "Vehicle expense types", privacyPolicy: "Privacy policy", apnConfig: "APN configuration", diemRates: "Diem rates", commandTemplates: "Command templates", emailSettings: "Email settings", billingGateway: "Billing gateway", blockedIps: "Blocked IPs", plugins: "Plugins", smsGateway: "SMS gateway", gpsActivation: "GPS vehicle activation", tools: "Tools" };
function AdminModulePage({ data, setData, page }) {
  const title = moduleLabels[page] || "Configuration";
  const rows = data.adminModules?.[page] || [];
  const [form, setForm] = useState(null);
  return <div className="page"><PageHead title={title} subtitle="Super Admin configuration records stored in the production platform state."><button className="green" onClick={() => setForm({ id: Date.now(), name: "", details: "", status: "Active" })}><Plus />Add</button></PageHead><Panel><table><thead><tr><th>Name</th><th>Details / value</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.length ? rows.map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td>{r.details}</td><td><StatusPill value={r.status} /></td><td><div className="rowActions"><button onClick={() => setForm(r)}><Edit3 /></button><button className="red" onClick={() => setData({ ...data, adminModules: { ...data.adminModules, [page]: rows.filter((x) => x.id !== r.id) } })}><Trash2 /></button></div></td></tr>) : <tr><td colSpan="4">No {title.toLowerCase()} configured.</td></tr>}</tbody></table></Panel>{form && <Modal title={`${form.name ? "Edit" : "Add"} ${title}`} onClose={() => setForm(null)}><div className="formGrid"><label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Inactive</option></select></label><label className="span2">Details / value<textarea rows="6" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></label></div><div className="modalFoot"><button onClick={() => setForm(null)}>Cancel</button><button className="greenBtn" onClick={() => {
    if (!form.name.trim()) return alert("Name is required.");
    const next = rows.some((x) => x.id === form.id) ? rows.map((x) => x.id === form.id ? form : x) : [...rows, form];
    setData({ ...data, adminModules: { ...data.adminModules, [page]: next } });
    setForm(null);
  }}><Save />Save</button></div></Modal>}</div>;
}
const superCommandTemplates = { gt06: [["Status", "STATUS#"], ["Parameters", "PARAM#"], ["Server settings", "SERVER#"], ["Reset", "RESET#"]], teltonika: [["Device info", "getinfo"], ["Current status", "getstatus"], ["I/O values", "readio"], ["Version", "getver"]] };
function SuperCommandsPage({ data }) {
  const [id, setId] = useState(data.vehicles[0]?.id || ""), [command, setCommand] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [history, setHistory] = useState([]);
  const vehicle = data.vehicles.find((v) => String(v.id) === String(id)) || data.vehicles[0];
  const templates = /teltonika/i.test(vehicle?.protocol || "") ? superCommandTemplates.teltonika : superCommandTemplates.gt06;
  useEffect(() => {
    let live = true;
    if (vehicle) apiJson("/vehicles/" + vehicle.id + "/commands/history").then((x) => {
      if (live) setHistory(Array.isArray(x) ? x : []);
    }).catch(() => live && setHistory([]));
    return () => {
      live = false;
    };
  }, [vehicle?.id]);
  async function send() {
    const text = command.trim();
    if (!vehicle || !text) return setMessage("Choose a vehicle and enter a command.");
    if (text.length > 400) return setMessage("Command is limited to 400 characters.");
    setBusy(true);
    setMessage("");
    try {
      const out = await apiJson("/vehicles/" + vehicle.id + "/commands", { method: "POST", body: JSON.stringify({ command: text }) });
      setMessage(out.message || "GPRS command queued for device delivery.");
      setCommand("");
      const x = await apiJson("/vehicles/" + vehicle.id + "/commands/history");
      setHistory(Array.isArray(x) ? x : []);
    } catch (e) {
      setMessage(e.body?.error || e.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="page commandsPage"><PageHead title="Commands" subtitle="Send a protocol command to one vehicle." /><div className="superCommandsLayout"><div className="panel superCommandVehicle"><h2>Vehicle</h2><p>Select the tracker that should receive the command.</p><select value={vehicle?.id || ""} onChange={(e) => setId(e.target.value)} disabled={!data.vehicles.length}><option value="">Select vehicle</option>{data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.protocol || "GT06"}</option>)}</select>{vehicle && <div className="superCommandSummary"><b>{vehicle.name}</b><span>{vehicle.imei || "No IMEI"}</span><span>{vehicle.protocol || "GT06"} · {vehicle.deviceStatus || vehicle.status || "Status unavailable"}</span></div>}</div><div className="panel superCommandWorkspace">{vehicle ? <><section className="superGprsControl"><div className="superGprsHead"><div><h2><Send />GPRS command</h2><p>Send a raw tracker command through the device connection.</p></div><span>{vehicle.protocol || "GT06"}</span></div><div className="superCommandTemplates"><label>Message templates</label>{templates.map(([label, value]) => <button type="button" key={value} onClick={() => setCommand(value)}>{label}</button>)}</div><textarea value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Enter the manufacturer GPRS command" rows="4" disabled={busy} /><div className="superGprsActions"><small>The server queues the command and records delivery status.</small><button className="greenBtn" disabled={busy || !command.trim()} onClick={send}><Send /> {busy ? "Sending\u2026" : "Send to device"}</button></div>{message && <p className="superCommandMessage" role="status">{message}</p>}</section><section className="superCommandHistory"><header><h2>Command history</h2><small>Device replies appear here when the tracker reports a command result.</small></header>{history.length ? <div className="superCommandHistoryTable">{history.map((row) => <div className="superCommandHistoryRow" key={row.id}><time>{new Date(row.time).toLocaleString()}</time><b>{row.kind === "reply" ? "Device reply" : "GPRS command"}</b><code>{String(row.content || row.commandName || "\u2014")}</code><span className={row.kind === "reply" ? "replyStatus" : "requestStatus"}>{row.kind === "reply" ? "Device reply" : row.status}</span></div>)}</div> : <p className="commandHistoryEmpty">No command requests or device replies yet.</p>}</section></> : <p>No vehicles available.</p>}</div></div></div>;
}
function VehiclesPage({ data, setData, companyFilter, setCompanyFilter }) {
  const [q, setQ] = useState("");
  const [viewId, setViewId] = useState(null);
  const [form, setForm] = useState(null);
  const [actionMenu, setActionMenu] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [saving, setSaving] = useState(false);
  const rows = data.vehicles.filter((v) => (!companyFilter || v.company === companyFilter) && JSON.stringify(v).toLowerCase().includes(q.toLowerCase()));
  const inventoryFor = (v) => data.devices.find((d) => String(d.imei) === String(v.imei)) || {};
  async function remove(v) {
    if (!confirm("Archive " + v.name + " and disable its tracker?")) return;
    try {
      await apiJson("/vehicles/" + v.id, { method: "DELETE" });
      await setData({ ...data, vehicles: data.vehicles.filter((x) => x.id !== v.id) });
    } catch (e) {
      alert(e.message);
    }
  }
  async function saveRealVehicle(v) {
    try {
      setSaving(true);
      const company = data.companies.find((c) => c.name === v.company);
      if (!company) throw new Error("Select a valid user and company.");
      const out = await apiJson("/vehicles", { method: "POST", body: JSON.stringify({ companyId: String(company.id), name: v.name, plateNumber: v.plate, registration: v.license, imei: v.imei, protocol: v.protocol, deviceModel: v.deviceModel, expirationDate: v.expiry || null, active: v.active !== false, metadata: v, id: data.vehicles.some((x) => x.id === v.id) ? v.id : void 0 }) });
      const latest = await apiJson("/vehicles");
      setData({ ...data, vehicles: (Array.isArray(latest) ? latest : []).map(apiVehicleToUi), auditLogs: [{ id: Date.now(), time: now(), user: data.profile.name, action: "Saved vehicle", target: v.name, result: out.action || "Success" }, ...data.auditLogs] });
      setForm(null);
    } catch (e) {
      alert(`Vehicle save failed: ${e.body?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  }
  return <div className="page"><DeviceProfileManager request={apiJson} /><PageHead title={`Vehicles ${data.vehicles.length}`} subtitle="Vehicles and their assigned trackers in one place."><button onClick={() => downloadCsv("vehicles.csv", rows)}><Download />Export</button><button onClick={() => setBulk(true)}><Upload />Bulk Vehicle Add</button><button className="green" onClick={() => setForm({})}><Plus />Add Vehicle</button></PageHead>{companyFilter && <button className="filterChip" onClick={() => setCompanyFilter("")}>Company: {companyFilter} ×</button>}<Panel><div className="filterRow"><div className="search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vehicle, company, IMEI, SIM or protocol..." /></div></div><table><thead><tr><th>Vehicle</th><th>Company</th><th>IMEI / Tracker</th><th>SIM</th><th>Protocol</th><th>Status</th><th>Last Seen</th><th>Actions</th></tr></thead><tbody>{rows.map((v) => {
    const device = inventoryFor(v);
    return <tr key={v.id}><td><div className="vehicleName"><CategoryIcon category={v.category} /><div><b>{v.name}</b><small className="subText">{v.plate}</small></div></div></td><td>{v.company}</td><td>{v.imei}</td><td>{v.sim || device.sim || "\u2014"}</td><td>{v.protocol}</td><td><StatusPill value={v.status} /></td><td>{device.lastSeen || v.lastUpdate ? Number.isNaN(new Date(device.lastSeen || v.lastUpdate).getTime()) ? "\u2014" : new Date(device.lastSeen || v.lastUpdate).toLocaleString() : "\u2014"}</td><td className="actionCell"><button className="iconBtn" title="Vehicle actions" aria-label={"Actions for " + v.name} aria-expanded={actionMenu === v.id} onClick={() => setActionMenu(actionMenu === v.id ? null : v.id)}><Settings /></button>{actionMenu === v.id && <div className="rowMenu"><button onClick={() => {
      setViewId(v.id);
      setActionMenu(null);
    }}><Eye />View</button><button onClick={() => {
      setForm(v);
      setActionMenu(null);
    }}><Edit3 />Edit</button><button className="red" onClick={() => {
      setActionMenu(null);
      remove(v);
    }}><Trash2 />Delete</button></div>}</td></tr>;
  })}</tbody></table></Panel>{viewId !== null && <SuperVehicleDetails vehicle={data.vehicles.find((v) => v.id === viewId)} data={data} onClose={() => setViewId(null)} onEdit={(v) => {
    setViewId(null);
    setForm(v);
  }} />}{form && <VehicleFormV2 data={data} vehicle={form.id ? form : null} onClose={() => setForm(null)} onSave={saveRealVehicle} saving={saving} />} {bulk && <BulkVehicleModal data={data} onClose={() => setBulk(false)} onSave={async (newRows) => {
    let saved = 0;
    try {
      for (const v of newRows) {
        const c = data.companies.find((c2) => c2.name === v.company);
        if (!c) throw new Error("Unknown company for " + v.name);
        await apiJson("/vehicles", { method: "POST", body: JSON.stringify({ companyId: c.id, name: v.name, imei: v.imei, plateNumber: v.plate, protocol: v.protocol, deviceModel: v.deviceModel, metadata: v }) });
        saved++;
      }
      await setData({ ...data, vehicles: (await apiJson("/vehicles")).map(apiVehicleToUi) });
      setBulk(false);
      alert(saved + " vehicles saved");
    } catch (e) {
      alert(saved + " vehicles saved before the error: " + e.message);
    }
  }} />}</div>;
}
function VehicleFormV2({ data, vehicle, onClose, onSave, saving = false }) {
  const defaults = { id: Date.now(), active: true, name: "", plate: "", license: "", company: "", userEmail: "", imei: "", protocol: data.settings.defaultProtocol || "GT06", deviceModel: "", sim: "", status: "Online", category: "Car", expiry: "", installationDate: "", simActivationDate: "", simExpiryDate: "", vin: "", make: "", model: "", group: "Ungrouped", ownerManager: "", location: "", notes: "", gprsTemplatesOnly: false, fuelUnit: "1/100km", fuelConsumption: 0, fuelCost: 0, forwardEnabled: false, forwardAddress: "", forwardHost: "", forwardPort: "", forwardTcp: true, forwardUdp: false, timeAdjustment: "0", sensorGroup: "", sensors: [], services: [], accuracy: { positionValidity: true, ignitionSource: "Tracker IO", speedSource: "GPS", minMovingSpeed: 3, fuelFillThreshold: 10, fuelTheftThreshold: 10 }, tail: { color: "#22c55e", length: 20 }, expenses: [], cameras: [] };
  const initial = vehicle ? { ...defaults, ...vehicle, forwardAddress: vehicle.forwardAddress || [vehicle.forwardHost, vehicle.forwardPort].filter(Boolean).join(":"), accuracy: { ...defaults.accuracy, ...vehicle.accuracy || {} }, tail: { ...defaults.tail, ...vehicle.tail || {} }, services: vehicle.services || [] } : defaults;
  const [f, setF] = useState(initial);
  const [tab, setTab] = useState("main");
  const [expirationEnabled, setExpirationEnabled] = useState(Boolean(initial.expiry));
  const tabs = [["main", "Main"], ["icons", "Icons"], ["advanced", "Advanced"], ["sensors", "Sensors"], ["relay", "Relay"], ["accuracy", "Accuracy"], ["tail", "Tail"], ["services", "Services"]];
  const users = [];
  for (const company of data.companies) {
    if (company.email) users.push({ email: company.email, company: company.name });
    for (const account of data.subAccounts[company.name] || []) if (account.email) users.push({ email: account.email, company: company.name });
  }
  const uniqueUsers = users.filter((u, i, a) => a.findIndex((x) => x.email === u.email && x.company === u.company) === i);
  const groups = ["Ungrouped", ...Array.from(new Set(data.vehicles.map((v) => v.group).filter((x) => x && x !== "Ungrouped")))];
  const updList = (key, idx, patch) => setF({ ...f, [key]: f[key].map((x, i) => i === idx ? { ...x, ...patch } : x) });
  const delList = (key, idx) => setF({ ...f, [key]: f[key].filter((_, i) => i !== idx) });
  const addList = (key, obj) => setF({ ...f, [key]: [...f[key], obj] });
  function updateForward(value) {
    const cut = value.lastIndexOf(":");
    setF({ ...f, forwardAddress: value, forwardHost: cut > 0 ? value.slice(0, cut) : value, forwardPort: cut > 0 ? value.slice(cut + 1) : "" });
  }
  function save() {
    if (!f.userEmail) {
      alert("User is required.");
      setTab("main");
      return;
    }
    if (!f.name.trim()) {
      alert("Name is required.");
      setTab("main");
      return;
    }
    if (!String(f.imei).trim()) {
      alert("Vehicle IMEI / Tracker ID is required.");
      setTab("main");
      return;
    }
    if (!/^\d{8,20}$/.test(String(f.imei).trim())) {
      alert("Vehicle IMEI / Tracker ID must contain 8\u201320 digits.");
      setTab("main");
      return;
    }
    if (!f.company) {
      alert("The selected user is not connected to a company.");
      setTab("main");
      return;
    }
    if (/teltonika/i.test(f.protocol) && !f.deviceModel) {
      alert("Select the exact tracker model or Other Teltonika Model.");
      setTab("advanced");
      return;
    }
    if (f.accuracy.minMovingSpeed === "" || !Number.isFinite(Number(f.accuracy.minMovingSpeed)) || Number(f.accuracy.minMovingSpeed) < 0 || Number(f.accuracy.minMovingSpeed) > 30) {
      alert("Minimum moving speed must be between 0 and 30 km/h.");
      setTab("accuracy");
      return;
    }
    if (f.accuracy.engineVoltageEnabled && !(Number(f.accuracy.engineVoltageOn) > Number(f.accuracy.engineVoltageOff) && Number(f.accuracy.engineVoltageOff) > 0)) {
      alert("Running voltage must be greater than off voltage; both must be positive.");
      setTab("accuracy");
      return;
    }
    onSave({ ...f, imei: String(f.imei).trim(), expiry: expirationEnabled ? f.expiry : "" });
  }
  return <Modal title={vehicle ? "Edit Vehicle" : "Add Vehicle"} onClose={onClose} wide className={`vehicleWizardModal arrangedVehicleModal vehicleTab-${tab}`}><div className="tabs vehicleTabs">{tabs.map(([key, label]) => <button type="button" key={key} className={tab === key ? "activeTab" : ""} onClick={() => setTab(key)}>{label}</button>)}</div><div className="vehicleModalBody">{tab === "main" && <div className="formGrid vehicleMainGrid"><label className="activeInline span2"><input type="checkbox" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked, status: e.target.checked ? f.status : "Inactive" })} /><span>Active</span></label><label className="span2">User *<select value={f.userEmail} onChange={(e) => {
    const user = uniqueUsers.find((x) => x.email === e.target.value);
    setF({ ...f, userEmail: e.target.value, company: user?.company || "" });
  }}><option value="">Select user</option>{uniqueUsers.map((u) => <option key={u.company + "-" + u.email} value={u.email}>{u.email} — {u.company}</option>)}</select></label><label className="span2">Name *<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label><label className="span2"><span className="fieldLabel">Vehicle IMEI / Tracker ID * <button type="button" className="fieldHelp" title="Use the GPS tracker IMEI, or the numeric Tracker ID created for a supported mobile tracker.">?</button></span><input value={f.imei} onChange={(e) => setF({ ...f, imei: e.target.value })} placeholder="Copy GPS vehicle IMEI or Create Mobile app Tracker ID" /></label><div className="span2 expiryControl"><span className="expiryLabel">Expiration date</span><div className="expiryRow"><input aria-label="Enable expiration date" type="checkbox" checked={expirationEnabled} onChange={(e) => {
    setExpirationEnabled(e.target.checked);
    if (!e.target.checked) setF({ ...f, expiry: "" });
  }} /><input aria-label="Expiration date" type="date" disabled={!expirationEnabled} value={f.expiry || ""} onChange={(e) => setF({ ...f, expiry: e.target.value })} /></div></div></div>}{tab === "icons" && <VehicleAppearance value={f} onChange={setF} />}{tab === "advanced" && <div className="advancedVehicleForm"><section><h3>Vehicle and tracker</h3><div className="advancedGrid"><label className="span2">Group<select value={f.group || "Ungrouped"} onChange={(e) => setF({ ...f, group: e.target.value })}>{groups.map((x) => <option key={x}>{x}</option>)}</select></label><label>Tracker protocol<select value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value, deviceModel: "" })}>{protocolOptions.map((x) => <option key={x}>{x}</option>)}</select></label><div><DeviceModelFields value={f} onChange={setF} request={apiJson} /></div><label>SIM number<input value={f.sim || ""} onChange={(e) => setF({ ...f, sim: e.target.value })} /></label><label>Installation date<input type="date" value={f.installationDate || ""} onChange={(e) => setF({ ...f, installationDate: e.target.value })} /></label><label>SIM activation date<input type="date" value={f.simActivationDate || ""} onChange={(e) => setF({ ...f, simActivationDate: e.target.value })} /></label><label>Plate number<input value={f.plate || ""} onChange={(e) => setF({ ...f, plate: e.target.value })} /></label><label>SIM expiration date<input type="date" value={f.simExpiryDate || ""} onChange={(e) => setF({ ...f, simExpiryDate: e.target.value })} /></label><label>Registration/Asset number<input value={f.license || ""} onChange={(e) => setF({ ...f, license: e.target.value })} /></label><label>VIN<input value={f.vin || ""} onChange={(e) => setF({ ...f, vin: e.target.value })} /></label><label>Vehicle owner/Manager<input value={f.ownerManager || ""} onChange={(e) => setF({ ...f, ownerManager: e.target.value })} /></label><label>Vehicle model<input value={f.model || ""} onChange={(e) => setF({ ...f, model: e.target.value })} /></label><label>Location<input value={f.location || ""} onChange={(e) => setF({ ...f, location: e.target.value })} /></label><label>Vehicle Machine<input value={f.make || ""} onChange={(e) => setF({ ...f, make: e.target.value })} /></label><label className="span2">Additional notes<textarea rows="4" value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label><label className="checkLine span2"><input type="checkbox" checked={!!f.gprsTemplatesOnly} onChange={(e) => setF({ ...f, gprsTemplatesOnly: e.target.checked })} /><span>Show GPRS Templates commands only</span></label></div></section><section><h3>Fuel settings</h3><div className="fuelGrid"><label>Fuel measurement<select value={f.fuelUnit || "1/100km"} onChange={(e) => setF({ ...f, fuelUnit: e.target.value })}><option value="1/100km">1/100km</option><option value="Liters">Liters</option><option value="Gallons">Gallons</option><option value="Percent">Percent</option></select></label><label>Liters per 100 kilometers<input type="number" min="0" step="0.1" value={f.fuelConsumption ?? 0} onChange={(e) => setF({ ...f, fuelConsumption: Number(e.target.value) })} /></label><label>Cost for liter<input type="number" min="0" step="0.01" value={f.fuelCost ?? 0} onChange={(e) => setF({ ...f, fuelCost: Number(e.target.value) })} /></label></div></section><section><h3>Forward</h3><div className="advancedGrid"><label className="checkLine"><input type="checkbox" checked={!!f.forwardEnabled} onChange={(e) => setF({ ...f, forwardEnabled: e.target.checked })} /><span>Enable</span></label><label className="span2">Server/IP and port<input disabled={!f.forwardEnabled} value={f.forwardAddress || ""} onChange={(e) => updateForward(e.target.value)} placeholder="10.0.0.0:6000" /></label><div className="transportChecks span2"><label className="checkLine"><input type="checkbox" disabled={!f.forwardEnabled} checked={f.forwardTcp !== false} onChange={(e) => setF({ ...f, forwardTcp: e.target.checked })} /><span>TCP</span></label><label className="checkLine"><input type="checkbox" disabled={!f.forwardEnabled} checked={!!f.forwardUdp} onChange={(e) => setF({ ...f, forwardUdp: e.target.checked })} /><span>UDP</span></label></div></div></section><section><h3>Time settings</h3><div className="advancedGrid"><label className="span2">Time adjustment<select value={f.timeAdjustment || "0"} onChange={(e) => setF({ ...f, timeAdjustment: e.target.value })}><option value="0">Default</option><option value="1">UTC +1</option><option value="2">UTC +2</option><option value="3">UTC +3</option><option value="-1">UTC -1</option><option value="-2">UTC -2</option><option value="-3">UTC -3</option></select></label><p className="timeWarning span2">Warning: By default time adjustment for GPS tracker should not be edited. This option should only be used in exceptional conditions if the GPS tracker sends incorrect time. GPS tracker should be set to use timezone UTC-0 at all times.</p></div></section></div>}{tab === "sensors" && <SensorsIoPanel vehicleId={vehicle?.id} request={apiJson} superAdmin onSaved={() => {
  }} />}{tab === "relay" && <section className="fleetFormSection"><h3><Power />Teltonika relay / immobilizer</h3><div className="formGrid"><label className="checkLine span2"><input type="checkbox" checked={f.immobilizer?.enabled === true} onChange={(e) => setF({ ...f, immobilizer: { ...f.immobilizer || {}, enabled: e.target.checked } })} /><span>Enable verified immobilizer relay</span></label><label>Relay output<select value={f.immobilizer?.output || 1} onChange={(e) => setF({ ...f, immobilizer: { ...f.immobilizer || {}, output: Number(e.target.value) } })}><option value="1">DOUT1</option><option value="2">DOUT2</option><option value="3">DOUT3</option><option value="4">DOUT4</option></select></label><label>Immobilize level<select value={f.immobilizer?.immobilizeLevel ?? 0} onChange={(e) => setF({ ...f, immobilizer: { ...f.immobilizer || {}, immobilizeLevel: Number(e.target.value) } })}><option value="0">0 / low</option><option value="1">1 / high</option></select></label><div className="note wide">Teltonika immobilizer commands are sent only while the tracker is online, stationary, and ignition is OFF. GT06 vehicles use the GPRS command box instead.</div></div></section>}{tab === "accuracy" && <AccuracyFields value={f} onChange={setF} />}{tab === "tail" && <div className="formGrid"><label>Tail Color<input type="color" value={f.tail.color || "#22c55e"} onChange={(e) => setF({ ...f, tail: { ...f.tail, color: e.target.value } })} /></label><label>Tail Length (points)<input type="number" min="0" max="200" value={f.tail.length || 20} onChange={(e) => setF({ ...f, tail: { ...f.tail, length: Number(e.target.value) } })} /></label><div className="span2 tailPreview"><span style={{ background: f.tail.color }} /><b>Map tail preview</b><small>{f.tail.length} points</small></div></div>}{tab === "services" && <div className="repeatSection"><div className="repeatHead"><div><b>Vehicle Services</b><small>Track registration, insurance, service contracts or any renewal.</small></div><button type="button" onClick={() => addList("services", { id: Date.now(), name: "", expiry: "", notes: "" })}><Plus />Add Service</button></div>{!f.services.length && <div className="emptyMini">No services added.</div>}{f.services.map((item, index) => <div className="repeatRow" key={item.id || index}><input placeholder="Service name" value={item.name || ""} onChange={(e) => updList("services", index, { name: e.target.value })} /><input type="date" value={item.expiry || ""} onChange={(e) => updList("services", index, { expiry: e.target.value })} /><input placeholder="Notes" value={item.notes || ""} onChange={(e) => updList("services", index, { notes: e.target.value })} /><button type="button" className="iconBtn red" onClick={() => delList("services", index)}><Trash2 /></button></div>)}</div>}</div><div className="modalFoot"><button type="button" className="greenBtn" disabled={saving} onClick={save}><Save />{saving ? "Saving..." : "Save"}</button><button type="button" onClick={onClose}>Cancel</button></div></Modal>;
}
function VehicleForm({ data, vehicle, onClose, onSave, saving = false }) {
  const [tab, setTab] = useState("main");
  const createPassword = () => `Inv${Math.random().toString(36).slice(2, 8)}!${Math.floor(1e3 + Math.random() * 9e3)}`;
  const defaults = {
    id: Date.now(),
    active: true,
    name: "",
    plate: "",
    license: "",
    company: data.companies[0]?.name || "",
    userEmail: "",
    imei: "",
    protocol: data.settings.defaultProtocol || "GT06",
    deviceModel: "",
    sim: "",
    status: "Online",
    category: "Car",
    expiry: "",
    registrationExpiry: "",
    insuranceExpiry: "",
    installationDate: "",
    simActivationDate: "",
    simExpiryDate: "",
    vin: "",
    make: "",
    model: "",
    year: "",
    group: "",
    ownerManager: "",
    location: "",
    notes: "",
    fuelUnit: "Liters",
    fuelConsumption: "",
    fuelCost: "",
    forwardHost: "",
    forwardPort: "",
    timeAdjustment: "0",
    sensorGroup: "",
    sensors: [],
    services: [],
    accuracy: { positionValidity: true, ignitionSource: "Tracker IO", speedSource: "GPS", minMovingSpeed: 3, fuelFillThreshold: 10, fuelTheftThreshold: 10 },
    tail: { color: "#22c55e", length: 20 },
    expenses: [],
    cameras: []
  };
  const [f, setF] = useState(vehicle ? { ...defaults, ...vehicle, accuracy: { ...defaults.accuracy, ...vehicle.accuracy || {} }, tail: { ...defaults.tail, ...vehicle.tail || {} }, services: vehicle.services || [], expenses: vehicle.expenses || [], cameras: vehicle.cameras || [] } : defaults);
  const accounts = data.subAccounts[f.company] || [];
  const tabs = [["main", "Main"], ["icons", "Icon & Logo"], ["advanced", "Advanced"], ["sensors", "Sensors & I/O"], ["services", "Services"], ["accuracy", "Accuracy"], ["tail", "Tail"], ["expenses", "Expenses"], ["cameras", "Cameras"]];
  function chooseGroup(name) {
    const g = data.sensorGroups.find((x) => x.name === name);
    setF({ ...f, sensorGroup: name, sensors: g ? g.sensors : [] });
  }
  const updList = (key, idx, patch) => setF({ ...f, [key]: f[key].map((x, i) => i === idx ? { ...x, ...patch } : x) });
  const delList = (key, idx) => setF({ ...f, [key]: f[key].filter((_, i) => i !== idx) });
  const addList = (key, obj) => setF({ ...f, [key]: [...f[key], obj] });
  return <Modal title={vehicle ? "Edit Vehicle" : "Add Vehicle"} onClose={onClose} wide className="vehicleWizardModal"><div className="tabs vehicleTabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? "activeTab" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>{tab === "main" && <div className="formGrid"><label className="activeInline"><input type="checkbox" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked, status: e.target.checked ? f.status : "Inactive" })} /><span>Active</span></label><label>Company<select value={f.company} onChange={(e) => setF({ ...f, company: e.target.value, userEmail: "" })}>{data.companies.map((c) => <option key={c.id}>{c.name}</option>)}</select></label><label>User Email<select value={f.userEmail} onChange={(e) => setF({ ...f, userEmail: e.target.value })}><option value="">Company Admin / Unassigned</option>{accounts.map((a) => <option key={a.id}>{a.email}</option>)}</select></label><label>Vehicle Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nissan Sunny" /></label><label>Plate Number<input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} placeholder="QTR-1234" /></label><label>Vehicle License / Registration<input value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} /></label><label>Vehicle IMEI<input value={f.imei} onChange={(e) => setF({ ...f, imei: e.target.value })} placeholder="15-digit IMEI" /></label><label>Protocol<select value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })}>{protocolOptions.map((x) => <option key={x}>{x}</option>)}</select></label><DeviceModelFields value={f} onChange={setF} request={apiJson} /><label>Assigned speed limit (km/h)<input type="number" min="1" max="250" value={f.speedLimit ?? ""} onChange={(e) => setF({ ...f, speedLimit: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Optional" /></label><label>Expiration Date<input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} /></label></div>}{tab === "icons" && <VehicleAppearance value={f} onChange={setF} />}{tab === "advanced" && <div className="fleetSectionGrid"><FormSection title="Fleet & SIM" icon={RadioTower}><label>Vehicle Group<input value={f.group || ""} onChange={(e) => setF({ ...f, group: e.target.value })} placeholder="Sales / Operations" /></label><label>SIM Number<input value={f.sim || ""} onChange={(e) => setF({ ...f, sim: e.target.value })} /></label><label>SIM Activation Date<input type="date" value={f.simActivationDate || ""} onChange={(e) => setF({ ...f, simActivationDate: e.target.value })} /></label><label>SIM Expiry Date<input type="date" value={f.simExpiryDate || ""} onChange={(e) => setF({ ...f, simExpiryDate: e.target.value })} /></label></FormSection><FormSection title="Vehicle Identity" icon={Car}><label>VIN<input value={f.vin || ""} onChange={(e) => setF({ ...f, vin: e.target.value })} /></label><label>Make<input value={f.make || ""} onChange={(e) => setF({ ...f, make: e.target.value })} /></label><label>Model<input value={f.model || ""} onChange={(e) => setF({ ...f, model: e.target.value })} /></label><label>Year<input type="number" value={f.year || ""} onChange={(e) => setF({ ...f, year: e.target.value })} /></label></FormSection><FormSection title="Dates" icon={CalendarDays}><label>Installation Date<input type="date" value={f.installationDate || ""} onChange={(e) => setF({ ...f, installationDate: e.target.value })} /></label><label>Registration Expiry<input type="date" value={f.registrationExpiry || ""} onChange={(e) => setF({ ...f, registrationExpiry: e.target.value })} /></label><label>Insurance Expiry<input type="date" value={f.insuranceExpiry || ""} onChange={(e) => setF({ ...f, insuranceExpiry: e.target.value })} /></label></FormSection><FormSection title="Ownership & Branch" icon={Building2}><label>Owner / Manager<input value={f.ownerManager || ""} onChange={(e) => setF({ ...f, ownerManager: e.target.value })} /></label><label>Location / Branch<input value={f.location || ""} onChange={(e) => setF({ ...f, location: e.target.value })} /></label></FormSection><FormSection title="Fuel & Costs" icon={Gauge}><label>Fuel Measurement<select value={f.fuelUnit || "Liters"} onChange={(e) => setF({ ...f, fuelUnit: e.target.value })}><option>Liters</option><option>Gallons</option><option>Percent</option></select></label><label>Fuel Consumption / 100 km<input type="number" value={f.fuelConsumption || ""} onChange={(e) => setF({ ...f, fuelConsumption: e.target.value })} /></label><label>Fuel Cost / Unit<input type="number" value={f.fuelCost || ""} onChange={(e) => setF({ ...f, fuelCost: e.target.value })} /></label></FormSection><FormSection title="Additional Configuration" icon={Settings}><label>Forward Host<input value={f.forwardHost || ""} onChange={(e) => setF({ ...f, forwardHost: e.target.value })} placeholder="Optional" /></label><label>Forward Port<input value={f.forwardPort || ""} onChange={(e) => setF({ ...f, forwardPort: e.target.value })} placeholder="Optional" /></label><label>Time Adjustment<select value={f.timeAdjustment || "0"} onChange={(e) => setF({ ...f, timeAdjustment: e.target.value })}><option value="0">Use server/company timezone</option><option value="3">UTC +3</option><option value="-3">UTC -3</option></select></label><label className="span2">Notes<textarea rows="3" value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label></FormSection></div>}{tab === "sensors" && <SensorsIoPanel vehicleId={vehicle?.id} request={apiJson} superAdmin onSaved={() => {
  }} />}{tab === "services" && <div className="repeatSection"><div className="repeatHead"><div><b>Vehicle Services</b><small>Track registration, insurance, service contracts or any renewal.</small></div><button onClick={() => addList("services", { id: Date.now(), name: "", expiry: "", notes: "" })}><Plus />Add Service</button></div>{!f.services.length && <div className="emptyMini">No services added.</div>}{f.services.map((x, i) => <div className="repeatRow" key={x.id || i}><input placeholder="Service name" value={x.name || ""} onChange={(e) => updList("services", i, { name: e.target.value })} /><input type="date" value={x.expiry || ""} onChange={(e) => updList("services", i, { expiry: e.target.value })} /><input placeholder="Notes" value={x.notes || ""} onChange={(e) => updList("services", i, { notes: e.target.value })} /><button className="iconBtn red" onClick={() => delList("services", i)}><Trash2 /></button></div>)}</div>}{tab === "accuracy" && <AccuracyFields value={f} onChange={setF} />}{tab === "tail" && <div className="formGrid"><label>Tail Color<input type="color" value={f.tail.color || "#22c55e"} onChange={(e) => setF({ ...f, tail: { ...f.tail, color: e.target.value } })} /></label><label>Tail Length (points)<input type="number" min="0" max="200" value={f.tail.length || 20} onChange={(e) => setF({ ...f, tail: { ...f.tail, length: Number(e.target.value) } })} /></label><div className="span2 tailPreview"><span style={{ background: f.tail.color }} /><b>Map tail preview</b><small>{f.tail.length} points</small></div></div>}{tab === "expenses" && <div className="repeatSection"><div className="repeatHead"><div><b>Default / Initial Expenses</b><small>Optional vehicle cost entries. Company users can add operational expenses later.</small></div><button onClick={() => addList("expenses", { id: Date.now(), type: "Installation", qty: 1, unitCost: 0, total: 0 })}><Plus />Add Expense</button></div>{!f.expenses.length && <div className="emptyMini">No expenses added.</div>}{f.expenses.map((x, i) => <div className="repeatRow expenseRow" key={x.id || i}><input placeholder="Expense type" value={x.type || ""} onChange={(e) => updList("expenses", i, { type: e.target.value })} /><input type="number" min="0" placeholder="Qty" value={x.qty ?? 1} onChange={(e) => {
    const qty = Number(e.target.value);
    updList("expenses", i, { qty, total: qty * Number(x.unitCost || 0) });
  }} /><input type="number" min="0" placeholder="Unit cost" value={x.unitCost ?? 0} onChange={(e) => {
    const unitCost = Number(e.target.value);
    updList("expenses", i, { unitCost, total: Number(x.qty || 0) * unitCost });
  }} /><b>QAR {Number(x.total || 0).toFixed(2)}</b><button className="iconBtn red" onClick={() => delList("expenses", i)}><Trash2 /></button></div>)}</div>}{tab === "cameras" && <div className="repeatSection"><div className="repeatHead"><div><b>Vehicle Cameras</b><small>Add only when the installed tracker/camera integration supports it.</small></div><button onClick={() => addList("cameras", { id: Date.now(), name: "", url: "", showWidget: true, ftpUser: "", ftpPassword: "" })}><Plus />Add Camera</button></div>{!f.cameras.length && <div className="emptyMini">No cameras configured.</div>}{f.cameras.map((x, i) => <div className="cameraCard" key={x.id || i}><div className="formGrid"><label>Camera Name<input value={x.name || ""} onChange={(e) => updList("cameras", i, { name: e.target.value })} /></label><label>Stream / Integration URL<input value={x.url || ""} onChange={(e) => updList("cameras", i, { url: e.target.value })} /></label><label>FTP Username<input value={x.ftpUser || ""} onChange={(e) => updList("cameras", i, { ftpUser: e.target.value })} /></label><label>FTP Password<input type="password" value={x.ftpPassword || ""} onChange={(e) => updList("cameras", i, { ftpPassword: e.target.value })} /></label><label className="switchLine"><input type="checkbox" checked={!!x.showWidget} onChange={(e) => updList("cameras", i, { showWidget: e.target.checked })} /><span>Show camera widget</span></label></div><button className="iconBtn red cameraDelete" onClick={() => delList("cameras", i)}><Trash2 /> Remove Camera</button></div>)}</div>}<div className="modalFoot"><button onClick={onClose}>Cancel</button><button className="greenBtn" disabled={saving} onClick={() => {
    if (/teltonika/i.test(f.protocol) && !f.deviceModel) {
      alert("Select the exact model or Other Teltonika Model.");
      setTab("main");
      return;
    }
    if (!f.name || !f.company || !f.imei) {
      alert("Vehicle Name, Company and IMEI are required.");
      return;
    }
    if (!/^\d{8,20}$/.test(String(f.imei).trim())) {
      alert("IMEI must contain digits only (8\u201320 digits).");
      return;
    }
    if (f.accuracy.minMovingSpeed === "" || !Number.isFinite(Number(f.accuracy.minMovingSpeed)) || Number(f.accuracy.minMovingSpeed) < 0 || Number(f.accuracy.minMovingSpeed) > 30) {
      alert("Minimum moving speed must be between 0 and 30 km/h.");
      setTab("accuracy");
      return;
    }
    if (f.accuracy.engineVoltageEnabled && !(Number(f.accuracy.engineVoltageOn) > Number(f.accuracy.engineVoltageOff) && Number(f.accuracy.engineVoltageOff) > 0)) {
      alert("Running voltage must be greater than off voltage; both must be positive.");
      setTab("accuracy");
      return;
    }
    onSave({ ...f, imei: String(f.imei).trim() });
  }}><Save />{saving ? "Saving to server..." : "Save Vehicle"}</button></div></Modal>;
}
function BulkVehicleModal({ data, onClose, onSave }) {
  const [fileRows, setFileRows] = useState([]);
  const [company, setCompany] = useState(data.companies[0]?.name || "");
  const [sensorGroup, setSensorGroup] = useState(data.sensorGroups[0]?.name || "");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef();
  function template() {
    const csv = "Vehicle Name,Plate,Vehicle License,IMEI,Protocol,Category,User Email,Expiration Date,Device Model,SIM,Sensor Group\nNissan Sunny,QTR-1001,LIC-1001,86857707300999,GT06,Car,admin@example.com,2027-12-31,H9-4G,+97455000000,Standard GPS";
    downloadBlob("INVIHA_vehicle_import_template.csv", csv, "text/csv");
  }
  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((x) => x.trim());
    if (!lines.length) return [];
    const rows = lines.slice(1).map((line, idx) => {
      const c = line.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
      return { row: idx + 2, name: c[0] || "", plate: c[1] || "", license: c[2] || "", imei: c[3] || "", protocol: c[4] || "GT06", category: c[5] || "Car", userEmail: c[6] || "", expiry: c[7] || "", deviceModel: c[8] || "", sim: c[9] || "", sensorGroup: c[10] || sensorGroup };
    });
    return rows;
  }
  function loadFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const r = new FileReader();
    r.onload = () => setFileRows(parseCsv(String(r.result || "")));
    r.readAsText(f);
  }
  const validated = fileRows.map((r) => {
    const errs = [];
    if (!r.name) errs.push("Vehicle name missing");
    if (!r.imei) errs.push("IMEI missing");
    if (r.imei && data.vehicles.some((v) => v.imei === r.imei)) errs.push("Duplicate IMEI");
    if (!protocolOptions.includes(r.protocol)) errs.push("Unknown protocol");
    if (!categoryOptions.includes(r.category)) errs.push("Unknown category");
    return { ...r, errors: errs };
  });
  const valid = validated.filter((r) => !r.errors.length);
  const invalid = validated.filter((r) => r.errors.length);
  function commit() {
    const sg = (name) => data.sensorGroups.find((g) => g.name === name) || data.sensorGroups.find((g) => g.name === sensorGroup) || data.sensorGroups[0];
    const rows = valid.map((r, i) => ({ id: Date.now() + i, name: r.name, plate: r.plate, license: r.license, company, imei: r.imei, protocol: r.protocol, deviceModel: r.deviceModel, sim: r.sim, status: "Online", category: r.category, userEmail: r.userEmail, expiry: r.expiry, registrationExpiry: "", insuranceExpiry: "", sensorGroup: sg(r.sensorGroup)?.name || "", sensors: sg(r.sensorGroup)?.sensors || [] }));
    if (!rows.length) return alert("No valid rows to import.");
    onSave(rows);
  }
  return <Modal title="Bulk Vehicle Add — CSV Import" onClose={onClose} wide><div className="bulkTop"><button onClick={template}><FileDown />Download CSV Template</button><button className="greenBtn" onClick={() => inputRef.current?.click()}><Upload />Choose CSV File</button><input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={loadFile} /><span>{fileName || "No file selected"}</span></div><div className="formGrid"><label>Import to Company<select value={company} onChange={(e) => setCompany(e.target.value)}>{data.companies.map((c) => <option key={c.id}>{c.name}</option>)}</select></label><label>Default Sensor Group<select value={sensorGroup} onChange={(e) => setSensorGroup(e.target.value)}>{data.sensorGroups.map((g) => <option key={g.id}>{g.name}</option>)}</select></label></div>{validated.length > 0 && <><div className="importSummary"><b>{validated.length} rows</b><span className="okText">{valid.length} valid</span><span className="badText">{invalid.length} need fixing</span></div><div className="tableScroll"><table><thead><tr><th>Row</th><th>Vehicle</th><th>Plate</th><th>IMEI</th><th>Protocol</th><th>Category</th><th>Sensor Group</th><th>Validation</th></tr></thead><tbody>{validated.map((r) => <tr key={r.row}><td>{r.row}</td><td>{r.name}</td><td>{r.plate}</td><td>{r.imei}</td><td>{r.protocol}</td><td>{r.category}</td><td>{r.sensorGroup || sensorGroup}</td><td>{r.errors.length ? <span className="badText">{r.errors.join("; ")}</span> : <span className="okText">Ready</span>}</td></tr>)}</tbody></table></div></>}<div className="modalFoot"><button onClick={onClose}>Cancel</button><button className="greenBtn" onClick={commit}><Upload />Import {valid.length} Valid Vehicles</button></div></Modal>;
}
function DevicesPage({ data, setData }) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const rows = data.devices.filter((d) => JSON.stringify(d).toLowerCase().includes(q.toLowerCase()));
  return <div className="page"><PageHead title={`Devices / IMEI ${data.devices.length}`} subtitle="Tracker inventory, protocol, SIM, company assignment and last seen."><button onClick={() => downloadCsv("devices.csv", rows)}><Download />Export</button><button className="green" onClick={() => setForm({})}><Plus />Add Device</button></PageHead><Panel><div className="filterRow"><div className="search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search IMEI, model, protocol, company..." /></div></div><table><thead><tr><th>IMEI</th><th>Model</th><th>Protocol</th><th>SIM</th><th>Company</th><th>Vehicle</th><th>Status</th><th>Last Seen</th><th>Actions</th></tr></thead><tbody>{rows.map((d) => <tr key={d.id}><td>{d.imei}</td><td>{d.model}</td><td>{d.protocol}</td><td>{d.sim || "\u2014"}</td><td>{d.company || "\u2014"}</td><td>{d.vehicle || "\u2014"}</td><td><StatusPill value={d.status} /></td><td>{d.lastSeen || "\u2014"}</td><td><div className="rowActions"><button onClick={() => setForm(d)}><Edit3 /></button><button className="red" onClick={async () => {
    if (!confirm("Disable and archive this tracker?")) return;
    try {
      await apiJson("/inventory/" + d.id, { method: "DELETE" });
      await setData(data);
    } catch (e) {
      alert(e.message);
    }
  }}><Trash2 /></button></div></td></tr>)}</tbody></table></Panel>{form && <DeviceForm data={data} device={form.id ? form : null} onClose={() => setForm(null)} onSave={async (d) => {
    try {
      await apiJson("/inventory", { method: "POST", body: JSON.stringify({ ...d, id: data.devices.some((x) => x.id === d.id) ? d.id : void 0 }) });
      await setData(data);
      setForm(null);
    } catch (e) {
      alert(e.message);
    }
  }} />}</div>;
}
function DeviceForm({ data, device, onClose, onSave }) {
  const [f, setF] = useState(device ? { ...device } : { id: Date.now(), imei: "", model: "", protocol: "GT06", sim: "", company: "", vehicle: "", status: "Enabled", lastSeen: "No communication" });
  const vehicles = data.vehicles.filter((v) => !f.company || v.company === f.company);
  return <Modal title={device ? "Edit Device" : "Add Device"} onClose={onClose}><div className="formGrid"><label>IMEI<input value={f.imei} onChange={(e) => setF({ ...f, imei: e.target.value })} /></label><label>Model<input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></label><label>Protocol<select value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })}>{protocolOptions.map((x) => <option key={x}>{x}</option>)}</select></label><label>SIM<input value={f.sim} onChange={(e) => setF({ ...f, sim: e.target.value })} /></label><label>Company<select value={f.company} onChange={(e) => setF({ ...f, company: e.target.value, vehicle: "" })}><option value="">Unassigned</option>{data.companies.map((c) => <option key={c.id}>{c.name}</option>)}</select></label><label>Vehicle<select value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })}><option value="">Unassigned</option>{vehicles.map((v) => <option key={v.id}>{v.name}</option>)}</select></label><label>Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>Enabled</option><option>Inactive</option></select></label></div><div className="modalFoot"><button onClick={onClose}>Cancel</button><button className="greenBtn" onClick={() => {
    if (!f.imei || !f.model) return alert("IMEI and model are required");
    onSave(f);
  }}><Save />Save Device</button></div></Modal>;
}
function MapPage({ data }) {
  const accounts = useMemo(() => {
    const all = data.companies.flatMap((c) => [{ id: `company-${c.id}`, email: c.email || c.name, name: c.customerName || `${c.name} Admin`, company: c.name, companyId: c.id, vehicleIds: null }, ...(data.subAccounts[c.name] || []).map((u) => ({ id: `user-${u.id}`, email: u.email, name: u.name, company: c.name, companyId: c.id, vehicleIds: Array.isArray(u.vehicleIds) ? u.vehicleIds : null }))]);
    return all.filter((a, i) => all.findIndex((x) => String(x.companyId) === String(a.companyId) && String(x.email).toLowerCase() === String(a.email).toLowerCase()) === i);
  }, [data.companies, data.subAccounts]);
  const preferred = accounts.find((a) => String(a.email).toLowerCase() === "admin@gmail.com") || accounts[0];
  const [accountId, setAccountId] = useState(preferred?.id || "");
  useEffect(() => {
    if (!accounts.some((a) => a.id === accountId)) setAccountId((accounts.find((a) => String(a.email).toLowerCase() === "admin@gmail.com") || accounts[0])?.id || "");
  }, [accounts, accountId]);
  const account = accounts.find((a) => a.id === accountId) || preferred;
  const vehicles = data.vehicles.filter((v) => v.company === account?.company && (!account?.vehicleIds || account.vehicleIds.map(String).includes(String(v.id))));
  const company = data.companies.find((c) => c.name === account?.company);
  const scopedData = { ...data, companies: company ? [company] : [], vehicles };
  return <div className="superMapPage">{account ? <><div className="mapScopeBar"><div><UserRound /><span><b>{account.email}</b><small>{account.company} · {vehicles.length} vehicles</small></span></div><label>Customer login<select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option value={a.id} key={a.id}>{a.email} — {a.company}</option>)}</select></label></div><PlatformMap data={scopedData} scoped /></> : <div className="page"><Panel><div className="empty">No customer login is available.</div></Panel></div>}</div>;
}
function MasterDataPage({ data, setData }) {
  const [tab, setTab] = useState("sensors");
  const [group, setGroup] = useState(null);
  return <div className="page"><PageHead title="Master Data" subtitle="Reusable templates so daily operations stay simple." /><div className="tabs pageTabs"><button className={tab === "sensors" ? "activeTab" : ""} onClick={() => setTab("sensors")}>Sensor Groups</button><button className={tab === "protocols" ? "activeTab" : ""} onClick={() => setTab("protocols")}>Protocols</button><button className={tab === "categories" ? "activeTab" : ""} onClick={() => setTab("categories")}>Vehicle Categories</button></div>{tab === "sensors" && <Panel><div className="panelHead"><h2>Sensor Groups</h2><button className="greenBtn" onClick={() => setGroup({})}><Plus />Add Group</button></div><div className="cardGrid">{data.sensorGroups.map((g) => <div className="masterCard" key={g.id}><div><b>{g.name}</b><span>{g.sensors.length} sensors</span></div><p>{g.sensors.join(", ")}</p><div className="rowActions"><button onClick={() => setGroup(g)}><Edit3 /></button><button className="red" onClick={() => setData({ ...data, sensorGroups: data.sensorGroups.filter((x) => x.id !== g.id) })}><Trash2 /></button></div></div>)}</div></Panel>}{tab === "protocols" && <Panel title="Supported Protocols"><div className="tagList">{protocolOptions.map((x) => <span key={x}>{x}</span>)}</div><p className="note">Protocol listeners are activated in the server configuration. This page is the Super Admin reference list.</p></Panel>}{tab === "categories" && <Panel title="Vehicle Categories"><div className="tagList">{categoryOptions.map((x) => <span key={x}>{x}</span>)}</div></Panel>}{group && <SensorGroupForm group={group.id ? group : null} onClose={() => setGroup(null)} onSave={(g) => {
    const exists = data.sensorGroups.some((x) => x.id === g.id);
    setData({ ...data, sensorGroups: exists ? data.sensorGroups.map((x) => x.id === g.id ? g : x) : [...data.sensorGroups, g] });
    setGroup(null);
  }} />}</div>;
}
function SensorGroupForm({ group, onClose, onSave }) {
  const [f, setF] = useState(group ? deepClone(group) : { id: Date.now(), name: "", sensors: [] });
  return <Modal title={group ? "Edit Sensor Group" : "Add Sensor Group"} onClose={onClose}><div className="formGrid"><label>Group Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label></div><div className="sensorGrid">{sensorOptions.map((s) => <label className="checkCard" key={s}><input type="checkbox" checked={f.sensors.includes(s)} onChange={(e) => setF({ ...f, sensors: e.target.checked ? [...f.sensors, s] : f.sensors.filter((x) => x !== s) })} /><span>{s}</span></label>)}</div><div className="modalFoot"><button onClick={onClose}>Cancel</button><button className="greenBtn" onClick={() => {
    if (!f.name) return alert("Group name required");
    onSave(f);
  }}><Save />Save Group</button></div></Modal>;
}
function EventsPage({ data }) {
  const vehicles = data.vehicles.filter((v) => v.deviceId);
  const [vehicleId, setVehicleId] = useState("");
  const [days, setDays] = useState(1), [rows, setRows] = useState([]), [loading, setLoading] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState("");
  const selected = vehicles.find((v) => String(v.id) === vehicleId) || vehicles[0];
  async function load(e) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError("");
    setLoaded(false);
    try {
      const to = /* @__PURE__ */ new Date(), from = new Date(to.getTime() - Number(days) * 864e5);
      const query = new URLSearchParams({ deviceId: String(selected.deviceId), from: from.toISOString(), to: to.toISOString() });
      const result = await apiJson("/reports/events?" + query);
      setRows(Array.isArray(result) ? result : []);
      setLoaded(true);
    } catch (err) {
      setRows([]);
      setError(err.body?.error || err.message);
    } finally {
      setLoading(false);
    }
  }
  return <div className="page"><PageHead title="Events" subtitle="Recorded tracker events for one vehicle and time range." /><Panel><form className="filterRow" onSubmit={load}><label>Vehicle <select value={selected?.id || ""} onChange={(e) => {
    setVehicleId(e.target.value);
    setLoaded(false);
    setRows([]);
  }}>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.company}</option>)}</select></label><label>History <select value={days} onChange={(e) => {
    setDays(Number(e.target.value));
    setLoaded(false);
    setRows([]);
  }}><option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></label><button type="submit" disabled={!selected || loading}>{loading ? "Loading\u2026" : "Load Events"}</button></form>{error && <p role="alert">{error}</p>}{loaded && <><table><thead><tr><th>Time</th><th>Vehicle</th><th>Event</th><th>Details</th></tr></thead><tbody>{rows.map((event, i) => <tr key={event.id || i}><td>{event.eventTime || event.serverTime ? new Date(event.eventTime || event.serverTime).toLocaleString() : "\u2014"}</td><td>{selected.name}</td><td>{event.type || "Tracker event"}</td><td>{event.attributes?.alarm || event.attributes?.result || "\u2014"}</td></tr>)}</tbody></table>{!rows.length && <p>No events were recorded for this selection.</p>}</>}</Panel></div>;
}
function LogsPage({ data, setData }) {
  const [tab, setTab] = useState("service");
  const rows = tab === "service" ? data.serviceLogs : data.auditLogs;
  return <div className="page"><PageHead title="Logs" subtitle="Service logs and Super Admin audit trail."><button onClick={() => downloadCsv(`${tab}-logs.csv`, rows)}><Download />Export</button><button onClick={() => setData({ ...data, [tab === "service" ? "serviceLogs" : "auditLogs"]: [] })}><Trash2 />Clear View</button></PageHead><div className="tabs pageTabs"><button className={tab === "service" ? "activeTab" : ""} onClick={() => setTab("service")}>Service Logs</button><button className={tab === "audit" ? "activeTab" : ""} onClick={() => setTab("audit")}>Audit Logs</button></div><Panel><table><thead><tr>{tab === "service" ? <><th>Time</th><th>Component</th><th>Level</th><th>Message</th></> : <><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Result</th></>}</tr></thead><tbody>{rows.map((r) => tab === "service" ? <tr key={r.id}><td>{r.time}</td><td>{r.component}</td><td><StatusPill value={r.level === "INFO" ? "Success" : r.level} /></td><td>{r.message}</td></tr> : <tr key={r.id}><td>{r.time}</td><td>{r.user}</td><td>{r.action}</td><td>{r.target}</td><td><StatusPill value={r.result} /></td></tr>)}</tbody></table></Panel></div>;
}
function RetentionInfoPage({ data }) {
  return <div className="page"><PageHead title="Customer Data Retention" subtitle="Each customer controls how many days of reports and operational history remain available. New companies default to 30 days." /><div className="stats fourStats"><Stat icon={Building2} label="Customers" value={data.companies.length} /><Stat icon={Clock3} label="Default" value="30 days" tone="green" /><Stat icon={DatabaseBackup} label="Cleanup" value="Daily" tone="purple" /><Stat icon={ShieldCheck} label="Scope" value="Per company" tone="orange" /></div><Panel title="Retention by company"><table><thead><tr><th>Company</th><th>Stored history</th><th>User access</th><th>What is cleaned</th></tr></thead><tbody>{data.companies.map((c) => {
    const users = data.subAccounts[c.name] || [];
    return <tr key={c.id}><td><b>{c.name}</b></td><td>{c.historyRetentionDays || 30} days</td><td>{users.length ? `${Math.min(...users.map((u) => Number(u.historyAccessDays) || Number(c.historyRetentionDays) || 30))}\u2013${c.historyRetentionDays || 30} days` : `Up to ${c.historyRetentionDays || 30} days`}</td><td>Reports, driver events, completed sessions and customer audit history</td></tr>;
  })}</tbody></table></Panel><Panel title="How it works"><div className="checkList"><span><CheckCircle2 />A new company starts at 30 days.</span><span><CheckCircle2 />Change the value in Add/Edit Company → Main.</span><span><CheckCircle2 />A sub-user may be limited to fewer days when the user is added.</span><span><CheckCircle2 />The backend rejects report dates outside the allowed period.</span><span><CheckCircle2 />Expired application history is cleaned once per day; accounts, vehicles, settings and active driver assignments are preserved.</span></div></Panel></div>;
}
function DatabasePage({ data }) {
  const [db, setDb] = useState(null);
  useEffect(() => {
    apiJson("/platform/database").then(setDb).catch(() => setDb({ connected: false, tables: [] }));
  }, []);
  return <div className="page"><PageHead title="Database" subtitle="Production database readiness and schema responsibilities." /><div className="stats fourStats"><Stat icon={Database} label="Mode" value="Server" /><Stat icon={Server} label="PostgreSQL" value={db?.connected ? "Connected" : "Unavailable"} tone="green" /><Stat icon={ShieldCheck} label="Tenant Security" value="API scoped" tone="purple" /><Stat icon={DatabaseBackup} label="Backups" value="Manual exports" tone="orange" /></div><Panel title="Production Tables"><div className="tagList">{(db?.tables || []).map((x) => <span key={x}>{x}</span>)}</div></Panel><Panel title="Security Rules"><div className="checkList"><span><CheckCircle2 />Every tenant record carries company_id</span><span><CheckCircle2 />Company users can only read their own company</span><span><CheckCircle2 />Super Admin requires an authenticated account</span><span><CheckCircle2 />Database connections are made by the backend</span><span><CheckCircle2 />Service-role credentials never go to frontend</span></div></Panel></div>;
}
function BillingPage({ data, setData }) {
  const [form, setForm] = useState(null);
  return <div className="page"><PageHead title="Billing & Plans" subtitle="Plan templates and company limits. Payment gateway is optional and not required now."><button className="green" onClick={() => setForm({})}><Plus />Add Plan</button></PageHead><Panel><table><thead><tr><th>Plan</th><th>Monthly Price</th><th>Vehicle Limit</th><th>Status</th><th>Companies</th><th>Actions</th></tr></thead><tbody>{data.plans.map((p) => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.price ? `QAR ${p.price}` : "Custom"}</td><td>{p.vehicleLimit}</td><td><StatusPill value={p.status} /></td><td>{data.companies.filter((c) => c.plan === p.name).length}</td><td><div className="rowActions"><button onClick={() => setForm(p)}><Edit3 /></button><button className="red" onClick={() => setData({ ...data, plans: data.plans.filter((x) => x.id !== p.id) })}><Trash2 /></button></div></td></tr>)}</tbody></table></Panel>{form && <PlanForm plan={form.id ? form : null} onClose={() => setForm(null)} onSave={(p) => {
    const exists = data.plans.some((x) => x.id === p.id);
    setData({ ...data, plans: exists ? data.plans.map((x) => x.id === p.id ? p : x) : [...data.plans, p] });
    setForm(null);
  }} />}</div>;
}
function PlanForm({ plan, onClose, onSave }) {
  const [f, setF] = useState(plan ? { ...plan } : { id: Date.now(), name: "", price: 0, vehicleLimit: 25, status: "Active" });
  return <Modal title={plan ? "Edit Plan" : "Add Plan"} onClose={onClose}><div className="formGrid"><label>Plan Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label><label>Monthly Price (QAR)<input type="number" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></label><label>Vehicle Limit<input type="number" value={f.vehicleLimit} onChange={(e) => setF({ ...f, vehicleLimit: Number(e.target.value) })} /></label><label>Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>Active</option><option>Inactive</option></select></label></div><div className="modalFoot"><button onClick={onClose}>Cancel</button><button className="greenBtn" onClick={() => onSave(f)}><Save />Save Plan</button></div></Modal>;
}
function SupportPage({ data, setData }) {
  const [form, setForm] = useState(false);
  const [f, setF] = useState({ company: data.companies[0]?.name || "", subject: "", priority: "Medium", status: "Open" });
  return <div className="page"><PageHead title="Support" subtitle="Internal support tickets and first-level customer issue tracking."><button className="green" onClick={() => setForm(true)}><Plus />New Ticket</button></PageHead><Panel><table><thead><tr><th>ID</th><th>Company</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{data.tickets.map((t) => <tr key={t.id}><td>#{t.id}</td><td>{t.company}</td><td>{t.subject}</td><td>{t.priority}</td><td><StatusPill value={t.status} /></td><td>{t.created}</td><td><button className="iconBtn" onClick={() => setData({ ...data, tickets: data.tickets.map((x) => x.id === t.id ? { ...x, status: x.status === "Open" ? "Resolved" : "Open" } : x) })}><CheckCircle2 /></button></td></tr>)}</tbody></table></Panel>{form && <Modal title="New Support Ticket" onClose={() => setForm(false)}><div className="formGrid"><label>Company<select value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })}>{data.companies.map((c) => <option key={c.id}>{c.name}</option>)}</select></label><label>Priority<select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label className="span2">Subject<input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label></div><div className="modalFoot"><button onClick={() => setForm(false)}>Cancel</button><button className="greenBtn" onClick={() => {
    if (!f.subject) return;
    setData({ ...data, tickets: [...data.tickets, { ...f, id: Date.now(), created: now() }] });
    setForm(false);
  }}><Save />Create Ticket</button></div></Modal>}</div>;
}
function MapsAndGeocodingSettings({ f, setF }) {
  const set = (key, value) => setF({ ...f, [key]: value });
  const maps = [["bing-hybrid", "Bing Hybrid"], ["bing-road", "Bing Normal"], ["bing-satellite", "Bing Satellite"], ["here-hybrid", "HERE Hybrid"], ["here-normal", "HERE Normal"], ["here-satellite", "HERE Satellite"], ["mapbox-hybrid", "MapBox Hybrid"], ["mapbox-streets", "MapBox Normal"], ["mapbox-satellite", "MapBox Satellite"], ["maptiler-basic", "MapTiler Basic"], ["maptiler-satellite", "MapTiler Satellite"], ["maptiler-streets", "MapTiler Streets"], ["carto-liberty", "MapTiles Liberty"], ["carto-positron", "MapTiles Positron"], ["openmaptiles-osm", "OpenMapTiles OSM"], ["rail-electrification", "OpenRailway Electrification"], ["rail-infrastructure", "OpenRailway Infrastructure"], ["rail-maxspeed", "OpenRailway Max Speeds"], ["rail-signals", "OpenRailway Signaling"], ["osm-road", "OpenStreetMap"], ["tomtom-basic", "TomTom Basic"], ["tomtom-satellite", "TomTom Satellite"], ["yandex-road", "Yandex"], ["carto-dark", "MapTiles Dark"], ["open-topo", "OpenTopoMap"], ["esri-street", "Esri Street"], ["esri-satellite", "Esri Satellite"]];
  const keyField = (key, label, help = "") => <label>{label}<input type="password" value={f[key] || ""} onChange={(e) => set(key, e.target.value)} autoComplete="new-password" />{help && <small>{help}</small>}</label>;
  return <Panel title="Maps & Geocoding"><div className="settingsForm mapsGeocodingSettings">
    <fieldset className="span2 legacyMaps"><legend>Default maps</legend><div className="legacyMapActions"><button type="button" onClick={() => set("enabledMaps", allUserMapAccess())}>Select all</button><button type="button" onClick={() => { setF({ ...f, enabledMaps: defaultUserMapAccess(), defaultBaseMap: "osm-road", mapProvider: "OpenStreetMap" }); }}>Deselect all</button></div>{mapAccessOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={normalizedMapAccess(f.enabledMaps)[key] !== false} onChange={(e) => set("enabledMaps", { ...normalizedMapAccess(f.enabledMaps), [key]: e.target.checked })} />{label}</label>)}</fieldset>
    <label>Default map<select value={f.defaultBaseMap || "osm-road"} onChange={(e) => set("defaultBaseMap", e.target.value)}>{maps.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>A keyed map appears to customers only after its browser key is saved.</small></label>
    <label>Default map zoom<input type="number" min="2" max="20" value={f.mapZoom || 11} onChange={(e) => set("mapZoom", Number(e.target.value))} /></label>
    <label>Address provider (primary)<select value={f.geocoderPrimary || "nominatim"} onChange={(e) => set("geocoderPrimary", e.target.value)}>{geocoderOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Fallback address provider<select value={f.geocoderFallback || "none"} onChange={(e) => set("geocoderFallback", e.target.value)}><option value="none">No fallback</option>{geocoderOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>Used automatically when the primary provider is unavailable or out of quota.</small></label>
    <label className="checkLine"><input type="checkbox" checked={f.geocoderCacheEnabled !== false} onChange={(e) => set("geocoderCacheEnabled", e.target.checked)} /><span>Enable geocoder cache</span></label>
    <label>Address cache days<input type="number" min="1" max="3650" disabled={f.geocoderCacheEnabled === false} value={f.geocoderCacheDays || 30} onChange={(e) => set("geocoderCacheDays", Number(e.target.value))} /><small>Previously resolved addresses are reused to reduce API cost and loading.</small></label>
    <label>Primary geocoder API URL<input value={f.geocoderPrimaryApiUrl || ""} onChange={(e) => set("geocoderPrimaryApiUrl", e.target.value)} placeholder="Optional custom or self-hosted endpoint" /></label>
    <label>Address/fallback API URL<input value={f.geocoderAddressApiUrl || ""} onChange={(e) => set("geocoderAddressApiUrl", e.target.value)} placeholder="Optional custom or self-hosted endpoint" /></label>
    <label>Map center latitude<input type="number" step="0.000001" value={f.mapCenterLatitude ?? 25.2854} onChange={(e) => set("mapCenterLatitude", Number(e.target.value))} /></label>
    <label>Map center longitude<input type="number" step="0.000001" value={f.mapCenterLongitude ?? 51.5310} onChange={(e) => set("mapCenterLongitude", Number(e.target.value))} /></label>
    <h4 className="span2">Map and street imagery keys</h4>
    {keyField("mapillaryAccessToken", "Mapillary access token", "Used only for street imagery.")}
    {keyField("mapTilerKey", "MapTiler browser key")}{keyField("mapboxToken", "Mapbox public token")}
    {keyField("hereMapsKey", "HERE browser key")}{keyField("tomtomMapsKey", "TomTom browser key")}
    {keyField("bingMapsKey", "Bing Maps browser key")}{keyField("yandexMapsKey", "Yandex Maps browser key")}
    <label className="span2">OpenMapTiles self-hosted tile URL<input value={f.openMapTilesUrl || ""} onChange={(e) => set("openMapTilesUrl", e.target.value)} placeholder="https://maps.example.com/styles/osm/{z}/{x}/{y}.png" /><small>Include the {'{z}'}, {'{x}'} and {'{y}'} placeholders. This layer stays hidden until a URL is saved.</small></label>
    <label>OpenMapTiles attribution<input value={f.openMapTilesAttribution || ""} onChange={(e) => set("openMapTilesAttribution", e.target.value)} placeholder="© OpenMapTiles © OpenStreetMap contributors" /></label>
    <label>OpenMapTiles maximum zoom<input type="number" min="2" max="24" value={f.openMapTilesMaxZoom || 20} onChange={(e) => set("openMapTilesMaxZoom", Number(e.target.value))} /></label>
    <h4 className="span2">Server geocoding keys</h4>
    {keyField("geoapifyKey", "Geoapify key")}{keyField("locationIqKey", "LocationIQ key")}
    {keyField("tomtomGeocodingKey", "TomTom geocoding key")}{keyField("mapboxGeocodingToken", "Mapbox geocoding token")}
    {keyField("hereGeocodingKey", "HERE geocoding key")}{keyField("mapTilerGeocodingKey", "MapTiler geocoding key")}
    {keyField("bingMapsKey", "Bing geocoding key", "The same Bing key may be used when its account permits both Maps and Locations services.")}
    <label>Nominatim API URL<input value={f.nominatimApiUrl || "https://nominatim.openstreetmap.org"} onChange={(e) => set("nominatimApiUrl", e.target.value)} /><small>Use the public URL only for light testing. A self-hosted or managed URL is safer for production.</small></label>
    <h4 className="span2">Street imagery</h4>
    <label>Streetview API<select value={f.streetviewProvider || "Mapillary"} onChange={(e) => set("streetviewProvider", e.target.value)}><option>None</option><option>Mapillary</option></select></label>
    {keyField("streetviewApiKey", "Streetview API key", "Mapillary continues to use its access token above.")}
    <div className="span2 hintBox">All customers use the platform geocoder selected here. Server geocoding keys are never sent to customer browsers. Choose the maps available to each account when adding or editing that user.</div>
  </div></Panel>;
}
function LifecycleAndSecuritySettings({ f, setF }) {
  const set = (key, value) => setF({ ...f, [key]: value });
  return <Panel title="Notifications, Retention & Security"><div className="settingsForm">
    <label>Expiry notification before days<input type="number" min="0" max="365" value={f.expiryNotifyBeforeDays ?? 10} onChange={(e) => set("expiryNotifyBeforeDays", Number(e.target.value))} /></label>
    <label>Expiry notification after days<input type="number" min="0" max="365" value={f.expiryNotifyAfterDays ?? 10} onChange={(e) => set("expiryNotifyAfterDays", Number(e.target.value))} /></label>
    <label>Days to keep vehicle camera images<input type="number" min="0" max="3650" value={f.cameraImageRetentionDays ?? 30} onChange={(e) => set("cameraImageRetentionDays", Number(e.target.value))} /><small>0 disables automatic camera-image deletion.</small></label>
    <label>CAPTCHA provider<select value={f.captchaProvider || "None"} onChange={(e) => set("captchaProvider", e.target.value)}><option>None</option><option>Cloudflare Turnstile</option><option>Google reCAPTCHA</option></select></label>
    <label>CAPTCHA site key<input value={f.captchaSiteKey || ""} onChange={(e) => set("captchaSiteKey", e.target.value)} /></label>
    <label>CAPTCHA secret key<input type="password" autoComplete="new-password" value={f.captchaSecretKey || ""} onChange={(e) => set("captchaSecretKey", e.target.value)} /><small>The secret is stored in Super Admin settings and is never returned by public branding.</small></label>
  </div></Panel>;
}
function SettingsPage({ data, setData }) {
  const [f, setF] = useState(deepClone(data.settings));
  const [imageUploads, setImageUploads] = useState({});
  const [brandingFeedback, setBrandingFeedback] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const logoRef = useRef(), loginLogoRef = useRef(), collapsedLogoRef = useRef(), favRef = useRef(), loginBgRef = useRef();
  const uploadSequence = useRef({});
  const processingImages = Object.values(imageUploads).some((item) => item?.status === "processing");
  function uploadNotice(field) {
    const item = imageUploads[field];
    if (item?.status === "processing") return <small className="brandingUploadStatus" role="status">Processing image…</small>;
    if (item?.status === "error") return <small className="brandingUploadStatus brandingUploadError" role="alert">{item.message}</small>;
    return null;
  }
  async function handleImageUpload(field, input, options) {
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (!file) return;
    const sequence = (uploadSequence.current[field] || 0) + 1;
    uploadSequence.current[field] = sequence;
    setBrandingFeedback(null);
    setImageUploads((current) => ({ ...current, [field]: { status: "processing", message: "" } }));
    try {
      const value = await imageFileToDataUrl(file, options);
      if (uploadSequence.current[field] !== sequence) return;
      setF((current) => ({ ...current, [field]: value }));
      setImageUploads((current) => ({ ...current, [field]: { status: "ready", message: "" } }));
    } catch (error) {
      if (uploadSequence.current[field] !== sequence) return;
      setImageUploads((current) => ({ ...current, [field]: { status: "error", message: error.message || "The image could not be processed." } }));
    }
  }
  function resetImage(field) {
    uploadSequence.current[field] = (uploadSequence.current[field] || 0) + 1;
    setF((current) => ({ ...current, [field]: "" }));
    setImageUploads((current) => ({ ...current, [field]: { status: "ready", message: "" } }));
    setBrandingFeedback(null);
  }
  function validateSettings() {
    if (!(Number(f.untrackedMinutes) > 0 && Number(f.offlineMinutes) > Number(f.untrackedMinutes))) {
      alert("Offline duration must be longer than Currently Untracked duration.");
      return false;
    }
    if (!baseMapAccessKeys.some((key) => normalizedMapAccess(f.enabledMaps)[key] !== false)) return alert("Enable at least one default map."), false;
    if (normalizedMapAccess(f.enabledMaps).openMapTiles !== false && String(f.openMapTilesUrl || "").trim() && !["{z}", "{x}", "{y}"].every((part) => String(f.openMapTilesUrl).includes(part))) return alert("OpenMapTiles URL must include {z}, {x} and {y} placeholders."), false;
    if (f.geocoderFallback && f.geocoderFallback !== "none" && f.geocoderFallback === f.geocoderPrimary) return alert("Choose a different fallback geocoder."), false;
    const geocoderKey = { geoapify: f.geoapifyKey, locationiq: f.locationIqKey, tomtom: f.tomtomGeocodingKey || f.tomtomMapsKey, mapbox: f.mapboxGeocodingToken || f.mapboxToken, here: f.hereGeocodingKey || f.hereMapsKey, maptiler: f.mapTilerGeocodingKey || f.mapTilerKey, bing: f.bingMapsKey };
    if (f.geocoderPrimary !== "nominatim" && !String(geocoderKey[f.geocoderPrimary] || "").trim()) return alert("Add the server key for the selected primary geocoder."), false;
    if (f.captchaProvider && f.captchaProvider !== "None" && (!String(f.captchaSiteKey || "").trim() || !String(f.captchaSecretKey || "").trim())) return alert("Add both CAPTCHA site and secret keys, or select None."), false;
    return true;
  }
  async function save() {
    if (processingImages || savingSettings || savingBranding || !validateSettings()) return;
    setSavingSettings(true);
    setBrandingFeedback(null);
    try {
      const saved = await setData({ ...data, settings: f, auditLogs: [{ id: Date.now(), time: now(), user: data.profile.name, action: "Updated Super Admin settings", target: "System Settings", result: "Success" }, ...data.auditLogs] }, { verify: () => verifyPublicLoginBranding(f), successMessage: "Settings saved and login branding verified." });
      if (saved) {
        applySuperBranding(f);
        setBrandingFeedback({ type: "success", message: "Login branding saved and verified on the public login page." });
      } else setBrandingFeedback({ type: "error", message: "The settings were not confirmed. Review the message above and try again." });
    } finally {
      setSavingSettings(false);
    }
  }
  async function saveLoginBranding() {
    if (processingImages || savingSettings || savingBranding) return;
    const settings = mergeLoginBranding(data.settings, f);
    setSavingBranding(true);
    setBrandingFeedback(null);
    try {
      const saved = await setData({ ...data, settings, auditLogs: [{ id: Date.now(), time: now(), user: data.profile.name, action: "Updated login branding", target: "Public Login", result: "Success" }, ...data.auditLogs] }, { verify: () => verifyPublicLoginBranding(settings), successMessage: "Login branding saved and verified." });
      if (saved) {
        applySuperBranding(settings);
        setBrandingFeedback({ type: "success", message: "Login logo and background are saved and available on both login portals." });
      } else setBrandingFeedback({ type: "error", message: "Login branding was not confirmed. Review the message above and try again." });
    } finally {
      setSavingBranding(false);
    }
  }
  return <div className="page"><PageHead title="Main Server Settings" subtitle="Global server, maps, geocoding, branding, security and retention settings."><button className="green" onClick={save} disabled={processingImages || savingSettings || savingBranding}><Save />{processingImages ? "Processing image…" : savingSettings ? "Saving…" : "Save Settings"}</button></PageHead><div className="grid2"><Panel title="Global Branding"><div className="settingsForm"><label>Default Portal Name<input value={f.portalTitle || ""} onChange={(e) => setF((current) => ({ ...current, portalTitle: e.target.value }))} /></label><label>Super Admin Browser Title<input value={f.browserTitle || ""} onChange={(e) => setF((current) => ({ ...current, browserTitle: e.target.value }))} /></label><label>Company Browser Title<input value={f.companyBrowserTitle || ""} onChange={(e) => setF((current) => ({ ...current, companyBrowserTitle: e.target.value }))} /></label><label className="span2">Default Logo<div className="brandingUpload">{f.brandLogoData ? <img src={f.brandLogoData} /> : <span>No logo selected</span>}<button type="button" onClick={() => logoRef.current?.click()}><Upload />Choose Logo</button><button type="button" onClick={() => resetImage("brandLogoData")} disabled={imageUploads.brandLogoData?.status === "processing"}><Trash2 />Reset</button><input ref={logoRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => handleImageUpload("brandLogoData", e.currentTarget)} /></div>{uploadNotice("brandLogoData")}</label><label className="span2">Default Collapsed Sidebar Logo / Icon<div className="brandingUpload compactBranding">{f.collapsedLogoData ? <img src={f.collapsedLogoData} /> : <span>No collapsed logo selected</span>}<button type="button" onClick={() => collapsedLogoRef.current?.click()}><Upload />Choose Collapsed Logo</button><button type="button" onClick={() => resetImage("collapsedLogoData")} disabled={imageUploads.collapsedLogoData?.status === "processing"}><Trash2 />Reset</button><input ref={collapsedLogoRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => handleImageUpload("collapsedLogoData", e.currentTarget)} /></div>{uploadNotice("collapsedLogoData")}</label><label className="span2">Login Page Logo<div className="brandingUpload compactBranding">{f.loginLogoData ? <img src={f.loginLogoData} /> : <span>Uses the default logo</span>}<button type="button" onClick={() => loginLogoRef.current?.click()}><Upload />Choose Login Logo</button><button type="button" onClick={() => resetImage("loginLogoData")} disabled={imageUploads.loginLogoData?.status === "processing"}><Trash2 />Use Default</button><input ref={loginLogoRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => handleImageUpload("loginLogoData", e.currentTarget)} /></div>{uploadNotice("loginLogoData")}</label><label className="span2">Login Background<div className="brandingUpload loginBackgroundUpload">{f.loginBackgroundData ? <img src={f.loginBackgroundData} /> : <span>No login background selected</span>}<button type="button" onClick={() => loginBgRef.current?.click()}><Upload />Choose Background</button><button type="button" onClick={() => resetImage("loginBackgroundData")} disabled={imageUploads.loginBackgroundData?.status === "processing"}><Trash2 />Reset</button><input ref={loginBgRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => handleImageUpload("loginBackgroundData", e.currentTarget, { maxDimension: 1920, quality: 0.84 })} /></div>{uploadNotice("loginBackgroundData")}<small>Only Super Admin can change this. It is used on both Super Admin and Company Admin login pages.</small></label><div className="span2 loginBrandingSaveRow"><div><b>Login page branding</b><small>Save and verify the logo, background, colors and login text without saving unfinished server settings.</small></div><button type="button" className="greenBtn" onClick={saveLoginBranding} disabled={processingImages || savingSettings || savingBranding}><Save />{processingImages ? "Processing image…" : savingBranding ? "Saving and verifying…" : "Save Login Branding"}</button></div>{brandingFeedback && <div className={"span2 brandingSaveFeedback " + (brandingFeedback.type === "error" ? "brandingSaveError" : "brandingSaveSuccess")} role={brandingFeedback.type === "error" ? "alert" : "status"}>{brandingFeedback.message}</div>}<label>Template color<input type="color" value={f.templateColor || "#0aa65f"} onChange={(e) => setF((current) => ({ ...current, templateColor: e.target.value }))} /></label><label>Login text color<input type="color" value={f.loginTextColor || "#0b2748"} onChange={(e) => setF((current) => ({ ...current, loginTextColor: e.target.value }))} /></label><label>Login page background color<input type="color" value={f.loginBackgroundColor || "#f4f8fb"} onChange={(e) => setF((current) => ({ ...current, loginBackgroundColor: e.target.value }))} /></label><label>Login panel background color<input type="color" value={f.loginPanelColor || "#ffffff"} onChange={(e) => setF((current) => ({ ...current, loginPanelColor: e.target.value }))} /></label><label className="span2">Welcome text<input value={f.welcomeText || ""} onChange={(e) => setF((current) => ({ ...current, welcomeText: e.target.value }))} /></label><label className="span2">Bottom text<input value={f.bottomText || ""} onChange={(e) => setF((current) => ({ ...current, bottomText: e.target.value }))} /></label><label className="span2 loginTransparencySetting">Login panel transparency <span>{Math.max(0, Math.min(70, Number(f.loginPanelTransparency ?? 18)))}%</span><input type="range" min="0" max="70" step="1" value={Math.max(0, Math.min(70, Number(f.loginPanelTransparency ?? 18)))} onChange={(e) => setF((current) => ({ ...current, loginPanelTransparency: Number(e.target.value) }))} /><small>0% is solid white. Higher values reveal more of the login background while keeping the form readable.</small></label><label className="span2">Google Play Store URL<input type="url" value={f.googlePlayUrl || ""} onChange={(e) => setF((current) => ({ ...current, googlePlayUrl: e.target.value }))} placeholder="https://play.google.com/store/apps/details?id=..." /><small>Only Super Admin can change this app link.</small></label><label>Apple App Store URL<input type="url" value={f.appStoreUrl || ""} onChange={(e) => setF((current) => ({ ...current, appStoreUrl: e.target.value }))} placeholder="https://apps.apple.com/app/..." /><small>Only Super Admin can change this app link.</small></label><label>WhatsApp number<input type="tel" value={f.whatsappNumber || ""} onChange={(e) => setF((current) => ({ ...current, whatsappNumber: e.target.value }))} placeholder="+974 5555 5555" /><small>Used by the WhatsApp button on both login pages. Include the country code.</small></label><label className="span2">Default Favicon<div className="brandingUpload compactBranding">{f.faviconData ? <img src={f.faviconData} /> : <span>No favicon selected</span>}<button type="button" onClick={() => favRef.current?.click()}><Upload />Choose Favicon</button><button type="button" onClick={() => resetImage("faviconData")} disabled={imageUploads.faviconData?.status === "processing"}><Trash2 />Reset</button><input ref={favRef} hidden type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml" onChange={(e) => handleImageUpload("faviconData", e.currentTarget)} /></div>{uploadNotice("faviconData")}</label><div className="span2 hintBox">New company portals automatically use this default logo and favicon. A Company Admin may upload its own company logo, which overrides only the logo for that company.</div></div></Panel><Panel title="Server & Tracking"><div className="settingsForm"><label>Server name<input value={f.serverName || "MASAR TRACK"} onChange={(e) => setF((current) => ({ ...current, serverName: e.target.value }))} /></label><label>Server description<input value={f.serverDescription || ""} onChange={(e) => setF((current) => ({ ...current, serverDescription: e.target.value }))} /></label><label>Tracker Host / Domain<input value={f.trackerHost} onChange={(e) => setF((current) => ({ ...current, trackerHost: e.target.value }))} /></label><label>INVIHA API URL<input value={f.apiUrl} onChange={(e) => setF((current) => ({ ...current, apiUrl: e.target.value }))} /></label><label>Default Protocol<select value={f.defaultProtocol} onChange={(e) => setF((current) => ({ ...current, defaultProtocol: e.target.value }))}>{protocolOptions.map((x) => <option key={x}>{x}</option>)}</select></label><label>Currently Untracked after no communication (minutes)<input type="number" min="1" value={f.untrackedMinutes || 15} onChange={(e) => setF((current) => ({ ...current, untrackedMinutes: Number(e.target.value) }))} /></label><label className='checkLine span2'><input type='checkbox' checked={f.trackingPolicyEnabled === true} onChange={(e) => setF((current) => ({ ...current, trackingPolicyEnabled: e.target.checked }))} /><span>Apply this global tracking policy to every company</span></label><p>Saving applies these durations to all existing and future vehicles across companies only when this option is enabled. Freshness only controls the live glow.</p><label>Offline Threshold (minutes)<input type="number" value={f.offlineMinutes} onChange={(e) => setF((current) => ({ ...current, offlineMinutes: Number(e.target.value) }))} /></label></div></Panel><Panel title="General"><div className="settingsForm"><label>Support Email<input value={f.supportEmail} onChange={(e) => setF((current) => ({ ...current, supportEmail: e.target.value }))} /></label><label>Support Phone<input value={f.supportPhone} onChange={(e) => setF((current) => ({ ...current, supportPhone: e.target.value }))} /></label><label>Timezone<input value={f.timezone} onChange={(e) => setF((current) => ({ ...current, timezone: e.target.value }))} /></label><label>Date format<select value={f.dateFormat || "DD-MM-YYYY"} onChange={(e) => setF((current) => ({ ...current, dateFormat: e.target.value }))}><option>DD-MM-YYYY</option><option>MM-DD-YYYY</option><option>YYYY-MM-DD</option></select></label><label>Time format<select value={f.timeFormat || "24h"} onChange={(e) => setF((current) => ({ ...current, timeFormat: e.target.value }))}><option value="12h">12-hour with AM/PM (8:06 PM)</option><option value="24h">24-hour (20:06)</option></select><small>Applies to vehicle times for Super Admin and all customer accounts.</small></label><label>Duration format<select value={f.durationFormat || "HH:mm:ss"} onChange={(e) => setF((current) => ({ ...current, durationFormat: e.target.value }))}><option>HH:mm:ss</option><option>Human readable</option></select></label><label>Distance unit<select value={f.distanceUnit || "km"} onChange={(e) => setF((current) => ({ ...current, distanceUnit: e.target.value }))}><option value="km">Kilometres (km)</option><option value="mi">Miles (mi)</option></select></label><label>Capacity unit<select value={f.capacityUnit || "L"} onChange={(e) => setF((current) => ({ ...current, capacityUnit: e.target.value }))}><option>L</option><option>gal</option></select></label><label>Altitude unit<select value={f.altitudeUnit || "m"} onChange={(e) => setF((current) => ({ ...current, altitudeUnit: e.target.value }))}><option>m</option><option>ft</option></select></label><label>Distance decimals<select value={f.distanceDecimals ?? 1} onChange={(e) => setF((current) => ({ ...current, distanceDecimals: Number(e.target.value) }))}><option value="0">0 (2 km)</option><option value="1">1 (2.5 km)</option><option value="2">2 (2.50 km)</option></select></label><label>Language<select value={f.language} onChange={(e) => setF((current) => ({ ...current, language: e.target.value }))}><option>English</option><option>Arabic</option></select></label><label>Backup Retention (weeks)<input type="number" value={f.backupRetention} onChange={(e) => setF((current) => ({ ...current, backupRetention: Number(e.target.value) }))} /></label></div></Panel><MapsAndGeocodingSettings f={f} setF={setF} /><LifecycleAndSecuritySettings f={f} setF={setF} /><Panel title="Deployment Notes"><textarea className="bigTextarea" value={f.notes} onChange={(e) => setF((current) => ({ ...current, notes: e.target.value }))} placeholder="VPS notes, firewall ports, domain plan..." /></Panel></div></div>;
}
function ProfilePage({ data, setData }) {
  const [f, setF] = useState({ ...data.profile });
  return <div className="page"><PageHead title="Profile" subtitle="INVIHA Super Admin profile."><button className="green" onClick={() => setData({ ...data, profile: f })}><Save />Save Profile</button></PageHead><Panel><div className="formGrid"><label>Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label><label>Email<input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label><label>Mobile<input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></label><label>Company<input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></label></div></Panel></div>;
}
function LanguagePage({ data, setData }) {
  return <div className="page"><PageHead title="Language" subtitle="Super Admin display preference." /><Panel><div className="choiceCards"><button className={data.settings.language === "English" ? "selectedChoice" : ""} onClick={() => setData({ ...data, settings: { ...data.settings, language: "English" } })}><Languages /><b>English</b><span>Default interface</span></button><button className={data.settings.language === "Arabic" ? "selectedChoice" : ""} onClick={() => setData({ ...data, settings: { ...data.settings, language: "Arabic" } })}><Languages /><b>Arabic</b><span>RTL translation layer later</span></button></div></Panel></div>;
}
function App() {
  const [authUser, setAuthUser] = useState(null), [authChecked, setAuthChecked] = useState(false);
  const [data, setDataState] = useState(loadData);
  const [apiReady, setApiReady] = useState(false);
  useLanguageSetting(data.settings.language);
  useEffect(() => {
    const t = getToken();
    if (!t) {
      setAuthChecked(true);
      return;
    }
    apiJson("/auth/me").then((u) => {
      if (u.role === "super_admin") setAuthUser(u);
      else localStorage.removeItem(AUTH_KEY);
    }).catch(() => localStorage.removeItem(AUTH_KEY)).finally(() => setAuthChecked(true));
  }, []);
  useEffect(() => applySuperBranding(data.settings), [data.settings]);
  const [page, setPageRaw] = useState(() => readClientPage("admin", window.location.pathname));
  const setPage = (p) => {
    pushClientPage("admin", p);
    setPageRaw(p);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const pop = () => {
      setPageRaw(readClientPage("admin", window.location.pathname));
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const [companyFilter, setCompanyFilter] = useState("");
  const version = useRef(0), busySave = useRef(false);
  const [saveMessage, setSaveMessage] = useState(""), [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState(""), [restartingTracking, setRestartingTracking] = useState(false);
  useEffect(() => {
    if (!saveMessage || /saving/i.test(saveMessage)) return;
    const t = setTimeout(() => setSaveMessage(""), /not saved|unable|failed/i.test(saveMessage) ? 8e3 : 3e3);
    return () => clearTimeout(t);
  }, [saveMessage]);
  const loadLive = async () => {
    const [companies, vehicles, users, remote, logs, inventory, admissions] = await Promise.all([apiJson("/companies"), apiJson("/vehicles"), apiJson("/users"), apiJson("/platform/state"), apiJson("/platform/logs"), apiJson("/inventory").catch((e) => {
      setSaveMessage("Tracker inventory unavailable: " + e.message);
      return [];
    }), apiJson("/device-admissions").catch((e) => {
      setSaveMessage("Unknown device list unavailable: " + e.message);
      return [];
    })]);
    version.current = Number(remote.version);
    const cUi = companies.map(apiCompanyToUi), vUi = vehicles.map(apiVehicleToUi).map((v) => {
      const s = fleetState(v, normalizeData(remote.data).settings);
      return { ...v, status: { moving: "Moving", idle: "Idle", parked: "Parked", untracked: "Currently Untracked", offline: "Offline", never: "Not Tracked Yet" }[s], deviceStatus: s === "offline" || s === "never" ? "Offline" : "Online" };
    });
    const subAccounts = Object.fromEntries(cUi.map((c) => [c.name, users.filter((u) => String(u.companyId) === String(c.id)).map((u) => ({ ...u.metadata, id: Number(u.id), companyId: Number(u.companyId), name: u.name, email: u.email, role: u.metadata?.displayRole || (u.role === "company_admin" ? "Company Admin" : "Viewer"), status: u.status === "active" ? "Active" : "Inactive" }))]));
    const next = { ...normalizeData(remote.data), companies: cUi, vehicles: vUi, devices: inventory, pendingDevices: admissions, subAccounts };
    next.profile = { ...next.profile, name: next.profile.name || authUser.name, email: next.profile.email || authUser.email };
    next.auditLogs = logs.map((x) => ({ id: x.id, time: new Date(x.created_at).toLocaleString(), user: x.actor || "Administrator", action: x.action, target: x.entity_id || "", result: "Recorded" }));
    setDataState(next);
    setApiReady(true);
    setLoaded(true);
    setLoadError("");
    return next;
  };
  const retryInitialLoad = async () => {
    setLoadError("");
    try {
      await loadLive();
    } catch (error) {
      setApiReady(false);
      setLoadError(error.message || "The Super Admin data could not be loaded.");
    }
  };
  const setData = async (d, options = {}) => {
    if (!loaded || busySave.current) {
      setSaveMessage("Wait for the current request to finish.");
      return false;
    }
    busySave.current = true;
    const confirmSaved = async () => {
      const fresh = await loadLive();
      if (options.verify) {
        try {
          await options.verify(fresh);
        } catch (error) {
          setSaveMessage("Verification failed after save: " + error.message);
          return false;
        }
      }
      setSaveMessage(options.successMessage || "Saved");
      return true;
    };
    setSaveMessage("Saving to server\u2026");
    try {
      if (JSON.stringify(d.subAccounts) !== JSON.stringify(data.subAccounts)) {
        for (const c of data.companies) {
          const before = data.subAccounts[c.name] || [], after = d.subAccounts[c.name] || [];
          for (const u of after) {
            const prev = before.find((x) => x.id === u.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(u)) await apiJson("/users" + (prev ? "/" + u.id : ""), { method: prev ? "PUT" : "POST", body: JSON.stringify({ companyId: c.id, name: u.name, email: u.email, password: u.password || "", role: u.role === "Company Admin" ? "company_admin" : "company_user", status: u.status === "Active" ? "active" : "inactive", metadata: { ...u, displayRole: u.role } }) });
          }
          for (const u of before.filter((x) => !after.some((y) => x.id === y.id))) await apiJson("/users/" + u.id, { method: "DELETE" });
        }
      }
      if (d.profile.name !== data.profile.name || d.profile.email !== data.profile.email) {
        const profile = await apiJson("/auth/profile", { method: "PUT", body: JSON.stringify(d.profile) });
        setAuthUser((x) => ({ ...x, ...profile }));
      }
      const { companies, vehicles, devices, pendingDevices, subAccounts, ...shared } = d;
      const r = await apiJson("/platform/state", { method: "PUT", body: JSON.stringify({ data: shared, version: version.current }) });
      version.current = Number(r.version);
      return await confirmSaved();
    } catch (e) {
      if (e.body?.error === "Another administrator changed these records." || /records changed|refresh and retry/i.test(e.message)) {
        try {
          const fresh = await loadLive();
          const rebased = { ...fresh };
          for (const key of Object.keys(d)) {
            if (["companies", "vehicles", "devices", "pendingDevices", "subAccounts"].includes(key)) continue;
            if (JSON.stringify(d[key]) !== JSON.stringify(data[key])) rebased[key] = d[key];
          }
          const { companies, vehicles, devices, pendingDevices, subAccounts, ...shared } = rebased;
          const retry = await apiJson("/platform/state", { method: "PUT", body: JSON.stringify({ data: shared, version: version.current }) });
          version.current = Number(retry.version);
          return await confirmSaved();
        } catch (retryError) {
          setSaveMessage("Not saved: " + retryError.message);
          return false;
        }
      }
      setSaveMessage("Not saved: " + e.message);
      return false;
    } finally {
      busySave.current = false;
    }
  };
  const savePlatformSettings = async (category, settings, options = {}) => {
    if (!loaded || busySave.current) throw new Error("Wait for the current request to finish.");
    busySave.current = true;
    setSaveMessage("Saving this settings section to the server\u2026");
    let persisted = false;
    const saveAtCurrentVersion = async () => {
      const result = await apiJson("/platform/settings", {
        method: "PATCH",
        body: JSON.stringify({ version: version.current, category, settings })
      });
      version.current = Number(result.version);
      return result;
    };
    try {
      let result;
      try {
        result = await saveAtCurrentVersion();
      } catch (error) {
        if (error.body?.error !== "platform_settings_conflict") throw error;
        const serverSettings = error.body?.settings;
        version.current = Number(error.body?.version);
        if (!serverSettings || !Number.isSafeInteger(version.current)) throw error;
        const sameSectionChanged = settingsSectionChangedOnServer(settings, data.settings, serverSettings, initialData.settings);
        setDataState((current) => ({ ...current, settings: { ...current.settings, ...serverSettings } }));
        if (sameSectionChanged) {
          throw new Error("Another Super Admin changed this same section. Your draft was not saved. Reload to compare it, or review your values and press Save again.");
        }
        result = await saveAtCurrentVersion();
      }
      persisted = true;
      const savedSettings = result.settings || {};
      setDataState((current) => ({ ...current, settings: { ...current.settings, ...savedSettings } }));
      if (options.verify) {
        try {
          await options.verify(savedSettings);
        } catch (error) {
          throw new Error("Settings were saved, but public login verification failed: " + error.message);
        }
      }
      setSaveMessage("Settings section saved.");
      return savedSettings;
    } catch (error) {
      const detail = error.body?.message || error.message || "Unable to save this section.";
      setSaveMessage((persisted ? "Saved, but verification failed: " : "Not saved: ") + detail);
      throw new Error(detail);
    } finally {
      busySave.current = false;
    }
  };
  useEffect(() => {
    if (!authUser) return;
    let alive = true, stopStream = () => {
    };
    loadLive().then(() => {
      if (!alive) return;
      stopStream = subscribeVehicleStream((rows) => {
        setDataState((prev) => {
          const settings = normalizeData(prev).settings, vehicles = rows.map(apiVehicleToUi).map((v) => {
            const s = fleetState(v, settings);
            return { ...v, status: { moving: "Moving", idle: "Idle", parked: "Parked", untracked: "Currently Untracked", offline: "Offline", never: "Not Tracked Yet" }[s], deviceStatus: s === "offline" || s === "never" ? "Offline" : "Online" };
          });
          return { ...prev, vehicles };
        });
      }, (connected) => setApiReady(connected));
    }).catch((e) => {
      if (alive) {
        setApiReady(false);
        setSaveMessage("Unable to load live data: " + e.message);
        setLoadError(e.message || "The Super Admin data could not be loaded.");
      }
    });
    return () => {
      alive = false;
      stopStream();
    };
  }, [authUser?.id]);
  const counts = useMemo(() => {
    const accounts = Object.values(data.subAccounts).flat();
    const admins = accounts.filter((user) => String(user?.role || user?.metadata?.displayRole || "").replace(/[_\\s]+/g, " ").trim().toLowerCase() === "company admin").length;
    return { companies: data.companies.length, admins, users: accounts.length, vehicles: data.vehicles.length };
  }, [data]);
  const restartTracking = async () => {
    if (restartingTracking || !confirm("Restart the Traccar tracking receiver now? Live device updates may pause briefly.")) return;
    setRestartingTracking(true);
    setSaveMessage("Restarting tracking service\u2026");
    try {
      const out = await apiJson("/system/restart-tracking", { method: "POST" });
      setSaveMessage(out.message || "Tracking service restarted.");
      await loadLive();
    } catch (e) {
      setSaveMessage("Restart failed: " + (e.body?.error || e.message));
    } finally {
      setRestartingTracking(false);
    }
  };
  let body;
  if (page === "dashboard") body = <Dashboard data={data} setData={setData} setPage={setPage} apiReady={apiReady} />;
  else if (page === "news") body = <NewsUpdatesPage data={data} setData={setData} />;
  else if (page === "map") body = <MapPage data={data} />;
  else if (page === "companies") body = <CompanyUsersPage data={data} setData={setData} />;
  else if (page === "events") body = <EventsPage data={data} />;
  else if (page === "vehicles") body = <VehiclesPage data={data} setData={setData} companyFilter={companyFilter} setCompanyFilter={setCompanyFilter} />;
  else if (page === "commands") body = <SuperCommandsPage data={data} />;
  else if (["mapIcons", "vehicleIcons", "sensorGroups"].includes(page)) body = <MasterData data={data} setData={setData} request={apiJson} />;
  else if (page === "trackingPorts") body = <TrackingPortsPage request={apiJson} />;
  else if (page === "reportSettings") body = <ReportSettingsPage request={apiJson} />;
  else if (page === "unregisteredVehicles") body = <UnregisteredDevicesPage data={data} request={apiJson} reload={loadLive} />;
  else if (page === "reportLogs") body = <LogsPage data={data} setData={setData} />;
  else if (moduleLabels[page]) body = <AdminModulePage data={data} setData={setData} page={page} />;
  else if (page === "master") body = <MasterData data={data} setData={setData} request={apiJson} />;
  else if (page === "diagnostics") body = <SupportDiagnosticsPage data={data} request={apiJson} />;
  else if (page === "logs") body = <LogsPage data={data} setData={setData} />;
  else if (page === "backups") body = <RetentionCleanupPage data={data} setData={setData} />;
  else if (page === "database") body = <DatabasePage data={data} />;
  else if (page === "billing") body = <BillingPage data={data} setData={setData} />;
  else if (page === "support") body = <SupportPage data={data} setData={setData} />;
  else if (page === "settings") body = <MainServerSettingsPage settings={data.settings} saveSettings={savePlatformSettings} verifyBranding={verifyPublicLoginBranding} applyBranding={applySuperBranding} />;
  else if (page === "profile") body = <ProfilePage data={data} setData={setData} />;
  else if (page === "language") body = <LanguagePreferences value={data.settings.language} onSave={(language) => setData({ ...data, settings: { ...data.settings, language } })} />;
  else body = <Dashboard data={data} setData={setData} setPage={setPage} apiReady={apiReady} />;
  if (!authChecked) return <BrandLoading />;
  if (!authUser) return <SuperLogin onReady={(u) => {
    setAuthUser(u);
    setAuthChecked(true);
  }} />;
  if (!loaded) return loadError ? <div className="authPage"><div className="authCard initialLoadError"><h1>Server data could not load</h1><p>{loadError}</p><button className="greenBtn" type="button" onClick={retryInitialLoad}><RefreshCw />Try Again</button></div></div> : <BrandLoading />;
  const logout = async () => {
    try {
      await apiJson("/auth/logout", { method: "POST" });
    } catch {
    }
    localStorage.removeItem(AUTH_KEY);
    setAuthUser(null);
  };
  return <div className="app"><Sidebar page={page} setPage={setPage} counts={counts} settings={data.settings} onLogout={logout} onRestartTracking={restartTracking} restarting={restartingTracking} /><Header data={data} setData={setData} setPage={setPage} /><main>{saveMessage && <div className={"saveToast" + (/not saved|unable|failed/i.test(saveMessage) ? " saveError" : "")} role="status">{saveMessage}</div>}{body}<footer className="copyrightFooter">© 2026 INVIHA Technologies</footer></main><ExportDialogHost/></div>;
}
function NewsUpdatesPage({ data, setData }) {
  const imageTemplates = { landscape: { label: "Landscape popup \xB7 16:9", ratio: 16 / 9 }, square: { label: "Square post \xB7 1:1", ratio: 1 }, portrait: { label: "Portrait post \xB7 4:5", ratio: 4 / 5 }, story: { label: "Story / Reel \xB7 9:16", ratio: 9 / 16 } };
  const [rows, setRows] = useState([]), [kind, setKind] = useState("announcement"), [heading, setHeading] = useState(""), [description, setDescription] = useState(""), [displayName, setDisplayName] = useState(""), [slideText, setSlideText] = useState(""), [imageData, setImageData] = useState(""), [sourceImage, setSourceImage] = useState(""), [imageUrl, setImageUrl] = useState(""), [imageTemplate, setImageTemplate] = useState("landscape"), [audience, setAudience] = useState("all"), [companyId, setCompanyId] = useState(""), [userId, setUserId] = useState(""), [startsAt, setStartsAt] = useState(""), [expiresAt, setExpiresAt] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [bannerTarget, setBannerTarget] = useState("all"), [bannerHeading, setBannerHeading] = useState(""), [bannerText, setBannerText] = useState(""), [bannerColor, setBannerColor] = useState("#d71920"), [bannerBusy, setBannerBusy] = useState(false), [bannerMessage, setBannerMessage] = useState("");
  const users = useMemo(() => Object.values(data.subAccounts || {}).flat(), [data.subAccounts]);
  const selectedBanner = useMemo(() => {
    return (data.headerBanners || []).find((x) => String(x.companyId ?? "all") === String(bannerTarget)) || null;
  }, [bannerTarget, data.headerBanners]);
  useEffect(() => {
    setBannerHeading(selectedBanner?.heading || "");
    setBannerText(selectedBanner?.text || "");
    setBannerColor(/^#[0-9a-f]{6}$/i.test(String(selectedBanner?.textColor || "")) ? selectedBanner.textColor : "#d71920");
    setBannerMessage("");
  }, [selectedBanner]);
  async function saveHeaderBanner() {
    setBannerBusy(true);
    setBannerMessage("");
    const key = bannerTarget === "all" ? null : Number(bannerTarget);
    const next = (data.headerBanners || []).filter((x) => String(x.companyId ?? "all") !== String(bannerTarget));
    if (bannerHeading.trim() || bannerText.trim()) next.push({ companyId: key, heading: bannerHeading.trim(), text: bannerText.trim(), textColor: bannerColor, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    try {
      const ok = await setData({ ...data, headerBanners: next });
      setBannerMessage(ok ? "Header banner saved." : "Header banner was not saved.");
    } catch (e) {
      setBannerMessage(e.message || "Header banner was not saved.");
    } finally {
      setBannerBusy(false);
    }
  }
  const load = () => apiJson("/news").then((x) => setRows(Array.isArray(x) ? x : [])).catch((e) => setMessage(e.message));
  useEffect(() => {
    load();
  }, []);
  const renderImage = (src, template = imageTemplate) => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const max = 1200, ratio = imageTemplates[template].ratio, targetW = ratio >= 1 ? max : Math.round(max * ratio), targetH = ratio >= 1 ? Math.round(max / ratio) : max, scale = Math.min(targetW / img.width, targetH / img.height), drawW = Math.max(1, Math.round(img.width * scale)), drawH = Math.max(1, Math.round(img.height * scale)), canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, Math.round((targetW - drawW) / 2), Math.round((targetH - drawH) / 2), drawW, drawH);
      setImageData(canvas.toDataURL("image/webp", 0.84));
    };
    img.src = src;
  };
  useEffect(() => {
    if (sourceImage) renderImage(sourceImage, imageTemplate);
  }, [sourceImage, imageTemplate]);
  const readImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(String(reader.result || ""));
      setImageUrl("");
    };
    reader.readAsDataURL(file);
  };
  async function send() {
    const imageOnly = kind === "image";
    if (imageOnly && !imageData && !imageUrl.trim()) return setMessage("Choose an image or provide an image URL.");
    if (!imageOnly && (!heading.trim() || !description.trim())) return setMessage("Add a heading and description for this message type.");
    setBusy(true);
    setMessage("");
    try {
      await apiJson("/news", { method: "POST", body: JSON.stringify({ kind, heading: heading.trim(), description: description.trim(), displayName: displayName.trim() || null, slideText: slideText.trim() || null, imageData: imageData || null, imageUrl: imageUrl.trim() || null, audience, companyId: audience === "company" ? companyId : null, userId: audience === "user" ? userId : null, startsAt: localDateTimeToIso(startsAt), expiresAt: localDateTimeToIso(expiresAt) }) });
      setHeading("");
      setDescription("");
      setDisplayName("");
      setSlideText("");
      setImageData("");
      setSourceImage("");
      setImageUrl("");
      setStartsAt("");
      setExpiresAt("");
      await load();
      setMessage("News update published.");
    } catch (e) {
      setMessage(e.body?.error || e.message);
    } finally {
      setBusy(false);
    }
  }
  const typeLabel = kind === "image" ? "Only image" : kind === "service" ? "Service message" : "Announcement";
  async function removeNews(item) {
    if (!confirm("Delete this news update for all recipients?")) return;
    setMessage("Deleting update\u2026");
    try {
      await apiJson(`/news/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      await load();
      setMessage("News update deleted.");
    } catch (e) {
      setMessage(e.body?.error || e.message);
    }
  }
  return <div className="page newsAdminPage"><PageHead title="News & Updates" subtitle="Send image greetings, service notices, or full announcements to your users." /><Panel className="headerBannerPanel"><div className="newsComposerHeading"><Megaphone /><div><h2>Header banner</h2><p>Set a company-specific static heading and optional scrolling message. Leave both blank to clear it.</p></div></div><div className="formGrid"><label>Company<select value={bannerTarget} onChange={(e) => setBannerTarget(e.target.value)}><option value="all">All companies</option>{data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Static heading<input value={bannerHeading} onChange={(e) => setBannerHeading(e.target.value)} placeholder="Shown before the ticker" /></label><label className="wide">Scrolling message<input value={bannerText} onChange={(e) => setBannerText(e.target.value)} placeholder="Optional text to scroll across the header" /></label><label className="wide bannerColorField">Scrolling text colour<div><input type="color" value={bannerColor} onChange={(e) => setBannerColor(e.target.value)} /><button type="button" className={bannerColor === "#079b58" ? "selected" : ""} onClick={() => setBannerColor("#079b58")} style={{ "--swatch": "#079b58" }}>Green</button><button type="button" className={bannerColor === "#d71920" ? "selected" : ""} onClick={() => setBannerColor("#d71920")} style={{ "--swatch": "#d71920" }}>Red</button><span style={{ color: bannerColor }}>Scrolling text preview</span></div></label></div><div className="newsComposerActions"><button className="green" disabled={bannerBusy} onClick={saveHeaderBanner}><Save />{bannerBusy ? "Saving\u2026" : "Save Header Settings"}</button>{bannerMessage && <span className="saveStatus">{bannerMessage}</span>}</div></Panel><div className="newsAdminGrid"><Panel><div className="newsComposer"><div className="newsComposerHeading"><Megaphone /><div><h2>Create update</h2><p>Choose the message style before publishing. Users receive it in News and as a popup.</p></div></div><label>Message type<select value={kind} onChange={(e) => setKind(e.target.value)}><option value="announcement">Announcement · heading + description</option><option value="service">Service message · heading + description</option><option value="image">Only image</option></select></label>{kind === "image" && <div className="newsImageUpload"><label>Image template<select value={imageTemplate} onChange={(e) => setImageTemplate(e.target.value)}>{Object.entries(imageTemplates).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}</select><small>Image is cropped automatically to this template.</small></label><label>Greeting image<input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0])} /></label><label>Or image URL (optional)<input value={imageUrl} onChange={(e) => {
    setImageUrl(e.target.value);
    if (e.target.value) setImageData("");
  }} placeholder="https://..." /></label>{(imageData || imageUrl) && <div className="newsImagePreview"><img src={imageData || imageUrl} alt="Greeting preview" /><button type="button" onClick={() => {
    setImageData("");
    setSourceImage("");
    setImageUrl("");
  }}>Remove image</button></div>}</div>}<label>Heading {kind === "image" && <small>(optional for image-only greeting)</small>}<input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder={kind === "service" ? "Scheduled maintenance" : "Vehicle service reminder"} /></label><label>Description {kind === "image" && <small>(optional for image-only greeting)</small>}<textarea rows="5" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "service" ? "Tell users what will happen and when." : "Write the message users should receive..."} /></label><div className="formGrid newsSchedule"><label>Send to<select value={audience} onChange={(e) => setAudience(e.target.value)}><option value="all">All users</option><option value="company">One company</option><option value="user">One user</option></select></label>{audience === "company" && <label>Company<select value={companyId} onChange={(e) => setCompanyId(e.target.value)}><option value="">Choose company</option>{data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}{audience === "user" && <label>User<select value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Choose user</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}</select></label>}<label>Start time<input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label><label>Expiry (optional)<input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label></div><div className="newsComposerActions"><button className="green" disabled={busy} onClick={send}><Send />{busy ? "Publishing\u2026" : "Publish " + typeLabel}</button>{message && <span className="saveStatus">{message}</span>}</div></div></Panel><Panel><div className="newsListHeading"><div><h2>Published updates</h2><p>Recent announcements and their delivery audience.</p></div><button onClick={load}><RefreshCw /></button></div><div className="newsAdminList">{rows.length ? rows.map((item) => <article key={item.id}>{(item.imageData || item.imageUrl) && <img className="newsAdminThumb" src={item.imageData || item.imageUrl} alt="" />}<div className="newsRowIcon"><Megaphone /></div><div className="newsRowContent"><small className="newsTypeBadge">{item.kind === "image" ? "Image greeting" : item.kind === "service" ? "Service message" : "Announcement"}</small>{item.heading && <h3>{item.heading}</h3>}{item.description && <p>{item.description}</p>}<small>{item.audience === "all" ? "All users" : item.audience === "company" ? data.companies.find((c) => String(c.id) === String(item.companyId))?.name || "Company" : "One user"} · {new Date(item.createdAt).toLocaleString()}</small></div><button type="button" className="newsDeleteButton" title="Delete news update" onClick={() => removeNews(item)}><Trash2 />Delete</button></article>) : <div className="newsEmptyState">No announcements published yet.</div>}</div></Panel></div></div>;
}
function RetentionCleanupPage({ data }) {
  const [companyId, setCompanyId] = useState(data.companies[0]?.id || "");
  const [days, setDays] = useState(30);
  const [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const company = data.companies.find((x) => String(x.id) === String(companyId));
  useEffect(() => {
    if (!companyId && data.companies[0]) setCompanyId(data.companies[0].id);
  }, [data.companies, companyId]);
  useEffect(() => {
    if (company) setDays(Number(company.historyRetentionDays) || 30);
  }, [companyId, company]);
  async function loadPreview() {
    setBusy(true);
    setMessage("");
    try {
      setPreview(await apiJson(`/retention/preview?companyId=${companyId}&days=${days}`));
      setConfirmation("");
    } catch (e) {
      setMessage(e.body?.error || e.message);
    } finally {
      setBusy(false);
    }
  }
  async function cleanup() {
    if (!preview) return;
    setBusy(true);
    setMessage("Creating backup and deleting expired data\u2026");
    try {
      const out = await apiJson("/retention/cleanup", { method: "POST", body: JSON.stringify({ companyId: Number(companyId), days: Number(days), confirmation }) });
      setMessage(`Cleanup complete. Deleted ${out.tracking.positions} positions and ${out.tracking.events} events.`);
      setPreview(null);
      setConfirmation("");
    } catch (e) {
      setMessage(e.body?.error || e.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="page"><PageHead title="Customer Data Retention" subtitle="Preview and permanently remove expired tracking data for one customer."><button className="green" onClick={loadPreview} disabled={busy || !companyId}><RefreshCw />Preview cleanup</button></PageHead><div className="stats fourStats"><Stat icon={Building2} label="Customers" value={data.companies.length} /><Stat icon={Clock3} label="Default" value="30 days" tone="green" /><Stat icon={DatabaseBackup} label="Backup" value="Required" tone="purple" /><Stat icon={ShieldCheck} label="Scope" value="Per company" tone="orange" /></div><Panel title="Cleanup target"><div className="formGrid"><label>Customer<select value={companyId} onChange={(e) => {
    setCompanyId(e.target.value);
    setPreview(null);
  }}>{data.companies.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Keep history for (days)<input type="number" min="1" max="3650" value={days} onChange={(e) => {
    setDays(Number(e.target.value) || 30);
    setPreview(null);
  }} /></label></div><p className="profileHint">This cleanup is company-level because vehicle history is shared by that customer’s users.</p></Panel>{preview && <Panel title={`Permanent cleanup preview \xB7 before ${new Date(preview.cutoff).toLocaleDateString()}`}><div className="checkList"><span><DatabaseBackup />A tracking database backup will be created first.</span><span><Trash2 />{preview.tracking.positions.toLocaleString()} raw GPS positions and {preview.tracking.events.toLocaleString()} tracking events will be deleted.</span><span><Trash2 />{(preview.application.scheduledReports + preview.application.driverEvents + preview.application.driverSessions + preview.application.auditEvents).toLocaleString()} INVIHA application records will be deleted.</span></div><label>Type <b>{preview.company.name}|{preview.cutoff.slice(0, 10)}</b> to confirm<input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={`${preview.company.name}|${preview.cutoff.slice(0, 10)}`} /></label><div className="modalActions"><button onClick={() => {
    setPreview(null);
    setConfirmation("");
  }}>Cancel</button><button className="danger" disabled={busy || confirmation !== `${preview.company.name}|${preview.cutoff.slice(0, 10)}`} onClick={cleanup}><Trash2 />Delete permanently</button></div></Panel>}{message && <p className="saveMessage" role="status">{message}</p>}<Panel title="How it works"><div className="checkList"><span><CheckCircle2 />Preview shows the exact records before deletion.</span><span><CheckCircle2 />A verified backup is created before permanent deletion.</span><span><CheckCircle2 />Raw Traccar positions and events are deleted in batches.</span><span><CheckCircle2 />The action is written to the Super Admin audit log.</span></div></Panel></div>;
}
export {
  App as default
};
