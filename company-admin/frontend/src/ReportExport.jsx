import {fleetPdf,pdfBrand} from './report-pdf.mjs';
import {downloadBrag} from './brag-export.mjs';
import React,{useState} from 'react';
import {requestExport} from './ExportDialog.jsx';

const fallbackPalette={blue:'#168FF1',green:'#079B58',amber:'#D98000',red:'#DC3545',gray:'#738396',navy:'#173B57'};
let presentationPromise;

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pretty=key=>String(key||'').replace(/_/g,' ').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/^./,letter=>letter.toUpperCase());
const duration=value=>{const seconds=Math.max(0,Number(value)||0),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),secs=Math.round(seconds%60);return [hours&&`${hours}h`,minutes&&`${minutes}m`,(!hours&&!minutes||secs)&&`${secs}s`].filter(Boolean).join(' ')};
const cellText=value=>value==null||value===''?'—':typeof value==='object'?JSON.stringify(value):String(value);
const normalizedTone=value=>{const tone=String(value||'').trim().toLowerCase();return Object.hasOwn(fallbackPalette,tone)?tone:''};
const fallbackTone=(key,value,type='')=>{const label=String(value??'').trim().toLowerCase();if(['rag','bragStatus','status','severity','risk','label'].includes(key)){if(label==='blue')return'blue';if(['green','active','completed','resolved','closed','moving','online','good','low'].includes(label))return'green';if(['amber','warning','pending','idle','medium','due','open'].includes(label))return'amber';if(['red','critical','failed','offline','high','expired'].includes(label))return'red';if(['gray','grey','not rated','not available','unsupported'].includes(label))return'gray'}if(type==='Idle Report'&&key==='durationMin'){const minutes=Number(value)||0;return minutes>=60?'red':minutes>=20?'amber':'green'}return''};
const fallbackColumns=rows=>[...new Set(rows.flatMap(row=>Object.keys(row)))].map(key=>({key,label:pretty(key)}));
const uniqueVehicles=rows=>new Set(rows.map(row=>row.vehicle||row.vehicleName||row.vehicleNumber).filter(Boolean)).size;
const fallbackMetrics=(rows,summary)=>{const type=summary?.type||'Fleet Report',vehicles=uniqueVehicles(rows)||Number(summary?.vehicleCount)||0;if(type==='Idle Report'){const values=rows.map(row=>Number(row.durationMin)*60).filter(Number.isFinite),total=values.reduce((sum,value)=>sum+value,0),maximum=values.length?Math.max(...values):0;return[{key:'events',label:'Idle events',value:rows.length,tone:'blue'},{key:'vehicles',label:'Vehicles',value:vehicles,tone:'navy'},{key:'total',label:'Total idle',value:duration(total),tone:'amber'},{key:'longest',label:'Longest idle',value:duration(maximum),tone:'red'},{key:'average',label:'Average idle',value:duration(values.length?total/values.length:0),tone:'green'}]}return[{key:'records',label:'Records',value:rows.length,tone:'blue'},{key:'vehicles',label:'Vehicles',value:vehicles,tone:'green'},{key:'period',label:'Report period',value:summary?.from&&summary?.to?'Selected range':'Current data',tone:'navy'}]};

async function reportPresentation(){
 if(!presentationPromise)presentationPromise=import('./report-presentation.mjs').catch(()=>({}));
 const module=await presentationPromise;
 return {
  palette:{...fallbackPalette,...(module.REPORT_PALETTE||{})},
  displayName:type=>{try{return module.reportDisplayName?.(type)||type||'Fleet Report'}catch{return type||'Fleet Report'}},
  columns:(rows,type)=>{try{const columns=module.reportColumns?.(rows,type);return Array.isArray(columns)&&columns.length?columns:fallbackColumns(rows)}catch{return fallbackColumns(rows)}},
  metrics:(rows,summary)=>{try{const metrics=module.reportMetrics?.(rows,summary);return Array.isArray(metrics)&&metrics.length?metrics:fallbackMetrics(rows,summary)}catch{return fallbackMetrics(rows,summary)}},
  legend:type=>{try{const legend=module.reportLegend?.(type);return Array.isArray(legend)?legend:[]}catch{return[]}},
  tone:(type,key,value,row)=>{try{return normalizedTone(module.reportRowTone?.(type,key,value,row))||fallbackTone(key,value,type)}catch{return fallbackTone(key,value,type)}},
  cell:(type,key,value,row)=>{try{return cellText(module.reportCellValue?.(type,key,value,row)??value)}catch{return cellText(value)}}
 };
}

