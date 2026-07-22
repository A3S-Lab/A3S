import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '../../..');
const docsRoot = path.join(root, 'apps/docs/content/docs');
const release = JSON.parse(
  readFileSync(path.join(root, 'apps/docs/cloud-releases/cloud-0.1.0.json'), 'utf8'),
);
const pages = [
  'index',
  'install-upgrade',
  'recovery',
  'node-operations',
  'interfaces',
  'runbooks',
];

assert.equal(release.schema, 'a3s.cloud.docs-release.v1');
assert.match(release.cloudRevision, /^[0-9a-f]{40}$/);
assert.deepEqual(Object.keys(release.documents).sort(), ['cn', 'en']);

function parseBlocks(source, kind) {
  const blocks = new Map();
  const expression = new RegExp(`${kind} "([^"]+)" \\{([\\s\\S]*?)\\n\\}`, 'g');
  for (const match of source.matchAll(expression)) {
    const attributes = new Map();
    for (const line of match[2].split('\n')) {
      const attribute = line.match(/^\s*([a-z_]+)\s*=\s*(?:"([^"]*)"|(\d+))\s*$/);
      if (attribute) attributes.set(attribute[1], attribute[2] ?? Number(attribute[3]));
    }
    blocks.set(match[1], attributes);
  }
  return blocks;
}

const lockSource = readFileSync(path.join(root, release.compatibilityLock), 'utf8');
const lockComponents = parseBlocks(lockSource, 'component');
for (const [name, expected] of Object.entries(release.components)) {
  const actual = lockComponents.get(name);
  assert.ok(actual, `compatibility lock is missing component ${name}`);
  assert.equal(actual.get('version'), expected.version, `${name} version drift`);
  if (expected.revision) {
    assert.equal(actual.get('revision'), expected.revision, `${name} revision drift`);
  } else {
    assert.equal(actual.get('source'), expected.source, `${name} source drift`);
  }
}

const lockProtocols = parseBlocks(lockSource, 'protocol');
for (const [name, expected] of Object.entries(release.protocols)) {
  const actual = lockProtocols.get(name);
  assert.ok(actual, `compatibility lock is missing protocol ${name}`);
  assert.equal(actual.get('level'), expected.level, `${name} level drift`);
  assert.equal(actual.get('schema'), expected.schema, `${name} schema drift`);
}

const gitlink = execFileSync('git', ['ls-tree', 'HEAD', 'apps/cloud'], {
  cwd: root,
  encoding: 'utf8',
}).trim().split(/\s+/)[2];
assert.equal(gitlink, release.cloudRevision, 'Cloud gitlink differs from the docs snapshot');

function resolveLocalLink(language, pagePath, target) {
  if (target.startsWith('/docs/')) {
    return path.join(docsRoot, 'en', target.slice('/docs/'.length));
  }
  if (target.startsWith('/cn/docs/')) {
    return path.join(docsRoot, 'cn', target.slice('/cn/docs/'.length));
  }
  return path.resolve(path.dirname(pagePath), target);
}

function existingDocument(candidate) {
  return [candidate, `${candidate}.mdx`, path.join(candidate, 'index.mdx')].some(existsSync);
}

for (const language of ['en', 'cn']) {
  const cloudDirectory = path.join(docsRoot, language, 'cloud');
  const cloudMeta = JSON.parse(readFileSync(path.join(cloudDirectory, 'meta.json'), 'utf8'));
  assert.deepEqual(cloudMeta.pages, ['index', 'v0.1.0'], `${language} Cloud root navigation drift`);
  const versionDirectory = path.join(cloudDirectory, 'v0.1.0');
  const versionMeta = JSON.parse(readFileSync(path.join(versionDirectory, 'meta.json'), 'utf8'));
  assert.deepEqual(versionMeta.pages, pages, `${language} Cloud topic parity drift`);

  for (const page of pages) {
    const pagePath = path.join(versionDirectory, `${page}.mdx`);
    const source = readFileSync(pagePath, 'utf8');
    assert.ok(source.includes('Snapshot: `cloud-0.1.0`'), `${pagePath} has no snapshot marker`);
    assert.match(source, /Status: \*\*(Verified|Experimental|Planned|Optional)\*\*/);
    assert.ok(!source.includes('a3s cloud '), `${pagePath} advertises the planned Cloud CLI`);

    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || target.startsWith('mailto:')) continue;
      if (/^https?:\/\//.test(target)) {
        if (target.includes('github.com/A3S-Lab/Cloud/')) {
          assert.ok(
            target.includes(release.cloudRevision),
            `${pagePath} has a mutable Cloud source link: ${target}`,
          );
        }
        continue;
      }
      assert.ok(
        existingDocument(resolveLocalLink(language, pagePath, target)),
        `${pagePath} has a broken link: ${target}`,
      );
    }

    for (const fence of source.matchAll(/```(bash|sh)\n([\s\S]*?)```/g)) {
      const snippet = fence[2];
      assert.doesNotMatch(snippet, /\brm\s+-rf\b|\bDROP\s+DATABASE\b/i);
      if (process.platform !== 'win32') {
        const checked = spawnSync('bash', ['-n'], { input: snippet, encoding: 'utf8' });
        assert.equal(checked.status, 0, `${pagePath} has invalid shell syntax: ${checked.stderr}`);
      }
    }
  }
}

assert.equal(release.surfaces.cli.status, 'planned');
assert.equal(release.surfaces.managementMcp.status, 'planned');
assert.deepEqual(release.commandHelp, [], 'planned command surfaces must not publish help fixtures');

for (const schema of release.apiSchemas) {
  const source = readFileSync(path.join(root, schema.source), 'utf8');
  assert.ok(source.includes(schema.marker), `${schema.id} source marker drift`);
  assert.equal(schema.status, release.surfaces.openapi.status);
}

const acl = require(path.join(root, 'crates/acl/sdk/node/src/index.js'));
for (const config of release.configFiles) {
  acl.parse(readFileSync(path.join(root, config), 'utf8'));
}

console.log(
  `cloud docs ok: ${pages.length * 2} pages, ${lockComponents.size} components, ${lockProtocols.size} protocols`,
);
