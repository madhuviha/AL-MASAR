export const ALERT_RETENTION_MS=48*60*60*1000;
export function recentAlerts(alerts,now=Date.now()){return (Array.isArray(alerts)?alerts:[]).filter(a=>{const t=Date.parse(a.createdAt);return !Number.isFinite(t)||t>now-ALERT_RETENTION_MS})}
