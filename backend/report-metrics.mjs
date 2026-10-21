// Pure report calculations shared by browser and scheduled reports.
export function reportRange(from,to){
 const start=new Date(from),end=new Date(/^\d{4}-\d{2}-\d{2}$/.test(to)?to+'T23:59:59.999':to);
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<start||end-start>31*86400000)throw Error('Choose a range of up to 31 days.');
 return {start,end};
}
export function idleThreshold(value=120){const n=Number(value);if(!Number.isFinite(n)||n<0||n>86400)throw Error('Idle threshold must be between 0 and 86400 seconds.');return n;}
export function idleEvents(events,threshold=120){return events.filter(x=>x.type==='Idle'&&Number.isFinite(x.duration)&&x.duration>idleThreshold(threshold)*1000);}
export function reportSummary(rows,{type,vehicles=[],from,to,idleMinimumSeconds=120}={}){
 const durations=rows.map(r=>r.durationSeconds!=null?Number(r.durationSeconds):Number(r.durationMin)*60).filter(Number.isFinite),total=durations.reduce((a,b)=>a+b,0);
 return {type,from,to,vehicleCount:vehicles.length,recordCount:rows.length,...(type==='Idle Report'?{idleMinimumSeconds:idleThreshold(idleMinimumSeconds),idleCount:rows.length,totalIdleSeconds:total,maximumIdleSeconds:durations.length?Math.max(...durations):0,averageIdleSeconds:durations.length?total/durations.length:0}:{})};
}
