import test from 'node:test';
import assert from 'node:assert/strict';
import {clientPagePath,readClientPage} from './client-routing.mjs';

test('Company pages have direct links and unknown paths return to Dashboard', () => {
  assert.equal(readClientPage('company', '/'), 'dashboard');
  assert.equal(readClientPage('company', '/vehicles'), 'vehicles');
  assert.equal(readClientPage('company', '/drivers/'), 'drivers');
  assert.equal(readClientPage('company', '/not-a-page'), 'dashboard');
  assert.equal(clientPagePath('company', 'playback'), '/playback');
});

test('Super Admin Users route maps to the existing companies screen', () => {
  assert.equal(readClientPage('admin', '/admin/'), 'dashboard');
  assert.equal(readClientPage('admin', '/admin/users'), 'companies');
  assert.equal(readClientPage('admin', '/admin/events'), 'events');
  assert.equal(readClientPage('admin', '/admin/missing'), 'dashboard');
  assert.equal(clientPagePath('admin', 'companies'), '/admin/users');
  assert.equal(clientPagePath('admin', 'dashboard'), '/admin/');
});