function resolveColumns(rows,defined,selectedColumns){
 const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))],available=new Set(keys),selected=selectedColumns?.length?new Set(selectedColumns):null,seen=new Set(),columns=[];
 for(const column of defined||[]){if(!column?.key||!available.has(column.key)||seen.has(column.key)||selected&&!selected.has(column.key))continue;columns.push({key:column.key,label:column.label||pretty(column.key)});seen.add(column.key)}
 for(const key of selectedColumns?.length?selectedColumns:keys)if(available.has(key)&&!seen.has(key)){columns.push({key,label:pretty(key)});seen.add(key)}
 return columns;
}

const toneColor=(palette,tone)=>{const value=palette?.[normalizedTone(tone)]||fallbackPalette[normalizedTone(tone)]||fallbackPalette.gray;return String(value).startsWith('#')?String(value):'#'+value};
const argb=(palette,tone)=>'FF'+toneColor(palette,tone).slice(1).toUpperCase();
const safeName=value=>String(value||'fleet-report').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'fleet-report';

function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}

function richHtml(rows,summary,columns,presentation,logo){
 const type=summary?.type||'Fleet Report',title=presentation.displayName(type),metrics=presentation.metrics(rows,summary),legend=presentation.legend(type),brand=logo?`<img alt="Company logo" src="${escapeHtml(logo)}">`:'<div class="logo">MASAR<small>TRACKING</small></div>';
 const body=rows.map(row=>`<tr>${columns.map(({key})=>{const tone=presentation.tone(type,key,row[key],row),value=escapeHtml(presentation.cell(type,key,row[key],row));return `<td>${tone?`<span class="badge" style="background:${toneColor(presentation.palette,tone)}">${value}</span>`:value}</td>`}).join('')}</tr>`).join('');
 const metricCards=metrics.map(metric=>{const supported=metric?.supported!==false,tone=supported?(normalizedTone(metric?.tone)||'gray'):'gray',value=supported?metric?.value:'Not available';return `<div class="metric" style="--tone:${toneColor(presentation.palette,tone)}"><span>${escapeHtml(metric?.label||'')}</span><strong>${escapeHtml(cellText(value))}</strong></div>`}).join('');
 const labels=legend.length?`<section class="labels"><b>Report labels</b>${legend.map(item=>`<span><i style="background:${toneColor(presentation.palette,item?.tone)}"></i>${escapeHtml(item?.label||'')}</span>`).join('')}</section>`:'';
 return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
*{box-sizing:border-box}body{margin:0;padding:22px;background:#f4f8fb;color:#173b57;font:12px Arial,sans-serif}.sheet{max-width:1500px;margin:auto}.head{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;padding:18px 22px;border-radius:12px;background:linear-gradient(120deg,#0c426d,#116494);color:#fff}.head img,.logo{width:118px;height:65px;padding:5px;border-radius:8px;background:#fff;object-fit:contain}.logo{display:flex;flex-direction:column;align-items:center;justify-content:center;color:#0c4d85;font-size:18px;font-weight:900}.logo small{font-size:9px;letter-spacing:3px}.head p,.head h1,.head span{margin:0}.head p{font-size:11px;font-weight:bold;color:#cfeaff;text-transform:uppercase;letter-spacing:.08em}.head h1{margin:4px 0;font-size:24px}.head>div>span{color:#d8edf9}.period{display:grid;gap:3px;min-width:210px;text-align:right;font-size:11px}.period b{color:#8ed7ff;text-transform:uppercase}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:14px 0}.metric{min-height:76px;padding:13px 15px;border:1px solid #dce7ee;border-top:4px solid var(--tone);border-radius:10px;background:#fff}.metric span{display:block;color:#6c8195;font-size:11px}.metric strong{display:block;margin-top:8px;color:#173b57;font-size:22px}.labels{display:flex;align-items:center;gap:13px;flex-wrap:wrap;margin-bottom:14px;padding:11px 15px;border:1px solid #dce7ee;border-radius:10px;background:#fff}.labels>b{margin-right:6px}.labels span{display:flex;align-items:center;gap:5px;color:#526b80}.labels i{width:10px;height:10px;border-radius:50%}.tableCard{overflow:hidden;border:1px solid #dce7ee;border-radius:11px;background:#fff}.tableTitle{display:flex;align-items:center;justify-content:space-between;padding:13px 16px}.tableWrap{overflow:auto}table{width:100%;border-collapse:collapse}th{padding:10px 8px;background:${toneColor(presentation.palette,'navy')};color:#fff;text-align:left;font-size:10px;white-space:nowrap}td{padding:9px 8px;border-bottom:1px solid #e6edf2;font-size:10px;vertical-align:top}tbody tr:nth-child(even){background:#f1f7fb}.badge{display:inline-block;min-width:62px;padding:4px 8px;border-radius:99px;color:#fff;font-weight:bold;text-align:center}.foot{display:flex;justify-content:space-between;margin-top:12px;color:#6f8293;font-size:10px}@media print{body{padding:0;background:#fff}.sheet{max-width:none}.head,.metrics,.labels,.tableCard{break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}th,.badge,.metric,.labels i{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4 landscape;margin:10mm}}@media(max-width:800px){.head{grid-template-columns:1fr}.period{text-align:left}.metrics{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main class="sheet"><header class="head">${brand}<div><p>${escapeHtml(summary?.companyName||'Fleet Management')}</p><h1>${escapeHtml(title)}</h1><span>${escapeHtml(summary?.companyAddress||'Company address not configured')}</span></div><div class="period"><b>Report period</b><span>${escapeHtml(String(summary?.from||'').replace('T',' '))}</span><span>to ${escapeHtml(String(summary?.to||'').replace('T',' '))}</span></div></header><section class="metrics">${metricCards}</section>${labels}<section class="tableCard"><div class="tableTitle"><h3>Detailed records</h3><span>${rows.length} record${rows.length===1?'':'s'}</span></div><div class="tableWrap"><table><thead><tr>${columns.map(column=>`<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div></section><footer class="foot"><span>${escapeHtml(summary?.companyName||'Masar Tracking')} · Fleet Management Report</span><span>Generated ${escapeHtml(new Date().toLocaleString())}</span></footer></main></body></html>`;
}

async function excelReport(rows,metricRows,summary,columns,presentation,logo){
 const {default:ExcelJS}=await import('exceljs'),book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Report'),type=summary?.type||'Fleet Report',title=presentation.displayName(type),metrics=presentation.metrics(metricRows,summary),legend=presentation.legend(type),totalColumns=Math.max(5,columns.length,metrics.length,legend.length),headerStart=logo?2:1;
 book.creator=summary?.companyName||'Masar Tracking';
 if(logo&&/^data:image\/(png|jpeg);base64,/i.test(logo)){try{const extension=/^data:image\/jpeg/i.test(logo)?'jpeg':'png',image=book.addImage({base64:logo,extension});sheet.addImage(image,{tl:{col:.08,row:.1},ext:{width:105,height:58}});sheet.getColumn(1).width=17}catch{}}
 for(const [row,value,size,colorValue] of [[1,summary?.companyName||'Fleet Management',18,'FF104D78'],[2,title,15,'FF173B57'],[3,summary?.companyAddress||'Company address not configured',10,'FF63778D']]){sheet.mergeCells(row,headerStart,row,totalColumns);const cell=sheet.getCell(row,headerStart);cell.value=value;cell.font={bold:row<3,size,color:{argb:colorValue}}}
 sheet.getCell(4,1).value='Report period';sheet.getCell(4,2).value=`${summary?.from||''} to ${summary?.to||''}`;sheet.mergeCells(4,2,4,totalColumns);sheet.getCell(5,1).value='Generated';sheet.getCell(5,2).value=new Date().toLocaleString();sheet.mergeCells(5,2,5,totalColumns);
 sheet.mergeCells(7,1,7,totalColumns);sheet.getCell(7,1).value='Report summary';sheet.getCell(7,1).font={bold:true,size:12,color:{argb:'FF173B57'}};
 metrics.forEach((metric,index)=>{const column=index+1,supported=metric?.supported!==false,tone=supported?(normalizedTone(metric?.tone)||'gray'):'gray',label=sheet.getCell(8,column),value=sheet.getCell(9,column);label.value=metric?.label||'';label.font={bold:true,color:{argb:'FF63778D'}};label.alignment={wrapText:true};value.value=cellText(supported?metric?.value:'Not available');value.fill={type:'pattern',pattern:'solid',fgColor:{argb:argb(presentation.palette,tone)}};value.font={bold:true,color:{argb:'FFFFFFFF'}};value.alignment={horizontal:'center'}});
 sheet.mergeCells(11,1,11,totalColumns);sheet.getCell(11,1).value='Report labels';sheet.getCell(11,1).font={bold:true,size:11,color:{argb:'FF173B57'}};
 legend.forEach((item,index)=>{const cell=sheet.getCell(12,index+1);cell.value=item?.label||'';cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:argb(presentation.palette,item?.tone)}};cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={horizontal:'center',wrapText:true}});
 const tableHeaderRow=14,header=sheet.getRow(tableHeaderRow);header.values=columns.map(column=>column.label);header.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:argb(presentation.palette,'navy')}};cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={wrapText:true}});
 rows.forEach(row=>{const excelRow=sheet.addRow(columns.map(({key})=>presentation.cell(type,key,row[key],row)));excelRow.eachCell((cell,index)=>{cell.alignment={vertical:'top',wrapText:true};const column=columns[index-1],tone=column&&presentation.tone(type,column.key,row[column.key],row);if(tone){cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:argb(presentation.palette,tone)}};cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'top',horizontal:'center',wrapText:true}}})});
 sheet.columns.forEach((column,index)=>column.width=index<2?24:19);sheet.getRow(1).height=23;sheet.getRow(2).height=21;sheet.getRow(8).height=28;sheet.getRow(9).height=24;sheet.views=[{state:'frozen',ySplit:tableHeaderRow}];sheet.autoFilter={from:{row:tableHeaderRow,column:1},to:{row:tableHeaderRow,column:Math.max(1,columns.length)}};sheet.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:`1:${tableHeaderRow}`};return book.xlsx.writeBuffer();
}

