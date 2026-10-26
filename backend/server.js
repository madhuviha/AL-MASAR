import {initializePush} from './mobile-push.mjs';
import {dedupeAlertEvents,normalizeAlertRules} from './alert-rules.mjs';
import {initializeDeviceProfiles,registerDeviceProfileRoutes,resolveDeviceProfile,saveIoMappings} from './device-profiles.mjs';
import {mapDeviceTelemetry,validateIoMappings} from './device-profile-rules.mjs';
import {validateCompanyFields,companyRequiredFields} from './company-field-policy.mjs';
import {EventEmitter} from 'node:events';
import {readFile,mkdir} from 'node:fs/promises';
import {syncDrivers,currentDrivers,enrichDriverHistory} from './driver-identification.mjs';
import {unidentified,identityKeys} from './driver-identity.mjs';
import {startDriverWorker} from './driver-worker.mjs';
const driverUpdates=new EventEmitter();driverUpdates.setMaxListeners(0);
import {immobilizerCommand} from './immobilizer.mjs';
import {recentAlerts} from './alert-retention.mjs';
import {deriveTelemetry} from './telemetry.mjs';
import {normalizeProtocolAttributes,normalizeProtocolPosition} from './protocol-telemetry.mjs';
import {companyDates} from './company-dates.mjs';
import {defaultBragSettings,sanitizeBragSettings,buildBragRecord,bragSummary} from './brag-report.mjs';
import {runSchedules} from './scheduler.mjs';
import {startRuleWorker} from './worker.mjs';
import {resolveLivePosition} from './live-position.mjs';
import {createGoogleGeocoder,geocodeCacheKey,readableAddress,validGeocodeCoordinates} from './google-geocoding.mjs';
import {normalizeMapAccess,availableMaps,defaultBaseMap,mapAccessDefinitions} from './map-access.mjs';
import {normalizeCommandRequest,companyUserCanAccessVehicle,commandPermissionGranted,CommandValidationError} from './command-policy.mjs';
import {preparePlatformSettingsPatch,PlatformSettingsValidationError} from './platform-settings.mjs';
import {prepareCompanySettingsPatch,prepareLegacyCompanySettingsPatch,CompanySettingsValidationError} from './company-settings.mjs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import pg from 'pg';
import crypto from 'crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

dotenv.config();
const { Pool } = pg;
const app = express();
app.get('/api/public/branding',async(_req,res)=>{try{const r=await pool.query('SELECT data FROM platform_state WHERE id=1');const s=r.rows[0]?.data?.settings||{},hasBackground=String(s.loginBackgroundData||'').startsWith('data:image/'),transparency=Math.max(0,Math.min(70,Number(s.loginPanelTransparency??18)));res.set('Cache-Control','no-store').json({logoData:s.loginLogoData||s.brandLogoData||'',collapsedLogoData:s.collapsedLogoData||'',faviconData:s.faviconData||'',loginBackgroundData:'',loginBackgroundUrl:hasBackground?'/inviha-api/api/public/login-background':'',loginPanelTransparency:transparency,templateColor:s.templateColor||'#0aa65f',loginTextColor:s.loginTextColor||'#0b2748',loginBackgroundColor:s.loginBackgroundColor||'#f4f8fb',loginPanelColor:s.loginPanelColor||'#ffffff',welcomeText:s.welcomeText||'Welcome to MASAR TRACK',bottomText:s.bottomText||'2026 © INVIHA Technologies',portalTitle:s.portalTitle||'Fleet Management',companyBrowserTitle:s.companyBrowserTitle||'Fleet Management',googlePlayUrl:s.googlePlayUrl||'',appStoreUrl:s.appStoreUrl||'',supportEmail:s.supportEmail||'',supportPhone:s.supportPhone||'',whatsappNumber:s.whatsappNumber||'',timezone:s.timezone||'Asia/Qatar',dateFormat:s.dateFormat||'DD-MM-YYYY',timeFormat:s.timeFormat||'24h',captchaProvider:s.captchaProvider&&s.captchaProvider!=='None'&&s.captchaSiteKey&&s.captchaSecretKey?s.captchaProvider:'None',captchaSiteKey:s.captchaProvider&&s.captchaProvider!=='None'&&s.captchaSecretKey?String(s.captchaSiteKey||''):''})}catch{res.status(503).json({error:'branding_unavailable'})}});
app.get('/api/public/login-background',async(req,res)=>{try{const r=await pool.query('SELECT data FROM platform_state WHERE id=1'),value=String(r.rows[0]?.data?.settings?.loginBackgroundData||''),match=/^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);if(!match)return res.status(204).set('Cache-Control','no-store').end();const body=Buffer.from(match[2].replace(/\s/g,''),'base64'),etag='"'+crypto.createHash('sha256').update(body).digest('hex')+'"';res.set({'Cache-Control':'public,max-age=0,must-revalidate','ETag':etag,'Content-Type':match[1],'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'});if(req.headers['if-none-match']===etag)return res.status(304).end();res.send(body)}catch{res.status(503).set('Cache-Control','no-store').end()}});
// Browser access is restricted to the portals we control. Native tracker and
// mobile clients do not send an Origin header, so this does not block them.
const configuredOrigins=String(process.env.ALLOWED_ORIGINS||'https://track.inviha.com,https://admin.inviha.com,https://vehicletracking.effy.qa,http://localhost:5173,http://localhost:4173')
  .split(',').map(value=>value.trim()).filter(Boolean);
const allowedOrigins=new Set(configuredOrigins);
app.use(cors({origin(origin,callback){
  if(!origin||allowedOrigins.has('*')||allowedOrigins.has(origin))return callback(null,true);
  return callback(new Error('origin_not_allowed'));
},credentials:false}));
app.use(express.json({ limit: '8mb' }));

const PORT = Number(process.env.PORT || 3001);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const livePool = process.env.TRACCAR_DATABASE_URL ? new Pool({ connectionString: process.env.TRACCAR_DATABASE_URL }) : null;
const OFFLINE_MINUTES = Number(process.env.OFFLINE_MINUTES || 10);
const execFileAsync=promisify(execFile);

app.set('trust proxy','loopback');
if(typeof app.disable==='function')app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(self)');
  if(req.path.startsWith('/api/')){
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Pragma','no-cache');
  }
  if(process.env.ENABLE_HSTS==='true')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  next();
});
app.use((req,res,next)=>{
  if(!req.path.startsWith('/api/')||req.path==='/api/auth/login'||req.path==='/api/auth/setup-status')return next();
  let responseError='';
  const sendJson=res.json.bind(res);
  res.json=body=>{if(body&&typeof body==='object'&&typeof body.error==='string')responseError=body.error.slice(0,300);return sendJson(body)};
  res.once('finish',()=>{
    if(res.statusCode<400)return;
    const vehicleMatch=req.path.match(/^\/api\/vehicles\/(\d+)/),vehicleId=vehicleMatch?Number(vehicleMatch[1]):null;
    const level=res.statusCode>=500?'error':'warning',message=responseError||`HTTP ${res.statusCode}`;
    pool.query(`INSERT INTO diagnostic_events(level,source,event_type,message,company_id,user_id,vehicle_id,source_ip,http_status,detail)
      VALUES($1,'backend-api','api_error',$2,$3,$4,$5,$6,$7,$8::jsonb)`,[
      level,message,req.user?.company_id||null,req.user?.id||null,Number.isSafeInteger(vehicleId)?vehicleId:null,req.ip||null,res.statusCode,
      JSON.stringify({method:req.method,path:req.path})
    ]).catch(error=>console.error('Diagnostic event recording unavailable:',error.message));
  });
  next();
});

