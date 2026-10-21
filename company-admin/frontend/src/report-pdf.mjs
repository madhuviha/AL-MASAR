const fallbackPalette={blue:'#168FF1',green:'#079B58',amber:'#D98000',red:'#DC3545',gray:'#738396',navy:'#173B57'};
let presentationPromise;

const pretty=key=>String(key||'').replace(/_/g,' ').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/^./,letter=>letter.toUpperCase());
const text=value=>value==null||value===''?'—':typeof value==='object'?JSON.stringify(value):String(value);
const normalizedTone=value=>{const tone=String(value||'').trim().toLowerCase();return Object.hasOwn(fallbackPalette,tone)?tone:''};
const fallbackTone=(key,value,type)=>{const label=String(value??'').trim().toLowerCase();if(['rag','bragStatus','status','severity','risk','label'].includes(key)){if(label==='blue')return'blue';if(['green','active','completed','resolved','closed','moving','online','good','low'].includes(label))return'green';if(['amber','warning','pending','idle','medium','due','open'].includes(label))return'amber';if(['red','critical','failed','offline','high','expired'].includes(label))return'red';if(['gray','grey','not rated','not available','unsupported'].includes(label))return'gray'}if(type==='Idle Report'&&key==='durationMin'){const minutes=Number(value)||0;return minutes>=60?'red':minutes>=20?'amber':'green'}return''};
const fallbackColumns=rows=>[...new Set(rows.flatMap(row=>Object.keys(row)))].map(key=>({key,label:pretty(key)}));

async function reportPresentation(){
 if(!presentationPromise)presentationPromise=import('./report-presentation.mjs').catch(()=>({}));
 const module=await presentationPromise;
 return {
  palette:{...fallbackPalette,...(module.REPORT_PALETTE||{})},
  displayName:type=>{try{return module.reportDisplayName?.(type)||type||'Fleet Report'}catch{return type||'Fleet Report'}},
  columns:(rows,type)=>{try{const columns=module.reportColumns?.(rows,type);return Array.isArray(columns)&&columns.length?columns:fallbackColumns(rows)}catch{return fallbackColumns(rows)}},
  metrics:(rows,summary)=>{try{const metrics=module.reportMetrics?.(rows,summary);return Array.isArray(metrics)?metrics:[]}catch{return[]}},
  legend:type=>{try{const legend=module.reportLegend?.(type);return Array.isArray(legend)?legend:[]}catch{return[]}},
  tone:(type,key,value,row)=>{try{return normalizedTone(module.reportRowTone?.(type,key,value,row))||fallbackTone(key,value,type)}catch{return fallbackTone(key,value,type)}},
  cell:(type,key,value,row)=>{try{return text(module.reportCellValue?.(type,key,value,row)??value)}catch{return text(value)}}
 };
}

const color=(palette,tone)=>{const value=palette?.[tone]||fallbackPalette[tone]||fallbackPalette.gray;return String(value).startsWith('#')?String(value):'#'+value};
const availableColumns=(rows,columns)=>{const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))],available=new Set(keys),seen=new Set(),ordered=[];for(const column of columns||[]){if(!column?.key||!available.has(column.key)||seen.has(column.key))continue;ordered.push({key:column.key,label:column.label||pretty(column.key)});seen.add(column.key)}for(const key of keys)if(!seen.has(key))ordered.push({key,label:pretty(key)});return ordered};

export async function pdfBrand(summary){
 const source=summary?.companyLogo;if(!source)return null;
 if(/^data:image\/(png|jpeg);/i.test(source))return source;
 if(typeof Image==='undefined')return null;
 return await new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';const timeout=setTimeout(()=>resolve(null),5000);img.onload=()=>{clearTimeout(timeout);try{const c=document.createElement('canvas');const scale=Math.min(1,600/img.naturalWidth);c.width=img.naturalWidth*scale;c.height=img.naturalHeight*scale;c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/png'))}catch{resolve(null)}};img.onerror=()=>{clearTimeout(timeout);resolve(null)};img.src=source});
}

