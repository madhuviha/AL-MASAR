import React,{useEffect,useRef,useState} from 'react';
import {Crop,Image as ImageIcon,RotateCcw,Trash2,X} from 'lucide-react';

function draw(canvas,source,zoom,x,y,size){
 if(!canvas||!source)return Promise.resolve();
 return new Promise((resolve,reject)=>{const image=new Image();
 image.onload=()=>{
  const ratio=Math.max(size/image.naturalWidth,size/image.naturalHeight)*zoom;
  const width=image.naturalWidth*ratio,height=image.naturalHeight*ratio;
  const roomX=Math.max(0,(width-size)/2),roomY=Math.max(0,(height-size)/2);
  const left=(size-width)/2-(x/100)*roomX,top=(size-height)/2-(y/100)*roomY;
  const context=canvas.getContext('2d');
  canvas.width=size;canvas.height=size;context.clearRect(0,0,size,size);context.drawImage(image,left,top,width,height);resolve();
 };
 image.onerror=reject;
 image.src=source;
 });
}

export default function DriverPhotoCrop({value='',onChange,toast}){
 const [source,setSource]=useState(''),[open,setOpen]=useState(false),[zoom,setZoom]=useState(1),[x,setX]=useState(0),[y,setY]=useState(0);
 const preview=useRef(null),output=useRef(null);
 useEffect(()=>{if(open)draw(preview.current,source,zoom,x,y,320)},[open,source,zoom,x,y]);
 const reset=()=>{setZoom(1);setX(0);setY(0)};
 const choose=file=>{
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8_000_000){toast('Choose a PNG, JPEG or WebP photo under 8 MB.');return}
  const reader=new FileReader();reader.onload=()=>{setSource(String(reader.result));reset();setOpen(true)};reader.readAsDataURL(file);
 };
 const apply=async()=>{
  const canvas=output.current;
  await draw(canvas,source,zoom,x,y,512);onChange(canvas.toDataURL('image/jpeg',.86));setOpen(false);
 };
 return <>
  <label className="driverPhotoChoose"><ImageIcon/>Choose photo<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{choose(e.target.files?.[0]);e.target.value=''}}/></label>
  {value&&<div className="driverPhotoButtons"><button type="button" onClick={()=>{setSource(value);reset();setOpen(true)}}><Crop/>Crop again</button><button type="button" className="danger" onClick={()=>onChange('')}><Trash2/>Remove</button></div>}
  {open&&<div className="photoCropOverlay" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><section className="photoCropCard" role="dialog" aria-modal="true" aria-label="Crop driver photo"><header><div><h2>Crop driver photo</h2><p>Zoom and move the photo inside the square.</p></div><button type="button" aria-label="Close" onClick={()=>setOpen(false)}><X/></button></header><div className="photoCropBody"><canvas ref={preview} aria-label="Driver photo crop preview"/><label>Zoom<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><label>Move left / right<input type="range" min="-100" max="100" value={x} onChange={e=>setX(Number(e.target.value))}/></label><label>Move up / down<input type="range" min="-100" max="100" value={y} onChange={e=>setY(Number(e.target.value))}/></label></div><footer><button type="button" onClick={reset}><RotateCcw/>Reset</button><span/><button type="button" onClick={()=>setOpen(false)}>Cancel</button><button type="button" className="primary" onClick={apply}><Crop/>Use cropped photo</button></footer><canvas ref={output} hidden/></section></div>}
 </>;
}