const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);
const LOGIN_WINDOW_MS=15*60*1000;
const LOGIN_MAX_FAILURES=8;
const loginFailures=new Map();
const loginKey=(req,email)=>`${req.ip||'unknown'}:${String(email||'').toLowerCase()}`;
const pruneLoginFailures=now=>{for(const [key,value] of loginFailures)if(value.resetAt<=now)loginFailures.delete(key)};
const loginBlocked=(req,email)=>{
  const now=Date.now();pruneLoginFailures(now);const value=loginFailures.get(loginKey(req,email));
  return Boolean(value&&value.failures>=LOGIN_MAX_FAILURES&&value.resetAt>now);
};
const recordLoginFailure=(req,email)=>{
  const now=Date.now(),key=loginKey(req,email),value=loginFailures.get(key);
  if(!value||value.resetAt<=now)loginFailures.set(key,{failures:1,resetAt:now+LOGIN_WINDOW_MS});
  else value.failures+=1;
};
const clearLoginFailures=(req,email)=>loginFailures.delete(loginKey(req,email));
const TRACKER_PORT = Number(process.env.TRACKER_PORT || 5023);
const tokenHash = token => crypto.createHash('sha256').update(String(token||'')).digest('hex');
const hashPassword = (password, salt=crypto.randomBytes(16).toString('hex')) => {
  const hash=crypto.scryptSync(String(password),salt,64).toString('hex'); return `${salt}:${hash}`;
};
const verifyPassword = (password, stored) => {
  try { const [salt,hash]=String(stored||'').split(':'); if(!salt||!hash)return false; const test=crypto.scryptSync(String(password),salt,64); return crypto.timingSafeEqual(test,Buffer.from(hash,'hex')); } catch { return false; }
};
async function authUserFromReq(req){
  const h=String(req.headers.authorization||''); const token=h.startsWith('Bearer ')?h.slice(7).trim():''; if(!token)return null;
  const {rows}=await pool.query(`SELECT u.id,u.company_id,u.name,u.email,u.role,u.status,u.metadata,s.expires_at FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[tokenHash(token)]);
  return rows[0]||null;
}
async function requireAuth(req,res,next){ try{const u=await authUserFromReq(req);if(!u)return res.status(401).json({error:'not_authenticated'});if(String(u.status).toLowerCase()!=='active')return res.status(403).json({error:'account_disabled'});if(u.company_id){const c=await pool.query('SELECT status FROM companies WHERE id=$1',[u.company_id]);if(!c.rows[0]||String(c.rows[0].status).toLowerCase()!=='active')return res.status(403).json({error:'company_disabled'});}req.user=u;next()}catch(e){console.error(e);res.status(500).json({error:'auth_failed'})} }
const requireSuper=(req,res,next)=> req.user?.role==='super_admin'?next():res.status(403).json({error:'super_admin_required'});

const retentionDays=value=>Math.min(3650,Math.max(1,Number(value)||30));
const retentionBackupDir=()=>process.env.RETENTION_BACKUP_DIR||'/var/backups/inviha-retention';
async function retentionDevices(companyId){
  const {rows}=await pool.query('SELECT id,name,traccar_device_id FROM vehicles WHERE company_id=$1 AND active<>FALSE ORDER BY id',[companyId]);
  return rows.filter(x=>Number.isSafeInteger(Number(x.traccar_device_id))).map(x=>({...x,traccar_device_id:Number(x.traccar_device_id)}));
}
async function trackingRetentionCounts(deviceIds,cutoff){
  if(!livePool||!deviceIds.length)return {positions:0,events:0};
  const [positions,events]=await Promise.all([
    livePool.query('SELECT COUNT(*)::bigint AS count FROM tc_positions WHERE deviceid=ANY($1::bigint[]) AND fixtime<$2',[deviceIds,cutoff]),
    livePool.query('SELECT COUNT(*)::bigint AS count FROM tc_events WHERE deviceid=ANY($1::bigint[]) AND eventtime<$2',[deviceIds,cutoff])
  ]);
  return {positions:Number(positions.rows[0]?.count||0),events:Number(events.rows[0]?.count||0)};
}
async function createRetentionBackup(companyId,companyName){
  if(!process.env.TRACCAR_DATABASE_URL)throw Error('tracking_database_not_configured');
  await mkdir(retentionBackupDir(),{recursive:true});
  const safe=String(companyName||companyId).replace(/[^a-z0-9_-]+/gi,'-').slice(0,50)||String(companyId);
  const file=`${retentionBackupDir()}/company-${companyId}-${safe}-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`;
  await execFileAsync('pg_dump',['--format=custom','--file',file,process.env.TRACCAR_DATABASE_URL],{timeout:300000,maxBuffer:1024*1024});
  return file;
}
async function deleteTrackingRows(deviceIds,cutoff){
  if(!livePool||!deviceIds.length)return {positions:0,events:0};
  let positions=0,events=0;
  for(;;){const r=await livePool.query('WITH doomed AS (SELECT id FROM tc_positions WHERE deviceid=ANY($1::bigint[]) AND fixtime<$2 ORDER BY id LIMIT 5000) DELETE FROM tc_positions p USING doomed d WHERE p.id=d.id',[deviceIds,cutoff]);positions+=r.rowCount||0;if(!r.rowCount)break;}
  for(;;){const r=await livePool.query('WITH doomed AS (SELECT id FROM tc_events WHERE deviceid=ANY($1::bigint[]) AND eventtime<$2 ORDER BY id LIMIT 5000) DELETE FROM tc_events e USING doomed d WHERE e.id=d.id',[deviceIds,cutoff]);events+=r.rowCount||0;if(!r.rowCount)break;}
  return {positions,events};
}


const trackingApi = axios.create({
  baseURL: process.env.TRACCAR_BASE_URL || 'http://127.0.0.1:8082',
  auth: { username: process.env.TRACCAR_ADMIN_EMAIL || '', password: process.env.TRACCAR_ADMIN_PASSWORD || '' },
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});
const reverseGeocoder=createGoogleGeocoder({pool,http:axios});

const cleanString = v => typeof v === 'string' ? v.trim() : '';
const parseAttrs = v => {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return {}; }
};
const timeMs = value => { const t=new Date(value||0).getTime(); return Number.isFinite(t)?t:0; };
const newestTimestamp = live => {
  // GPS fix and device clock times do not indicate a packet reached the server.
  const vals=[live?.lastupdate,live?.lastUpdate,live?.servertime,live?.serverTime].filter(Boolean);
  if(!vals.length)return null;
  return vals.sort((a,b)=>timeMs(b)-timeMs(a))[0];
};
const isStale = value => {
  const t=timeMs(value);
  return !t || Date.now() - t > OFFLINE_MINUTES * 60 * 1000;
};
const connectionStatus = live => !live || isStale(newestTimestamp(live)) ? 'offline' : 'online';
const VEHICLE_RENEWAL_MESSAGE='Vehicle subscription expired. Please renew to continue live tracking.';
const rejectExpiredVehicle=res=>res.status(403).json({error:'vehicle_expired',message:VEHICLE_RENEWAL_MESSAGE});

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1 FROM rule_engine_state LIMIT 0'); await pool.query('SELECT 1 FROM scheduled_report_runs LIMIT 0'); res.json({ ok:true, service:'inviha-track-backend',release:'v4' }); }
  catch { res.status(500).json({ ok:false, error:'database_unavailable' }); }
});


app.get('/api/auth/setup-status', async (_req,res)=>{
  try{const {rows}=await pool.query("SELECT COUNT(*)::int AS n FROM auth_users WHERE role='super_admin'");res.json({setupRequired:rows[0].n===0})}
  catch(e){console.error(e);res.status(500).json({error:'setup_status_failed'})}
});
app.post('/api/auth/setup-super-admin', async (req,res)=>{
  const client=await pool.connect(); try{
    const {rows}=await client.query("SELECT COUNT(*)::int AS n FROM auth_users WHERE role='super_admin'"); if(rows[0].n>0)return res.status(409).json({error:'super_admin_already_exists'});
    const name=cleanString(req.body.name)||'Super Admin',email=cleanString(req.body.email).toLowerCase(),password=String(req.body.password||'');
    if(!email||password.length<8)return res.status(400).json({error:'email_and_password_required'});
    const out=await client.query("INSERT INTO auth_users(name,email,password_hash,role,status) VALUES($1,$2,$3,'super_admin','active') RETURNING id,name,email,role,status",[name,email,hashPassword(password)]);
    res.status(201).json(out.rows[0]);
  }catch(e){console.error(e);res.status(500).json({error:'setup_failed'})}finally{client.release()}
});
async function verifyLoginCaptcha(token,remoteIp){
 const row=(await pool.query("SELECT COALESCE(data->'settings','{}'::jsonb) AS settings FROM platform_state WHERE id=1")).rows[0],settings=row?.settings||{},provider=String(settings.captchaProvider||'None'),secret=String(settings.captchaSecretKey||'').trim(),siteKey=String(settings.captchaSiteKey||'').trim();
 if(provider==='None'||!secret||!siteKey)return true;
 if(!String(token||'').trim())return false;
 const url=provider==='Cloudflare Turnstile'?'https://challenges.cloudflare.com/turnstile/v0/siteverify':provider==='Google reCAPTCHA'?'https://www.google.com/recaptcha/api/siteverify':'';
 if(!url)return false;
 try{const body=new URLSearchParams({secret,response:String(token).trim(),remoteip:String(remoteIp||'')});const response=await axios.post(url,body.toString(),{headers:{'Content-Type':'application/x-www-form-urlencoded'},timeout:8000});return response.data?.success===true}catch{return false}
}
app.post('/api/auth/login', async (req,res)=>{
  try{
    const email=cleanString(req.body.email).toLowerCase(),password=String(req.body.password||'');
    if(loginBlocked(req,email)){
      res.set('Retry-After',String(Math.ceil(LOGIN_WINDOW_MS/1000)));
      return res.status(429).json({error:'too_many_login_attempts',message:'Too many failed sign-in attempts. Try again later.'});
    }
    if(!await verifyLoginCaptcha(req.body.captchaToken,req.ip)){recordLoginFailure(req,email);return res.status(403).json({error:'captcha_required',message:'Complete the security check and try again.'})}
    const {rows}=await pool.query('SELECT * FROM auth_users WHERE lower(email)=lower($1) LIMIT 1',[email]); const u=rows[0];
    if(!u||!verifyPassword(password,u.password_hash)){recordLoginFailure(req,email);return res.status(401).json({error:'invalid_credentials'});}
    if(String(u.status).toLowerCase()!=='active')return res.status(403).json({error:'account_disabled'});
    clearLoginFailures(req,email);
    const token=crypto.randomBytes(32).toString('hex'),expires=new Date(Date.now()+SESSION_DAYS*86400000);
    await pool.query('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[tokenHash(token),u.id,expires]);
    res.json({token,user:{id:u.id,companyId:u.company_id,name:u.name,email:u.email,role:u.role,status:u.status,metadata:u.metadata||{}},expiresAt:expires.toISOString()});
  }catch(e){console.error(e);res.status(500).json({error:'login_failed'})}
});
app.get('/api/auth/me',requireAuth,(req,res)=>res.json({id:req.user.id,companyId:req.user.company_id,name:req.user.name,email:req.user.email,role:req.user.role,status:req.user.status,metadata:req.user.metadata||{}}));

// News & Updates are stored in platform_state so announcements remain shared
// between the Super Admin and company portals without a separate migration.
const newsAudienceMatches=(item,user)=>{
  if(item.audience==='all')return true;
  if(item.audience==='company')return String(item.companyId)===String(user.company_id);
  if(item.audience==='user')return String(item.userId)===String(user.id);
  return false;
};
const readNewsState=async()=>{
  const r=await pool.query('SELECT data,version FROM platform_state WHERE id=1');
  return {data:r.rows[0]?.data&&typeof r.rows[0].data==='object'?r.rows[0].data:{},version:Number(r.rows[0]?.version||0)};
};
app.get('/api/news',requireAuth,async(req,res)=>{
  try{
    const {data}=await readNewsState();
    const now=Date.now();
    const all=Array.isArray(data.newsUpdates)?data.newsUpdates:[];
    const rows=all.filter(item=>{
      const starts=item.startsAt?Date.parse(item.startsAt):0;
      const expires=item.expiresAt?Date.parse(item.expiresAt):Infinity;
      return starts<=now&&expires>now&&(req.user.role==='super_admin'||newsAudienceMatches(item,req.user));
    }).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
    res.set('Cache-Control','no-store').json(rows.map(item=>({...item,readBy:undefined,read:Array.isArray(item.readBy)&&item.readBy.includes(Number(req.user.id))})));
  }catch(e){console.error(e);res.status(500).json({error:'news_unavailable'});}
});
app.post('/api/news',requireAuth,requireSuper,async(req,res)=>{
  try{
    const kind=['announcement','image','service'].includes(req.body.kind)?req.body.kind:'announcement';
    const heading=cleanString(req.body.heading),description=cleanString(req.body.description),displayName=cleanString(req.body.displayName),slideText=cleanString(req.body.slideText),imageData=cleanString(req.body.imageData),imageUrl=cleanString(req.body.imageUrl),audience=['all','company','user'].includes(req.body.audience)?req.body.audience:'all';
    if(imageData.length>2500000)return res.status(400).json({error:'Image is too large. Choose an image smaller than 2 MB.'});
    if(kind==='image'&&!imageData&&!imageUrl)return res.status(400).json({error:'Choose an image or provide an image URL.'});
    if(kind!=='image'&&(!heading||!description))return res.status(400).json({error:'Heading and description are required for this message type.'});
    const companyId=audience==='company'&&Number.isSafeInteger(Number(req.body.companyId))?Number(req.body.companyId):null;
    const userId=audience==='user'&&Number.isSafeInteger(Number(req.body.userId))?Number(req.body.userId):null;
    if(audience==='company'&&!companyId)return res.status(400).json({error:'Choose a company.'});
    if(audience==='user'&&!userId)return res.status(400).json({error:'Choose a user.'});
    const startsAt=req.body.startsAt?new Date(req.body.startsAt).toISOString():new Date().toISOString();
    const expiresAt=req.body.expiresAt?new Date(req.body.expiresAt).toISOString():null;
    if(expiresAt&&Date.parse(expiresAt)<=Date.parse(startsAt))return res.status(400).json({error:'Expiry must be after the start time.'});
    const current=await readNewsState(),news=Array.isArray(current.data.newsUpdates)?current.data.newsUpdates:[];
    const item={id:crypto.randomUUID(),kind,heading,description,displayName:displayName||null,slideText:slideText||null,imageData:imageData||null,imageUrl:imageUrl||null,audience,companyId,userId,startsAt,expiresAt,createdAt:new Date().toISOString(),createdBy:Number(req.user.id),readBy:[]};
    const next={...current.data,newsUpdates:[item,...news].slice(0,500)};
    const saved=await pool.query(`UPDATE platform_state SET data=$1::jsonb,version=version+1,updated_at=NOW() WHERE id=1 AND version=$2 RETURNING version`,[JSON.stringify(next),current.version]);
    if(!saved.rowCount)return res.status(409).json({error:'Another administrator changed announcements. Refresh and try again.'});
    res.status(201).json(item);
  }catch(e){console.error(e);res.status(500).json({error:'news_save_failed'});}
});
app.delete('/api/news/:id',requireAuth,requireSuper,async(req,res)=>{
  try{
    const current=await readNewsState(),id=String(req.params.id),news=Array.isArray(current.data.newsUpdates)?current.data.newsUpdates:[];
    if(!news.some(item=>String(item.id)===id))return res.status(404).json({error:'news_not_found'});
    const next={...current.data,newsUpdates:news.filter(item=>String(item.id)!==id)};
    const saved=await pool.query(`UPDATE platform_state SET data=$1::jsonb,version=version+1,updated_at=NOW() WHERE id=1 AND version=$2 RETURNING version`,[JSON.stringify(next),current.version]);
    if(!saved.rowCount)return res.status(409).json({error:'News changed. Refresh and try again.'});
    res.json({ok:true});
  }catch(e){console.error(e);res.status(500).json({error:'news_delete_failed'});}
});
app.post('/api/news/:id/read',requireAuth,async(req,res)=>{
  try{
    const current=await readNewsState(),news=Array.isArray(current.data.newsUpdates)?current.data.newsUpdates:[],id=String(req.params.id);
    const nextNews=news.map(item=>String(item.id)===id?{...item,readBy:[...new Set([...(Array.isArray(item.readBy)?item.readBy:[]),Number(req.user.id)])]}:item);
    const next={...current.data,newsUpdates:nextNews};
    const saved=await pool.query(`UPDATE platform_state SET data=$1::jsonb,version=version+1,updated_at=NOW() WHERE id=1 AND version=$2 RETURNING version`,[JSON.stringify(next),current.version]);
    if(!saved.rowCount)return res.status(409).json({error:'News changed. Refresh and try again.'});
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'news_read_failed'});}
});
app.post('/api/auth/logout',requireAuth,async(req,res)=>{try{const token=String(req.headers.authorization||'').replace(/^Bearer\s+/,'');await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash(token)]);res.json({ok:true})}catch{res.json({ok:true})}});
app.post('/api/auth/change-password',requireAuth,async(req,res)=>{const client=await pool.connect();try{const p=String(req.body.password||'');if(p.length<12)return res.status(400).json({error:'password_too_short',message:'Use a password of at least 12 characters.'});const currentHash=tokenHash(String(req.headers.authorization||'').replace(/^Bearer\s+/,''));await client.query('BEGIN');await client.query('UPDATE auth_users SET password_hash=$1,updated_at=NOW() WHERE id=$2',[hashPassword(p),req.user.id]);await client.query('DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash<>$2',[req.user.id,currentHash]);await client.query('COMMIT');res.json({ok:true,otherSessionsRevoked:true})}catch(e){try{await client.query('ROLLBACK')}catch{}console.error(e);res.status(500).json({error:'password_change_failed'})}finally{client.release()}});
app.get('/api/company/me',requireAuth,async(req,res)=>{try{if(!req.user.company_id)return res.json(null);const {rows}=await pool.query('SELECT id,name,email,status,metadata FROM companies WHERE id=$1',[req.user.company_id]);res.json(rows[0]||null)}catch(e){res.status(500).json({error:'company_failed'})}});

app.post('/api/companies/:id/support-login',requireAuth,requireSuper,async(req,res)=>{
 try {
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid company.'});
  const c=(await pool.query('SELECT id,status,metadata FROM companies WHERE id=$1',[id])).rows[0];
  if(!c||String(c.status).toLowerCase()!=='active')return res.status(403).json({error:'Company is not active.'});
  if(c.metadata?.supportLogin==='Blocked')return res.status(403).json({error:'Support login is blocked for this company.'});
  const u=(await pool.query("SELECT id FROM auth_users WHERE company_id=$1 AND role='company_admin' AND lower(status)='active' ORDER BY id LIMIT 1",[id])).rows[0];
  if(!u)return res.status(409).json({error:'Create an active company administrator first.'});
  const token=crypto.randomBytes(32).toString('hex'),expires=new Date(Date.now()+15*60000);
  await pool.query('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[tokenHash(token),u.id,expires]);
  console.info(JSON.stringify({event:'company_support_login',actor:req.user.id,companyId:id,userId:u.id,expiresAt:expires.toISOString()}));
  res.set('Cache-Control','no-store').json({token,expiresAt:expires.toISOString()});
 } catch(e){console.error('Company support login failed');res.status(500).json({error:'Unable to open the company account.'})}
});

app.post('/api/users/:id/support-login',requireAuth,requireSuper,async(req,res)=>{
 try{
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid user.'});
  const q=await pool.query("SELECT u.id,u.company_id,c.status AS company_status FROM auth_users u JOIN companies c ON c.id=u.company_id WHERE u.id=$1 AND lower(u.status)='active'",[id]);const u=q.rows[0];
  if(!u)return res.status(404).json({error:'Active user not found.'});if(String(u.company_status).toLowerCase()!=='active')return res.status(403).json({error:'Company is not active.'});
  const token=crypto.randomBytes(32).toString('hex'),expires=new Date(Date.now()+15*60000);await pool.query('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[tokenHash(token),u.id,expires]);
  console.info(JSON.stringify({event:'user_support_login',actor:req.user.id,companyId:u.company_id,userId:u.id,expiresAt:expires.toISOString()}));res.set('Cache-Control','no-store').json({token,expiresAt:expires.toISOString()});
 }catch(e){console.error('User support login failed');res.status(500).json({error:'Unable to open the user account.'})}
});

app.get('/api/tracking-policy',requireAuth,async(req,res)=>{try{const r=await pool.query('SELECT data FROM platform_state WHERE id=1');const s=r.rows[0]?.data?.settings||{};res.json({enabled:s.trackingPolicyEnabled===true,offlineMinutes:Number(s.offlineMinutes)||300,untrackedMinutes:Number(s.untrackedMinutes)||15})}catch{res.status(503).json({error:'Tracking settings unavailable.'})}});
app.get('/api/report-settings',requireAuth,requireSuper,async(_req,res)=>{try{const r=await pool.query('SELECT data FROM platform_state WHERE id=1');res.set('Cache-Control','no-store').json(sanitizeBragSettings(r.rows[0]?.data?.settings?.bragReport||defaultBragSettings))}catch(error){res.status(500).json({error:error.message||'Report settings are unavailable.'})}});
app.put('/api/report-settings',requireAuth,requireSuper,async(req,res)=>{try{const settings=sanitizeBragSettings(req.body);await pool.query("INSERT INTO platform_state(id,data,version) VALUES(1,jsonb_build_object('settings',jsonb_build_object('bragReport',$1::jsonb)),1) ON CONFLICT(id) DO UPDATE SET data=jsonb_set(COALESCE(platform_state.data,'{}'::jsonb),'{settings,bragReport}',$1::jsonb,true),version=platform_state.version+1,updated_at=NOW()",[JSON.stringify(settings)]);await pool.query("INSERT INTO audit_events(user_id,action,entity_type,entity_id,detail) VALUES($1,'brag_report_settings_updated','report_settings','brag',$2::jsonb)",[req.user.id,JSON.stringify({thresholds:settings.thresholds,seatbelt:settings.seatbelt,penalties:settings.penalties})]);res.json({ok:true,settings})}catch(error){res.status(400).json({error:error.message||'Report settings could not be saved.'})}});
// INVIHA_SERVER_METRICS_V1: host metrics, never available to company sessions.
let serverMetricsCache=null,serverMetricsFlight=null;
async function collectServerMetrics(){
 const os=await import('node:os'),fs=await import('node:fs/promises');
 const snapshot=()=>os.cpus().reduce((sum,cpu)=>{sum.idle+=cpu.times.idle;sum.total+=Object.values(cpu.times).reduce((a,b)=>a+b,0);return sum},{idle:0,total:0});
 const first=snapshot();await new Promise(resolve=>setTimeout(resolve,250));const second=snapshot();
 const delta=second.total-first.total,cpuPercent=delta>0?Math.max(0,Math.min(100,100*(1-(second.idle-first.idle)/delta))):null;
 let memory=null,disk=null;const unavailable=[];
 try{const info=await fs.readFile('/proc/meminfo','utf8');const value=key=>{const match=info.match(new RegExp('^'+key+':\\s+(\\d+)\\s+kB','m'));return match?Number(match[1])*1024:null};const total=value('MemTotal'),available=value('MemAvailable');if(!(total>0)||available==null)throw Error();memory={totalBytes:total,availableBytes:available,usedBytes:Math.max(0,total-available),usedPercent:100*(total-available)/total}}catch{unavailable.push('RAM usage unavailable')}
 try{const stat=await fs.statfs('/');const total=Number(stat.blocks)*Number(stat.bsize),free=Number(stat.bfree)*Number(stat.bsize),available=Number(stat.bavail)*Number(stat.bsize);if(!(total>0))throw Error();disk={mount:'/',totalBytes:total,usedBytes:Math.max(0,total-free),availableBytes:available,usedPercent:100*(total-free)/total}}catch{unavailable.push('Disk usage unavailable')}
 return {sampledAt:new Date().toISOString(),cpu:{usedPercent:cpuPercent,logicalCores:os.cpus().length,sampleMilliseconds:250},memory,disk,uptimeSeconds:os.uptime(),unavailable};
}
app.get('/api/system/metrics',requireAuth,requireSuper,async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{if(!serverMetricsCache||Date.now()-serverMetricsCache.time>5000){if(!serverMetricsFlight)serverMetricsFlight=collectServerMetrics().then(data=>{serverMetricsCache={time:Date.now(),data};return data}).finally(()=>{serverMetricsFlight=null});await serverMetricsFlight}res.json(serverMetricsCache.data)}catch{res.status(503).json({error:'Server resource metrics are temporarily unavailable.'})}
});

// INVIHA_MAP_CONFIG_V1
app.get('/api/map-config',requireAuth,async(req,res)=>{try{const r=await pool.query('SELECT data FROM platform_state WHERE id=1');const s=r.rows[0]?.data?.settings||{},userAllowed=normalizeMapAccess(req.user?.metadata?.mapAccess),globalAllowed=normalizeMapAccess(s.enabledMaps),allowed=Object.fromEntries([...mapAccessDefinitions.map(([key])=>[key,userAllowed[key]&&globalAllowed[key]]),['mapillary',userAllowed.mapillary&&globalAllowed.mapillary]]),maps=availableMaps(allowed,s),defaultBase=defaultBaseMap(s,allowed,String(req.user?.metadata?.defaultBaseMap||'')),mapillaryAllowed=allowed.mapillary;res.set('Cache-Control','private,no-store').json({provider:'Tile Map',mapillaryToken:mapillaryAllowed?String(s.mapillaryAccessToken||''):'',allowed,maps,defaultBase,center:{latitude:Number(s.mapCenterLatitude)||25.2854,longitude:Number(s.mapCenterLongitude)||51.5310},zoom:Math.max(2,Math.min(20,Number(s.mapZoom)||11)),dateFormat:s.dateFormat||'DD-MM-YYYY',timeFormat:s.timeFormat||'24h',timezone:s.timezone||'Asia/Qatar'})}catch{res.status(503).json({error:'Map settings unavailable.'})}});
app.get('/api/geocode/reverse',requireAuth,async(req,res)=>{
 try{const latitude=Number(req.query.latitude),longitude=Number(req.query.longitude);if(!validGeocodeCoordinates(latitude,longitude))return res.status(400).json({error:'invalid_coordinates'});const result=await reverseGeocoder.reverseDetailed(latitude,longitude);res.set('Cache-Control','private,no-store').json(result)}catch(error){const code=String(error.message||'geocoding_unavailable');const status=code.includes('key_missing')||code==='geocoder_not_configured'?503:code==='address_not_found'?404:502;res.status(status).json({error:code})}
});
app.get('/api/geocode/search',requireAuth,async(req,res)=>{
 try{const query=cleanString(req.query.q).slice(0,200);if(query.length<2)return res.json([]);const results=await reverseGeocoder.search(query);res.set('Cache-Control','private,no-store').json(results)}catch{res.status(502).json({error:'address_search_unavailable'})}
});
app.post('/api/geocode/cache',requireAuth,async(req,res)=>{
 try{const latitude=Number(req.body.latitude),longitude=Number(req.body.longitude),address=String(req.body.address||'').trim();if(!validGeocodeCoordinates(latitude,longitude)||!readableAddress(address))return res.status(400).json({error:'invalid_geocode_result'});const vehicles=await vehicleSnapshotFor(req.user),allowed=vehicles.some(vehicle=>vehicle.live_access!==false&&validGeocodeCoordinates(vehicle.latitude,vehicle.longitude)&&Math.abs(Number(vehicle.latitude)-latitude)<=0.00025&&Math.abs(Number(vehicle.longitude)-longitude)<=0.00025);if(!allowed)return res.status(403).json({error:'coordinates_not_assigned'});await reverseGeocoder.save(latitude,longitude,address,'browser-geocoder');res.json({ok:true,address})}catch(error){res.status(400).json({error:String(error.message||'geocode_cache_failed')})}
});

// INVIHA_ALERT_DIAGNOSTICS_V1
app.get('/api/alerts/diagnostics',requireAuth,async(req,res)=>{try{const isSuper=req.user.role==='super_admin';const r=await pool.query(`SELECT c.id,c.name,r.updated_at AS last_evaluated,COALESCE(jsonb_array_length(s.data->'alertRules'),0) AS rules,COALESCE(jsonb_array_length(s.data->'alerts'),0) AS alerts FROM companies c LEFT JOIN company_state s ON s.company_id=c.id LEFT JOIN rule_engine_state r ON r.company_id=c.id WHERE c.status='active' AND ($1::boolean OR c.id=$2)`,[isSuper,req.user.company_id||null]);res.set('Cache-Control','no-store').json({sampledAt:new Date().toISOString(),intervalSeconds:10,companies:r.rows})}catch{res.status(503).json({error:'Alert diagnostics unavailable. Check backend logs.'})}});
app.post('/api/diagnostics/client-error',requireAuth,async(req,res)=>{try{const message=cleanString(req.body?.message).slice(0,500)||'Browser application error',portal=['company','super-admin'].includes(req.body?.portal)?req.body.portal:'company',path=cleanString(req.body?.path).slice(0,500),stack=cleanString(req.body?.stack).slice(0,4000);await pool.query(`INSERT INTO diagnostic_events(level,source,event_type,message,company_id,user_id,source_ip,detail) VALUES('error',$1,'client_crash',$2,$3,$4,$5,$6::jsonb)`,[`browser-${portal}`,message,req.user.company_id||null,req.user.id,req.ip||null,JSON.stringify({path,stack})]);res.status(202).json({ok:true})}catch(error){console.error('Client error recording unavailable:',error.message);res.status(503).json({error:'diagnostic_recording_unavailable'})}});

app.get('/api/companies', requireAuth, requireSuper, async (_req,res)=>{
  try { const {rows}=await pool.query("SELECT id,name,email,status,metadata FROM companies WHERE status<>'archived' ORDER BY name"); res.json(rows); }
  catch(e){ console.error(e); res.status(500).json({error:'failed_to_list_companies'}); }
});

async function restartTrackingReceiver(){
  // No command or service name is accepted from the browser.
  try{
    await execFileAsync('systemctl',['is-active','--quiet','traccar.service'],{timeout:5000});
    await execFileAsync('systemctl',['restart','traccar.service'],{timeout:30000});
    return {runtime:'systemd',target:'traccar.service'};
  }catch{}
  const {stdout}=await execFileAsync('docker',['ps','--format','{{.ID}}\t{{.Names}}\t{{.Image}}'],{timeout:10000});
  const matches=String(stdout).split(/\r?\n/).filter(Boolean).filter(line=>/traccar/i.test(line));
  if(matches.length!==1)throw new Error(matches.length?'Multiple Traccar containers were found. Configure one tracking receiver.':'No running Traccar service or container was found.');
  const [id,name]=matches[0].split('\t');
  await execFileAsync('docker',['restart','--time','20',id],{timeout:45000});
  return {runtime:'docker',target:name||id};
}

app.post('/api/system/restart-tracking',requireAuth,requireSuper,async(req,res)=>{
  let auditId=null;
  try{
    const audit=await pool.query("INSERT INTO audit_events(user_id,action,entity_type,entity_id,detail) VALUES($1,'tracking_service_restart','system','traccar',$2::jsonb) RETURNING id",[req.user.id,JSON.stringify({requestedAt:new Date().toISOString(),status:'requested'})]);
    auditId=audit.rows[0]?.id||null;
    const restarted=await restartTrackingReceiver();
    let healthy=false,lastError='';
    for(let attempt=0;attempt<12;attempt++){
      await new Promise(resolve=>setTimeout(resolve,2000));
      try{await trackingApi.get('/api/server',{timeout:4000});healthy=true;break}catch(e){lastError=e.message}
    }
    const result={...restarted,healthy,completedAt:new Date().toISOString(),status:healthy?'running':'restart_completed_but_health_unconfirmed'};
    if(auditId)await pool.query('UPDATE audit_events SET detail=detail||$2::jsonb WHERE id=$1',[auditId,JSON.stringify(result)]);
    if(!healthy)return res.status(503).json({error:'Traccar restarted, but its API health could not be confirmed yet.',...result,lastError});
    res.json({ok:true,message:'Tracking service restarted and is responding.',...result});
  }catch(e){
    if(auditId)await pool.query('UPDATE audit_events SET detail=detail||$2::jsonb WHERE id=$1',[auditId,JSON.stringify({status:'failed',error:e.message})]).catch(()=>{});
    console.error('Tracking restart failed:',e.message);
    res.status(503).json({error:e.message||'Tracking service restart failed.'});
  }
});

app.post('/api/companies', requireAuth, requireSuper, async (req,res)=>{
  const client=await pool.connect();
  try {
    const name=cleanString(req.body.name), email=cleanString(req.body.email).toLowerCase();
    const adminName=cleanString(req.body.adminName)||`${name} Admin`, password=String(req.body.password||'');
    let metadata;try{metadata=companyDates(cleanMetadata(req.body.metadata))}catch(e){return res.status(400).json({error:e.message})}
    const fieldIssue=validateCompanyFields({...metadata,name,email,temporaryPassword:password},{creating:true});if(fieldIssue)return res.status(400).json({error:fieldIssue.message});metadata.requiredFields=companyRequiredFields(metadata.requiredFields);
    if(!name) return res.status(400).json({error:'company_name_required'});
    if(!email) return res.status(400).json({error:'admin_email_required'});
    if(password.length<8) return res.status(400).json({error:'password_minimum_8_characters'});
    await client.query('BEGIN');
    const exists=await client.query('SELECT id FROM companies WHERE lower(name)=lower($1)',[name]);
    if(exists.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'company_already_exists'});}
    const emailExists=await client.query('SELECT id FROM auth_users WHERE lower(email)=lower($1)',[email]);
    if(emailExists.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'email_already_registered'});}
    const {rows}=await client.query(`INSERT INTO companies(name,email,status) VALUES($1,$2,$3) RETURNING id,name,email,status`,[name,email,req.body.status==='suspended'?'suspended':'active']);
    const company=rows[0];
    const u=await client.query(`INSERT INTO auth_users(company_id,name,email,password_hash,role,status) VALUES($1,$2,$3,$4,'company_admin','active') RETURNING id,name,email,role,status`,[company.id,adminName,email,hashPassword(password)]);
    await client.query(`INSERT INTO company_state(company_id,data,updated_by) VALUES($1,$2::jsonb,$3) ON CONFLICT(company_id) DO NOTHING`,[company.id,JSON.stringify({}),req.user.id]);
    await client.query(`INSERT INTO audit_events(company_id,user_id,action,entity_type,entity_id,detail) VALUES($1,$2,'company_created','company',$3,$4::jsonb)`,[company.id,req.user.id,String(company.id),JSON.stringify({name,email})]);
    await client.query('UPDATE companies SET metadata=$1::jsonb WHERE id=$2',[JSON.stringify(metadata),company.id]);
    await client.query('COMMIT');
    res.status(201).json({company,admin:u.rows[0]});
  } catch(e){ try{await client.query('ROLLBACK')}catch{}; console.error(e); res.status(500).json({error:'failed_to_create_company'}); } finally { client.release(); }
});
app.put('/api/companies/:id', requireAuth, requireSuper, async (req,res)=>{
  const client=await pool.connect();
  try{
    const id=Number(req.params.id),name=cleanString(req.body.name),email=cleanString(req.body.email).toLowerCase(),adminName=cleanString(req.body.adminName)||`${name} Admin`,password=String(req.body.password||'');
    const fieldIssue=validateCompanyFields({...cleanMetadata(req.body.metadata),name,email});if(fieldIssue)return res.status(400).json({error:fieldIssue.message});
    if(!id||!name||!email)return res.status(400).json({error:'company_name_and_admin_email_required'});
    await client.query('BEGIN');
    const {rows}=await client.query(`UPDATE companies SET name=$1,email=$2,status=$3,updated_at=NOW() WHERE id=$4 RETURNING id,name,email,status`,[name,email,String(req.body.status||'active').toLowerCase(),id]);
    if(!rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'company_not_found'});}
    const au=await client.query(`SELECT id FROM auth_users WHERE company_id=$1 AND role='company_admin' ORDER BY id LIMIT 1`,[id]);
    if(au.rowCount){
      if(password && password.length<8){await client.query('ROLLBACK');return res.status(400).json({error:'password_minimum_8_characters'});}
      if(password)await client.query('DELETE FROM auth_sessions WHERE user_id=$1',[au.rows[0].id]);
      if(password) await client.query(`UPDATE auth_users SET name=$1,email=$2,password_hash=$3,status=$4,updated_at=NOW() WHERE id=$5`,[adminName,email,hashPassword(password),String(req.body.status||'active').toLowerCase()==='active'?'active':'disabled',au.rows[0].id]);
      else await client.query(`UPDATE auth_users SET name=$1,email=$2,status=$3,updated_at=NOW() WHERE id=$4`,[adminName,email,String(req.body.status||'active').toLowerCase()==='active'?'active':'disabled',au.rows[0].id]);
    } else {
      if(password.length<8){await client.query('ROLLBACK');return res.status(400).json({error:'password_required_for_company_admin'});}
      await client.query(`INSERT INTO auth_users(company_id,name,email,password_hash,role,status) VALUES($1,$2,$3,$4,'company_admin','active')`,[id,adminName,email,hashPassword(password)]);
    }
    await client.query(`INSERT INTO audit_events(company_id,user_id,action,entity_type,entity_id,detail) VALUES($1,$2,'company_updated','company',$3,$4::jsonb)`,[id,req.user.id,String(id),JSON.stringify({name,email})]);
    await client.query('UPDATE companies SET metadata=$1::jsonb WHERE id=$2',[JSON.stringify(cleanMetadata(req.body.metadata)),id]);await client.query('COMMIT');res.json(rows[0]);
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error(e);if(e.code==='23505')return res.status(409).json({error:'email_or_company_already_exists'});res.status(500).json({error:'failed_to_update_company'})}finally{client.release()}
});
app.get('/api/company/state',requireAuth,async(req,res)=>{
  if(!req.user.company_id)return res.status(403).json({error:'company_required'});
  try{const {rows}=await pool.query('SELECT data,version,updated_at FROM company_state WHERE company_id=$1',[req.user.company_id]);const result=rows[0]||{data:{},version:0,updated_at:null};const data={...result.data};if(data.alerts)data.alerts=dedupeAlertEvents(recentAlerts(data.alerts),req.user.company_id);if(data.alertRules)data.alertRules=normalizeAlertRules(data.alertRules);delete data.users;const count=await pool.query('SELECT COUNT(*)::int AS n FROM auth_users WHERE company_id=$1',[req.user.company_id]);const brandingRow=await pool.query('SELECT data FROM platform_state WHERE id=1');const platformData=brandingRow.rows[0]?.data||{};const settings=platformData.settings||{};const headerBanners=Array.isArray(platformData.headerBanners)?platformData.headerBanners:[];const headerBanner=headerBanners.find(x=>x&&x.companyId!=null&&String(x.companyId)===String(req.user.company_id))||headerBanners.find(x=>x&&x.companyId==null)||null;res.json({...result,data,userCount:count.rows[0]?.n||0,headerBanner,branding:{logoData:settings.brandLogoData||'',collapsedLogoData:settings.collapsedLogoData||'',faviconData:settings.faviconData||'',portalTitle:settings.portalTitle||'Fleet Management',companyBrowserTitle:settings.companyBrowserTitle||'Fleet Management',timezone:settings.timezone||'Asia/Qatar',dateFormat:settings.dateFormat||'DD-MM-YYYY',timeFormat:settings.timeFormat||'24h'}})}catch(e){console.error(e);res.status(500).json({error:'company_state_failed'})}
});
app.patch('/api/company/settings',requireAuth,async(req,res)=>{
 if(req.user.role!=='company_admin'||!req.user.company_id)return res.status(403).json({error:'company_admin_required',message:'Company administrator access required.'});
 try{
  const version=Number(req.body?.version),category=req.body?.category;
  if(!Number.isSafeInteger(version)||version<0)return res.status(400).json({error:'version_required'});
  const patch=prepareCompanySettingsPatch(category,req.body?.settings),keys=[...Object.keys(patch.profile),...Object.keys(patch.preferences)];
  const saved=await pool.query(`WITH saved AS (
    INSERT INTO company_state(company_id,data,version,updated_by,updated_at)
    SELECT $1,jsonb_build_object('companyProfile',$2::jsonb,'companyPreferences',$3::jsonb),1,$4,NOW()
    WHERE $5=0 OR EXISTS(SELECT 1 FROM company_state WHERE company_id=$1)
    ON CONFLICT(company_id) DO UPDATE SET
      data=jsonb_set(
        jsonb_set(COALESCE(company_state.data,'{}'::jsonb),'{companyProfile}',COALESCE(company_state.data->'companyProfile','{}'::jsonb)||$2::jsonb,true),
        '{companyPreferences}',COALESCE(company_state.data->'companyPreferences','{}'::jsonb)||$3::jsonb,true
      ),
      version=company_state.version+1,
      updated_by=$4,
      updated_at=NOW()
    WHERE company_state.version=$5
    RETURNING version,updated_at,data->'companyProfile' AS profile,data->'companyPreferences' AS preferences
   ), audit_log AS (
    INSERT INTO audit_events(company_id,user_id,action,entity_type,entity_id,detail)
    SELECT $1,$4,'company_settings_updated','company_settings',$6,$7::jsonb FROM saved
   )
   SELECT version,updated_at,profile,preferences FROM saved`,[
    req.user.company_id,JSON.stringify(patch.profile),JSON.stringify(patch.preferences),req.user.id,version,category,JSON.stringify({category,keys})
  ]);
  if(!saved.rowCount){
   const current=(await pool.query("SELECT version,updated_at,COALESCE(data->'companyProfile','{}'::jsonb) AS profile,COALESCE(data->'companyPreferences','{}'::jsonb) AS preferences FROM company_state WHERE company_id=$1",[req.user.company_id])).rows[0]||{version:0,updated_at:null,profile:{},preferences:{}};
   return res.status(409).json({error:'company_settings_conflict',message:'Another administrator changed these settings. Refresh and retry.',...current});
  }
  res.json({ok:true,category,...saved.rows[0]});
 }catch(error){
  if(error instanceof CompanySettingsValidationError)return res.status(400).json({error:error.code,message:error.message});
  console.error('Company settings patch:',error.message);
  res.status(500).json({error:'company_settings_save_failed'});
 }
});
app.put('/api/company/settings',requireAuth,async(req,res)=>{
 if(req.user.role!=='company_admin'||!req.user.company_id)return res.status(403).json({error:'Company administrator access required.'});
 try{const patch=prepareLegacyCompanySettingsPatch(req.body?.profile);const {rows}=await pool.query("INSERT INTO company_state(company_id,data,version,updated_by) VALUES($1,jsonb_build_object('companyProfile',$2::jsonb,'companyPreferences',$3::jsonb),1,$4) ON CONFLICT(company_id) DO UPDATE SET data=jsonb_set(jsonb_set(COALESCE(company_state.data,'{}'::jsonb),'{companyProfile}',COALESCE(company_state.data->'companyProfile','{}'::jsonb)||$2::jsonb,true),'{companyPreferences}',COALESCE(company_state.data->'companyPreferences','{}'::jsonb)||$3::jsonb,true),version=company_state.version+1,updated_by=$4,updated_at=NOW() RETURNING version",[req.user.company_id,JSON.stringify(patch.profile),JSON.stringify(patch.preferences),req.user.id]);res.json({ok:true,version:rows[0].version})}catch(e){if(e instanceof CompanySettingsValidationError)return res.status(400).json({error:e.code,message:e.message});console.error('Company settings save:',e.message);res.status(500).json({error:'Settings could not be stored. Check the backend log.'})}
});
app.put('/api/company/state',requireAuth,async(req,res)=>{
  if(!req.user.company_id)return res.status(403).json({error:'company_required'});
  if(req.user.role!=='company_admin'&&(!req.user.metadata?.displayRole||req.user.metadata.displayRole==='Viewer'))return res.status(403).json({error:'company_admin_required'});try{const data=req.body?.data;if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'invalid_state'});delete data.users;delete data.companies;delete data.vehicles;for(const sensor of data.sensorConfigs||[]){if(sensor.type==='RFID / iButton'||/^(driver|driver id|rfid\/?ibutton)$/i.test(sensor.name||'')){sensor.type='RFID / iButton';if(!identityKeys.includes(sensor.sourceKey))sensor.sourceKey='driverUniqueId';}}if(data.alerts)data.alerts=dedupeAlertEvents(recentAlerts(data.alerts),req.user.company_id);if(data.alertRules)data.alertRules=normalizeAlertRules(data.alertRules);const priorSensors=(await pool.query('SELECT data FROM company_state WHERE company_id=$1',[req.user.company_id])).rows[0]?.data?.sensorConfigs||[];if(JSON.stringify(priorSensors)!==JSON.stringify(data.sensorConfigs||[])){const ioCompany=(await pool.query('SELECT metadata FROM companies WHERE id=$1',[req.user.company_id])).rows[0]?.metadata;if(req.user.role!=='company_admin'||ioCompany?.vehiclePermissions?.['Sensors/I/O']!==true)return res.status(403).json({error:'Sensors/I/O permission is required to change sensor mappings.'});}if(req.user.role!=='company_admin'){const old=await pool.query('SELECT data FROM company_state WHERE company_id=$1',[req.user.company_id]);const previous=old.rows[0]?.data||{};const allowed={drivers:'Drivers',localGeofences:'Geofences',pois:'Geofences',parkingSlots:'Geofences',maintenance:'Maintenance',sensorConfigs:'Sensors',alerts:'Alerts',alertRules:'Alerts',reportSchedules:'Reports',vehicleExpenses:'Vehicles'};for(const key of new Set([...Object.keys(previous),...Object.keys(data)])){if(JSON.stringify(previous[key]??null)===JSON.stringify(data[key]??null))continue;if(!allowed[key]||req.user.metadata?.permissions?.[allowed[key]]===false){if(previous[key]===undefined)delete data[key];else data[key]=previous[key];}}}const version=Number(req.body.version);if(!Number.isSafeInteger(version)||version<0)return res.status(400).json({error:'state_version_required'});const client=await pool.connect();try{await client.query('BEGIN');const {rows}=await client.query(`INSERT INTO company_state(company_id,data,version,updated_by) VALUES($1,$2::jsonb,1,$3) ON CONFLICT(company_id) DO UPDATE SET data=EXCLUDED.data,version=company_state.version+1,updated_by=EXCLUDED.updated_by,updated_at=NOW() WHERE company_state.version=$4 RETURNING version,updated_at`,[req.user.company_id,JSON.stringify(data),req.user.id,version]);if(!rows.length){await client.query('ROLLBACK');return res.status(409).json({error:"Another user changed these records. Reload before editing again."});}await syncDrivers(client,req.user.company_id,data.drivers||[]);await client.query('COMMIT');res.json({ok:true,...rows[0]})}catch(e){await client.query('ROLLBACK');if(e.code==='23505'||/identifier|Drivers|driver.*ID/.test(e.message))return res.status(400).json({error:e.code==='23505'?'An active identifier already belongs to another driver in this company.':e.message});throw e}finally{client.release()}}catch(e){console.error(e);res.status(500).json({error:'company_state_save_failed'})}
});
app.get('/api/protocol-profiles',requireAuth,requireSuper,async(_req,res)=>{try{const {rows}=await pool.query('SELECT * FROM protocol_profiles ORDER BY display_name');res.json(rows)}catch(e){res.status(500).json({error:'protocol_profiles_failed'})}});
app.get('/api/protocol-profiles/status',requireAuth,requireSuper,async(req,res)=>{
 try{
  const [profilesResult,vehicles]=await Promise.all([
   pool.query('SELECT protocol,display_name,transport,tcp_port,udp_port,enabled,notes,updated_at FROM protocol_profiles ORDER BY display_name'),
   vehicleSnapshotFor(req.user)
  ]);
  let socketLines=[];
  try{const {stdout}=await execFileAsync('ss',['-lntuH'],{timeout:3000,maxBuffer:1024*1024});socketLines=String(stdout||'').split(/\r?\n/).filter(Boolean)}catch(error){console.error('Listening port check unavailable:',error.message)}
  const isListening=(port,transport)=>{
   if(!Number(port))return false;
   const wanted=String(transport||'').toLowerCase(),portPattern=new RegExp(`[:.]${Number(port)}\\b`);
   return socketLines.some(line=>(!wanted||line.toLowerCase().startsWith(wanted))&&portPattern.test(line));
  };
  const profiles=profilesResult.rows.map(profile=>{
   const related=vehicles.filter(vehicle=>String(vehicle.protocol||'').toLowerCase()===String(profile.protocol||'').toLowerCase());
   const tcpListening=isListening(profile.tcp_port,'tcp'),udpListening=isListening(profile.udp_port,'udp');
   const expected=[];if(profile.tcp_port)expected.push(tcpListening);if(profile.udp_port)expected.push(udpListening);
   const dates=related.map(vehicle=>new Date(vehicle.last_update||0).getTime()).filter(Number.isFinite);
   return {...profile,tcpListening,udpListening,receiverStatus:profile.enabled?(expected.length&&expected.every(Boolean)?'listening':'not_listening'):'disabled',assignedVehicles:related.length,onlineVehicles:related.filter(vehicle=>vehicle.connection_status==='online').length,lastPacketAt:dates.length?new Date(Math.max(...dates)).toISOString():null};
  });
  res.set('Cache-Control','no-store').json({checkedAt:new Date().toISOString(),socketCheckAvailable:socketLines.length>0,profiles});
 }catch(error){console.error('Protocol receiver status failed:',error.message);res.status(500).json({error:'Receiver status is temporarily unavailable.'})}
});


async function apiDevices(){ const r=await trackingApi.get('/api/devices'); return Array.isArray(r.data)?r.data:[]; }
async function apiPositions(){ const r=await trackingApi.get('/api/positions'); return Array.isArray(r.data)?r.data:[]; }

const LIVE_RAW_CACHE_MS=2500;
let liveRawCache=null,liveRawCacheAt=0,liveRawPending=null;

async function loadLiveSnapshotsRaw(){
  if (livePool) {
    try {
      const {rows}=await livePool.query(`
        SELECT d.id,d.name,d.uniqueid,d.status,d.lastupdate,d.positionid,
               p.protocol,p.latitude,p.longitude,p.speed,p.course,p.altitude,p.fixtime,p.devicetime,p.servertime,p.valid,p.attributes,
               vp.latitude AS last_valid_latitude,vp.longitude AS last_valid_longitude,
               vp.course AS last_valid_course,vp.altitude AS last_valid_altitude,
               vp.fixtime AS last_valid_fixtime,vp.devicetime AS last_valid_devicetime,vp.servertime AS last_valid_servertime
        FROM tc_devices d
        LEFT JOIN tc_positions p ON p.id=d.positionid
        LEFT JOIN LATERAL (
          SELECT latitude,longitude,course,altitude,fixtime,devicetime,servertime
          FROM tc_positions
          WHERE deviceid=d.id AND valid=TRUE
            AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
            AND (abs(latitude)>0.000001 OR abs(longitude)>0.000001)
          ORDER BY id DESC LIMIT 1
        ) vp ON p.valid=FALSE
      `);
      return { source:'database', rows };
    } catch(e){ console.error('Live DB fallback warning:', e.message); }
  }
  const [devices,positions]=await Promise.all([apiDevices(),apiPositions()]);
  const pos=new Map(positions.map(p=>[String(p.deviceId),p]));
  return { source:'api', rows:devices.map(d=>({
    id:d.id,name:d.name,uniqueid:d.uniqueId,status:d.status,lastupdate:d.lastUpdate,positionid:d.positionId,
    ...(pos.get(String(d.id))||{}),id:d.id
  })) };
}

async function readLiveSnapshotsRaw(){
 const now=Date.now();
 if(liveRawCache&&now-liveRawCacheAt<LIVE_RAW_CACHE_MS)return liveRawCache;
 if(liveRawPending)return liveRawPending;
 liveRawPending=loadLiveSnapshotsRaw()
  .then(snapshot=>{liveRawCache=snapshot;liveRawCacheAt=Date.now();return snapshot})
  .finally(()=>{liveRawPending=null});
 return liveRawPending;
}

async function readLiveSnapshots(){
 const live=await readLiveSnapshotsRaw();const vs=(await pool.query('SELECT traccar_device_id,protocol,metadata FROM vehicles WHERE traccar_device_id IS NOT NULL')).rows;const profiles=new Map(vs.map(v=>[String(v.traccar_device_id),{protocol:v.protocol,mappings:v.metadata?.ioMappings||[]}]))
 return {...live,rows:live.rows.map(p=>{const profile=profiles.get(String(p.id))||{},raw=parseAttrs(p.attributes),normalized=normalizeProtocolAttributes(raw,profile.protocol||p.protocol);return {...mapDeviceTelemetry({...p,attributes:normalized},profile.mappings||[]),raw_decoded_attributes:raw}})};
}
function deriveStatus(live,metadata={}){
  if(!live) return 'offline';
  if(connectionStatus(live)==='offline') return 'offline';
  if(live.valid===false) return 'untracked';
  const speedKph=Number(live.speed||0)*1.852;const minimum=Math.max(0,Number(metadata.accuracy?.minMovingSpeed??3));
  const attrs=parseAttrs(live.attributes);
  if(live.speed!=null ? speedKph>minimum : [true,1,'1','true'].includes(attrs.motion)) return 'moving';
  if(attrs.ignition===true && speedKph<=minimum) return 'idle';
  if((attrs.ignition===false || live.speed!=null && speedKph<=minimum || attrs.motion===false) && speedKph<=minimum) return 'parked';
  return 'stopped';
}

app.get('/api/live-health', requireAuth, requireSuper, async (_req,res)=>{
  try {
    const live=await readLiveSnapshots();
    res.json({ok:true,source:live.source,deviceCount:live.rows.length,offlineMinutes:OFFLINE_MINUTES});
  } catch(e){ res.status(502).json({ok:false,error:'live_data_unavailable'}); }
});

async function vehicleSnapshotFor(user){
  const args=[];let where="WHERE COALESCE(v.metadata->>'archived','false')<>'true' AND COALESCE(c.status,'active')<>'archived'";
  if(user.role!=='super_admin'){args.push(user.company_id);where+=' AND v.company_id=$1'}
  if(user.role==='company_user'&&Array.isArray(user.metadata?.vehicleIds)){args.push(user.metadata.vehicleIds.map(Number).filter(Number.isSafeInteger));where+=' AND v.id=ANY($'+args.length+'::bigint[])'}
  const {rows}=await pool.query(`SELECT v.*,c.name AS company_name,(v.expiration_date IS NOT NULL AND v.expiration_date<CURRENT_DATE) AS expired,(rs.data->'telemetryRuntime')->(v.id::text) AS derived_state FROM vehicles v LEFT JOIN companies c ON c.id=v.company_id LEFT JOIN rule_engine_state rs ON rs.company_id=v.company_id ${where} ORDER BY v.id DESC`,args);
  let liveRows=[],source='unavailable';
  try{const live=await readLiveSnapshots();liveRows=live.rows;source=live.source}catch(e){console.error('Live data warning:',e.response?.status||e.message)}
  const liveMap=new Map(liveRows.map(x=>[String(x.id),x])),detectedDrivers=await currentDrivers(pool,rows);
  const snapshots=rows.map(v=>{
    if(v.expired){delete v.derived_state;return {...v,expired:true,live_access:false,access_status:'expired',access_message:VEHICLE_RENEWAL_MESSAGE,access:{status:'expired',code:'vehicle_expired',liveTracking:false,canOpen:false,message:VEHICLE_RENEWAL_MESSAGE},telemetry:{},mapped_io:[],current_driver:unidentified(),driver_identifier:null,status:'expired',connection_status:'expired',device_status:'expired',live_source:'blocked',last_update:null,position_time:null,position_valid:null,fix_time:null,device_time:null,latitude:null,longitude:null,speed_kph:null,course:null,altitude:null,ignition:null,motion:null,attributes:{}}}
    const l=liveMap.get(String(v.traccar_device_id)),attrs=parseAttrs(l?.attributes),telemetry=deriveTelemetry(l?{...l,attributes:attrs}:null,v.metadata,v.derived_state||{});delete v.derived_state;
    const location=resolveLivePosition(l),speedKph=location.source==='current'&&l?.speed!=null?Number((Number(l.speed||0)*1.852).toFixed(1)):null;
    return {...v,expired:false,live_access:true,access_status:'active',access_message:'',access:{status:'active',code:null,liveTracking:true,canOpen:true,message:''},telemetry,mapped_io:l?.mapped_io||[],current_driver:detectedDrivers.get(String(v.id))||unidentified(),driver_identifier:detectedDrivers.get(String(v.id))?.identifier||null,status:deriveStatus(l,v.metadata),connection_status:connectionStatus(l),device_status:l?.status||'unknown',live_source:source,location_source:location.source,last_update:newestTimestamp(l),position_time:location.serverTime,position_valid:l?.valid??null,fix_time:location.fixTime,device_time:location.deviceTime,latitude:location.latitude,longitude:location.longitude,speed_kph:speedKph,course:location.course,altitude:location.altitude,ignition:typeof attrs.ignition==='boolean'?attrs.ignition:null,motion:typeof attrs.motion==='boolean'?attrs.motion:null,attributes:attrs};
  });
  const cachedAddresses=await reverseGeocoder.cachedMany(snapshots);
  return Promise.all(snapshots.map(async snapshot=>{
    if(snapshot.expired||!validGeocodeCoordinates(snapshot.latitude,snapshot.longitude))return snapshot;
    const address=cachedAddresses.get(geocodeCacheKey(snapshot.latitude,snapshot.longitude))||null;
    const stoppedSince=Number(snapshot.telemetry?.stoppedSince||0),settled=stoppedSince>0&&Date.now()-stoppedSince>=30000;
    if(!address&&settled)reverseGeocoder.reverse(snapshot.latitude,snapshot.longitude).then(()=>driverUpdates.emit('changed',snapshot.company_id)).catch(()=>{});
    return {...snapshot,address:address||null};
  }));
}

app.get('/api/vehicles',requireAuth,async(req,res)=>{try{res.json(await vehicleSnapshotFor(req.user))}catch(e){console.error(e);res.status(500).json({error:'failed_to_list_vehicles'})}});

// One authenticated realtime stream replaces repeated browser polling. It emits only when live vehicle data changes.
app.get('/api/vehicles/stream',requireAuth,(req,res)=>{
  res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache,no-transform');res.setHeader('Connection','keep-alive');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();res.write('retry: 3000\n\n');
  let closed=false,busy=false,lastPayload='';
  const push=async()=>{if(closed||busy)return;busy=true;try{const payload=JSON.stringify(await vehicleSnapshotFor(req.user));if(payload!==lastPayload){lastPayload=payload;res.write('event: vehicles\ndata: '+payload+'\n\n')}}catch(e){if(!closed)res.write('event: unavailable\ndata: {}\n\n')}finally{busy=false}};
  const driverChanged=companyId=>{if(req.user.role==='super_admin'||String(req.user.company_id)===String(companyId))push()};
  driverUpdates.on('changed',driverChanged);
  push();const updates=setInterval(push,3000),heartbeat=setInterval(()=>{if(!closed)res.write(': heartbeat\n\n')},15000);
  req.on('close',()=>{closed=true;driverUpdates.off('changed',driverChanged);clearInterval(updates);clearInterval(heartbeat)});
});
async function findDeviceByImei(imei){ const ds=await apiDevices(); return ds.find(d=>String(d.uniqueId)===String(imei))||null; }
async function createDevice({name,imei,disabled}){ const r=await trackingApi.post('/api/devices',{name,uniqueId:imei,disabled:Boolean(disabled)}); return r.data; }
async function updateDevice(device,{name,imei,disabled}){ const r=await trackingApi.put(`/api/devices/${device.id}`,{...device,name,uniqueId:imei,disabled:Boolean(disabled)}); return r.data; }

async function allowVehicleWrite(req,res,next){if(req.user.role==='super_admin')return next();if(req.user.role!=='company_admin')return res.status(403).json({error:'administrator_required'});try{const c=await pool.query('SELECT metadata FROM companies WHERE id=$1',[req.user.company_id]);const permissions=c.rows[0]?.metadata?.vehiclePermissions||{};const v=req.body.id?await pool.query('SELECT * FROM vehicles WHERE id=$1',[req.body.id]):await pool.query('SELECT * FROM vehicles WHERE imei=$1',[req.body.imei]);const old=v.rows[0];if(old&&String(old.company_id)!==String(req.user.company_id))return res.status(403).json({error:'vehicle_not_owned'});if(!permissions[old?'Edit Vehicle':'Add Vehicle'])return res.status(403).json({error:'vehicle_changes_not_permitted'});if(old&&old.imei!==req.body.imei&&!permissions['Change IMEI'])return res.status(403).json({error:'imei_changes_not_permitted'});if(old&&(old.protocol!==req.body.protocol||old.device_model!==req.body.deviceModel)&&!permissions['Change Tracker Configuration'])return res.status(403).json({error:'tracker_changes_not_permitted'});if(!permissions['Change Tracker Configuration']){const before=old?.metadata?.accuracy||{},after=req.body.metadata?.accuracy||{},keys=new Set([...Object.keys(before),...Object.keys(after)]);if([...keys].some(k=>k.startsWith('engine')&&JSON.stringify(before[k])!==JSON.stringify(after[k])))return res.status(403).json({error:'engine_configuration_changes_not_permitted'})}if(JSON.stringify(old?.metadata?.driverIdentification??null)!==JSON.stringify(req.body.metadata?.driverIdentification??null)&&permissions['Sensors/I/O']!==true)return res.status(403).json({error:'Sensors/I/O permission is required to change driver reader configuration.'});if(JSON.stringify(old?.metadata?.immobilizer??null)!==JSON.stringify(req.body.metadata?.immobilizer??null))return res.status(403).json({error:'Only a super administrator may configure the immobilizer relay.'});req.body.companyId=req.user.company_id;next()}catch(e){res.status(500).json({error:'vehicle_permission_check_failed'})}}
app.put('/api/vehicles/:id/image', requireAuth, async(req,res)=>{
 if(!['company_admin','super_admin'].includes(req.user.role))return res.status(403).json({error:'Administrator access required.'});
 const id=Number(req.params.id),value=req.body.imageUrl;
 if(!Number.isSafeInteger(id)||typeof value!=='string'||value.length>350000)return res.status(400).json({error:'Choose an image under 250 KB or a valid URL.'});
 if(value&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error()}catch{return res.status(400).json({error:'Use an HTTP or HTTPS image URL.'})}}
 try{const args=[id,value];let scope='';if(req.user.role!=='super_admin'){args.push(req.user.company_id);scope=' AND company_id=$3'}const r=await pool.query("UPDATE vehicles SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{imageUrl}',to_jsonb($2::text),true) WHERE id=$1"+scope+" RETURNING id",args);if(!r.rowCount)return res.status(404).json({error:'Vehicle not found.'});res.json({ok:true,id,imageUrl:value})}catch{res.status(500).json({error:'Unable to save vehicle image.'})}
});
app.post('/api/vehicles/:id/commands',requireAuth,async(req,res)=>{
 if(!['company_admin','company_user','super_admin'].includes(req.user.role))return res.status(403).json({error:'Command permission required.'});
 const id=Number(req.params.id);
 if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid vehicle.'});
 const client=await pool.connect();
 let auditId=null,locked=false;
 try{
  const r=await client.query("SELECT v.*,(v.expiration_date IS NOT NULL AND v.expiration_date<CURRENT_DATE) AS expired,c.metadata AS company_metadata FROM vehicles v JOIN companies c ON c.id=v.company_id WHERE v.id=$1",[id]);const v=r.rows[0];
  if(!v||req.user.role!=='super_admin'&&String(v.company_id)!==String(req.user.company_id))return res.status(404).json({error:'Vehicle not found.'});
  if(!companyUserCanAccessVehicle(req.user,id))return res.status(404).json({error:'Vehicle not found.'});
  if(v.expired)return rejectExpiredVehicle(res);
  if(!commandPermissionGranted(req.user))return res.status(403).json({error:'Commands permission is disabled for this account.'});
  let request;try{request=normalizeCommandRequest(req.body,v,{allowLegacy:req.user.role==='super_admin'})}catch(error){if(error instanceof CommandValidationError)return res.status(error.status).json({error:error.message,code:error.code});throw error}
  if(!v.traccar_device_id)return res.status(409).json({error:'This vehicle has no connected tracker device.'});
  const devices=await apiDevices();
  const device=devices.find(d=>String(d.id)===String(v.traccar_device_id));
  if(!device)return res.status(409).json({error:'This vehicle is not registered in the tracker service.'});
  if(device.status!=='online')return res.status(409).json({error:'Tracker is offline. GPRS command was not submitted.'});
  const lock=await client.query('SELECT pg_try_advisory_lock(78425,$1::int) AS locked',[id]);locked=lock.rows[0]?.locked===true;
  if(!locked)return res.status(409).json({error:'Another command is already being submitted to this device.'});
  const audit=await client.query("INSERT INTO audit_events(company_id,user_id,action,entity_type,entity_id,detail) VALUES($1,$2,'gprs_command_requested','vehicle',$3,$4::jsonb) RETURNING id",[v.company_id,req.user.id,String(id),JSON.stringify({command:request.command,mode:request.mode,label:request.label,protocol:request.protocol,status:'submitting'})]);
  auditId=audit.rows[0]?.id||null;
  // Send through the live tracker connection. textChannel=true makes Traccar require SMS settings.
  const result=await trackingApi.post('/api/commands/send',{deviceId:v.traccar_device_id,type:'custom',textChannel:false,attributes:{data:request.command}});
  const status=result.status===202?'queued':'submitted';if(auditId)await client.query("UPDATE audit_events SET detail=detail||$2::jsonb WHERE id=$1",[auditId,JSON.stringify({status})]);
  res.json({ok:true,status,mode:request.mode,label:request.label,payload:request.command,message:request.label+' '+status+' for device delivery.',deviceId:v.traccar_device_id});
  }catch(e){
   console.error('GPRS command failed:',e.response?.data||e.message);const detail=e.response?.data?.message||e.response?.data?.error;
   if(auditId)try{await client.query("UPDATE audit_events SET detail=detail||$2::jsonb WHERE id=$1",[auditId,JSON.stringify({status:'failed',error:String(detail||e.message||'submission_failed').slice(0,240)})])}catch(auditError){console.error('GPRS command audit update failed:',auditError.message)}
   res.status(502).json({error:detail||'GPRS command could not be queued. Check tracker connection and try again.'});
  }finally{if(locked)try{await client.query('SELECT pg_advisory_unlock(78425,$1::int)',[id])}catch(e){console.error('GPRS command lock release failed:',e.message)}client.release()}
});
app.get('/api/vehicles/:id/commands/history',requireAuth,async(req,res)=>{
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid vehicle.'});
 try{
  const r=await pool.query('SELECT v.id,v.company_id,v.traccar_device_id,(v.expiration_date IS NOT NULL AND v.expiration_date<CURRENT_DATE) AS expired FROM vehicles v WHERE v.id=$1',[id]);const v=r.rows[0];
  if(!v||req.user.role!=='super_admin'&&String(v.company_id)!==String(req.user.company_id))return res.status(404).json({error:'Vehicle not found.'});
  if(!companyUserCanAccessVehicle(req.user,id))return res.status(404).json({error:'Vehicle not found.'});
  if(!commandPermissionGranted(req.user))return res.status(403).json({error:'Commands permission is disabled for this account.'});
  if(v.expired)return rejectExpiredVehicle(res);
  const audit=await pool.query("SELECT id,created_at,action,detail FROM audit_events WHERE entity_type='vehicle' AND entity_id=$1 AND action IN ('gprs_command_requested','immobilizer_requested') ORDER BY created_at DESC LIMIT 50",[String(id)]);
  let replies=[];
  if(livePool&&v.traccar_device_id){const events=await livePool.query("SELECT id,eventtime,type,attributes FROM tc_events WHERE deviceid=$1 AND type IN ('commandResult','command_result') ORDER BY eventtime DESC LIMIT 50",[Number(v.traccar_device_id)]);replies=events.rows.map(e=>{let attrs=e.attributes||{};if(typeof attrs==='string'){try{attrs=JSON.parse(attrs)}catch{attrs={raw:attrs}}}return{id:'reply-'+e.id,kind:'reply',time:e.eventtime,commandName:'Device reply',content:attrs.result||attrs.response||attrs.message||attrs.raw||JSON.stringify(attrs),status:'reply_received'};});}
  const requests=audit.rows.map(a=>({id:String(a.id),kind:'request',time:a.created_at,commandName:a.action==='immobilizer_requested'?'Immobilizer':a.detail?.label||'GPRS command',content:a.detail?.command||a.detail?.action||'',mode:a.detail?.mode||'preset',protocol:a.detail?.protocol||'',status:a.detail?.status||'submitted'}));
  res.json([...requests,...replies].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,100));
 }catch(e){console.error('Command history failed:',e.message);res.status(500).json({error:'command_history_unavailable'});}
});
app.post('/api/vehicles/:id/immobilizer',requireAuth,async(req,res)=>{
 if(!['company_admin','super_admin'].includes(req.user.role))return res.status(403).json({error:'Administrator permission required.'});
 const client=await pool.connect();let locked=false,auditId;
 try{
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid vehicle.'});
 const r=await client.query("SELECT v.*,(v.expiration_date IS NOT NULL AND v.expiration_date<CURRENT_DATE) AS expired,c.metadata AS company_metadata FROM vehicles v JOIN companies c ON c.id=v.company_id WHERE v.id=$1",[id]);const v=r.rows[0];if(!v||req.user.role!=='super_admin'&&String(v.company_id)!==String(req.user.company_id))return res.status(404).json({error:'Vehicle not found.'});
 if(v.expired)return rejectExpiredVehicle(res);
 if(req.user.role!=='super_admin'&&v.company_metadata?.vehiclePermissions?.Immobilizer!==true)return res.status(403).json({error:'Immobilizer permission must be granted by the super administrator.'});
 const lock=await client.query('SELECT pg_try_advisory_lock(78424,$1::int) AS locked',[id]);locked=lock.rows[0]?.locked;if(!locked)return res.status(409).json({error:'Another command is in progress.'});
 const cooldown=await client.query("SELECT id FROM audit_events WHERE entity_type='vehicle' AND entity_id=$1 AND action='immobilizer_requested' AND created_at>NOW()-INTERVAL '60 seconds' LIMIT 1",[String(id)]);if(cooldown.rows.length)return res.status(409).json({error:'Wait 60 seconds before another command. Check tracker feedback first.'});
 const live=await readLiveSnapshots(),position=live.rows.find(p=>String(p.id)===String(v.traccar_device_id));let command;try{command=immobilizerCommand(v,position,req.body.action)}catch(e){return res.status(400).json({error:e.message})}
 const devices=await apiDevices();if(devices.find(d=>String(d.id)===String(v.traccar_device_id))?.status!=='online')return res.status(409).json({error:'Tracker must be online. Offline commands are not submitted.'});
 const types=await trackingApi.get('/api/commands/types',{params:{deviceId:v.traccar_device_id,textChannel:false}});if(!types.data.some(t=>t.type==='custom'))return res.status(400).json({error:'This tracker does not support the configured command.'});
 const audit=await client.query("INSERT INTO audit_events(company_id,user_id,action,entity_type,entity_id,detail) VALUES($1,$2,'immobilizer_requested','vehicle',$3,$4::jsonb) RETURNING id",[v.company_id,req.user.id,String(id),JSON.stringify({action:req.body.action,output:2,status:'submitting'})]);auditId=audit.rows[0].id;
 const result=await trackingApi.post('/api/commands/send',command);const status=result.status===202?'queued by tracking server; not confirmed':'submitted; not confirmed';await client.query("UPDATE audit_events SET detail=detail||$2::jsonb WHERE id=$1",[auditId,JSON.stringify({status})]);res.json({ok:true,status,message:'Command '+status+'. Verify relay feedback on the tracker.'});
 }catch(e){if(auditId)await client.query("UPDATE audit_events SET detail=detail||$2::jsonb WHERE id=$1",[auditId,JSON.stringify({status:'failed or delivery unknown'})]).catch(()=>{});res.status(502).json({error:'Command delivery could not be confirmed. Check tracker feedback before retrying.'})}finally{if(locked)await client.query('SELECT pg_advisory_unlock(78424,$1::int)',[Number(req.params.id)]).catch(()=>{});client.release()}
});
app.post('/api/vehicles', requireAuth, allowVehicleWrite, async (req,res)=>{
  const driverProfile=req.body?.metadata?.driverIdentification;if(driverProfile?.sourceKey&&!identityKeys.includes(driverProfile.sourceKey))return res.status(400).json({error:'Driver identification requires a decoded identifier source.'});
  const client=await pool.connect();
  try {
    const name=cleanString(req.body.name||req.body.vehicleName), imei=cleanString(req.body.imei||req.body.vehicleImei);
    const companyId=req.body.companyId?Number(req.body.companyId):null;
    const plateNumber=cleanString(req.body.plateNumber)||null, registration=cleanString(req.body.registration)||null;
    const protocol=cleanString(req.body.protocol)||null, deviceModel=cleanString(req.body.deviceModel)||null;
    let expirationDate=cleanString(req.body.expirationDate)||null;const active=req.body.active!==false;
    const engineConfig=req.body.metadata?.accuracy||{};if(engineConfig.engineVoltageEnabled===true&&!(Number(engineConfig.engineVoltageOn)>Number(engineConfig.engineVoltageOff)&&Number(engineConfig.engineVoltageOff)>0&&Number(engineConfig.engineDebounceSeconds??10)>=0&&Number(engineConfig.engineDebounceSeconds??10)<=300))return res.status(400).json({error:'Configure positive engine voltage thresholds (running > off) and debounce from 0 to 300 seconds.'});
    if(!name) return res.status(400).json({error:'vehicle_name_required'});
    if(!/^\d{8,20}$/.test(imei)) return res.status(400).json({error:'invalid_imei'});
    if(companyId){ const c=await client.query('SELECT id FROM companies WHERE id=$1',[companyId]); if(!c.rowCount)return res.status(400).json({error:'company_not_found'}); }
    await client.query('BEGIN');
    const existing=req.body.id?await client.query('SELECT * FROM vehicles WHERE id=$1 FOR UPDATE',[req.body.id]):await client.query('SELECT * FROM vehicles WHERE imei=$1 FOR UPDATE',[imei]);if(req.body.id&&!existing.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'vehicle_not_found'})}const duplicate=await client.query('SELECT id FROM vehicles WHERE imei=$1 AND id<>$2',[imei,existing.rows[0]?.id||0]);if(duplicate.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'IMEI already belongs to another vehicle'})}
    const old=existing.rows[0];if(old&&(req.user.role!=='super_admin'||!Object.hasOwn(req.body,'expirationDate')))expirationDate=old.expiration_date;const metadata=cleanMetadata(req.body.metadata);const resetIoMappings=req.user.role==='super_admin'&&req.body.resetIoMappings===true;metadata.ioMappings=resetIoMappings?[]:(old?.metadata?.ioMappings||[]);delete metadata.deviceCapabilities;delete metadata._deviceCapabilities;
    let profile;try{if(metadata.accuracy?.minMovingSpeed!=null&&(metadata.accuracy.minMovingSpeed===''||!Number.isFinite(Number(metadata.accuracy.minMovingSpeed))||Number(metadata.accuracy.minMovingSpeed)<0||Number(metadata.accuracy.minMovingSpeed)>30))throw Error('Minimum moving speed must be between 0 and 30 km/h.');profile=await resolveDeviceProfile(client,protocol,deviceModel);if(profile)validateIoMappings(metadata.ioMappings,profile.capabilities_json,{confirmOutputs:true});else if(metadata.ioMappings.some(m=>m.enabled!==false))throw Error('Remove active I/O mappings before changing protocol.');if(profile&&metadata.immobilizer?.enabled===true&&!profile.capabilities_json.dout.includes('DOUT'+metadata.immobilizer.output))throw Error('The configured immobilizer output is not supported by this model.');}catch(e){await client.query('ROLLBACK');return res.status(400).json({error:e.message})}
    if(metadata.speedLimit!=null&&metadata.speedLimit!==''&&(!Number.isFinite(Number(metadata.speedLimit))||Number(metadata.speedLimit)<1||Number(metadata.speedLimit)>250)){await client.query('ROLLBACK');return res.status(400).json({error:'Speed limit must be between 1 and 250 km/h.'})}
    const trackingType=req.body.metadata?.trackingType||old?.tracking_type||'Normal';if(!['Normal','Advanced'].includes(trackingType)){await client.query('ROLLBACK');return res.status(400).json({error:'Choose Normal or Advanced tracking.'})}
    let device=existing.rows[0]?.traccar_device_id?(await trackingApi.get('/api/devices/'+existing.rows[0].traccar_device_id)).data:await findDeviceByImei(imei);
    device=device?await updateDevice(device,{name,imei,disabled:!active}):await createDevice({name,imei,disabled:!active});
    if(profile){const decoderModel=profile.model==='OTHER'?null:profile.model;if((device.model||null)!==decoderModel)device=(await trackingApi.put('/api/devices/'+device.id,{...device,model:decoderModel})).data;}
    let saved;
    if(existing.rowCount){
      ({rows:[saved]}=await client.query(`UPDATE vehicles SET company_id=$1,traccar_device_id=$2,name=$3,plate_number=$4,registration=$5,protocol=$6,device_model=$7,expiration_date=$8,active=$9,imei=$11,updated_at=NOW() WHERE id=$10 RETURNING *`,[companyId,device.id,name,plateNumber,registration,protocol,deviceModel,expirationDate,active,existing.rows[0].id,imei]));
    }else{
      ({rows:[saved]}=await client.query(`INSERT INTO vehicles(company_id,traccar_device_id,name,plate_number,registration,imei,protocol,device_model,expiration_date,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[companyId,device.id,name,plateNumber,registration,imei,protocol,deviceModel,expirationDate,active]));
    }
    await client.query('UPDATE vehicles SET metadata=$1::jsonb,device_model_id=$3,tracking_type=$4 WHERE id=$2',[JSON.stringify(metadata),saved.id,profile?.id||null,trackingType]);
    if(resetIoMappings)await client.query('UPDATE vehicle_io_mappings SET enabled=false,updated_at=NOW() WHERE vehicle_id=$1',[saved.id]);
    await client.query('DELETE FROM device_admission_attempts WHERE imei=$1',[imei]);
    await client.query('COMMIT');
    res.status(201).json({ok:true,action:existing.rowCount?'updated':'linked_or_created',vehicle:saved,trackingDevice:{id:device.id,name:device.name,uniqueId:device.uniqueId,status:device.status}});
  } catch(e){
    try{await client.query('ROLLBACK')}catch{}
    const status=e.response?.status,data=e.response?.data; console.error('Vehicle save error:',status||'',data||e.message);
    if(status===401)return res.status(502).json({error:'tracking_auth_failed'});
    if(status===400)return res.status(400).json({error:'tracking_rejected_device',details:data});
    res.status(500).json({error:'failed_to_save_vehicle'});
  } finally { client.release(); }
});


