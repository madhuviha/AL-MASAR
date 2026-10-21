import {pdfBrand,drawReportHeader} from './report-pdf.mjs';
import {ragColumns,ragSummary,ragCell,ragColor,ragLegend} from './rag-report.mjs';
export async function ragExcel(rows,summary){
 const {default:ExcelJS}=await import('exceljs');const wb=new ExcelJS.Workbook();wb.creator='INVIHA TRACK';const sh=wb.addWorksheet('RAG Safety Report');const s=ragSummary(rows);
 sh.mergeCells('A1:I1');sh.getCell('A1').value='INVIHA TRACK | RAG Safety Report';sh.getCell('A1').font={size:20,bold:true,color:{argb:'FF173B57'}};sh.getRow(1).height=34;
 sh.mergeCells('A2:I2');sh.getCell('A2').value=[summary?.companyName,summary?.companyAddress].filter(Boolean).join(' | ');sh.getCell('A2').alignment={wrapText:true};sh.getRow(2).height=32;sh.mergeCells('A3:I3');sh.getCell('A3').value=`${summary?.from||''} — ${summary?.to||''}`;
 sh.addRow(['Vehicles assessed',s.assessed,'High risk',s.counts.Red,'Needs attention',s.counts.Amber,'Low risk',s.counts.Green]);
 sh.mergeCells('A5:I5');sh.getCell('A5').value=ragLegend;sh.getRow(5).height=30;sh.getCell('A5').alignment={wrapText:true};
 sh.addRow(ragColumns.map(([,label])=>label));sh.getRow(6).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173B57'}};c.font={bold:true,color:{argb:'FFFFFFFF'}}});
 rows.forEach((r,i)=>{const row=sh.addRow(ragColumns.map(([k])=>['vehicle','driver','rag'].includes(k)?String(r[k]??''):typeof r[k]==='number'?r[k]:String(r[k]??'')));row.height=32;row.eachCell(c=>{c.alignment={vertical:'middle',wrapText:true};if(i%2===1)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1F6FA'}}});row.getCell(3).numFmt='0.0';row.getCell(8).numFmt='0.00';const rating=row.getCell(9);rating.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+(ragColor[r.rag]||ragColor['Not rated'])}};rating.font={bold:true,color:{argb:'FFFFFFFF'}}});
 sh.addRow([]);sh.addRow(['Total distance (km)',s.distance]);sh.addRow(['Total recorded events',s.events]);sh.addRow(['Not rated',s.counts['Not rated']]);
 sh.columns.forEach((c,i)=>c.width=[24,30,18,18,14,16,14,20,16][i]);sh.autoFilter={from:'A6',to:`I${6+rows.length}`};sh.views=[{state:'frozen',ySplit:6}];sh.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:6'};return wb;
}
export async function ragPdf(rows,summary){
 const {jsPDF}=await import('jspdf');const {autoTable}=await import('jspdf-autotable');const doc=new jsPDF({orientation:'landscape',format:'a4'}),s=ragSummary(rows);
 const logo=await pdfBrand(summary);const headerEnd=drawReportHeader(doc,summary,logo),shift=headerEnd-38;
 const cards=[['Vehicles assessed',s.assessed,'173B57'],['High risk',s.counts.Red,ragColor.Red],['Needs attention',s.counts.Amber,ragColor.Amber],['Low risk',s.counts.Green,ragColor.Green]];
 cards.forEach(([label,n,color],i)=>{const x=14+i*68;doc.setFillColor('#f2f6fa');doc.roundedRect(x,38+shift,64,22,2,2,'F');doc.setTextColor('#'+color);doc.setFontSize(9);doc.text(label,x+4,45+shift);doc.setFontSize(18);doc.text(String(n),x+4,55+shift)});
 doc.setTextColor('#173b57');doc.setFontSize(8);doc.text(ragLegend,14,68+shift);
 autoTable(doc,{startY:74+shift,head:[ragColumns.map(([,label])=>label)],body:rows.map(r=>ragColumns.map(([k])=>String(ragCell(r,k)))),margin:{top:headerEnd,bottom:18,left:14,right:14},styles:{fontSize:8,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:'#173b57',textColor:'#ffffff'},alternateRowStyles:{fillColor:'#f2f6fa'},willDrawPage:data=>{if(data.pageNumber>1)drawReportHeader(doc,summary,logo)},columnStyles:{0:{cellWidth:32},1:{cellWidth:40},8:{cellWidth:24}},didParseCell:data=>{if(data.section==='body'&&data.column.index===8){data.cell.styles.fillColor='#'+(ragColor[rows[data.row.index]?.rag]||ragColor['Not rated']);data.cell.styles.textColor='#ffffff';data.cell.styles.fontStyle='bold'}}});
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor('#536b80');doc.text(`${s.total} vehicles | ${s.distance.toFixed(1)} km | ${s.events} recorded events`,14,202);doc.text(`INVIHA TRACK | Page ${i} of ${pages}`,235,202)}return doc;
}
export async function downloadRag(format,rows,summary){if(format==='pdf'){(await ragPdf(rows,summary)).save('rag-safety-report.pdf');return}const wb=await ragExcel(rows,summary),url=URL.createObjectURL(new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download='rag-safety-report.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
