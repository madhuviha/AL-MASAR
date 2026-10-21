process.on('uncaughtException',e=>{console.error(e.message);process.exit(1)});
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../backend/',import.meta.url).href;
const {normalizeIdentifier,identifierAliases,extractIdentifier,validateDrivers}=await import(root+'driver-identity.mjs');
const {syncDrivers,identifyPosition,currentDrivers,enrichDriverHistory}=await import(root+'driver-identification.mjs');
let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name);}
const db=new PGlite();
await db.exec('CREATE TABLE companies(id BIGINT PRIMARY KEY);CREATE TABLE vehicles(id BIGINT PRIMARY KEY,company_id BIGINT REFERENCES companies(id));INSERT INTO companies VALUES(1),(2);INSERT INTO vehicles VALUES(101,1),(102,1),(201,2);');
const migration=await fs.readFile(new URL(root+'migration-driver-identification.sql'),'utf8');
await test('additive migration is repeatable',async()=>{await db.exec(migration);await db.exec(migration);assert.equal((await db.query('SELECT count(*) FROM vehicles')).rows[0].count,3)});
await test('text identifiers preserve leading zeros, normalize byte notation and reject unsafe numbers',()=>{assert.equal(normalizeIdentifier(' 00a4 '),'00A4');assert.equal(normalizeIdentifier('0x7a:00:00:04:5a:bc:de'),'7A0000045ABCDE');assert.equal(normalizeIdentifier([0x7a,0x00,0x00,0x04,0x5a,0xbc,0xde]),'7A0000045ABCDE');assert.deepEqual(extractIdentifier({attributes:{driverUniqueId:[0x7a,0x00,0x00,0x04,0x5a,0xbc,0xde]}}),{raw:'7A0000045ABCDE',normalized:'7A0000045ABCDE',type:'DRIVER_ID',source:'driverUniqueId'});assert.equal(normalizeIdentifier(999999999999999999),null);assert.equal(normalizeIdentifier('00000000'),null);});
await test('battery and ignition cannot become driver identity',()=>{assert.equal(extractIdentifier({attributes:{battery:123,ignition:true}}),null);assert.throws(()=>extractIdentifier({attributes:{battery:123}},{sourceKey:'battery'}));});
await test('duplicate company identifiers are rejected',()=>assert.throws(()=>validateDrivers([{id:'a',name:'A',rfid:'abc'},{id:'b',name:'B',ibutton:'ABC'}]),/already belongs/));
await syncDrivers(db,1,[{id:'madhu',name:'Madhu',identifiers:[{type:'RFID',identifier:'00A4'},{type:'IBUTTON',identifier:'7A0000045ABCDE'}]},{id:'mohammed',name:'Mohammed',rfid:'123456'}]);
await syncDrivers(db,2,[{id:'other',name:'Other tenant',identifiers:[{type:'RFID',identifier:'00A4'},{type:'IBUTTON',identifier:'7A0000045ABCDE'}]}]);
const base=Date.now()-3600000;
const v=(id,company=1)=>({id,company_id:company,traccar_device_id:id,metadata:{}});
const p=(id,tag,minute=0,seq=minute)=>({id:seq,deviceId:id,deviceTime:new Date(base+minute*60000).toISOString(),attributes:{driverUniqueId:tag}});
await test('iButton byte aliases bridge Teltonika hex and GT06 decimal forms',()=>{
 const hex='7A0000045ABCDE',decimal=BigInt('0x'+hex).toString(10);
 assert.ok(identifierAliases(hex,'IBUTTON').includes(decimal));
 assert.ok(identifierAliases(decimal,'IBUTTON').includes(hex));
 assert.ok(identifierAliases('007A0000045ABCDE','IBUTTON').includes(hex));
 assert.throws(()=>validateDrivers([{id:'hex',name:'Hex',ibutton:hex},{id:'decimal',name:'Decimal',ibutton:decimal}]),/byte-equivalent/);
});
await test('registered iButton matches without assignment',async()=>{const r=await identifyPosition(db,v(101),p(101,'7A0000045ABCDE',0));assert.equal(r.name,'Madhu');assert.equal(r.type,'IBUTTON');});
await test('GT06 decimal iButton packet matches registered byte ID',async()=>{const decimal=BigInt('0x7A0000045ABCDE').toString(10);const r=await identifyPosition(db,{...v(201,2),protocol:'gt06'},{...p(201,decimal,0),protocol:'gt06'});assert.equal(r.name,'Other tenant');assert.equal(r.identifier,decimal);});
await test('repeat packets do not create duplicate sessions',async()=>{await identifyPosition(db,v(101),p(101,'7A0000045ABCDE',0));await identifyPosition(db,v(101),p(101,'7A0000045ABCDE',1));assert.equal((await db.query('SELECT count(*) FROM vehicle_driver_sessions WHERE vehicle_id=101')).rows[0].count,1);});
await test('driver replacement closes previous session',async()=>{await identifyPosition(db,v(101),p(101,'123456',2));const r=await db.query('SELECT * FROM vehicle_driver_sessions WHERE vehicle_id=101 ORDER BY started_at');assert.ok(r.rows[0].ended_at);assert.equal(r.rows[1].driver_name,'Mohammed');});
await test('driver moves between vehicles and copied old telemetry cannot reclaim them',async()=>{await identifyPosition(db,v(102),p(102,'123456',3));await identifyPosition(db,v(101),p(101,'123456',4));const r=await currentDrivers(db,[v(101),v(102)]);assert.equal(r.has('101'),false);assert.equal(r.get('102').name,'Mohammed');});
await test('unknown identifier closes matched session and keeps exact raw value',async()=>{const r=await identifyPosition(db,v(102),p(102,' unknown-Tag ',5));assert.equal(r.name,'Unknown Driver');assert.equal(r.identifier,' unknown-Tag ');});
await test('missing identity is not inferred from planned driver or other telemetry',async()=>{assert.equal(await identifyPosition(db,v(102),{...p(102,'',6),attributes:{ignition:true,battery:99}}),null);});
await test('out-of-order event does not replace current driver',async()=>{await identifyPosition(db,v(102),p(102,'00A4',1,99));assert.equal((await currentDrivers(db,[v(102)])).get('102').name,'Unknown Driver');});
await test('same tag resolves independently in another tenant',async()=>{await identifyPosition(db,v(201,2),p(201,'00A4',7));assert.equal((await currentDrivers(db,[v(201,2)])).get('201').name,'Other tenant');});
await test('wrong device packet is ignored',async()=>assert.equal(await identifyPosition(db,v(101),p(201,'00A4',8)),null));
await test('historical route uses driver at event time, not current assignment',async()=>{const from=new Date(base).toISOString(),to=new Date(base+600000).toISOString();const rows=await enrichDriverHistory(db,v(101),'route',[p(101,'',0),p(101,'',2),p(101,'',4)],from,to);assert.deepEqual(rows.map(x=>x.current_driver.name),['Madhu','Mohammed','Not identified']);});
await test('driver identification events appear in recorded Events',async()=>{const rows=await enrichDriverHistory(db,v(102),'events',[],new Date(base).toISOString(),new Date(base+600000).toISOString());assert.deepEqual(rows.map(e=>e.type),['Late driver identification','Driver identified','Unknown Driver']);});
await test('database enforces tenant isolation for session vehicle',async()=>{await assert.rejects(()=>db.query("INSERT INTO driver_identity_cursor(company_id,vehicle_id) VALUES(2,101)"),/foreign key/);});
await test('inactive tag does not identify a driver',async()=>{await syncDrivers(db,1,[{id:'madhu',name:'Madhu',status:'Inactive',rfid:'00A4'}]);const r=await identifyPosition(db,v(101),p(101,'00A4',9));assert.equal(r.status,'unknown');});

