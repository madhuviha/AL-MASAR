import React,{useEffect,useMemo,useRef,useState} from 'react';
import {
  Bell,Building2,Check,ChevronRight,Database,Download,Globe2,
  Image as ImageIcon,Info,Layers3,Lock,MapPinned,RefreshCw,Save,Settings2,ShieldCheck,
  SlidersHorizontal,Trash2,Upload,UserCog,Users
} from 'lucide-react';
import './company-settings-page.css';
import {changedKeys,mergeRemoteWithLocalEdits,mergeSection,retainConflicts,sectionValue,settingsEqual} from './company-settings-merge.mjs';

const DEFAULT_SETTINGS={
  refreshSeconds:5,
  freshnessSeconds:120,
  untrackedMinutes:15,
  noSignalMinutes:5,
  offlineMinutes:300,
  speedUnit:'km/h',
  distanceUnit:'km',
  fuelUnit:'L',
  mapStyle:'road',
  dateFormat:'DD-MM-YYYY',
  timeFormat:'24h',
  sessionTimeout:60,
  defaultRole:'Viewer',
  alertInApp:true,
  alertEmail:false,
  alertSound:true,
  alertVolume:70,
  geofenceRadius:500,
  maintenanceReminderDays:7,
  sensorMissingText:'Not available',
  offHoursFrom:'17:00',
  offHoursTo:'07:00',
  showVehicleLabels:true,
  clusterMarkers:true,
  showGeofences:true,
  showPoiParking:true
};

export const COMPANY_SETTINGS_SECTIONS=[
  {id:'profile',label:'Company Profile',description:'Company identity and contact details',icon:Building2,rootKeys:['name','email','phone','address'],settingKeys:[]},
  {id:'branding',label:'Branding & Reports',description:'Logos used across the company portal and reports',icon:ImageIcon,rootKeys:['logoData','collapsedLogoData','faviconData'],settingKeys:[]},
  {id:'region',label:'Region & Units',description:'Company language and reference time zone',icon:Globe2,rootKeys:['timezone','language'],settingKeys:[]},
  {id:'trackingMap',label:'Tracking & Map',description:'Live status timing and default map layers',icon:MapPinned,rootKeys:[],settingKeys:['freshnessSeconds','untrackedMinutes','noSignalMinutes','offlineMinutes','showGeofences','showPoiParking']},
  {id:'alerts',label:'Alerts & Safety',description:'Speed, schedules and web alert sound',icon:Bell,rootKeys:[],settingKeys:['fleetSpeedLimit','overspeedKmh','offHoursFrom','offHoursTo','alertSound','alertVolume']},
  {id:'featureDefaults',label:'Feature Defaults',description:'Defaults for new geofences and services',icon:SlidersHorizontal,rootKeys:[],settingKeys:['geofenceRadius','maintenanceReminderDays']},
  {id:'usersAccess',label:'Users & Access',description:'New-user defaults and permissions',icon:UserCog,rootKeys:[],settingKeys:['defaultRole']},
  {id:'data',label:'Data Management',description:'Export company records safely',icon:Database,rootKeys:[],settingKeys:[]}
];

const clone=value=>JSON.parse(JSON.stringify(value||{}));
const normalizeCompany=company=>({...clone(company),settings:{...DEFAULT_SETTINGS,...clone(company?.settings)}});
const sectionById=id=>COMPANY_SETTINGS_SECTIONS.find(section=>section.id===id)||COMPANY_SETTINGS_SECTIONS[0];
const same=settingsEqual;

export function companySettingsSectionValue(company,sectionId){
  return sectionValue(company,sectionById(sectionId));
}

export function mergeCompanySettingsSection(base,source,sectionId){
  return mergeSection(base,source,sectionById(sectionId));
}

function changedSectionKeys(base,draft,sectionId){
  return changedKeys(base,draft,sectionById(sectionId));
}

function mergeRemoteCompanyWithLocalEdits(previousBaseline,previousDraft,remote){
  return mergeRemoteWithLocalEdits(previousBaseline,previousDraft,remote,COMPANY_SETTINGS_SECTIONS.filter(section=>section.id!=='data'));
}

