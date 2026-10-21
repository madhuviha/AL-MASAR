import net from 'node:net';
import {pathToFileURL} from 'node:url';

const validImei=value=>/^\d{8,20}$/.test(String(value||''));

export function parseGt06Login(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<4)return null;
  let protocolIndex,identityIndex;
  if(buffer[0]===0x78&&buffer[1]===0x78){
    protocolIndex=3;identityIndex=4;
  }else if(buffer[0]===0x79&&buffer[1]===0x79){
    if(buffer.length<5)return null;
    protocolIndex=4;identityIndex=5;
  }else return {invalid:true};
  if(buffer.length<=protocolIndex)return null;
  if(buffer[protocolIndex]!==0x01)return {invalid:true};
  if(buffer.length<identityIndex+8)return null;
  const encoded=buffer.subarray(identityIndex,identityIndex+8).toString('hex');
  const imei=encoded.startsWith('0')?encoded.slice(1):encoded;
  return validImei(imei)?{imei}:{invalid:true};
}

export function parseTeltonikaLogin(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<2)return null;
  const length=buffer.readUInt16BE(0);
  if(length<8||length>20)return {invalid:true};
  if(buffer.length<2+length)return null;
  const imei=buffer.subarray(2,2+length).toString('ascii');
  return validImei(imei)?{imei}:{invalid:true};
}

const parsers={gt06:parseGt06Login,teltonika:parseTeltonikaLogin};
const cleanIp=value=>String(value||'unknown').replace(/^::ffff:/,'');
const integer=(value,fallback,min,max)=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback};

export function createAdmissionGateway({
  pool,
  protocol,
  listenPort,
  upstreamHost='127.0.0.1',
  upstreamPort,
  loginTimeoutMs=5000,
  maximumLoginBytes=256,
  maximumConnections=500,
  maximumConnectionsPerIp=20,
  maximumAttemptsPerIpMinute=100,
  recordAttempt=()=>{},
  isAllowed=()=>false,
}){
  const parser=parsers[protocol];
  if(!parser)throw Error('Unsupported admission protocol: '+protocol);
  let openConnections=0;
  const sockets=new Set();
  const activeByIp=new Map(),attemptsByIp=new Map();
  const server=net.createServer({pauseOnConnect:false},socket=>{
    sockets.add(socket);
    const ip=cleanIp(socket.remoteAddress),now=Date.now();
    const current=activeByIp.get(ip)||0,window=attemptsByIp.get(ip);
    const attempt=!window||now-window.startedAt>=60000?{startedAt:now,count:1}:{...window,count:window.count+1};
    attemptsByIp.set(ip,attempt);
    if(openConnections>=maximumConnections||current>=maximumConnectionsPerIp||attempt.count>maximumAttemptsPerIpMinute){socket.destroy();return}
    openConnections+=1;activeByIp.set(ip,current+1);
    let finished=false,buffer=Buffer.alloc(0);
    const release=()=>{if(finished)return;finished=true;clearTimeout(timer);openConnections=Math.max(0,openConnections-1);const left=Math.max(0,(activeByIp.get(ip)||1)-1);if(left)activeByIp.set(ip,left);else activeByIp.delete(ip)};
    const reject=(imei=null)=>{if(imei)recordAttempt({protocol,imei,ip,port:socket.remotePort||null});release();socket.destroy()};
    const timer=setTimeout(()=>reject(),loginTimeoutMs);
    socket.once('error',release);socket.once('close',()=>{sockets.delete(socket);release()});
    socket.on('data',function authenticate(chunk){
      if(buffer.length+chunk.length>maximumLoginBytes)return reject();
      buffer=Buffer.concat([buffer,chunk]);
      const identity=parser(buffer);
      if(!identity)return;
      socket.removeListener('data',authenticate);
      if(identity.invalid||!isAllowed(identity.imei))return reject(identity.imei||null);
      clearTimeout(timer);socket.pause();
      const upstream=net.createConnection({host:upstreamHost,port:upstreamPort});
      upstream.setNoDelay(true);socket.setNoDelay(true);
      upstream.once('connect',()=>{upstream.write(buffer);socket.pipe(upstream);upstream.pipe(socket);socket.resume()});
      upstream.once('error',()=>socket.destroy());
      upstream.once('close',()=>socket.destroy());
    });
  });
  server.forceCloseConnections=()=>{for(const socket of sockets)socket.destroy()};
  server.on('error',error=>console.error(`Admission gateway ${protocol}:`,error.message));
  return server;
}

