import {validateIoMappings} from './device-profile-rules.mjs';
export function applyIoTemplate(existing,template,model,capabilities){
 if(!template||template.model!==model)throw Error('Choose a template for the same exact tracker model.');
 // Templates never arm outputs or attest to a reader installation on another vehicle.
 const source=(template.mappings||[]).filter(m=>m.source_type!=='DOUT'&&m.enabled!==false).map(m=>({...m,config_json:{...m.config_json,installationVerified:false}}));
 const checked=validateIoMappings(source,capabilities);
 let result=existing.slice(),added=0;const skipped=[];
 for(const mapping of checked){if(result.some(m=>m.source_channel===mapping.source_channel)){skipped.push(mapping.source_channel);continue}try{validateIoMappings([...result,mapping],capabilities,{confirmOutputs:true});result.push(mapping);added++}catch{skipped.push(mapping.source_channel)}}
 return {mappings:result,added,skipped};
}
