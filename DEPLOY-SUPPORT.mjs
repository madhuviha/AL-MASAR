import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [command, backend, destination] = process.argv.slice(2);
const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'SOURCE-MANIFEST.json'), 'utf8'));
const files = manifest.files.filter(f => f.deploy);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function checkSources(updated) {
  for (const f of files) {
    const name = f.path.slice(8);
    if (!name || name !== path.basename(name)) throw Error('Invalid source manifest path.');
    if (hash(path.join(root, f.path)) !== f.updatedSha256) throw Error('Package source mismatch: ' + name);
    const live = path.join(backend, name);
    if (fs.existsSync(live) && fs.lstatSync(live).isSymbolicLink()) throw Error('Unexpected symlink: ' + name);
    const actual=fs.existsSync(live)?hash(live):null;
    if(updated ? actual!==f.updatedSha256 : !f.acceptedBaselineSha256.includes(actual)) throw Error('Live source differs from the reviewed versions: '+name+'. Stopped before installation.');
  }
  console.log(updated ? 'Installed backend hashes verified.' : 'Live backend baseline verified.');
}
async function main() {
  if(command === 'web-baseline'){
    for(const [portal,dir] of [['company-admin',backend],['super-admin',destination]]){
      const index=path.join(dir,'index.html');
      if(!fs.existsSync(index)||fs.lstatSync(index).isSymbolicLink())throw Error('Missing or linked portal index: '+portal);
      const known=manifest.webBaselines[portal].find(v=>v.indexSha256===hash(index));
      if(!known)throw Error('Unrecognized live portal version: '+portal+'. No update installed.');
      for(const file of known.files){
        const target=path.join(dir,file.path);
        if(!fs.existsSync(target)||fs.lstatSync(target).isSymbolicLink()||hash(target)!==file.sha256)throw Error('Live portal asset differs from the reviewed version: '+portal+'/'+file.path);
      }
    }
    console.log('Both live portal builds match a reviewed version.');return;
  }
  if (command === 'baseline' || command === 'updated') return checkSources(command === 'updated');
  if (command === 'files' || command === 'existing') {
    for (const f of files.filter(f => command === 'files' || fs.existsSync(path.join(backend,f.path.slice(8))))) console.log(f.path.slice(8));
    return;
  }
  const require = createRequire(path.join(backend, 'package.json'));
  const env = {...process.env, ...require('dotenv').parse(fs.readFileSync(path.join(backend, '.env')))};
  if (command === 'port') {
    const port = Number(env.PORT || 3001);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid backend port.');
    console.log(port);
    return;
  }
  if (!env.DATABASE_URL) throw Error('Existing DATABASE_URL is required.');
  if (command === 'backup') {
    const url = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error('Expected PostgreSQL database.');
    const pgEnv = {...process.env, PGHOST:url.hostname, PGPORT:url.port || '5432', PGUSER:decodeURIComponent(url.username), PGPASSWORD:decodeURIComponent(url.password), PGDATABASE:decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT:'10'};
    for (const [param,key] of [['sslmode','PGSSLMODE'],['sslcert','PGSSLCERT'],['sslkey','PGSSLKEY'],['sslrootcert','PGSSLROOTCERT']]) if (url.searchParams.has(param)) pgEnv[key] = url.searchParams.get(param);
    const result = spawnSync('pg_dump', ['--format=custom', '--file', destination], {env:pgEnv, stdio:['ignore','ignore','pipe'], timeout:150000});
    if (result.status !== 0) throw Error('Application database backup failed; no update activated. Check pg_dump version and database access.');
    fs.chmodSync(destination, 0o600);
    if (spawnSync('pg_restore',['--list',destination],{stdio:'ignore',timeout:10000}).status !== 0) throw Error('Database backup verification failed.');
    console.log('Application database backup verified.');
    return;
  }
  if (command === 'schema') {
    const pg = require('pg');
    const pool = new pg.Pool({connectionString:env.DATABASE_URL, connectionTimeoutMillis:10000, statement_timeout:10000});
    try {
      for (const [table, columns] of [
        ['drivers','company_id,id,name,active,details'],
        ['driver_identifiers','company_id,driver_id,identifier_normalized,active'],
        ['vehicle_driver_sessions','company_id,vehicle_id,driver_id,started_at,ended_at'],
        ['driver_identification_events','company_id,vehicle_id,position_key,event_time,applied'],
        ['driver_identity_cursor','company_id,vehicle_id,last_position_id'],
        ['driver_master_sync','company_id,digest'],
        ['device_models','id,brand,series,model,capabilities_json'],
        ['vehicle_io_mappings','vehicle_id,source_channel,function_key,config_json,enabled'],
        ['vehicles','device_model_id,tracking_type']
      ]) await pool.query(`SELECT ${columns} FROM ${table} LIMIT 0`);
      console.log('Driver identification and device-profile database tables verified.');
    } finally { await pool.end(); }
    return;
  }
  throw Error('Unknown deployment helper command.');
}
main().catch(error => {
  // Do not print connection strings, child-process stderr, or credentials.
  console.error(error.code ? 'Deployment check failed (' + error.code + ').' : error.message);
  process.exitCode = 1;
});
