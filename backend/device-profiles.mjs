function stableJson(value){return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
import {readFile} from 'node:fs/promises';
import {deviceModelSeeds,validateCapabilities,validateIoMappings} from './device-profile-rules.mjs';
export async function initializeDeviceProfiles(pool){
 await pool.query(await readFile(new URL('./migration-device-profiles.sql',import.meta.url),'utf8'));
 for(const x of deviceModelSeeds)await pool.query('INSERT INTO device_models(brand,protocol_key,series,model,capabilities_json) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(brand,model) DO NOTHING',[x.brand,x.protocol_key,x.series,x.model,JSON.stringify(x.capabilities_json)]);
 // Only exact labels are associated; existing unknown labels and metadata are retained.
 await pool.query("UPDATE vehicles v SET device_model_id=d.id FROM device_models d WHERE v.device_model_id IS NULL AND lower(v.protocol) LIKE '%teltonika%' AND upper(trim(v.device_model))=d.model AND d.brand='TELTONIKA'");
}
export async function resolveDeviceProfile(db,protocol,model){
 if(!/teltonika/i.test(protocol||''))return null;
 const key=String(model||'').trim().toUpperCase();
 if(!key)throw Error('Select the exact Teltonika model or Other Teltonika Model.');
 const r=await db.query("SELECT * FROM device_models WHERE brand='TELTONIKA' AND model=$1 AND active",[key]);
 if(!r.rows[0])throw Error('Model is not verified. Select Other Teltonika Model and retain the exact label in notes.');
 return r.rows[0];
}
export async function saveIoMappings(db,vehicleId,rows){
 await db.query('UPDATE vehicle_io_mappings SET enabled=false,updated_at=NOW() WHERE vehicle_id=$1',[vehicleId]);
 for(const r of rows)await db.query(`INSERT INTO vehicle_io_mappings(vehicle_id,source_type,source_channel,function_key,display_name,active_state,config_json,enabled) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT(vehicle_id,source_channel) DO UPDATE SET source_type=EXCLUDED.source_type,function_key=EXCLUDED.function_key,display_name=EXCLUDED.display_name,active_state=EXCLUDED.active_state,config_json=EXCLUDED.config_json,enabled=EXCLUDED.enabled,updated_at=NOW()`,[vehicleId,r.source_type,r.source_channel,r.function_key,r.display_name,r.active_state,JSON.stringify(r.config_json),r.enabled]);
 await db.query("UPDATE vehicles SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{ioMappings}',$2::jsonb) WHERE id=$1",[vehicleId,JSON.stringify(rows)]);
 const driver=rows.find(m=>m.enabled!==false&&m.function_key==='driver_id');
 if(driver)await db.query("UPDATE vehicles SET metadata=jsonb_set(metadata,'{driverIdentification}',COALESCE(metadata->'driverIdentification','{}'::jsonb)||$2::jsonb) WHERE id=$1",[vehicleId,JSON.stringify({sourceKey:'driverIdentifier',type:driver.source_type==='1WIRE'?'IBUTTON':'DRIVER_ID',mappedReader:true})]);
 else await db.query("UPDATE vehicles SET metadata=jsonb_set(metadata,'{driverIdentification}',(metadata->'driverIdentification')-'sourceKey'-'mappedReader') WHERE id=$1 AND metadata->'driverIdentification'->>'mappedReader'='true'",[vehicleId]);
}
export function canViewVehicle(user,v){return user.role==='super_admin'||(String(user.company_id)===String(v.company_id)&&(user.role!=='company_user'||!Array.isArray(user.metadata?.vehicleIds)||user.metadata.vehicleIds.map(String).includes(String(v.id))));}
export function canEditIo(user,company){return user.role==='super_admin'||user.role==='company_admin'&&company?.vehiclePermissions?.['Sensors/I/O']===true;}
export function registerDeviceProfileRoutes(app,{pool,requireAuth,requireSuper,readLiveSnapshots}){
 app.get('/api/sensor-templates',requireAuth,async(_req,res)=>{try{const row=(await pool.query('SELECT data FROM platform_state WHERE id=1')).rows[0];const groups=Array.isArray(row?.data?.sensorGroups)?row.data.sensorGroups:[];res.json(groups.filter(g=>g.model&&Array.isArray(g.mappings)).map(g=>({id:g.id,name:String(g.name||''),model:String(g.model),mappings:g.mappings.filter(m=>m.source_type!=='DOUT'&&m.enabled!==false).map(m=>({source_type:m.source_type,source_channel:m.source_channel,function_key:m.function_key,display_name:m.display_name,active_state:m.active_state,enabled:true,config_json:{sourceKey:m.config_json?.sourceKey,multiplier:m.config_json?.multiplier,offset:m.config_json?.offset,unit:m.config_json?.unit,installationVerified:false}}))})));}catch{res.status(500).json({error:'Sensor templates could not be loaded.'})}});
 app.get('/api/device-models',requireAuth,async(_req,res)=>{try{res.json((await pool.query('SELECT * FROM device_models WHERE active ORDER BY brand,series,model')).rows)}catch{res.status(500).json({error:'Device profiles could not be loaded.'})}});
 app.get('/api/vehicles/:id/io/raw',requireAuth,requireSuper,async(req,res)=>{try{const v=(await pool.query('SELECT traccar_device_id,device_model FROM vehicles WHERE id=$1',[req.params.id])).rows[0];if(!v)return res.status(404).json({error:'Vehicle not found.'});const live=await readLiveSnapshots(),position=live.rows.find(p=>String(p.id)===String(v.traccar_device_id));res.json({model:v.device_model,receivedAt:position?.serverTime||position?.servertime||null,attributes:position?.raw_decoded_attributes||{}})}catch{res.status(500).json({error:'Decoded I/O is unavailable.'})}});
 app.post('/api/device-models',requireAuth,requireSuper,async(req,res)=>{try{
  const model=String(req.body.model||'').trim().toUpperCase(),series=String(req.body.series||model.slice(0,3));if(!/^[A-Z][A-Z0-9-]{2,23}$/.test(model)||model==='OTHER')throw Error('Enter the exact confirmed model label.');
  const caps=validateCapabilities(req.body.capabilities_json);if(req.body.confirmed!==true)throw Error('Confirm capabilities against the exact label and official datasheet.');
  const r=await pool.query("INSERT INTO device_models(brand,protocol_key,series,model,capabilities_json) VALUES('TELTONIKA','teltonika',$1,$2,$3::jsonb) RETURNING *",[series,model,JSON.stringify(caps)]);res.status(201).json(r.rows[0]);
 }catch(e){res.status(e.code==='23505'?409:400).json({error:e.code==='23505'?'This model already exists.':e.message})}});
 app.get('/api/vehicles/:id/io',requireAuth,async(req,res)=>{try{
  const v=(await pool.query('SELECT v.*,(v.expiration_date IS NOT NULL AND v.expiration_date<CURRENT_DATE) AS expired,d.capabilities_json,d.model AS profile_model,c.metadata AS company_metadata FROM vehicles v LEFT JOIN device_models d ON d.id=v.device_model_id LEFT JOIN companies c ON c.id=v.company_id WHERE v.id=$1',[req.params.id])).rows[0];if(!v||!canViewVehicle(req.user,v))return res.status(404).json({error:'Vehicle not found.'});if(v.expired)return res.status(403).json({error:'vehicle_expired',message:'Vehicle subscription expired. Please renew to continue live tracking.'});
  const mappings=(await pool.query('SELECT * FROM vehicle_io_mappings WHERE vehicle_id=$1 AND enabled ORDER BY source_channel',[v.id])).rows;
  res.json({vehicleId:v.id,model:v.profile_model||'Not confirmed',capabilities:v.capabilities_json||{},canEdit:canEditIo(req.user,v.company_metadata),canAssignImmobilizer:req.user.role==='super_admin',mappings});
 }catch{res.status(500).json({error:'Vehicle I/O could not be loaded.'})}});
 app.put('/api/vehicles/:id/io',requireAuth,async(req,res)=>{const db=await pool.connect();try{
  await db.query('BEGIN');const v=(await db.query('SELECT * FROM vehicles WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
  if(!v||!canViewVehicle(req.user,v)){await db.query('ROLLBACK');return res.status(404).json({error:'Vehicle not found.'})}
  const company=(await db.query('SELECT metadata FROM companies WHERE id=$1',[v.company_id])).rows[0]?.metadata;
  if(!canEditIo(req.user,company)){await db.query('ROLLBACK');return res.status(403).json({error:'Sensors/I/O permission is required.'})}
  const model=(await db.query('SELECT capabilities_json FROM device_models WHERE id=$1 AND active',[v.device_model_id])).rows[0];
  const rows=validateIoMappings(req.body.mappings,model?.capabilities_json||{},{confirmOutputs:req.body.confirmOutputs===true});
  if(req.user.role!=='super_admin'){const old=(await db.query("SELECT source_channel,active_state,config_json,display_name FROM vehicle_io_mappings WHERE vehicle_id=$1 AND enabled AND function_key='immobilizer' ORDER BY source_channel",[v.id])).rows;const proposed=rows.filter(x=>x.enabled!==false&&x.function_key==='immobilizer').map(({source_channel,active_state,config_json,display_name})=>({source_channel,active_state,config_json,display_name})).sort((a,b)=>a.source_channel.localeCompare(b.source_channel));if(stableJson(old)!==stableJson(proposed))throw Error('Only a super administrator may change an immobilizer assignment.');}
  if(rows.some(x=>x.function_key==='driver_id'&&!x.config_json.installationVerified))throw Error('Verify the installed reader and its decoded identifier field.');
  await saveIoMappings(db,v.id,rows);
  await db.query("INSERT INTO audit_events(company_id,user_id,action,entity_type,entity_id,detail) VALUES($1,$2,'vehicle_io_updated','vehicle',$3,$4::jsonb)",[v.company_id,req.user.id,String(v.id),JSON.stringify({channels:rows.map(x=>x.source_channel)})]);
  await db.query('COMMIT');res.json({ok:true,mappings:rows});
 }catch(e){await db.query('ROLLBACK');res.status(400).json({error:e.message})}finally{db.release()}});
}
