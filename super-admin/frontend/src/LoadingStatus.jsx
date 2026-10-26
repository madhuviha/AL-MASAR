import React,{useEffect,useState} from 'react';

const key=Symbol.for('inviha.loading.fetch');
if(!window[key]){
 window[key]=true;
 const original=window.fetch.bind(window);
 let count=0;
 window.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input?.url||'',method=init?.method||input?.method||'GET';
  const visible=url.includes('/inviha-api/')&&(method!=='GET'||/\/reports\//.test(url));
  if(visible)window.dispatchEvent(new CustomEvent('inviha-loading',{detail:++count}));
  try{return await original(input,init)}
  finally{if(visible)window.dispatchEvent(new CustomEvent('inviha-loading',{detail:--count}))}
 };
}
export default function LoadingStatus(){
 const[visible,setVisible]=useState(false);
 useEffect(()=>{
  let timer;
  const update=e=>{clearTimeout(timer);if(e.detail>0)timer=setTimeout(()=>setVisible(true),120);else setVisible(false)};
  window.addEventListener('inviha-loading',update);
  return()=>{clearTimeout(timer);window.removeEventListener('inviha-loading',update)};
 },[]);
 return visible?<BrandLoading/>:null;
}

export function BrandLoading(){
 return <div className="brandLoading" role="status" aria-live="polite" aria-label="Loading">
  <span className="equalizerLoader" aria-hidden="true"><i/><i/><i/><i/></span>
  <span className="brandLoadingText">Loading</span>
 </div>;
}
