export function calibrate(raw,config={}){
 if(raw==null||raw==='')return null;
 if(config.type==='Digital Input'||config.type==='Digital Output'){
  if(![true,false,0,1,'0','1','true','false'].includes(raw))return null;
  const on=raw===true||raw===1||raw==='1'||raw==='true';return config.invert?!on:on;
 }
 if(typeof raw==='boolean')return raw;
 if(typeof raw==='string'&&!Number.isFinite(Number(raw)))return raw;
 const n=Number(raw),scale=Number(config.scale??1),offset=Number(config.offset??0);if(![n,scale,offset].every(Number.isFinite))return null;
 const pts=(config.calibrationPoints||[]).filter(p=>Number.isFinite(Number(p.raw))&&Number.isFinite(Number(p.value))).sort((a,b)=>a.raw-b.raw);
 if(pts.length>=2){if(n<Number(pts[0].raw)||n>Number(pts.at(-1).raw))return null;for(let i=1;i<pts.length;i++)if(n<=Number(pts[i].raw)){const a=pts[i-1],b=pts[i];if(Number(a.raw)===Number(b.raw))return null;return Number(a.value)+(n-Number(a.raw))/(Number(b.raw)-Number(a.raw))*(Number(b.value)-Number(a.value))}}
 return n*scale+offset;
}