function Field({label,hint,wide=false,children}){
  return <label className={`csv2-field${wide?' csv2-fieldWide':''}`}><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}

function Toggle({checked,onChange,label,hint,disabled}){
  return <label className="csv2-toggleRow"><span><b>{label}</b>{hint&&<small>{hint}</small>}</span><input type="checkbox" checked={!!checked} onChange={event=>onChange(event.target.checked)} disabled={disabled}/><i aria-hidden="true"/></label>;
}

function InfoPanel({icon:Icon=Info,title,children,tone=''}){
  return <aside className={`csv2-infoPanel ${tone}`}><Icon/><div><b>{title}</b><p>{children}</p></div></aside>;
}

function UploadCard({title,description,value,onChange,accept='image/png,image/jpeg,image/webp,image/svg+xml',compact=false,disabled,onError,maxBytes=1_400_000,maxLabel='1.4 MB'}){
  const input=useRef(null);
  const read=file=>{
    if(!file)return;
    if(file.size>maxBytes){onError?.(`Choose an image smaller than ${maxLabel}.`);return}
    const reader=new FileReader();
    reader.onload=()=>onChange(String(reader.result||''));
    reader.onerror=()=>onError?.('This image could not be read.');
    reader.readAsDataURL(file);
  };
  return <article className="csv2-uploadCard">
    <div className={`csv2-imagePreview${compact?' compact':''}`}>{value?<img src={value} alt={`${title} preview`}/>:<ImageIcon/>}</div>
    <div className="csv2-uploadCopy"><b>{title}</b><p>{description}</p><div><button type="button" onClick={()=>input.current?.click()} disabled={disabled}><Upload/> {value?'Replace':'Upload'}</button>{value&&<button type="button" className="csv2-textDanger" onClick={()=>onChange('')} disabled={disabled}><Trash2/> Remove</button>}</div></div>
    <input ref={input} hidden type="file" accept={accept} onChange={event=>{read(event.target.files?.[0]);event.target.value=''}}/>
  </article>;
}

function ProfileSection({draft,setRoot,disabled}){
  return <div className="csv2-formGrid">
    <Field label="Company name *"><input required value={draft.name||''} onChange={event=>setRoot('name',event.target.value)} disabled={disabled}/></Field>
    <Field label="Company email"><input type="email" value={draft.email||''} onChange={event=>setRoot('email',event.target.value)} disabled={disabled}/></Field>
    <Field label="Phone number"><input type="tel" value={draft.phone||''} onChange={event=>setRoot('phone',event.target.value)} disabled={disabled}/></Field>
    <Field label="Company address" wide><textarea rows="4" value={draft.address||''} onChange={event=>setRoot('address',event.target.value)} disabled={disabled}/></Field>
  </div>;
}

function BrandingSection({draft,setRoot,setSetting,disabled,onError}){
  return <div className="csv2-sectionStack">
    <div className="csv2-uploadGrid">
      <UploadCard title="Main company logo" description="Used in company navigation and reports." value={draft.logoData} onChange={value=>setRoot('logoData',value)} disabled={disabled} onError={onError}/>
      <UploadCard title="Collapsed sidebar icon" description="Square mark shown when navigation is closed." compact value={draft.collapsedLogoData} onChange={value=>setRoot('collapsedLogoData',value)} disabled={disabled} onError={onError}/>
      <UploadCard title="Browser favicon" description="Small icon displayed in the browser tab." compact value={draft.faviconData} onChange={value=>setRoot('faviconData',value)} accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml" disabled={disabled} onError={onError} maxBytes={700_000} maxLabel="700 KB"/>
    </div>
    <div className="csv2-brandPreview"><div className="csv2-brandPreviewLogo">{draft.logoData?<img src={draft.logoData} alt="Report logo preview"/>:<Building2/>}</div><div><span>REPORT PREVIEW</span><strong>Fleet Management Report</strong><p>{draft.name||'Company name'}{draft.address?` · ${draft.address}`:''}</p></div></div>
  </div>;
}

