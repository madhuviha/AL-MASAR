import BragReport from './BragReport.jsx';
import RagReport from './RagReport.jsx';
import FleetReport from './FleetReport.jsx';
import LanguagePreferences,{useLanguageSetting,useText} from './LanguagePreferences.jsx';
import {readClientPage,pushClientPage} from './client-routing.mjs';
import {FormSection,VehicleAppearance,LoginVisual,LoginAppLinks,LoginSupportLinks,LoginBadge,LoginBrandText,LoginCaptcha,readLoginCaptchaToken,VehicleSymbol} from './FleetAppearance.jsx';
import {DeviceModelFields,SensorsIoPanel} from './DeviceProfiles.jsx';
import {profileRequest} from './api.js';
import {DriverIdentifiers,CurrentDriver,DriverIdentificationSettings,useDriverUpdates} from './DriverIdentification.jsx';
import AssignedSensors from './AssignedSensors.jsx';
import {trailLimit} from './speed-trail.mjs';
import LiveSpeed from './LiveSpeed.jsx';
import LiveSensorIcons from './LiveSensorIcons.jsx';
import {compactProfile} from './settings-save.mjs';
import DriverDutyFields from './DriverDutyFields.jsx';
import {dutyDriving} from '../../../backend/driver-duty.mjs';
import ReportExport from './ReportExport.jsx';
import {ExportDialogHost} from './ExportDialog.jsx';
import SensorConfigForm from './SensorConfigForm.jsx';
import VehicleSelect from './VehicleSelect.jsx';
import {reportSummary} from '../../../backend/report-metrics.mjs';
import {EngineIndicator,StopDuration} from './EngineIndicator';
import GeofenceEditor from './GeofenceEditor';
import {validGeofence} from '../../../backend/geofences.mjs';
import {SmoothMarker} from './SmoothMarker';
import MyLocation from './MyLocation';
import {companyAlerts,dedupeAlerts,normalizeAlertRules,unreadAlertCount} from './alert-notifications.mjs';
import AlertPopups from './AlertPopups.jsx';
import Address from './Address.jsx';
import {BrandLoading} from './LoadingStatus.jsx';
import {sensorPresets,digitalSensor,sensorReading,ruleThresholds,ignitionState,engineState} from './sensor-model.mjs';
import AlertDiagnostics from './AlertDiagnostics.jsx';
import AlertsManagerPage from './AlertsManagerPage.jsx';
import Basemap,{useMapConfig} from './Basemap.jsx';
import {mapVehicleSvg} from './vehicle-icon.mjs';
import AlertSoundControls,{useAlertSound} from './AlertSound';
import LiveTrail from './LiveTrail';
import DriverPhotoCrop from './DriverPhotoCrop.jsx';
import MapRecordedEvents from './MapRecordedEvents';
import VehiclesReference from './VehiclesReference';
import ImmobilizerControl from './ImmobilizerControl.jsx';
import {latestCommunicationTime,mapStatus,reportedHeading} from './map-status.mjs';
import {buildReport,reportTypes} from './reports';
import {calibrate} from './calibration.mjs';
import Playback from './Playback';
import {PrivacyPolicyPage,DataDeletionPage} from './PrivacyPolicy.jsx';
import CompanySettingsPage from './CompanySettingsPage.jsx';
import {buildCompanyExport} from './company-data-export.mjs';
import {withCompanySettingsSnapshot} from './company-settings-snapshot.mjs';
import React,{useEffect,useMemo,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{MapContainer,TileLayer,Marker,Popup,Polyline,Circle,Polygon,useMap,useMapEvents}from'react-leaflet';
import L from'leaflet';
import{
  Activity,AlertTriangle,BatteryCharging,Bell,CalendarDays,Car,Check,CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,Cog,
  CircleDot,ClipboardList,Clock3,Download,Edit3,Eye,FileDown,FileSpreadsheet,FileText,Filter,Fuel,Gauge,Globe2,History,
  Image as ImageIcon,Info,KeyRound,Lock,Layers3,Leaf,LocateFixed,LogOut,Mail,Map as MapIcon,MapPin,Maximize,Menu,MoreHorizontal,Navigation,EyeOff,
  PackageCheck,Pause,Phone,Play,Plus,Power,Radio,RefreshCw,Route,Save,Search,Send,Settings,ShieldCheck,Signal,SlidersHorizontal,
  Trash2,Upload,UserCog,UserRound,Users,Wrench,X,Zap,Megaphone,ChevronUp
}from'lucide-react';
import{api,authToken,setAuthToken,subscribeVehicles}from'./api';
import{addAudit,addRow,deleteRow,ensureCompany,id,loadStore,saveStore,updateRow}from'./store';

const DAY=86400000;
const platformDateLocale=format=>format==='MM-DD-YYYY'?'en-US':format==='YYYY-MM-DD'?'en-CA':'en-GB';
const fmtDate=v=>{if(!v)return'—';const setting=readGlobalBranding();return new Date(v).toLocaleDateString(platformDateLocale(setting.dateFormat),{timeZone:setting.timezone||'Asia/Qatar'})};
const fmtDateTime=v=>{if(!v)return'—';const setting=readGlobalBranding();return new Date(v).toLocaleString(platformDateLocale(setting.dateFormat),{timeZone:setting.timezone||'Asia/Qatar',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:setting.timeFormat==='12h'})};
const kmh=p=>Math.round((Number(p?.speed)||0)*1.852);
const ageMs=p=>p?Date.now()-new Date(p.serverTime||p.deviceTime||p.fixTime||0).getTime():Infinity;
const ageLabel=p=>{const m=Math.max(0,Math.round(ageMs(p)/60000));if(!Number.isFinite(m))return'No data';if(m<1)return'Just now';if(m<60)return`${m} min ago`;const h=Math.round(m/60);if(h<24)return`${h} hr${h===1?'':'s'} ago`;return`${Math.round(h/24)} day${Math.round(h/24)===1?'':'s'} ago`};
const communicationAgeLabel=v=>{const time=latestCommunicationTime(v);return time?ageLabel({serverTime:time}):'No data'};
const cardUpdatedAt=v=>{const time=latestCommunicationTime(v);if(!time)return 'No data';const d=new Date(time);return Number.isNaN(d.getTime())?'No data':d.toISOString().slice(0,19).replace('T',' ')};
const attr=(p,...keys)=>{for(const k of keys)if(p?.attributes?.[k]!==undefined&&p.attributes[k]!==null)return p.attributes[k];return null};
const boolText=v=>v===true?'ON':v===false?'OFF':v??'Not available';
const normalize=s=>String(s||'').trim().toLowerCase();
const catEmoji=c=>{const x=normalize(c);if(x.includes('motor'))return'🏍️';if(x.includes('ambul')||x.includes('emerg'))return'🚑';if(x.includes('bus'))return'🚌';if(x.includes('van'))return'🚐';if(x.includes('heavy')||x.includes('equipment'))return'🚜';if(x.includes('refriger'))return'🚚';if(x.includes('tanker'))return'🚛';if(x.includes('trailer'))return'🚛';if(x.includes('truck'))return'🚚';if(x.includes('pickup'))return'🛻';return'🚗'};
const POI_ICONS=['🏢','⛽','🏠','🏥','🅿️','🔧','🏪','🏫','🍽️','🏭','📦','🏦','✈️','⚓','🚧','⭐'];
const GLOBAL_BRAND_KEY='inviha_global_branding';
const readGlobalBranding=()=>{try{return JSON.parse(localStorage.getItem(GLOBAL_BRAND_KEY)||'{}')||{}}catch{return{}}};
const applyBrowserBranding=(company)=>{const g=readGlobalBranding();const fav=company?.faviconData||g.faviconData||'/favicon.svg';if(fav){let l=document.querySelector('link[rel~=\"icon\"]');if(!l){l=document.createElement('link');l.rel='icon';document.head.appendChild(l)}l.href=fav}document.title=g.companyBrowserTitle||g.portalTitle||company?.name||'MASAR TRACK'};
const poiIcon=v=>v||'📍';
function poiMarkerIcon(icon,name='POI'){const label=String(name||'POI').replace(/[<>&"']/g,'');return L.divIcon({className:'poi-marker-wrap',html:`<div class="poi-marker"><div class="poi-pop">${label}</div><div class="poi-pin">${poiIcon(icon)}</div></div>`,iconSize:[80,60],iconAnchor:[40,48]})}

const stateOf=(d,p,offlineMin=300,noSignalMin=5,untrackedMinutes)=>{const status=mapStatus({device:d,position:p},{offlineMinutes:offlineMin,noSignalMinutes:noSignalMin,untrackedMinutes});return status.group};
const stateLabel=s=>({expired:'Expired · Please renew',untracked:'Currently Untracked',never:'Not Tracked Yet',nosignal:'No GPS Signal',online:'Online',moving:'Moving',idle:'Idle',parked:'Parked',stopped:'Stopped',offline:'Offline'})[s]||s;
const stateColor=s=>({expired:'#dc2626',moving:'#16b364',idle:'#f5a524',parked:'#7c5ce0',stopped:'#7b6fe5',offline:'#ef5350',online:'#16b364'})[s]||'#8da0ae';
const fileDownload=(name,body,type='text/plain')=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
const csv=v=>`"${String(v??'').replaceAll('"','""')}"`;
const hav=(a,b)=>{const R=6371000,toR=n=>n*Math.PI/180,dLat=toR(b.lat-a.lat),dLon=toR(b.lng-a.lng),la1=toR(a.lat),la2=toR(b.lat);const q=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q))};
const inPoly=(p,pts)=>{let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const xi=pts[i][1],yi=pts[i][0],xj=pts[j][1],yj=pts[j][0];const cross=((yi>p.lat)!==(yj>p.lat))&&(p.lng<(xj-xi)*(p.lat-yi)/(yj-yi||1e-12)+xi);if(cross)inside=!inside}return inside};

const imageOf=v=>v?.local?.imageUrl||v?.local?.imageData||v?.imageUrl||'';
function VehicleImage({v}){const src=imageOf(v);return src?<img className="canonical-vehicle-image" src={src} alt={v.name||'Vehicle'} onError={e=>{e.currentTarget.style.display='none'}}/>:<VehicleSymbol category={v.category||v.local?.category}/>}
function vehicleHeading(v){return reportedHeading(v)}

const markerCache=new Map();function markerIcon(category,state,name,speed=0,image='',fresh=false,heading=null){const key=JSON.stringify([category,state,name,speed,fresh,heading]);if(markerCache.has(key))return markerCache.get(key);const icon=createMarkerIcon(category,state,name,speed,image,fresh,heading);markerCache.set(key,icon);if(markerCache.size>256)markerCache.delete(markerCache.keys().next().value);return icon}
function createMarkerIcon(category,state,name,speed=0,image='',fresh=false,heading=null){
  const label=String(name||'Vehicle').replace(/[<>&"']/g,'');
  const safeState=String(state||'offline').toLowerCase().replace(/[^a-z0-9_-]/g,'');
  const speedValue=Number(speed);
  const speedText=Number.isFinite(speedValue)?Math.round(speedValue):'�';

  const headingValue=Number(heading);
  const hasHeading=heading!==null&&heading!==undefined&&heading!==''&&Number.isFinite(headingValue);
  const angle=hasHeading?((headingValue%360)+360)%360:null;

  const shouldGlow=true;

  return L.divIcon({
    className:'fleet-marker-wrap',
    html:`
      <div class="fleet-marker ${safeState} ${shouldGlow?'live-glow':''}">
        <div class="marker-pop">${label} <b>${speedText} km/h</b></div>

        <div class="vehicle-map-shell">
          <div
            class="vehicle-map-icon ${hasHeading?'has-heading':''}"
            ${hasHeading?`style="transform:rotate(${angle}deg)"`:''}
          >
            ${mapVehicleSvg(category,{statusColor:true})}
          </div>
        </div>
      </div>
    `,
    iconSize:[130,86],
    iconAnchor:[65,62]
  });
}

function referenceMapMarker(category,state,name,speed=0,image='',fresh=false){
 const label=String(name||'Vehicle').replace(/[<>&"']/g,'');
 const color=state==='moving'?'#008e36':state==='idle'?'#ec8b2b':state==='parked'?'#188afa':'#75828d';
 const glow=fresh&&(state==='moving'||state==='idle');
 return L.divIcon({className:'reference-map-marker',html:
 '<div class="referenceMarkerLabel">'+label+' ('+(speed==null?'—':Math.round(Number(speed)))+' km/h)</div>'+
 '<div class="referencePin '+(glow?'communicating':'')+'" style="--pin-color:'+color+'"><span>'+
 (state==='parked'?'P':'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 5h14l3 7v7h-3v-2H5v2H2v-7zm2 2-2 5h14l-2-5zm-1 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>')+
 '</span></div>',iconSize:[150,82],iconAnchor:[75,76],popupAnchor:[0,-60]});
}

function MapFocus({pos,follow=false,points=[]}){const map=useMap(),fitted=useRef(false),focused=useRef(null);useEffect(()=>{map.invalidateSize()},[map]);useEffect(()=>{if(Number.isFinite(pos?.latitude)&&Number.isFinite(pos?.longitude)){const changed=focused.current!==pos.deviceId;if(changed||follow){map.setView([pos.latitude,pos.longitude],changed?14:map.getZoom(),{animate:false});focused.current=pos.deviceId}}else if(!fitted.current&&points.length){const bounds=L.latLngBounds(points);if(bounds.isValid()){map.fitBounds(bounds,{padding:[40,40],maxZoom:13,animate:false});fitted.current=true}}},[pos?.deviceId,pos?.latitude,pos?.longitude,follow,points.length,map]);return null}
function MapDefaultView({center,zoom,enabled}){const map=useMap(),applied=useRef('');useEffect(()=>{if(!enabled||!Array.isArray(center)||center.length!==2||!center.every(Number.isFinite))return;const key=`${center[0]}:${center[1]}:${zoom}`;if(applied.current===key)return;map.setView(center,zoom,{animate:false});applied.current=key},[map,enabled,center?.[0],center?.[1],zoom]);return null}

function FitFleetRequest({points,request}){const map=useMap();useEffect(()=>{if(request&&points.length){const bounds=L.latLngBounds(points);if(bounds.isValid())map.fitBounds(bounds,{padding:[80,80],maxZoom:16})}},[request,map]);return null}
function PickMap({mode,onCircle,onPolygon}){useMapEvents({click:e=>mode==='circle'?onCircle(e.latlng):onPolygon(e.latlng)});return null}

function Logo({company,compact=false}){const g=readGlobalBranding();const demoLogo=company?.name==='Demo Fleet Services'?'/masar-tracking-logo.png':'';const demoCollapsed=company?.name==='Demo Fleet Services'?'/masar-collapsed-logo.png':'';const full=company?.logoData||demoLogo||g.logoData||'';const collapsed=company?.collapsedLogoData||demoCollapsed||g.collapsedLogoData||full||'';const brandName=company?.name||g.portalTitle||'MASAR TRACK';return <div className={`company-logo ${compact?'compact':''} ${full?'imageOnly':''}`}>{full?<img className="fullBrandImage" src={full} alt="Company logo"/>:<div className="fallbackBrandText"><b>{brandName}</b></div>}{collapsed?<img className="compactBrandImage" src={collapsed} alt="Collapsed company logo"/>:<span className="compactBrandMark"><Leaf/></span>}</div>}
function useStableSidebar(){const[expanded,setExpanded]=useState(false),timers=useRef({enter:null,leave:null});const onMouseEnter=()=>{clearTimeout(timers.current.leave);clearTimeout(timers.current.enter);timers.current.enter=setTimeout(()=>setExpanded(true),20)};const onMouseLeave=()=>{clearTimeout(timers.current.enter);clearTimeout(timers.current.leave);timers.current.leave=setTimeout(()=>setExpanded(false),20)};const onNavigate=()=>{clearTimeout(timers.current.enter);clearTimeout(timers.current.leave);setExpanded(false)};useEffect(()=>()=>{clearTimeout(timers.current.enter);clearTimeout(timers.current.leave)},[]);return{expanded,onMouseEnter,onMouseLeave,onNavigate}}
function Toast({t}){return t?<div className="toast"><CheckCircle2/>{t}</div>:null}
function Modal({title,subtitle,onClose,children,wide=false}){const t=useText(),body=useRef(null);useEffect(()=>{body.current?.scrollTo({top:0,left:0})},[title]);return <div className="modalShade" onMouseDown={e=>e.target===e.currentTarget&&onClose()} onKeyDown={e=>e.key==='Escape'&&onClose()}><section className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={t(title)}><div className="modalHead"><div><h2>{t(title)}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" aria-label="Close" onClick={onClose}><X/></button></div><div className="modalBody" ref={body}>{children}</div></section></div>}
function Drawer({title,onClose,children}){return <aside className="drawer"><div className="drawerHead"><h3>{title}</h3><button onClick={onClose}><X/></button></div>{children}</aside>}
function Pill({children,type='ok'}){return <span className={`pill ${type}`}>{children}</span>}
function Empty({text='Nothing here yet'}){return <div className="empty"><CircleDot/><b>{text}</b></div>}
function Field({label,children,wide=false}){const t=useText();return <label className={wide?'wide':''}><span>{t(label)}</span>{children}</label>}

function LogisticsPlaceholder({title,description,icon:Icon=PackageCheck}){return <section className="page logisticsDeliveryPage"><div className="pageHead"><div><h1>{title}</h1><p>{description}</p></div></div><div className="card logisticsComingSoon"><Icon/><h2>{title}</h2><p>This page is ready for the upcoming implementation.</p><span>Coming soon</span></div></section>}

const NAV=[['dashboard','Dashboard',Activity],['map','Map',MapPin],['vehicles','Vehicles',Car],['commands','Commands',Send],['immobilizer','Immobilizer',ShieldCheck],['drivers','Drivers',UserRound],['reports','Reports',FileText],['alerts','Alerts',Bell],['geofences','Geofences',LocateFixed],['maintenance','Maintenance',Wrench],['news','News & Updates',Megaphone],['sensors','Sensors',Radio],['logistics','Logistics',PackageCheck],['delivery','Delivery',Route],['live-video','Live Video',Play],['users','Users',Users],['settings','Settings',Settings],['language','Language',Globe2]];


function CompanyLogin({company,onReady}){const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);const friendly=e=>({invalid_credentials:'Incorrect email or password.',account_disabled:'This account is disabled. Contact your administrator.',login_failed:'Unable to sign in right now. Please try again.',captcha_required:'Complete the security check and try again.'}[e]||'Unable to sign in. Check your details or contact your administrator.');async function submit(e){e.preventDefault();setError('');setBusy(true);try{const out=await api.login(email,password,readLoginCaptchaToken());if(out.user?.role==='super_admin')throw new Error('Use the Super Admin login page.');setAuthToken(out.token);onReady(out.user)}catch(ex){setError(friendly(ex.body?.error||ex.message))}finally{setBusy(false)}}return <div className="secureLogin productionLogin" style={{position:"fixed",inset:0,width:"100vw",height:"100dvh",display:"grid",placeItems:"center",margin:0,padding:16,boxSizing:"border-box"}}><LoginVisual/><form onSubmit={submit} className="loginForm productionCard masarLoginCard" style={{margin:"auto",width:"min(520px,calc(100vw - 32px))"}}><LoginBadge/><h1>Welcome back</h1><p>Sign in to your account.</p><label><span className="loginFieldLabel">Email address</span><span className="loginInputWrap"><Mail/><input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></span></label><label><span className="loginFieldLabel">Password</span><span className="fleetPassword loginInputWrap"><Lock/><input type={showPassword?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}><Eye/></button></span></label>{error&&<div className="loginError">{error}</div>}<LoginCaptcha/><button className="primary loginSubmit" disabled={busy}>{busy?'Logging in...':'Login'}</button><div className="loginSecurityLine"><span/><ShieldCheck/><b>Secure fleet access</b><span/></div><LoginAppLinks/><LoginSupportLinks/><LoginBrandText position="bottom"/></form></div>}

function Shell({company,page,setPage,alertCount,newsCount,headerBanner,vehicles,news,onContactSuperAdmin,onLogout,children}){const t=useText();useEffect(()=>applyBrowserBranding(company),[company?.id,company?.name,company?.logoData,company?.faviconData,JSON.stringify(readGlobalBranding())]);const sidebar=useStableSidebar();const[profileOpen,setProfileOpen]=useState(false),[geoOpen,setGeoOpen]=useState(false),profileRef=useRef(),sideRef=useRef();useEffect(()=>{const close=e=>{if(profileRef.current&&!profileRef.current.contains(e.target))setProfileOpen(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);useEffect(()=>{if(!sidebar.expanded)setGeoOpen(false)},[sidebar.expanded]);const onSideKey=e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const btns=[...sideRef.current.querySelectorAll('nav button,.geoSub button,.logout')].filter(x=>x.offsetParent!==null);if(!btns.length)return;e.preventDefault();let i=btns.indexOf(document.activeElement);if(e.key==='Home')i=0;else if(e.key==='End')i=btns.length-1;else if(e.key==='ArrowDown')i=i<0?0:(i+1)%btns.length;else i=i<0?btns.length-1:(i-1+btns.length)%btns.length;btns[i]?.focus()};return <div className="appShell autoSidebar"><aside ref={sideRef} tabIndex={0} aria-label="Company navigation" className={`side autoSide ${sidebar.expanded?'expanded':''}`} onKeyDown={onSideKey} onMouseEnter={sidebar.onMouseEnter} onMouseLeave={sidebar.onMouseLeave}><Logo company={company}/><nav>{NAV.map(([k,l,I])=>k==='geofences'?<React.Fragment key={k}><button aria-label={t(l)} className={['geofences','poi','parking'].includes(page)?'active':''} onClick={()=>{setGeoOpen(x=>!x)}}><I/><span>{t(l)}</span><ChevronDown className={`navChevron ${geoOpen?'open':''}`}/></button>{geoOpen&&<div className="geoSub"><button className={page==='geofences'?'activeSub':''} onClick={()=>{sidebar.onNavigate();setPage('geofences')}}><LocateFixed/><span>Geofence Zones</span></button><button className={page==='poi'?'activeSub':''} onClick={()=>{sidebar.onNavigate();setPage('poi')}}><MapPin/><span>POI</span></button><button className={page==='parking'?'activeSub':''} onClick={()=>{sidebar.onNavigate();setPage('parking')}}><Car/><span>Parking Slots</span></button></div>}</React.Fragment>:<button key={k} aria-label={t(l)} className={page===k?'active':''} onClick={()=>{sidebar.onNavigate();setPage(k)}}><I/><span>{t(l)}</span>{k==='alerts'&&alertCount>0&&<em>{alertCount}</em>}{k==='news'&&newsCount>0&&<em>{newsCount}</em>}</button>)}</nav><button className="logout" aria-label={t("Logout")} onClick={onLogout}><LogOut/><span>{t("Logout")}</span></button></aside><header className="top"><ExpiryBanner banner={headerBanner}/><div className="topRight"><div className="onlineVehicleBadge"><span></span>{vehicles.filter(v=>String(v.state||v.status||'').toLowerCase()!=='offline').length} vehicles online</div><button className="bell" onClick={()=>setPage('alerts')}><Bell/>{alertCount>0&&<i>{alertCount}</i>}</button><div className="profileWrap" ref={profileRef}><button type="button" className="topProfile" aria-haspopup="menu" aria-expanded={profileOpen} onClick={e=>{e.stopPropagation();setProfileOpen(x=>!x)}}><div className="avatar">{(company?.adminName||company?.contact||company?.name||'M')[0]}</div><div><b>{company?.adminName||company?.contact||company?.name||'Account'}</b><small>{company?.name||'Account'}</small></div><ChevronDown/></button>{profileOpen&&<div className="profileMenu"><button onClick={()=>{setPage('profile');setProfileOpen(false)}}><UserRound/>My Profile</button><button onClick={()=>{setPage('settings');setProfileOpen(false)}}><Settings/>Company Settings</button><button onClick={()=>{setPage('alerts');setProfileOpen(false)}}><Bell/>Notifications</button><button className="menuLogout" onClick={onLogout}><LogOut/>Logout</button></div>}</div></div></header><main>{children}</main></div>}

function KPI({icon:I,label,value,sub,tone='blue',onClick}){return <div className="kpi" role={onClick?'button':undefined} tabIndex={onClick?0:undefined} onClick={onClick} onKeyDown={e=>{if(onClick&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onClick()}}}><span className={tone}><I/></span><div><small>{label}</small><b>{value}</b><em>{sub}</em></div></div>}
function PageHead({title,subtitle,actions}){const t=useText();return <div className="pageHead"><div><h1>{t(title)}</h1><p>{subtitle}</p></div><div className="headActions">{actions}</div></div>}

function DashboardPage({company,vehicles,posBy,store,setPage}){
  const [filter,setFilter]=useState(null);

  const normalizeState=(v)=>{
    const s=String(v.state||'').toLowerCase();
    if(s==='moving') return 'moving';
    if(s==='idle') return 'idle';
    if(s==='parked') return 'parked';
    if(s==='offline') return 'offline';
    if(s==='stopped') return 'parked';
    return 'offline';
  };

  const counts={
    total:vehicles.length,
    moving:vehicles.filter(v=>normalizeState(v)==='moving').length,
    idle:vehicles.filter(v=>normalizeState(v)==='idle').length,
    parked:vehicles.filter(v=>normalizeState(v)==='parked').length,
    untracked:vehicles.filter(v=>normalizeState(v)==='untracked').length,
    never:vehicles.filter(v=>normalizeState(v)==='never').length,
    offline:vehicles.filter(v=>normalizeState(v)==='offline').length
  };

  const total=Math.max(counts.total,1);
  const movingPct=(counts.moving/total)*100;
  const idlePct=(counts.idle/total)*100;
  const parkedPct=(counts.parked/total)*100;
  const offlinePct=(counts.offline/total)*100;

  const filteredVehicles=filter==='all'
    ? vehicles
    : vehicles.filter(v=>normalizeState(v)===filter);

  const expiringVehicles=vehicles.map(v=>{
    const raw=v?.local?.expirationDate||v?.local?.expiryDate||v?.local?.expiry||v?.local?.expiresAt||v?.expirationDate||v?.expiryDate||v?.expiry;
    return {vehicle:v,raw,days:expiryDays(v)};
  }).filter(x=>Number.isFinite(x.days)&&x.days>=0&&x.days<=30).sort((a,b)=>a.days-b.days);

  const cards=[
    ['all','Total',Car,counts.total],
    ['moving','Moving',Navigation,counts.moving],
    ['idle','Idle',Clock3,counts.idle],
    ['parked','Parked',Car,counts.parked],
    ['offline','Offline',Signal,counts.offline]
  ];

  const statusColor={
    moving:'#16a34a',
    idle:'#f59e0b',
    parked:'#7c5ce0',
    untracked:'#ee6877',never:'#8494a8',offline:'#e34b59'
  };

  return <section className="page">
    <PageHead
      title="Dashboard"
      subtitle={`Welcome back, ${company.adminName||company.contact||'Admin'}! Here's what's happening with your fleet today.`}
      actions={<div className="dateChip"><CalendarDays/> {new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>}
    />

    <div className="kpiRow" style={{gridTemplateColumns:'repeat(5,minmax(0,1fr))'}}>
      {cards.map(([key,label,Icon,value])=>
        <KPI
          key={key}
          icon={Icon}
          label={label}
          value={value}
          sub="Vehicles"
          onClick={()=>setFilter(key)}
        />
      )}
    </div>

    <div className="dashGrid">
      <div className="card statusCard">
        <div className="cardTitle">
          <div>
            <h2>Vehicle Status</h2>
            <p>Live status of your vehicles</p>
          </div>
          <div className="dateChip"><CalendarDays/>Today<ChevronDown/></div>
        </div>

        <div className="donutWrap">
          <div style={{
            width:280,
            height:280,
            borderRadius:'50%',
            background:`conic-gradient(
              ${statusColor.moving} 0 ${movingPct}%,
              ${statusColor.idle} ${movingPct}% ${movingPct+idlePct}%,
              ${statusColor.parked} ${movingPct+idlePct}% ${movingPct+idlePct+parkedPct}%,
              ${statusColor.offline} ${movingPct+idlePct+parkedPct}% ${movingPct+idlePct+parkedPct+offlinePct}%,
              ${statusColor.untracked} ${movingPct+idlePct+parkedPct+offlinePct}% ${100-counts.never/total*100}%,
              ${statusColor.never} ${100-counts.never/total*100}% 100%
            )`,
            position:'relative',
            flex:'0 0 auto'
          }}>
            <div style={{
              position:'absolute',
              inset:40,
              background:'white',
              borderRadius:'50%',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              flexDirection:'column'
            }}>
              <strong style={{fontSize:38,lineHeight:1}}>{counts.total}</strong>
              <span style={{marginTop:10,color:'#64748b',fontWeight:600}}>Total Vehicles</span>
            </div>
          </div>

          <div className="legend">
            {[
              ['moving','Moving','Vehicle is moving'],
              ['idle','Idle','Ignition on, vehicle stationary'],
              ['parked','Parked','Vehicle parked'],
              ['offline','Offline','Communication timeout reached'],
              ['untracked','Currently Untracked','Insufficient position or ignition data'],
              ['never','Not Tracked Yet','No communication received']
            ].map(([key,label,desc])=>{
              const c=counts[key];
              const p=counts.total?Math.round(c/counts.total*100):0;
              return <div key={key} onClick={()=>setFilter(key)} style={{cursor:'pointer'}}>
                <i style={{width:12,height:12,borderRadius:'50%',background:statusColor[key],display:'inline-block'}}/>
                <span>
                  <b>{label}</b>
                  <small>{desc}</small>
                </span>
                <strong>
                  {c}
                  <small>{p}%</small>
                </strong>
              </div>
            })}
          </div>
        </div>
      </div>

      <div className="sideStack">
        <div className="card quick">
          <h2>Quick Actions</h2>
          <div>
            <button onClick={()=>setPage('map')}><MapPin/>View Map<small>Track vehicles</small></button>
            <button onClick={()=>setPage('reports')}><FileText/>Generate Report<small>Trips, stops, alerts</small></button>
            <button onClick={()=>setPage('alerts')}><Bell/>View Alerts<small>Recent notifications</small></button>
            <button onClick={()=>setPage('users')}><Settings/>Manage Users<small>Company access</small></button>
          </div>
        </div>
        <div className="card expiryDashboardCard">
          <div className="expiryDashboardHead"><div><h2><CalendarDays/>Vehicle Expiry</h2><p>Vehicles expiring within 30 days</p></div><span>{expiringVehicles.length}</span></div>
          <div className="expiryDashboardList">
            {expiringVehicles.length?expiringVehicles.map(({vehicle:v,raw,days})=><button key={v.id} type="button" onClick={()=>setPage('vehicles')} className={days<0?'expired':days<=7?'urgent':'soon'}>
              <span className="expiryDashboardIcon"><Car/></span>
              <span><b>{v.name||'Vehicle'}</b><small>{v.plate||v.registration||'No plate'} · {new Date(raw).toLocaleDateString('en-GB')}</small></span>
              <strong>{days<0?`${Math.abs(days)}d overdue`:days===0?'Today':`${days} days`}</strong>
            </button>):<div className="expiryDashboardEmpty"><CheckCircle2/><span>No vehicle expires in the next 30 days</span></div>}
          </div>
        </div>
      </div>
    </div>

    {filter&&<>
      <div
        onClick={()=>setFilter(null)}
        style={{
          position:'fixed',
          inset:0,
          background:'rgba(15,23,42,.24)',
          zIndex:1090
        }}
      />

      <aside className="fleetStatusDrawer" style={{
        position:'fixed',
        top:0,
        right:0,
        height:'100vh',
        width:'min(480px,92vw)',
        background:'#fff',
        zIndex:1100,
        boxShadow:'-12px 0 35px rgba(15,23,42,.18)',
        display:'flex',
        flexDirection:'column'
      }}>
        <div style={{
          padding:'22px 24px',
          borderBottom:'1px solid #e2e8f0',
          display:'flex',
          justifyContent:'space-between',
          alignItems:'center'
        }}>
          <div>
            <h2 style={{margin:0}}>
              {filter==='all'?'All Vehicles':stateLabel(filter)+' Vehicles'}
            </h2>
            <p style={{margin:'5px 0 0',color:'#64748b'}}>
              {filteredVehicles.length} vehicle{filteredVehicles.length===1?'':'s'}
            </p>
          </div>

          <button
            onClick={()=>setFilter(null)}
            style={{
              border:0,
              background:'#f1f5f9',
              width:38,
              height:38,
              borderRadius:10,
              cursor:'pointer',
              fontSize:20
            }}
           aria-label="Close vehicle list"><X/></button>
        </div>

        <div style={{padding:16,overflowY:'auto',flex:1}}>
          {filteredVehicles.length===0
            ? <div style={{padding:30,textAlign:'center',color:'#64748b'}}>No vehicles in this status</div>
            : filteredVehicles.map(v=>{
                const s=normalizeState(v);
                return <div key={v.id} className="dashboardVehicleCompact" style={{
                  border:'1px solid #e2e8f0',
                  borderRadius:14,
                  padding:16,
                  marginBottom:12
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
                    <div>
                      <span className="dashboardVehiclePhoto"><VehicleImage v={v}/></span><strong style={{fontSize:16}}>{v.name||'Vehicle'}</strong>
                      <div style={{fontSize:13,color:'#64748b',marginTop:3}}>
                        {v.plate||v.registration||'No plate'}
                      </div>
                    </div>

                    <span style={{
                      background:statusColor[s]+'22',
                      color:s==='offline'?'#64748b':statusColor[s],
                      padding:'5px 9px',
                      borderRadius:999,
                      fontSize:12,
                      fontWeight:700,
                      height:'fit-content'
                    }}>
                      {stateLabel(s)}
                    </span>
                  </div>

                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'1fr 1fr',
                    gap:10,
                    marginTop:14,
                    fontSize:13
                  }}>
                    <div>
                      <EngineIndicator value={status.group==='moving'?true:engineState(v.position)} source={v.position?.telemetry?.engineSource}/><StopDuration position={v.position}/><span style={{color:'#64748b'}}>Speed</span>
                      <br/>
                      <b>{Number(v.speed||0).toFixed(0)} km/h</b>
                    </div>

                    <div>
                      <span style={{color:'#64748b'}}>Last Update</span>
                      <br/>
                      <b>{latestCommunicationTime(v)?fmtDateTime(latestCommunicationTime(v)):'Not available'}</b>
                    </div>
                  </div>

                  <p>Current Driver: <CurrentDriver vehicle={v}/></p>
                  <div style={{display:'flex',gap:8,marginTop:14}}>
                    <button onClick={()=>{setFilter(null);setPage('map')}}>
                      <MapPin/> View on Map
                    </button>
                    <button onClick={()=>{setFilter(null);setPage('vehicles')}}>
                      <Car/> Open Vehicle
                    </button>
                  </div>
                </div>
              })
          }
        </div>
      </aside>
    </>}
  </section>
}

function VehicleStatusList({vehicles,selected,setSelected,onGeofences,onVehicles,onDetails,onEdit,onHistory,onCommand,toast,tab='Vehicles',onTab,settings={}}){
 const [q,setQ]=useState(''),[statusFilter,setStatusFilter]=useState('all'),[collapsed,setCollapsed]=useState(false),[menu,setMenu]=useState(null);
 const quickStatuses=[['all','All'],['moving','Running'],['idle','Idle'],['parked','Parked'],['offline','Offline'],['untracked','Untracked'],['never','No Data'],['expired','Expired']];
 const demoCards=typeof window!=='undefined'&&/^127\.0\.0\.1$|^localhost$/.test(window.location.hostname)&&!vehicles.length?[{id:'demo-card-1',name:'Demo Runner',plate:'DEMO-001',category:'Car',state:'moving',speed:54,lastUpdate:new Date().toISOString()},{id:'demo-card-2',name:'Demo Parked',plate:'DEMO-002',category:'SUV',state:'parked',speed:0,lastUpdate:new Date(Date.now()-18*60000).toISOString()},{id:'demo-card-3',name:'Demo Offline',plate:'DEMO-003',category:'Van',state:'offline',speed:0,lastUpdate:new Date(Date.now()-3*3600000).toISOString()}]:[];
 const cardVehicles=vehicles.length?vehicles:demoCards;
 const classified=cardVehicles.map(v=>{const live=mapStatus(v,settings);const fallback=v.state&&(!v.position||v.id?.toString().startsWith('demo-card-'))?v.state:null;return {v,status:fallback?{...live,group:fallback,speed:v.speed??live.speed}:live}});
 const blocked=v=>v?.expired===true||v?.liveAccess===false||v?.local?.expired===true;
 const act=(fn,v,...args)=>{setMenu(null);if(blocked(v)){toast?.(v.accessMessage||v.local?.accessMessage||'Vehicle subscription expired. Please renew to continue live tracking.');return}fn?.(v,...args)};
 useEffect(()=>{if(!menu)return;const close=()=>setMenu(null);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);return()=>{window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true)}},[menu]);
 const toggleMenu=(event,v)=>{event.stopPropagation();if(menu?.id===v.id){setMenu(null);return}const r=event.currentTarget.getBoundingClientRect(),width=204,height=194,gap=8;const rightSpace=window.innerWidth-r.right;const left=rightSpace>=width+gap?r.right+gap:Math.max(12,r.left-width-gap);const top=Math.max(12,Math.min(r.top,window.innerHeight-height-12));setMenu({id:v.id,v,left,top})};
 const statusCount=key=>key==='all'?classified.length:classified.filter(({status})=>status.group===key).length;
 const visibleRows=classified.filter(({v,status})=>(statusFilter==='all'||status.group===statusFilter)&&[v.name,v.plate,v.currentDriver?.name].join(' ').toLowerCase().includes(q.trim().toLowerCase()));
 const vehicleRow=({v,status})=><div key={v.id} data-state={status.group} className={'mapVehicleRow '+(selected?.id===v.id?'selected':'')}>
  <button className="mapVehicleMain" onClick={()=>act(setSelected,v)}><span className="catIcon">{imageOf(v)?<VehicleImage v={v}/>:<VehicleSymbol category={v.category}/>}</span><span className="mapVehicleIdentity"><b><span className="mapVehicleName">{v.name}</span><em className="mapVehicleBadge">{status.group==='moving'?'Running':stateLabel(status.group)}</em></b><small>{v.plate||'—'}{v.currentDriver?.name?` · ${v.currentDriver.name}`:''}</small><small className="mapVehicleUpdated"><Clock3/> {cardUpdatedAt(v)} <span className="mapVehicleAge">({communicationAgeLabel(v)})</span></small></span><span className="mapVehicleState"><strong key={status.speed} className="mapRowSpeed"><span className="speedNumber">{status.speed==null?'—':Math.round(status.speed)}</span> <small>Kph</small></strong><span className="mapVehicleSignals"><EngineIndicator value={status.group==='moving'?true:engineState(v.position)} source={v.position?.telemetry?.engineSource} iconOnly/></span></span></button>

  <button className="mapVehicleMore" aria-label={'Actions for '+v.name} aria-expanded={menu?.id===v.id} onClick={e=>toggleMenu(e,v)}><span className="actionDots" aria-hidden="true"><b/><b/><b/></span></button>
 </div>;
 return <>
  <div className="mapList">
   <div className="tabs">{['Vehicles','Playback','Alerts','Events'].map(t=><button key={t} className={t===tab?'active':''} onClick={()=>onTab?.(t)}>{t}</button>)}</div>
   {tab==='Vehicles'&&!collapsed&&<>
    <div className="searchLine"><Search/><input aria-label="Search vehicles" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search vehicles..."/><button title="Show all vehicles" aria-label="Show all vehicles" onClick={()=>{setQ('');setStatusFilter('all')}}><Filter/></button><button title="Manage vehicles" aria-label="Manage vehicles" onClick={onVehicles}><Plus/></button></div>
    <div className="statusCountStrip" aria-label="Vehicle status counts">{quickStatuses.map(([key,label])=><button type="button" key={key} data-state={key} className={statusFilter===key?'active':''} aria-pressed={statusFilter===key} onClick={()=>setStatusFilter(key)}><i/><span>{label}</span><b>{statusCount(key)}</b></button>)}</div>
    <div className="allVehicleListHeading"><strong>{quickStatuses.find(([key])=>key===statusFilter)?.[1]||'All'} Vehicles</strong><span>{visibleRows.length}</span></div>
    <div className="vehicleRows allVehicleRows">{visibleRows.map(vehicleRow)}{!visibleRows.length&&<Empty text="No vehicles match this search"/>}</div>
   </>}
   <button className="mapPanelToggle" aria-expanded={!collapsed} onClick={()=>setCollapsed(x=>!x)}>{collapsed?'⌄ Expand':'⌃ Collapse'}</button>
  </div>
  {menu&&createPortal(<div className="mapVehicleMenuPortal" style={{left:menu.left,top:menu.top}} role="menu" aria-label={'Actions for '+menu.v.name} onMouseDown={e=>e.stopPropagation()}><button onClick={()=>act(onDetails,menu.v)}><Eye/>View Details</button><button onClick={()=>act(onEdit,menu.v)}><Edit3/>Edit Vehicle</button><button onClick={()=>act(onHistory,menu.v,'hour')}><History/>History · Last Hour</button><button onClick={()=>act(onHistory,menu.v,'yesterday')}><History/>History · Yesterday</button><button onClick={()=>act(onCommand,menu.v)}><Send/>Send Command</button></div>,document.body)}
 </>
}

function CommandTemplates({protocol,onSelect}){const list=/teltonika/i.test(protocol||'')?commandTemplates.teltonika:commandTemplates.gt06;return <div className='commandTemplates'><span>Message templates</span>{list.map(([label,value])=><button type='button' key={value} onClick={()=>onSelect(value)}>{label}</button>)}</div>}
function GprsCommandControl({vehicle,company,toast}){const[command,setCommand]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const allowed=company?.permissions?.Commands!==false;async function send(){const text=command.trim();if(!text)return setMessage('Enter a GPRS command first.');if(text.length>400)return setMessage('Command is limited to 400 characters.');setBusy(true);setMessage('');try{const r=await api.sendCommand(vehicle.id,text);setMessage(r.message||'GPRS command queued for device delivery.');setCommand('');toast?.(r.message||'GPRS command queued.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}return <section className="gprsCommandControl"><div className="gprsCommandHead"><div><h3><Send/>GPRS command</h3><p>Send a raw tracker command through the device connection.</p></div><span>{vehicle.protocol||'GT06'}</span></div><CommandTemplates protocol={vehicle.protocol} onSelect={setCommand}/><textarea value={command} onChange={e=>setCommand(e.target.value)} placeholder="Enter the manufacturer GPRS command" rows="3" disabled={busy||!allowed}/><div className="gprsCommandActions"><small>{allowed?'The server queues the command and records delivery status.':'Commands permission is disabled for this account.'}</small><button className="primary" disabled={busy||!allowed||!command.trim()} onClick={send}>{busy?'Sending…':'Send to device'}</button></div>{message&&<p className="gprsCommandMessage" role="status">{message}</p>}</section>}
function ImmobilizerPage({vehicles,company,toast}){const available=vehicles.filter(v=>!v.expired&&v.liveAccess!==false),[vehicleId,setVehicleId]=useState(available[0]?.id||'');const vehicle=available.find(v=>String(v.id)===String(vehicleId))||available[0];const supported=vehicle&&/(teltonika|fmb|fmc|gt06|h9|gx06)/i.test(`${vehicle.protocol||''} ${vehicle.deviceModel||''}`);return <section className="page immobilizerPage"><PageHead title="Immobilizer" subtitle="Select a vehicle and safely immobilize or release its engine."/><div className="immobilizerPageCard"><label>Select vehicle<select value={vehicle?.id||''} onChange={e=>setVehicleId(e.target.value)}><option value="">Choose a vehicle</option>{available.map(v=><option key={v.id} value={v.id}>{v.name} · {v.imei||'No device ID'}</option>)}</select></label>{vehicle?<><div className="immobilizerVehicleSummary"><ShieldCheck/><div><b>{vehicle.name}</b><small>{vehicle.protocol||'Unknown protocol'} · {vehicle.deviceModel||vehicle.model||'Tracker'}</small></div></div>{supported?<ImmobilizerControl vehicle={vehicle} company={company} toast={toast}/>:<p className="profileHint">This tracker protocol is not supported for immobilizer commands.</p>}</>:<p className="profileHint">No active vehicles are available.</p>}</div></section>}function CommandsPage({vehicles,company,toast}){const availableVehicles=vehicles.filter(v=>!v.expired&&v.liveAccess!==false),protocolOptions=[{value:'gt06',label:'GT06 / H9 / GX06',icon:Radio,commands:[['Get Position (Single)','STATUS#'],['Start Live Tracking','TRACK,1#'],['Stop Live Tracking','TRACK,0#'],['Engine On (Immobilizer)','RELAY,1#'],['Engine Off (Immobilizer)','RELAY,0#'],['Enable SOS Alarm','SOS,1#']]},{value:'teltonika',label:'Teltonika (FMB/FMC)',icon:Radio,commands:commandTemplates.teltonika},{value:'vylion',label:'Vylion / Viyon',icon:Zap,commands:[]},{value:'concox',label:'Concox',icon:Radio,commands:[]},{value:'queclink',label:'Queclink',icon:Radio,commands:[]},{value:'other',label:'Other',icon:Settings,commands:[]}];const protocolText=v=>[v?.protocol,v?.deviceModel,v?.deviceModelId,v?.model,v?.device?.name,v?.local?.protocol,v?.local?.deviceModel].filter(Boolean).join(' ').toLowerCase();const protocolFamily=v=>{const p=protocolText(v);return /teltonika|fmb|fmc/.test(p)?'teltonika':/gt06|h9|gx06/.test(p)?'gt06':/vylion|viyon/.test(p)?'vylion':/concox/.test(p)?'concox':/queclink/.test(p)?'queclink':'other'};const commandOnline=v=>String(v?.device?.status||'').toLowerCase()==='online';const[protocol,setProtocol]=useState(()=>protocolFamily(availableVehicles[0])||'gt06'),[vehicleId,setVehicleId]=useState(availableVehicles[0]?.id||''),[commandKey,setCommandKey]=useState(''),[params,setParams]=useState(''),[history,setHistory]=useState([]),[dateRange,setDateRange]=useState(''),[historyProtocol,setHistoryProtocol]=useState(''),[statusFilter,setStatusFilter]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const profile=protocolOptions.find(x=>x.value===protocol)||protocolOptions[0],matches=v=>protocolFamily(v)===protocol;const protocolVehicles=availableVehicles.filter(matches);const vehicle=protocolVehicles.find(v=>String(v.id)===String(vehicleId))||protocolVehicles[0]||availableVehicles.find(v=>String(v.id)===String(vehicleId))||availableVehicles[0];const selectedCommand=profile.commands.find(([label,value])=>label===commandKey)||profile.commands[0];useEffect(()=>{if(vehicle&&!protocolVehicles.some(v=>String(v.id)===String(vehicleId)))setVehicleId(vehicle.id)},[protocol,vehicle?.id]);useEffect(()=>{setCommandKey(profile.commands[0]?.[0]||'');setParams('')},[protocol]);const loadHistory=()=>vehicle?api.commandHistory(vehicle.id).then(x=>setHistory(Array.isArray(x)?x:[])).catch(()=>setHistory([])):Promise.resolve();useEffect(()=>{loadHistory()},[vehicle?.id]);const chooseProtocol=e=>{setProtocol(e.target.value);setMessage('')};async function send(){if(!vehicle)return;if(!commandOnline(vehicle))return setMessage('Tracker is offline. GPRS commands are available after it reconnects.');const value=selectedCommand?.[1]||params.trim();if(!value)return setMessage('Choose a command template or enter its parameters.');const text=value.includes('{params}')?value.replace('{params}',params.trim()):params.trim()?`${value} ${params.trim()}`:value;setBusy(true);setMessage('');try{const r=await api.sendCommand(vehicle.id,text);setMessage(r.message||'Command queued for device delivery.');toast?.(r.message||'Command queued.');setParams('');await loadHistory()}catch(e){setMessage(e.message)}finally{setBusy(false)}}const shownHistory=history.filter(row=>{const status=String(row.status||row.kind||'').toLowerCase();return(!statusFilter||status.includes(statusFilter.toLowerCase()))&&(!historyProtocol||String(row.protocol||vehicle?.protocol||'').toLowerCase().includes(historyProtocol.toLowerCase()))&&(!dateRange||dateRange==='all'||(dateRange==='today'&&new Date(row.time).toDateString()===new Date().toDateString()))});return <section className="page commandsPage referenceCommandsPage"><PageHead title="Device Commands" subtitle="Send commands to your devices quickly and easily." actions={<button className="commandHelp"><Info/>Help</button>}/><div className="commandsReferenceCard"><div className="commandsReferenceGrid"><div className="commandStep"><h3><span>1.</span> Select Protocol</h3><select value={protocol} onChange={chooseProtocol}>{protocolOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select><div className="commandProtocolList">{protocolOptions.map(x=><button type="button" key={x.value} className={protocol===x.value?'active':''} onClick={()=>chooseProtocol({target:{value:x.value}})}><x.icon/>{x.label}</button>)}</div></div><div className="commandStep"><h3><span>2.</span> Select Vehicle</h3><select value={vehicle?.id||''} onChange={e=>setVehicleId(e.target.value)} disabled={!protocolVehicles.length}><option value="">Search vehicle or IMEI...</option>{protocolVehicles.map(v=><option key={v.id} value={v.id}>{v.name} · {v.imei||'No IMEI'}</option>)}</select><div className="commandVehicleList">{protocolVehicles.map(v=><button type="button" key={v.id} className={String(vehicle?.id)===String(v.id)?'active':''} onClick={()=>setVehicleId(v.id)}><Car/><span><b><span className="mapVehicleName">{v.name}</span><em className="mapVehicleBadge">{status.group==='moving'?'Running':stateLabel(status.group)}</em></b><small>{v.imei||'No IMEI'}</small></span><em className={commandOnline(v)?'':'offline'}>{commandOnline(v)?'Online':'Offline'}</em></button>)}</div>{!protocolVehicles.length&&<p className="commandNoItems">No vehicles use this protocol.</p>}</div><div className="commandStep"><h3><span>3.</span> Select Command</h3><select value={selectedCommand?.[0]||''} onChange={e=>setCommandKey(e.target.value)} disabled={!profile.commands.length}><option value="">Choose a command</option>{profile.commands.map(([label])=><option key={label} value={label}>{label}</option>)}</select><div className="commandCommandList">{profile.commands.map(([label,value])=><button type="button" key={label} className={selectedCommand?.[0]===label?'active':''} onClick={()=>setCommandKey(label)}><Send/>{label}<small>{value}</small></button>)}</div>{!profile.commands.length&&<p className="commandNoItems">Use the raw command field below for this protocol.</p>}</div><div className="commandStep commandParameters"><h3><span>4.</span> Parameters (if required)</h3><textarea value={params} onChange={e=>setParams(e.target.value)} placeholder={selectedCommand?.[1]||'Enter parameters (e.g. number, time, etc.)'} rows="8"/><button className="primary commandSendButton" disabled={busy||!vehicle||!commandOnline(vehicle)||(!selectedCommand?.[1]&&!params.trim())} onClick={send}><Send/>{busy?'Sending…':'Send Command'}</button>{message&&<p className="gprsCommandMessage" role="status">{message}</p>}</div></div></div><section className="commandHistory referenceCommandHistory"><div className="referenceHistoryHeading"><div><h2><ClipboardList/>Command History</h2><small>Device replies and delivery status are shown here.</small></div><div className="referenceHistoryFilters"><select value={dateRange} onChange={e=>setDateRange(e.target.value)}><option value="">Select date range</option><option value="today">Today</option><option value="all">All time</option></select><select value={historyProtocol} onChange={e=>setHistoryProtocol(e.target.value)}><option value="">All protocols</option>{protocolOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All status</option><option value="success">Success</option><option value="pending">Pending</option><option value="failed">Failed</option></select><button type="button" onClick={loadHistory}><RefreshCw/></button></div></div><div className="referenceHistoryTable"><div className="referenceHistoryRow referenceHistoryHeader"><span>#</span><span>Date & Time</span><span>Vehicle</span><span>Protocol</span><span>Command</span><span>Parameters</span><span>Response</span><span>Status</span></div>{shownHistory.length?shownHistory.map((row,i)=><div className="referenceHistoryRow" key={row.id||`${row.time}-${i}`}><span>{i+1}</span><time>{new Date(row.time).toLocaleString()}</time><span><b>{vehicle?.name||'—'}</b><small>{vehicle?.imei||''}</small></span><span>{vehicle?.protocol||'—'}</span><span>{row.commandName||'GPRS command'}</span><span>{row.kind==='reply'?'—':String(row.content||'—')}</span><span>{row.kind==='reply'?String(row.content||'Device reply'):'—'}</span><span className={row.kind==='reply'?'historySuccess':'historyPending'}>{row.kind==='reply'?'Success':row.status||'Pending'}</span></div>):<div className="referenceHistoryEmpty">No command requests or device replies yet.</div>}</div></section></section>}function VehicleLiveDetails({v,onHistory,onSensors,onCommands,onMap}){const p=v?.position,a=p?.attributes||{},ign=ignitionState(p),battery=attr(p,'batteryLevel','battery'),fuel=attr(p,'fuel'),gsm=attr(p,'rssi','gsm','signal'),gps=p?((p.valid===false)?'Invalid':'Fixed'):'Not available';return <div className="vehicleDrawer"><div className="vehHead"><span className="bigCat"><VehicleImage v={v}/></span><div><h2>{v.name}</h2><p>{v.make} {v.model} • {v.category||'Vehicle'}</p></div><Pill type={v.state==='offline'?'bad':'ok'}>{stateLabel(v.state)}</Pill></div><div className="detailTabs"><button className="active">Live</button><button onClick={onHistory}>Playback</button><button onClick={onSensors}>Sensors</button><button onClick={onCommands}>Commands</button></div><div className="teleGrid"><div><Gauge/><span><small>Speed</small><b>{v.speed} km/h</b></span></div><div><Power/><span><small>Ignition</small><b>{boolText(ign)}</b></span></div><div><span><small>Engine</small><EngineIndicator value={engineState(p)} source={p?.telemetry?.engineSource}/><StopDuration position={p}/></span></div><div><Signal/><span><small>GPS Signal</small><b>{gps}</b></span></div><div><BatteryCharging/><span><small>Vehicle Battery</small><b>{battery??'Not available'}</b></span></div><div><Zap/><span><small>GSM</small><b>{gsm??'Not available'}</b></span></div></div><div className="infoList"><p><UserRound/><span>Driver</span><b>{v.driverName&&v.driverName!=='Not identified'?v.driverName:'—'}</b></p><p><Clock3/><span>Last Communication</span><b>{communicationAgeLabel(v)}</b></p><p><MapPin/><span>Location</span><b><Address position={p}/></b></p><p><Fuel/><span>Fuel</span><b>{fuel??'Not available'}</b></p></div><div className="drawerActions"><button className="primary" onClick={onMap}><Navigation/>Follow</button><button onClick={onHistory}><History/>Playback</button><button onClick={onCommands}><Send/>Command</button></div></div>}

const CUSTOM_COMMAND_KEY='__custom_command__';
function commandDraftError(value,{custom=false,protocol='other'}={}){
  if(!String(value||'').trim())return 'Enter a command first.';
  if(String(value).length>400)return 'Command is limited to 400 characters.';
  if(/[\u0000-\u001f\u007f-\u009f]/.test(String(value)))return 'Commands must be one line and cannot contain control characters.';
  if(custom&&protocol==='gt06'&&!String(value).endsWith('#'))return 'GT06 / H9 custom commands must end with #.';
  return '';
}
function commandHistoryStatus(row){
  const status=String(row?.status||'').toLowerCase();
  if(row?.kind==='reply'||status==='reply_received'||status==='received')return 'Reply received';
  if(status==='failed')return 'Failed';
  if(status==='queued')return 'Queued';
  if(status==='submitting')return 'Submitting';
  return 'Submitted';
}
function DeviceGprsCommandControl({vehicle,company,toast}){
  const[command,setCommand]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const allowed=company?.permissions?.Commands!==false;
  const family=/gt06|h9|gx06/i.test([vehicle?.protocol,vehicle?.deviceModel,vehicle?.model].filter(Boolean).join(' '))?'gt06':'other';
  const validation=commandDraftError(command,{custom:true,protocol:family});
  async function send(){
    if(validation)return setMessage(validation);
    setBusy(true);setMessage('');
    try{const r=await api.sendCommand(vehicle.id,{command,mode:'custom',label:'Custom Command',protocol:family});setMessage(r.message||'Custom Command queued for device delivery.');setCommand('');toast?.(r.message||'Custom Command queued.')}catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  return <section className="gprsCommandControl"><div className="gprsCommandHead"><div><h3><Send/>Custom Command</h3><p>Send the exact raw payload through this device connection.</p></div><span>{vehicle.protocol||'GT06'}</span></div><textarea value={command} onChange={e=>setCommand(e.target.value)} placeholder={family==='gt06'?'Example: TIMER,30,300#':'Enter the exact manufacturer command'} rows="3" maxLength="400" disabled={busy||!allowed}/><div className="commandReview"><dl><div><dt>Vehicle</dt><dd>{vehicle.name}</dd></div><div><dt>IMEI</dt><dd>{vehicle.imei||'—'}</dd></div><div><dt>Protocol</dt><dd>{vehicle.protocol||'GT06'}</dd></div><div className="commandReviewPayload"><dt>Exact payload</dt><dd><code>{command||'—'}</code></dd></div></dl></div>{command&&validation&&<p className="commandValidationMessage">{validation}</p>}<div className="gprsCommandActions"><small>{allowed?'One line, maximum 400 characters. Sent exactly as typed.':'Commands permission is disabled for this account.'}</small><button className="primary" disabled={busy||!allowed||Boolean(validation)} onClick={send}>{busy?'Sending…':'Send Custom Command'}</button></div>{message&&<p className="gprsCommandMessage" role="status">{message}</p>}</section>;
}
GprsCommandControl=DeviceGprsCommandControl;
function DeviceCommandsPage({vehicles,company,toast,userRole}){
  const availableVehicles=vehicles.filter(v=>!v.expired&&v.liveAccess!==false);
  const protocolOptions=[
    {value:'gt06',label:'GT06 / H9 / GX06',icon:Radio,commands:[['Get Position (Single)','STATUS#'],['Start Live Tracking','TRACK,1#'],['Stop Live Tracking','TRACK,0#'],['Engine On (Immobilizer)','RELAY,1#'],['Engine Off (Immobilizer)','RELAY,0#'],['Enable SOS Alarm','SOS,1#']]},
    {value:'teltonika',label:'Teltonika (FMB/FMC)',icon:Radio,commands:commandTemplates.teltonika},
    {value:'vylion',label:'Vylion / Viyon',icon:Zap,commands:[]},
    {value:'concox',label:'Concox',icon:Radio,commands:[]},
    {value:'queclink',label:'Queclink',icon:Radio,commands:[]},
    {value:'other',label:'Other',icon:Settings,commands:[]}
  ];
  const protocolText=v=>[v?.protocol,v?.deviceModel,v?.deviceModelId,v?.model,v?.device?.name,v?.local?.protocol,v?.local?.deviceModel].filter(Boolean).join(' ').toLowerCase();
  const protocolFamily=v=>{const p=protocolText(v);return /teltonika|fmb|fmc/.test(p)?'teltonika':/gt06|h9|gx06/.test(p)?'gt06':/vylion|viyon/.test(p)?'vylion':/concox/.test(p)?'concox':/queclink/.test(p)?'queclink':'other'};
  const commandOnline=v=>String(v?.device?.status||'').toLowerCase()==='online';
  const[protocol,setProtocol]=useState(()=>protocolFamily(availableVehicles[0])||'gt06');
  const[vehicleId,setVehicleId]=useState(availableVehicles[0]?.id||'');
  const[commandKey,setCommandKey]=useState('');
  const[params,setParams]=useState('');
  const[customDrafts,setCustomDrafts]=useState({});
  const[history,setHistory]=useState([]);
  const[dateRange,setDateRange]=useState('');
  const[historyProtocol,setHistoryProtocol]=useState('');
  const[statusFilter,setStatusFilter]=useState('');
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState('');
  const[allowed,setAllowed]=useState(userRole!=='company_user');
  const profile=protocolOptions.find(x=>x.value===protocol)||protocolOptions[0];
  const protocolVehicles=availableVehicles.filter(v=>protocolFamily(v)===protocol);
  const vehicle=protocolVehicles.find(v=>String(v.id)===String(vehicleId))||protocolVehicles[0]||availableVehicles.find(v=>String(v.id)===String(vehicleId))||availableVehicles[0];
  const isCustom=commandKey===CUSTOM_COMMAND_KEY||!profile.commands.length;
  const selectedCommand=isCustom?null:profile.commands.find(([label])=>label===commandKey)||profile.commands[0];
  const customDraft=vehicle?String(customDrafts[String(vehicle.id)]||''):'';
  const presetValue=selectedCommand?.[1]||'';
  const payload=isCustom?customDraft:presetValue.includes('{params}')?presetValue.replace('{params}',params.trim()):params.trim()?`${presetValue} ${params.trim()}`:presetValue;
  const payloadError=commandDraftError(payload,{custom:isCustom,protocol:protocolFamily(vehicle)});
  const commandLabel=isCustom?'Custom Command':selectedCommand?.[0]||'';
  useEffect(()=>{let active=true;if(userRole!=='company_user'){setAllowed(true);return()=>{active=false}}api.me().then(user=>{if(active)setAllowed(user?.metadata?.permissions?.Commands===true)}).catch(()=>{if(active)setAllowed(false)});return()=>{active=false}},[userRole]);
  useEffect(()=>{if(vehicle&&!protocolVehicles.some(v=>String(v.id)===String(vehicleId)))setVehicleId(vehicle.id)},[protocol,vehicle?.id]);
  useEffect(()=>{setCommandKey(profile.commands[0]?.[0]||CUSTOM_COMMAND_KEY);setParams('');setMessage('')},[protocol]);
  useEffect(()=>{setParams('');setMessage('')},[vehicle?.id]);
  const loadHistory=()=>vehicle?api.commandHistory(vehicle.id).then(x=>setHistory(Array.isArray(x)?x:[])).catch(()=>setHistory([])):Promise.resolve();
  useEffect(()=>{loadHistory()},[vehicle?.id]);
  const chooseProtocol=value=>{setProtocol(value);setMessage('')};
  const setCustomDraft=value=>{if(!vehicle)return;setCustomDrafts(drafts=>({...drafts,[String(vehicle.id)]:value}))};
  async function send(){
    if(!vehicle)return;
    if(!allowed)return setMessage('Commands permission is disabled for this account.');
    if(!commandOnline(vehicle))return setMessage('Tracker is offline. GPRS commands are available after it reconnects.');
    if(payloadError)return setMessage(payloadError);
    setBusy(true);setMessage('');
    try{
      const r=await api.sendCommand(vehicle.id,{command:payload,mode:isCustom?'custom':'preset',label:commandLabel,protocol:protocolFamily(vehicle)});
      setMessage(r.message||commandLabel+' queued for device delivery.');
      toast?.(r.message||commandLabel+' queued.');
      if(isCustom)setCustomDrafts(drafts=>{const next={...drafts};delete next[String(vehicle.id)];return next});else setParams('');
      await loadHistory();
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  const shownHistory=history.filter(row=>{
    const status=commandHistoryStatus(row).toLowerCase().replace(' ','_');
    return(!statusFilter||status===statusFilter)&&(!historyProtocol||String(row.protocol||vehicle?.protocol||'').toLowerCase().includes(historyProtocol.toLowerCase()))&&(!dateRange||dateRange==='all'||dateRange==='today'&&new Date(row.time).toDateString()===new Date().toDateString());
  });
  const ready=!busy&&allowed&&vehicle&&commandOnline(vehicle)&&!payloadError;
  return <section className="page commandsPage referenceCommandsPage">
    <PageHead title="Device Commands" subtitle="Use a verified preset or send one exact custom payload to a selected tracker." actions={<button className="commandHelp"><Info/>Help</button>}/>
    <div className="commandsReferenceCard"><div className="commandsReferenceGrid">
      <div className="commandStep"><h3><span>1.</span> Select Protocol</h3><select value={protocol} onChange={e=>chooseProtocol(e.target.value)}>{protocolOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select><div className="commandProtocolList">{protocolOptions.map(x=><button type="button" key={x.value} className={protocol===x.value?'active':''} onClick={()=>chooseProtocol(x.value)}><x.icon/>{x.label}</button>)}</div></div>
      <div className="commandStep"><h3><span>2.</span> Select Vehicle</h3><select value={vehicle?.id||''} onChange={e=>setVehicleId(e.target.value)} disabled={!protocolVehicles.length}><option value="">Search vehicle or IMEI...</option>{protocolVehicles.map(v=><option key={v.id} value={v.id}>{v.name} · {v.imei||'No IMEI'}</option>)}</select><div className="commandVehicleList">{protocolVehicles.map(v=><button type="button" key={v.id} className={String(vehicle?.id)===String(v.id)?'active':''} onClick={()=>setVehicleId(v.id)}><Car/><span><b><span className="mapVehicleName">{v.name}</span><em className="mapVehicleBadge">{status.group==='moving'?'Running':stateLabel(status.group)}</em></b><small>{v.imei||'No IMEI'}</small></span><em className={commandOnline(v)?'':'offline'}>{commandOnline(v)?'Online':'Offline'}</em></button>)}</div>{!protocolVehicles.length&&<p className="commandNoItems">No vehicles use this protocol.</p>}</div>
      <div className="commandStep"><h3><span>3.</span> Select Command</h3><select value={isCustom?CUSTOM_COMMAND_KEY:selectedCommand?.[0]||''} onChange={e=>setCommandKey(e.target.value)}><option value="">Choose a command</option>{profile.commands.map(([label])=><option key={label} value={label}>{label}</option>)}<option value={CUSTOM_COMMAND_KEY}>Custom Command</option></select><div className="commandCommandList">{profile.commands.map(([label,value])=><button type="button" key={label} className={!isCustom&&selectedCommand?.[0]===label?'active':''} onClick={()=>setCommandKey(label)}><Send/>{label}<small>{value}</small></button>)}<button type="button" className={isCustom?'active customCommandChoice':'customCommandChoice'} onClick={()=>setCommandKey(CUSTOM_COMMAND_KEY)}><Send/>Custom Command<small>Exact raw payload</small></button></div>{!profile.commands.length&&<p className="commandNoItems">This protocol has no default presets. Enter a Custom Command.</p>}</div>
      <div className="commandStep commandParameters"><h3><span>4.</span> {isCustom?'Custom Command':'Parameters (if required)'}</h3><textarea value={isCustom?customDraft:params} onChange={e=>isCustom?setCustomDraft(e.target.value):setParams(e.target.value)} placeholder={isCustom?(protocolFamily(vehicle)==='gt06'?'Example: TIMER,30,300#':'Enter the exact manufacturer command'):(selectedCommand?.[1]||'Enter parameters if required')} rows="8" maxLength="400" disabled={busy||!allowed}/><small className="commandInputHelp">{isCustom?'Sent exactly as typed. One line, maximum 400 characters.' :'The selected preset stays unchanged; optional parameters are appended.'}</small>{payload&&payloadError&&<p className="commandValidationMessage">{payloadError}</p>}<div className="commandReview"><h4>Review before sending</h4><dl><div><dt>Vehicle</dt><dd>{vehicle?.name||'—'}</dd></div><div><dt>IMEI</dt><dd>{vehicle?.imei||'—'}</dd></div><div><dt>Protocol</dt><dd>{vehicle?.protocol||profile.label}</dd></div><div className="commandReviewPayload"><dt>Exact payload</dt><dd><code>{payload||'—'}</code></dd></div></dl></div><button className="primary commandSendButton" disabled={!ready} onClick={send}><Send/>{busy?'Sending…':isCustom?'Send Custom Command':'Send Preset Command'}</button>{!allowed&&<p className="commandValidationMessage">Commands permission is disabled for this account.</p>}{message&&<p className="gprsCommandMessage" role="status">{message}</p>}</div>
    </div></div>
    <section className="commandHistory referenceCommandHistory"><div className="referenceHistoryHeading"><div><h2><ClipboardList/>Command History</h2><small>Queued and submitted requests are separate from replies received from the tracker.</small></div><div className="referenceHistoryFilters"><select value={dateRange} onChange={e=>setDateRange(e.target.value)}><option value="">Select date range</option><option value="today">Today</option><option value="all">All time</option></select><select value={historyProtocol} onChange={e=>setHistoryProtocol(e.target.value)}><option value="">All protocols</option>{protocolOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All status</option><option value="queued">Queued</option><option value="submitted">Submitted</option><option value="reply_received">Reply received</option><option value="failed">Failed</option></select><button type="button" onClick={loadHistory}><RefreshCw/></button></div></div><div className="referenceHistoryTable"><div className="referenceHistoryRow referenceHistoryHeader"><span>#</span><span>Date & Time</span><span>Vehicle</span><span>Protocol</span><span>Command</span><span>Parameters</span><span>Response</span><span>Status</span></div>{shownHistory.length?shownHistory.map((row,i)=>{const status=commandHistoryStatus(row);return <div className="referenceHistoryRow" key={row.id||`${row.time}-${i}`}><span>{i+1}</span><time>{new Date(row.time).toLocaleString()}</time><span><b>{vehicle?.name||'—'}</b><small>{vehicle?.imei||''}</small></span><span>{row.protocol||vehicle?.protocol||'—'}</span><span>{row.commandName||'GPRS command'}</span><span>{row.kind==='reply'?'—':String(row.content||'—')}</span><span>{row.kind==='reply'?String(row.content||'Device reply'):'—'}</span><span className={status==='Failed'?'historyFailed':status==='Reply received'?'historyReply':'historyPending'}>{status}</span></div>}):<div className="referenceHistoryEmpty">No command requests or device replies yet.</div>}</div></section>
  </section>;
}
CommandsPage=DeviceCommandsPage;

function formatLiveDistance(value){
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)return'Not available';
  const km=n>100000? n/1000 : n;
  return `${km.toFixed(2)} km`;
}

function liveSensorValue(value,yes='On',no='Off'){
  if(value===true)return yes;
  if(value===false)return no;
  return value==null?'Not available':String(value);
}

function liveSensorFlag(value){
  if(value===true||value===1)return true;
  const text=String(value??'').trim().toLowerCase();
  return ['1','true','on','yes','active','worn','fastened','connected'].includes(text);
}

function liveSensorLabel(key){
  return String(key||'Sensor').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,letter=>letter.toUpperCase());
}

function liveSensorDisplay(value,unit=''){
  if(value===true)return'On';
  if(value===false)return'Off';
  if(value==null||value===''||value===-1||value==='-1')return'—';
  if(typeof value==='object'){try{return JSON.stringify(value)}catch{return String(value)}}
  return `${String(value)}${unit?' '+unit:''}`;
}

function liveSensorRows(vehicle,store){
  const p=vehicle?.position||{},rows=[],seen=new Set();
  const add=(key,label,value,unit='')=>{const id=String(key||label).toLowerCase();if(seen.has(id))return;seen.add(id);rows.push({key:id,label,value:liveSensorDisplay(value,unit)});};
  const configured=(store?.sensorConfigs||[]).filter(sensor=>String(sensor.vehicleId)===String(vehicle?.id)&&sensor.enabled!==false&&!/engine\s*\(\s*voltage\s*\)/i.test(sensor.name||'')),normalized=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,''),configuredSignals=new Set(configured.flatMap(sensor=>[sensor.sourceKey,sensor.parameterName,sensor.name]).map(normalized).filter(Boolean));
  const sameSignal=(a,b)=>a===b||(a.length>=5&&b.length>=5&&(a.includes(b)||b.includes(a)));
  for(const sensor of configured)add('sensor:'+String(sensor.id||sensor.name),sensor.name||sensor.sourceKey||'Sensor',sensorReading({...p,current_driver:p.current_driver||vehicle.currentDriver||vehicle.current_driver},sensor));
  for(const mapping of p.mapped_io||vehicle?.mapped_io||[]){const signals=[mapping.function,mapping.name,mapping.sourceKey].map(normalized).filter(Boolean);const aliases=signals.flatMap(x=>x==='seatbelt'?['seatbelt','seatbeltsensor']:x==='driverid'||x==='driveridentifier'?['driverid','driveridentifier','driveruniqueid','rfidibutton']:[]);if(!signals.concat(aliases).some(x=>[...configuredSignals].some(y=>sameSignal(x,y))))add('mapped:'+mapping.channel,mapping.name||mapping.channel,mapping.value,mapping.unit||'');}
  return rows;
}

function useSensorUpdatePulse(vehicleId,rows){
  const [active,setActive]=useState(false),previous=useRef({vehicleId:'',signature:''});
  const id=String(vehicleId??''),signature=JSON.stringify(rows.map(row=>[row.key,row.value]));
  useEffect(()=>{
    const before=previous.current;
    previous.current={vehicleId:id,signature};
    if(!id||before.vehicleId!==id||!before.signature||before.signature===signature){setActive(false);return;}
    setActive(true);
    const timer=setTimeout(()=>setActive(false),900);
    return()=>clearTimeout(timer);
  },[id,signature]);
  return active;
}

function LiveVehiclePanel({vehicle,company,store,mapAccess}){
  const [collapsed,setCollapsed]=useState(false);
  const p=vehicle?.position;
  const ignition=ignitionState(p),engine=engineState(p);
  const sensorRows=liveSensorRows(vehicle,store);
  const sensorUpdate=useSensorUpdatePulse(vehicle?.id,sensorRows);
  if(!vehicle)return null;
  const status=mapStatus(vehicle,company?.settings||{}),displayState=status.group||status.operating||vehicle.state||'offline';
  const lat=Number(p?.latitude),lng=Number(p?.longitude),hasLocation=Number.isFinite(lat)&&Number.isFinite(lng),mapillaryUrl=hasLocation?`https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=17`:'';
  return <aside className={`liveVehiclePanel ${collapsed?'isCollapsed':''}`} aria-label={`Live details for ${vehicle.name}`}>
      <div className="liveVehiclePanelHeader">
      <div className="liveVehiclePanelTitle"><strong>{vehicle.name||'Vehicle'}</strong><span className={`liveVehiclePanelStatus status-${displayState}`}><i/>{stateLabel(displayState)}</span><LiveSensorIcons position={p} ignition={ignition} engine={engine}/></div>
      <div className="liveVehiclePanelActions"><button type="button" className="liveVehiclePanelToggle" aria-label={collapsed?'Show vehicle details':'Hide vehicle details'} aria-expanded={!collapsed} onClick={()=>setCollapsed(x=>!x)}>{collapsed?<ChevronDown/>:<ChevronUp/>}</button></div>
    </div>
    {!collapsed&&<div className="liveVehiclePanelGrid">
      <section className="livePanelCard livePanelVehicleCard"><h3>{vehicle.name||'Vehicle'}</h3><div className="livePanelVehicleImage"><VehicleImage v={vehicle}/></div><strong className={`livePanelVehicleState status-${displayState}`}><i/>{stateLabel(displayState)}</strong><div className="livePanelTags"><span>{vehicle.category||'Vehicle'}</span><span>{vehicle.plate||'No plate'}</span></div></section>
      <section className="livePanelCard"><h3><Navigation/>Vehicle details</h3><dl><div className="livePanelAddressRow"><dt>Address</dt><dd><Address position={p}/></dd></div><div><dt>Last communication</dt><dd>{latestCommunicationTime(vehicle)?fmtDateTime(latestCommunicationTime(vehicle)):'No data'}</dd></div><div><dt>Position time</dt><dd>{p?fmtDateTime(p.serverTime||p.deviceTime||p.fixTime):'No data'}</dd></div><div><dt>Stop duration</dt><dd><StopDuration position={p} showLabel={false}/></dd></div><div><dt>Driver</dt><dd>{vehicle.driverName&&vehicle.driverName!=='Not identified'?vehicle.driverName:'—'}</dd></div></dl></section>
      <section className={`livePanelCard livePanelSensors ${sensorUpdate?'hasSensorUpdate':''}`}><h3><Radio/>Sensors <span className="liveSensorCount">{sensorRows.length}</span></h3><div className="livePanelSensorScroll">{sensorRows.length?<dl>{sensorRows.map(row=><div key={row.key}><dt>{row.label}</dt><dd title={row.value}>{row.value}</dd></div>)}</dl>:<p className="liveSensorEmpty">No sensors assigned to this vehicle.</p>}</div></section>
      <section className="livePanelCard livePanelStreet"><h3><MapIcon/>Street imagery</h3><div className="liveStreetPreview"><MapPin/></div>{mapillaryUrl&&mapAccess?.mapillary!==false?<div className="liveStreetLinks"><a href={mapillaryUrl} target="_blank" rel="noreferrer">Mapillary <span aria-hidden="true">↗</span></a></div>:<span className="liveStreetUnavailable">Location unavailable</span>}</section>
    </div>}
  </aside>
}
function MapPage({vehicles,selected,setSelected,setPage,alerts,store,setStore,company,toast}){
 const mapRef=useRef(null);
 const mapConfig=useMapConfig(),availableMaps=mapConfig?.maps||[];
 const [mapTab,setMapTab]=useState('Vehicles');const [trail,setTrail]=useState(false),[trailMinutes,setTrailMinutes]=useState(()=>Math.max(1,Math.min(1440,Number(localStorage.getItem('inviha.trailMinutes'))||30))),[locationRequest,setLocationRequest]=useState(0),[trailStatus,setTrailStatus]=useState(''),[moreTools,setMoreTools]=useState(false),[labels,setLabels]=useState(false),[fitRequest,setFitRequest]=useState(0);
  const [follow,setFollow]=useState(false);const markerRefs=useRef({});useEffect(()=>{if(selected?.id!=null&&layers.vehicles)markerRefs.current[String(selected.id)]?.openPopup()},[selected?.id]);
  const [mapStyle,setMapStyle]=useState('');
  useEffect(()=>{if(!availableMaps.length)return;setMapStyle(current=>availableMaps.some(map=>map.id===current)?current:(mapConfig.defaultBase||availableMaps[0].id))},[mapConfig]);
  const [layerMenu,setLayerMenu]=useState(false);
  const [commandVehicle,setCommandVehicle]=useState(null);
  const openHistory=(v,range)=>{localStorage.setItem('inviha.playbackPreset',JSON.stringify({vehicleId:String(v.id),deviceId:String(v.deviceId||''),range}));setSelected(v);setPage('playback')};

  const [layers,setLayers]=useState({
    vehicles:true,
    poi:company.settings?.showPoiParking!==false,
    parking:company.settings?.showPoiParking!==false,
    geofences:company.settings?.showGeofences!==false
  });

  const points=vehicles
    .filter(v=>Number.isFinite(v.position?.latitude)&&Number.isFinite(v.position?.longitude))
    .map(v=>[v.position.latitude,v.position.longitude]);
  const activePoints=vehicles
    .filter(v=>Number.isFinite(v.position?.latitude)&&Number.isFinite(v.position?.longitude)&&!['offline','untracked','never'].includes(mapStatus(v,company.settings).group))
    .map(v=>[v.position.latitude,v.position.longitude]);
  const initialFocusPoints=activePoints.length?activePoints:points;
  const configuredCenter=[Number(mapConfig?.center?.latitude)||25.2854,Number(mapConfig?.center?.longitude)||51.531];
  const configuredZoom=Math.max(2,Math.min(20,Number(mapConfig?.zoom)||11));
  const openMapillary=()=>{
    const center=mapRef.current?.getCenter?.();
    const lat=Number(selected?.position?.latitude??center?.lat),lng=Number(selected?.position?.longitude??center?.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)){toast('Select a vehicle with a valid location first.');return}
    window.open(`https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=17`,'_blank','noopener,noreferrer');
  };

  const geofences=(store.localGeofences||[])
    .filter(g=>String(g.companyId)===String(company.id)&&g.active!==false);

  const pois=(store.pois||[])
    .filter(g=>String(g.companyId)===String(company.id)&&g.active!==false&&g.lat!=null&&g.lng!=null);

  const parking=(store.parkingSlots||[])
    .filter(g=>String(g.companyId)===String(company.id)&&g.active!==false&&g.lat!=null&&g.lng!=null);

  return <section className={"page mapPage lockedMapPage "+(!labels?'hideVehicleLabels':'')}>

    <div className="lockedMapShell">

      <div className="lockedMapPanel">
        <VehicleStatusList
          vehicles={vehicles}
          settings={company.settings}
          tab={mapTab} onTab={tab=>tab==='Playback'?setPage('playback'):setMapTab(tab)}
          selected={selected}
          setSelected={v=>{
            if(v.expired||v.liveAccess===false){toast(v.accessMessage||'Vehicle subscription expired. Please renew to continue live tracking.');return}
            setSelected(v);
            setFollow(false);
          }}
          onGeofences={()=>setPage('geofences')}
          onVehicles={()=>setPage('vehicles')}
          onDetails={v=>{setSelected(v);setFollow(false)}}
          onEdit={v=>{localStorage.setItem('inviha.vehicleAction',JSON.stringify({vehicleId:String(v.id),action:'edit'}));setSelected(v);setPage('vehicles')}}
          onHistory={openHistory}
          onCommand={v=>setCommandVehicle(v)}
          toast={toast}
        />
      </div>

      {mapTab!=='Vehicles'&&<div className="mapTabWorkspace"><button className="mapTabBack" onClick={()=>setMapTab('Vehicles')}>Back to live vehicles</button>{mapTab==='Playback'?<Playback vehicles={vehicles} selected={selected} store={store} company={company}/>:mapTab==='Alerts'?<AlertsPage company={company} vehicles={vehicles} store={store} setStore={setStore} setPage={setPage} toast={toast}/>:<MapRecordedEvents vehicles={vehicles} selected={selected}/>}</div>}
      <div className="bigMap lockedBigMap">

        <MapContainer ref={mapRef} zoomControl={false} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} center={configuredCenter} zoom={configuredZoom} minZoom={2}>

          <Basemap base={mapStyle}/>
          <MapDefaultView center={configuredCenter} zoom={configuredZoom} enabled={!selected?.position&&!initialFocusPoints.length}/>

          {layers.geofences&&geofences.map(g=>
            g.type==='polygon'&&g.points?.length>2
              ? <Polygon key={'geo'+g.id} positions={g.points}/>
              : Number.isFinite(Number(g.lat))&&Number.isFinite(Number(g.lng))
                ? <Circle
                    key={'geo'+g.id}
                    center={[Number(g.lat),Number(g.lng)]}
                    radius={Number(g.radius)||500}
                  />
                : null
          )}

          {layers.poi&&pois.map(g=>
            <Marker
              key={'poi'+g.id}
              position={[Number(g.lat),Number(g.lng)]}
              icon={poiMarkerIcon(g.icon,g.name)}
            >
              <Popup>
                <div className="poiPopup">
                  <b>{g.name}</b>
                  <small>POI</small>
                  {g.description&&<p>{g.description}</p>}
                </div>
              </Popup>
            </Marker>
          )}

          {layers.parking&&parking.map(g=>
            <Marker
              key={'parking'+g.id}
              position={[Number(g.lat),Number(g.lng)]}
              icon={poiMarkerIcon(g.icon||'🅿️',g.name)}
            >
              <Popup>
                <div className="poiPopup">
                  <b>{g.name}</b>
                  <small>Parking Slot</small>
                  {g.capacity&&<p>Capacity: {g.capacity}</p>}
                </div>
              </Popup>
            </Marker>
          )}

          <MyLocation request={locationRequest} onError={toast}/><LiveTrail vehicle={selected} speedLimit={trailLimit(selected,store.alertRules,company.id,company.settings)} enabled={trail} minutes={trailMinutes} onStatus={setTrailStatus}/><FitFleetRequest points={points} request={fitRequest}/>
          <MapFocus
            pos={selected?.position}
            follow={follow}
            points={initialFocusPoints}
          />

          {layers.vehicles&&vehicles
            .filter(v=>Number.isFinite(v.position?.latitude)&&Number.isFinite(v.position?.longitude))
            .map(v=>{

              const p=v.position;
              const presentation=mapStatus(v,company.settings),ignition=presentation.ignition;const markerState=['untracked','offline','never'].includes(presentation.group)?presentation.group:presentation.operating;const popupStatus=presentation.group==='offline'?'Offline':presentation.group==='untracked'?'Currently Untracked':stateLabel(presentation.operating);
              const driver=v.driverName&&v.driverName!=='Not identified'?v.driverName:'—';

              return <SmoothMarker
                fixTime={p.fixTime||p.deviceTime||p.serverTime}
                key={v.id}
                ref={marker=>{markerRefs.current[String(v.id)]=marker}}
                position={[p.latitude,p.longitude]}
                icon={markerIcon(
                  v.category,
                  markerState,
                  labels?v.name:'',
                  v.speed,
                  imageOf(v),
                  presentation.fresh,
                  vehicleHeading(v)
                )}
                eventHandlers={{
                  click:()=>{
                    setSelected(v);
                    setFollow(false);
                  }
                }}
              >

                <Popup className="vehicleMapLeafletPopup vehicleNameOnlyPopup" minWidth={40} maxWidth={260} closeButton={false} autoPan={false}>
                  <div className="vehicleMarkerNamePopup"><strong>{v.name}</strong><span>({Math.round(Number(v.speed)||0)} km/h)</span></div>
                </Popup>

              </SmoothMarker>
            })
          }

        </MapContainer>

        <LiveSpeed vehicle={selected} rules={store.alertRules} companyId={company.id} companySettings={company.settings}/>
        <LiveVehiclePanel vehicle={selected} company={company} store={store} mapAccess={mapConfig?.allowed}/>
        <div className="lockedMapControls">
<button title="Zoom in" aria-label="Zoom in" onClick={()=>mapRef.current?.zoomIn()}>+</button>
<button title="Zoom out" aria-label="Zoom out" onClick={()=>mapRef.current?.zoomOut()}>−</button>
<button title="Playback" onClick={()=>setPage('playback')}><History/></button>
<button title="Full screen" onClick={e=>e.currentTarget.closest('.lockedMapPage')?.requestFullscreen?.()}><Maximize/></button>
<button title="Map layers" onClick={()=>setLayerMenu(x=>!x)}><Layers3/></button>
<button title="My current location" aria-label="My current location" onClick={()=>{setFollow(false);setLocationRequest(x=>x+1)}}><LocateFixed/></button>
<button title="Locate vehicle" onClick={()=>{if(selected?.position)setFollow(true);else toast('Select a vehicle first')}}><Navigation/></button>
<button title="Live route trail" className={trail?'active':''} onClick={()=>setTrail(x=>!x)}><Route/></button>
<button title="Map options" onClick={()=>setMoreTools(x=>!x)}><MoreHorizontal/></button></div>
{(availableMaps.length>0||mapConfig?.allowed?.mapillary)&&<div className="mapType"><label><span>Map</span><select aria-label="Select map" value={mapStyle} onChange={e=>setMapStyle(e.target.value)}>{availableMaps.map(map=><option key={map.id} value={map.id}>{map.label}</option>)}</select></label>{mapConfig?.allowed?.mapillary&&<button className="mapillaryStreetButton" title="Open Mapillary street imagery at the selected vehicle" onClick={openMapillary}>Mapillary ↗</button>}</div>}
{moreTools&&<div className="mapMoreOptions"><h3>Map options</h3><button onClick={()=>{setFitRequest(x=>x+1);setFollow(false)}}><Maximize/>Fit all vehicles</button><button disabled={!selected?.position} onClick={()=>setFollow(x=>!x)}><Navigation/>{follow?'Stop following':'Follow selected vehicle'}</button><label><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/>Vehicle labels</label><label><input type="checkbox" checked={trail} onChange={e=>setTrail(e.target.checked)}/>Live route trail</label><label><span>Trail duration</span><select aria-label="Trail duration preset" value={[5,15,30,60,180,360,720,1440].includes(trailMinutes)?trailMinutes:'custom'} onChange={e=>{if(e.target.value==='custom')return;setTrailMinutes(Number(e.target.value));localStorage.setItem('inviha.trailMinutes',e.target.value)}}><option value="custom">Custom</option>{[5,15,30,60,180,360,720,1440].map(n=><option key={n} value={n}>{n} minutes</option>)}</select><input aria-label="Custom trail duration in minutes" type="number" min="1" max="1440" value={trailMinutes} onChange={e=>{const n=Math.max(1,Math.min(1440,Number(e.target.value)||1));setTrailMinutes(n);localStorage.setItem('inviha.trailMinutes',String(n))}}/></label><button disabled={!selected?.position} onClick={async()=>{try{const p=selected.position;await navigator.clipboard.writeText(p.latitude+', '+p.longitude);toast('Vehicle coordinates copied')}catch{toast('Unable to copy coordinates')}}}><MapPin/>Copy vehicle coordinates</button></div>}
{trail&&<div className="liveTrailCaption" role="status">{trailStatus||((selected?.name||'Vehicle')+' · Last '+trailMinutes+' minutes · Recorded GPS trail')}</div>}
        {layerMenu&&
          <div className="lockedLayerMenu"><button className="layerManage" onClick={()=>setPage('geofences')}>Manage geofences / POI</button>

            <label>
              <input
                type="checkbox"
                checked={layers.vehicles}
                onChange={e=>setLayers(x=>({...x,vehicles:e.target.checked}))}
              />
              Vehicles
            </label>

            <label>
              <input
                type="checkbox"
                checked={layers.poi}
                onChange={e=>setLayers(x=>({...x,poi:e.target.checked}))}
              />
              POI
            </label>

            <label>
              <input
                type="checkbox"
                checked={layers.geofences}
                onChange={e=>setLayers(x=>({...x,geofences:e.target.checked}))}
              />
              Geofences
            </label>

            <label>
              <input
                type="checkbox"
                checked={layers.parking}
                onChange={e=>setLayers(x=>({...x,parking:e.target.checked}))}
              />
              Parking Slots
            </label>

          </div>
        }

      </div>

      {commandVehicle&&<Modal title={'Send Command · '+commandVehicle.name} onClose={()=>setCommandVehicle(null)}><div className="mapCommandDialog"><p>Commands use the configured vehicle output and the live safety checks. The server sends a command only after the vehicle passes those checks.</p><ImmobilizerControl vehicle={commandVehicle} company={company} toast={toast}/><GprsCommandControl vehicle={commandVehicle} company={company} toast={toast}/>{!company.vehiclePermissions?.immobilizer&&<p className="mapCommandUnavailable">Command permission is not enabled for this company.</p>}<div className="modalActions"><button onClick={()=>setCommandVehicle(null)}>Close</button><button onClick={()=>{setCommandVehicle(null);setSelected(commandVehicle);setPage('vehicles')}}><Car/>Open Vehicle</button></div></div></Modal>}

    </div>

  </section>
}

function VehicleForm({initial={},company,store,setStore,onClose,toast,allDevices=[]}){const[d,setD]=useState({...initial,companyId:company.id,status:initial.status||'Active',category:initial.category||'Car'});const[tab,setTab]=useState('main');const canImei=company.vehiclePermissions?.changeImei;const f=(k,v)=>setD(x=>({...x,[k]:v}));async function save(e){e.preventDefault();if(!d.name?.trim()||!d.plate?.trim()){setTab('main');toast('Vehicle name and plate number are required.');return}let n=d.id?updateRow(store,'vehicles',d.id,d):addRow(store,'vehicles',d);n=addAudit(n,{action:d.id?'UPDATE':'CREATE',module:'Vehicles',companyId:company.id,detail:`Vehicle ${d.name} saved.`});if(!await setStore(n))return;toast('Vehicle saved');onClose()}return <form onSubmit={save} className="fleetVehicleForm"><nav className="fleetFormTabs">{[["main","Main"],["icons","Icon & Logo"],["relay","Relay"]].map(([key,name])=><button type="button" key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{name}</button>)}</nav>{tab==="main"&&<div className="formGrid"><Field label="Vehicle Name *"><input required value={d.name||''} onChange={e=>f('name',e.target.value)}/></Field><Field label="Plate Number *"><input required value={d.plate||''} onChange={e=>f('plate',e.target.value)}/></Field><Field label="Make"><input value={d.make||''} onChange={e=>f('make',e.target.value)}/></Field><Field label="Model"><input value={d.model||''} onChange={e=>f('model',e.target.value)}/></Field><Field label="Category"><select value={d.category} onChange={e=>f('category',e.target.value)}>{['Car','Pickup','Truck','Van','Bus','Motorcycle','Trailer','Heavy Equipment','Refrigerated Truck','Tanker','Emergency'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Group"><input value={d.group||''} onChange={e=>f('group',e.target.value)}/></Field><Field label="GPS Device"><select value={d.deviceId||''} onChange={e=>f('deviceId',e.target.value)}><option value="">Unassigned</option>{allDevices.map(x=><option key={x.id} value={x.id}>{x.name} — {x.uniqueId}</option>)}</select></Field><Field label="IMEI / Device ID"><input value={d.imei||''} disabled={!canImei} onChange={e=>f('imei',e.target.value)} placeholder={canImei?'IMEI':'Managed by platform administrator'}/></Field><DeviceModelFields value={d} onChange={setD} request={profileRequest} disabled={!company.vehiclePermissions?.['Change Tracker Configuration']&&!company.vehiclePermissions?.changeTrackerConfiguration}/><Field label="Year"><input type="number" value={d.year||''} onChange={e=>f('year',e.target.value)}/></Field><Field label="Status"><select value={d.status} onChange={e=>f('status',e.target.value)}><option>Active</option><option>Inactive</option></select></Field><Field label="Notes" wide><textarea value={d.notes||''} onChange={e=>f('notes',e.target.value)}/></Field></div>}{tab==="icons"&&<VehicleAppearance value={d} onChange={setD}/>} {tab==="relay"&&<section className="fleetFormSection"><h3>Teltonika relay / immobilizer</h3><div className="note wide">Relay configuration is managed by the Super Admin. Ask the platform administrator to configure DOUT1–DOUT4; this account can send the command only after permission is granted.</div></section>}<div className="modalActions wide"><button type="button" onClick={onClose}>Cancel</button><button className="primary"><Save/>Save Vehicle</button></div></form>}

function VehiclesPage(props){return <VehiclesReference {...props} Image={VehicleImage} Form={VehicleForm} Modal={Modal}/>;}

function uploadData(file,cb){if(!file)return;const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(file)}
function DriverForm({initial={},company,vehicles,store,setStore,onClose,toast}){const[d,setD]=useState({...initial,companyId:company.id,status:initial.status||'Active'});const f=(k,v)=>setD(x=>({...x,[k]:v}));async function save(e){e.preventDefault();try{dutyDriving([],d)}catch(error){toast(error.message);return}let n=d.id?updateRow(store,'drivers',d.id,d):addRow(store,'drivers',d);n=addAudit(n,{action:d.id?'UPDATE':'CREATE',module:'Drivers',companyId:company.id,detail:`Driver ${d.name} saved.`});if(!await setStore(n))return;toast('Driver saved');onClose()}return <form onSubmit={save} className="driverForm"><div className="photoUpload">{d.photoData?<img src={d.photoData} alt="Driver"/>:<UserRound/>}<DriverPhotoCrop value={d.photoData||''} onChange={value=>f('photoData',value)} toast={toast}/><small>Square JPG created after cropping</small></div><FormSection title="Basic Information" icon={UserRound}><Field label="Driver Name *"><input required value={d.name||''} onChange={e=>f('name',e.target.value)} placeholder="Enter full name"/></Field><Field label="Driver ID"><input value={d.employeeId||''} onChange={e=>f('employeeId',e.target.value)} placeholder="DRV-001"/></Field><Field label="Mobile Number *"><input required value={d.mobile||''} onChange={e=>f('mobile',e.target.value)} placeholder="+974 ..."/></Field><Field label="Email"><input type="email" value={d.email||''} onChange={e=>f('email',e.target.value)}/></Field><Field label="License Number"><input value={d.license||''} onChange={e=>f('license',e.target.value)}/></Field><Field label="License Expiry Date"><input type="date" value={d.licenseExpiry||''} onChange={e=>f('licenseExpiry',e.target.value)}/></Field></FormSection><DriverIdentifiers value={d} onChange={rows=>f('identifiers',rows)}/><FormSection title="Work Details" icon={Car}><Field label="Planned Vehicle (optional)"><select value={d.assignedVehicleId||''} onChange={e=>f('assignedVehicleId',e.target.value)}><option value="">Not assigned</option>{vehicles.map(v=><option key={v.id} value={v.local?.id||v.id}>{v.name}</option>)}</select></Field><Field label="Department / Company"><input value={d.department||''} onChange={e=>f('department',e.target.value)}/></Field><Field label="Status"><select value={d.status} onChange={e=>f('status',e.target.value)}><option>Active</option><option>Inactive</option><option>Off Duty</option></select></Field><Field label="Address" wide><input value={d.address||''} onChange={e=>f('address',e.target.value)}/></Field></FormSection><DriverDutyFields value={d.duty} onChange={value=>f('duty',value)}/><Field label="Notes" wide><textarea value={d.notes||''} onChange={e=>f('notes',e.target.value)}/></Field><div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary"><Save/>Save Driver</button></div></form>}

function DriversPage({company,vehicles,store,setStore,setPage,toast}){const[editing,setEditing]=useState(null),[selected,setSelected]=useState(null),[q,setQ]=useState(''),[status,setStatus]=useState('all'),[driverTab,setDriverTab]=useState('profile');const rows=store.drivers.filter(d=>d.companyId===company.id&&(status==='all'||d.status===status)&&(!q||[d.name,d.employeeId,d.mobile,d.rfid,d.ibutton].join(' ').toLowerCase().includes(q.toLowerCase())));return <section className="page"><PageHead title="Drivers" subtitle="Manage your fleet drivers, assignments, ID details, and activity." actions={<button className="primary" onClick={()=>setEditing({})}><Plus/>Add Driver</button>}/><div className="splitPage"><div className="tableCard"><div className="filters"><div className="searchBox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search drivers..."/></div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Statuses</option><option>Active</option><option>Inactive</option><option>Off Duty</option></select></div><table><thead><tr><th>#</th><th>Driver</th><th>Driver ID</th><th>Assigned Vehicle</th><th>Phone</th><th>Status</th><th>RFID / iButton</th><th>License Expiry</th><th>Actions</th></tr></thead><tbody>{rows.map((d,i)=>{const v=vehicles.find(x=>String(x.local?.id||x.id)===String(d.assignedVehicleId));return <tr key={d.id}><td>{i+1}</td><td><div className="entity">{d.photoData?<img src={d.photoData}/>:<span className="avatarSmall">{(d.name||'?')[0]}</span>}<b>{d.name}</b></div></td><td>{d.employeeId||'—'}</td><td>{v?`${catEmoji(v.category)} ${v.name}`:'Not assigned'}</td><td>{d.mobile||'—'}</td><td><Pill type={d.status==='Active'?'ok':'warn'}>{d.status||'Active'}</Pill></td><td>{d.identifiers?.map(x=>x.type+': '+x.identifier).join(', ')||d.rfid||d.ibutton||'—'}</td><td>{fmtDate(d.licenseExpiry)}</td><td><div className="rowBtns"><button onClick={()=>setSelected(d)}><Eye/></button><button onClick={()=>setEditing(d)}><Edit3/></button><button onClick={()=>{setStore(deleteRow(store,'drivers',d.id));toast('Driver deleted')}}><Trash2/></button></div></td></tr>})}{!rows.length&&<tr><td colSpan="9"><Empty text="No drivers yet"/></td></tr>}</tbody></table></div>{selected&&<Drawer title="Driver Details" onClose={()=>setSelected(null)}><div className="profileHead">{selected.photoData?<img src={selected.photoData}/>:<div className="avatarLarge">{selected.name?.[0]}</div>}<div><h2>{selected.name}</h2><p>Driver ID: {selected.employeeId||'—'}</p><p>{selected.mobile||'—'}</p></div><Pill type={selected.status==='Active'?'ok':'warn'}>{selected.status}</Pill></div><div className="detailTabs"><button className={driverTab==='profile'?'active':''} onClick={()=>setDriverTab('profile')}>Profile</button><button onClick={()=>setPage('reports')}>Trips</button><button className={driverTab==='documents'?'active':''} onClick={()=>setDriverTab('documents')}>Documents</button><button className={driverTab==='activity'?'active':''} onClick={()=>setDriverTab('activity')}>Activity</button></div>{driverTab==='profile'&&<div className="infoList"><p><UserRound/><span>Full Name</span><b>{selected.name}</b></p><p><Mail/><span>Email</span><b>{selected.email||'—'}</b></p><p><Phone/><span>Phone</span><b>{selected.mobile||'—'}</b></p><p><KeyRound/><span>RFID / iButton</span><b>{selected.identifiers?.map(x=>x.type+': '+x.identifier).join(', ')||selected.rfid||selected.ibutton||'—'}</b></p><p><CalendarDays/><span>License Expiry</span><b>{fmtDate(selected.licenseExpiry)}</b></p></div>}{driverTab==='documents'&&<div className="infoList"><p><FileText/><span>License Number</span><b>{selected.license||'—'}</b></p><p><CalendarDays/><span>License Expiry</span><b>{fmtDate(selected.licenseExpiry)}</b></p><p><ImageIcon/><span>Photo</span><b>{selected.photoData?'Uploaded':'Not uploaded'}</b></p></div>}{driverTab==='activity'&&<div className="infoList">{dedupeAlerts(store.alerts.filter(a=>String(a.companyId)===String(company.id)&&(a.driverId===selected.id||a.driverName===selected.name))).slice(-8).reverse().map(a=><p key={a.id}><Activity/><span>{a.type}</span><b>{fmtDateTime(a.createdAt)}</b></p>)}{!store.alerts.some(a=>String(a.companyId)===String(company.id)&&(a.driverId===selected.id||a.driverName===selected.name))&&<p><Info/><span>Activity</span><b>No driver-linked events yet</b></p>}</div>}<div className="drawerActions"><button className="primary" onClick={()=>setPage('reports')}><Route/>View Trips</button><button onClick={()=>setEditing(selected)}><Car/>Assign Vehicle</button></div></Drawer>}</div>{editing!==null&&<Modal title={editing?.id?'Edit Driver':'Add Driver'} subtitle="Add a driver to your fleet. All fields are linked to vehicle assignment and RFID/iButton mapping." onClose={()=>setEditing(null)} wide><DriverForm initial={editing||{}} company={company} vehicles={vehicles} store={store} setStore={setStore} onClose={()=>setEditing(null)} toast={toast}/></Modal>}</section>}

function pointLabel(p){if(!p)return'—';return p.address||((Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude)))?`${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`:'—')}
function idleSegments(route,v){const pts=(route||[]).slice().sort((a,b)=>new Date(a.fixTime||a.deviceTime||a.serverTime)-new Date(b.fixTime||b.deviceTime||b.serverTime));const out=[];let seg=null;for(const p of pts){const ign=ignitionState(p),s=kmh(p),idle=ign===true&&s<=3,t=new Date(p.fixTime||p.deviceTime||p.serverTime);if(idle&&!seg)seg={start:p,end:p,startTime:t};else if(idle&&seg)seg.end=p;else if(!idle&&seg){const endTime=new Date(seg.end.fixTime||seg.end.deviceTime||seg.end.serverTime);out.push({vehicle:v.name,driver:v.driverName||'—',startingPoint:pointLabel(seg.start),endingPoint:pointLabel(seg.end),idleOn:fmtDateTime(seg.startTime),idleOff:fmtDateTime(endTime),idleDuration:`${Math.max(0,Math.round((endTime-seg.startTime)/60000))} min`,distance:'0 km'});seg=null}}if(seg){const endTime=new Date(seg.end.fixTime||seg.end.deviceTime||seg.end.serverTime);out.push({vehicle:v.name,driver:v.driverName||'—',startingPoint:pointLabel(seg.start),endingPoint:pointLabel(seg.end),idleOn:fmtDateTime(seg.startTime),idleOff:fmtDateTime(endTime),idleDuration:`${Math.max(0,Math.round((endTime-seg.startTime)/60000))} min`,distance:'0 km'})}return out}
const reportTypeLabel=type=>({'Summary Report':'General Report','Geofence Report':'Geofence Alert Report','Doors Report':'Door Report'}[type]||type);
function ReportsPage({company,vehicles,store,setStore,toast}){const reportVehicles=vehicles.filter(v=>!v.expired&&v.liveAccess!==false),[type,setType]=useState('Trip Report'),[from,setFrom]=useState(()=>{const d=new Date(Date.now()-7*DAY);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}),[to,setTo]=useState(()=>{const d=new Date();return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}),[vehicleId,setVehicleId]=useState('all'),[selectedVehicles,setSelectedVehicles]=useState([]),[driverId,setDriverId]=useState('all'),[rows,setRows]=useState([]),[busy,setBusy]=useState(false),[showSchedule,setShowSchedule]=useState(false),[locationMode,setLocationMode]=useState('address'),[idleMinimumSeconds,setIdleMinimumSeconds]=useState(120),[summary,setSummary]=useState(null),[expanded,setExpanded]=useState(false),[bragStatus,setBragStatus]=useState('all'),[bragSort,setBragSort]=useState('scoreAsc');const types=reportTypes;async function generate(){setBusy(true);try{const out=await buildReport({type,vehicles:selectedVehicles.length?reportVehicles.filter(v=>selectedVehicles.includes(String(v.id))):reportVehicles,store,from,to,driverId,locationMode,idleMinimumSeconds,bragStatus,bragSort},api);setRows(out);setSummary({...reportSummary(out,{type,from,to,idleMinimumSeconds,vehicles:selectedVehicles.length?reportVehicles.filter(v=>selectedVehicles.includes(String(v.id))):reportVehicles}),...(out.bragReport||{}),companyName:out.bragReport?.companyName||company.name,companyAddress:out.bragReport?.companyAddress||company.address||'',companyLogo:company.logoData||readGlobalBranding().logoData||''});toast(out.length?reportTypeLabel(type)+' generated':'No recorded data matches these filters.')}catch(e){toast('Report could not be generated. '+e.message)}finally{setBusy(false)}}function exportCsv(ext='csv'){if(!rows.length)return toast('Generate a report first');const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))],sep=ext==='xls'?'\t':',';const body=[cols,...rows.map(r=>cols.map(c=>r[c]))].map(r=>r.map(x=>ext==='xls'?String(x??''):csv(x)).join(sep)).join('\n');fileDownload(`fleet-report.${ext}`,body,ext==='xls'?'application/vnd.ms-excel':'text/csv')}function schedule(data){setStore(addRow(store,'reportSchedules',{companyId:company.id,type,...data,vehicleId,vehicleIds:selectedVehicles,driverId,idleMinimumSeconds}));setShowSchedule(false);toast('Schedule saved. Generated reports will be available here.')}return <section className={'page reportsPage'+(expanded?' reportsExpanded':'')}>{busy&&<div className='pageLoadingOverlay' role='status' aria-live='polite'><span className='loadingSpinner' aria-hidden='true'/></div>}<PageHead title="Reports" subtitle="Generate reports, analyze your fleet activity, and export data." actions={<><button onClick={()=>setExpanded(x=>!x)}>{expanded?'Restore view':'Expand report'}</button><ReportExport rows={rows} summary={summary} toast={toast}/><button onClick={()=>document.querySelector('.schedules')?.scrollIntoView({behavior:'smooth'})}><CalendarDays/>Saved Reports</button><button className="primary" onClick={()=>setShowSchedule(true)}><Plus/>Schedule Report</button></>}/><div className="reportFilters"><Field label="Report Type"><select value={type} onChange={e=>{setType(e.target.value);setRows([]);setSummary(null)}}>{types.map(x=><option key={x} value={x}>{reportTypeLabel(x)}</option>)}</select></Field><Field label="Date Range"><div className="dateRange"><input type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)}/><span>–</span><input type="datetime-local" value={to} onChange={e=>setTo(e.target.value)}/></div></Field><Field label="Vehicles"><VehicleSelect vehicles={reportVehicles} value={selectedVehicles} onChange={setSelectedVehicles}/></Field><Field label="Drivers"><select value={driverId} onChange={e=>setDriverId(e.target.value)}><option value="all">All Drivers</option>{store.drivers.filter(d=>d.companyId===company.id).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="Report locations"><select value={locationMode} onChange={e=>setLocationMode(e.target.value)}><option value="address">Address</option><option value="coordinates">Coordinates</option><option value="both">Address + Coordinates</option></select></Field>{type==='BRAG Report'&&<><Field label="BRAG Status"><select value={bragStatus} onChange={e=>setBragStatus(e.target.value)}><option value="all">All statuses</option><option value="Blue">Blue</option><option value="Green">Green</option><option value="Amber">Amber</option><option value="Red">Red</option></select></Field><Field label="Sort by"><select value={bragSort} onChange={e=>setBragSort(e.target.value)}><option value="scoreAsc">Score: low to high</option><option value="scoreDesc">Score: high to low</option><option value="vehicleAsc">Vehicle number</option><option value="distanceDesc">Distance</option></select></Field></>}{type==='Idle Report'&&<Field label="Idle longer than (minutes)"><input type="number" min="0" max="1440" value={Math.round(Number(idleMinimumSeconds)/60)} onChange={e=>setIdleMinimumSeconds(Math.max(0,Number(e.target.value||0)*60))}/></Field>}<button className="primary generate" disabled={busy} onClick={generate}><Play/>{busy?'Generating...':'Generate Report'}</button></div>{type==='Idle Report'&&<div className="note reportNote"><Clock3/>Only idle periods strictly longer than {Math.round(Number(idleMinimumSeconds)/60)} minutes are included. Idle Report uses real route telemetry. Idle starts only when ignition is ON and speed is ≤ 3 km/h. Starting point, ending point, Idle ON, Idle OFF and Idle Duration are calculated from received data.</div>}<div className="reportResult">{summary?(summary.type==='BRAG Report'?<BragReport rows={rows} summary={summary}/>:summary.type==='RAG Report'?<RagReport rows={rows} summary={summary}/>:<FleetReport rows={rows} summary={summary}/>):<div className="tableCard"><Empty text="Choose filters and generate a report"/></div>}</div><div className="card schedules"><h2>Scheduled Reports</h2>{store.reportSchedules.filter(x=>x.companyId===company.id).length?store.reportSchedules.filter(x=>x.companyId===company.id).map(x=><div className="scheduleRow" key={x.id}><span><b>{x.name||reportTypeLabel(x.type)}</b><small>{x.frequency||'Weekly'} • {x.email||'No email'}</small></span><button onClick={async()=>{try{const runs=await api.scheduledReports(x.id);if(!runs.length)return toast('No completed runs yet.');fileDownload('scheduled-report.json',JSON.stringify(runs[0],null,2),'application/json')}catch{toast('Unable to load scheduled report.')}}}>Download latest</button><Pill>{x.enabled===false?'Paused':'Scheduled'}</Pill><button onClick={()=>setStore(updateRow(store,'reportSchedules',x.id,{enabled:x.enabled===false}))}><Power/></button><button onClick={()=>setStore(deleteRow(store,'reportSchedules',x.id))}><Trash2/></button></div>):<Empty text="No scheduled reports"/>}</div>{showSchedule&&<Modal title="Schedule Report" onClose={()=>setShowSchedule(false)}><ScheduleForm type={type} onSave={schedule} onClose={()=>setShowSchedule(false)}/></Modal>}</section>}
function ScheduleForm({type,onSave,onClose}){const[d,setD]=useState({name:reportTypeLabel(type),frequency:'Weekly',time:'08:00',email:'',enabled:true});return <form className="formGrid" onSubmit={e=>{e.preventDefault();onSave(d)}}><Field label="Report Name"><input value={d.name} onChange={e=>setD({...d,name:e.target.value})}/></Field><Field label="Frequency"><select value={d.frequency} onChange={e=>setD({...d,frequency:e.target.value})}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></Field><Field label="Time"><input type="time" value={d.time} onChange={e=>setD({...d,time:e.target.value})}/></Field><p className="wide">Reports are saved for download in this portal. Runs use the company time zone; weekly and monthly schedules repeat from the first run.</p><div className="modalActions wide"><button type="button" onClick={onClose}>Cancel</button><button className="primary"><Save/>Save Schedule</button></div></form>}

const ruleTypes=['Overspeed','Off-Hours Ignition','Ignition ON','Ignition OFF','Vehicle Started','Vehicle Stopped','Long Idle','Geofence Entry','Geofence Exit','Harsh Braking','Harsh Acceleration','Harsh Cornering','Seat Belt Violation','Unauthorized Driver','Power Disconnected','GPS Offline','Device Offline','Towing','Low Battery','SOS','Door Open','High Temperature','Low Temperature'];
function AlertRuleForm({initial={},company,vehicles,drivers,store,setStore,onClose,toast}){const[d,setD]=useState({type:'Overspeed',name:'Overspeed - 100 km/h',vehicleIds:[],driverId:'',threshold:100,durationMin:1,severity:'Warning',activeTime:'always',timeFrom:company.settings?.offHoursFrom||'17:00',timeTo:company.settings?.offHoursTo||'07:00',days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],inApp:true,email:false,sms:false,whatsapp:false,enabled:true,...initial});const f=(k,v)=>setD(x=>({...x,[k]:v}));useEffect(()=>{if(d.type==='Off-Hours Ignition'&&!initial?.id)setD(x=>({...x,name:'Off-Hours Ignition',activeTime:'custom',timeFrom:company.settings?.offHoursFrom||'17:00',timeTo:company.settings?.offHoursTo||'07:00',severity:'Critical',durationMin:0}))},[d.type]);async function save(e){e.preventDefault();let n=d.id?updateRow(store,'alertRules',d.id,d):addRow(store,'alertRules',{...d,companyId:company.id});if(!await setStore(n))return;toast('Alert rule saved');onClose()}return <form onSubmit={save} className="formGrid"><Field label="Alert Type *"><select value={d.type} onChange={e=>{const type=e.target.value;setD(x=>({...x,type,name:type,threshold:ruleThresholds[type]?.value??null,durationMin:type==='Overspeed'?1:0}))}}>{ruleTypes.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Rule Name *"><input required value={d.name} onChange={e=>f('name',e.target.value)}/></Field><Field label="Vehicles *"><select multiple value={d.vehicleIds} onChange={e=>f('vehicleIds',[...e.target.selectedOptions].map(o=>o.value))}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></Field><Field label="Driver (Optional)"><select value={d.driverId} onChange={e=>f('driverId',e.target.value)}><option value="">All Drivers</option>{drivers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>{ruleThresholds[d.type]?<Field label={ruleThresholds[d.type].label}><input required type="number" step="any" min={ruleThresholds[d.type].min} max={ruleThresholds[d.type].max} value={d.threshold??ruleThresholds[d.type].value} onChange={e=>f('threshold',Number(e.target.value))}/></Field>:d.type.startsWith('Ignition ')?<Field label="Ignition state"><select value={d.type} onChange={e=>setD(x=>({...x,type:e.target.value,name:e.target.value}))}><option>Ignition ON</option><option>Ignition OFF</option></select></Field>:<div className="note">Trigger: {d.type}. Uses the matching tracker state or event.</div>}<Field label="Duration (minutes)"><input type="number" min="0" value={d.durationMin} onChange={e=>f('durationMin',Number(e.target.value))}/></Field><Field label="Alert Severity"><select value={d.severity} onChange={e=>f('severity',e.target.value)}><option>Critical</option><option>Warning</option><option>Info</option></select></Field><Field label="Active Time"><select value={d.activeTime} onChange={e=>f('activeTime',e.target.value)}><option value="always">24 Hours (Always)</option><option value="custom">Custom Time Range</option></select></Field>{d.activeTime==='custom'&&<><Field label="Custom Time From"><input type="time" value={d.timeFrom||'17:00'} onChange={e=>f('timeFrom',e.target.value)}/></Field><Field label="Custom Time To"><input type="time" value={d.timeTo||'07:00'} onChange={e=>f('timeTo',e.target.value)}/></Field><Field label="Active Days" wide><div className="checks dayChecks">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><label key={day}><input type="checkbox" checked={(d.days||[]).includes(day)} onChange={e=>f('days',e.target.checked?[...(d.days||[]),day]:(d.days||[]).filter(x=>x!==day))}/>{day}</label>)}</div><small className="helpText">Overnight ranges are supported, for example 17:00 → 07:00.</small></Field></>}<Field label="Notification Methods" wide><div className="checks">{[['inApp','In-App Notification'],['email','Email Notification'],['sms','SMS Notification'],['whatsapp','WhatsApp Notification']].map(([k,l])=><label key={k}><input type="checkbox" checked={!!d[k]} onChange={e=>f(k,e.target.checked)}/>{l}</label>)}</div></Field><Field label="Notes" wide><textarea value={d.notes||''} onChange={e=>f('notes',e.target.value)}/></Field><Field label="Rule Status" wide><label className="toggleLine"><input type="checkbox" checked={d.enabled} onChange={e=>f('enabled',e.target.checked)}/> Enable this alert rule</label></Field><div className="modalActions wide"><button type="button" onClick={onClose}>Cancel</button><button className="primary"><Save/>Save Rule</button></div></form>}
function AlertsPage({company,vehicles,store,setStore,toast,setPage}){const[soundOpen,setSoundOpen]=useState(false),[soundSettings,setSoundSettings]=useState(company.settings||{});const [tab,setTab]=useState('All Alerts');const[selected,setSelected]=useState(null),[ruleEdit,setRuleEdit]=useState(null),[q,setQ]=useState(''),[type,setType]=useState('all'),[status,setStatus]=useState('all');useEffect(()=>{const unread=store.alerts.some(a=>String(a.companyId)===String(company.id)&&!a.read);if(unread)setStore(saveStore({...store,alerts:store.alerts.map(a=>String(a.companyId)===String(company.id)?{...a,read:true}:a)}))},[]);const all=dedupeAlerts(companyAlerts(store.alerts,company.id)),rows=all.filter(a=>(tab==='All Alerts'||tab==='Rules'||(tab==='Resolved'?a.status==='Resolved':a.severity===tab))&&(type==='all'||a.type===type)&&(status==='all'||(a.status||'New')===status)&&(!q||JSON.stringify(a).toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));const critical=all.filter(a=>a.severity==='Critical'&&a.status!=='Resolved').length,warning=all.filter(a=>a.severity==='Warning'&&a.status!=='Resolved').length,info=all.filter(a=>a.severity==='Info'&&a.status!=='Resolved').length,resolved=all.filter(a=>a.status==='Resolved').length;function resolve(a){setStore(updateRow(store,'alerts',a.id,{status:'Resolved'}));setSelected({...a,status:'Resolved'});toast('Alert resolved')}return <section className="page"><AlertDiagnostics/><PageHead title="Alerts" subtitle="Monitor and manage all alerts, events, and notifications from your fleet." actions={<><button className="resolveAllButton" disabled={!all.some(a=>a.status!=='Resolved')} onClick={async()=>{if(await setStore({...store,alerts:store.alerts.map(a=>String(a.companyId)===String(company.id)?{...a,status:'Resolved',read:true}:a)}))toast('All alerts resolved')}}><Check/>Resolve all</button><button onClick={()=>{setSoundSettings(company.settings||{});setSoundOpen(true)}}><Settings/>Alert Settings</button><button className="primary" onClick={()=>setRuleEdit({})}><Plus/>Create Alert Rule</button></>}/>{soundOpen&&<div className="soundSettingsOverlay"><div className="soundSettingsCard" role="dialog" aria-modal="true" aria-label="Alert Settings"><h2>Alert Settings</h2><AlertSoundControls settings={soundSettings} onChange={setSoundSettings} toast={toast}/><div className="soundSettingsActions"><button onClick={()=>setSoundOpen(false)}>Cancel</button><button className="primary" onClick={async()=>{if(await setStore(updateRow(store,'companies',company.id,{...company,settings:soundSettings}))){setSoundOpen(false);toast('Saved')}}}>Save</button></div></div></div>}<div className="tabs">{['All Alerts','Critical','Warning','Info','Resolved','Rules'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}</div><div className="kpiRow alertsKpi"><KPI icon={Bell} label="Total Alerts" value={all.length} sub="All time" tone="red"/><KPI icon={AlertTriangle} label="Critical" value={critical} sub="Require attention" tone="red"/><KPI icon={Bell} label="Warning" value={warning} sub="Needs review" tone="orange"/><KPI icon={Info} label="Info" value={info} sub="For your reference"/><KPI icon={CheckCircle2} label="Resolved" value={resolved} sub="Resolved alerts" tone="green"/></div><div className="splitPage"><div className="tableCard"><div className="filters"><div className="searchBox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search alerts..."/></div><select value={type} onChange={e=>setType(e.target.value)}><option value="all">All Types</option>{ruleTypes.map(x=><option key={x}>{x}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Statuses</option><option>New</option><option>Resolved</option></select></div>{tab!=='Rules'&&<table><thead><tr><th>#</th><th>Alert Type</th><th>Vehicle</th><th>Description</th><th>Time</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((a,i)=><tr key={a.id}><td>{i+1}</td><td><b>{a.type}</b></td><td>{a.vehicleName||'—'}</td><td>{a.description||a.title||'—'}</td><td>{fmtDateTime(a.createdAt)}</td><td><Address position={a.latitude!=null?{latitude:a.latitude,longitude:a.longitude,address:a.address}:/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(a.location||'')?{latitude:Number(a.location.split(',')[0]),longitude:Number(a.location.split(',')[1])}:{address:a.location||'Location unavailable'}}/></td><td><Pill type={a.status==='Resolved'?'ok':'bad'}>{a.status||'New'}</Pill></td><td><div className="rowBtns"><button onClick={()=>setSelected(a)}><Eye/></button><button onClick={()=>{setStore(deleteRow(store,'alerts',a.id));toast('Alert deleted')}}><Trash2/></button></div></td></tr>)}{!rows.length&&<tr><td colSpan="8"><Empty text="No alerts"/></td></tr>}</tbody></table>}<div className="alertRules"><div className="cardTitle"><div><h2>Alert Rules</h2><p>Create and manage custom alert rules for your fleet.</p></div><button onClick={()=>setRuleEdit({})}><Settings/>Manage Rules</button></div><div className="ruleStrip">{store.alertRules.filter(r=>r.companyId===company.id).map(r=><div key={r.id}><span><Bell/><b>{r.name}</b><small>{r.type}</small></span><label className="switch"><input type="checkbox" checked={r.enabled!==false} onChange={e=>setStore(updateRow(store,'alertRules',r.id,{enabled:e.target.checked}))}/><i/></label><button onClick={()=>setRuleEdit(r)}><Edit3/></button><button onClick={()=>setStore(deleteRow(store,'alertRules',r.id))}><Trash2/></button></div>)}</div></div></div>{selected&&<Drawer title="Alert Details" onClose={()=>setSelected(null)}><div className="alertDetailHead"><AlertTriangle/><div><h2>{selected.type}</h2><p>{selected.vehicleName}</p></div><Pill type={selected.status==='Resolved'?'ok':'bad'}>{selected.status||'New'}</Pill></div><div className="detailTabs"><button className="active">Details</button><button onClick={()=>setPage('map')}>Location</button><button onClick={()=>setPage('reports')}>Playback</button></div><div className="infoList"><p><Gauge/><span>Alert Type</span><b>{selected.type}</b></p><p><Car/><span>Vehicle</span><b>{selected.vehicleName||'—'}</b></p><p><Clock3/><span>Time</span><b>{fmtDateTime(selected.createdAt)}</b></p><p><MapPin/><span>Location</span><b><Address position={selected.location||'Location unavailable'}/></b></p><p><Info/><span>Description</span><b>{selected.description||selected.title||'—'}</b></p></div><div className="drawerActions"><button onClick={()=>setPage('map')}><MapPin/>View on Map</button>{selected.status!=='Resolved'&&<button className="primary" onClick={()=>resolve(selected)}><Check/>Resolve</button>}</div></Drawer>}</div>{ruleEdit!==null&&<Modal title={ruleEdit?.id?'Edit Alert Rule':'Create Alert Rule'} subtitle="Set conditions to automatically generate alerts for your fleet." onClose={()=>setRuleEdit(null)} wide><AlertRuleForm initial={ruleEdit||{}} company={company} vehicles={vehicles} drivers={store.drivers.filter(d=>d.companyId===company.id)} store={store} setStore={setStore} onClose={()=>setRuleEdit(null)} toast={toast}/></Modal>}</section>}

function GeofenceForm({initial={},company,vehicles,store,setStore,onClose,toast}){const[d,setD]=useState({name:'',overspeedAlert:false,speedLimit:50,cooldownMinutes:10,type:'circle',lat:25.2854,lng:51.531,radius:Number(company.settings?.geofenceRadius)||500,points:[],active:true,entryAlert:true,exitAlert:true,vehicleIds:[],...initial});const f=(k,v)=>setD(x=>({...x,[k]:v}));async function save(e){e.preventDefault();const issue=validGeofence(d);if(issue){toast(issue);return;}let n=d.id?updateRow(store,'localGeofences',d.id,d):addRow(store,'localGeofences',{...d,companyId:company.id});if(!await setStore(n))return;toast('Geofence saved');onClose()}return <form onSubmit={save} className="geoForm"><div className="formGrid"><Field label="Name *"><input required value={d.name} onChange={e=>f('name',e.target.value)}/></Field><Field label="Type"><select value={d.type} onChange={e=>f('type',e.target.value)}><option value="circle">Circle</option><option value="polygon">Polygon</option></select></Field>{d.type==='circle'&&<Field label="Radius (meters)"><input type="number" value={d.radius} onChange={e=>f('radius',Number(e.target.value))}/></Field>}<Field label="Status"><select value={d.active?'Active':'Inactive'} onChange={e=>f('active',e.target.value==='Active')}><option>Active</option><option>Inactive</option></select></Field><Field label="Vehicles" wide><VehicleSelect vehicles={vehicles} value={d.vehicleIds||[]} onChange={ids=>f('vehicleIds',ids)}/></Field><Field label="Alert Triggers" wide><div className="checks"><label><input type="checkbox" checked={d.entryAlert} onChange={e=>f('entryAlert',e.target.checked)}/>Entry Alert</label><label><input type="checkbox" checked={d.exitAlert} onChange={e=>f('exitAlert',e.target.checked)}/>Exit Alert</label></div></Field><Field label="Geofence overspeed" wide><label><input type="checkbox" checked={d.overspeedAlert===true} onChange={e=>f('overspeedAlert',e.target.checked)}/>Alert only while inside this geofence</label>{d.overspeedAlert&&<div><label>Speed limit (km/h)<input required type="number" min="1" max="400" value={d.speedLimit??50} onChange={e=>f('speedLimit',Number(e.target.value))}/></label><label>Repeat alert after (minutes)<input required type="number" min="1" max="1440" value={d.cooldownMinutes??10} onChange={e=>f('cooldownMinutes',Number(e.target.value))}/></label></div>}</Field><Field label="Description" wide><textarea value={d.description||''} onChange={e=>f('description',e.target.value)}/></Field></div><GeofenceEditor value={d} onChange={setD}/><div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary"><Save/>Save Geofence</button></div></form>}

function kmlExport(geos){let body='<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>';for(const g of geos){body+=`<Placemark><name>${g.name}</name>`;if(g.type==='polygon'&&g.points?.length)body+=`<Polygon><outerBoundaryIs><LinearRing><coordinates>${g.points.map(p=>`${p[1]},${p[0]},0`).join(' ')} ${g.points[0][1]},${g.points[0][0]},0</coordinates></LinearRing></outerBoundaryIs></Polygon>`;else body+=`<Point><coordinates>${g.lng},${g.lat},0</coordinates></Point><description>Circle radius ${g.radius||500} m</description>`;body+='</Placemark>'}body+='</Document></kml>';fileDownload('geofences.kml',body,'application/vnd.google-earth.kml+xml')}
function GeofencesPage({company,vehicles,store,setStore,toast}){const[editing,setEditing]=useState(null),[selected,setSelected]=useState(null),[q,setQ]=useState(''),fileRef=useRef();const rows=store.localGeofences.filter(g=>g.companyId===company.id&&(!q||g.name?.toLowerCase().includes(q.toLowerCase())));const active=rows.filter(g=>g.active!==false).length,events=dedupeAlerts(store.alerts.filter(a=>String(a.companyId)===String(company.id)&&String(a.type).includes('Geofence'))).slice(-30);function importKml(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const xml=new DOMParser().parseFromString(r.result,'text/xml'),places=[...xml.querySelectorAll('Placemark')];let n=store;for(const p of places){const name=p.querySelector('name')?.textContent||'Imported Geofence',coords=p.querySelector('coordinates')?.textContent?.trim();if(!coords)continue;const pts=coords.split(/\s+/).map(x=>{const [lng,lat]=x.split(',').map(Number);return[lat,lng]}).filter(x=>x.every(Number.isFinite));n=addRow(n,'localGeofences',{companyId:company.id,name,type:pts.length>2?'polygon':'circle',points:pts.length>2?pts:[],lat:pts[0]?.[0]||25.2854,lng:pts[0]?.[1]||51.531,radius:500,active:true,entryAlert:true,exitAlert:true,vehicleIds:[]})}setStore(n);toast('KML imported')}catch{toast('Unable to import KML')}};r.readAsText(file)}return <section className="page"><PageHead title="Geofences" subtitle="Create and manage geofences to monitor vehicle entry and exit activity." actions={<><input ref={fileRef} hidden type="file" accept=".kml" onChange={e=>importKml(e.target.files[0])}/><button onClick={()=>fileRef.current?.click()}><Upload/>Import Geofences</button><button onClick={()=>kmlExport(rows)}><Download/>Export KML</button><button className="primary" onClick={()=>setEditing({})}><Plus/>Add Geofence</button></>}/><div className="kpiRow geoKpi"><KPI icon={MapPin} label="Total Geofences" value={rows.length} sub="All geofences"/><KPI icon={CheckCircle2} label="Active" value={active} sub="Currently active" tone="green"/><KPI icon={Pause} label="Inactive" value={rows.length-active} sub="Disabled" tone="red"/><KPI icon={Activity} label="Total Events (30 Days)" value={events.length} sub="Entry / Exit events" tone="purple"/></div><div className="geoLayout"><div className="geoList"><div className="searchBox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search geofences..."/></div>{rows.map(g=><button key={g.id} className={selected?.id===g.id?'selected':''} onClick={()=>setSelected(g)}><i style={{borderColor:g.active!==false?'#1caf66':'#98a6b0'}}/><span><b>{g.name}</b><small>{g.type==='circle'?`Circle • ${g.radius||500} m`:`Polygon • ${g.points?.length||0} points`}</small></span><Pill type={g.active!==false?'ok':'warn'}>{g.active!==false?'Active':'Inactive'}</Pill><MoreHorizontal/></button>)}{!rows.length&&<Empty text="No geofences"/>}</div><div className="geoMap"><MapContainer zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} center={[25.2854,51.531]} zoom={11}><Basemap/>{rows.map(g=>g.type==='polygon'&&g.points?.length>2?<Polygon key={g.id} positions={g.points} eventHandlers={{click:()=>setSelected(g)}}/>:<Circle key={g.id} center={[Number(g.lat)||25.2854,Number(g.lng)||51.531]} radius={Number(g.radius)||500} eventHandlers={{click:()=>setSelected(g)}}/>)}</MapContainer></div>{selected&&<div className="geoDetails"><div className="drawerHead"><h3>Geofence Details</h3><button onClick={()=>setSelected(null)}><X/></button></div><div className="geoTitle"><MapPin/><div><h2>{selected.name}</h2><p>{selected.type} • {selected.type==='circle'?`${selected.radius} m`:`${selected.points?.length||0} points`}</p></div><Pill type={selected.active!==false?'ok':'warn'}>{selected.active!==false?'Active':'Inactive'}</Pill></div><div className="infoList"><p><MapPin/><span>Type</span><b>{selected.type}</b></p><p><MapPin/><span>Center</span><b>{selected.lat?.toFixed?.(4)||'—'}, {selected.lng?.toFixed?.(4)||'—'}</b></p><p><Car/><span>Vehicles</span><b>{selected.vehicleIds?.length||0}</b></p><p><Info/><span>Description</span><b>{selected.description||'—'}</b></p></div><div className="drawerActions"><button onClick={()=>setEditing(selected)}><Edit3/>Edit</button><button onClick={()=>{setStore(updateRow(store,'localGeofences',selected.id,{active:selected.active===false}));setSelected({...selected,active:selected.active===false})}}><Pause/>{selected.active===false?'Activate':'Deactivate'}</button><button className="danger" onClick={()=>{setStore(deleteRow(store,'localGeofences',selected.id));setSelected(null)}}><Trash2/>Delete</button></div></div>}</div><div className="card geoEvents"><h2>Recent Geofence Events</h2><table><thead><tr><th>Time</th><th>Vehicle</th><th>Event</th><th>Geofence</th></tr></thead><tbody>{events.length?events.slice().reverse().map(a=><tr key={a.id}><td>{fmtDateTime(a.createdAt)}</td><td>{a.vehicleName}</td><td>{a.type}</td><td>{a.geofenceName||'—'}</td></tr>):<tr><td colSpan="4">No geofence events</td></tr>}</tbody></table></div>{editing!==null&&<Modal title={editing?.id?'Edit Geofence':'Add Geofence'} subtitle="Create a virtual boundary and get alerts when vehicles enter or exit." onClose={()=>setEditing(null)} wide><GeofenceForm initial={editing||{}} company={company} vehicles={vehicles} store={store} setStore={setStore} onClose={()=>setEditing(null)} toast={toast}/></Modal>}</section>}

function maintStatus(m,vehicle){if(m.status==='Completed')return'Completed';const now=new Date(),due=m.dueDate?new Date(m.dueDate):null,km=Number(vehicle?.position?.attributes?.odometer||0)/1000,dueKm=Number(m.dueOdometer||0);if((due&&due<now)||(dueKm&&km>=dueKm))return'Overdue';if((due&&due-now<7*DAY)||(dueKm&&dueKm-km<500))return'Due Soon';return'Scheduled'}
function LocationForm({initial={},kind,company,store,setStore,onClose,toast}){const key=kind==='poi'?'pois':'parkingSlots',[d,setD]=useState({name:'',icon:kind==='poi'?'🏢':undefined,category:kind==='parking'?'Parking':undefined,lat:25.2854,lng:51.531,capacity:kind==='parking'?1:undefined,address:'Doha, Qatar',description:'',active:true,...initial});const f=(k,v)=>setD(x=>({...x,[k]:v}));async function save(e){e.preventDefault();const row={...d,companyId:company.id};setStore(d.id?updateRow(store,key,d.id,row):addRow(store,key,row));toast(`${kind==='poi'?'POI':'Parking slot'} saved`);onClose()}return <form onSubmit={save} className="geoForm"><div className="formGrid"><Field label="Name *"><input required value={d.name} onChange={e=>f('name',e.target.value)}/></Field>{kind==='poi'?<Field label="POI Icon" wide><div className="poiIconPicker">{POI_ICONS.map(x=><button type="button" key={x} className={d.icon===x?'selected':''} onClick={()=>f('icon',x)}>{x}</button>)}</div></Field>:<Field label="Category"><input value={d.category||''} onChange={e=>f('category',e.target.value)}/></Field>}{kind==='parking'&&<Field label="Capacity"><input type="number" min="1" value={d.capacity||1} onChange={e=>f('capacity',Number(e.target.value))}/></Field>}<Field label="Status"><select value={d.active?'Active':'Inactive'} onChange={e=>f('active',e.target.value==='Active')}><option>Active</option><option>Inactive</option></select></Field><Field label="Address" wide><input value={d.address||''} onChange={e=>f('address',e.target.value)}/></Field><Field label="Description" wide><textarea value={d.description||''} onChange={e=>f('description',e.target.value)}/></Field></div><div className="geoPick"><MapContainer zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} center={[Number(d.lat)||25.2854,Number(d.lng)||51.531]} zoom={13}><Basemap/><PickMap mode="circle" onCircle={p=>setD(x=>({...x,lat:p.lat,lng:p.lng}))} onPolygon={()=>{}}/><Marker position={[Number(d.lat)||25.2854,Number(d.lng)||51.531]} icon={kind==='poi'?poiMarkerIcon(d.icon,d.name):undefined}/></MapContainer><small>Click the map to set the exact location.</small></div><div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary"><Save/>Save</button></div></form>}
function LocationManagerPage({kind,company,store,setStore,toast}){const key=kind==='poi'?'pois':'parkingSlots',title=kind==='poi'?'POI (Points of Interest)':'Parking Slots',[editing,setEditing]=useState(null),[selected,setSelected]=useState(null),[q,setQ]=useState('');const rows=(store[key]||[]).filter(x=>x.companyId===company.id&&(!q||[x.name,x.address].join(' ').toLowerCase().includes(q.toLowerCase())));return <section className="page"><PageHead title={title} subtitle={kind==='poi'?'Create reusable fleet points such as offices, depots, fuel stations and customer sites.':'Manage parking locations and capacities for your fleet.'} actions={<button className="primary" onClick={()=>setEditing({})}><Plus/>{kind==='poi'?'Add POI':'Add Parking Slot'}</button>}/><div className="splitPage"><div className="tableCard"><div className="filters"><div className="searchBox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={`Search ${kind==='poi'?'POI':'parking'}...`}/></div></div><table><thead><tr><th>#</th><th>Name</th><th>{kind==='poi'?'Icon':'Category'}</th><th>Address</th>{kind==='parking'&&<th>Capacity</th>}<th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((x,i)=><tr key={x.id}><td>{i+1}</td><td><b>{x.name}</b></td><td>{kind==='poi'?<span className="poiTableIcon">{poiIcon(x.icon)}</span>:(x.category||'—')}</td><td>{x.address||'—'}</td>{kind==='parking'&&<td>{x.capacity||'—'}</td>}<td><Pill type={x.active!==false?'ok':'bad'}>{x.active!==false?'Active':'Inactive'}</Pill></td><td><div className="rowBtns"><button onClick={()=>setSelected(x)}><Eye/></button><button onClick={()=>setEditing(x)}><Edit3/></button><button onClick={()=>{setStore(deleteRow(store,key,x.id));toast('Deleted')}}><Trash2/></button></div></td></tr>)}{!rows.length&&<tr><td colSpan={kind==='parking'?7:6}><Empty text={`No ${kind==='poi'?'POI':'parking slots'} yet`}/></td></tr>}</tbody></table></div>{selected&&<Drawer title={`${kind==='poi'?'POI':'Parking'} Details`} onClose={()=>setSelected(null)}><div className="infoList"><p><MapPin/><span>Name</span><b>{selected.name}</b></p>{kind==='poi'?<p><MapPin/><span>Icon</span><b className="poiDetailIcon">{poiIcon(selected.icon)}</b></p>:<p><Layers3/><span>Category</span><b>{selected.category||'—'}</b></p>}<p><MapPin/><span>Address</span><b>{selected.address||'—'}</b></p><p><Globe2/><span>Coordinates</span><b>{Number(selected.lat).toFixed(5)}, {Number(selected.lng).toFixed(5)}</b></p>{kind==='parking'&&<p><Car/><span>Capacity</span><b>{selected.capacity||'—'}</b></p>}</div><div className="locationMiniMap"><MapContainer zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} center={[Number(selected.lat)||25.2854,Number(selected.lng)||51.531]} zoom={14}><Basemap/><Marker position={[Number(selected.lat)||25.2854,Number(selected.lng)||51.531]} icon={kind==='poi'?poiMarkerIcon(selected.icon,selected.name):undefined}/></MapContainer></div><div className="drawerActions"><button onClick={()=>setEditing(selected)}><Edit3/>Edit</button></div></Drawer>}</div>{editing!==null&&<Modal title={editing?.id?`Edit ${kind==='poi'?'POI':'Parking Slot'}`:`Add ${kind==='poi'?'POI':'Parking Slot'}`} onClose={()=>setEditing(null)} wide><LocationForm initial={editing||{}} kind={kind} company={company} store={store} setStore={setStore} onClose={()=>setEditing(null)} toast={toast}/></Modal>}</section>}
function expiryDays(v){const raw=v?.local?.expirationDate||v?.local?.expiryDate||v?.local?.expiry||v?.local?.expiresAt||v?.expirationDate||v?.expiryDate||v?.expiry;if(!raw)return null;const t=Date.parse(raw);if(!Number.isFinite(t))return null;return Math.ceil((t-Date.now())/86400000)}
const EXPIRY_NOTICE_DAYS=30;
function ExpiryBanner({banner}){const heading=String(banner?.heading||'').trim(),text=String(banner?.text||'').trim(),color=/^#[0-9a-f]{6}$/i.test(String(banner?.textColor||''))?banner.textColor:'#d71920';if(!heading&&!text)return null;return <div className="expiryTicker" role="status">{heading&&<div className="expiryTickerHeading">{heading}</div>}{text&&<div className="expiryTickerViewport"><div className="expiryTickerTrack" style={{'--ticker-color':color}}><span>{text}</span><span aria-hidden="true">{text}</span></div></div>}</div>}
function NewsPage({news,onMarkRead}){return <section className="page newsPage"><PageHead title="News & Updates" subtitle="Announcements, image greetings, and service notices from your Super Admin."/><div className="newsUserList">{news.length?news.map(item=><article className={item.read?'':'unread'} key={item.id} onClick={()=>!item.read&&onMarkRead(item.id)}>{(item.imageData||item.imageUrl)&&<img className="newsUserImage" src={item.imageData||item.imageUrl} alt=""/>}<div className="newsUserIcon"><Megaphone/></div><div className="newsUserContent"><div className="newsUserMeta"><span className="newsTypeBadge">{item.kind==='image'?'Greeting':item.kind==='service'?'Service message':'Announcement'}</span>{!item.read&&<span>New</span>}</div>{item.heading&&<h2>{item.heading}</h2>}{item.description&&<p>{item.description}</p>}<small>{new Date(item.createdAt).toLocaleString()}</small></div></article>):<div className="card newsEmpty"><Megaphone/><h2>No news yet</h2><p>New announcements from your Super Admin will appear here.</p></div>}</div></section>}
function NewsPopups({news,onMarkRead,onOpen}){const[sessionDismissed,setSessionDismissed]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('inviha_news_popup_dismissed')||'[]')}catch{return[]}});const dismiss=id=>{const next=[...new Set([...sessionDismissed,String(id)])];setSessionDismissed(next);try{sessionStorage.setItem('inviha_news_popup_dismissed',JSON.stringify(next))}catch{}onMarkRead(id)};const item=news.find(x=>!x.read&&!sessionDismissed.includes(String(x.id)))||news.find(x=>x.kind==='image'&&!sessionDismissed.includes(String(x.id)));if(!item)return null;const image=item.imageData||item.imageUrl;const imageOnly=item.kind==='image'&&!!image&&!item.heading&&!item.description;return <div className={`newsPopup newsPopupModal${imageOnly?' newsPopupImageOnly':''}`} role="dialog" aria-label="News update"><button type="button" className="newsPopupX" aria-label="Close" onClick={()=>dismiss(item.id)}>×</button>{image&&<img className="newsPopupImage" src={image} alt=""/>}<div className="newsPopupBody">{!imageOnly&&<><small className="newsPopupType">{item.kind==='service'?'Service message':'Important update'}</small>{item.heading&&<h2>{item.heading}</h2>}{item.description&&<p>{item.description}</p>}<small className="newsPopupDate">{new Date(item.createdAt).toLocaleString()}</small></>}<div><button type="button" onClick={()=>{dismiss(item.id);onOpen()}}>View News <ChevronRight/></button><button type="button" className="newsPopupClose" onClick={()=>dismiss(item.id)}>Close</button></div></div></div>}function ProfilePage({company,setPage,accountExpiry}){return <section className="page"><PageHead title="My Profile" subtitle="Company administrator profile." actions={<button className="primary" onClick={()=>setPage('settings')}><Edit3/>Edit in Settings</button>}/><div className="card profilePageCard"><div className="profileHead"><div className="avatarLarge">{(company.adminName||company.contact||'A')[0]}</div><div><h2>{company.adminName||company.contact||'Company Admin'}</h2><p>Company Admin • {company.name}</p></div></div><div className="infoList"><p><Mail/><span>Email</span><b>{company.email||'—'}</b></p><p><Phone/><span>Phone</span><b>{company.phone||'—'}</b></p><p><MapPin/><span>Address</span><b>{company.address||'—'}</b></p><p><Globe2/><span>Time Zone</span><b>{company.timezone||'Asia/Qatar'}</b></p><p><Clock3/><span>Company expiry</span><b>{company.expiry?String(company.expiry).slice(0,10):'Unlimited'}</b></p><p><Clock3/><span>Account expiry</span><b>{accountExpiry?String(accountExpiry).replace('T',' '):'Unlimited'}</b></p></div></div></section>}
function MaintenanceForm({initial={},company,vehicles,store,setStore,onClose,toast}){const[d,setD]=useState({serviceType:'Engine Oil',intervalValue:10000,intervalUnit:'Kilometers',reminderBefore:Number(company.settings?.maintenanceReminderDays??7),priority:'Normal',autoNext:true,...initial,companyId:company.id});const f=(k,v)=>setD(x=>({...x,[k]:v}));async function save(e){e.preventDefault();let n=d.id?updateRow(store,'maintenance',d.id,d):addRow(store,'maintenance',d);if(!await setStore(n))return;toast('Maintenance saved');onClose()}return <form className="formGrid" onSubmit={save}><Field label="Vehicle *"><select required value={d.vehicleId||''} onChange={e=>f('vehicleId',e.target.value)}><option value="">Select vehicle</option>{vehicles.map(v=><option key={v.id} value={v.local?.id||v.id}>{v.name}</option>)}</select></Field><Field label="Title *"><input required value={d.title||''} onChange={e=>f('title',e.target.value)} placeholder="Engine Oil Change"/></Field><Field label="Service Type *"><select value={d.serviceType} onChange={e=>f('serviceType',e.target.value)}>{['Engine Oil','Tire Rotation','Brake Inspection','Battery Check','Air Filter','General Service','Repair'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Service Interval"><div className="pair"><input type="number" value={d.intervalValue} onChange={e=>f('intervalValue',Number(e.target.value))}/><select value={d.intervalUnit} onChange={e=>f('intervalUnit',e.target.value)}><option>Kilometers</option><option>Days</option><option>Months</option></select></div></Field><Field label="Due Date"><input type="date" value={d.dueDate||''} onChange={e=>f('dueDate',e.target.value)}/></Field><Field label="Due Odometer"><input type="number" value={d.dueOdometer||''} onChange={e=>f('dueOdometer',e.target.value)}/></Field><Field label="Reminder Before"><input type="number" value={d.reminderBefore} onChange={e=>f('reminderBefore',Number(e.target.value))}/></Field><Field label="Priority"><select value={d.priority} onChange={e=>f('priority',e.target.value)}><option>Low</option><option>Normal</option><option>High</option></select></Field><Field label="Cost"><input type="number" value={d.cost||''} onChange={e=>f('cost',e.target.value)}/></Field><Field label="Notes" wide><textarea value={d.notes||''} onChange={e=>f('notes',e.target.value)}/></Field><Field label="Next Service" wide><label className="toggleLine"><input type="checkbox" checked={d.autoNext} onChange={e=>f('autoNext',e.target.checked)}/> Create next service automatically when completed</label></Field><div className="modalActions wide"><button type="button" onClick={onClose}>Cancel</button><button className="primary"><Save/>Save Maintenance</button></div></form>}
function MaintenancePage({company,vehicles,store,setStore,toast}){const[editing,setEditing]=useState(null),[selected,setSelected]=useState(null),[q,setQ]=useState('');const rows=store.maintenance.filter(m=>m.companyId===company.id&&(!q||JSON.stringify(m).toLowerCase().includes(q.toLowerCase()))).map(m=>({...m,computedStatus:maintStatus(m,vehicles.find(v=>String(v.local?.id||v.id)===String(m.vehicleId)))}));function complete(m){let n=updateRow(store,'maintenance',m.id,{status:'Completed',completedAt:new Date().toISOString(),lastServiceDate:new Date().toISOString().slice(0,10)});if(m.autoNext){const next={...m,id:undefined,status:'Scheduled',title:m.title,createdAt:undefined};if(m.intervalUnit==='Days')next.dueDate=new Date(Date.now()+Number(m.intervalValue||1)*DAY).toISOString().slice(0,10);else if(m.intervalUnit==='Months'){const d=new Date();d.setMonth(d.getMonth()+Number(m.intervalValue||1));next.dueDate=d.toISOString().slice(0,10)}else next.dueOdometer=Number(m.dueOdometer||0)+Number(m.intervalValue||0);n=addRow(n,'maintenance',next)}setStore(n);toast('Maintenance completed')}return <section className="page"><PageHead title="Maintenance" subtitle="Schedule and track vehicle maintenance to keep your fleet in optimal condition." actions={<button className="primary" onClick={()=>setEditing({})}><Plus/>Add Maintenance</button>}/><div className="splitPage"><div className="tableCard"><div className="filters"><div className="searchBox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search maintenance..."/></div></div><table><thead><tr><th>#</th><th>Vehicle</th><th>Service Type</th><th>Due Date</th><th>Due Odometer</th><th>Status</th><th>Cost</th><th>Actions</th></tr></thead><tbody>{rows.map((m,i)=>{const v=vehicles.find(v=>String(v.local?.id||v.id)===String(m.vehicleId));return <tr key={m.id}><td>{i+1}</td><td>{v?.name||'—'}</td><td>{m.title||m.serviceType}</td><td>{fmtDate(m.dueDate)}</td><td>{m.dueOdometer?`${m.dueOdometer} km`:'—'}</td><td><Pill type={m.computedStatus==='Overdue'?'bad':m.computedStatus==='Due Soon'?'warn':'ok'}>{m.computedStatus}</Pill></td><td>{m.cost||'—'}</td><td><div className="rowBtns"><button onClick={()=>setSelected(m)}><Eye/></button><button onClick={()=>setEditing(m)}><Edit3/></button><button onClick={()=>setStore(deleteRow(store,'maintenance',m.id))}><Trash2/></button></div></td></tr>})}{!rows.length&&<tr><td colSpan="8"><Empty text="No maintenance records"/></td></tr>}</tbody></table></div>{selected&&<Drawer title="Maintenance Details" onClose={()=>setSelected(null)}><div className="alertDetailHead"><Wrench/><div><h2>{selected.title||selected.serviceType}</h2><p>{vehicles.find(v=>String(v.local?.id||v.id)===String(selected.vehicleId))?.name||'—'}</p></div><Pill type={maintStatus(selected,vehicles.find(v=>String(v.local?.id||v.id)===String(selected.vehicleId)))==='Overdue'?'bad':'ok'}>{maintStatus(selected,vehicles.find(v=>String(v.local?.id||v.id)===String(selected.vehicleId)))}</Pill></div><div className="infoList"><p><Wrench/><span>Service Type</span><b>{selected.serviceType}</b></p><p><CalendarDays/><span>Due Date</span><b>{fmtDate(selected.dueDate)}</b></p><p><Gauge/><span>Due Odometer</span><b>{selected.dueOdometer||'—'}</b></p><p><Info/><span>Priority</span><b>{selected.priority}</b></p><p><FileText/><span>Notes</span><b>{selected.notes||'—'}</b></p></div>{selected.status!=='Completed'&&<button className="primary full" onClick={()=>{complete(selected);setSelected(null)}}><Check/>Mark as Completed</button>}<div className="drawerActions"><button onClick={()=>setEditing(selected)}><Edit3/>Edit</button><button className="danger" onClick={()=>{setStore(deleteRow(store,'maintenance',selected.id));setSelected(null)}}><Trash2/>Delete</button></div></Drawer>}</div>{editing!==null&&<Modal title={editing?.id?'Edit Maintenance':'Add Maintenance'} subtitle="Schedule a maintenance service for your vehicle." onClose={()=>setEditing(null)} wide><MaintenanceForm initial={editing||{}} company={company} vehicles={vehicles} store={store} setStore={setStore} onClose={()=>setEditing(null)} toast={toast}/></Modal>}</section>}

const sensorDefaults=[['Ignition','Digital Input','ignition',''],['Engine','Digital Input','engineRunning',''],['Battery Level','Analog Input','batteryLevel','%'],['External Power','Analog Input','power','V'],['GSM Signal','Signal','rssi','%'],['GPS Status','GPS','valid',''],['Seat Belt','Digital Input','seatBelt',''],['Driver ID','RFID / iButton','driverUniqueId',''],['Fuel Level','Analog Input','fuel','%'],['Temperature','Analog Input','temperature','°C'],['Door Sensor','Digital Input','door',''],['PTO','Digital Input','pto',''],['Motion','Digital Input','motion','']];
function sensorVal(v,s,store){if(s.type==='RFID / iButton'||/^(driver|driver id|rfid\/?ibutton)$/i.test(s.name||'')||['driver_identifier','driverUniqueId','rfid','ibutton'].includes(s.sourceKey))return v?.currentDriver?.identifier?`${v.currentDriver.name} · ${v.currentDriver.identifier}`:'Not identified';const p=v?.position;if(!p)return'Not available';if(s.sourceKey==='valid')return p.valid===false?'Invalid':'Fixed';if(['driverUniqueId','driver_identifier','rfid','ibutton'].includes(s.sourceKey))return v.currentDriver?.identifier?`${v.currentDriver.name} · ${v.currentDriver.identifier}`:'Not identified';return sensorReading(p,s)}

function SensorForm({initial={},company,vehicles,store,setStore,onClose,toast}){const[d,setD]=useState({name:'Ignition',type:'Digital Input',sourceKey:'ignition',unit:'',enabled:true,...initial,companyId:company.id});const f=(k,v)=>setD(x=>({...x,[k]:v}));const driverSensor=d.type==='RFID / iButton'||/^(driver|driver id|rfid\/?ibutton)$/i.test(d.name||'');async function save(e){e.preventDefault();if(driverSensor){d.type='RFID / iButton';d.sourceKey='driver_identifier';}let n=d.id?updateRow(store,'sensorConfigs',d.id,d):addRow(store,'sensorConfigs',d);if(!await setStore(n))return;toast('Sensor configuration saved');onClose()}return <form onSubmit={save} className="formGrid"><Field label="Vehicle *"><select required value={d.vehicleId||''} onChange={e=>f('vehicleId',e.target.value)}><option value="">Select vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></Field><Field label="Sensor preset"><select value={sensorPresets[d.name]?d.name:'Custom'} onChange={e=>{const name=e.target.value;if(name==='Custom')return;setD(x=>({...x,name,...sensorPresets[name],scale:1,offset:0,invert:false,onLabel:'ON',offLabel:'OFF',normalValue:''}))}}>{[...Object.keys(sensorPresets),'Custom'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Sensor Name *"><input required value={d.name} onChange={e=>f('name',e.target.value)}/></Field><Field label="Sensor Type"><select value={d.type} onChange={e=>f('type',e.target.value)}><option>Digital Input</option><option>Digital Output</option><option>Analog Input</option><option>RFID / iButton</option><option>GPS</option><option>Signal</option></select></Field><Field label="Telemetry / I/O Source Key *"><input required readOnly={driverSensor} value={driverSensor?'driver_identifier':d.sourceKey} onChange={e=>f('sourceKey',e.target.value)} placeholder="ignition / input / io200"/></Field><Field label="Device protocol / profile"><input value={d.deviceProfile||''} onChange={e=>f('deviceProfile',e.target.value)} placeholder="Protocol and model"/></Field>{d.name==='Overspeed'?<Field label="Speed limit (km/h)"><input required type="number" min="1" value={d.speedLimit??100} onChange={e=>f('speedLimit',Number(e.target.value))}/><small>Shows whether live speed exceeds this limit. Create an Overspeed alert rule to send a notification.</small></Field>:digitalSensor(d)?<><Field label="ON label"><input required value={d.onLabel||'ON'} onChange={e=>f('onLabel',e.target.value)}/></Field><Field label="OFF label"><input required value={d.offLabel||'OFF'} onChange={e=>f('offLabel',e.target.value)}/></Field><Field label="Invert ON/OFF"><input type="checkbox" checked={!!d.invert} onChange={e=>f('invert',e.target.checked)}/></Field></>:d.type==='RFID / iButton'?<div className="note wide">Displays the identified driver from the Driver Identification mapping above. No battery, ignition, or numeric scaling is used.</div>:<><Field label="Scale"><input type="number" step="any" value={d.scale??1} onChange={e=>f('scale',Number(e.target.value))}/></Field><Field label="Offset"><input type="number" step="any" value={d.offset??0} onChange={e=>f('offset',Number(e.target.value))}/></Field><Field label="Unit"><input value={d.unit||''} onChange={e=>f('unit',e.target.value)}/></Field></>}<Field label="Notes" wide><textarea value={d.notes||''} onChange={e=>f('notes',e.target.value)}/></Field><Field label="Status" wide><label className="toggleLine"><input type="checkbox" checked={d.enabled} onChange={e=>f('enabled',e.target.checked)}/> Enable this sensor</label></Field><div className="modalActions wide"><button type="button" onClick={onClose}>Cancel</button><button className="primary"><Save/>Save Sensor</button></div></form>}
function SensorsPage({company,vehicles,store,setStore,toast}){const [id,setId]=useState(''),[editing,setEditing]=useState(null),[showIo,setShowIo]=useState(false);const v=vehicles.find(x=>String(x.id)===id)||vehicles[0];async function removeSensor(sensor){if(!window.confirm(`Delete ${sensor.name} from ${v?.name||'this vehicle'}?`))return;const next={...store,sensorConfigs:(store.sensorConfigs||[]).filter(x=>String(x.id)!==String(sensor.id))};if(await setStore(next))toast('Sensor deleted.')}return <section className="page"><PageHead title="Sensors & I/O" subtitle="Select a vehicle, then add, edit or delete its sensors and manage physical I/O mappings." actions={<button className="primary" onClick={()=>setEditing({vehicleId:v?.id})} disabled={!v}><Plus/>Add Sensor</button>}/><div className="card sensorsIoPage"><label>Vehicle<select value={v?.id||''} onChange={e=>{setId(e.target.value);setShowIo(false)}}><option value="" disabled>Select vehicle</option>{vehicles.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{v?<><AssignedSensors vehicle={v} store={store} management onEdit={setEditing} onDelete={removeSensor} onMap={()=>setShowIo(true)}/>{showIo?<section className="ioManagementSection"><header><div><h2>I/O Mapping</h2><p>Advanced setup for physical DIN, AIN, DOUT, 1-Wire and reader channels.</p></div><button type="button" onClick={()=>setShowIo(false)}>Close I/O Mapping</button></header><SensorsIoPanel vehicleId={v.id} request={profileRequest} onSaved={()=>{toast('I/O mappings saved');window.dispatchEvent(new Event('inviha-refresh'))}}/></section>:null}</>:<p>Add a vehicle before configuring sensors.</p>}</div>{editing!==null&&<SensorConfigForm initial={editing} company={company} vehicles={vehicles} store={store} setStore={setStore} toast={toast} onClose={()=>setEditing(null)}/>}</section>}

const userModules=['Map','Vehicles','Drivers','Reports','Alerts','Geofences','Maintenance','Sensors','Users','Settings'];
function UserForm({initial={},company,vehicles,store,setStore,onClose,toast}){const[d,setD]=useState({role:company.settings?.defaultRole||'Viewer',status:'Active',language:'English',timezone:'Asia/Qatar',permissions:Object.fromEntries(userModules.map(x=>[x,true])),vehicleIds:[],...initial,companyId:company.id});const f=(k,v)=>setD(x=>({...x,[k]:v,...(k==='role'&&store.roleTemplates?.[company.id]?.[v]?{permissions:store.roleTemplates[company.id][v]}:{})}));async function save(e){e.preventDefault();if(!d.id&&String(d.password||'').length<12)return toast('Password must contain at least 12 characters.');if(d.id&&d.password&&String(d.password).length<12)return toast('Password must contain at least 12 characters.');try{await api.saveUser(d);await reloadUsers();toast('User saved to server');onClose()}catch(e){toast('User not saved: '+e.message)}}async function reloadUsers(){const users=await api.users();await setStore({...store,users})}return <form className="userForm" onSubmit={save}><div className="formGrid"><Field label="Full Name *"><input required value={d.name||''} onChange={e=>f('name',e.target.value)}/></Field><Field label="Role *"><select value={d.role} onChange={e=>f('role',e.target.value)}><option>Company Admin</option><option>Fleet Manager</option><option>Dispatcher</option><option>Supervisor</option><option>Viewer</option></select></Field><Field label="Email *"><input required type="email" value={d.email||''} onChange={e=>f('email',e.target.value)}/></Field><Field label="Status"><select value={d.status} onChange={e=>f('status',e.target.value)}><option>Active</option><option>Inactive</option></select></Field><Field label="Phone"><input value={d.mobile||''} onChange={e=>f('mobile',e.target.value)}/></Field><Field label="Password *"><input required={!d.id} minLength={12} type="password" value={d.password||''} onChange={e=>f('password',e.target.value)}/></Field><Field label="Language"><select value={d.language} onChange={e=>f('language',e.target.value)}><option>English</option><option>Arabic</option></select></Field><Field label="Time Zone"><input value={d.timezone} onChange={e=>f('timezone',e.target.value)}/></Field><Field label="Vehicle Access" wide><div className="checks tiles">{vehicles.map(v=><label key={v.id}><input type="checkbox" checked={(d.vehicleIds||[]).includes(v.id)} onChange={e=>f('vehicleIds',e.target.checked?[...(d.vehicleIds||[]),v.id]:(d.vehicleIds||[]).filter(x=>x!==v.id))}/>{v.name}</label>)}</div></Field><Field label="Permissions" wide><div className="checks tiles">{userModules.map(x=><label key={x}><input type="checkbox" checked={d.permissions?.[x]!==false} onChange={e=>f('permissions',{...(d.permissions||{}),[x]:e.target.checked})}/>{x}</label>)}</div></Field></div><div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="primary"><Save/>Create / Save User</button></div></form>}
function UsersPage({company,vehicles,store,setStore,toast}){const[editing,setEditing]=useState(null),[selected,setSelected]=useState(null),[q,setQ]=useState(''),[role,setRole]=useState('all'),[roleSettings,setRoleSettings]=useState(false),[userTab,setUserTab]=useState('details');const rows=store.users.filter(u=>u.companyId===company.id&&(role==='all'||u.role===role)&&(!q||[u.name,u.email,u.role].join(' ').toLowerCase().includes(q.toLowerCase())));function resetPwd(u){toast('Open Edit and enter a new password, then save it to the server.')}return <section className="page"><PageHead title="Users" subtitle="Manage company users, roles, vehicle access, and permissions." actions={<><button onClick={()=>setRoleSettings(true)}><Settings/>Role Settings</button><button className="primary" onClick={()=>setEditing({})}><Plus/>Add User</button></>}/><div className="splitPage"><div className="tableCard"><div className="filters"><div className="searchBox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search users..."/></div><select value={role} onChange={e=>setRole(e.target.value)}><option value="all">All Roles</option><option>Company Admin</option><option>Fleet Manager</option><option>Dispatcher</option><option>Supervisor</option><option>Viewer</option></select></div><table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Vehicle Access</th><th>Actions</th></tr></thead><tbody>{rows.map((u,i)=><tr key={u.id}><td>{i+1}</td><td><div className="entity"><span className="avatarSmall">{u.name?.[0]||'U'}</span><b>{u.name}</b></div></td><td>{u.email}</td><td><Pill type="info">{u.role}</Pill></td><td><Pill type={u.status==='Active'?'ok':'bad'}>{u.status||'Active'}</Pill></td><td>{u.vehicleIds?.length||0}</td><td><div className="rowBtns"><button onClick={()=>setSelected(u)}><Eye/></button><button onClick={()=>setEditing(u)}><Edit3/></button><button onClick={async()=>{try{await api.saveUser({...u,status:'Inactive'});await setStore({...store,users:await api.users()});toast('Account deactivated')}catch(e){toast(e.message)}}}><Trash2/></button></div></td></tr>)}{!rows.length&&<tr><td colSpan="7"><Empty text="No company users yet"/></td></tr>}</tbody></table></div>{selected&&<Drawer title="User Details" onClose={()=>setSelected(null)}><div className="profileHead"><div className="avatarLarge">{selected.name?.[0]}</div><div><h2>{selected.name}</h2><p>{selected.email}</p></div><Pill>{selected.status}</Pill></div><div className="detailTabs"><button className={userTab==='details'?'active':''} onClick={()=>setUserTab('details')}>Details</button><button className={userTab==='permissions'?'active':''} onClick={()=>setUserTab('permissions')}>Permissions</button><button className={userTab==='activity'?'active':''} onClick={()=>setUserTab('activity')}>Activity</button></div>{userTab==='details'&&<div className="infoList"><p><UserRound/><span>Full Name</span><b>{selected.name}</b></p><p><Mail/><span>Email</span><b>{selected.email}</b></p><p><Phone/><span>Phone</span><b>{selected.mobile||'—'}</b></p><p><ShieldCheck/><span>Role</span><b>{selected.role}</b></p><p><Car/><span>Vehicles</span><b>{selected.vehicleIds?.length||0} assigned</b></p><p><Globe2/><span>Language</span><b>{selected.language}</b></p></div>}{userTab==='permissions'&&<div className="checks tiles roleChecks">{userModules.map(x=><label key={x}><input type="checkbox" readOnly checked={selected.permissions?.[x]!==false}/>{x}</label>)}</div>}{userTab==='activity'&&<div className="infoList"><p><Clock3/><span>Last Login</span><b>{selected.lastLogin?fmtDateTime(selected.lastLogin):'Not recorded'}</b></p><p><Activity/><span>Status</span><b>{selected.status||'Active'}</b></p><p><Car/><span>Vehicle Scope</span><b>{selected.vehicleIds?.length||0} vehicles</b></p></div>}<div className="drawerActions"><button onClick={()=>setEditing(selected)}><Edit3/>Edit</button><button onClick={()=>resetPwd(selected)}><KeyRound/>Reset Password</button><button className="danger" onClick={async()=>{try{await api.saveUser({...selected,status:'Inactive'});await setStore({...store,users:await api.users()});setSelected({...selected,status:'Inactive'})}catch(e){toast(e.message)}}}><Power/>Deactivate</button></div></Drawer>}</div>{editing!==null&&<Modal title={editing?.id?'Edit User':'Add User'} subtitle="Create a company user with role, vehicle access and permissions." onClose={()=>setEditing(null)} wide><UserForm initial={editing||{}} company={company} vehicles={vehicles} store={store} setStore={setStore} onClose={()=>setEditing(null)} toast={toast}/></Modal>}{roleSettings&&<Modal title="Role Settings" onClose={()=>setRoleSettings(false)}><RoleSettings company={company} store={store} setStore={setStore} onClose={()=>setRoleSettings(false)} toast={toast}/></Modal>}</section>}
function RoleSettings({company,store,setStore,onClose,toast}){const[role,setRole]=useState('Viewer'),[perms,setPerms]=useState(()=>store.roleTemplates?.[company.id]?.Viewer||Object.fromEntries(userModules.map(x=>[x,true])));useEffect(()=>setPerms(store.roleTemplates?.[company.id]?.[role]||Object.fromEntries(userModules.map(x=>[x,true]))),[role]);function save(){setStore(saveStore({...store,roleTemplates:{...store.roleTemplates,[company.id]:{...(store.roleTemplates?.[company.id]||{}),[role]:perms}}}));toast('Role template saved');onClose()}return <div><Field label="Role"><select value={role} onChange={e=>setRole(e.target.value)}><option>Fleet Manager</option><option>Dispatcher</option><option>Supervisor</option><option>Viewer</option></select></Field><div className="checks tiles roleChecks">{userModules.map(x=><label key={x}><input type="checkbox" checked={perms[x]!==false} onChange={e=>setPerms({...perms,[x]:e.target.checked})}/>{x}</label>)}</div><div className="modalActions"><button onClick={onClose}>Cancel</button><button className="primary" onClick={save}>Save Role</button></div></div>}


function AuthenticatedApp(){const[store,setStoreRaw]=useState(()=>ensureCompany(loadStore())),[devices,setDevices]=useState([]),[positions,setPositions]=useState([]),[page,setPageRaw]=useState(()=>readClientPage('company',window.location.pathname)),[selected,setSelected]=useState(null),[toast,setToast]=useState(''),[lastRefresh,setLastRefresh]=useState(null),[authUser,setAuthUser]=useState(null),[authChecked,setAuthChecked]=useState(false),[serverStateLoaded,setServerStateLoaded]=useState(false);const company=store.companies[0];const[news,setNews]=useState([]),[newsLoaded,setNewsLoaded]=useState(false);useLanguageSetting(company?.language);useEffect(()=>{if(!authUser)return;let alive=true;const syncExpiry=async()=>{try{const [co,u,remote]=await Promise.all([api.company(),api.me(),api.companyState()]);if(!alive||saving.current)return;setAuthUser(u);if(Number.isSafeInteger(Number(remote?.version)))version.current=Number(remote.version);const profile=remote?.data?.companyProfile||{},preferences=remote?.data?.companyPreferences||{};setStoreRaw(prev=>saveStore(withCompanySettingsSnapshot(prev,co?.id,profile,preferences,{expiry:co.metadata?.expiry||''})))}catch{}};const timer=setInterval(syncExpiry,30000);window.addEventListener('focus',syncExpiry);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',syncExpiry)}},[authUser?.id]);useEffect(()=>{if(!authUser)return;let active=true;const loadNews=()=>api.news().then(rows=>{if(active){setNews(Array.isArray(rows)?rows:[]);setNewsLoaded(true)}}).catch(()=>{});loadNews();const timer=setInterval(loadNews,15000);return()=>{active=false;clearInterval(timer)}},[authUser?.id]);useDriverUpdates(!!authUser);useAlertSound(store.alerts,company,serverStateLoaded);const version=useRef(0),saving=useRef(false),ruleNormalizationAttempt=useRef('');const[saveStatus,setSaveStatus]=useState('');useEffect(()=>{if(!saveStatus||/saving/i.test(saveStatus))return;const t=setTimeout(()=>setSaveStatus(''),/not saved|unable|failed/i.test(saveStatus)?8000:3000);return()=>clearTimeout(t)},[saveStatus]);const setStore=async n=>{if(authUser?.role!=='company_admin'&&(!authUser?.metadata?.displayRole||authUser.metadata.displayRole==='Viewer')){setSaveStatus('Read-only account: ask your company administrator to make changes.');return}if(saving.current){setSaveStatus('Please wait for the current save to finish.');return}if(!serverStateLoaded){setSaveStatus('Company data is not loaded. Please sign in again.');return}saving.current=true;setSaveStatus('Saving changes…');try{if(JSON.stringify(n.companies)!==JSON.stringify(store.companies)&&Object.keys(n).filter(k=>k!=='companies').every(k=>JSON.stringify(n[k])===JSON.stringify(store[k]))){const profile=await compactProfile(n.companies[0]);const r=await api.saveCompanySettings(profile);version.current=r.version;setStoreRaw(saveStore(withCompanySettingsSnapshot({...n,companies:store.companies},company.id,profile,profile.settings||{})));setSaveStatus('Saved');return true}for(const v of n.vehicles){const before=store.vehicles.find(x=>x.id===v.id);if(!before||JSON.stringify(before)!==JSON.stringify(v)){const saved=await api.saveVehicle(v,!!before);v.id=Number(saved.vehicle.id)}}for(const v of store.vehicles.filter(v=>!n.vehicles.some(x=>x.id===v.id)))await api.deleteVehicle(v.id);const {vehicles,companies,users,...shared}=n;shared.companyProfile=companies[0];try{const r=await api.saveCompanyState(shared,version.current);version.current=r.version;setStoreRaw(n);setSaveStatus('Saved');return true}catch(e){if(e.status!==409)throw e;const latest=await api.companyState();if(!latest?.data||!Number.isSafeInteger(Number(latest.version)))throw e;const changedKeys=Object.keys(shared).filter(key=>key!=='companyProfile'&&JSON.stringify(shared[key]??null)!==JSON.stringify(store[key]??null));const merged={...latest.data};for(const key of changedKeys)merged[key]=shared[key];const retry=await api.saveCompanyState(merged,Number(latest.version));version.current=retry.version;const next={...n};for(const key of Object.keys(latest.data||{}))if(!changedKeys.includes(key))next[key]=latest.data[key];for(const key of changedKeys)next[key]=merged[key];setStoreRaw(next);setSaveStatus('Saved');return true}}catch(e){setSaveStatus('Not saved: '+e.message);return false}finally{saving.current=false}};
const saveSettingsSection=async(candidate,section)=>{if(authUser?.role!=='company_admin')throw new Error('Company administrator access is required.');if(saving.current)throw new Error('Please wait for the current save to finish.');if(!serverStateLoaded)throw new Error('Company data is not loaded. Please sign in again.');const compactCandidate=await compactProfile(candidate);const payload=Object.fromEntries([...section.rootKeys.map(key=>[key,compactCandidate[key]??'']),...section.settingKeys.map(key=>[key,compactCandidate.settings?.[key]])]);saving.current=true;setSaveStatus('Saving settings…');try{const result=await api.saveCompanySettingsSection(section.id,payload,version.current);version.current=Number(result.version);const profile=result.profile||{},preferences=result.preferences||{};const saved={...company,...profile,id:company.id,settings:{...(company.settings||{}),...(profile.settings||{}),...preferences}};setStoreRaw(previous=>saveStore(withCompanySettingsSnapshot(previous,company.id,profile,preferences)));setSaveStatus('Settings saved');return saved}catch(error){if(error.status===409&&error.body){version.current=Number(error.body.version)||version.current;setStoreRaw(previous=>saveStore(withCompanySettingsSnapshot(previous,company.id,error.body.profile||{},error.body.preferences||{})))}setSaveStatus('Not saved: '+error.message);throw error}finally{saving.current=false}};
const exportCompanyData=()=>{const data=buildCompanyExport(store,company);fileDownload(`${company.name||'company'}-data.json`,JSON.stringify(data,null,2),'application/json');toastMsg('Company archive downloaded')};
useEffect(()=>{if(!serverStateLoaded||authUser?.role!=='company_admin')return;const current=store.alertRules||[],normalized=normalizeAlertRules(current);if(normalized.length===current.length){ruleNormalizationAttempt.current='';return}const signature=JSON.stringify(current);if(saving.current||ruleNormalizationAttempt.current===signature)return;ruleNormalizationAttempt.current=signature;void setStore({...store,alertRules:normalized})},[serverStateLoaded,authUser?.role,store.alertRules,saveStatus]);useEffect(()=>{if(!authToken()){setAuthChecked(true);return}Promise.all([api.me(),api.company(),api.companyState()]).then(([u,co,remote])=>{if(u.role==='super_admin')throw new Error('wrong_role');setAuthUser(u);setStoreRaw(prev=>{version.current=remote?.version||0;if(remote.branding)localStorage.setItem(GLOBAL_BRAND_KEY,JSON.stringify(remote.branding));const fresh=ensureCompany(loadStore());const base={...fresh,...(remote?.data||{}),headerBanner:remote?.headerBanner||null,companyUserCount:remote?.userCount??0};return saveStore({...base,companies:co?[{...(base.companies?.[0]||{}),...(co.metadata||{}),...(base.companyProfile||{}),expiry:co.metadata?.expiry||'',vehiclePermissions:Object.fromEntries([['addVehicle','Add Vehicle'],['editVehicle','Edit Vehicle'],['deleteVehicle','Delete Vehicle'],['changeImei','Change IMEI'],['changeTrackerConfiguration','Change Tracker Configuration'],['immobilizer','Immobilizer']].map(([k,label])=>[k,co.metadata?.vehiclePermissions?.[label]===true])),id:Number(co.id),name:base.companyProfile?.name||co.name,email:base.companyProfile?.email||co.email,status:co.status,settings:{...(base.companies?.[0]?.settings||{}),...(base.companyProfile?.settings||{}),...(base.companyPreferences||{})}}]:base.companies})});setServerStateLoaded(true)}).catch(()=>{setAuthToken('');setServerStateLoaded(false)}).finally(()=>setAuthChecked(true))},[]);const toastMsg=x=>{setToast(x);setTimeout(()=>setToast(''),2200)};const posBy=useMemo(()=>Object.fromEntries(positions.map(p=>[String(p.deviceId),p])),[positions]);useEffect(()=>{if(company&&store.vehicles.some(v=>!v.companyId)&&store.companies.length===1){setStore(saveStore({...store,vehicles:store.vehicles.map(v=>v.companyId? v:{...v,companyId:company.id})}))}},[]);const [statusNow,setStatusNow]=useState(Date.now());useEffect(()=>{const t=setInterval(()=>setStatusNow(Date.now()),5000);return()=>clearInterval(t)},[]);const refreshing=useRef(false);function applyVehicleRows(vs,usersOverride){if(!Array.isArray(vs))return;const d=vs.filter(v=>v.live_access!==false&&v.traccar_device_id!=null).map(v=>({id:v.traccar_device_id,name:v.name,uniqueId:v.imei,status:v.connection_status||v.device_status,lastUpdate:v.last_update,currentDriver:v.current_driver}));const p=vs.filter(v=>v.live_access!==false&&v.traccar_device_id!=null).map(v=>({current_driver:v.current_driver,telemetry:v.telemetry,mapped_io:v.mapped_io,deviceId:v.traccar_device_id,communicationTime:v.last_update,address:v.address||'',latitude:v.latitude,longitude:v.longitude,altitude:v.altitude??null,course:v.course??null,speed:v.speed_kph==null?null:Number(v.speed_kph)/1.852,valid:v.position_valid,serverTime:v.position_time||v.last_update,deviceTime:v.device_time,fixTime:v.fix_time,protocol:v.protocol,attributes:{...(v.attributes||{}),ignition:v.ignition,motion:v.motion}}));setDevices(d);setPositions(p);if(company){const mapped=vs.map(v=>({id:Number(v.id),companyId:Number(v.company_id),deviceId:v.traccar_device_id,name:v.name||'Vehicle',plate:v.plate_number||'',imei:v.imei||'',...(v.metadata||{}),expiryDate:v.expiration_date?String(v.expiration_date).slice(0,10):'',expirationDate:v.expiration_date?String(v.expiration_date).slice(0,10):'',expiry:v.expiration_date?String(v.expiration_date).slice(0,10):'',unlimited:!v.expiration_date,expired:v.expired===true,liveAccess:v.live_access!==false,accessStatus:v.access_status||'active',accessMessage:v.access_message||'',category:v.metadata?.category||'Car',make:v.metadata?.make||'',model:v.metadata?.model||'',deviceModel:v.device_model||'',deviceModelId:v.device_model_id,trackingType:v.tracking_type||'Normal',protocol:v.protocol||'GT06',group:v.metadata?.group||'',status:v.active===false?'Inactive':'Active'}));setStoreRaw(prev=>saveStore({...prev,vehicles:mapped,...(Array.isArray(usersOverride)?{users:usersOverride}:{})}))}setLastRefresh(new Date())}async function refresh(){if(!authUser||refreshing.current)return;refreshing.current=true;try{const[vs,users,policy,remote]=await Promise.all([api.vehicles(),api.users().catch(()=>[]),api.trackingPolicy(),saving.current?Promise.resolve(null):api.companyState()]);applyVehicleRows(vs,users);if(remote&&!saving.current){version.current=remote.version;setStoreRaw(prev=>{const remoteData=remote.data||{},policyPreferences=policy?.enabled?{offlineMinutes:policy.offlineMinutes,untrackedMinutes:policy.untrackedMinutes}:{};const next={...prev,...remoteData,...(remote.headerBanner!==undefined?{headerBanner:remote.headerBanner}:{}),vehicles:prev.vehicles,users:prev.users};return saveStore(withCompanySettingsSnapshot(next,company.id,remoteData.companyProfile||{}, {...(remoteData.companyPreferences||{}),...policyPreferences}))})}}catch{/* Keep the last received positions. The stream reconnects only after a real connection drop. */}finally{refreshing.current=false}}useEffect(()=>{if(!authUser)return;let alive=true,stopStream=()=>{},safetyTimer=null;refresh().then(()=>{if(!alive)return;stopStream=subscribeVehicles(rows=>applyVehicleRows(rows),connected=>{if(!connected)setLastRefresh(x=>x)});safetyTimer=setInterval(()=>api.vehicles().then(rows=>{if(alive)applyVehicleRows(rows)}).catch(()=>{}),30000)});const manualRefresh=()=>refresh();window.addEventListener('inviha-refresh',manualRefresh);return()=>{alive=false;clearInterval(safetyTimer);stopStream();window.removeEventListener('inviha-refresh',manualRefresh)}},[authUser?.id,company?.id]);const companyVehicles=useMemo(()=>{const locals=store.vehicles.filter(v=>v.companyId===company?.id);return locals.map(l=>{const d=devices.find(x=>String(x.id)===String(l.deviceId)),p=d?posBy[String(d.id)]:null,driver=store.drivers.find(x=>x.companyId===company.id&&String(x.assignedVehicleId)===String(l.id));const expired=l.expired===true||l.liveAccess===false||l.accessStatus==='expired';return{id:l.id,local:l,deviceId:d?.id||l.deviceId||'',lastUpdate:d?.lastUpdate||p?.communicationTime||null,name:l.name||d?.name||'Vehicle',plate:l.plate||'',make:l.make||'',model:l.model||'',category:l.category||'Car',group:l.group||'',imei:d?.uniqueId||l.imei||'',protocol:l.protocol||d?.protocol||p?.protocol||'GT06',deviceModel:l.deviceModel||l.model||d?.deviceModel||'',position:expired?null:p,state:expired?'expired':stateOf(d,p,company?.settings?.offlineMinutes||300,company?.settings?.noSignalMinutes||5,company?.settings?.untrackedMinutes),speed:expired?0:kmh(p),expired,liveAccess:l.liveAccess!==false,accessMessage:l.accessMessage||'',driverName:expired?'Not available':d?.currentDriver?.name||'—',currentDriver:d?.currentDriver||null,assignedDriverName:driver?.name||'',device:d}})},[store.vehicles,store.drivers,devices,posBy,company?.id,company?.settings?.offlineMinutes,company?.settings?.untrackedMinutes,statusNow]);useEffect(()=>{if(selected){const n=companyVehicles.find(v=>v.id===selected.id);if(n?.expired){setSelected(null);setToast(n.accessMessage||'Vehicle subscription expired. Please renew to continue live tracking.')}else if(n)setSelected(n)}},[positions]);useEffect(()=>{const show=()=>setToast('New alert received. Open Alert Settings and click Test Sound to enable audio.');window.addEventListener('inviha-audio-error',show);return()=>window.removeEventListener('inviha-audio-error',show)},[]);const unread=unreadAlertCount(store.alerts,company?.id);const markNewsRead=async id=>{setNews(rows=>rows.map(item=>String(item.id)===String(id)?{...item,read:true}:item));try{await api.markNewsRead(id)}catch{}};const newsUnread=news.filter(item=>!item.read).length;function setPage(p){if(p==='alerts'&&company){const hasUnread=store.alerts.some(a=>String(a.companyId)===String(company.id)&&!a.read);if(hasUnread)setStoreRaw(saveStore({...store,alerts:store.alerts.map(a=>String(a.companyId)===String(company.id)?{...a,read:true}:a)}))}pushClientPage('company',p);setPageRaw(p);window.scrollTo(0,0)}useEffect(()=>{const pop=()=>{setPageRaw(readClientPage('company',window.location.pathname));window.scrollTo(0,0)};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);useEffect(()=>{const go=e=>setPage(e.detail);window.addEventListener('inviha-page',go);return()=>window.removeEventListener('inviha-page',go)},[]);let content;const common={company,vehicles:companyVehicles,store,setStore,toast:toastMsg,allDevices:devices,userRole:authUser?.role};if(page==='dashboard')content=<DashboardPage {...common} posBy={posBy} setPage={setPage}/>;else if(page==='news')content=<NewsPage news={news} onMarkRead={markNewsRead}/>;else if(page==='map')content=<MapPage {...common} selected={selected} setSelected={setSelected} setPage={setPage} alerts={dedupeAlerts(store.alerts.filter(a=>String(a.companyId)===String(company.id)))}/>;else if(page==='playback')content=<Playback {...common} selected={selected}/>;else if(page==='vehicles')content=<VehiclesPage {...common} selected={selected} setSelected={setSelected} setPage={setPage}/>;else if(page==='commands')content=<CommandsPage {...common}/>;else if(page==='immobilizer')content=<ImmobilizerPage {...common}/>;else if(page==='drivers')content=<DriversPage {...common} setPage={setPage}/>;else if(page==='reports')content=<ReportsPage {...common}/>;else if(page==='alerts')content=<AlertsManagerPage {...common}/>;else if(page==='geofences')content=<GeofencesPage {...common}/>;else if(page==='poi')content=<LocationManagerPage kind="poi" {...common}/>;else if(page==='parking')content=<LocationManagerPage kind="parking" {...common}/>;else if(page==='profile')content=<ProfilePage company={company} setPage={setPage} accountExpiry={authUser?.metadata?.expirationDate}/>;else if(page==='maintenance')content=<MaintenancePage {...common}/>;else if(page==='language')content=<LanguagePreferences value={company.language} onSave={language=>setStore(updateRow(store,'companies',company.id,{...company,language}))}/>;else if(page==='sensors')content=<SensorsPage {...common}/>;else if(page==='logistics')content=<LogisticsPlaceholder title="Logistics" description="Manage logistics operations and delivery workflows."/>;else if(page==='delivery')content=<LogisticsPlaceholder title="Delivery" description="Track delivery assignments and status." icon={Route}/>;else if(page==='live-video')content=<LogisticsPlaceholder title="Live Video" description="Monitor delivery vehicle cameras live." icon={Play}/>;else if(page==='users')content=<UsersPage {...common}/>;else content=<CompanySettingsPage company={company} counts={{users:store.users.filter(row=>String(row.companyId)===String(company.id)).length}} onNavigate={setPage} onSaveSection={saveSettingsSection} onExportData={exportCompanyData} readOnly={authUser?.role!=='company_admin'}/>;if(!authChecked)return <BrandLoading label="Loading secure session"/>;if(!authUser)return <CompanyLogin company={company} onReady={async u=>{setAuthUser(u);try{const[co,remote]=await Promise.all([api.company(),api.companyState()]);setStoreRaw(prev=>{version.current=remote?.version||0;if(remote.branding)localStorage.setItem(GLOBAL_BRAND_KEY,JSON.stringify(remote.branding));const fresh=ensureCompany(loadStore());const base={...fresh,...(remote?.data||{}),headerBanner:remote?.headerBanner||null,companyUserCount:remote?.userCount??0};return saveStore({...base,companies:co?[{...(base.companies?.[0]||{}),...(co.metadata||{}),...(base.companyProfile||{}),expiry:co.metadata?.expiry||'',vehiclePermissions:Object.fromEntries([['addVehicle','Add Vehicle'],['editVehicle','Edit Vehicle'],['deleteVehicle','Delete Vehicle'],['changeImei','Change IMEI'],['changeTrackerConfiguration','Change Tracker Configuration'],['immobilizer','Immobilizer']].map(([k,label])=>[k,co.metadata?.vehiclePermissions?.[label]===true])),id:Number(co.id),name:base.companyProfile?.name||co.name,email:base.companyProfile?.email||co.email,status:co.status,settings:{...(base.companies?.[0]?.settings||{}),...(base.companyProfile?.settings||{}),...(base.companyPreferences||{})}}]:base.companies})});setServerStateLoaded(true)}catch{setServerStateLoaded(false);setAuthUser(null);setAuthToken('');setToast('Unable to load company data. Please sign in again.')} }}/>;const doLogout=async()=>{try{await api.logout()}catch{}setAuthToken('');setAuthUser(null);setServerStateLoaded(false);setStoreRaw(ensureCompany(loadStore()));setDevices([]);setPositions([])};return <><Shell company={company} page={page} setPage={setPage} alertCount={unread} newsCount={newsUnread} headerBanner={store.headerBanner} vehicles={companyVehicles} news={news} onContactSuperAdmin={()=>{window.location.href=`mailto:${readGlobalBranding().supportEmail||'support@inviha.com'}?subject=Vehicle%20expiry%20support`}} onLogout={doLogout}>{authUser.role==='company_user'&&(!authUser.metadata?.displayRole||authUser.metadata.displayRole==='Viewer')&&<div className="saveStatus">Read-only access. Changes require a company administrator.</div>}{content}<AlertPopups alerts={store.alerts} rules={store.alertRules} company={company} ready={serverStateLoaded} onOpen={()=>setPage('alerts')}/><NewsPopups news={news} onMarkRead={markNewsRead} onOpen={()=>setPage('news')}/><Toast t={/not saved|unable|failed/i.test(saveStatus)?saveStatus:toast||saveStatus}/></Shell><ExportDialogHost/></>}



const commandTemplates={gt06:[['Status','STATUS#'],['Parameters','PARAM#'],['Server settings','SERVER#'],['Reset','RESET#']],teltonika:[['Device info','getinfo'],['Current status','getstatus'],['I/O values','getio'],['Version','getver']]};



export default function App(){
 const path=window.location.pathname.replace(/\/+$/,'')||'/';
 if(path==='/privacy-policy')return <PrivacyPolicyPage/>;
 if(path==='/data-deletion')return <DataDeletionPage/>;
 return <AuthenticatedApp/>;
}