app.get('/api/diagnostics',requireAuth,requireSuper,async(req,res)=>{
  try{
    const requested=req.query.vehicleId?String(req.query.vehicleId):null;
    const live=await readLiveSnapshots();
    let sql=`SELECT v.*,c.name AS company_name FROM vehicles v LEFT JOIN companies c ON c.id=v.company_id`;const args=[];const cond=[];
    if(req.user.role!=='super_admin'){args.push(req.user.company_id);cond.push(`v.company_id=$${args.length}`)}
    if(requested){args.push(requested);cond.push(`v.id=$${args.length}`)}
    if(cond.length)sql+=' WHERE '+cond.join(' AND ');sql+=' ORDER BY v.id LIMIT 1';
    const {rows}=await pool.query(sql,args);const v=rows[0]||null;const l=v?live.rows.find(x=>String(x.id)===String(v.traccar_device_id)):null;
    const attrs=parseAttrs(l?.attributes),last=newestTimestamp(l);
    // iButton/driverUniqueId is an event-style Teltonika field: it appears on
    // the reader packet, then is absent from normal heartbeat packets. Keep
    // the last reader packet alongside the latest live attributes so
    // diagnostics can distinguish "not in this packet" from "not working".
    let lastDriverPacket=null;
    if(livePool&&v?.traccar_device_id){
      try{
        const reader=await livePool.query(`SELECT fixtime,attributes FROM tc_positions WHERE deviceid=$1 AND ((attributes::jsonb ? 'driverUniqueId') OR (attributes::jsonb ? 'lastKnownDriverUniqueId') OR (attributes::jsonb ? 'driver_id') OR (attributes::jsonb ? 'iButton') OR (attributes::jsonb ? 'ibutton')) ORDER BY fixtime DESC LIMIT 1`,[v.traccar_device_id]);
        if(reader.rows[0]){const ra=parseAttrs(reader.rows[0].attributes),value=ra.driverUniqueId??ra.lastKnownDriverUniqueId??ra.driver_id??ra.iButton??ra.ibutton;if(value!==undefined&&value!==null&&value!=='')lastDriverPacket={value:String(value),time:reader.rows[0].fixtime,attributes:ra}}
      }catch(e){console.error('Driver packet diagnostics unavailable:',e.message)}
    }
    let profile=null;try{if(v?.protocol){const pr=await pool.query('SELECT protocol,display_name,transport,tcp_port,udp_port,enabled FROM protocol_profiles WHERE lower(protocol)=lower($1) LIMIT 1',[v.protocol]);profile=pr.rows[0]||null}}catch{}
    const lat=l?.latitude==null?null:Number(l.latitude),lon=l?.longitude==null?null:Number(l.longitude),speedKph=l?.speed==null?null:Number((Number(l.speed||0)*1.852).toFixed(1));
    res.json({ok:true,trackerPort:profile?.tcp_port||((String(v?.protocol||'').toLowerCase()==='gt06')?TRACKER_PORT:null),transport:profile?.transport||null,receiverConfigured:!!profile?.enabled,protocol:v?.protocol||null,backend:'healthy',database:'healthy',liveSource:live.source,vehicle:v?{id:v.id,name:v.name,plate:v.plate_number,imei:v.imei,company:v.company_name,deviceId:v.traccar_device_id}:null,device:{connectionStatus:connectionStatus(l),rawDeviceStatus:l?.status||'unknown',lastUpdate:last,derivedStatus:deriveStatus(l),latitude:Number.isFinite(lat)?lat:null,longitude:Number.isFinite(lon)?lon:null,speedKph,ignition:typeof attrs.ignition==='boolean'?attrs.ignition:null,motion:typeof attrs.motion==='boolean'?attrs.motion:null,attributes:attrs,lastDriverUniqueId:lastDriverPacket?.value||null,lastDriverPacketTime:lastDriverPacket?.time||null}})
  }catch(e){console.error(e);res.status(500).json({ok:false,error:'diagnostics_failed'})}
});

