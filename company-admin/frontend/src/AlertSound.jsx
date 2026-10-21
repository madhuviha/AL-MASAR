import React,{useEffect,useRef} from 'react';
import {alertKeySet,alertLogicalKey,companyAlerts,dedupeAlerts,isResolvedAlert} from './alert-notifications.mjs';
let context;
export async function playAlertSound(volume=60){
 const AudioContext=window.AudioContext||window.webkitAudioContext;
 if(!AudioContext)throw Error('This browser does not support notification sounds.');
 context ||= new AudioContext();
 if(context.state!=='running')await context.resume();
 if(context.state!=='running')throw Error('Click Test Sound to enable audio in this browser.');
 const gain=context.createGain();gain.connect(context.destination);const level=Math.max(0,Math.min(100,Number(volume)||0))/100*.16;
 for(const [offset,frequency] of [[0,740],[.22,980]]){const oscillator=context.createOscillator(),envelope=context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;oscillator.connect(envelope);envelope.connect(gain);const start=context.currentTime+offset;envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(level,start+.02);envelope.gain.exponentialRampToValueAtTime(.0001,start+.18);oscillator.start(start);oscillator.stop(start+.2);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect()}}
 setTimeout(()=>gain.disconnect(),700);
}
export function useAlertSound(alerts,company,ready){
 const seen=useRef(null),scope=useRef(null);
 useEffect(()=>{if(!ready||!company?.id){seen.current=null;return}if(scope.current!==String(company.id)){scope.current=String(company.id);seen.current=null}const rows=dedupeAlerts(companyAlerts(alerts,company.id)),keys=alertKeySet(rows);const fresh=seen.current&&rows.some(alert=>!seen.current.has(alertLogicalKey(alert))&&!isResolvedAlert(alert));seen.current=keys;if(fresh&&company.settings?.alertSound===true)playAlertSound(company.settings.alertVolume??60).catch(()=>window.dispatchEvent(new CustomEvent('inviha-audio-error')))},[alerts,company?.id,company?.settings?.alertSound,company?.settings?.alertVolume,ready]);
}
export default function AlertSoundControls({settings,onChange,toast}){
 const test=async()=>{try{await playAlertSound(settings.alertVolume??60);toast?.('Test sound played')}catch(e){toast?.(e.message)}};
 return <div className="alertSoundControls"><label><input type="checkbox" checked={settings.alertSound===true} onChange={async e=>{const enabled=e.target.checked;onChange({...settings,alertSound:enabled});if(enabled)await test()}}/> Sound notifications</label><label>Volume: {settings.alertVolume??60}%<input aria-label="Notification volume" type="range" min="0" max="100" value={settings.alertVolume??60} onChange={e=>onChange({...settings,alertVolume:Number(e.target.value)})}/></label><button type="button" onClick={test}>▶ Test Sound</button><small>Plays for new alerts while this app is open. Click Test Sound after opening the app if your browser blocks audio.</small></div>
}
