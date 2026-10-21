import fs from 'node:fs';
import pg from '/opt/inviha-backend/node_modules/pg/lib/index.js';
import dotenv from '/opt/inviha-backend/node_modules/dotenv/lib/main.js';

dotenv.config({path:'/opt/inviha-backend/.env'});
const sourceFile='/var/backups/inviha-map-key-placement-20261002T162819Z/platform-state-before.json';
const source=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
const sourceSettings=source?.data?.settings||source?.settings||{};
const recoverable=['googleMapsKey','googleServerGeocodingKey','mapillaryAccessToken','mapTilerKey','mapboxToken','hereMapsKey','tomtomMapsKey','yandexMapsKey','geoapifyKey','locationIqKey','tomtomGeocodingKey','mapboxGeocodingToken','hereGeocodingKey','mapTilerGeocodingKey','bingMapsKey','streetviewApiKey','captchaSiteKey','captchaSecretKey'];
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
 await pool.query('BEGIN');
 const result=await pool.query('SELECT data FROM platform_state WHERE id=1 FOR UPDATE');
 const data=result.rows[0]?.data||{};
 const settings={...(data.settings||{})};
 const stamp=new Date().toISOString().replace(/[:.]/g,'').replace('Z','Z');
 const backupDir=`/var/backups/inviha-api-key-recovery-${stamp}`;
 fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
 fs.writeFileSync(`${backupDir}/platform-state-before.json`,JSON.stringify({data},null,2),{mode:0o600});
 const restored=[];
 for(const name of recoverable){
  if(!String(settings[name]||'').trim()&&String(sourceSettings[name]||'').trim()){
   settings[name]=sourceSettings[name];
   restored.push(name);
  }
 }
 if(!restored.length)throw new Error('No recoverable missing keys were found.');
 await pool.query('UPDATE platform_state SET data=$1::jsonb,version=version+1,updated_at=NOW() WHERE id=1',[JSON.stringify({...data,settings})]);
 await pool.query('COMMIT');
 console.log(JSON.stringify({restored,backupDir}));
}catch(error){
 await pool.query('ROLLBACK');
 throw error;
}finally{
 await pool.end();
}
