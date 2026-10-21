export const timestamp=p=>Date.parse(p.fixTime||p.deviceTime||p.serverTime);
export const validPosition=p=>p.valid!==false&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180&&Number.isFinite(timestamp(p));
export const routePoints=rows=>rows.filter(validPosition).sort((a,b)=>timestamp(a)-timestamp(b)).filter((p,i,a)=>!i||timestamp(p)!==timestamp(a[i-1]));
export function distance(a,b){const r=x=>x*Math.PI/180,dlat=r(b.latitude-a.latitude),dlon=r(b.longitude-a.longitude);return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(r(a.latitude))*Math.cos(r(b.latitude))*Math.sin(dlon/2)**2)))}
export function summarize(points,gapMs=300000){let meters=0,connectedMs=0;const events=[],segments=[];let segment=[],stop=null;
 for(let i=0;i<points.length;i++){const p=points[i],prev=points[i-1],dt=prev?timestamp(p)-timestamp(prev):0,a=p.attributes||{};
  if(prev&&dt>gapMs){if(segment.length)segments.push(segment);segment=[];events.push({type:'GPS history gap',time:timestamp(p),index:i});if(stop){events.push({...stop,duration:timestamp(prev)-stop.time});stop=null}}
  segment.push([p.latitude,p.longitude]);if(prev&&dt<=gapMs){meters+=distance(prev,p);connectedMs+=dt;
   for(const [key,label] of [['ignition','Ignition'],['driverUniqueId','Driver']])if(a[key]!=null&&prev.attributes?.[key]!=null&&a[key]!==prev.attributes[key])events.push({type:label+' '+String(a[key]),time:timestamp(p),index:i});}
  const kind=p.speed!=null&&Number(p.speed)*1.852<=3?(a.ignition===true?'Idle':'Stop'):null;
  if(stop&&stop.type!==kind){events.push({...stop,duration:timestamp(prev||p)-stop.time});stop=null}if(kind&&!stop)stop={type:kind,time:timestamp(p),index:i};
 }
 if(segment.length)segments.push(segment);if(stop)events.push({...stop,duration:timestamp(points.at(-1))-stop.time});
 const speeds=points.filter(p=>p.speed!=null&&Number.isFinite(Number(p.speed))).map(p=>Number(p.speed)*1.852);
 return {meters,connectedMs,duration:points.length>1?timestamp(points.at(-1))-timestamp(points[0]):0,maxSpeed:speeds.length?Math.max(...speeds):null,averageSpeed:connectedMs?meters/connectedMs*3600:null,events,segments};
}