await test('explicit Teltonika iButton tap can return a driver to a previous vehicle',async()=>{
 await syncDrivers(db,1,[{id:'madhu',name:'Madhu',rfid:'00A4'}]);
 await identifyPosition(db,{...v(101),protocol:'teltonika'},{...p(101,'00A4',10),attributes:{driverUniqueId:'00A4',event:78}});
 await identifyPosition(db,v(102),p(102,'00A4',11));
 const r=await identifyPosition(db,{...v(101),protocol:'teltonika'},{...p(101,'00A4',12),attributes:{driverUniqueId:'00A4',event:78}});
 assert.equal(r.name,'Madhu');assert.equal((await currentDrivers(db,[v(101),v(102)])).has('102'),false);
});
await test('unknown tag retains history when a driver registers later',async()=>{
 const rows=await enrichDriverHistory(db,v(102),'route',[p(102,'',5)],new Date(base).toISOString(),new Date(base+900000).toISOString());assert.equal(rows[0].current_driver.name,'Unknown Driver');
});
await test('database prevents duplicate active identifiers',async()=>{
 await db.query("INSERT INTO drivers(company_id,id,name) VALUES(1,'third','Third')");
 await assert.rejects(()=>db.query("INSERT INTO driver_identifiers(company_id,driver_id,type,identifier_normalized) VALUES(1,'third','RFID','00A4')"),/unique/);
});
await test('driver overtime excludes other drivers and unidentified intervals',async()=>{
 const {dutyDriving}=await import(root+'driver-duty.mjs');
 const d={id:'madhu',duty:{enabled:true,start:'00:00',end:'23:59',days:[0,1,2,3,4,5,6],timezone:'UTC',rate:10}};
 const points=[0,1,2,3].map((n)=>({...p(101,'',n),speed:20,current_driver:n===0?{driver_id:'madhu'}:n===1?{driver_id:'other'}:null}));
 assert.equal(dutyDriving(points,d).normalDrivingMinutes,1);
});
await test('driver report uses recorded matched and unknown events without assignments',async()=>{
 const {buildReport}=await import(root+'report-engine.mjs');
 const result=await buildReport({type:'Driver Report',vehicles:[{id:101,deviceId:101,name:'Car'}],store:{drivers:[]},from:new Date(base).toISOString().slice(0,10),to:new Date(base).toISOString().slice(0,10),driverId:'all'},{events:async()=>[{type:'Driver identified',eventTime:new Date(base).toISOString(),current_driver:{driver_id:'madhu',name:'Madhu',identifier:'00A4',type:'RFID'}},{type:'Unknown Driver',eventTime:new Date(base+60000).toISOString(),current_driver:{name:'Unknown Driver',identifier:'XX',type:'DRIVER_ID'}}]});
 assert.deepEqual(result.map(x=>x.driver),['Madhu','Unknown Driver']);
});
await test('worker catches brief tags between snapshots and notifies only after commit',async()=>{
 await db.exec("ALTER TABLE companies ADD COLUMN status TEXT DEFAULT 'inactive'; ALTER TABLE vehicles ADD COLUMN active BOOLEAN DEFAULT TRUE; ALTER TABLE vehicles ADD COLUMN traccar_device_id BIGINT; ALTER TABLE vehicles ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb; ALTER TABLE vehicles ADD COLUMN name TEXT; CREATE TABLE company_state(company_id BIGINT PRIMARY KEY,data JSONB,version BIGINT DEFAULT 1,updated_at TIMESTAMPTZ); INSERT INTO companies(id,status) VALUES(3,'active'); INSERT INTO vehicles(id,company_id,traccar_device_id,name,metadata) VALUES(301,3,301,'Test vehicle','{\"driverIdentification\":{\"unknownAlert\":true}}');");
 await db.query('INSERT INTO company_state(company_id,data) VALUES(3,$1::jsonb)',[JSON.stringify({drivers:[{id:'worker',name:'Worker driver',rfid:'AA01'}]})]);
 const {startDriverWorker}=await import(root+'driver-worker.mjs');
 let stop;const completed=new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Worker did not complete')),10000);
  stop=startDriverWorker({pool:{query:db.query.bind(db),connect:async()=>({query:db.query.bind(db),release(){}})},trackingApi:{get:async(url)=>{assert.equal(url,'/api/positions');return {data:[{id:3001,deviceId:301,deviceTime:new Date(Date.now()-30000).toISOString(),attributes:{driverUniqueId:'AA01'}},{id:3002,deviceId:301,deviceTime:new Date(Date.now()-20000).toISOString(),attributes:{driverUniqueId:'UNKNOWN'}},{id:3003,deviceId:301,deviceTime:new Date(Date.now()-10000).toISOString(),attributes:{}}]}}},onChange:company=>{clearTimeout(timeout);resolve(company)}});
 });
 try{assert.equal(await completed,3);const current=(await currentDrivers(db,[{id:301}])).get('301');assert.equal(current.name,'Unknown Driver');const saved=(await db.query('SELECT data FROM company_state WHERE company_id=3')).rows[0].data;assert.equal(saved.alerts.length,1);assert.equal(saved.alerts[0].identifier,'UNKNOWN');}finally{stop();}
});

