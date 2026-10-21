// Calendar-year expiry, clamped for leap-day activation.
export function anniversary(value){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));if(!match)throw Error('Use a valid activation date.');
 const [year,month,day]=match.slice(1).map(Number),date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw Error('Use a valid activation date.');
 const last=new Date(Date.UTC(year+1,month,0)).getUTCDate();return new Date(Date.UTC(year+1,month-1,Math.min(day,last))).toISOString().slice(0,10);
}
export function companyDates(metadata={},now=new Date()){
 const created=metadata.created?String(metadata.created).slice(0,10):now.toISOString().slice(0,10);
 const defaultExpiry=anniversary(created),expiry=metadata.expiry||defaultExpiry;
 anniversary(expiry);if(expiry<created)throw Error('Expiry must not be before activation.');
 return {...metadata,created,expiry};
}