function RegionSection({draft,setRoot,setSetting,disabled}){
  return <div className="csv2-sectionStack">
    <div className="csv2-formGrid">
      <Field label="Company reference time zone" hint="Shown in the company profile. Live timestamps follow the platform time zone set by Super Admin."><input value={draft.timezone||'Asia/Qatar'} onChange={event=>setRoot('timezone',event.target.value)} disabled={disabled}/></Field>
      <Field label="Interface language"><select value={draft.language||'English'} onChange={event=>setRoot('language',event.target.value)} disabled={disabled}><option>English</option><option>Arabic</option><option>Hindi</option></select></Field>
    </div>
    <InfoPanel title="Platform formats">Date, time, speed, distance, fuel and currency formats are controlled by Super Admin so dashboards and exported reports stay consistent.</InfoPanel>
  </div>;
}

function TrackingSection({draft,setSetting,disabled}){
  const s=draft.settings;
  return <div className="csv2-sectionStack">
    <div className="csv2-formGrid">
      <Field label="Communication freshness (seconds)"><input type="number" min="5" max="3600" value={s.freshnessSeconds} onChange={event=>setSetting('freshnessSeconds',Number(event.target.value))} disabled={disabled}/></Field>
      <Field label="Currently untracked after (minutes)"><input type="number" min="1" max="43200" value={s.untrackedMinutes} onChange={event=>setSetting('untrackedMinutes',Number(event.target.value))} disabled={disabled}/></Field>
      <Field label="No GPS signal after (minutes)"><input type="number" min="1" max="1440" value={s.noSignalMinutes} onChange={event=>setSetting('noSignalMinutes',Number(event.target.value))} disabled={disabled}/></Field>
      <Field label="Offline after no communication (minutes)" hint="300 minutes equals 5 hours. Invalid GPS does not mean offline."><input type="number" min="1" max="43200" value={s.offlineMinutes} onChange={event=>setSetting('offlineMinutes',event.target.value===''?'':Number(event.target.value))} disabled={disabled}/></Field>
    </div>
    <div className="csv2-subsection"><div className="csv2-subsectionTitle"><Layers3/><div><h3>Default map layers</h3><p>Choose what company users see when the map opens.</p></div></div><div className="csv2-toggleGrid">
      <Toggle label="Geofences" hint="Show company geofence boundaries." checked={s.showGeofences!==false} onChange={value=>setSetting('showGeofences',value)} disabled={disabled}/>
      <Toggle label="POI and parking" hint="Show saved places and parking locations." checked={s.showPoiParking!==false} onChange={value=>setSetting('showPoiParking',value)} disabled={disabled}/>
    </div></div>
    <InfoPanel title="Platform tracking policy">A policy enforced by Super Admin can override the untracked and offline durations for every company.</InfoPanel>
  </div>;
}

function AlertsSection({draft,setSetting,disabled,onNavigate}){
  const s=draft.settings,limit=s.fleetSpeedLimit??s.overspeedKmh??100;
  const setLimit=value=>{setSetting('fleetSpeedLimit',value);setSetting('overspeedKmh',value)};
  return <div className="csv2-sectionStack">
    <div className="csv2-formGrid">
      <Field label="Fleet speed limit (km/h)" hint="A vehicle or alert rule can use its own limit."><input type="number" min="1" max="250" value={limit} onChange={event=>setLimit(Number(event.target.value))} disabled={disabled}/></Field>
      <div/>
      <Field label="Off-hours start"><input type="time" value={s.offHoursFrom} onChange={event=>setSetting('offHoursFrom',event.target.value)} disabled={disabled}/></Field>
      <Field label="Off-hours end"><input type="time" value={s.offHoursTo} onChange={event=>setSetting('offHoursTo',event.target.value)} disabled={disabled}/></Field>
    </div>
    <div className="csv2-subsection"><div className="csv2-subsectionTitle"><Bell/><div><h3>Web alert sound</h3><p>Control sound played for new alerts while the web application is open.</p></div></div><div className="csv2-toggleGrid">
      <Toggle label="Alert sound" hint="Play a sound for new web alerts." checked={s.alertSound} onChange={value=>setSetting('alertSound',value)} disabled={disabled}/>
    </div>{s.alertSound&&<Field label={`Alert volume · ${s.alertVolume}%`} wide><input className="csv2-range" type="range" min="0" max="100" value={s.alertVolume} onChange={event=>setSetting('alertVolume',Number(event.target.value))} disabled={disabled}/></Field>}</div>
    <div className="csv2-inlineAction"><div><ShieldCheck/><span><b>Advanced alert rules</b><small>Set alert type, vehicle, schedule and delivery channel.</small></span></div><button type="button" onClick={()=>onNavigate?.('alerts')}>Manage alert rules <ChevronRight/></button></div>
  </div>;
}

