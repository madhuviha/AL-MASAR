import pg from '/opt/inviha-backend/node_modules/pg/lib/index.js';
import dotenv from '/opt/inviha-backend/node_modules/dotenv/lib/main.js';

dotenv.config({path:'/opt/inviha-backend/.env'});
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const names=['googleMapsKey','googleServerGeocodingKey','mapillaryAccessToken','mapTilerKey','mapboxToken','hereMapsKey','tomtomMapsKey','yandexMapsKey','geoapifyKey','locationIqKey','tomtomGeocodingKey','mapboxGeocodingToken','hereGeocodingKey','mapTilerGeocodingKey','bingMapsKey','streetviewApiKey','captchaSiteKey','captchaSecretKey'];
try{
 const result=await pool.query('SELECT data FROM platform_state WHERE id=1');
 const settings=result.rows[0]?.data?.settings||{};
 console.log(JSON.stringify(Object.fromEntries(names.map(name=>[name,{present:Boolean(String(settings[name]||'').trim()),length:String(settings[name]||'').length}]))));
}finally{
 await pool.end();
}
