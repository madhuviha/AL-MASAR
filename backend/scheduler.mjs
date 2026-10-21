import {enrichDriverHistory} from './driver-identification.mjs';
import {reportSummary} from './report-metrics.mjs';
import {buildReport} from './report-engine.mjs';
import {normalizeProtocolPosition} from './protocol-telemetry.mjs';
import {normalizeReportPoints} from './report-normalization.mjs';
export async function runSchedules({pool,trackingApi}){
 const platform=(await pool.query('SELECT data FROM platform_state WHERE id=1')).rows[0]?.data||{},bragSettings=platform.settings?.bragReport;
 const companies=await pool.query("SELECT c.id,c.name,c.metadata,s.data FROM companies c JOIN company_state s ON s.company_id=c.id WHERE c.status='active'");
 for(const co of companies.rows){const data=co.data||{},company={name:co.name,...co.metadata,...data.companyProfile};
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:company.timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  const day=parts.year+'-'+parts.month+'-'+parts.day,clock=parts.hour+':'+parts.minute;
  for(const schedule of data.reportSchedules||[]){if(schedule.enabled===false||clock<(schedule.time||'08:00'))continue;
   const client=await pool.connect();try{await client.query('BEGIN');const lock=await client.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked',['report:'+co.id+':'+schedule.id]);if(!lock.rows[0]?.locked){await client.query('ROLLBACK');continue}
    const last=await client.query('SELECT period,created_at FROM scheduled_report_runs WHERE company_id=$1 AND schedule_id=$2 ORDER BY created_at DESC LIMIT 1',[co.id,String(schedule.id)]);const previous=last.rows[0];
    const days=schedule.frequency==='Daily'?1:schedule.frequency==='Monthly'?30:7;
    if(previous&&(previous.period===day||(schedule.frequency==='Monthly'?previous.period.slice(0,7)===day.slice(0,7):Date.parse(day)-Date.parse(previous.period)<days*86400000))){await client.query('ROLLBACK');continue}
    const vs=await client.query("SELECT id,company_id,name,traccar_device_id,imei,plate_number,protocol,metadata FROM vehicles WHERE company_id=$1 AND active=true AND (expiration_date IS NULL OR expiration_date>=CURRENT_DATE)",[co.id]);
    const vehicles=vs.rows.filter(v=>Array.isArray(schedule.vehicleIds)&&schedule.vehicleIds.length?schedule.vehicleIds.map(String).includes(String(v.id)):!schedule.vehicleId||schedule.vehicleId==='all'||String(v.id)===String(schedule.vehicleId)).map(v=>({...v,company_name:company.name||'',deviceId:v.traccar_device_id}));
    const api=Object.fromEntries(['route','trips','events','summary'].map(type=>[type,async(deviceId,from,to)=>{const r=await trackingApi.get('/api/reports/'+type,{params:{deviceId,from,to},headers:{Accept:'application/json'}});if(!Array.isArray(r.data))throw Error('Invalid report data');const vehicle=vehicles.find(v=>String(v.deviceId)===String(deviceId)),normalized=type==='route'?normalizeReportPoints(r.data,{protocol:vehicle?.protocol}):r.data.map(row=>normalizeProtocolPosition(row,vehicle?.protocol));return enrichDriverHistory(client,{...vehicle,company_id:co.id,traccar_device_id:deviceId},type,normalized,from,to)}]));
    const from=new Date(Date.parse(day)-days*86400000).toISOString().slice(0,10),to=new Date(Date.parse(day)-86400000).toISOString().slice(0,10);
    const rows=await buildReport({type:schedule.type,vehicles,store:{alerts:[],maintenance:[],drivers:[],sensorConfigs:[],...data},from,to,driverId:schedule.driverId||'all',idleMinimumSeconds:schedule.idleMinimumSeconds??120,bragSettings},api);
    const summary={...reportSummary(rows,{type:schedule.type,vehicles,from,to,idleMinimumSeconds:schedule.idleMinimumSeconds??120}),companyName:company.name||'',companyAddress:company.address||'',companyLogo:company.logoData||''};
    await client.query('INSERT INTO scheduled_report_runs(company_id,schedule_id,period,data) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING',[co.id,String(schedule.id),day,JSON.stringify({name:schedule.name,type:schedule.type,from,to,rows,summary})]);await client.query('COMMIT');
   }catch(e){await client.query('ROLLBACK');console.error('Scheduled report failed',co.id,schedule.id,e.message)}finally{client.release()}
  }
 }
}
