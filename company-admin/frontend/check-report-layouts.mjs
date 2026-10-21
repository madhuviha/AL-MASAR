import fs from 'node:fs';
import path from 'node:path';
import {transform} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/madhu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),output=path.resolve(root,'../../../../outputs');
fs.mkdirSync(output,{recursive:true});

async function component(sourceFile,cssImport,tempFile){
 const source=fs.readFileSync(sourceFile,'utf8').replace(cssImport,'');
 const {code}=await transform(source,{loader:'jsx',format:'esm'});
 fs.writeFileSync(tempFile,code);
 return (await import('./'+tempFile+'?t='+Date.now())).default;
}

const RagReport=await component('src/RagReport.jsx',"import './rag-report.css';",'src/.rag-preview.mjs');
const FleetReport=await component('src/FleetReport.jsx',"import './fleet-report.css';",'src/.fleet-preview.mjs');
const ragCss=fs.readFileSync('src/rag-report.css','utf8'),fleetCss=fs.readFileSync('src/fleet-report.css','utf8');
const logoPath='C:/Users/madhu/Documents/MASAR-TRACKING-logo-transparent.png';
const logo=fs.existsSync(logoPath)?'data:image/png;base64,'+fs.readFileSync(logoPath).toString('base64'):'';
const base={companyName:'AL MASAR',companyAddress:'Doha, Qatar',companyLogo:logo,from:'2026-10-03T10:40',to:'2026-10-04T10:40'};
const ragRows=[
 {vehicle:'khawla',driver:'Not identified',distanceKm:63.6,harshAcceleration:3,harshBraking:30,harshCornering:16,overspeedEvents:0,eventsPer100Km:77.05,rag:'Red'},
 {vehicle:'Nissan Patrol',driver:'Not identified',distanceKm:91.53,harshAcceleration:23,harshBraking:48,harshCornering:12,overspeedEvents:0,eventsPer100Km:90.69,rag:'Red'},
 {vehicle:'Nissan Urvan',driver:'Mohammed Ali',distanceKm:148.2,harshAcceleration:1,harshBraking:2,harshCornering:1,overspeedEvents:0,eventsPer100Km:2.7,rag:'Amber'},
 {vehicle:'Toyota Yaris',driver:'Ahmed',distanceKm:122.4,harshAcceleration:0,harshBraking:1,harshCornering:0,overspeedEvents:0,eventsPer100Km:.82,rag:'Green'}
];
const idleRows=[
 {vehicle:'Nissan Patrol',driver:'Mohammed Ali',event:'Idle',start:'04/10/2026, 08:10 AM',end:'04/10/2026, 09:33 AM',durationMin:83,location:'Street 1, Industrial Area, Ar Rayyan, Qatar'},
 {vehicle:'khawla',driver:'Not identified',event:'Idle',start:'04/10/2026, 09:25 AM',end:'04/10/2026, 10:08 AM',durationMin:43,location:'Barwa Madinatna, Al Wakrah, Qatar'},
 {vehicle:'Toyota Yaris',driver:'Ahmed',event:'Idle',start:'04/10/2026, 10:02 AM',end:'04/10/2026, 10:14 AM',durationMin:12,location:'Street 2730, Education City, Al Rayyan, Qatar'},
 {vehicle:'Nissan Urvan',driver:'Not identified',event:'Idle',start:'04/10/2026, 10:31 AM',end:'04/10/2026, 10:37 AM',durationMin:6,location:'Doha, Qatar'}
];
const tripRows=[
 {vehicle:'Nissan Patrol',driver:'Mohammed Ali',start:'04/10/2026, 07:12 AM',end:'04/10/2026, 08:04 AM',distanceKm:42.8,durationMin:52,from:'Industrial Area, Doha',to:'Education City, Al Rayyan'},
 {vehicle:'khawla',driver:'Not identified',start:'04/10/2026, 08:20 AM',end:'04/10/2026, 09:16 AM',distanceKm:36.2,durationMin:56,from:'Barwa Madinatna, Al Wakrah',to:'Doha, Qatar'},
 {vehicle:'Toyota Yaris',driver:'Ahmed',start:'04/10/2026, 09:40 AM',end:'04/10/2026, 10:18 AM',distanceKm:21.9,durationMin:38,from:'Al Rayyan, Qatar',to:'Industrial Area, Doha'}
];

const previews=[
 ['report-rag-preview.png',React.createElement(RagReport,{rows:ragRows,summary:{...base,type:'RAG Report'}}),ragCss],
 ['report-idle-preview.png',React.createElement(FleetReport,{rows:idleRows,summary:{...base,type:'Idle Report',vehicleCount:4}}),fleetCss],
 ['report-trip-preview.png',React.createElement(FleetReport,{rows:tripRows,summary:{...base,type:'Trip Report',vehicleCount:3}}),fleetCss]
];
const browser=await chromium.launch({headless:true,channel:'chrome'});
for(const[file,element,css]of previews){const page=await browser.newPage({viewport:{width:1500,height:950},deviceScaleFactor:1});await page.setContent(`<style>body{margin:0;padding:28px;background:#f4f8fb;font-family:Arial}*{box-sizing:border-box}${css}</style>${renderToStaticMarkup(element)}`);await page.screenshot({path:path.join(output,file),fullPage:true});await page.close()}
await browser.close();
for(const file of ['src/.rag-preview.mjs','src/.fleet-preview.mjs'])fs.unlinkSync(file);
