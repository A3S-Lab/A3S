import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  parseCloudStackLock,
  tomlDependency,
  verifyCloudStack,
} from './verify-cloud-stack.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_PATH = resolve(ROOT, 'compat/cloud-stack.acl');
const LOCK_SOURCE = readFileSync(LOCK_PATH, 'utf8');

test('the checked-in Cloud stack is reproducible and clean', () => {
  const result = verifyCloudStack(ROOT);
  assert.match(result.digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.components.length, 10);
  assert.deepEqual(result.aclFiles, ['config/cloud.acl', 'config/node.example.acl']);
});

test('the lock rejects unknown fields before accepting canonical text', () => {
  const mutated = LOCK_SOURCE.replace('  format = 1\n', '  format = 1\n  mystery = true\n');
  assert.throws(() => parseCloudStackLock(mutated), /unknown attribute mystery/);
});

test('the lock rejects unsafe and duplicate component paths', () => {
  const unsafe = LOCK_SOURCE.replace('  path = "crates/acl"\n', '  path = "../acl"\n');
  assert.throws(() => parseCloudStackLock(unsafe), /normalized repository-relative path/);

  const duplicate = LOCK_SOURCE.replace('  path = "crates/boot"\n', '  path = "crates/acl"\n');
  assert.throws(() => parseCloudStackLock(duplicate), /duplicate component path crates\/acl/);
});

test('the lock must use canonical a3s-acl attribute ordering', () => {
  const noncanonical = LOCK_SOURCE.replace(
    '  owner = "A3S-Lab/ACL"\n  package = "a3s-acl"\n',
    '  package = "a3s-acl"\n  owner = "A3S-Lab/ACL"\n',
  );
  assert.throws(() => parseCloudStackLock(noncanonical), /not in canonical a3s-acl form/);
});

test('multiline Cargo dependency declarations are read as one binding', () => {
  const cloudManifest = readFileSync(resolve(ROOT, 'apps/cloud/Cargo.toml'), 'utf8');
  const boot = tomlDependency(
    cloudManifest,
    'workspace.dependencies',
    'a3s-boot',
    'apps/cloud/Cargo.toml',
  );
  assert.match(boot, /version = "=0\.1\.1"/);
  assert.match(boot, /"openapi-schemas"/);
});
