import {createHash} from 'node:crypto';
import {driverIdentifiers,validateDrivers,extractIdentifier,identifierAliases,sessionDriver} from './driver-identity.mjs';

// Caller holds company_state's row lock, shared with company edits and ingestion.
export async function syncDrivers(db,companyId,drivers){
 validateDrivers(drivers);
 const digest=createHash('sha256').update(JSON.stringify(drivers)).digest('hex');
 const previous=await db.query('SELECT digest FROM driver_master_sync WHERE company_id=$1',[companyId]);
 if(previous.rows[0]?.digest===digest)return;
 await db.query('UPDATE driver_identifiers SET active=false WHERE company_id=$1',[companyId]);
 await db.query('UPDATE drivers SET active=false WHERE company_id=$1',[companyId]);
 for(const d of drivers){const active=String(d.status||'Active').toLowerCase()==='active';
  await db.query('INSERT INTO drivers(company_id,id,name,active,details) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(company_id,id) DO UPDATE SET name=EXCLUDED.name,active=EXCLUDED.active,details=EXCLUDED.details',[companyId,String(d.id),String(d.name||''),active,JSON.stringify(d)]);
  for(const tag of driverIdentifiers(d))await db.query('INSERT INTO driver_identifiers(company_id,driver_id,type,identifier_normalized,active) VALUES($1,$2,$3,$4,$5) ON CONFLICT(company_id,driver_id,identifier_normalized) DO UPDATE SET type=EXCLUDED.type,active=EXCLUDED.active',[companyId,String(d.id),tag.type,tag.identifier,active]);
 }
 await db.query('INSERT INTO driver_master_sync(company_id,digest) VALUES($1,$2) ON CONFLICT(company_id) DO UPDATE SET digest=EXCLUDED.digest',[companyId,digest]);
}

