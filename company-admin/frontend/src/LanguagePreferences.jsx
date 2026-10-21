import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {Check,Globe2,Save} from 'lucide-react';
let current='English';const listeners=new Set();
const translations=Object.fromEntries(`Dashboard|لوحة التحكم|डैशबोर्ड
Map|الخريطة|मानचित्र
Maps|الخرائط|मानचित्र
Vehicles|المركبات|वाहन
Drivers|السائقون|ड्राइवर
Reports|التقارير|रिपोर्ट
Alerts|التنبيهات|अलर्ट
Geofences|المناطق الجغرافية|जियोफेंस
Maintenance|الصيانة|रखरखाव
Sensors|المستشعرات|सेंसर
Users|المستخدمون|उपयोगकर्ता
Settings|الإعدادات|सेटिंग्स
Language|اللغة|भाषा
Companies|الشركات|कंपनियाँ
Devices / IMEI|الأجهزة / IMEI|डिवाइस / IMEI
Master Data|البيانات الأساسية|मास्टर डेटा
System|النظام|सिस्टम
Diagnostics|التشخيص|डायग्नोस्टिक्स
Logs|السجلات|लॉग
Backups|النسخ الاحتياطية|बैकअप
Database|قاعدة البيانات|डेटाबेस
Billing & Plans|الفواتير والخطط|बिलिंग और प्लान
Support|الدعم|सहायता
Profile|الملف الشخصي|प्रोफ़ाइल
Logout|تسجيل الخروج|लॉग आउट
Basic Information|المعلومات الأساسية|मूल जानकारी
Work Details|تفاصيل العمل|कार्य विवरण
Vehicle Name|اسم المركبة|वाहन का नाम
Plate Number|رقم اللوحة|नंबर प्लेट
Make|الشركة المصنعة|निर्माता
Model|الطراز|मॉडल
Category|الفئة|श्रेणी
Group|المجموعة|समूह
Year|السنة|वर्ष
Status|الحالة|स्थिति
Notes|ملاحظات|नोट्स
Driver Name|اسم السائق|ड्राइवर का नाम
Driver ID|معرف السائق|ड्राइवर आईडी
Mobile Number|رقم الجوال|मोबाइल नंबर
Email|البريد الإلكتروني|ईमेल
License Number|رقم الرخصة|लाइसेंस नंबर
License Expiry Date|تاريخ انتهاء الرخصة|लाइसेंस समाप्ति तिथि
Address|العنوان|पता
Department / Company|القسم / الشركة|विभाग / कंपनी
Planned Vehicle (optional)|المركبة المخططة (اختياري)|नियोजित वाहन (वैकल्पिक)
Full Name|الاسم الكامل|पूरा नाम
Role|الدور|भूमिका
Phone|الهاتف|फ़ोन
Time Zone|المنطقة الزمنية|समय क्षेत्र
Vehicle Access|الوصول إلى المركبات|वाहन एक्सेस
Permissions|الصلاحيات|अनुमतियाँ
Main|الرئيسية|मुख्य
Icon & Logo|الأيقونة والشعار|आइकन और लोगो
Advanced|متقدم|उन्नत
Sensors & I/O|المستشعرات والمداخل والمخارج|सेंसर और I/O
Services|الخدمات|सेवाएँ
Accuracy|الدقة|सटीकता
Tail|المسار الأخير|हाल का पथ
Expenses|المصروفات|खर्च
Cameras|الكاميرات|कैमरे
Fleet & SIM|الأسطول والشريحة|बेड़ा और SIM
Vehicle Identity|هوية المركبة|वाहन पहचान
Dates|التواريخ|तिथियाँ
Ownership & Branch|الملكية والفرع|स्वामित्व और शाखा
Fuel & Costs|الوقود والتكاليف|ईंधन और लागत
Additional Configuration|إعدادات إضافية|अतिरिक्त कॉन्फ़िगरेशन
GPS & Position|GPS والموقع|GPS और स्थान
Ignition & Movement|الإشعال والحركة|इग्निशन और गति
Immobilizer|مانع التشغيل|इमोबिलाइज़र
Engine & Fuel|المحرك والوقود|इंजन और ईंधन
Save Language|حفظ اللغة|भाषा सहेजें
Saving…|جارٍ الحفظ…|सहेजा जा रहा है…
Language saved|تم حفظ اللغة|भाषा सहेजी गई
Add Driver|إضافة سائق|ड्राइवर जोड़ें
Edit Driver|تعديل السائق|ड्राइवर संपादित करें
Add Vehicle|إضافة مركبة|वाहन जोड़ें
Edit Vehicle|تعديل المركبة|वाहन संपादित करें
Add Company|إضافة شركة|कंपनी जोड़ें
Edit Company|تعديل الشركة|कंपनी संपादित करें
Vehicle Details|تفاصيل المركبة|वाहन विवरण
Vehicle Information|معلومات المركبة|वाहन जानकारी
Live Status|الحالة المباشرة|लाइव स्थिति
Sensor Groups|مجموعات المستشعرات|सेंसर समूह
Protocols|البروتوكولات|प्रोटोकॉल
Vehicle Categories|فئات المركبات|वाहन श्रेणियाँ
Company Name|اسم الشركة|कंपनी का नाम
Company Email|بريد الشركة|कंपनी ईमेल
Company Phone|هاتف الشركة|कंपनी फ़ोन
Date Format|تنسيق التاريخ|तिथि प्रारूप
Time Format|تنسيق الوقت|समय प्रारूप
Currency|العملة|मुद्रा
Company Logo|شعار الشركة|कंपनी लोगो
Company Address|عنوان الشركة|कंपनी पता`.split('\n').map(line=>{const [key,...values]=line.split('|');return [key,values]}));
export function translate(text,language=current){if(typeof text!=='string'||language==='English')return text;const required=text.endsWith(' *'),key=required?text.slice(0,-2):text,index=language==='Arabic'?0:1;return translations[key]?.[index]?(translations[key][index]+(required?' *':'')):text}
export function useText(){const lang=useSyncExternalStore(callback=>{listeners.add(callback);return()=>listeners.delete(callback)},()=>current,()=> 'English');return value=>translate(value,lang)}
export function useLanguageSetting(language){useEffect(()=>{current=['English','Arabic','Hindi'].includes(language)?language:'English';document.documentElement.lang={English:'en',Arabic:'ar',Hindi:'hi'}[current];document.documentElement.dir=current==='Arabic'?'rtl':'ltr';for(const listener of listeners)listener()},[language])}
export default function LanguagePreferences({value='English',onSave}){
 const[draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),t=useText();useEffect(()=>setDraft(value),[value]);
 return <section className="page languagePage"><div className="pageHead"><div><h1><Globe2/>{t('Language')}</h1><p>Choose the language for navigation and common form labels.</p></div></div><div className="languageCards">{[['English','English','EN','Left-to-right layout'],['Arabic','العربية','ع','Right-to-left layout'],['Hindi','हिन्दी','हि','Left-to-right layout']].map(([name,native,mark,note])=><button key={name} type="button" className={draft===name?'selected':''} aria-pressed={draft===name} onClick={()=>setDraft(name)}><span className="languageMark">{mark}</span><b>{native}</b><span>{name}</span><small>{note}</small>{draft===name&&<Check className="languageCheck"/>}</button>)}</div><p className="languageNote">Technical settings, report content and device-provided names keep their original text.</p><div className="languageActions"><button type="button" className="primary greenBtn" disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{const ok=await onSave(draft);setMessage(ok===false?'Language could not be saved.':translate('Language saved',draft))}catch(e){setMessage(e.message)}finally{setBusy(false)}}}><Save/>{t(busy?'Saving…':'Save Language')}</button>{message&&<span role="status">{message}</span>}</div></section>
}
