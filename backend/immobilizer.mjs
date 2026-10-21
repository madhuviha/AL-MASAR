const modelOutputCounts={FMB920:1,FMC920:1,FMB120:2,FMB140:2,FMM125:1,FMM130:3,FMC130:3,FMC650:4};

function outputCount(vehicle,selectedOutput){
 const model=String(vehicle.device_model||vehicle.deviceModel||'').trim().toUpperCase();
 const configured=vehicle.metadata?.deviceCapabilities?.dout?.length;
 return Math.max(selectedOutput,Number.isInteger(configured)&&configured>0?configured:modelOutputCounts[model]||selectedOutput);
}

export function digitalOutputCommand(vehicle,selectedOutput,level){
 const states=Array(outputCount(vehicle,selectedOutput)).fill('?');
 states[selectedOutput-1]=String(level);
 return 'setdigout '+states.join('');
}

export function immobilizerCommand(vehicle,position,action,now=Date.now()){
 if(!['on','off'].includes(action))throw Error('Choose Immobilize ON or OFF.');
 const c=vehicle.metadata?.immobilizer;
 const output=Number(c?.output);
 if(!/teltonika/i.test(vehicle.protocol||'')||c?.enabled!==true||!Number.isInteger(output)||output<1||output>4||![0,1].includes(c.immobilizeLevel))throw Error('A super administrator must configure a verified Teltonika DOUT1–DOUT4 relay first. GT06 is not configured.');
 const age=now-Date.parse(position?.deviceTime||position?.devicetime||position?.fixTime||position?.fixtime),received=now-Date.parse(position?.serverTime||position?.servertime);
 if(!Number.isFinite(age)||age<0||age>30000||!Number.isFinite(received)||received<0||received>30000||position?.speed==null||!Number.isFinite(Number(position.speed))||Number(position.speed)*1.852>1||Number(position.speed)<0)throw Error('A stationary vehicle with telemetry received within 30 seconds is required.');
 const a=typeof position.attributes==='string'?JSON.parse(position.attributes):position.attributes||{};
 if(![false,0,'0','false'].includes(a.ignition))throw Error('Switch ignition OFF before changing the immobilizer.');
 const level=action==='on'?c.immobilizeLevel:1-c.immobilizeLevel;
 return {deviceId:Number(vehicle.traccar_device_id),type:'custom',textChannel:false,attributes:{data:digitalOutputCommand(vehicle,output,level)}};
}
