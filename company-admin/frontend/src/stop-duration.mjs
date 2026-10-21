const truth=v=>[true,1,'1','true'].includes(v)?true:[false,0,'0','false'].includes(v)?false:null;
export function stoppedAgo(position,now=Date.now()){
 const t=position?.telemetry||{},speed=position?.speed,ignition=truth(position?.attributes?.ignition??t.ignition??t.stopIgnition);
 if(ignition===true||t.moving===true||speed!=null&&Number.isFinite(Number(speed))&&Number(speed)*1.852>3||t.stopIgnition!==false)return null;
 const value=t.ignitionOffSince,since=typeof value==='number'?value:typeof value==='string'&&/^\d+$/.test(value)?Number(value):Date.parse(value);
 if(!Number.isFinite(since)||since>now+60000)return null;
 const minutes=Math.floor(Math.max(0,now-since)/60000),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
 if(days)return days+' '+(days===1?'day':'days')+' ago';
 if(hours)return hours+' '+(hours===1?'hr':'hrs')+' ago';
 return minutes?minutes+' min ago':'just now';
}