function FeaturesSection({draft,setSetting,disabled,onNavigate}){
  const s=draft.settings;
  return <div className="csv2-sectionStack"><div className="csv2-formGrid">
    <Field label="Default geofence radius (metres)" hint="Used when a new circle geofence is created."><input type="number" min="10" value={s.geofenceRadius} onChange={event=>setSetting('geofenceRadius',Number(event.target.value))} disabled={disabled}/></Field>
    <Field label="Maintenance reminder (days)" hint="Default advance warning for a due service."><input type="number" min="0" value={s.maintenanceReminderDays} onChange={event=>setSetting('maintenanceReminderDays',Number(event.target.value))} disabled={disabled}/></Field>
  </div><InfoPanel title="Applied to new records">These values prefill newly created geofences and maintenance services. Existing records keep their saved values.</InfoPanel><div className="csv2-shortcuts"><button type="button" onClick={()=>onNavigate?.('geofences')}>Manage geofences <ChevronRight/></button><button type="button" onClick={()=>onNavigate?.('maintenance')}>Manage maintenance <ChevronRight/></button><button type="button" onClick={()=>onNavigate?.('sensors')}>Manage sensors <ChevronRight/></button></div></div>;
}

function AccessSection({draft,setSetting,disabled,onNavigate,counts}){
  const s=draft.settings;
  return <div className="csv2-sectionStack"><div className="csv2-accessSummary"><div><Users/><span><b>{counts?.users??'—'}</b><small>Company users</small></span></div><div><ShieldCheck/><span><b>{s.defaultRole}</b><small>New-user default role</small></span></div></div><div className="csv2-formGrid"><Field label="Default role for new users" hint="This role is preselected when a company administrator creates a user."><select value={s.defaultRole} onChange={event=>setSetting('defaultRole',event.target.value)} disabled={disabled}><option>Viewer</option><option>Supervisor</option><option>Dispatcher</option><option>Fleet Manager</option></select></Field></div><div className="csv2-inlineAction"><div><UserCog/><span><b>User accounts and permissions</b><small>Add users, reset access and assign roles.</small></span></div><button type="button" onClick={()=>onNavigate?.('users')}>Manage users <ChevronRight/></button></div></div>;
}

function DataSection({onExportData,disabled,lastBackupAt}){
  return <div className="csv2-dataGrid"><article><span className="csv2-dataIcon"><Download/></span><h3>Export company data</h3><p>Download this company’s configuration and records as a JSON archive for safekeeping.</p><small>{lastBackupAt?`Last export: ${new Date(lastBackupAt).toLocaleString()}`:'The download is saved by your browser.'}</small><button type="button" onClick={onExportData} disabled={disabled||!onExportData}><Download/> Export company data</button></article><article className="csv2-dataDisabled"><span className="csv2-dataIcon"><Lock/></span><h3>Restore company data</h3><p>Restore is temporarily unavailable while we add an all-or-nothing safety check for vehicle and company records.</p><small>Your current company data cannot be changed from this card.</small><button type="button" disabled><Lock/> Restore unavailable</button></article><InfoPanel title="Company scope" tone="csv2-dataNotice">Exports contain this company’s data only. User passwords, platform server settings, diagnostics and global backups are excluded.</InfoPanel></div>;
}