export default function ReportExport({rows,summary,toast}){
 const[busy,setBusy]=useState(false);
 async function run(format,selectedColumns=null){
  if(!rows.length)return toast('Generate a report first');
  setBusy(true);
  try{
   const presentation=await reportPresentation(),type=summary?.type||'Fleet Report',columns=resolveColumns(rows,presentation.columns(rows,type),selectedColumns),exportRows=rows.map(row=>Object.fromEntries(columns.map(({key})=>[key,row[key]]))),title=presentation.displayName(type),file=safeName(title),logo=await pdfBrand(summary);
   if(format==='pdf'&&type!=='BRAG Report'){(await fleetPdf(exportRows,summary,{metricRows:rows})).save(file+'.pdf');return}
   if(type==='BRAG Report'&&['pdf','xlsx'].includes(format)){await downloadBrag(format,exportRows,summary);return}
   if(format==='csv'){const quote=value=>'"'+String(value).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"',body=exportRows.map(row=>columns.map(({key})=>presentation.cell(type,key,row[key],row)));download(file+'.csv','\ufeff'+[columns.map(column=>column.label),...body].map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8')}
   else if(format==='json'){const metrics=presentation.metrics(rows,summary),body=exportRows.map(row=>Object.fromEntries(columns.map(({key,label})=>[label,presentation.cell(type,key,row[key],row)])));download(file+'.json',JSON.stringify({summary:{...summary,type:title,metrics},columns,rows:body},null,2),'application/json')}
   else if(format==='xlsx')download(file+'.xlsx',await excelReport(exportRows,rows,summary,columns,presentation,logo),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
   else{const html=richHtml(exportRows,summary,columns,presentation,logo);if(format==='html')download(file+'.html',html,'text/html');else{const reportWindow=window.open('','_blank');if(!reportWindow)throw Error('Allow the print window to open.');reportWindow.document.open();reportWindow.document.write(html);reportWindow.document.close();reportWindow.focus();setTimeout(()=>reportWindow.print(),350)}}
  }catch(error){toast('Export failed: '+error.message)}finally{setBusy(false)}
 }
 return <button className="reportExportButton" disabled={busy} onClick={()=>{if(!rows.length)return toast('Generate a report first');requestExport('fleet-report',rows,{formats:[{value:'print',label:'Print / Save PDF'},{value:'pdf',label:'Download PDF'},{value:'csv',label:'CSV'},{value:'xlsx',label:'Excel (.xlsx)'},{value:'html',label:'HTML'},{value:'json',label:'JSON'}],onExport:(format,columns)=>run(format,columns)})}}>{busy?'Exporting…':'Export report'}</button>;
}
