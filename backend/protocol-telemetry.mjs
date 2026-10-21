const first=(source,keys)=>{for(const key of keys)if(source[key]!==undefined&&source[key]!==null&&source[key]!=='')return source[key];return undefined};
const truth=value=>[true,1,'1','true','on','ON','high','HIGH'].includes(value)?true:[false,0,'0','false','off','OFF','low','LOW'].includes(value)?false:null;
const finite=value=>value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;

export function isGt06Family(...values){
 return values.some(value=>/(?:^|[^a-z0-9])(gt06|h9|gx06)(?:$|[^a-z0-9])/i.test(String(value||'')));
}

const BOOL_ALIASES={
 ignition:['ignition','ignitionOn','acc','accOn'],motion:['motion','movement'],charge:['charge','charging'],
 blocked:['blocked','immobilized'],armed:['armed'],archive:['archive'],door:['door']
};
const NUMBER_ALIASES={
 power:['power','externalPowerVoltage','externalVoltage','externalPower'],battery:['battery','batteryVoltage'],
 batteryLevel:['batteryLevel','batteryPercent'],rssi:['rssi','gsm','signal'],satellites:['satellites','sat','satelliteCount'],
 totalDistance:['totalDistance','odometer'],odometer:['odometer','totalDistance'],hours:['hours','engineHours'],
 temperature:['temperature','temp1','temperature1'],fuel:['fuel','fuelLevel'],humidity:['humidity'],rpm:['rpm'],
 obdSpeed:['obdSpeed'],fuelUsed:['fuelUsed'],hdop:['hdop'],accuracy:['accuracy'],status:['status'],event:['event'],
 input:['input'],output:['output'],steps:['steps'],geofence:['geofence']
};

/** Preserve every decoded field and add canonical names only when the tracker supplied an unambiguous alias. */
export function normalizeProtocolAttributes(attributes={},protocol=''){
 const raw=attributes&&typeof attributes==='object'&&!Array.isArray(attributes)?attributes:{};
 const out={...raw};
 const isGt06=isGt06Family(protocol);
 if(isGt06){
  for(const [canonical,aliases] of Object.entries(BOOL_ALIASES)){const value=first(raw,aliases),parsed=truth(value);if(parsed!==null)out[canonical]=parsed}
  for(const [canonical,aliases] of Object.entries(NUMBER_ALIASES)){const value=first(raw,aliases),parsed=finite(value);if(parsed!==null)out[canonical]=parsed}
 }
 // R12L-F heartbeat 0x13 stores ACC in bit 1 of terminal information.
 // A generic "status" field can mean something else, so decode only an explicitly named terminal byte.
 const terminalInfo=finite(first(raw,['terminalInfo','terminalStatus']));
 if(isGt06&&out.ignition===undefined&&Number.isInteger(terminalInfo)&&terminalInfo>=0&&terminalInfo<=255)out.ignition=!!(terminalInfo&0x02);
 // Teltonika iButton readers arrive as driverUniqueId, while other decoders
 // use driver_id/iButton/ RFID aliases. Canonicalise all of them so driver
 // identification and the Sensors/I/O view consume the same value.
 const driver=first(raw,['driverUniqueId','driverIdentifier','driverId','driver_id','driverID','rfid','ibutton','iButton','iButtonId','ibutton_id','oneWire','1wire']);
 if(out.driverUniqueId===undefined&&driver!==undefined)out.driverUniqueId=String(driver);
 if(out.driverIdentifier===undefined&&driver!==undefined)out.driverIdentifier=String(driver);
 const alarm=first(raw,['alarm','alarmType']);if(out.alarm===undefined&&alarm!==undefined)out.alarm=String(alarm);
 return out;
}

export function normalizeProtocolPosition(position={},protocol=''){
 const effectiveProtocol=isGt06Family(protocol,position.protocol)?'GT06':protocol||position.protocol||'';
 if(position.attributes==null&&!isGt06Family(effectiveProtocol))return {...position};
 return {...position,attributes:normalizeProtocolAttributes(position.attributes,effectiveProtocol)};
}

export const gt06AutomaticParameters=[
 ['GPS Fix','valid'],['Speed','speed'],['Ignition','ignition']
];
