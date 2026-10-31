import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCommandRequest,companyUserCanAccessVehicle,commandPermissionGranted,immobilizerPermissionGranted,CommandValidationError} from '../command-policy.mjs';

const gt06={protocol:'GT06',device_model:'H9'};

test('custom command is returned byte-for-byte without a preset prefix',()=>{
  const result=normalizeCommandRequest({mode:'custom',label:'Custom Command',command:'TIMER,30,300#'},gt06);
  assert.equal(result.command,'TIMER,30,300#');
  assert.equal(result.mode,'custom');
  assert.equal(result.label,'Custom Command');
});

test('GT06 custom command requires the protocol terminator',()=>{
  assert.throws(()=>normalizeCommandRequest({mode:'custom',label:'Custom Command',command:'TIMER,30,300'},gt06),error=>error instanceof CommandValidationError&&error.code==='missing_command_terminator');
});

test('custom command rejects multiple lines and control characters',()=>{
  assert.throws(()=>normalizeCommandRequest({mode:'custom',label:'Custom Command',command:'STATUS#\nRESET#'},gt06),error=>error.code==='invalid_command_characters');
  assert.throws(()=>normalizeCommandRequest({mode:'custom',label:'Custom Command',command:'STATUS#\t'},gt06),error=>error.code==='invalid_command_characters');
});

test('custom command enforces the 400 character maximum',()=>{
  assert.throws(()=>normalizeCommandRequest({mode:'custom',label:'Custom Command',command:'A'.repeat(400)+'#'},gt06),error=>error.code==='invalid_command_length');
});

test('preset mode validates its label and keeps the preset payload',()=>{
  const result=normalizeCommandRequest({mode:'preset',label:'Get Position (Single)',command:'STATUS#'},gt06);
  assert.equal(result.command,'STATUS#');
  assert.equal(result.label,'Get Position (Single)');
  assert.throws(()=>normalizeCommandRequest({mode:'preset',label:'Get Position (Single)',command:'RESET#'},gt06),error=>error.code==='preset_payload_mismatch');
});

test('company users need both Commands permission and an assigned vehicle',()=>{
  const user={role:'company_user',metadata:{permissions:{Commands:true},vehicleIds:[8,9]}};
  assert.equal(commandPermissionGranted(user),true);
  assert.equal(companyUserCanAccessVehicle(user,9),true);
  assert.equal(companyUserCanAccessVehicle(user,10),false);
  assert.equal(companyUserCanAccessVehicle({role:'company_user',metadata:{permissions:{Commands:true}}},9),false);
  assert.equal(commandPermissionGranted({role:'company_user',metadata:{permissions:{Commands:false},vehicleIds:[9]}}),false);
});

test('immobilizer access follows the company user permission and vehicle assignment',()=>{
  assert.equal(immobilizerPermissionGranted({role:'super_admin'}),true);
  assert.equal(immobilizerPermissionGranted({role:'company_admin'}),true);
  const permitted={role:'company_user',metadata:{permissions:{Immobilizer:true},vehicleIds:[8]}};
  assert.equal(immobilizerPermissionGranted(permitted),true);
  assert.equal(companyUserCanAccessVehicle(permitted,8),true);
  assert.equal(companyUserCanAccessVehicle(permitted,9),false);
  assert.equal(immobilizerPermissionGranted({role:'company_user',metadata:{permissions:{Immobilizer:false},vehicleIds:[8]}}),false);
  assert.equal(immobilizerPermissionGranted({role:'company_user',metadata:{vehicleIds:[8]}}),false);
});

test('manually entered mobile commands need no preset mode or label',()=>{
  const request=normalizeCommandRequest({command:'STATUS#'},gt06);
  assert.deepEqual({command:request.command,mode:request.mode,label:request.label},{command:'STATUS#',mode:'custom',label:'Custom Command'});
  assert.equal(normalizeCommandRequest({mode:'custom',command:'STATUS#'},gt06).command,'STATUS#');
  assert.equal(normalizeCommandRequest({command:'STATUS#',label:'Typed on mobile'},gt06).label,'Custom Command');
  assert.throws(()=>normalizeCommandRequest({mode:'other',command:'STATUS#'},gt06),error=>error.code==='invalid_command_mode');
});
