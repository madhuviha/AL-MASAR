const coordinateLike=value=>/^-?\d{1,2}(?:[.,\s]\s*\d{4,})\s*,\s*-?\d{1,3}(?:[.,\s]\s*\d{4,})(?:\s*,|$)/.test(String(value||'').trim());
const plusCode=value=>/^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}(?:,|\s)/i.test(String(value||'').trim());
const genericNumberedStreet=value=>/^\d+\s+(?:(?:street|road)\s*\d*|.*(?:express\s*way|expressway|highway|hwy))(?=,|\s|$)/i.test(String(value||'').trim());
const ranks={street_address:120,route:105,intersection:100,premise:90,subpremise:89,neighborhood:75,sublocality:70,administrative_area_level_3:65,point_of_interest:45,establishment:40,locality:30,postal_code:20,country:10,plus_code:-100};
const component=(row,type)=>row?.address_components?.find(item=>item?.types?.includes(type))?.long_name||'';
const transportPoi=value=>/^(?:bus\s+stop|bus\s+station|metro\s+station|train\s+station)\b/i.test(String(value||'').trim());
const cleanPart=value=>String(value||'').trim();
const meaningfulPlace=value=>{const clean=cleanPart(value);return Boolean(clean)&&!/^\p{N}+$/u.test(clean)};
const areaPart=row=>component(row,'neighborhood')||component(row,'sublocality_level_1')||component(row,'sublocality')||component(row,'administrative_area_level_3');
const cityPart=row=>{const value=component(row,'locality');return meaningfulPlace(value)?value:''};
const firstFrom=(rows,reader)=>rows.map(reader).map(cleanPart).find(Boolean)||'';
const uniqueAddress=values=>values.map(cleanPart).filter(Boolean).filter((value,index,all)=>all.indexOf(value)===index).join(', ');
const streetAreaAddress=(row,rows=[])=>{
 const street=[component(row,'street_number'),component(row,'route')].map(value=>String(value||'').trim()).filter(Boolean).join(' ');
 return uniqueAddress([street,areaPart(row)||firstFrom(rows,areaPart),cityPart(row)||firstFrom(rows,cityPart)||component(row,'administrative_area_level_2')||component(row,'administrative_area_level_1'),component(row,'country')||firstFrom(rows,item=>component(item,'country'))]);
};
const componentAddress=(row,rows=[])=>uniqueAddress([component(row,'premise')||component(row,'point_of_interest')||component(row,'establishment'),component(row,'route'),areaPart(row)||firstFrom(rows,areaPart),cityPart(row)||firstFrom(rows,cityPart)||component(row,'administrative_area_level_2'),component(row,'country')||firstFrom(rows,item=>component(item,'country'))]);
const areaAddress=(row,rows=[])=>uniqueAddress([areaPart(row)||firstFrom(rows,areaPart),cityPart(row)||firstFrom(rows,cityPart)||component(row,'administrative_area_level_2'),component(row,'country')||firstFrom(rows,item=>component(item,'country'))]);

export const validGeocodeCoordinates=(latitude,longitude)=>Number.isFinite(Number(latitude))&&Number.isFinite(Number(longitude))&&Math.abs(Number(latitude))<=90&&Math.abs(Number(longitude))<=180;
export const geocodeCacheKey=(latitude,longitude)=>validGeocodeCoordinates(latitude,longitude)?`${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`:'';
export const readableAddress=value=>{const clean=String(value||'').trim();return clean.length>=5&&clean.length<=500&&!coordinateLike(clean)&&!plusCode(clean)&&!transportPoi(clean)&&!genericNumberedStreet(clean)};
export function bestGoogleAddress(rows=[]){
 const ranked=rows.map((row,index)=>{const address=String(row?.formatted_address||'').trim(),types=Array.isArray(row?.types)?row.types:[],machine=coordinateLike(address)||plusCode(address),transport=transportPoi(address)||types.some(type=>['bus_station','transit_station','subway_station','train_station'].includes(type));return {row,index,address,types,machine,transport,rank:Math.max(...types.map(type=>ranks[type]??0),0)-(machine?300:0)-(transport?250:0)}}).filter(item=>item.address).sort((a,b)=>b.rank-a.rank||a.index-b.index);
 const best=ranked[0];if(!best)return'';const street=ranked.filter(item=>item.types.some(type=>['street_address','route','intersection'].includes(type))).map(item=>streetAreaAddress(item.row,rows)).find(value=>value&&!genericNumberedStreet(value));if(street)return street;if(!best.machine&&!best.transport&&!genericNumberedStreet(best.address))return best.address;if(genericNumberedStreet(best.address)){const area=rows.map(row=>areaAddress(row,rows)).find(value=>value&&value.split(',').length>=2);if(area)return area}return componentAddress(best.row,rows)||ranked.find(item=>!item.machine&&!item.transport&&!genericNumberedStreet(item.address))?.address||best.address||'';
}

