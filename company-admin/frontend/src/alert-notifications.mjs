const text=value=>value==null?'':String(value).trim();
const normalized=value=>text(value).toLowerCase().replace(/\s+/g,' ');
const timestamp=value=>{
 const parsed=Date.parse(value);
 return Number.isFinite(parsed)?new Date(parsed).toISOString():text(value);
};

export const isResolvedAlert=alert=>alert?.resolved===true||normalized(alert?.status)==='resolved';

// Exact event semantics come first because historical duplicate rules produced
// different legacy eventKey values for the same tracker event. We deliberately
// do not round timestamps: two legitimate events close together stay separate.
// eventKey remains the safe identity when a row lacks complete semantic fields.
export function alertLogicalKey(alert={}){
 const subject=text(alert.vehicleId)||text(alert.deviceId)||normalized(alert.vehicleName);
 const type=normalized(alert.type||alert.title);
 const occurredAt=timestamp(alert.semanticTime??alert.eventTime??alert.createdAt);
 if(subject&&type&&occurredAt){
  const company=text(alert.companyId),geofence=text(alert.geofenceId||alert.geofenceName),identifier=text(alert.identifier);
  return `legacy:${company}|${subject}|${type}|${occurredAt}|${geofence}|${identifier}`;
 }
 const eventKey=text(alert.eventKey);
 if(eventKey)return `event:${eventKey}`;
 const id=text(alert.id);
 if(id)return `record:${id}`;
 return `value:${JSON.stringify([text(alert.companyId),subject,type,occurredAt,text(alert.description||alert.message)])}`;
}

export const sourceAlertIds=alert=>[...new Set((alert?._sourceAlertIds||[alert?.id]).filter(id=>id!=null).map(String))];

function mergeAlertRows(first,duplicate){
 const rows=[first,duplicate],resolved=rows.every(isResolvedAlert),read=rows.every(row=>row.read===true);
 const active=rows.find(row=>!isResolvedAlert(row))||first;
 return {
  ...first,
  status:resolved?'Resolved':active.status||'New',
  resolved,
  read,
  _sourceAlertIds:[...new Set([...sourceAlertIds(first),...sourceAlertIds(duplicate)])],
  _sourceRuleIds:[...new Set([...(first._sourceRuleIds||[first.ruleId]),...(duplicate._sourceRuleIds||[duplicate.ruleId])].filter(id=>id!=null&&text(id)).map(String))]
 };
}

export function dedupeAlerts(rows=[]){
 const byEvent=new Map(),result=[];
 for(const row of rows||[]){
  if(!row)continue;
  const key=alertLogicalKey(row),index=byEvent.get(key);
  const prepared={...row,_sourceAlertIds:sourceAlertIds(row),_sourceRuleIds:[...new Set((row._sourceRuleIds||[row.ruleId]).filter(id=>id!=null&&text(id)).map(String))]};
  if(index==null){byEvent.set(key,result.length);result.push(prepared)}
  else result[index]=mergeAlertRows(result[index],prepared);
 }
 return result;
}

export const companyAlerts=(rows,id)=>(rows||[]).filter(alert=>id!=null&&String(alert.companyId)===String(id));
export const alertKeySet=rows=>new Set(dedupeAlerts(rows).map(alertLogicalKey));

function inAppEnabled(alert,rules){
 const ids=alert._sourceRuleIds?.length?alert._sourceRuleIds:[alert.ruleId].filter(Boolean).map(String);
 if(!ids.length)return true;
 return ids.some(id=>(rules||[]).find(rule=>String(rule.id)===id)?.inApp!==false);
}

export const newAlerts=(rows,seen,rules=[])=>seen==null?[]:dedupeAlerts(rows).filter(alert=>!seen.has(alertLogicalKey(alert))&&!isResolvedAlert(alert)&&inAppEnabled(alert,rules));
export const unreadAlertCount=(rows,companyId)=>dedupeAlerts(companyAlerts(rows,companyId)).filter(alert=>alert.read!==true).length;

const selectedVehicleIds=rule=>Array.isArray(rule?.vehicleIds)?rule.vehicleIds.filter(id=>id!=null&&text(id)):[];
const coversAllVehicles=rule=>rule?.allVehicles===true||(rule?.allVehicles!==false&&selectedVehicleIds(rule).length===0);
const mergedChannels=(previous,rule)=>Object.fromEntries(
 ['inApp','push','email','sms','whatsapp']
  .filter(channel=>previous[channel]!==undefined||rule[channel]!==undefined)
  .map(channel=>[channel,previous[channel]===true||rule[channel]===true])
);

// Keep this browser-safe mirror aligned with backend/alert-rules.mjs. The last
// saved copy owns editable settings while scopes are combined, then the caller
// persists this normalized array so the engine no longer receives duplicates.
export function normalizeAlertRules(rows=[]){
 if(!Array.isArray(rows))return [];
 const byType=new Map(),result=[];
 for(const source of rows){
  if(!source||typeof source!=='object'||Array.isArray(source))continue;
  const rule={...source,vehicleIds:selectedVehicleIds(source)},key=`${normalized(rule.companyId)}:${normalized(rule.type||rule.name)}`,index=byType.get(key);
  if(index==null){byType.set(key,result.length);result.push(rule);continue}
  const previous=result[index],ids=new Map();
  for(const id of [...selectedVehicleIds(previous),...selectedVehicleIds(rule)])ids.set(String(id),id);
  const allVehicles=coversAllVehicles(previous)||coversAllVehicles(rule);
  result[index]={
   ...previous,
   ...rule,
   enabled:previous.enabled!==false||rule.enabled!==false,
   ...mergedChannels(previous,rule),
   allVehicles,
   vehicleIds:allVehicles?[]:[...ids.values()]
  };
 }
 return result;
}
