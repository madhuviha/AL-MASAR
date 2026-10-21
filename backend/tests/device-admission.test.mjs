import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {createAdmissionGateway,parseGt06Login,parseTeltonikaLogin} from '../device-admission-gateway.mjs';

test('GT06 login extracts the exact 15-digit IMEI',()=>{
  const login=Buffer.from('78780d0108685770732643580142e40d0a','hex');
  assert.deepEqual(parseGt06Login(login),{imei:'868577073264358'});
});

test('GT06 parser waits for a fragmented login and rejects non-login packets',()=>{
  assert.equal(parseGt06Login(Buffer.from('78780d010868','hex')),null);
  assert.deepEqual(parseGt06Login(Buffer.from('78780a13aabbccddeeff','hex')),{invalid:true});
});

test('Teltonika login extracts the ASCII IMEI',()=>{
  const imei='350544507175696',prefix=Buffer.alloc(2);prefix.writeUInt16BE(imei.length);
  assert.deepEqual(parseTeltonikaLogin(Buffer.concat([prefix,Buffer.from(imei)])),{imei});
});

test('Teltonika parser rejects unreasonable identifiers',()=>{
  assert.equal(parseTeltonikaLogin(Buffer.from([0,15,0x33])),null);
  assert.deepEqual(parseTeltonikaLogin(Buffer.from([0,3,0x31,0x32,0x33])),{invalid:true});
});

const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port))});
const close=server=>new Promise(resolve=>server.close(resolve));

test('gateway forwards a registered IMEI and blocks an unknown IMEI',async()=>{
  const received=[];
  const upstream=net.createServer(socket=>socket.once('data',chunk=>{received.push(chunk.toString('hex'));socket.end()}));
  const upstreamPort=await listen(upstream),attempts=[];
  const gateway=createAdmissionGateway({protocol:'gt06',upstreamPort,isAllowed:imei=>imei==='868577073264358',recordAttempt:value=>attempts.push(value)});
  const gatewayPort=await listen(gateway),login=Buffer.from('78780d0108685770732643580142e40d0a','hex');
  const connect=payload=>new Promise(resolve=>{const socket=net.createConnection({host:'127.0.0.1',port:gatewayPort},()=>socket.write(payload));socket.once('close',resolve);socket.once('error',()=>resolve())});
  await connect(login);
  await connect(Buffer.from('78780d0101234567890123450142e40d0a','hex'));
  assert.deepEqual(received,[login.toString('hex')]);
  assert.equal(attempts.length,1);
  assert.equal(attempts[0].imei,'123456789012345');
  await close(gateway);await close(upstream);
});