app.get('/api/diagnostics/overview',requireAuth,requireSuper,async(req,res)=>{
  try{
    const numeric=value=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null};
    const companyId=numeric(req.query.companyId),userId=numeric(req.query.userId),vehicleId=numeric(req.query.vehicleId);
    const hours=Math.min(24*30,Math.max(1,Number(req.query.hours)||24));
    const query=cleanString(req.query.query).slice(0,100).toLowerCase();
    const [companiesResult,usersResult,profilesResult,eventResult,admissionResult,vehicles]=await Promise.all([
      pool.query("SELECT id,name,status FROM companies WHERE status<>'archived' ORDER BY name"),
      pool.query(`SELECT u.id,u.company_id AS "companyId",u.name,u.email,u.role,u.status,c.name AS "companyName"
        FROM auth_users u JOIN companies c ON c.id=u.company_id
        WHERE u.role<>'super_admin' AND COALESCE(u.metadata->>'deleted','false')<>'true'
        ORDER BY c.name,u.name`),
      pool.query('SELECT protocol,display_name,transport,tcp_port,udp_port,enabled FROM protocol_profiles'),
      pool.query(`SELECT e.id,e.level,e.source,e.event_type AS "eventType",e.message,e.company_id AS "companyId",c.name AS "companyName",
        e.user_id AS "userId",u.name AS "userName",e.vehicle_id AS "vehicleId",v.name AS "vehicleName",e.imei,e.protocol,
        e.source_ip AS "sourceIp",e.tracker_port AS "trackerPort",e.http_status AS "httpStatus",e.detail,e.created_at AS "createdAt"
        FROM diagnostic_events e
        LEFT JOIN companies c ON c.id=e.company_id LEFT JOIN auth_users u ON u.id=e.user_id LEFT JOIN vehicles v ON v.id=e.vehicle_id
        WHERE e.created_at>=NOW()-($1::text||' hours')::interval
          AND ($2::bigint IS NULL OR e.company_id=$2) AND ($3::bigint IS NULL OR e.user_id=$3) AND ($4::bigint IS NULL OR e.vehicle_id=$4)
        ORDER BY e.created_at DESC LIMIT 250`,[String(hours),companyId,userId,vehicleId]),
      pool.query(`SELECT id,protocol,imei,status,first_seen AS "firstSeen",last_seen AS "lastSeen",attempt_count AS "attemptCount",last_ip AS "sourceIp",last_port AS "sourcePort"
        FROM device_admission_attempts WHERE last_seen>=NOW()-($1::text||' hours')::interval ORDER BY last_seen DESC LIMIT 250`,[String(hours)]),
      vehicleSnapshotFor(req.user),
    ]);
    const profiles=new Map(profilesResult.rows.map(row=>[String(row.protocol||'').toLowerCase(),row]));
    const users=usersResult.rows.filter(user=>(!companyId||Number(user.companyId)===companyId)&&(!userId||Number(user.id)===userId));
    const userCompany=userId?Number(usersResult.rows.find(user=>Number(user.id)===userId)?.companyId||0):null;
    const vehicleRows=vehicles.filter(vehicle=>{
      if(companyId&&Number(vehicle.company_id)!==companyId)return false;
      if(userCompany&&Number(vehicle.company_id)!==userCompany)return false;
      if(vehicleId&&Number(vehicle.id)!==vehicleId)return false;
      if(query&&!`${vehicle.id} ${vehicle.company_id} ${vehicle.company_name||''} ${vehicle.name||''} ${vehicle.plate_number||''} ${vehicle.imei||''} ${vehicle.protocol||''}`.toLowerCase().includes(query))return false;
      return true;
    }).map(vehicle=>{
      const profile=profiles.get(String(vehicle.protocol||'').toLowerCase())||{},status=String(vehicle.status||'offline');
      const issue=status==='offline'?'No recent communication':!vehicle.last_update?'No tracker update received':null;
      return {id:Number(vehicle.id),companyId:vehicle.company_id?Number(vehicle.company_id):null,companyName:vehicle.company_name||'',name:vehicle.name||'',plateNumber:vehicle.plate_number||'',imei:vehicle.imei||'',protocol:vehicle.protocol||'',traccarDeviceId:vehicle.traccar_device_id||null,status,connectionStatus:vehicle.connection_status||'unknown',lastUpdate:vehicle.last_update||null,trackerPort:profile.tcp_port||profile.udp_port||null,transport:profile.transport||null,receiverEnabled:profile.enabled!==false,issue};
    });
    const selectedImeis=new Set(vehicleRows.map(vehicle=>String(vehicle.imei)));
    const admissions=admissionResult.rows.filter(row=>{
      if(vehicleId)return selectedImeis.has(String(row.imei));
      if(companyId||userId)return false;
      return !query||`${row.imei} ${row.protocol} ${row.sourceIp||''}`.toLowerCase().includes(query);
    });
    const events=eventResult.rows.filter(event=>!query||JSON.stringify(event).toLowerCase().includes(query));
    const companies=companiesResult.rows.filter(company=>!companyId||Number(company.id)===companyId);
    res.set('Cache-Control','no-store').json({sampledAt:new Date().toISOString(),hours,companies,users,vehicles:vehicleRows,events,admissions});
  }catch(error){console.error('Diagnostics overview failed:',error.message);res.status(500).json({error:'Diagnostics overview is temporarily unavailable.'})}
});

