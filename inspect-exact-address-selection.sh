#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/inviha-backend
node --input-type=module <<'NODE'
import dotenv from 'dotenv';import pg from 'pg';import axios from 'axios';import {bestGoogleAddress} from './google-geocoding.mjs';
dotenv.config();const {Pool}=pg;const pool=new Pool({connectionString:process.env.DATABASE_URL});
try{const key=(await pool.query("SELECT COALESCE(data->'settings'->>'googleServerGeocodingKey','') AS key FROM platform_state WHERE id=1")).rows[0].key;const response=await axios.get('https://maps.googleapis.com/maps/api/geocode/json',{params:{latlng:'25.2167,51.4291',language:'en',region:'qa',key},timeout:10000});console.log('status='+response.data.status);console.log('selected='+bestGoogleAddress(response.data.results||[]));for(const row of response.data.results||[])console.log('candidate='+row.formatted_address)}finally{await pool.end()}
NODE