import {identifierRaw,normalizeIdentifier} from './driver-identity.mjs';
export const coreTelemetryNames=['GPS Fix','Speed','Ignition'];
const channels=(prefix,n)=>Array.from({length:n},(_,i)=>prefix+(i+1));
const caps=(din,ain,dout,extra={})=>({din:channels('DIN',din),ain:channels('AIN',ain),dout:channels('DOUT',dout),sharedPins:[],oneWire:false,bluetooth:true,can:false,obd:false,rs232:false,rs485:false,...extra});
export const deviceModelSeeds=[
 ['FMB920',caps(1,1,1,{reservedIgnition:['DIN1']})],['FMC920',caps(1,1,1,{reservedIgnition:['DIN1']})],
 ['FMC003',caps(0,0,0,{obd:true})],['FMB120',caps(3,2,2,{oneWire:true,sharedPins:[['DIN3','AIN2']]})],
 ['FMB140',caps(3,2,2,{oneWire:true,can:true,sharedPins:[['DIN2','AIN1'],['DIN3','AIN2']]})],
 ['FMM130',caps(3,2,3,{oneWire:true,sharedPins:[['DIN2','AIN1'],['DIN3','AIN2']]})],
 ['FMC130',caps(3,2,3,{oneWire:true,sharedPins:[['DIN2','AIN1'],['DIN3','AIN2']]})],
 ['FMM125',caps(2,1,1,{oneWire:true,rs232:true,rs485:true,sharedPins:[['DIN2','AIN1']]})],
 ['FMC650',caps(4,4,4,{oneWire:true,can:true,canPorts:2,rs232:true,rs232Ports:2,rs485:true})],
 ['OTHER',caps(0,0,0,{bluetooth:false,unknown:true})]
].map(([model,capabilities_json])=>({brand:'TELTONIKA',protocol_key:'teltonika',series:model==='OTHER'?'Other':model.slice(0,3),model,capabilities_json}));
export const ioFunctions={
 DIN:[['ignition','Ignition'],['seat_belt','Seat Belt'],['door','Door Sensor'],['sos','Panic / SOS'],['ac','AC Status'],['pto','PTO'],['hand_brake','Hand Brake'],['emergency','Emergency Input'],['custom_digital','Custom Digital Sensor']],
 DOUT:[['immobilizer','Immobilizer / Engine Block'],['buzzer','Buzzer'],['relay','External Relay'],['door_lock','Door Lock / Unlock'],['custom_output','Custom Output']],
 AIN:[['fuel','Fuel Level'],['temperature','Temperature'],['custom_analog','Custom Analog Sensor']],
 '1WIRE':[['driver_id','iButton Driver ID'],['temperature','Dallas Temperature']],
 BLE:[['beacon','BLE Beacon'],['temperature','BLE Temperature'],['driver_id','Supported BLE Driver ID'],['accessory','Bluetooth Accessory']],
 RS232:[['driver_id','Supported Serial RFID'],['fuel','Fuel Level'],['accessory','Serial Accessory']],RS485:[['driver_id','Supported Serial RFID'],['fuel','Fuel Level'],['accessory','Serial Accessory']],
 CAN:[['fuel','Fuel Level'],['temperature','Temperature'],['accessory','CAN Value']],OBD:[['fuel','Fuel Level'],['temperature','Temperature'],['accessory','OBD Value']]
};
export function modelChannels(c={}){
 return [...(c.din||[]),...(c.ain||[]),...(c.dout||[]),...(c.oneWire?['1WIRE1','1WIRE2','1WIRE3','1WIRE4']:[]),...(c.bluetooth?['BLE1','BLE2','BLE3','BLE4']:[]),...(c.rs232?(c.rs232Ports===2?['RS232A','RS232B']:['RS232']):[]),...(c.rs485?['RS485']:[]),...(c.can?(c.canPorts===2?['CAN1','CAN2']:['CAN1']):[]),...(c.obd?['OBD']:[])];
}
export function sourceType(channel){return channel.startsWith('1WIRE')?'1WIRE':channel.startsWith('RS232')?'RS232':channel.startsWith('RS485')?'RS485':channel.replace(/\d+$/,'');}
export function defaultSourceKey(channel,fn){const type=sourceType(channel),n=channel.match(/\d+$/)?.[0];return type==='DIN'?'in'+n:type==='AIN'?'adc'+n:type==='DOUT'?'out'+n:type==='1WIRE'?(fn==='driver_id'?'driverUniqueId':'temp'+n):type==='BLE'?(fn==='temperature'?'bleTemp'+n:fn==='driver_id'?'tag'+n+'Mac':'tag'+n+'Id'):'';}
export function validateCapabilities(c){
 if(!c||typeof c!=='object'||Array.isArray(c))throw Error('Enter valid model capabilities.');
 for(const k of ['din','ain','dout'])if(!Array.isArray(c[k])||c[k].length>16||c[k].some(x=>!new RegExp('^'+k.toUpperCase()+'([1-9]|1[0-6])$').test(x))||new Set(c[k]).size!==c[k].length)throw Error('Invalid '+k.toUpperCase()+' channels.');
 for(const k of ['oneWire','bluetooth','can','obd','rs232','rs485'])if(typeof c[k]!=='boolean')throw Error('Capability flags must be true or false.');
 for(const key of ['canPorts','rs232Ports'])if(c[key]!=null&&![1,2].includes(c[key]))throw Error('Interface port counts must be 1 or 2.');
 const all=modelChannels(c);if(!Array.isArray(c.sharedPins)||c.sharedPins.some(pair=>!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||pair.some(x=>!all.includes(x))))throw Error('Shared pin pairs must reference two supported channels.');
 return c;
}
export function validateIoMappings(rows,c,{confirmOutputs=false}={}){
 if(!Array.isArray(rows)||rows.length>64)throw Error('Enter a list of up to 64 I/O mappings.');
 const used=new Set(),seen=new Set(),known=modelChannels(c);let driverSources=0;
 return rows.map(r=>{
  const channel=String(r.source_channel||''),type=sourceType(channel),fn=String(r.function_key||'');
  if(!known.includes(channel)||r.source_type!==type)throw Error('Unsupported channel: '+channel+'. Confirm the exact tracker model.');
  if(!ioFunctions[type]?.some(([key])=>key===fn))throw Error('Unsupported function for '+channel+'.');
  if(seen.has(channel))throw Error('One active mapping is allowed per physical channel; omit duplicate disabled rows.');seen.add(channel);
  if(r.enabled!==false){
   if(used.has(channel))throw Error('One active mapping is allowed per physical channel.');
   for(const pair of c.sharedPins||[])if(pair.includes(channel)&&pair.some(x=>used.has(x)))throw Error('Shared pin conflict: '+pair.join(' / ')+'.');
   if(c.reservedIgnition?.includes(channel)&&fn!=='ignition')throw Error(channel+' is reserved for ignition on this model.');
   if(fn==='driver_id'&&++driverSources>1)throw Error('Select one active driver-identification reader per vehicle.');
   used.add(channel);
  }
  if(type==='DOUT'&&r.enabled!==false&&!confirmOutputs)throw Error('Confirm the physical output assignment before saving.');
  const config=r.config_json||{},key=String(config.sourceKey||defaultSourceKey(channel,fn));
  if(['DIN','AIN'].includes(type)&&key!==defaultSourceKey(channel,fn))throw Error('Decoded input must match the physical channel '+channel+'.');
  if(type!=='DOUT'&&(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)||['__proto__','prototype','constructor'].includes(key)))throw Error('Select a verified decoded source key for '+channel+'.');
  if(['DIN','DOUT'].includes(type)&&!['HIGH','LOW'].includes(r.active_state))throw Error('Choose Active HIGH or LOW.');
  const name=String(r.display_name||'').trim();if(!name||name.length>80)throw Error('Display name must contain 1 to 80 characters.');
  const multiplier=config.multiplier==null?1:Number(config.multiplier),offset=config.offset==null?0:Number(config.offset);
  if(!Number.isFinite(multiplier)||!Number.isFinite(offset))throw Error('Calibration must use finite numbers.');
  return {source_channel:channel,source_type:type,function_key:fn,display_name:name,active_state:r.active_state||'HIGH',enabled:r.enabled!==false,config_json:{sourceKey:key,multiplier,offset,unit:String(config.unit||'').slice(0,15),installationVerified:config.installationVerified===true}};
 });
}
export function mapDeviceTelemetry(position,mappings=[]){
 if(!position)return position;
 const raw=typeof position.attributes==='string'?JSON.parse(position.attributes):position.attributes||{},attributes={...raw},values=[];
 for(const m of mappings){if(m.enabled===false||m.source_type==='DOUT')continue;const config=m.config_json||{},value=raw[config.sourceKey||defaultSourceKey(m.source_channel,m.function_key)];let normalized=value??null;
  if(m.source_type==='DIN'){const state=[true,1,'1','true'].includes(value)?true:[false,0,'0','false'].includes(value)?false:null;normalized=state===null?null:m.active_state==='LOW'?!state:state;const aliases={ignition:'ignition',seat_belt:'seatBelt',door:'door',sos:'sos',ac:'ac',pto:'pto',hand_brake:'handBrake',emergency:'emergency'};if(aliases[m.function_key]&&(m.function_key!=='ignition'||normalized!==null))attributes[aliases[m.function_key]]=normalized;}
  else if(m.function_key==='driver_id'){if(config.installationVerified&&normalizeIdentifier(value))attributes.driverIdentifier=identifierRaw(value);}
  else if(value!=null&&value!==''&&Number.isFinite(Number(value)))normalized=Number(value)*(config.multiplier??1)+(config.offset??0);
  values.push({channel:m.source_channel,name:m.display_name,function:m.function_key,value:normalized,unit:config.unit||''});
 }
 // Publish a single mapped measurement to the existing alert/report fields.
 // Multiple probes stay channel-addressable, avoiding an arbitrary primary sensor.
 for(const [fn,key] of [['temperature','temperature'],['fuel','fuel']]){const same=values.filter(v=>v.function===fn);if(same.length===1){const v=same[0];if(fn!=='temperature'||v.unit==='°C'||v.unit==='C')attributes[key]=v.value;}}
 return {...position,attributes,mapped_io:values};
}