// Authenticated reporting: ownership is checked before the tracking service is called.
app.post('/api/reports/brag',requireAuth,async(req,res)=>{
 if(req.user.role!=='super_admin'&&req.user.metadata?.permissions?.Reports===false)return res.status(403).json({error:'reports_not_permitted'});
 const from=new Date(String(req.body?.from||'')),to=new Date(String(req.body?.to||''));if(!Number.isFinite(+from)||!Number.isFinite(+to)||to<from||to-from>31*86400000)return res.status(400).json({error:'Choose a valid date range of at most 31 days.'});
 const requested=[...new Set((Array.isArray(req.body?.vehicleIds)?req.body.vehicleIds:[]).map(Number).filter(value=>Number.isSafeInteger(value)&&value>0))];
 try{
  const state=(await pool.query('SELECT data FROM platform_state WHERE id=1')).rows[0]?.data||{},settings=sanitizeBragSettings(state.settings?.bragReport||defaultBragSettings);
  const params=[];let where="WHERE v.active<>FALSE AND COALESCE(v.metadata->>'archived','false')<>'true' AND v.traccar_device_id IS NOT NULL AND (v.expiration_date IS NULL OR v.expiration_date>=CURRENT_DATE)";
  if(req.user.role!=='super_admin'){params.push(req.user.company_id);where+=` AND v.company_id=$${params.length}`}
  else if(Number.isSafeInteger(Number(req.body?.companyId))){params.push(Number(req.body.companyId));where+=` AND v.company_id=$${params.length}`}
  if(requested.length){params.push(requested);where+=` AND v.id=ANY($${params.length}::bigint[])`}
  if(req.user.role==='company_user'&&Array.isArray(req.user.metadata?.vehicleIds)){params.push(req.user.metadata.vehicleIds.map(Number).filter(Number.isSafeInteger));where+=` AND v.id=ANY($${params.length}::bigint[])`}
  const vehicles=(await pool.query(`SELECT v.id,v.company_id,v.traccar_device_id,v.name,v.imei,v.plate_number,v.protocol,v.metadata,c.name AS company_name,c.metadata AS company_metadata FROM vehicles v JOIN companies c ON c.id=v.company_id ${where} ORDER BY v.name`,params)).rows;
  const rows=[];for(let offset=0;offset<vehicles.length;offset+=4){const batch=vehicles.slice(offset,offset+4);const built=await Promise.all(batch.map(async vehicle=>{const query={deviceId:Number(vehicle.traccar_device_id),from:from.toISOString(),to:to.toISOString()};const [routeResponse,eventResponse]=await Promise.all([trackingApi.get('/api/reports/route',{params:query,headers:{Accept:'application/json'}}),trackingApi.get('/api/reports/events',{params:query,headers:{Accept:'application/json'}})]);if(!Array.isArray(routeResponse.data)||!Array.isArray(eventResponse.data))throw Error('invalid_tracking_response');const route=await enrichDriverHistory(pool,vehicle,'route',routeResponse.data.map(row=>normalizeProtocolPosition(row,vehicle.protocol)),from.toISOString(),to.toISOString()),events=await enrichDriverHistory(pool,vehicle,'events',eventResponse.data.map(row=>normalizeProtocolPosition(row,vehicle.protocol)),from.toISOString(),to.toISOString());return buildBragRecord({vehicle,route,events,settings})}));rows.push(...built)}
  const driverId=String(req.body?.driverId||'all'),driverRows=driverId==='all'?rows:rows.filter(row=>row.driverIds.includes(driverId));
  const status=String(req.body?.bragStatus||'').toLowerCase(),filtered=status&&status!=='all'?driverRows.filter(row=>row.bragStatus.toLowerCase()===status):driverRows,sort=String(req.body?.sort||'scoreAsc');filtered.sort((a,b)=>['vehicle','vehicleAsc'].includes(sort)?a.vehicleNumber.localeCompare(b.vehicleNumber):['driver','driverAsc'].includes(sort)?a.driverName.localeCompare(b.driverName):sort==='scoreDesc'?b.score-a.score:sort==='overspeed'?b.overspeedCount-a.overspeedCount:sort==='idle'?b.idleSeconds-a.idleSeconds:['distance','distanceDesc'].includes(sort)?b.distanceKm-a.distanceKm:a.score-b.score);
  const violations=filtered.flatMap(row=>row.violations.map(item=>({...item,vehicleId:row.vehicleId}))).sort((a,b)=>new Date(b.dateTime||0)-new Date(a.dateTime||0));for(const row of filtered){delete row.violations;delete row.driverIds}
  const company=vehicles[0]||{},platformLogo=state.settings?.brandLogoData||'';
  const companyState=company.company_id?(await pool.query('SELECT data FROM company_state WHERE company_id=$1',[company.company_id])).rows[0]?.data||{}:{};
  const companyProfile=companyState.companyProfile||{},companyLogo=companyProfile.logoData||company.company_metadata?.logoData||'',companyAddress=companyProfile.address||company.company_metadata?.address||'';
  const resolveLogo=(key,automatic)=>{const mode=settings.logoModes[key];if(mode==='none')return'';if(mode==='custom')return settings.logos[key]||'';if(mode==='platform')return platformLogo||'';if(mode==='company')return companyLogo||'';return automatic||''};
  res.set('Cache-Control','no-store').json({type:'BRAG Report',from:from.toISOString(),to:to.toISOString(),generatedAt:new Date().toISOString(),companyName:company.company_name||'',companyAddress,rows:filtered,violations,summary:bragSummary(filtered,settings),branding:{supplierLogo:resolveLogo('supplier',platformLogo),contractorLogo:resolveLogo('contractor',companyLogo),contractCompanyLogo:resolveLogo('contractCompany',companyLogo)}});
 }catch(error){console.error('BRAG report failed:',error.response?.data||error.message);res.status(502).json({error:'BRAG report data is unavailable. Check tracking history and try again.'})}
});
app.get('/api/reports/:type',requireAuth,async(req,res)=>{
  if(req.user.role!=='super_admin'&&req.user.metadata?.permissions?.Reports===false)return res.status(403).json({error:'reports_not_permitted'});if(!['trips','summary','route','events'].includes(req.params.type))return res.status(404).json({error:'report_not_found'});
  const deviceId=Number(req.query.deviceId),from=new Date(String(req.query.from)),to=new Date(String(req.query.to));
  if(!Number.isSafeInteger(deviceId)||deviceId<1||!Number.isFinite(+from)||!Number.isFinite(+to)||to<from||to-from>31*86400000)return res.status(400).json({error:'Choose a valid device and a date range of at most 31 days.'});
  try{
    const {rows}=await pool.query('SELECT v.id,v.company_id,v.traccar_device_id,v.protocol,(v.expiration_date IS NOT NULL AND v.expiration_date<CURRENT_DATE) AS expired,c.metadata AS company_metadata FROM vehicles v JOIN companies c ON c.id=v.company_id WHERE v.traccar_device_id=$1',[deviceId]);
    if(!rows[0]||(req.user.role!=='super_admin'&&String(rows[0].company_id)!==String(req.user.company_id)))return res.status(404).json({error:'vehicle_not_found'});
    if(rows[0].expired)return rejectExpiredVehicle(res);
    const companyDays=Math.min(3650,Math.max(1,Number(rows[0].company_metadata?.historyRetentionDays)||30));const userDays=req.user.role==='company_user'?Math.min(companyDays,Math.max(1,Number(req.user.metadata?.historyAccessDays)||companyDays)):companyDays;const earliest=Date.now()-userDays*86400000;if(+from<earliest)return res.status(400).json({error:`This company stores report history for ${userDays} days. Choose a start date within that period.`});
    if(req.user.role==='company_user'&&Array.isArray(req.user.metadata?.vehicleIds)&&!req.user.metadata.vehicleIds.map(String).includes(String(rows[0].id)))return res.status(404).json({error:'vehicle_not_assigned'});const r=await trackingApi.get('/api/reports/'+req.params.type,{params:{deviceId,from:from.toISOString(),to:to.toISOString()},headers:{Accept:'application/json'}});
    if(!Array.isArray(r.data))throw new Error('invalid_tracking_response');
    const normalized=r.data.map(row=>normalizeProtocolPosition(row,rows[0].protocol));
    res.json(await enrichDriverHistory(pool,rows[0],req.params.type,normalized,from.toISOString(),to.toISOString()));
  }catch(e){console.error('Report failed',e.message);res.status(502).json({error:'Tracking history is unavailable. Check the tracking service and try again.'})}
});