export function drawReportHeader(doc,summary,logo){
 const pageWidth=doc.internal.pageSize.getWidth(),left=logo?53:14;
 if(logo){try{const info=doc.getImageProperties(logo);const scale=Math.min(32/info.width,22/info.height);doc.addImage(logo,info.fileType,14,10,info.width*scale,info.height*scale)}catch{}}
 doc.setTextColor('#173b57');doc.setFont('helvetica','bold');doc.setFontSize(16);const names=doc.splitTextToSize(summary?.companyName||'Fleet Report',pageWidth-left-16);doc.text(names,left,16);
 let y=17+names.length*6;doc.setFont('helvetica','normal');doc.setFontSize(9);
 const address=doc.splitTextToSize(summary?.companyAddress||'Company address not configured',pageWidth-left-16);doc.text(address,left,y);y+=address.length*4+5;
 doc.setDrawColor('#dce7ee');doc.line(14,y,pageWidth-14,y);y+=8;
 doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(summary?.type||'Fleet Report',14,y);y+=6;doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`${summary?.from||''} - ${summary?.to||''}`,14,y);return y+7;
}

function drawMetricCards(doc,metrics,startY,pageWidth,palette){
 const visible=metrics.filter(metric=>metric?.supported!==false||metric?.value!=null),count=Math.max(1,visible.length),gap=3,left=14,right=14,width=(pageWidth-left-right-gap*(count-1))/count,height=18;
 visible.forEach((metric,index)=>{const x=left+index*(width+gap),tone=normalizedTone(metric.tone)||'gray',accent=color(palette,tone);doc.setFillColor('#ffffff');doc.setDrawColor('#dce7ee');doc.roundedRect(x,startY,width,height,2,2,'FD');doc.setFillColor(accent);doc.rect(x,startY,width,2,'F');doc.setTextColor('#63778d');doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.text(doc.splitTextToSize(String(metric.label||''),Math.max(8,width-4)).slice(0,2),x+2,startY+6);doc.setTextColor('#173b57');doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(text(metric.value),x+2,startY+15,{maxWidth:Math.max(8,width-4)})});
 return visible.length?startY+height+4:startY;
}

function drawLegend(doc,legend,startY,palette){
 let x=14;for(const item of legend){const label=String(item?.label||'').trim();if(!label)continue;const tone=normalizedTone(item.tone)||'gray',width=Math.min(70,Math.max(24,label.length*2.15+10));if(x+width>282){x=14;startY+=7}doc.setFillColor(color(palette,tone));doc.circle(x+2,startY-1,1.8,'F');doc.setTextColor('#4d6479');doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(label,x+6,startY);x+=width}
 return legend.length?startY+5:startY;
}

export async function fleetPdf(rows,summary,{metricRows=rows}={}){
 const [{jsPDF},{autoTable},presentation]=await Promise.all([import('jspdf'),import('jspdf-autotable'),reportPresentation()]);
 const type=summary?.type||'Fleet Report',displayName=presentation.displayName(type),viewSummary={...summary,type:displayName},doc=new jsPDF({orientation:'landscape',format:'a4'}),logo=await pdfBrand(summary),headerEnd=drawReportHeader(doc,viewSummary,logo),pageWidth=doc.internal.pageSize.getWidth(),metrics=presentation.metrics(metricRows,summary),legend=presentation.legend(type),columns=availableColumns(rows,presentation.columns(rows,type));
 let tableTop=drawMetricCards(doc,metrics,headerEnd,pageWidth,presentation.palette);tableTop=drawLegend(doc,legend,tableTop,presentation.palette);
 const body=rows.map(row=>columns.map(({key})=>presentation.cell(type,key,row[key],row)));
 autoTable(doc,{startY:tableTop,margin:{top:tableTop,bottom:18,left:14,right:14},head:[columns.map(column=>column.label)],body,styles:{fontSize:8,cellPadding:3,overflow:'linebreak',minCellWidth:18},headStyles:{fillColor:color(presentation.palette,'navy'),textColor:'#ffffff'},alternateRowStyles:{fillColor:'#f2f6fa'},horizontalPageBreak:columns.length>12,horizontalPageBreakRepeat:0,showHead:'everyPage',willDrawPage:data=>{if(data.pageNumber>1)drawReportHeader(doc,viewSummary,logo)},didParseCell:data=>{if(data.section!=='body')return;const column=columns[data.column.index],row=rows[data.row.index];if(!column||!row)return;const tone=presentation.tone(type,column.key,row[column.key],row);if(tone){data.cell.styles.fillColor=color(presentation.palette,tone);data.cell.styles.textColor='#ffffff';data.cell.styles.fontStyle='bold';data.cell.styles.halign='center'}}});
 const count=doc.getNumberOfPages(),pageHeight=doc.internal.pageSize.getHeight();for(let index=1;index<=count;index++){doc.setPage(index);doc.setFontSize(8);doc.setTextColor('#63778d');doc.text(`${rows.length} records`,14,pageHeight-7);doc.text(`Page ${index} of ${count}`,pageWidth-37,pageHeight-7)}return doc;
}
