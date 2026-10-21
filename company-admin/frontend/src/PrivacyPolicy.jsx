import React from 'react';
import {
  ArrowLeft, Building2, CheckCircle2, Cookie, Database, Globe2,
  HardDrive, LockKeyhole, Mail, MapPin, ShieldCheck, Smartphone, Trash2, Users
} from 'lucide-react';
import './privacy-policy.css';

const UPDATED='5 October 2026';
const SUPPORT_EMAIL='support@inviha.com';

const sections=[
  {
    id:'scope', title:'1. Who this policy applies to', icon:Building2,
    body:<>
      <p><b>Masar Tracking</b> is the Android and iOS fleet-tracking application, and <b>INVIHA TRACK</b> is its current web portal and service platform. Both are provided and operated by <b>INVIHA Technologies</b> ("INVIHA", "we", "us" or "our"). This policy covers the Masar Tracking mobile applications, the INVIHA TRACK web application, related APIs, support services and connected tracking devices (together, the "Services").</p>
      <p>For account, website and direct support information, INVIHA normally determines why and how the information is used. For vehicle, driver, employee and fleet information managed by a customer organisation, that organisation normally controls the processing and INVIHA processes the information on its behalf. Drivers and employees should first contact their employer or fleet administrator about organisation-managed information.</p>
    </>
  },
  {
    id:'collect', title:'2. Information we collect and process', icon:Database,
    body:<>
      <p>The information processed depends on the account, device and features used. It may include:</p>
      <ul>
        <li><b>Customer and company details:</b> company name, customer or administrator name, business email, mobile number, country, business address, logo, support contacts, service plan, activation and expiry dates, vehicle limit and account status.</li>
        <li><b>User account details:</b> name, work email, company, role, permissions, account status, language and interface preferences, and information supplied in privacy or support requests.</li>
        <li><b>Authentication and security data:</b> password-derived hashes, authentication and session tokens, token hashes, sign-in time, failed sign-in activity, IP address, CAPTCHA response, access role, audit trail and security-event information.</li>
        <li><b>Subscription and commercial records:</b> plan, renewal or expiry information, enabled services, invoices, payment status or transaction references, and related customer-support records. A separate payment provider may process payment credentials under its own privacy notice when one is used.</li>
        <li><b>Vehicle, asset and tracker details:</b> vehicle name, plate number, VIN, registration or asset number, make, model, category, photo, tracker IMEI or serial number, SIM number, device model, protocol, installation details, expiry date, sensor configuration and maintenance records.</li>
        <li><b>Driver and employee details:</b> name, employee or driver ID, work contact information, assigned vehicle, licence information, photo, status and RFID, iButton or other driver identifier when entered or enabled by an authorised customer administrator.</li>
        <li><b>Location, route and telemetry:</b> current and historical GPS coordinates, resolved address, route, date and time, speed, heading, altitude, ignition, movement, odometer, engine hours, battery, fuel, network signal, sensor and I/O readings, geofence events, stops, trips and alerts.</li>
        <li><b>Fleet operations:</b> points of interest, geofences, parking locations, alert rules, report schedules and exports, maintenance, expenses, command requests, immobiliser requests, driver sessions, incidents and operational notes.</li>
        <li><b>App, browser and device information:</b> app version, operating system, device model, browser type, language, IP address, notification token, session information, pages or features used, and diagnostic, crash or security logs.</li>
        <li><b>Map and address information:</b> map requests, coordinates, search text, resolved or entered addresses, provider used and cached reverse-geocoding results.</li>
        <li><b>Uploads and communications:</b> vehicle or driver images, logos, documents, notes, support messages, notification delivery information and other content a customer chooses to add.</li>
        <li><b>Service configuration:</b> authorised administrators may provide mapping, geocoding, street-imagery, CAPTCHA, notification or other integration keys and tokens. We treat non-public credentials as confidential service configuration.</li>
      </ul>
      <div className="policyNotice"><LockKeyhole/><p><b>Passwords are not stored in readable form.</b> A password is received when an account is created, reset or used to sign in, then the account database stores a salted, one-way scrypt password hash. Authorised administrators can set a temporary replacement password but cannot retrieve the existing password. Users should never send a password in a support or deletion request.</p></div>
      <p>We receive information directly from users and customer administrators, automatically from authorised vehicle trackers, sensors, apps and browsers, and from integrations selected by a customer or platform administrator. We do not intentionally request a user's personal contacts, microphone recordings or unrelated phone content for the ordinary tracking service.</p>
      <div className="policyNotice"><MapPin/><p>Most fleet location data comes from a GPS tracker installed in a vehicle or asset. The mobile app may access the phone's location only for an enabled feature such as “my location” or navigation and only after the user grants operating-system permission. Disabling phone permission may limit those features but does not stop an installed vehicle tracker from reporting to an authorised fleet account. An installed tracker may continue reporting while the mobile app is closed and whenever the tracker has power and network service, including outside a user's working hours if the customer organisation has configured continuous vehicle tracking. The customer organisation is responsible for giving its drivers appropriate notice and limiting tracking to a lawful business purpose.</p></div>
    </>
  },
  {
    id:'use', title:'3. How we use information', icon:CheckCircle2,
    body:<>
      <ul>
        <li>Provide live tracking, route history, playback, reports, alerts, geofences, driver identification, maintenance and sensor features.</li>
        <li>Authenticate users, apply role-based permissions, maintain sessions and protect accounts and devices.</li>
        <li>Deliver service, security and support messages requested by users or configured by customer administrators.</li>
        <li>Diagnose faults, prevent misuse, investigate security incidents and improve reliability and performance.</li>
        <li>Meet contractual, accounting, regulatory and lawful-authority requirements.</li>
      </ul>
      <p>Where applicable, processing is based on a service contract, consent, a legitimate purpose connected with operating and securing the Services, or a legal obligation. INVIHA does not sell personal information and does not use fleet location data for third-party behavioural advertising.</p>
      <p>The Services may automatically calculate vehicle status, driving events, driver-behaviour indicators, alerts or red/amber/green ratings from configured rules. These outputs support fleet operations and do not by themselves represent a decision by INVIHA that produces legal or similarly significant effects. A customer organisation is responsible for reviewing accuracy, context and applicable employment rules before using an output to make a decision about a person.</p>
    </>
  },
  {
    id:'sharing', title:'4. When information is shared', icon:Users,
    body:<>
      <p>Information is available to the customer organisation and the users it authorises according to their roles and vehicle permissions. We may also disclose limited information to:</p>
      <ul>
        <li><b>Hosting and technical service providers.</b> At the date of this policy, the primary production VPS is hosted by DigitalOcean in Germany. Backup, security, monitoring, communications or support providers may process limited information in the region in which their contracted service operates.</li>
        <li><b>Mapping and geocoding providers</b> selected by the platform administrator. These may include Google Maps Platform, OpenStreetMap/Nominatim, Mapillary/Meta, Mapbox, MapTiler, HERE, TomTom, Esri, Bing or Yandex. A coordinate, map request, search text, IP address or related device information may be sent to the active provider.</li>
        <li><b>Notification and communication providers</b> used for push notifications, email, SMS or customer-enabled messaging.</li>
        <li><b>Security-verification providers</b> such as Cloudflare Turnstile or Google reCAPTCHA when enabled for sign-in protection.</li>
        <li><b>Authorities or professional advisers</b> when required by law or reasonably necessary to protect people, property, legal rights or service security.</li>
        <li><b>A successor organisation</b> involved in a merger, acquisition, financing or transfer of the relevant business, subject to suitable confidentiality and notice where required.</li>
      </ul>
      <p>Third-party services process information under their own terms and privacy notices. We require processors acting for INVIHA to protect personal information consistently with applicable law and their agreements with us.</p>
    </>
  },
  {
    id:'retention', title:'5. Retention and deletion', icon:Trash2,
    body:<>
      <ul>
        <li><b>GPS history and fleet reports:</b> kept for the customer retention period. The platform default is 30 days unless the customer contract or administrator selects another permitted period.</li>
        <li><b>Vehicle-camera images:</b> kept for the configured image period when that feature is used; the platform default is 30 days.</li>
        <li><b>Account and configuration data:</b> kept while the account or customer service is active, then deleted or anonymised when no longer required for service, security, dispute resolution or law.</li>
        <li><b>Backups:</b> removed through the normal backup cycle; the platform default backup-retention period is eight weeks.</li>
        <li><b>Support, security, audit and billing records:</b> kept only as long as reasonably necessary for the relevant support, security, contractual, accounting or legal purpose.</li>
      </ul>
      <p>Authorised administrators can remove many records from the platform. A verified privacy or account-deletion request can also be made through our <a href="/data-deletion">Data Deletion page</a>. Deletion may be delayed or limited when retention is required by law, a legal claim, fraud prevention, security, or the customer's lawful instructions.</p>
    </>
  },
  {
    id:'availability', title:'6. Security, backups and data availability', icon:HardDrive,
    body:<>
      <p>We use safeguards appropriate to the information, including encrypted network connections, authentication, role-based access controls, tenant separation, logging, monitoring, backups and restricted administrative access.</p>
      <div className="policyNotice warning"><HardDrive/><p><b>No electronic service can guarantee 100% security, uninterrupted availability or permanent preservation of every record.</b> VPS or cloud failure, storage or hardware damage, network or provider outage, software defects, cyber incidents, accidental corruption, disasters or other events may delay access to information or cause data loss despite reasonable safeguards and backups. Customers should regularly export and retain independent copies of reports or records that are critical to their business, legal or regulatory needs.</p></div>
      <p>Users must protect their credentials and promptly report suspected unauthorised access. We investigate suspected personal-data incidents and notify affected parties or competent authorities when required by applicable law. Service availability and liability are also governed by the applicable customer agreement and Terms of Service.</p>
    </>
  },
  {
    id:'rights', title:'7. Your privacy choices and rights', icon:ShieldCheck,
    body:<>
      <p>Subject to applicable law and the role of the customer organisation, an individual may request access to, correction of, a copy of, restriction of, objection to, or deletion of personal information, and may withdraw consent where processing relies on consent. Mobile permissions can be changed in Android or iOS settings, and notification preferences can be managed in the app or device settings.</p>
      <p>Send a request to <a href={'mailto:'+SUPPORT_EMAIL+'?subject=Masar%20Tracking%20Privacy%20Request'}>{SUPPORT_EMAIL}</a>. Include the account email, customer organisation and request type. We may verify identity and authority before acting. If the information is controlled by an employer or fleet customer, we may refer the request to that organisation.</p>
      <p>A privacy complaint may be sent to the same address with the subject “Privacy Complaint”. Please describe the issue and the account or company concerned without including a password. If the matter is not resolved, an individual may contact Qatar's National Cyber Security Agency / National Data Privacy Office at <a href="mailto:privacy@ncsa.gov.qa">privacy@ncsa.gov.qa</a> or visit <a href="https://www.ncsa.gov.qa/en/" target="_blank" rel="noreferrer">ncsa.gov.qa</a>.</p>
    </>
  },
  {
    id:'international', title:'8. International processing', icon:Globe2,
    body:<><p>INVIHA is based in Qatar. At the date of this policy, the primary production VPS is hosted by DigitalOcean in Germany. Mapping, geocoding, security-verification, notification and support providers may process requests in the United States, European Economic Area or other countries where the selected provider operates.</p><p>Where required, INVIHA and its customers use contractual, technical and organisational safeguards for cross-border processing and comply with applicable transfer restrictions. The active provider may change when the platform administrator changes a map or integration; current provider information can be requested from the privacy contact.</p></>
  },
  {
    id:'cookies', title:'9. Cookies and local storage', icon:Cookie,
    body:<><p>The web application uses essential browser storage or cookies for secure sign-in, session continuity, language, map and interface preferences, and abuse protection. CAPTCHA providers may set their own security cookies. We do not use fleet location data for advertising cookies.</p><p>Service and security notices may be sent when needed to operate an account. Direct electronic marketing, if introduced, will use the consent or other permission required by law and will include a practical way to opt out.</p></>
  },
  {
    id:'children', title:'10. Children', icon:Smartphone,
    body:<p>The Services are intended for businesses and authorised adult users and are not directed to children. We do not knowingly offer personal accounts to children. Contact us if you believe a child’s information was submitted without lawful authority.</p>
  },
  {
    id:'changes', title:'11. Changes to this policy', icon:ShieldCheck,
    body:<p>We may update this policy when the Services, providers or legal requirements change. The latest version will remain on this page with a revised “Last updated” date. We will provide additional notice of material changes when required.</p>
  },
  {
    id:'contact', title:'12. Contact us', icon:Mail,
    body:<><p><b>INVIHA Technologies</b><br/>Privacy contact for Masar Tracking and INVIHA TRACK<br/>Qatar<br/><a href={'mailto:'+SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a></p><p>This policy is intended to meet the transparency requirements for the Masar Tracking Android and iOS applications and the INVIHA TRACK website, including <a href="https://www.almeezan.qa/EnglishLaws/132016.pdf" target="_blank" rel="noreferrer">Qatar Law No. 13 of 2016 on Protecting Personal Data Privacy</a>.</p></>
  }
];

function PolicyHeader({title,subtitle}){
 return <header className="publicPolicyHeader"><a className="policyBrand" href="/"><span><ShieldCheck/></span><div><b>INVIHA TRACK</b><small>by INVIHA Technologies</small></div></a><a className="policyBack" href="/"><ArrowLeft/>Back to sign in</a><div className="policyHero"><span className="policyKicker">PRIVACY & DATA PROTECTION</span><h1>{title}</h1><p>{subtitle}</p><div className="policyMeta"><span>Effective: {UPDATED}</span><span>Last updated: {UPDATED}</span></div></div></header>
}

export function PrivacyPolicyPage(){
 React.useEffect(()=>{document.title='Privacy Policy | Masar Tracking | INVIHA TRACK'},[]);
 return <div className="publicPolicyPage"><PolicyHeader title="Privacy Policy" subtitle="For the Masar Tracking Android and iOS applications and the INVIHA TRACK web platform, operated by INVIHA Technologies."/><div className="policyLayout"><aside><b>On this page</b>{sections.map(x=><a key={x.id} href={'#'+x.id}>{x.title.replace(/^\d+\.\s*/, '')}</a>)}<a className="deletionLink" href="/data-deletion"><Trash2/>Data deletion request</a></aside><main>{sections.map(({id,title,icon:Icon,body})=><section id={id} key={id} className="policySection"><div className="policySectionTitle"><span><Icon/></span><h2>{title}</h2></div>{body}</section>)}</main></div><PolicyFooter/></div>
}

export function DataDeletionPage(){
 React.useEffect(()=>{document.title='Data Deletion | Masar Tracking | INVIHA TRACK'},[]);
 return <div className="publicPolicyPage"><PolicyHeader title="Account and Data Deletion" subtitle="Use this process to request deletion of a Masar Tracking or INVIHA TRACK account or associated personal information."/><main className="deletionPage">
   <section className="policySection"><div className="policySectionTitle"><span><Trash2/></span><h2>How to request deletion</h2></div><ol className="deletionSteps"><li><b>Ask your company administrator</b><span>Masar Tracking and INVIHA TRACK accounts are normally created and managed by a customer organisation. Its authorised administrator can remove a user or fleet record.</span></li><li><b>Email INVIHA Privacy Support</b><span>Send the account email, customer organisation and the records you want deleted to <a href={'mailto:'+SUPPORT_EMAIL+'?subject=Masar%20Tracking%20Data%20Deletion%20Request'}>{SUPPORT_EMAIL}</a>. Do not send your password or unnecessary identity documents.</span></li><li><b>Complete verification</b><span>We may verify the requester’s identity, account ownership and authority to delete employer-managed fleet information.</span></li><li><b>Receive confirmation</b><span>Verified requests are normally completed within 30 days. We will explain any information that must be retained for legal, security or contractual reasons.</span></li></ol></section>
   <section className="policySection"><div className="policySectionTitle"><span><Database/></span><h2>What is deleted or retained</h2></div><p>Approved account-deletion requests remove or anonymise the user's profile, authentication access and personal settings. Associated content is deleted when the requester or customer organisation has authority over it. Fleet GPS history is governed by the customer organisation's retention settings and lawful instructions. Residual copies may remain until the normal backup cycle completes, and limited security, billing or legal records may be retained where required.</p><div className="policyNotice"><LockKeyhole/><p>Deleting the mobile app from a phone does not delete the server account or vehicle-tracker data. Use the process above to request server-side deletion.</p></div></section>
   <a className="privacyReturn" href="/privacy-policy"><ShieldCheck/>Read the full Privacy Policy</a>
 </main><PolicyFooter/></div>
}

function PolicyFooter(){return <footer className="publicPolicyFooter"><span>© 2026 INVIHA Technologies. All rights reserved.</span><nav><a href="/privacy-policy">Privacy Policy</a><a href="/data-deletion">Data Deletion</a><a href={'mailto:'+SUPPORT_EMAIL}>Contact</a></nav></footer>}