const userFields='id,company_id AS "companyId",name,email,role,status,metadata,created_at';
const manageUsers=(req,res,next)=>['super_admin','company_admin'].includes(req.user.role)?next():res.status(403).json({error:'administrator_required'});
app.get('/api/users',requireAuth,manageUsers,async(req,res)=>{
  try{const all=req.user.role==='super_admin';const r=await pool.query(`SELECT ${userFields} FROM auth_users WHERE role<>'super_admin' AND COALESCE(metadata->>'deleted','false')<>'true' ${all?'':'AND company_id=$1'} ORDER BY name`,all?[]:[req.user.company_id]);res.json(r.rows)}catch(e){res.status(500).json({error:'users_unavailable'})}
});
app.post('/api/users',requireAuth,manageUsers,async(req,res)=>{
  const companyId=req.user.role==='super_admin'?Number(req.body.companyId):req.user.company_id;
  const name=cleanString(req.body.name),email=cleanString(req.body.email).toLowerCase(),password=String(req.body.password||'');
  const role=req.body.role==='company_admin'?'company_admin':'company_user';
  if(!companyId||!name||!email.includes('@')||password.length<12)return res.status(400).json({error:'Name, company, valid email and a password of at least 12 characters are required.'});
  try{const r=await pool.query(`INSERT INTO auth_users(company_id,name,email,password_hash,role,status,metadata) VALUES($1,$2,$3,$4,$5,'active',$6::jsonb) RETURNING ${userFields}`,[companyId,name,email,hashPassword(password),role,JSON.stringify(cleanMetadata(req.body.metadata))]);res.status(201).json(r.rows[0])}catch(e){res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'Email already exists.':'Unable to create user.'})}
});
app.delete('/api/users',requireAuth,requireSuper,async(req,res)=>{
  if(String(req.body?.confirmation||'')!=='DELETE ALL USERS')return res.status(400).json({error:'Type DELETE ALL USERS to confirm.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const r=await client.query("UPDATE auth_users SET status='inactive',metadata=COALESCE(metadata,'{}'::jsonb)||'{\"deleted\":true}'::jsonb,updated_at=NOW() WHERE role<>'super_admin' AND COALESCE(metadata->>'deleted','false')<>'true' RETURNING id");
    await client.query("DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM auth_users WHERE role<>'super_admin')");
    await client.query('COMMIT');
    res.json({ok:true,deleted:r.rowCount});
  }catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({error:'Unable to delete users.'})}finally{client.release()}
});
app.put('/api/users/:id',requireAuth,manageUsers,async(req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query("SELECT * FROM auth_users WHERE id=$1 AND role<>'super_admin' FOR UPDATE",[req.params.id]);const u=rows[0];
    if(!u||(req.user.role!=='super_admin'&&String(u.company_id)!==String(req.user.company_id))){await client.query('ROLLBACK');return res.status(404).json({error:'user_not_found'})}
    const status=req.body.status==='inactive'?'inactive':'active',role=req.body.role==='company_admin'?'company_admin':'company_user';
    if(String(u.id)===String(req.user.id)&&(status!=='active'||role!=='company_admin')){await client.query('ROLLBACK');return res.status(400).json({error:'You cannot disable or demote your own account.'})}
    if(u.role==='company_admin'&&(status!=='active'||role!=='company_admin')){
      const replacement=await client.query("SELECT 1 FROM auth_users WHERE company_id=$1 AND id<>$2 AND role='company_admin' AND status='active' AND COALESCE(metadata->>'deleted','false')<>'true' LIMIT 1",[u.company_id,u.id]);
      if(!replacement.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Create another active Company Admin before disabling or changing this primary account.'})}
    }
    const name=cleanString(req.body.name),email=cleanString(req.body.email).toLowerCase(),password=String(req.body.password||'');
    if(!name||!email.includes('@')||(password&&password.length<12)){await client.query('ROLLBACK');return res.status(400).json({error:'Check name, email and password (minimum 12 characters).'})}
    const r=await client.query(`UPDATE auth_users SET name=$1,email=$2,role=$3,status=$4,password_hash=$5,metadata=$7::jsonb,updated_at=NOW() WHERE id=$6 RETURNING ${userFields}`,[name,email,role,status,password?hashPassword(password):u.password_hash,u.id,JSON.stringify(cleanMetadata(req.body.metadata))]);
    if(password||status!=='active'||role!==u.role)await client.query('DELETE FROM auth_sessions WHERE user_id=$1',[u.id]);
    await client.query('COMMIT');res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'Email already exists.':'Unable to update user.'})}finally{client.release()}
});
app.delete('/api/users/:id',requireAuth,manageUsers,async(req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query("SELECT id,company_id,role,metadata FROM auth_users WHERE id=$1 AND role<>'super_admin' FOR UPDATE",[req.params.id]);const u=rows[0];
    if(!u||(req.user.role!=='super_admin'&&String(u.company_id)!==String(req.user.company_id))){await client.query('ROLLBACK');return res.status(404).json({error:'user_not_found'})}
    if(String(u.id)===String(req.user.id)){await client.query('ROLLBACK');return res.status(400).json({error:'You cannot delete your own account.'})}
    await client.query("UPDATE auth_users SET status='inactive',metadata=COALESCE(metadata,'{}'::jsonb)||'{\"deleted\":true}'::jsonb,updated_at=NOW() WHERE id=$1",[u.id]);
    await client.query('DELETE FROM auth_sessions WHERE user_id=$1',[u.id]);
    await client.query('COMMIT');res.json({ok:true});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:'Unable to delete user.'})}finally{client.release()}
});

