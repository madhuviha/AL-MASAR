import dotenv from 'dotenv';
import pg from 'pg';
import {validateDrivers,identityKeys} from './driver-identity.mjs';

dotenv.config();
if(!process.env.DATABASE_URL)throw Error('Run from the configured backend directory with DATABASE_URL available.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
let failures=0;
try{
 const states=await pool.query("SELECT company_id,data->'drivers' AS drivers FROM company_state");
 for(const row of states.rows){try{validateDrivers(row.drivers||[]);}catch(e){failures++;console.error('Company '+row.company_id+': '+e.message);}}
 const vehicles=await pool.query("SELECT id,metadata->'driverIdentification' AS profile FROM vehicles WHERE metadata ? 'driverIdentification'");
 for(const row of vehicles.rows){if(row.profile?.sourceKey&&!identityKeys.includes(row.profile.sourceKey)){failures++;console.error('Vehicle '+row.id+': unsupported decoded driver-identity source.');}}
 console.log(`${states.rows.length} companies checked; ${failures} issue(s). No data was changed.`);
 process.exitCode=failures?1:0;
}finally{await pool.end();}
