import {recentAlerts} from './alert-retention.mjs';
import {deriveTelemetry} from './telemetry.mjs';
import {evaluateAlerts} from './rules.mjs';
export function startRuleWorker({pool,readLiveSnapshots,parseAttrs}){
 let busy=false,lastPurge=0;
 async function tick(){if(busy)return;busy=true;try{
  if(Date.now()-lastPurge>=300000){
   const states=await pool.query("SELECT company_id,data->'alerts' AS alerts FROM company_state WHERE jsonb_typeof(data->'alerts')='array'");
   for(const row of states.rows){const kept=recentAlerts(row.alerts);if(kept.length!==row.alerts.length)await pool.query("UPDATE company_state SET data=jsonb_set(data,'{alerts}',$2::jsonb),version=version+1,updated_at=NOW() WHERE company_id=$1 AND data->'alerts'=$3::jsonb",[row.company_id,JSON.stringify(kept),JSON.stringify(row.alerts)])}
   lastPurge=Date.now();
  }
  const live=await readLiveSnapshots(),map=new Map(live.rows.map(x=>[String(x.id),x]));
  const policyRow=await pool.query('SELECT data FROM platform_state WHERE id=1');const policy=policyRow.rows[0]?.data?.settings||{};
  const companies=await pool.query("SELECT id,metadata FROM companies WHERE status='active'");
  for(const co of companies.rows){const client=await pool.connect();try{await client.query('BEGIN');
   const lock=await client.query('SELECT pg_try_advisory_xact_lock(78423,$1::int) AS locked',[co.id]);if(!lock.rows[0]?.locked){await client.query('ROLLBACK');continue}
   const state=await client.query('SELECT data FROM company_state WHERE company_id=$1 FOR UPDATE',[co.id]);if(!state.rows.length){await client.query('ROLLBACK');continue}
   const data=state.rows[0].data||{},runtime=await client.query('SELECT data FROM rule_engine_state WHERE company_id=$1',[co.id]);
   const company={...co.metadata,...data.companyProfile,id:co.id},settings=policy.trackingPolicyEnabled===true?policy:company.settings||{};
   const vs=await client.query("SELECT id,name,traccar_device_id,metadata FROM vehicles WHERE company_id=$1 AND active=true AND COALESCE(metadata->>'archived','false')<>'true' AND (expiration_date IS NULL OR expiration_date>=CURRENT_DATE)",[co.id]);
   const telemetryRuntime={...(runtime.rows[0]?.data?.telemetryRuntime||{})};
   const vehicles=vs.rows.map(v=>{const l=map.get(String(v.traccar_device_id)),a=parseAttrs(l?.attributes),time=new Date(Math.max(...[l?.servertime,l?.serverTime,l?.lastupdate,l?.lastUpdate].map(x=>Date.parse(x)).filter(Number.isFinite),0)).toISOString(),age=Date.now()-Date.parse(time);let speed=l?.speed==null?null:Number(l.speed)*1.852;
    const fresh=Number.isFinite(age)&&age>=-60000&&age<=Math.max(1,Number(settings.offlineMinutes)||300)*60000;
    const telemetry=deriveTelemetry(l?{...l,attributes:a}:null,v.metadata,telemetryRuntime[v.id]);if(telemetry.fresh||telemetry.ignitionSampleTime)telemetryRuntime[v.id]=telemetry;
    const fixAge=l?.fixtime||l?.fixTime?Date.now()-Date.parse(l.fixtime||l.fixTime):null;
    const gpsOff=/gps\s*:\s*off/i.test(String(a.result||''));
    const signalFresh=l?.valid!==false&&Number.isFinite(age)&&age<=Math.min(Math.max(1,Number(settings.offlineMinutes)||300)*60000,120000)&&!gpsOff&&(!Number.isFinite(fixAge)||fixAge<=120000);
    if(l?.valid===false)speed=null;
    return {...v,telemetry,position:l?{latitude:l.latitude,longitude:l.longitude,valid:l.valid,serverTime:time,attributes:a}:null,speed,state:!fresh?'offline':signalFresh&&((l?.speed!=null&&speed>Math.max(0,Number(v.metadata?.accuracy?.minMovingSpeed??3)))||[true,1,'1','true'].includes(a.motion))?'moving':signalFresh&&[true,1,'1','true'].includes(a.ignition)?'idle':'parked'};
   });
   const normalized={...data,...runtime.rows[0]?.data};for(const key of ['drivers','alerts','alertRules','localGeofences'])normalized[key]=(data[key]||[]).map(x=>({...x,companyId:co.id}));
   const next=evaluateAlerts(normalized,company,vehicles);next.alerts=recentAlerts(next.alerts);
   await client.query('INSERT INTO rule_engine_state(company_id,data) VALUES($1,$2::jsonb) ON CONFLICT(company_id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()',[co.id,JSON.stringify({ruleRuntime:next.ruleRuntime||{},geofenceRuntime:next.geofenceRuntime||{},telemetryRuntime})]);
   if(JSON.stringify(next.alerts)!==JSON.stringify(normalized.alerts))await client.query("UPDATE company_state SET data=jsonb_set(data,'{alerts}',$2::jsonb),version=version+1,updated_at=NOW() WHERE company_id=$1",[co.id,JSON.stringify(next.alerts)]);
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');console.error('Rule evaluation failed for company',co.id,e.message)}finally{client.release()}}
 }catch(e){console.error('Rule worker could not read telemetry',e.message)}finally{busy=false}}
 const timer=setInterval(tick,10000);timer.unref();tick();return()=>clearInterval(timer);
}