export async function identifyPosition(db,vehicle,position){
 if(String(position.deviceId)!==String(vehicle.traccar_device_id))return null;
 const tag=extractIdentifier(position,vehicle.metadata?.driverIdentification);
 if(!tag)return null;
 const time=Date.parse(position.deviceTime||position.serverTime||position.fixTime);
 if(!Number.isFinite(time)||time>Date.now()+60000)return null;
 const at=new Date(time).toISOString(),company=vehicle.company_id;
 const key=String(position.id??createHash('sha256').update(JSON.stringify([position.deviceId,at,tag.raw])).digest('hex'));
 const cursor=(await db.query('SELECT * FROM driver_identity_cursor WHERE company_id=$1 AND vehicle_id=$2 FOR UPDATE',[company,vehicle.id])).rows[0];
 const aliases=identifierAliases(tag.normalized,tag.type);
 if(cursor?.last_identifier&&aliases.includes(cursor.last_identifier)){
  if(cursor.last_event_time&&time<=Date.parse(cursor.last_event_time))return null;
  const active=(await db.query('SELECT * FROM vehicle_driver_sessions WHERE company_id=$1 AND vehicle_id=$2 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',[company,vehicle.id])).rows[0];
  if(active){
   await db.query('UPDATE driver_identity_cursor SET last_event_time=$3 WHERE company_id=$1 AND vehicle_id=$2',[company,vehicle.id,at]);
   return {...sessionDriver({...active,last_seen_at:at}),vehicle_id:vehicle.id,refreshed:true};
  }
 }
 const match=await db.query('SELECT i.id,i.driver_id,i.type,d.name FROM driver_identifiers i JOIN drivers d ON d.company_id=i.company_id AND d.id=i.driver_id WHERE i.company_id=$1 AND i.identifier_normalized=ANY($2::text[]) AND i.active AND d.active',[company,aliases]);
 const driverIds=new Set(match.rows.map(row=>String(row.driver_id)));
 // A byte alias must never select arbitrarily when two active drivers have
 // colliding representations. Treat that packet as unknown until the master
 // data is corrected.
 const driver=driverIds.size===1?match.rows[0]:null,type=tag.type==='DRIVER_ID'?(driver?.type||tag.type):tag.type;
 const event=await db.query('INSERT INTO driver_identification_events(company_id,vehicle_id,position_key,event_time,identifier_raw,identifier_normalized,identifier_type,source,driver_id,driver_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id',[company,vehicle.id,key,at,tag.raw,tag.normalized,type,tag.source,driver?.driver_id||null,driver?.name||null]);
 if(!event.rows.length)return null;
 
 if(cursor?.last_event_time&&time<=Date.parse(cursor.last_event_time))return null;
 await db.query('INSERT INTO driver_identity_cursor(company_id,vehicle_id,last_identifier,last_event_time) VALUES($1,$2,$3,$4) ON CONFLICT(company_id,vehicle_id) DO UPDATE SET last_identifier=EXCLUDED.last_identifier,last_event_time=EXCLUDED.last_event_time',[company,vehicle.id,tag.normalized,at]);

 if(driver){const newer=await db.query('SELECT 1 FROM vehicle_driver_sessions WHERE company_id=$1 AND driver_id=$2 AND started_at>$3 LIMIT 1',[company,driver.driver_id,at]);if(newer.rows.length)return null;}
 await db.query('UPDATE vehicle_driver_sessions SET ended_at=$3 WHERE company_id=$1 AND (vehicle_id=$2 OR ($4::text IS NOT NULL AND driver_id=$4)) AND ended_at IS NULL AND started_at<=$3',[company,vehicle.id,at,driver?.driver_id||null]);
 const session=await db.query('INSERT INTO vehicle_driver_sessions(company_id,vehicle_id,driver_id,identifier_id,driver_name,identifier_raw,identifier_normalized,identifier_type,source,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[company,vehicle.id,driver?.driver_id||null,driver?.id||null,driver?.name||null,tag.raw,tag.normalized,type,tag.source,at]);
 await db.query('UPDATE driver_identification_events SET applied=true WHERE id=$1',[event.rows[0].id]);
 return {...sessionDriver(session.rows[0]),vehicle_id:vehicle.id,event_id:event.rows[0].id};
}

export async function currentDrivers(db,vehicles){
 if(!vehicles.length)return new Map();
 const rows=await db.query('SELECT s.*,c.last_event_time AS last_seen_at FROM vehicle_driver_sessions s JOIN vehicles v ON v.id=s.vehicle_id AND v.company_id=s.company_id LEFT JOIN driver_identity_cursor c ON c.company_id=s.company_id AND c.vehicle_id=s.vehicle_id WHERE s.vehicle_id=ANY($1::bigint[]) AND s.ended_at IS NULL',[vehicles.map(v=>v.id)]);
 return new Map(rows.rows.map(s=>[String(s.vehicle_id),sessionDriver(s)]));
}

export async function driverHistory(db,vehicle,from,to){
 const r=await db.query('SELECT * FROM vehicle_driver_sessions WHERE company_id=$1 AND vehicle_id=$2 AND started_at<=$4 AND (ended_at IS NULL OR ended_at>$3) ORDER BY started_at',[vehicle.company_id,vehicle.id,from,to]);
 return r.rows;
}
export function driverAt(sessions,time){
 const t=Date.parse(time);return sessionDriver(sessions.find(s=>Date.parse(s.started_at)<=t&&(!s.ended_at||Date.parse(s.ended_at)>t)));
}
export async function enrichDriverHistory(db,vehicle,type,rows,from,to){
 const sessions=await driverHistory(db,vehicle,from,to);
 const enriched=rows.map(row=>{
  const at=row.deviceTime||row.fixTime||row.eventTime||row.startTime||row.serverTime;
  const current=driverAt(sessions,at);
  const overlaps=type==='trips'||type==='summary'?sessions.filter(s=>Date.parse(s.started_at)<Date.parse(row.endTime||to)&&(!s.ended_at||Date.parse(s.ended_at)>Date.parse(row.startTime||from))):null;
  return {...row,current_driver:current,driver_identifier:current.identifier,...(overlaps?{driver_sessions:overlaps.map(s=>({...sessionDriver(s),ended_at:s.ended_at}))}:{})};
 });
 if(type==='events'){
  const events=await db.query('SELECT * FROM driver_identification_events WHERE company_id=$1 AND vehicle_id=$2 AND event_time>=$3 AND event_time<=$4 ORDER BY event_time',[vehicle.company_id,vehicle.id,from,to]);
  enriched.push(...events.rows.map(e=>({id:'driver-'+e.id,deviceId:vehicle.traccar_device_id,type:!e.applied?'Late driver identification':e.driver_id?'Driver identified':'Unknown Driver',identification_applied:e.applied,eventTime:e.event_time,current_driver:{name:e.driver_name||'Unknown Driver',driver_id:e.driver_id,identifier:e.identifier_raw,type:e.identifier_type},attributes:{driver_identifier:e.identifier_raw,driverName:e.driver_name||'Unknown Driver',source:e.source}})));
  enriched.sort((a,b)=>Date.parse(a.eventTime||a.serverTime)-Date.parse(b.eventTime||b.serverTime));
 }
 return enriched;
}
