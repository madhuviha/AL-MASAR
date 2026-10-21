#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/inviha-backend
node --input-type=module <<'NODE'
import dotenv from 'dotenv';
import pg from 'pg';
import axios from 'axios';
import {bestGoogleAddress} from './google-geocoding.mjs';
dotenv.config();
const {Pool}=pg;
const appPool=new Pool({connectionString:process.env.DATABASE_URL});
const livePool=new Pool({connectionString:process.env.TRACCAR_DATABASE_URL});
try {
  const device=(await livePool.query("SELECT d.id,d.name,d.uniqueid,p.latitude,p.longitude,p.devicetime,p.servertime FROM tc_devices d LEFT JOIN tc_positions p ON p.id=d.positionid WHERE lower(d.name)=lower($1) OR d.uniqueid=$2 ORDER BY d.id LIMIT 1",['khawla','353201355124006'])).rows[0];
  if(!device) throw Error('khawla_not_found');
  const key=(await appPool.query("SELECT COALESCE(data->'settings'->>'googleServerGeocodingKey','') AS key FROM platform_state WHERE id=1")).rows[0].key;
  if(!key) throw Error('google_server_key_missing');
  const response=await axios.get('https://maps.googleapis.com/maps/api/geocode/json',{params:{latlng:`${device.latitude},${device.longitude}`,language:'en',region:'qa',key},timeout:10000});
  console.log(JSON.stringify({
    vehicle:device.name,
    imei:device.uniqueid,
    latitude:Number(device.latitude),
    longitude:Number(device.longitude),
    deviceTime:device.devicetime,
    serverTime:device.servertime,
    googleStatus:response.data?.status,
    softwareSelected:bestGoogleAddress(response.data?.results||[]),
    googleFormattedAddresses:(response.data?.results||[]).slice(0,8).map(r=>r.formatted_address)
  },null,2));
} finally {
  await appPool.end();
  await livePool.end();
}
NODE
