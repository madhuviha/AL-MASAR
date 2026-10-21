import test from 'node:test';
import assert from 'node:assert/strict';
import {changedKeys,mergeRemoteWithLocalEdits,retainConflicts} from './company-settings-merge.mjs';

const sections=[
  {id:'profile',rootKeys:['name','phone'],settingKeys:[]},
  {id:'trackingMap',rootKeys:[],settingKeys:['offlineMinutes','noSignalMinutes']}
];

test('remote refresh accepts untouched fields and preserves independent local edits',()=>{
  const baseline={name:'Old',phone:'1',settings:{offlineMinutes:10,noSignalMinutes:5}};
  const draft={...baseline,name:'Local name',settings:{...baseline.settings}};
  const remote={name:'Old',phone:'2',settings:{offlineMinutes:20,noSignalMinutes:5}};
  const merged=mergeRemoteWithLocalEdits(baseline,draft,remote,sections);
  assert.equal(merged.nextDraft.name,'Local name');
  assert.equal(merged.nextDraft.phone,'2');
  assert.equal(merged.nextDraft.settings.offlineMinutes,20);
  assert.deepEqual(merged.conflicts,{});
  assert.deepEqual(changedKeys(remote,merged.nextDraft,sections[0]),{rootKeys:['name'],settingKeys:[]});
});

test('same-field remote and local edits remain blocked across repeated refreshes',()=>{
  const baseline={name:'Old',settings:{offlineMinutes:10,noSignalMinutes:5}};
  const draft={name:'Local',settings:{offlineMinutes:10,noSignalMinutes:5}};
  const remote={name:'Remote',settings:{offlineMinutes:10,noSignalMinutes:5}};
  const first=mergeRemoteWithLocalEdits(baseline,draft,remote,sections);
  assert.deepEqual(first.conflicts,{profile:['name']});
  const retained=retainConflicts({},first.conflicts);
  const second=mergeRemoteWithLocalEdits(remote,first.nextDraft,remote,sections);
  assert.deepEqual(second.conflicts,{});
  assert.deepEqual(retainConflicts(retained,second.conflicts),{profile:['name']});
});

test('matching remote value resolves without a conflict or pending change',()=>{
  const baseline={name:'Old',settings:{offlineMinutes:10,noSignalMinutes:5}};
  const draft={name:'Chosen',settings:{offlineMinutes:10,noSignalMinutes:5}};
  const remote={name:'Chosen',settings:{offlineMinutes:10,noSignalMinutes:5}};
  const merged=mergeRemoteWithLocalEdits(baseline,draft,remote,sections);
  assert.deepEqual(merged.conflicts,{});
  assert.deepEqual(changedKeys(remote,merged.nextDraft,sections[0]),{rootKeys:[],settingKeys:[]});
});
