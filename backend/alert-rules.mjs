import crypto from 'node:crypto';

const normalizedText=value=>String(value??'').trim().toLowerCase();

const vehicleIds=rule=>Array.isArray(rule?.vehicleIds)
  ? rule.vehicleIds.filter(id=>id!==null&&id!==undefined&&String(id).trim()!=='')
  : [];

export function ruleTargetsVehicle(rule,vehicleId){
 const ids=vehicleIds(rule);
 if(rule?.allVehicles===true)return true;
 if(rule?.allVehicles===false)return ids.some(id=>String(id)===String(vehicleId));
 // Older saved rules did not have allVehicles. Their empty selection meant all.
 return ids.length===0||ids.some(id=>String(id)===String(vehicleId));
}

const coversAllVehicles=rule=>rule?.allVehicles===true||(rule?.allVehicles!==false&&vehicleIds(rule).length===0);
const mergedChannels=(previous,rule)=>Object.fromEntries(
 ['inApp','push','email','sms','whatsapp']
  .filter(channel=>previous[channel]!==undefined||rule[channel]!==undefined)
  .map(channel=>[channel,previous[channel]===true||rule[channel]===true])
);

export function normalizeAlertRules(rows=[]){
 if(!Array.isArray(rows))return [];
 const merged=new Map();
 for(const source of rows){
  if(!source||typeof source!=='object'||Array.isArray(source))continue;
  const rule={...source,vehicleIds:vehicleIds(source)};
  const key=`${normalizedText(rule.companyId)}:${normalizedText(rule.type||rule.name)}`;
  const previous=merged.get(key);
  if(!previous){
   merged.set(key,rule);
   continue;
  }
  const ids=new Map();
  for(const id of [...vehicleIds(previous),...vehicleIds(rule)])ids.set(String(id),id);
  const allVehicles=coversAllVehicles(previous)||coversAllVehicles(rule);
  // The latest saved rule owns editable settings. Scope is merged so a stale
  // client cannot silently drop vehicles, and any enabled copy keeps the rule on.
  merged.set(key,{
   ...previous,
   ...rule,
   enabled:previous.enabled!==false||rule.enabled!==false,
   ...mergedChannels(previous,rule),
   allVehicles,
   vehicleIds:allVehicles?[]:[...ids.values()]
  });
 }
 return [...merged.values()];
}

const canonicalTime=value=>{
 const ms=new Date(value).getTime();
 return Number.isFinite(ms)?new Date(ms).toISOString():String(value??'');
};

export function alertSemanticKey(alert={},fallbackCompanyId=''){
 const material=[
  String(alert.companyId??fallbackCompanyId),
  String(alert.vehicleId??''),
  normalizedText(alert.type||alert.title),
  canonicalTime(alert.semanticTime??alert.eventTime??alert.createdAt),
  alert.geofenceId==null?'':String(alert.geofenceId)
 ];
 return crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

export function dedupeAlertEvents(rows=[],fallbackCompanyId=''){
 if(!Array.isArray(rows))return [];
 const seen=new Set(),result=[];
 for(const alert of rows){
  if(!alert||typeof alert!=='object'||Array.isArray(alert))continue;
  const key=alertSemanticKey(alert,fallbackCompanyId);
  if(seen.has(key))continue;
  seen.add(key);
  result.push(alert);
 }
 return result;
}