// Additional real storage for the original interface. No customer rows are seeded.
const cleanMetadata=value=>{if(!value||typeof value!=='object'||Array.isArray(value))return {};const out={...value};for(const key of ['password','temporaryPassword','password_hash','token','id','companyId'])delete out[key];return out};
app.get('/api/platform/state',requireAuth,requireSuper,async(req,res)=>{try{const r=await pool.query('SELECT data,version FROM platform_state WHERE id=1');res.json(r.rows[0]||{data:{},version:0})}catch(e){res.status(500).json({error:'platform_state_unavailable'})}});
app.patch('/api/platform/settings',requireAuth,requireSuper,async(req,res)=>{
 try{
  const version=Number(req.body?.version),category=req.body?.category;
  if(!Number.isSafeInteger(version)||version<0)return res.status(400).json({error:'version_required'});
  const patch=preparePlatformSettingsPatch(category,req.body?.settings);
  const keys=Object.keys(patch);
  const saved=await pool.query(`WITH saved AS (
    INSERT INTO platform_state(id,data,version,updated_at)
    SELECT 1,jsonb_build_object('settings',$1::jsonb),1,NOW()
    WHERE $2=0 OR EXISTS(SELECT 1 FROM platform_state WHERE id=1)
    ON CONFLICT(id) DO UPDATE SET
      data=jsonb_set(COALESCE(platform_state.data,'{}'::jsonb),'{settings}',COALESCE(platform_state.data->'settings','{}'::jsonb)||$1::jsonb,true),
      version=platform_state.version+1,
      updated_at=NOW()
    WHERE platform_state.version=$2
    RETURNING version,data->'settings' AS settings
   ), audit_log AS (
    INSERT INTO audit_events(user_id,action,entity_type,entity_id,detail)
    SELECT $3,'platform_settings_updated','platform_settings',$4,$5::jsonb FROM saved
   )
   SELECT version,settings FROM saved`,[
    JSON.stringify(patch),version,req.user.id,category,JSON.stringify({category,keys})
  ]);
  if(!saved.rowCount){
   const current=(await pool.query("SELECT version,COALESCE(data->'settings','{}'::jsonb) AS settings FROM platform_state WHERE id=1")).rows[0]||{version:0,settings:{}};
   return res.status(409).json({error:'platform_settings_conflict',message:'Another administrator changed these settings. Refresh and retry.',...current});
  }
  res.json({ok:true,category,...saved.rows[0]});
 }catch(error){
  if(error instanceof PlatformSettingsValidationError)return res.status(400).json({error:error.code,message:error.message});
  console.error('Platform settings patch:',error.message);
  res.status(500).json({error:'platform_settings_save_failed'});
 }
});
app.put('/api/platform/state',requireAuth,requireSuper,async(req,res)=>{try{const data=cleanMetadata(req.body.data);for(const key of ['companies','vehicles','devices','subAccounts'])delete data[key];const version=Number(req.body.version);if(!Number.isSafeInteger(version)||version<0)return res.status(400).json({error:'version_required'});const current=(await pool.query('SELECT data FROM platform_state WHERE id=1')).rows[0]?.data||{},incomingSettings=data.settings&&typeof data.settings==='object'?data.settings:null,currentSettings=current.settings&&typeof current.settings==='object'?current.settings:{},protectedKeys=['mapillaryAccessToken','mapTilerKey','mapboxToken','hereMapsKey','tomtomMapsKey','yandexMapsKey','geoapifyKey','locationIqKey','tomtomGeocodingKey','mapboxGeocodingToken','hereGeocodingKey','mapTilerGeocodingKey','bingMapsKey','streetviewApiKey','captchaSiteKey','captchaSecretKey'];if(incomingSettings)for(const key of protectedKeys)if(!String(incomingSettings[key]??'').trim()&&String(currentSettings[key]??'').trim())incomingSettings[key]=currentSettings[key];const r=await pool.query(`INSERT INTO platform_state(id,data,version) VALUES(1,$1::jsonb,1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,version=platform_state.version+1,updated_at=NOW() WHERE platform_state.version=$2 RETURNING version`,[JSON.stringify(data),version]);if(!r.rowCount)return res.status(409).json({error:'Another administrator changed these records. Refresh and retry.'});res.json({ok:true,...r.rows[0]})}catch(e){res.status(500).json({error:'platform_save_failed'})}});
app.get('/api/platform/database',requireAuth,requireSuper,async(req,res)=>{try{const r=await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");res.json({connected:true,tables:r.rows.map(x=>x.tablename)})}catch(e){res.status(503).json({error:'database_unavailable'})}});
app.get('/api/platform/logs',requireAuth,requireSuper,async(req,res)=>{try{const r=await pool.query('SELECT a.*,u.name AS actor FROM audit_events a LEFT JOIN auth_users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 250');res.json(r.rows)}catch(e){res.status(500).json({error:'logs_unavailable'})}});
app.put('/api/auth/profile',requireAuth,async(req,res)=>{const name=cleanString(req.body.name),email=cleanString(req.body.email).toLowerCase();if(!name||!email.includes('@'))return res.status(400).json({error:'Name and email are required.'});try{const r=await pool.query('UPDATE auth_users SET name=$1,email=$2,updated_at=NOW() WHERE id=$3 RETURNING id,name,email',[name,email,req.user.id]);res.json(r.rows[0])}catch(e){res.status(409).json({error:'Profile could not be updated. Check that the email is not already used.'})}});
app.delete('/api/companies/:id',requireAuth,requireSuper,async(req,res)=>{try{const r=await pool.query("UPDATE companies SET status='archived',updated_at=NOW() WHERE id=$1 RETURNING id",[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'company_not_found'});res.json({ok:true})}catch(e){res.status(500).json({error:'company_archive_failed'})}});
async function allowVehicleDelete(req,res,next){if(req.user.role==='super_admin')return next();if(req.user.role!=='company_admin')return res.status(403).json({error:'administrator_required'});try{const r=await pool.query('SELECT v.company_id,c.metadata FROM vehicles v JOIN companies c ON c.id=v.company_id WHERE v.id=$1',[req.params.id]);const v=r.rows[0];if(!v||String(v.company_id)!==String(req.user.company_id)||!v.metadata?.vehiclePermissions?.['Delete Vehicle'])return res.status(403).json({error:'vehicle_archive_not_permitted'});next()}catch(e){res.status(500).json({error:'permission_check_failed'})}}
app.delete('/api/vehicles/:id',requireAuth,allowVehicleDelete,async(req,res)=>{
 const client=await pool.connect();
 try{
  const r=await client.query('SELECT * FROM vehicles WHERE id=$1',[req.params.id]);const v=r.rows[0];if(!v)return res.status(404).json({error:'vehicle_not_found'});
  if(v.traccar_device_id){const d=await trackingApi.get('/api/devices/'+v.traccar_device_id);await updateDevice(d.data,{name:v.name,imei:v.imei,disabled:true})}
  await client.query('BEGIN');
  await client.query("UPDATE vehicles SET active=false,metadata=metadata||'{\"archived\":true}'::jsonb,updated_at=NOW() WHERE id=$1",[v.id]);
  const admissionProtocol=/teltonika/i.test(v.protocol||'')?'teltonika':/gt06/i.test(v.protocol||'')?'gt06':null;
  if(admissionProtocol)await client.query(`INSERT INTO device_admission_attempts(protocol,imei,status,first_seen,last_seen,attempt_count,updated_at) VALUES($1,$2,'pending',NOW(),NOW(),1,NOW()) ON CONFLICT(protocol,imei) DO UPDATE SET status='pending',last_seen=NOW(),updated_at=NOW()`,[admissionProtocol,v.imei]);
  await client.query('COMMIT');res.json({ok:true,returnedToAdmissions:!!admissionProtocol});
 }catch(e){try{await client.query('ROLLBACK')}catch{};res.status(502).json({error:'Vehicle could not be disabled. No success was recorded.'})}finally{client.release()}
});

app.get('/api/inventory',requireAuth,requireSuper,async(req,res)=>{try{const ds=await apiDevices();const r=await pool.query('SELECT traccar_id,metadata FROM device_inventory');const meta=new Map(r.rows.map(x=>[String(x.traccar_id),x.metadata]));res.json(ds.filter(d=>!meta.get(String(d.id))?.archived).map(d=>({...meta.get(String(d.id)),id:d.id,imei:d.uniqueId,model:meta.get(String(d.id))?.model||d.name,protocol:meta.get(String(d.id))?.protocol||'',status:d.status||'unknown',lastSeen:d.lastUpdate?new Date(d.lastUpdate).toISOString():'No communication'})))}catch(e){res.status(502).json({error:'Tracker inventory unavailable'})}});
app.post('/api/inventory',requireAuth,requireSuper,async(req,res)=>{try{const imei=cleanString(req.body.imei);if(!/^\d{8,20}$/.test(imei))return res.status(400).json({error:'Invalid IMEI'});let d=req.body.id?(await trackingApi.get('/api/devices/'+Number(req.body.id))).data:await findDeviceByImei(imei);if(d&&String(d.uniqueId)!==imei)return res.status(409).json({error:'Change the IMEI through the assigned vehicle record.'});const name=cleanString(req.body.vehicle)||cleanString(req.body.model)||imei;d=d?await updateDevice(d,{name,imei,disabled:req.body.status==='Inactive'}):await createDevice({name,imei,disabled:req.body.status==='Inactive'});await pool.query('INSERT INTO device_inventory(traccar_id,metadata) VALUES($1,$2::jsonb) ON CONFLICT(traccar_id) DO UPDATE SET metadata=EXCLUDED.metadata',[d.id,JSON.stringify(cleanMetadata(req.body))]);if(req.body.vehicle){const r=await pool.query('SELECT id,imei FROM vehicles WHERE name=$1',[req.body.vehicle]);if(r.rows.length!==1||r.rows[0].imei!==imei)return res.status(409).json({error:'Tracker saved. Vehicle assignment requires a matching vehicle IMEI; update it on Vehicles.'})}res.json({ok:true,id:d.id})}catch(e){res.status(502).json({error:'Device could not be saved to the tracking server.'})}});
app.delete('/api/inventory/:id',requireAuth,requireSuper,async(req,res)=>{try{const d=(await trackingApi.get('/api/devices/'+Number(req.params.id))).data;await updateDevice(d,{name:d.name,imei:d.uniqueId,disabled:true});await pool.query(`INSERT INTO device_inventory(traccar_id,metadata) VALUES($1,'{"archived":true}'::jsonb) ON CONFLICT(traccar_id) DO UPDATE SET metadata=device_inventory.metadata||EXCLUDED.metadata`,[d.id]);res.json({ok:true})}catch(e){res.status(502).json({error:'Device could not be disabled.'})}});

app.get('/api/device-admissions',requireAuth,requireSuper,async(req,res)=>{
 try{
  const {rows}=await pool.query(`SELECT a.id,a.protocol,a.imei,a.status,a.first_seen AS "firstSeen",a.last_seen AS "lastSeen",a.attempt_count AS "attemptCount",a.last_ip AS "lastIp",a.last_port AS "lastPort",
   CASE WHEN previous.id IS NULL THEN NULL ELSE json_build_object('vehicleId',previous.id,'vehicleName',previous.name,'plateNumber',previous.plate_number,'companyId',previous.company_id,'companyName',previous.company_name,'removedAt',previous.updated_at) END AS "previousUse"
   FROM device_admission_attempts a
   LEFT JOIN vehicles v ON v.imei=a.imei AND v.active<>FALSE AND v.company_id IS NOT NULL AND COALESCE(v.metadata->>'archived','false')<>'true'
   LEFT JOIN LATERAL (SELECT history.id,history.name,history.plate_number,history.company_id,company.name AS company_name,history.updated_at FROM vehicles history LEFT JOIN companies company ON company.id=history.company_id WHERE history.imei=a.imei ORDER BY history.updated_at DESC LIMIT 1) previous ON TRUE
   WHERE v.id IS NULL
   ORDER BY CASE WHEN a.status='pending' THEN 0 ELSE 1 END,a.last_seen DESC LIMIT 1000`);
  res.json(rows);
 }catch(e){console.error('Device admissions unavailable:',e.message);res.status(500).json({error:'device_admissions_unavailable'})}
});
app.post('/api/device-admissions/:id/decision',requireAuth,requireSuper,async(req,res)=>{
 const status=String(req.body?.status||'').toLowerCase();if(!['pending','declined'].includes(status))return res.status(400).json({error:'Choose pending or declined.'});
 try{const {rows}=await pool.query('UPDATE device_admission_attempts SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,protocol,imei,status',[status,req.params.id]);if(!rows[0])return res.status(404).json({error:'Unknown device record not found.'});await pool.query("INSERT INTO audit_events(user_id,action,entity_type,entity_id,detail) VALUES($1,'device_admission_decision','device_admission',$2,$3::jsonb)",[req.user.id,String(rows[0].id),JSON.stringify({status,imei:rows[0].imei,protocol:rows[0].protocol})]);res.json({ok:true,...rows[0]})}catch(e){console.error('Device admission decision failed:',e.message);res.status(500).json({error:'Unable to update the device decision.'})}
});
app.delete('/api/device-admissions/:id',requireAuth,requireSuper,async(req,res)=>{
 try{const {rows}=await pool.query('DELETE FROM device_admission_attempts WHERE id=$1 RETURNING id,protocol,imei,status',[req.params.id]);if(!rows[0])return res.status(404).json({error:'Unknown device record not found.'});await pool.query("INSERT INTO audit_events(user_id,action,entity_type,entity_id,detail) VALUES($1,'device_admission_deleted','device_admission',$2,$3::jsonb)",[req.user.id,String(rows[0].id),JSON.stringify({imei:rows[0].imei,protocol:rows[0].protocol,status:rows[0].status})]);res.json({ok:true})}catch(e){console.error('Device admission delete failed:',e.message);res.status(500).json({error:'Unable to delete the unknown device record.'})}
});

app.get('/api/scheduled-reports/:id',requireAuth,async(req,res)=>{if(req.user.role!=='company_admin')return res.status(403).json({error:'Company administrator access required.'});try{const r=await pool.query('SELECT id,data,created_at FROM scheduled_report_runs WHERE company_id=$1 AND schedule_id=$2 ORDER BY created_at DESC LIMIT 1',[req.user.company_id,req.params.id]);res.json(r.rows)}catch{res.status(500).json({error:'Scheduled reports are unavailable.'})}});

app.get('/api/driver-identification/stream',requireAuth,(req,res)=>{
 res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();res.write(': connected\n\n');
 const changed=companyId=>{if(req.user.role==='super_admin'||String(req.user.company_id)===String(companyId))res.write('data: changed\n\n')};
 driverUpdates.on('changed',changed);const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);
 // Reconnect periodically so normal authentication revalidates the session.
 const expiry=setTimeout(()=>res.end(),60000);res.on('close',()=>{driverUpdates.off('changed',changed);clearInterval(heartbeat);clearTimeout(expiry)});
});
app.put('/api/vehicles/:id/driver-identification',requireAuth,async(req,res)=>{
 if(!['company_admin','super_admin'].includes(req.user.role))return res.status(403).json({error:'Administrator access required.'});
 const d=req.body||{};
 if(d.sourceKey&&!identityKeys.includes(d.sourceKey))return res.status(400).json({error:'Choose a decoded driver identifier field.'});
 if(d.type&&!['DRIVER_ID','RFID','IBUTTON'].includes(d.type))return res.status(400).json({error:'Invalid identifier type.'});
 try{const config={enabled:d.enabled!==false,sourceKey:d.sourceKey||'',type:d.type||'DRIVER_ID',unknownAlert:d.unknownAlert===true};
 if(req.user.role!=='super_admin'){const ioCompany=(await pool.query('SELECT metadata FROM companies WHERE id=$1',[req.user.company_id])).rows[0]?.metadata;if(ioCompany?.vehiclePermissions?.['Sensors/I/O']!==true)return res.status(403).json({error:'Sensors/I/O permission is required.'});}
 const r=await pool.query("UPDATE vehicles SET metadata=jsonb_set(metadata,'{driverIdentification}',$3::jsonb),updated_at=NOW() WHERE id=$1 AND ($2::bigint IS NULL OR company_id=$2) RETURNING id",[req.params.id,req.user.role==='super_admin'?null:req.user.company_id,JSON.stringify(config)]);
 if(!r.rows.length)return res.status(404).json({error:'Vehicle not found.'});res.json({ok:true,config});
 }catch{res.status(500).json({error:'Driver identification mapping could not be saved.'})}
});

await pool.query(await readFile(new URL('./migration-driver-identification.sql',import.meta.url),'utf8'));
await pool.query(await readFile(new URL('./migration-device-admission.sql',import.meta.url),'utf8'));
await pool.query(await readFile(new URL('./migration-diagnostics.sql',import.meta.url),'utf8'));
await pool.query(await readFile(new URL('./migration-geocoding.sql',import.meta.url),'utf8'));
await initializeDeviceProfiles(pool);
registerDeviceProfileRoutes(app,{pool,requireAuth,requireSuper,readLiveSnapshots});
await initializePush(app,{pool,requireAuth});
app.get('/api/retention/preview',requireAuth,requireSuper,async(req,res)=>{
  try{
    const companyId=Number(req.query.companyId);if(!Number.isSafeInteger(companyId)||companyId<1)return res.status(400).json({error:'company_id_required'});
    const company=(await pool.query("SELECT id,name,metadata FROM companies WHERE id=$1 AND status<>'archived'",[companyId])).rows[0];if(!company)return res.status(404).json({error:'company_not_found'});
    const days=retentionDays(req.query.days??company.metadata?.historyRetentionDays);const cutoff=new Date(Date.now()-days*86400000);const devices=await retentionDevices(companyId);const tracking=await trackingRetentionCounts(devices.map(x=>x.traccar_device_id),cutoff.toISOString());
    const appCounts=(await pool.query(`SELECT (SELECT COUNT(*) FROM scheduled_report_runs WHERE company_id=$1 AND created_at<$2) AS scheduled_reports,(SELECT COUNT(*) FROM driver_identification_events WHERE company_id=$1 AND event_time<$2) AS driver_events,(SELECT COUNT(*) FROM vehicle_driver_sessions WHERE company_id=$1 AND ended_at IS NOT NULL AND ended_at<$2) AS driver_sessions,(SELECT COUNT(*) FROM audit_events WHERE company_id=$1 AND created_at<$2 AND action<>'company_created') AS audit_events,(SELECT COUNT(*) FROM diagnostic_events WHERE company_id=$1 AND created_at<$2) AS diagnostic_events`,[companyId,cutoff.toISOString()])).rows[0];
    res.json({company:{id:company.id,name:company.name},days,cutoff:cutoff.toISOString(),devices:devices.map(x=>({id:x.id,name:x.name,trackingId:x.traccar_device_id})),tracking,application:{scheduledReports:Number(appCounts.scheduled_reports||0),driverEvents:Number(appCounts.driver_events||0),driverSessions:Number(appCounts.driver_sessions||0),auditEvents:Number(appCounts.audit_events||0),diagnosticEvents:Number(appCounts.diagnostic_events||0)},backupRequired:true});
  }catch(e){console.error('Retention preview failed:',e.message);res.status(503).json({error:'retention_preview_unavailable'})}
});
app.post('/api/retention/cleanup',requireAuth,requireSuper,async(req,res)=>{
  const client=await pool.connect();
  try{
    const companyId=Number(req.body.companyId);if(!Number.isSafeInteger(companyId)||companyId<1)return res.status(400).json({error:'company_id_required'});
    const company=(await client.query("SELECT id,name,metadata FROM companies WHERE id=$1 AND status<>'archived' FOR SHARE",[companyId])).rows[0];if(!company)return res.status(404).json({error:'company_not_found'});
    const days=retentionDays(req.body.days??company.metadata?.historyRetentionDays);const cutoff=new Date(Date.now()-days*86400000);const expected=`${company.name}|${cutoff.toISOString().slice(0,10)}`;
    if(String(req.body.confirmation||'')!==expected)return res.status(400).json({error:`Type ${expected} to confirm permanent cleanup.`});
    const devices=await retentionDevices(companyId);const backup=await createRetentionBackup(companyId,company.name);const tracking=await deleteTrackingRows(devices.map(x=>x.traccar_device_id),cutoff.toISOString());
    await client.query('BEGIN');
    const deleted={scheduledReports:(await client.query('DELETE FROM scheduled_report_runs WHERE company_id=$1 AND created_at<$2',[companyId,cutoff])).rowCount||0,driverEvents:(await client.query('DELETE FROM driver_identification_events WHERE company_id=$1 AND event_time<$2',[companyId,cutoff])).rowCount||0,driverSessions:(await client.query('DELETE FROM vehicle_driver_sessions WHERE company_id=$1 AND ended_at IS NOT NULL AND ended_at<$2',[companyId,cutoff])).rowCount||0,auditEvents:(await client.query("DELETE FROM audit_events WHERE company_id=$1 AND created_at<$2 AND action<>'company_created'",[companyId,cutoff])).rowCount||0,diagnosticEvents:(await client.query('DELETE FROM diagnostic_events WHERE company_id=$1 AND created_at<$2',[companyId,cutoff])).rowCount||0};
    await client.query('INSERT INTO audit_events(user_id,company_id,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[req.user.id,companyId,'retention_cleanup','company',String(companyId),JSON.stringify({days,cutoff:cutoff.toISOString(),backup,tracking,application:deleted})]);await client.query('COMMIT');
    res.json({ok:true,company:company.name,days,cutoff:cutoff.toISOString(),backup,tracking,application:deleted});
  }catch(e){try{await client.query('ROLLBACK')}catch{}console.error('Retention cleanup failed:',e.message);res.status(503).json({error:'retention_cleanup_failed',detail:e.message})}finally{client.release()}
});
async function runTenantRetentionCleanup(){
  const companies=(await pool.query("SELECT id,CASE WHEN COALESCE(metadata->>'historyRetentionDays','') ~ '^[0-9]+$' THEN (metadata->>'historyRetentionDays')::int ELSE 30 END AS days FROM companies WHERE status<>'archived'")).rows;
  for(const company of companies){
    const days=Math.min(3650,Math.max(1,Number(company.days)||30));
    const cutoff=new Date(Date.now()-days*86400000).toISOString();
    await pool.query('DELETE FROM scheduled_report_runs WHERE company_id=$1 AND created_at<$2',[company.id,cutoff]);
    await pool.query('DELETE FROM driver_identification_events WHERE company_id=$1 AND event_time<$2',[company.id,cutoff]);
    await pool.query('DELETE FROM vehicle_driver_sessions WHERE company_id=$1 AND ended_at IS NOT NULL AND ended_at<$2',[company.id,cutoff]);
    await pool.query("DELETE FROM audit_events WHERE company_id=$1 AND created_at<$2 AND action<>'company_created'",[company.id,cutoff]);
    await pool.query('DELETE FROM diagnostic_events WHERE company_id=$1 AND created_at<$2',[company.id,cutoff]);
  }
  await pool.query("DELETE FROM diagnostic_events WHERE company_id IS NULL AND created_at<NOW()-INTERVAL '30 days'");
}
const HOST=process.env.HOST||'127.0.0.1';
app.listen(PORT,HOST,()=>{console.log(`INVIHA backend listening on http://${HOST}:${PORT}`);startRuleWorker({pool,readLiveSnapshots,parseAttrs});startDriverWorker({pool,trackingApi,livePool,onChange:companyId=>driverUpdates.emit('changed',companyId)});let retentionRunning=false;const retain=async()=>{if(retentionRunning)return;retentionRunning=true;try{await runTenantRetentionCleanup()}catch(e){console.error('Retention cleanup unavailable',e.message)}finally{retentionRunning=false}};setTimeout(retain,120000).unref();setInterval(retain,86400000).unref();let scheduling=false;setInterval(async()=>{if(scheduling)return;scheduling=true;try{await runSchedules({pool,trackingApi})}catch(e){console.error('Scheduler unavailable',e.message)}finally{scheduling=false}},60000).unref()});

