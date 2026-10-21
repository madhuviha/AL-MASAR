// Only decoded identity attributes are accepted. Raw AVL IO needs a verified
// decoder/profile mapping, never a generic sensor such as battery or ignition.
export const identityKeys=['driverUniqueId','driverIdentifier','driverId','driver_id','driverID','rfid','ibutton','iButton','iButtonId','ibutton_id','oneWire','1wire'];
function byteArray(value){
 if(Array.isArray(value)&&value.length>0&&value.length<=64&&value.every(x=>Number.isInteger(x)&&x>=0&&x<=255))return value;
 if(typeof Uint8Array!=='undefined'&&value instanceof Uint8Array&&value.length>0&&value.length<=64)return [...value];
 if(value&&typeof value==='object'&&value.type==='Buffer'&&Array.isArray(value.data))return byteArray(value.data);
 return null;
}
export function identifierRaw(value){
 const bytes=byteArray(value);
 if(bytes)return bytes.map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
 return typeof value==='string'?value:String(value??'');
}
export function normalizeIdentifier(value){
 if(typeof value==='number'&&!Number.isSafeInteger(value))return null;
 if(!['string','number'].includes(typeof value)&&!byteArray(value))return null;
 let id=identifierRaw(value).trim().toUpperCase();
 if(/^0X[0-9A-F\s:.-]+$/.test(id))id=id.slice(2);
 const compact=id.replace(/[\s:.-]/g,'');
 if(compact.length>0&&compact.length%2===0&&/^[0-9A-F]+$/.test(compact)&&/[^0-9A-F]/.test(id))id=compact;
 return id.length>0&&id.length<=128&&!/^0+$/.test(id)&&/^[A-Z0-9:_\-\s]+$/.test(id)?id:null;
}
function byteHex(value){
 const id=identifierRaw(value).trim().toUpperCase().replace(/^0X/,'');
 const compact=id.replace(/[\s:_-]/g,'');
 if(!compact||compact.length>128||compact.length%2||!/^[0-9A-F]+$/.test(compact))return null;
 return compact;
}
function addHexAliases(out,hex){
 if(!hex)return;
 out.add(hex);
 // Teltonika event 78 renders the reader as a fixed-width 8-byte hex value;
 // GT06 iButton packets commonly render the same value as decimal and drop
 // leading zero bytes. Keep the exact key and add byte-equivalent forms.
 if(hex.length<=16)out.add(hex.padStart(16,'0'));
 const withoutZeroBytes=hex.replace(/^(?:00)+(?=[0-9A-F]{2})/,'');
 if(withoutZeroBytes)out.add(withoutZeroBytes);
 try{const decimal=BigInt('0x'+hex).toString(10);if(decimal.length<=128)out.add(decimal)}catch{}
}
/** Exact plus protocol-safe byte representations for reader lookup. */
export function identifierAliases(value,type='DRIVER_ID'){
 const normalized=normalizeIdentifier(value),out=new Set();if(!normalized)return [];
 out.add(normalized);
 if(!['IBUTTON','DRIVER_ID'].includes(String(type).toUpperCase()))return [...out];
 const hex=byteHex(normalized);if(hex)addHexAliases(out,hex);
 const compact=normalized.replace(/[\s:_-]/g,'');
 if(/^\d+$/.test(compact)){
  try{addHexAliases(out,BigInt(compact).toString(16).toUpperCase())}catch{}
 }
 return [...out];
}
export function driverIdentifiers(driver){
 if(driver.identifiers!==undefined&&!Array.isArray(driver.identifiers))throw Error('Driver identifiers must be a list.');
 const rows=Array.isArray(driver.identifiers)?driver.identifiers:
  driver.rfid&&driver.rfid===driver.ibutton?[{type:'DRIVER_ID',identifier:driver.rfid}]:[{type:'RFID',identifier:driver.rfid},{type:'IBUTTON',identifier:driver.ibutton}];
 const seen=new Set();
 if(rows.some(r=>!r||typeof r!=='object'))throw Error('Enter a valid driver identifier.');
 return rows.filter(r=>r.active!==false&&normalizeIdentifier(r.identifier)).map(r=>{
  const identifier=normalizeIdentifier(r.identifier),type=String(r.type||'').toUpperCase();
  if(!identifier||!['RFID','IBUTTON','DRIVER_ID'].includes(type))throw Error('Enter a valid RFID or iButton identifier as text.');
  if(seen.has(identifier))return null;seen.add(identifier);
  return {identifier,type,raw:identifierRaw(r.identifier)};
 }).filter(Boolean);
}
export function validateDrivers(drivers){
 if(!Array.isArray(drivers))throw Error('Drivers must be a list.');
 const tags=new Map(),ids=new Set();
 for(const d of drivers){
  if(!d||typeof d!=='object'||!String(d.name||'').trim())throw Error('Each driver requires a name and valid identifiers.');
  if(!d.id||ids.has(String(d.id)))throw Error('Each driver must have a unique ID.');ids.add(String(d.id));
  const identifiers=driverIdentifiers(d);
  if(String(d.status||'Active').toLowerCase()!=='active')continue;
  for(const row of identifiers)for(const key of identifierAliases(row.identifier,row.type)){if(tags.has(key)&&tags.get(key)!==String(d.id))throw Error('An active identifier or byte-equivalent value already belongs to another driver in this company.');tags.set(key,String(d.id));}
 }
 return drivers;
}
export function extractIdentifier(position,profile={}){
 if(profile.enabled===false)return null;
 if(profile.sourceKey&&!identityKeys.includes(profile.sourceKey))throw Error('Driver identification requires a decoded identity attribute.');
 const a=position?.attributes||{},keys=profile.sourceKey?[profile.sourceKey]:identityKeys;
 for(const key of keys){const normalized=normalizeIdentifier(a[key]);if(!normalized)continue;
  const type=['RFID','IBUTTON'].includes(profile.type)?profile.type:/ibutton|onewire|driver_id/i.test(key)?'IBUTTON':key.toLowerCase()==='rfid'?'RFID':'DRIVER_ID';
  return {raw:identifierRaw(a[key]),normalized,type,source:key};
 }
 return null;
}
export const unidentified=()=>({status:'not_identified',name:'Not identified',driver_id:null,identifier:null,type:null,identified_at:null});
export function sessionDriver(row){return row?{status:row.driver_id?'matched':'unknown',name:row.driver_name||'Unknown Driver',driver_id:row.driver_id,identifier:row.identifier_raw,type:row.identifier_type,source:row.source,identified_at:row.last_seen_at||row.started_at,started_at:row.started_at,last_seen_at:row.last_seen_at||row.started_at,ended_at:row.ended_at,session_id:row.id}:unidentified();}
