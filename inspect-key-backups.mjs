import fs from 'node:fs';

const names=['googleMapsKey','googleServerGeocodingKey','mapillaryAccessToken','mapTilerKey','mapboxToken','hereMapsKey','tomtomMapsKey','yandexMapsKey','geoapifyKey','locationIqKey','tomtomGeocodingKey','mapboxGeocodingToken','hereGeocodingKey','mapTilerGeocodingKey','bingMapsKey','streetviewApiKey','captchaSiteKey','captchaSecretKey'];
const collect=(value,out={},path='root')=>{
 if(!value||typeof value!=='object')return out;
 for(const [key,item] of Object.entries(value)){
  if(names.includes(key)&&String(item||'').trim())out[key]={length:String(item).length,path:`${path}.${key}`};
  if(item&&typeof item==='object')collect(item,out,`${path}.${key}`);
 }
 return out;
};
for(const file of process.argv.slice(2)){
 try{
  const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
  console.log(JSON.stringify({file,keys:collect(parsed)}));
 }catch(error){console.log(JSON.stringify({file,error:error.message}))}
}
