import {mapDeviceTelemetry} from './device-profile-rules.mjs';
import {syncDrivers,identifyPosition} from './driver-identification.mjs';

// Read stored decoded packets as well as latest snapshots: a brief tag event
// must not disappear between polls. Durable cursors catch up after downtime.
export function startDriverWorker({pool,trackingApi,livePool=null,intervalMs=2000,onChange=()=>{}}){
 let busy=false;
 async function tick(){
  if(busy)return;busy=true;
  try{
   const companies=await pool.query("SELECT c.id FROM companies c JOIN company_state s ON s.company_id=c.id WHERE c.status='active'");
   for(const co of companies.rows){
    const vehicles=(await pool.query("SELECT v.*,c.scanned_until,c.last_position_id FROM vehicles v LEFT JOIN driver_identity_cursor c ON c.company_id=v.company_id AND c.vehicle_id=v.id WHERE v.company_id=$1 AND v.active AND v.traccar_device_id IS NOT NULL AND COALESCE(v.metadata->>'archived','false')<>'true'",[co.id])).rows;
    const now=Date.now(),batches=[];
    for(const v of vehicles){
     try{
      const start=v.scanned_until?Date.parse(v.scanned_until):now-300000;
      const end=Math.min(now,start+300000);
      if(livePool){
       const result=await livePool.query('SELECT id,deviceid AS "deviceId",devicetime AS "deviceTime",fixtime AS "fixTime",servertime AS "serverTime",protocol,attributes FROM tc_positions WHERE deviceid=$1 AND (($2::bigint IS NOT NULL AND id>$2) OR ($2::bigint IS NULL AND servertime>=$3)) ORDER BY id LIMIT 500',[v.traccar_device_id,v.last_position_id||null,new Date(start).toISOString()]);
       const positions=result.rows.map(p=>({...p,attributes:typeof p.attributes==='string'?JSON.parse(p.attributes):p.attributes||{}}));
       batches.push({vehicle:v,end:now,positions,lastPositionId:positions.at(-1)?.id||v.last_position_id||null});
      }else{
       const r=await trackingApi.get('/api/positions',{params:{deviceId:v.traccar_device_id,from:new Date(start-60000).toISOString(),to:new Date(end).toISOString()},headers:{Accept:'application/json'}});
       if(!Array.isArray(r.data))throw Error('Invalid position history');
       batches.push({vehicle:v,end,positions:r.data.filter(p=>String(p.deviceId)===String(v.traccar_device_id))});
      }
     }catch(e){console.error('Driver telemetry unavailable for vehicle',v.id,e.message);}
    }
    if(!batches.length)continue;
    const db=await pool.connect();
    try{
     await db.query('BEGIN');
     const state=(await db.query('SELECT data FROM company_state WHERE company_id=$1 FOR UPDATE',[co.id])).rows[0];
     if(!state){await db.query('ROLLBACK');continue;}
     await syncDrivers(db,co.id,state.data.drivers||[]);
     const ordered=batches.flatMap(b=>b.positions.map(position=>({vehicle:b.vehicle,position}))).sort((a,b)=>Date.parse(a.position.deviceTime||a.position.serverTime||a.position.fixTime)-Date.parse(b.position.deviceTime||b.position.serverTime||b.position.fixTime));
     const alerts=[];let changed=false;
     for(const item of ordered){
      const result=await identifyPosition(db,item.vehicle,mapDeviceTelemetry(item.position,item.vehicle.metadata?.ioMappings||[]));
      if(result)changed=true;
      if(result?.status==='unknown'&&item.vehicle.metadata?.driverIdentification?.unknownAlert===true)alerts.push({id:'driver-'+result.event_id,companyId:co.id,vehicleId:item.vehicle.id,deviceId:item.vehicle.traccar_device_id,vehicleName:item.vehicle.name,type:'Unknown Driver',status:'New',read:false,createdAt:result.identified_at,identifier:result.identifier,message:'Unregistered driver identifier: '+result.identifier});
     }
     for(const b of batches){await db.query('INSERT INTO driver_identity_cursor(company_id,vehicle_id,scanned_until) VALUES($1,$2,$3) ON CONFLICT(company_id,vehicle_id) DO UPDATE SET scanned_until=GREATEST(driver_identity_cursor.scanned_until,EXCLUDED.scanned_until)',[co.id,b.vehicle.id,new Date(b.end).toISOString()]);if(b.lastPositionId)await db.query('UPDATE driver_identity_cursor SET last_position_id=GREATEST(last_position_id,$3) WHERE company_id=$1 AND vehicle_id=$2',[co.id,b.vehicle.id,b.lastPositionId]);}
     if(alerts.length)await db.query("UPDATE company_state SET data=jsonb_set(data,'{alerts}',COALESCE(data->'alerts','[]'::jsonb)||$2::jsonb),version=version+1,updated_at=NOW() WHERE company_id=$1",[co.id,JSON.stringify(alerts)]);
     await db.query('COMMIT');if(changed)onChange(co.id);
    }catch(e){await db.query('ROLLBACK');console.error('Driver identification failed for company',co.id,e.message);}finally{db.release();}
   }
  }catch(e){console.error('Driver worker unavailable',e.message);}finally{busy=false;}
 }
 const timer=setInterval(tick,intervalMs);timer.unref();tick();return()=>clearInterval(timer);
}