export const geocoderProviders=['nominatim','geoapify','locationiq','tomtom','mapbox','here','maptiler','bing'];
const providerKey=(provider,config)=>({geoapify:config.geoapifyKey,locationiq:config.locationIqKey,tomtom:config.tomtomGeocodingKey||config.tomtomMapsKey,mapbox:config.mapboxGeocodingToken||config.mapboxToken,here:config.hereGeocodingKey||config.hereMapsKey,maptiler:config.mapTilerGeocodingKey||config.mapTilerKey,bing:config.bingMapsKey}[provider]||'');
const providerAddress=(provider,data)=>{
 if(provider==='geoapify'){const p=data?.features?.[0]?.properties||{};return p.formatted||uniqueAddress([p.address_line1||p.street,p.suburb||p.district,p.city,p.country]);}
 if(provider==='locationiq'||provider==='nominatim')return data?.display_name||'';
 if(provider==='tomtom')return data?.addresses?.[0]?.address?.freeformAddress||'';
 if(provider==='mapbox'){const f=data?.features?.[0]||{};return f.properties?.full_address||f.place_name||f.properties?.name||'';}
 if(provider==='here')return data?.items?.[0]?.address?.label||data?.items?.[0]?.title||'';
 if(provider==='maptiler')return data?.features?.[0]?.place_name||data?.features?.[0]?.text||'';
 if(provider==='bing')return data?.resourceSets?.[0]?.resources?.[0]?.address?.formattedAddress||'';
 return '';
};

export async function requestReverseGeocode(provider,latitude,longitude,config,http){
 const key=String(providerKey(provider,config)||'').trim(),lat=Number(latitude),lon=Number(longitude),timeout=10000;
 if(provider!=='nominatim'&&!key)throw Error(`geocoder_key_missing_${provider}`);
 let response;
 if(provider==='geoapify')response=await http.get('https://api.geoapify.com/v1/geocode/reverse',{params:{lat,lon,lang:'en',format:'geojson',apiKey:key},timeout});
 else if(provider==='locationiq')response=await http.get('https://us1.locationiq.com/v1/reverse',{params:{lat,lon,key,format:'json',addressdetails:1,'accept-language':'en'},timeout});
 else if(provider==='nominatim')response=await http.get(String(config.nominatimApiUrl||'https://nominatim.openstreetmap.org').replace(/\/$/,'')+'/reverse',{params:{lat,lon,format:'jsonv2',addressdetails:1,'accept-language':'en'},headers:{'User-Agent':'INVIHA-Track/1.0 (support@inviha.com)'},timeout});
 else if(provider==='tomtom')response=await http.get(`https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json`,{params:{key,language:'en-US'},timeout});
 else if(provider==='mapbox')response=await http.get('https://api.mapbox.com/search/geocode/v6/reverse',{params:{latitude:lat,longitude:lon,language:'en',access_token:key},timeout});
 else if(provider==='here')response=await http.get('https://revgeocode.search.hereapi.com/v1/revgeocode',{params:{at:`${lat},${lon}`,lang:'en-US',apiKey:key},timeout});
 else if(provider==='maptiler')response=await http.get(`https://api.maptiler.com/geocoding/${lon},${lat}.json`,{params:{key,language:'en'},timeout});
 else if(provider==='bing')response=await http.get(`https://dev.virtualearth.net/REST/v1/Locations/${lat},${lon}`,{params:{key,o:'json'},timeout});
 else throw Error('geocoder_provider_invalid');
 const address=String(providerAddress(provider,response.data)||'').trim();
 if(!readableAddress(address))throw Error('address_not_found');
 return {address,provider};
}