export async function startAdmissionGateways(env=process.env){
  const [{default:dotenv},{default:pg}]=await Promise.all([import('dotenv'),import('pg')]);
  dotenv.config();env={...process.env,...env};
  const {Pool}=pg;
  if(!env.DATABASE_URL)throw Error('DATABASE_URL is required for device admission.');
  const pool=new Pool({connectionString:env.DATABASE_URL,max:3});
  const allowed=new Set(),declined=new Set(),pending=new Map();
  let lastFlush=0,refreshing=false,flushing=false;
  const refresh=async()=>{
    if(refreshing)return;refreshing=true;
    try{
      const [vehicles,blocked]=await Promise.all([
        pool.query("SELECT imei FROM vehicles WHERE active<>FALSE AND company_id IS NOT NULL AND COALESCE(metadata->>'archived','false')<>'true'"),
        pool.query("SELECT protocol,imei FROM device_admission_attempts WHERE status='declined'"),
      ]);
      allowed.clear();for(const row of vehicles.rows)if(validImei(row.imei))allowed.add(String(row.imei));
      declined.clear();for(const row of blocked.rows)declined.add(`${row.protocol}:${row.imei}`);
    }finally{refreshing=false}
  };
  const recordAttempt=attempt=>{
    if(declined.has(`${attempt.protocol}:${attempt.imei}`))return;
    const key=`${attempt.protocol}:${attempt.imei}`,existing=pending.get(key);
    if(existing){existing.count+=1;existing.lastSeen=new Date();existing.ip=attempt.ip;existing.port=attempt.port;return}
    if(pending.size>=1000)return;
    pending.set(key,{...attempt,count:1,firstSeen:new Date(),lastSeen:new Date()});
  };
  const flush=async()=>{
    if(flushing||!pending.size)return;flushing=true;
    const batch=[...pending.values()];pending.clear();
    try{
      for(let index=0;index<batch.length;index+=100){
        const rows=batch.slice(index,index+100),values=[],args=[];
        for(const row of rows){const base=args.length;args.push(row.protocol,row.imei,row.firstSeen,row.lastSeen,row.count,row.ip,row.port);values.push(`($${base+1},$${base+2},'pending',$${base+3},$${base+4},$${base+5},$${base+6},$${base+7})`)}
        await pool.query(`INSERT INTO device_admission_attempts(protocol,imei,status,first_seen,last_seen,attempt_count,last_ip,last_port) VALUES ${values.join(',')} ON CONFLICT(protocol,imei) DO UPDATE SET last_seen=GREATEST(device_admission_attempts.last_seen,EXCLUDED.last_seen),attempt_count=device_admission_attempts.attempt_count+EXCLUDED.attempt_count,last_ip=EXCLUDED.last_ip,last_port=EXCLUDED.last_port,updated_at=NOW()`,args);
      }
      lastFlush=Date.now();
    }catch(error){for(const row of batch)recordAttempt(row);console.error('Device admission pending flush:',error.message)}finally{flushing=false}
  };
  await refresh();
  const common={pool,recordAttempt,isAllowed:imei=>allowed.has(String(imei))};
  const specifications=[
    {protocol:'gt06',listenPort:integer(env.ADMISSION_GT06_LISTEN_PORT,5023,1,65535),upstreamPort:integer(env.ADMISSION_GT06_UPSTREAM_PORT,15023,1,65535)},
    {protocol:'teltonika',listenPort:integer(env.ADMISSION_TELTONIKA_LISTEN_PORT,5027,1,65535),upstreamPort:integer(env.ADMISSION_TELTONIKA_UPSTREAM_PORT,15027,1,65535)},
  ];
  const servers=specifications.map(specification=>createAdmissionGateway({...common,...specification}));
  await Promise.all(servers.map((server,index)=>new Promise((resolve,reject)=>{
    const onError=error=>{server.off('listening',onListening);reject(error)};
    const onListening=()=>{server.off('error',onError);resolve()};
    server.once('error',onError);server.once('listening',onListening);
    server.listen(specifications[index].listenPort,'0.0.0.0');
  })));
  const refreshTimer=setInterval(()=>refresh().catch(error=>console.error('Device admission allowlist:',error.message)),10000);
  const flushTimer=setInterval(()=>flush(),30000);
  refreshTimer.unref();flushTimer.unref();
  const bounded=(promise,ms=2000)=>Promise.race([promise,new Promise(resolve=>setTimeout(resolve,ms))]);
  const close=async()=>{
    clearInterval(refreshTimer);clearInterval(flushTimer);
    await bounded(flush());
    await Promise.all(servers.map(server=>new Promise(resolve=>{
      const timer=setTimeout(resolve,2000);
      server.close(()=>{clearTimeout(timer);resolve()});
      server.closeAllConnections?.();
      server.forceCloseConnections?.();
    })));
    await bounded(pool.end());
  };
  console.log(`Device admission active: ${allowed.size} registered IMEIs; GT06 ${env.ADMISSION_GT06_LISTEN_PORT||5023}->${env.ADMISSION_GT06_UPSTREAM_PORT||15023}; Teltonika ${env.ADMISSION_TELTONIKA_LISTEN_PORT||5027}->${env.ADMISSION_TELTONIKA_UPSTREAM_PORT||15027}`);
  return {servers,close,allowed,pending,get lastFlush(){return lastFlush}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  startAdmissionGateways().then(runtime=>{
    let stopping=false;
    const stop=()=>{
      if(stopping)return;
      stopping=true;
      const forced=setTimeout(()=>process.exit(0),5000);
      runtime.close().catch(error=>console.error('Device admission shutdown:',error.message)).finally(()=>{clearTimeout(forced);process.exit(0)});
    };
    process.once('SIGTERM',stop);process.once('SIGINT',stop);
  }).catch(error=>{console.error(error);process.exit(1)});
}
