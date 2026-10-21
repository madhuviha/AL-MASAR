export const companyFieldOptions=[['name','Company Name','main',true],['email','Admin Email','main',true],['customerName','Customer / Admin Name','main'],['mobile','Mobile','main'],['country','Country','main'],['address','Address','main'],['plan','Plan','main'],['status','Status','main'],['logo','Company Logo','main'],['created','Activation Date','access'],['expiry','Account Expiry','access'],['vehicleLimit','Vehicle Limit','access'],['supportLogin','Support Login','access'],['permissions','Permissions','permissions'],['vehiclePermissions','Vehicle Permissions','vehicle']];
export function companyRequiredFields(value){if(value==null)return ['name','email'];if(!Array.isArray(value)||value.some(k=>!companyFieldOptions.some(([key])=>key===k)))throw Error('Choose required fields from the company form list.');return [...new Set(['name','email',...value])];}
export function validateCompanyFields(data,{creating=false}={}){
 let keys;try{keys=companyRequiredFields(data.requiredFields)}catch(e){return {message:e.message,tab:'mandatory',key:'requiredFields'}}
 for(const key of keys){const v=data[key],present=v&&typeof v==='object'?Object.values(v).some(x=>x===true):v!==null&&v!==undefined&&String(v).trim()!=='';if(!present){const field=companyFieldOptions.find(([k])=>k===key);return {message:field[1]+' is required.',tab:field[2],key};}}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email||'')))return {message:'Enter a valid administrator email.',tab:'main',key:'email'};
 if(creating&&String(data.temporaryPassword||'').length<8)return {message:'Temporary password must be at least 8 characters.',tab:'access',key:'temporaryPassword'};
 return null;
}
