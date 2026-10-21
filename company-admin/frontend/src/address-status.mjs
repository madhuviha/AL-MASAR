export function addressFailure(error){const code=String(error?.code||error?.message||error||'').toUpperCase();if(code.includes('ADDRESS_NOT_FOUND')||code.includes('404'))return {label:'No street address found',reason:'OpenStreetMap did not return a readable address for this GPS point.'};if(code.includes('INVALID'))return {label:'Invalid GPS location',reason:'A valid latitude and longitude are required.'};return {label:'Address lookup unavailable',reason:'The OpenStreetMap address service could not respond. Please retry shortly.'}}

const addressRank={street_address:120,route:105,intersection:100,premise:90,subpremise:89,neighborhood:75,sublocality:70,administrative_area_level_3:65,point_of_interest:45,establishment:40,locality:30,postal_code:20,country:10,plus_code:-100};
const looksLikePlusCode=value=>/^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}(?:,|\s)/i.test(String(value||'').trim());
const looksLikeCoordinates=value=>/^-?\d{1,2}(?:[.,\s]\s*\d{4,})\s*,\s*-?\d{1,3}(?:[.,\s]\s*\d{4,})(?:\s*,|$)/.test(String(value||'').trim());
export const looksLikeGenericNumberedStreet=value=>/^\d+\s+(?:(?:street|road)\s*\d*|.*(?:express\s*way|expressway|highway|hwy))(?=,|\s|$)/i.test(String(value||'').trim());
export const looksLikeTransportPoi=value=>/^(?:bus\s+stop|bus\s+station|metro\s+station|train\s+station)\b/i.test(String(value||'').trim());
const componentName=(row,type)=>row?.address_components?.find(component=>component?.types?.includes(type))?.long_name||'';
const cleanPart=value=>String(value||'').trim();
const meaningfulPlace=value=>{const clean=cleanPart(value);return Boolean(clean)&&!/^\p{N}+$/u.test(clean)};
const areaPart=row=>componentName(row,'neighborhood')||componentName(row,'sublocality_level_1')||componentName(row,'sublocality')||componentName(row,'administrative_area_level_3');
const cityPart=row=>{const value=componentName(row,'locality');return meaningfulPlace(value)?value:''};
const firstFrom=(rows,reader)=>rows.map(reader).map(cleanPart).find(Boolean)||'';
const uniqueAddress=values=>[...new Set(values.map(cleanPart).filter(Boolean))].join(', ');
const streetAreaComponents=(row,rows=[])=>{
 const street=[componentName(row,'street_number'),componentName(row,'route')].map(value=>String(value||'').trim()).filter(Boolean).join(' ');
 return uniqueAddress([street,areaPart(row)||firstFrom(rows,areaPart),cityPart(row)||firstFrom(rows,cityPart)||componentName(row,'administrative_area_level_2')||componentName(row,'administrative_area_level_1'),componentName(row,'country')||firstFrom(rows,item=>componentName(item,'country'))]);
};
const readableComponents=(row,rows=[])=>uniqueAddress([componentName(row,'premise')||componentName(row,'point_of_interest')||componentName(row,'establishment'),componentName(row,'route'),areaPart(row)||firstFrom(rows,areaPart),cityPart(row)||firstFrom(rows,cityPart)||componentName(row,'administrative_area_level_2'),componentName(row,'country')||firstFrom(rows,item=>componentName(item,'country'))]);
const readableArea=(row,rows=[])=>uniqueAddress([areaPart(row)||firstFrom(rows,areaPart),cityPart(row)||firstFrom(rows,cityPart)||componentName(row,'administrative_area_level_2'),componentName(row,'country')||firstFrom(rows,item=>componentName(item,'country'))]);
export function bestGeocodingAddress(rows=[]){
 const ranked=rows.map((row,index)=>{const types=Array.isArray(row?.types)?row.types:[],formatted=String(row?.formatted_address||'').trim(),machineLabel=looksLikePlusCode(formatted)||looksLikeCoordinates(formatted),transport=looksLikeTransportPoi(formatted)||types.some(type=>['bus_station','transit_station','subway_station','train_station'].includes(type)),rank=Math.max(...types.map(type=>addressRank[type]??0),0)-(machineLabel?300:0)-(transport?250:0);return {row,index,rank,formatted,machineLabel,transport,types}}).filter(x=>x.formatted).sort((a,b)=>b.rank-a.rank||a.index-b.index);
 const best=ranked[0];if(!best)return '';
 const streetAddress=ranked.filter(item=>item.types.some(type=>['street_address','route','intersection'].includes(type))).map(item=>streetAreaComponents(item.row,rows)).find(value=>value&&!looksLikeGenericNumberedStreet(value))||'';
 if(streetAddress&&!looksLikeGenericNumberedStreet(streetAddress))return streetAddress;
 if(!best.machineLabel&&!best.transport&&!looksLikeGenericNumberedStreet(best.formatted))return best.formatted;
 if(looksLikeGenericNumberedStreet(best.formatted)){
  const area=rows.map(row=>readableArea(row,rows)).find(value=>value&&value.split(',').length>=2);
  if(area)return area;
 }
 return readableComponents(best.row,rows)||ranked.find(item=>!item.machineLabel&&!item.transport&&!looksLikeGenericNumberedStreet(item.formatted))?.formatted||best.formatted||'';
}
export function validCoordinates(p){return p?.latitude!=null&&p?.longitude!=null&&p.latitude!==''&&p.longitude!==''&&Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))&&Math.abs(Number(p.latitude))<=90&&Math.abs(Number(p.longitude))<=180}
