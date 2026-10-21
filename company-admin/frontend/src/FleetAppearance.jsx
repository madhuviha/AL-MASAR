import {useText} from './LanguagePreferences.jsx';
import React,{useEffect,useLayoutEffect,useState} from 'react';
import {Search,Check,Upload,Image,Car,ShieldCheck,Mail,Phone,MessageCircle,AtSign} from 'lucide-react';
import {mapVehicleSvg} from './vehicle-icon.mjs';
import {vehicleCategories} from './vehicle-catalog.mjs';
import loginReference from './assets/ui/login-reference.png';
import googlePlayBadgeImage from './assets/ui/google-play-badge.png';
import appStoreBadgeImage from './assets/ui/app-store-badge.png';
import './fleet-design.css';
const BRANDING_KEY='inviha_global_branding';
const readCachedBranding=()=>{try{return JSON.parse(localStorage.getItem(BRANDING_KEY)||'{}')||{}}catch{return{}}};
const saveCachedBranding=value=>{try{localStorage.setItem(BRANDING_KEY,JSON.stringify({...readCachedBranding(),...value}))}catch{}};
let publicBrandingRequest;
function loadPublicBranding(){
 if(!publicBrandingRequest)publicBrandingRequest=fetch('/inviha-api/api/public/branding',{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('branding_unavailable');return response.json()}).then(value=>{saveCachedBranding(value);return value}).catch(error=>{publicBrandingRequest=null;throw error});
 return publicBrandingRequest;
}
export function FormSection({title,icon:Icon=Car,children,className=''}){const t=useText();return <section className={'fleetFormSection '+className}><h3><Icon/>{t(title)}</h3><div className="formGrid">{children}</div></section>}
export function VehicleSymbol({category='Car'}){return <span className="vehicleSymbol" dangerouslySetInnerHTML={{__html:mapVehicleSvg(category)}}/>}
export function LoginVisual(){
 const [branding,setBranding]=useState(readCachedBranding);
 const apply=value=>{const page=document.querySelector('.productionLogin,.productionAdminLogin');if(!page)return;const src=String(value?.loginBackgroundData||value?.loginBackgroundUrl||'').trim(),transparency=Math.max(0,Math.min(70,Number(value?.loginPanelTransparency??18))),panel=String(value?.loginPanelColor||'#ffffff'),match=/^#([0-9a-f]{6})$/i.exec(panel),rgb=match?[0,2,4].map(index=>parseInt(match[1].slice(index,index+2),16)).join(','):'255,255,255';if(src)page.style.setProperty('background-image',`url("${src}")`,'important');else page.style.removeProperty('background-image');page.style.setProperty('--login-panel-opacity',String((100-transparency)/100));page.style.setProperty('--login-panel-rgb',rgb);page.style.setProperty('--login-accent',String(value?.templateColor||'#0aa65f'));page.style.setProperty('--login-text',String(value?.loginTextColor||'#0b2748'));page.style.setProperty('--login-background',String(value?.loginBackgroundColor||'#f4f8fb'));page.style.setProperty('background-size','cover','important');page.style.setProperty('background-position','center','important');page.style.setProperty('background-repeat','no-repeat','important')};
 useLayoutEffect(()=>apply(branding),[branding.loginBackgroundData,branding.loginBackgroundUrl,branding.loginPanelTransparency,branding.templateColor,branding.loginTextColor,branding.loginBackgroundColor,branding.loginPanelColor]);
 useEffect(()=>{let alive=true;loadPublicBranding().then(value=>{if(alive)setBranding(value)}).catch(()=>{});return()=>{alive=false}},[]);
 return null;
}
export function LoginBrandText({position='welcome'}){
 const [branding,setBranding]=useState(readCachedBranding);
 useEffect(()=>{let alive=true;loadPublicBranding().then(value=>{if(alive)setBranding(value)}).catch(()=>{});return()=>{alive=false}},[]);
 const value=position==='bottom'?branding.bottomText:branding.welcomeText;
 return value?<div className={'loginBrandText '+position}>{value}</div>:null;
}
export function readLoginCaptchaToken(){return String(window.turnstile?.getResponse?.()||window.grecaptcha?.getResponse?.()||'')}
export function LoginCaptcha(){
 const [config,setConfig]=useState(()=>{const x=readCachedBranding();return{provider:x.captchaProvider||'None',siteKey:x.captchaSiteKey||''}});
 useEffect(()=>{let alive=true;loadPublicBranding().then(x=>{if(alive)setConfig({provider:x.captchaProvider||'None',siteKey:x.captchaSiteKey||''})}).catch(()=>{});return()=>{alive=false}},[]);
 useEffect(()=>{if(!config.siteKey||config.provider==='None')return;const id=config.provider==='Cloudflare Turnstile'?'inviha-turnstile-script':'inviha-recaptcha-script';if(document.getElementById(id))return;const script=document.createElement('script');script.id=id;script.async=true;script.defer=true;script.src=config.provider==='Cloudflare Turnstile'?'https://challenges.cloudflare.com/turnstile/v0/api.js':'https://www.google.com/recaptcha/api.js';document.head.appendChild(script)},[config.provider,config.siteKey]);
 if(!config.siteKey||config.provider==='None')return null;
 return <div className="loginCaptcha">{config.provider==='Cloudflare Turnstile'?<div className="cf-turnstile" data-sitekey={config.siteKey}/>:<div className="g-recaptcha" data-sitekey={config.siteKey}/>}</div>;
}
export function LoginBadge(){
 const [logo,setLogo]=useState(()=>readCachedBranding().logoData||'');
 useEffect(()=>{let alive=true;loadPublicBranding().then(x=>{if(alive)setLogo(x.logoData||'')}).catch(()=>{});return()=>{alive=false}},[]);
 return <div className="fleetLoginBadge">{logo?<img src={logo} alt="INVIHA TRACK"/>:<ShieldCheck/>}</div>
}
export function LoginAppLinks(){
 const [links,setLinks]=useState(()=>{const x=readCachedBranding();return{googlePlayUrl:x.googlePlayUrl||'',appStoreUrl:x.appStoreUrl||''}});
 useEffect(()=>{let alive=true;loadPublicBranding().then(x=>{if(alive)setLinks({googlePlayUrl:x.googlePlayUrl||'',appStoreUrl:x.appStoreUrl||''})}).catch(()=>{});return()=>{alive=false}},[]);
 if(!links.googlePlayUrl&&!links.appStoreUrl)return null;
 return <div className="loginAppLinks" aria-label="Mobile apps">{links.googlePlayUrl&&<a href={links.googlePlayUrl} target="_blank" rel="noreferrer" className="appStoreBadge" aria-label="Get it on Google Play"><img src={googlePlayBadgeImage} alt="Get it on Google Play" /></a>}{links.appStoreUrl&&<a href={links.appStoreUrl} target="_blank" rel="noreferrer" className="appStoreBadge" aria-label="Download on the App Store"><img src={appStoreBadgeImage} alt="Download on the App Store" /></a>}</div>
}
export function LoginSupportLinks(){
 const [support,setSupport]=useState(()=>{const x=readCachedBranding();return{supportEmail:x.supportEmail||'',supportPhone:x.supportPhone||'',whatsappNumber:x.whatsappNumber||''}});
 useEffect(()=>{let alive=true;loadPublicBranding().then(x=>{if(alive)setSupport({supportEmail:x.supportEmail||'',supportPhone:x.supportPhone||'',whatsappNumber:x.whatsappNumber||''})}).catch(()=>{});return()=>{alive=false}},[]);
 const rawPhone=support.whatsappNumber||support.supportPhone||'';
 const phone=String(rawPhone).replace(/[^0-9]/g,'');
 const whatsappHref=phone.length>=7?`https://wa.me/${phone}`:'#';
 return <div className="loginSupportLinks" aria-label="Support"><a className="supportLink" href={support.supportEmail?'mailto:'+support.supportEmail+'?subject=Tracking support':'mailto:'}><Mail/>Contact Us</a><a className="supportLink" href={support.supportEmail?'mailto:'+support.supportEmail:'mailto:'}><AtSign/>Email</a><a className="supportLink" href={whatsappHref} target={phone.length>=7?'_blank':undefined} rel={phone.length>=7?'noreferrer':undefined}><MessageCircle/>WhatsApp</a><a className="supportLink" href="/privacy-policy"><ShieldCheck/>Privacy</a></div>
}export function VehicleAppearance({value,onChange}){
 const [query,setQuery]=useState(''),[more,setMore]=useState(false),[url,setUrl]=useState(value.imageUrl?.startsWith('data:')?'':value.imageUrl||''),[error,setError]=useState('');
 const choices=vehicleCategories.filter(c=>c.toLowerCase().includes(query.toLowerCase())),selected=value.category||'Car';
 function fileSelected(file){if(!file)return;setError('');if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>250000){setError('Choose a PNG, JPEG or WebP image under 250 KB.');return}const r=new FileReader();r.onerror=()=>setError('Unable to read this image.');r.onload=()=>onChange({...value,imageUrl:String(r.result)});r.readAsDataURL(file)}
 function loadUrl(){try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))throw Error();onChange({...value,imageUrl:u.href});setError('')}catch{setError('Enter a valid HTTP or HTTPS image URL.')}}
 return <div className="vehicleAppearance"><div className="appearanceHead"><div><h3><Car/>Vehicle icon</h3><p>Choose the symbol shown for this vehicle on the live map.</p></div><label className="appearanceSearch"><Search/><input aria-label="Search vehicle icons" placeholder="Search icons…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><div className="fleetIconGrid">{(query||more?choices:choices.slice(0,22)).map(c=><button type="button" aria-pressed={c===selected} key={c} className={c===selected?'selected':''} onClick={()=>onChange({...value,category:c})}><VehicleSymbol category={c}/><span>{c}</span>{c===selected&&<Check className="iconSelectedCheck"/>}</button>)}</div>{!choices.length&&<p>No matching vehicle icons.</p>}{!query&&<button type="button" className="viewMoreIcons" onClick={()=>setMore(!more)}>{more?'Show fewer icons':'View all '+vehicleCategories.length+' icons'}</button>}<h3><Image/>Vehicle image / logo</h3><div className="fleetImageGrid"><label className="fleetDropzone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();fileSelected(e.dataTransfer.files[0])}}><Upload/><b>Drop your image here</b><span>or click to browse</span><small>PNG, JPEG or WebP · up to 250 KB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>fileSelected(e.target.files[0])}/></label><div className="fleetImageUrl"><label>Image URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label><button type="button" onClick={loadUrl}>Load image</button><div className="fleetImagePreview">{value.imageUrl?<img src={value.imageUrl} alt="Vehicle image preview" onError={()=>setError('The image could not be loaded. Check the URL or upload a file.')}/>:<VehicleSymbol category={selected}/>}</div>{value.imageUrl&&<button type="button" onClick={()=>{onChange({...value,imageUrl:''});setUrl('');setError('')}}>Remove image</button>}</div></div>{error&&<p className="fleetFormError" role="alert">{error}</p>}</div>
}