export function createGoogleGeocoder({pool,http,now=()=>Date.now()}){
 const memory=new Map(),pending=new Map(),providerFailures=new Map();let settings={value:null,until:0},queue=Promise.resolve(),nextRequestAt=0;
 const readSettings=async()=>{if(settings.until>now())return settings.value;const row=(await pool.query("SELECT COALESCE(data->'settings','{}'::jsonb) AS settings FROM platform_state WHERE id=1")).rows[0];const raw=row?.settings&&typeof row.settings==='object'?row.settings:{};settings={value:{...raw,geocoderPrimary:geocoderProviders.includes(String(raw.geocoderPrimary||'').toLowerCase())?String(raw.geocoderPrimary).toLowerCase():'nominatim',geocoderFallback:geocoderProviders.includes(String(raw.geocoderFallback||'').toLowerCase())?String(raw.geocoderFallback).toLowerCase():'none',geocoderCacheDays:Math.max(1,Math.min(3650,Number(raw.geocoderCacheDays)||30))},until:now()+60000};return settings.value};
 const cacheValid=(row,config)=>row?.provider==='manual-verified'||now()-new Date(row?.updated_at||0).getTime()<=config.geocoderCacheDays*86400000;
 const cachedDetailed=async(latitude,longitude)=>{const key=geocodeCacheKey(latitude,longitude);if(!key)return null;const config=await readSettings();if(config.geocoderCacheEnabled===false)return null;const local=memory.get(key);if(local&&local.until>now())return local.address?{address:local.address,provider:local.provider}:null;const row=(await pool.query('SELECT address,provider,updated_at FROM reverse_geocode_cache WHERE coordinate_key=$1',[key])).rows[0];const stored=cacheValid(row,config)?row?.address:null,address=stored&&!genericNumberedStreet(stored)&&!transportPoi(stored)?String(stored):null;memory.set(key,{address,provider:row?.provider||'cache',until:now()+(address?86400000:30000)});return address?{address,provider:row?.provider||'cache'}:null};
 const cached=async(latitude,longitude)=>(await cachedDetailed(latitude,longitude))?.address||null;
 const cachedMany=async(points=[])=>{const result=new Map(),config=await readSettings();if(config.geocoderCacheEnabled===false)return result;const missing=[];for(const point of points){const key=geocodeCacheKey(point?.latitude,point?.longitude);if(!key)continue;const local=memory.get(key);if(local&&local.until>now()){if(local.address)result.set(key,local.address)}else missing.push(key)}if(missing.length){const keys=[...new Set(missing)],rows=(await pool.query('SELECT coordinate_key,address,provider,updated_at FROM reverse_geocode_cache WHERE coordinate_key=ANY($1::text[])',[keys])).rows,found=new Map(rows.map(row=>[row.coordinate_key,row]));for(const key of keys){const row=found.get(key),stored=cacheValid(row,config)?row?.address:null,address=stored&&!genericNumberedStreet(stored)&&!transportPoi(stored)?String(stored):null;memory.set(key,{address,provider:row?.provider||'cache',until:now()+(address?86400000:30000)});if(address)result.set(key,address)}}return result};
 const save=async(latitude,longitude,address,provider='server-geocoder')=>{const key=geocodeCacheKey(latitude,longitude),clean=String(address||'').trim();if(!key||!readableAddress(clean))throw Error('invalid_geocode_result');const result=await pool.query(`INSERT INTO reverse_geocode_cache(coordinate_key,latitude,longitude,address,provider,updated_at) VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(coordinate_key) DO UPDATE SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,address=EXCLUDED.address,provider=EXCLUDED.provider,updated_at=NOW() WHERE reverse_geocode_cache.provider<>'manual-verified' OR EXCLUDED.provider='manual-verified' RETURNING address,provider`,[key,Number(latitude),Number(longitude),clean,provider]);const stored=String(result.rows[0]?.address||clean),storedProvider=result.rows[0]?.provider||provider;memory.set(key,{address:stored,provider:storedProvider,until:now()+86400000});return stored};
 const call=async(provider,latitude,longitude,config)=>{if(providerFailures.get(provider)>now())throw Error(`geocoder_temporarily_unavailable_${provider}`);const intervals={nominatim:1100,locationiq:550,geoapify:220};const wait=Math.max(0,nextRequestAt-now());if(wait)await new Promise(resolve=>setTimeout(resolve,wait));nextRequestAt=now()+(intervals[provider]||150);try{return await requestReverseGeocode(provider,latitude,longitude,config,http)}catch(error){providerFailures.set(provider,now()+30000);throw error}};
 const reverseDetailed=async(latitude,longitude)=>{const key=geocodeCacheKey(latitude,longitude);if(!key)throw Error('invalid_coordinates');const existing=await cachedDetailed(latitude,longitude);if(existing)return existing;if(pending.has(key))return pending.get(key);const job=queue.then(async()=>{const config=await readSettings(),providers=[config.geocoderPrimary,config.geocoderFallback].filter((value,index,all)=>value&&value!=='none'&&all.indexOf(value)===index);let lastError=Error('geocoder_not_configured');for(const [index,provider] of providers.entries()){try{const customUrl=String(index===0?config.geocoderPrimaryApiUrl||'':config.geocoderAddressApiUrl||'').trim(),providerConfig=provider==='nominatim'&&customUrl?{...config,nominatimApiUrl:customUrl}:config,result=await call(provider,latitude,longitude,providerConfig);if(config.geocoderCacheEnabled!==false)await save(latitude,longitude,result.address,provider);return result}catch(error){lastError=error}}throw lastError});queue=job.catch(()=>undefined);pending.set(key,job);try{return await job}finally{pending.delete(key)}};
 const reverse=async(latitude,longitude)=>(await reverseDetailed(latitude,longitude)).address;
 const search=async query=>{const value=String(query||'').trim();if(value.length<2)return[];const job=queue.then(async()=>{const config=await readSettings(),base=String(config.nominatimApiUrl||'https://nominatim.openstreetmap.org').replace(/\/$/,''),wait=Math.max(0,nextRequestAt-now());if(wait)await new Promise(resolve=>setTimeout(resolve,wait));nextRequestAt=now()+1100;const response=await http.get(base+'/search',{params:{q:value,format:'jsonv2',addressdetails:1,limit:5,countrycodes:'qa','accept-language':'en'},headers:{'User-Agent':'INVIHA-Track/1.0 (support@inviha.com)'},timeout:10000});return (Array.isArray(response.data)?response.data:[]).map(row=>({label:String(row.display_name||'').trim(),lat:Number(row.lat),lng:Number(row.lon)})).filter(row=>row.label&&Number.isFinite(row.lat)&&Number.isFinite(row.lng))});queue=job.catch(()=>undefined);return job};
 return {cached,cachedDetailed,cachedMany,reverse,reverseDetailed,save,search};
}