await test('Traccar database ingestion uses durable position IDs',async()=>{
 await db.exec("UPDATE companies SET status='inactive'; INSERT INTO companies(id,status) VALUES(4,'active'); INSERT INTO vehicles(id,company_id,traccar_device_id,name) VALUES(401,4,401,'Database vehicle');CREATE TABLE tc_positions(id BIGINT PRIMARY KEY,deviceid BIGINT,devicetime TIMESTAMPTZ,fixtime TIMESTAMPTZ,servertime TIMESTAMPTZ,protocol TEXT,attributes JSONB);");
 await db.query('INSERT INTO company_state(company_id,data) VALUES(4,$1::jsonb)',[JSON.stringify({drivers:[{id:'dbdriver',name:'Database driver',ibutton:'ABCD'}]})]);
 await db.query("INSERT INTO tc_positions VALUES(4001,401,$1,$1,$1,'teltonika',$2::jsonb)",[new Date(Date.now()-10000).toISOString(),JSON.stringify({driverUniqueId:'ABCD',event:78})]);
 const {startDriverWorker}=await import(root+'driver-worker.mjs');let stop;
 const completed=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Database worker timeout')),10000);stop=startDriverWorker({pool:{query:db.query.bind(db),connect:async()=>({query:db.query.bind(db),release(){}})},livePool:db,trackingApi:{get(){throw Error('API should not be needed');}},onChange:co=>{clearTimeout(timeout);resolve(co);}});});
 try{assert.equal(await completed,4);assert.equal((await currentDrivers(db,[{id:401}])).get('401').name,'Database driver');assert.equal((await db.query('SELECT last_position_id FROM driver_identity_cursor WHERE company_id=4')).rows[0].last_position_id,4001);}finally{stop();}
});

await test('unchanged driver masters avoid repeated upserts',async()=>{
 let writes=0;const watched={query:async(sql,args)=>{if(/^(UPDATE|INSERT)/.test(sql))writes++;return db.query(sql,args)}};
 const records=[{id:'dbdriver',name:'Database driver',ibutton:'ABCD'}];await syncDrivers(watched,4,records);assert.equal(writes,0);
});
await test('malformed driver records fail validation',()=>{assert.throws(()=>validateDrivers([null]),/driver/);assert.throws(()=>validateDrivers([{id:'bad',name:'Bad',identifiers:[null]}]),/identifier/);});
await test('driver sensors ignore battery and still identify without GPS',async()=>{
 const {sensorReading}=await import(root+'../company-admin/frontend/src/sensor-model.mjs');
 const sensor={name:'Driver',sourceKey:'battery',type:'Digital Input'};
 assert.equal(sensorReading({attributes:{battery:123}},sensor),'Not identified');
 assert.equal(sensorReading({current_driver:{name:'Database driver',identifier:'ABCD'}},sensor),'Database driver · ABCD');
});
console.log(count+' tests passed');await db.close();