function SectionContent({active,draft,setRoot,setSetting,disabled,onError,onNavigate,counts,onExportData,lastBackupAt}){
  if(active==='profile')return <ProfileSection {...{draft,setRoot,disabled}}/>;
  if(active==='branding')return <BrandingSection {...{draft,setRoot,setSetting,disabled,onError}}/>;
  if(active==='region')return <RegionSection {...{draft,setRoot,setSetting,disabled}}/>;
  if(active==='trackingMap')return <TrackingSection {...{draft,setSetting,disabled}}/>;
  if(active==='alerts')return <AlertsSection {...{draft,setSetting,disabled,onNavigate}}/>;
  if(active==='featureDefaults')return <FeaturesSection {...{draft,setSetting,disabled,onNavigate}}/>;
  if(active==='usersAccess')return <AccessSection {...{draft,setSetting,disabled,onNavigate,counts}}/>;
  return <DataSection {...{onExportData,disabled,lastBackupAt}}/>;
}

/**
 * New Company Admin settings UI.
 * onSaveSection receives a safe company object containing changes from only the
 * selected section, plus metadata as its second argument. Return false to keep
 * the section dirty, or return the saved company object to apply server values.
 */
export default function CompanySettingsPage({
  company,
  onSaveSection,
  onExportData,
  onNavigate,
  counts,
  readOnly=false,
  lastBackupAt,
  initialSection='profile'
}){
  const normalized=useMemo(()=>normalizeCompany(company),[company]);
  const signature=JSON.stringify(normalized);
  const[baseline,setBaseline]=useState(normalized),[draft,setDraft]=useState(normalized),[active,setActive]=useState(sectionById(initialSection).id);
  const[status,setStatus]=useState({}),[error,setError]=useState(''),[conflicts,setConflicts]=useState({});

  useEffect(()=>{
    if(String(baseline?.id)!==String(normalized?.id)){
      setBaseline(normalized);setDraft(normalized);setStatus({});setConflicts({});setError('');return;
    }
    const merged=mergeRemoteCompanyWithLocalEdits(baseline,draft,normalized);
    setBaseline(normalized);setDraft(merged.nextDraft);setConflicts(current=>retainConflicts(current,merged.conflicts));
    if(Object.keys(merged.conflicts).length)setError('Newer settings were received while you were editing. Discard the affected section, review the latest values, and apply your change again.');
  },[company?.id,signature]);

  const dirtyBySection=useMemo(()=>Object.fromEntries(COMPANY_SETTINGS_SECTIONS.map(section=>[
    section.id,section.id!=='data'&&!same(companySettingsSectionValue(baseline,section.id),companySettingsSectionValue(draft,section.id))
  ])),[baseline,draft]);
  const section=sectionById(active),dirty=dirtyBySection[active];
  const setRoot=(key,value)=>{setDraft(current=>({...current,[key]:value}));setStatus(current=>({...current,[active]:''}));if(!conflicts[active]?.length)setError('')};
  const setSetting=(key,value)=>{setDraft(current=>({...current,settings:{...current.settings,[key]:value}}));setStatus(current=>({...current,[active]:''}));if(!conflicts[active]?.length)setError('')};

  const discard=()=>{setDraft(current=>mergeCompanySettingsSection(current,baseline,active));setStatus(current=>({...current,[active]:'discarded'}));setConflicts(current=>{const next={...current};delete next[active];return next});setError('')};
  const validate=()=>{
    if(active==='profile'&&!String(draft.name||'').trim())return'Company name is required.';
    if(active==='trackingMap'&&(!Number.isFinite(Number(draft.settings.offlineMinutes))||Number(draft.settings.offlineMinutes)<1||Number(draft.settings.offlineMinutes)>43200))return'Choose an offline timeout between 1 minute and 30 days.';
    return'';
  };
  const save=async()=>{
    if(conflicts[active]?.length){setError('This section changed on the server while you were editing. Discard it, review the latest values, and then make your change again.');return}
    const validation=validate();if(validation){setError(validation);return}
    const candidate=mergeCompanySettingsSection(baseline,draft,active);
    const changed=changedSectionKeys(baseline,draft,active);
    setStatus(current=>({...current,[active]:'saving'}));setError('');
    try{
      const result=onSaveSection?await onSaveSection(candidate,{id:active,rootKeys:changed.rootKeys,settingKeys:changed.settingKeys}):candidate;
      if(result===false){setStatus(current=>({...current,[active]:'error'}));setError('This section was not saved. Please try again.');return}
      const source=result&&typeof result==='object'?normalizeCompany(result):candidate;
      setBaseline(current=>mergeCompanySettingsSection(current,source,active));
      setDraft(current=>mergeCompanySettingsSection(current,source,active));
      setConflicts(current=>{const next={...current};delete next[active];return next});
      setStatus(current=>({...current,[active]:'saved'}));
      window.setTimeout(()=>setStatus(current=>current[active]==='saved'?{...current,[active]:''}:current),2600);
    }catch(saveError){setStatus(current=>({...current,[active]:'error'}));setError(saveError?.message||'This section was not saved. Please try again.')}
  };
  const saving=status[active]==='saving';

  return <section className="companySettingsV2">
    <header className="csv2-pageHead"><div><span className="csv2-kicker"><Settings2/> COMPANY SETTINGS</span><h1>Settings</h1><p>Manage company details, fleet preferences and access in one place.</p></div><div className="csv2-pageStatus"><ShieldCheck/><span><b>Company scope</b><small>Changes apply only to {draft.name||'this company'}</small></span></div></header>
    <div className="csv2-shell">
      <nav className="csv2-nav" aria-label="Settings categories">
        <div className="csv2-navIntro"><b>Configuration</b><small>Select a category to edit</small></div>
        {COMPANY_SETTINGS_SECTIONS.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={active===item.id?'active':''} aria-current={active===item.id?'page':undefined} onClick={()=>{if(item.id===active)return;if(dirty){setError('Save or discard the current section before opening another category.');return}setActive(item.id);setError('')}}><Icon/><span><b>{item.label}</b><small>{item.description}</small></span><i className={dirtyBySection[item.id]?'isDirty':''} title={dirtyBySection[item.id]?'Unsaved changes':undefined}/><ChevronRight/></button>})}
        <InfoPanel icon={ShieldCheck} title="Protected settings">Global branding, domains and server connections are managed by Super Admin.</InfoPanel>
      </nav>
      <main className="csv2-content">
        <div className="csv2-contentHead"><div className="csv2-contentIcon"><section.icon/></div><div><h2>{section.label}</h2><p>{section.description}</p></div>{active!=='data'&&<span className={`csv2-state ${dirty?'dirty':status[active]||''}`}>{saving?'Saving…':status[active]==='saved'?'Saved':dirty?'Unsaved changes':'Up to date'}</span>}</div>
        {readOnly&&<InfoPanel icon={ShieldCheck} title="Read-only access">Ask a company administrator to make changes to these settings.</InfoPanel>}
        {error&&<div className="csv2-error" role="alert"><Info/><span>{error}</span></div>}
        <div className="csv2-contentBody"><SectionContent {...{active,draft,setRoot,setSetting,disabled:readOnly||saving,onError:setError,onNavigate,counts,onExportData,lastBackupAt}}/></div>
        {active!=='data'&&<footer className="csv2-saveBar"><div>{dirty?<><span className="csv2-dirtyDot"/><span><b>Unsaved changes</b><small>Save this section before leaving if you want to keep them.</small></span></>:<><Check/><span><b>{status[active]==='saved'?'Section saved':'No pending changes'}</b><small>Other settings categories are saved separately.</small></span></>}</div><div><button type="button" className="csv2-secondary" onClick={discard} disabled={!dirty||saving||readOnly}>Discard changes</button><button type="button" className="csv2-save" onClick={save} disabled={!dirty||saving||readOnly}>{saving?<RefreshCw className="csv2-spin"/>:<Save/>}{saving?'Saving…':'Save section'}</button></div></footer>}
      </main>
    </div>
  </section>;
}
