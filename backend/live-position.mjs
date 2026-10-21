const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const usable=(latitude,longitude)=>finite(latitude)&&finite(longitude)&&Math.abs(Number(latitude))<=90&&Math.abs(Number(longitude))<=180&&(Math.abs(Number(latitude))>0.000001||Math.abs(Number(longitude))>0.000001);

export function resolveLivePosition(live){
  if(!live)return {available:false,source:'none',latitude:null,longitude:null,course:null,altitude:null,fixTime:null,deviceTime:null,serverTime:null};
  if(live.valid!==false&&usable(live.latitude,live.longitude))return {available:true,source:'current',latitude:Number(live.latitude),longitude:Number(live.longitude),course:finite(live.course)?Number(live.course):null,altitude:finite(live.altitude)?Number(live.altitude):null,fixTime:live.fixtime||live.fixTime||null,deviceTime:live.devicetime||live.deviceTime||null,serverTime:live.servertime||live.serverTime||null};
  if(usable(live.last_valid_latitude,live.last_valid_longitude))return {available:true,source:'last_valid',latitude:Number(live.last_valid_latitude),longitude:Number(live.last_valid_longitude),course:finite(live.last_valid_course)?Number(live.last_valid_course):null,altitude:finite(live.last_valid_altitude)?Number(live.last_valid_altitude):null,fixTime:live.last_valid_fixtime||null,deviceTime:live.last_valid_devicetime||null,serverTime:live.last_valid_servertime||null};
  return {available:false,source:'none',latitude:null,longitude:null,course:null,altitude:null,fixTime:null,deviceTime:null,serverTime:null};
}
