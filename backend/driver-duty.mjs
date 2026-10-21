export function dutyDriving(points,driver){
 const d=driver.duty;if(!d?.enabled)return null;
 const min=s=>{if(!/^\d{2}:\d{2}$/.test(s||''))throw Error('Configure driver duty times.');const [h,m]=s.split(':').map(Number);if(h>23||m>59)throw Error('Invalid duty time');return h*60+m};
 const start=min(d.start),end=min(d.end),days=d.days||[],rate=Number(d.rate||0);if(start===end||!Number.isFinite(rate)||rate<0)throw Error('Check driver duty hours and overtime rate.');
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:d.timezone||'UTC',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),week=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 let normal=0,overtime=0;const time=p=>Date.parse(p.deviceTime||p.fixTime||p.serverTime);
 for(let i=0;i<points.length-1;i++){const p=points[i],until=Math.min(time(points[i+1]),p.current_driver?.ended_at?Date.parse(p.current_driver.ended_at):Infinity);let t=time(p);if(!Number.isFinite(t)||until<=t||until-t>300000||p.speed==null||Number(p.speed)*1.852<=3)continue;if(!p.current_driver?.driver_id||String(p.current_driver.driver_id)!==String(driver.id))continue;
 while(t<until){const next=Math.min(until,(Math.floor(t/60000)+1)*60000),parts=Object.fromEntries(fmt.formatToParts(new Date(t)).map(x=>[x.type,x.value])),day=week.indexOf(parts.weekday),clock=Number(parts.hour)*60+Number(parts.minute),dutyDay=start<end?day:clock<end?(day+6)%7:day,inside=days.map(Number).includes(dutyDay)&&(start<end?clock>=start&&clock<end:clock>=start||clock<end);if(inside)normal+=next-t;else overtime+=next-t;t=next;}
 }
 return {normalDrivingMinutes:Number((normal/60000).toFixed(2)),overrunMinutes:Number((overtime/60000).toFixed(2)),overtimeHours:Number((overtime/3600000).toFixed(3)),hourlyRate:rate,overtimeAmount:Number((overtime/3600000*rate).toFixed(2)),currency:d.currency||'',timezone:d.timezone||'UTC'};
}
